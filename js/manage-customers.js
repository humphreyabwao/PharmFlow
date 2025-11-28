import { db, collection, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, Timestamp } from './firebase-config.js';

class ManageCustomersModule {
    constructor() {
        console.log('ManageCustomersModule: Initializing...');
        this.customers = [];
        this.filteredCustomers = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedCustomers = new Set();
        this.unsubscribe = null;
        this.currentViewId = null;
        this.currentEditId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRealtimeListener();
    }

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('mcSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.handleSearch());
        }

        // Filter
        const statusFilter = document.getElementById('mcStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.handleSearch());
        }

        // Pagination
        const prevBtn = document.getElementById('mcPrevPage');
        const nextBtn = document.getElementById('mcNextPage');
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousPage());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextPage());

        // Select All
        const selectAll = document.getElementById('mcSelectAll');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        }

        // Action Buttons
        const refreshBtn = document.getElementById('mcRefreshBtn');
        const editBtn = document.getElementById('mcEditCustomer');
        const deleteBtn = document.getElementById('mcDeleteCustomer');

        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refresh());

        // Edit Form Submit
        const editForm = document.getElementById('mcEditForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
        }

        // Close modals on overlay click
        document.getElementById('mcViewModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'mcViewModal') this.closeViewModal();
        });
        document.getElementById('mcEditModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'mcEditModal') this.closeEditModal();
        });

        // Close modals on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeViewModal();
                this.closeEditModal();
            }
        });
        if (editBtn) editBtn.addEventListener('click', () => this.editSelectedCustomer());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteSelectedCustomers());

        console.log('ManageCustomersModule: Event listeners set up');
    }

    setupRealtimeListener() {
        console.log('ManageCustomersModule: Setting up real-time listener...');
        
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        try {
            const customersRef = collection(db, 'customers');
            const q = query(customersRef, orderBy('createdAt', 'desc'));

            this.unsubscribe = onSnapshot(q, 
                (snapshot) => {
                    console.log('ManageCustomersModule: Data received, count:', snapshot.size);
                    
                    this.customers = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    this.updateStats();
                    this.handleSearch();
                },
                (error) => {
                    console.error('ManageCustomersModule: Listener error:', error);
                    this.showTableError('Failed to load customers: ' + error.message);
                }
            );

        } catch (error) {
            console.error('ManageCustomersModule: Setup error:', error);
            this.showTableError('Failed to connect to database');
        }
    }

    refresh() {
        console.log('ManageCustomersModule: Refreshing...');
        this.setupRealtimeListener();
    }

    updateStats() {
        const total = this.customers.length;
        const active = this.customers.filter(c => c.status !== 'inactive').length;
        
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = this.customers.filter(c => {
            const createdAt = c.createdAt?.toDate?.();
            return createdAt && createdAt >= firstDay;
        }).length;

        const totalPurchases = this.customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);

        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setEl('mcTotalCustomers', total);
        setEl('mcActiveCustomers', active);
        setEl('mcNewCustomers', newThisMonth);
        setEl('mcTotalPurchases', 'Ksh ' + totalPurchases.toLocaleString());

        console.log('ManageCustomersModule: Stats updated');
    }

    handleSearch() {
        const searchInput = document.getElementById('mcSearchInput');
        const statusFilter = document.getElementById('mcStatusFilter');
        
        const term = (searchInput?.value || '').toLowerCase().trim();
        const status = statusFilter?.value || 'all';

        this.filteredCustomers = this.customers.filter(c => {
            const matchSearch = !term || 
                (c.name || '').toLowerCase().includes(term) ||
                (c.phone || '').toLowerCase().includes(term) ||
                (c.email || '').toLowerCase().includes(term);

            const matchStatus = status === 'all' || 
                (status === 'active' && c.status !== 'inactive') ||
                (status === 'inactive' && c.status === 'inactive');

            return matchSearch && matchStatus;
        });

        this.currentPage = 1;
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('mcCustomersTableBody');
        if (!tbody) return;

        if (this.filteredCustomers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="mc-no-data">No customers found</td></tr>`;
            this.updatePagination();
            this.updateActionButtons();
            return;
        }

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const page = this.filteredCustomers.slice(start, end);

        tbody.innerHTML = page.map(c => `
            <tr class="${this.selectedCustomers.has(c.id) ? 'selected' : ''}" data-id="${c.id}">
                <td>
                    <input type="checkbox" class="mc-row-checkbox" data-id="${c.id}" 
                        ${this.selectedCustomers.has(c.id) ? 'checked' : ''}>
                </td>
                <td>${c.id.substring(0, 8).toUpperCase()}</td>
                <td>${this.escape(c.name || 'N/A')}</td>
                <td>${this.escape(c.phone || 'N/A')}</td>
                <td>${this.escape(c.email || 'N/A')}</td>
                <td>${this.escape(c.address || 'N/A')}</td>
                <td>
                    <span class="mc-status-badge ${c.status === 'inactive' ? 'mc-status-inactive' : 'mc-status-active'}">
                        ${c.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                </td>
                <td>
                    <button class="mc-table-action" onclick="window.manageCustomersModule.viewCustomer('${c.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="mc-table-action" onclick="window.manageCustomersModule.editCustomer('${c.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="mc-table-action" onclick="window.manageCustomersModule.deleteCustomer('${c.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Add checkbox listeners
        tbody.querySelectorAll('.mc-row-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedCustomers.add(id);
                } else {
                    this.selectedCustomers.delete(id);
                }
                e.target.closest('tr').classList.toggle('selected', e.target.checked);
                this.updateActionButtons();
            });
        });

        this.updatePagination();
        this.updateActionButtons();
    }

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTableError(message) {
        const tbody = document.getElementById('mcCustomersTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="mc-no-data" style="color: #dc3545;">${message}</td></tr>`;
        }
    }

    toggleSelectAll(checked) {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const page = this.filteredCustomers.slice(start, end);

        page.forEach(c => {
            if (checked) {
                this.selectedCustomers.add(c.id);
            } else {
                this.selectedCustomers.delete(c.id);
            }
        });

        this.renderTable();
    }

    updateActionButtons() {
        const editBtn = document.getElementById('mcEditCustomer');
        const deleteBtn = document.getElementById('mcDeleteCustomer');

        if (editBtn) editBtn.disabled = this.selectedCustomers.size !== 1;
        if (deleteBtn) deleteBtn.disabled = this.selectedCustomers.size === 0;
    }

    updatePagination() {
        const total = this.filteredCustomers.length;
        const totalPages = Math.ceil(total / this.itemsPerPage) || 1;
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = Math.min(start + this.itemsPerPage, total);

        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setEl('mcShowingStart', total > 0 ? start + 1 : 0);
        setEl('mcShowingEnd', end);
        setEl('mcTotalRecords', total);
        setEl('mcCurrentPage', this.currentPage);
        setEl('mcTotalPages', totalPages);

        const prevBtn = document.getElementById('mcPrevPage');
        const nextBtn = document.getElementById('mcNextPage');
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredCustomers.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    }

    viewCustomer(id) {
        const c = this.customers.find(x => x.id === id);
        if (!c) return;

        this.currentViewId = id;

        // Populate view modal
        const setEl = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.textContent = val;
        };

        setEl('mcViewId', c.id.substring(0, 8).toUpperCase());
        setEl('mcViewName', c.name || 'N/A');
        setEl('mcViewPhone', c.phone || 'N/A');
        setEl('mcViewEmail', c.email || 'N/A');
        setEl('mcViewAddress', c.address || 'N/A');
        setEl('mcViewNotes', c.notes || 'No notes');

        // Status with styling
        const statusEl = document.getElementById('mcViewStatus');
        if (statusEl) {
            statusEl.innerHTML = `<span class="mc-status-badge ${c.status === 'inactive' ? 'mc-status-inactive' : 'mc-status-active'}">${c.status === 'inactive' ? 'Inactive' : 'Active'}</span>`;
        }

        // Dates
        const formatDate = (timestamp) => {
            if (!timestamp) return 'N/A';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        };

        setEl('mcViewCreated', formatDate(c.createdAt));
        setEl('mcViewUpdated', formatDate(c.updatedAt));

        // Show modal
        document.getElementById('mcViewModal')?.classList.add('active');
    }

    closeViewModal() {
        document.getElementById('mcViewModal')?.classList.remove('active');
        this.currentViewId = null;
    }

    openEditFromView() {
        if (this.currentViewId) {
            this.closeViewModal();
            this.editCustomer(this.currentViewId);
        }
    }

    editCustomer(id) {
        const c = this.customers.find(x => x.id === id);
        if (!c) return;

        this.currentEditId = id;

        // Populate edit form
        document.getElementById('mcEditId').value = id;
        document.getElementById('mcEditName').value = c.name || '';
        document.getElementById('mcEditPhone').value = c.phone || '';
        document.getElementById('mcEditEmail').value = c.email || '';
        document.getElementById('mcEditAddress').value = c.address || '';
        document.getElementById('mcEditStatus').value = c.status || 'active';
        document.getElementById('mcEditNotes').value = c.notes || '';

        // Show modal
        document.getElementById('mcEditModal')?.classList.add('active');
    }

    closeEditModal() {
        document.getElementById('mcEditModal')?.classList.remove('active');
        this.currentEditId = null;
    }

    async handleEditSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('mcEditId').value;
        if (!id) return;

        const name = document.getElementById('mcEditName').value.trim();
        const phone = document.getElementById('mcEditPhone').value.trim();

        if (!name || !phone) {
            alert('Name and phone are required');
            return;
        }

        const saveBtn = document.getElementById('mcEditSaveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const updateData = {
                name: name,
                phone: phone,
                email: document.getElementById('mcEditEmail').value.trim(),
                address: document.getElementById('mcEditAddress').value.trim(),
                status: document.getElementById('mcEditStatus').value,
                notes: document.getElementById('mcEditNotes').value.trim(),
                updatedAt: Timestamp.now()
            };

            await updateDoc(doc(db, 'customers', id), updateData);
            
            console.log('ManageCustomersModule: Customer updated:', id);
            this.closeEditModal();
            this.showNotification('Customer updated successfully!', 'success');

        } catch (error) {
            console.error('ManageCustomersModule: Update error:', error);
            alert('Failed to update customer: ' + error.message);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    editSelectedCustomer() {
        const id = Array.from(this.selectedCustomers)[0];
        if (id) this.editCustomer(id);
    }

    async deleteCustomer(id) {
        if (!confirm('Are you sure you want to delete this customer?')) return;

        try {
            await deleteDoc(doc(db, 'customers', id));
            this.selectedCustomers.delete(id);
            console.log('ManageCustomersModule: Customer deleted:', id);
            this.showNotification('Customer deleted successfully!', 'success');
        } catch (error) {
            console.error('ManageCustomersModule: Delete error:', error);
            alert('Failed to delete customer: ' + error.message);
        }
    }

    async deleteSelectedCustomers() {
        if (this.selectedCustomers.size === 0) return;
        
        const count = this.selectedCustomers.size;
        if (!confirm(`Delete ${count} customer(s)?`)) return;

        try {
            const promises = Array.from(this.selectedCustomers).map(id => 
                deleteDoc(doc(db, 'customers', id))
            );
            await Promise.all(promises);
            this.selectedCustomers.clear();
            console.log('ManageCustomersModule: Deleted', count, 'customers');
        } catch (error) {
            console.error('ManageCustomersModule: Bulk delete error:', error);
            alert('Failed to delete customers: ' + error.message);
        }
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.manageCustomersModule = new ManageCustomersModule();
    });
} else {
    window.manageCustomersModule = new ManageCustomersModule();
}

export { ManageCustomersModule };
