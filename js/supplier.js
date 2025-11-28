/**
 * PharmaFlow Supplier Management Module
 * Real-time supplier management with Firebase Firestore
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot, 
    query, 
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // State Management
    // ============================================
    const state = {
        suppliers: [],
        filteredSuppliers: [],
        unsubscribe: null,
        editingSupplier: null
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Form
            form: document.getElementById('addSupplierForm'),
            supplierName: document.getElementById('supplierName'),
            supplierContact: document.getElementById('supplierContact'),
            supplierPhone: document.getElementById('supplierPhone'),
            supplierEmail: document.getElementById('supplierEmail'),
            supplierAddress: document.getElementById('supplierAddress'),
            supplierCategory: document.getElementById('supplierCategory'),
            supplierStatus: document.getElementById('supplierStatus'),
            
            // Table
            tableLoading: document.getElementById('supplierTableLoading'),
            tableEmpty: document.getElementById('supplierTableEmpty'),
            table: document.getElementById('supplierTable'),
            tableBody: document.getElementById('supplierTableBody'),
            searchInput: document.getElementById('supplierSearchInput'),
            refreshBtn: document.getElementById('refreshSuppliersBtn')
        };
    }

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        console.log('Supplier module: Starting initialization...');
        cacheElements();
        bindEvents();
        startRealtimeListener();
        console.info('PharmaFlow Supplier module initialized.');
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        if (elements.form) {
            elements.form.addEventListener('submit', handleSubmit);
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }

        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', handleRefresh);
        }

        // Module navigation buttons
        document.querySelectorAll('.btn-module-action').forEach(btn => {
            btn.addEventListener('click', function() {
                const targetModule = this.getAttribute('data-module');
                if (targetModule && window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                    window.PharmaFlow.setActiveModule(targetModule);
                }
            });
        });
    }

    // ============================================
    // Real-time Listener
    // ============================================
    function startRealtimeListener() {
        try {
            const suppliersRef = collection(db, 'suppliers');
            const suppliersQuery = query(suppliersRef, orderBy('name'));

            state.unsubscribe = onSnapshot(suppliersQuery, (snapshot) => {
                state.suppliers = [];
                snapshot.forEach((doc) => {
                    state.suppliers.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                state.filteredSuppliers = [...state.suppliers];
                updateStats();
                renderTable();
                console.log(`Loaded ${state.suppliers.length} suppliers`);
            }, (error) => {
                console.error('Error listening to suppliers:', error);
                showError('Failed to load suppliers');
            });
        } catch (error) {
            console.error('Failed to setup supplier listener:', error);
            showError('Failed to connect to database');
        }
    }

    // ============================================
    // Form Handling
    // ============================================
    async function handleSubmit(e) {
        e.preventDefault();

        const supplierData = {
            name: elements.supplierName.value.trim(),
            contactPerson: elements.supplierContact.value.trim(),
            phone: elements.supplierPhone.value.trim(),
            email: elements.supplierEmail.value.trim(),
            address: elements.supplierAddress.value.trim(),
            category: elements.supplierCategory.value,
            status: elements.supplierStatus.value,
            createdAt: serverTimestamp()
        };

        try {
            if (state.editingSupplier) {
                // Update existing supplier
                await updateDoc(doc(db, 'suppliers', state.editingSupplier.id), {
                    ...supplierData,
                    updatedAt: serverTimestamp()
                });
                showSuccess('Supplier updated successfully!');
                state.editingSupplier = null;
            } else {
                // Add new supplier
                await addDoc(collection(db, 'suppliers'), supplierData);
                showSuccess('Supplier added successfully!');
            }

            elements.form.reset();
        } catch (error) {
            console.error('Error saving supplier:', error);
            showError('Failed to save supplier');
        }
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase().trim();

        if (!searchTerm) {
            state.filteredSuppliers = [...state.suppliers];
        } else {
            state.filteredSuppliers = state.suppliers.filter(supplier => 
                supplier.name.toLowerCase().includes(searchTerm) ||
                (supplier.contactPerson && supplier.contactPerson.toLowerCase().includes(searchTerm)) ||
                supplier.phone.includes(searchTerm) ||
                (supplier.email && supplier.email.toLowerCase().includes(searchTerm))
            );
        }

        renderTable();
    }

    function handleRefresh() {
        const icon = elements.refreshBtn.querySelector('i');
        if (icon) {
            icon.style.animation = 'spin 0.5s linear';
            setTimeout(() => {
                icon.style.animation = '';
            }, 500);
        }
    }

    // ============================================
    // Stats Update
    // ============================================
    function updateStats() {
        const totalCount = document.getElementById('totalSuppliersCount');
        if (totalCount) {
            totalCount.textContent = state.suppliers.length;
        }
    }

    // ============================================
    // Table Rendering
    // ============================================
    function renderTable() {
        // Hide loading
        elements.tableLoading.style.display = 'none';

        if (state.filteredSuppliers.length === 0) {
            elements.table.style.display = 'none';
            elements.tableEmpty.style.display = 'flex';
            return;
        }

        elements.tableEmpty.style.display = 'none';
        elements.table.style.display = 'table';

        elements.tableBody.innerHTML = state.filteredSuppliers.map(supplier => `
            <tr>
                <td><span class="supplier-name">${supplier.name}</span></td>
                <td>${supplier.contactPerson || '-'}</td>
                <td>${supplier.phone}</td>
                <td>${supplier.email || '-'}</td>
                <td><span class="supplier-category">${formatCategory(supplier.category)}</span></td>
                <td><span class="supplier-status ${supplier.status}">${supplier.status}</span></td>
                <td>
                    <div class="table-actions-cell">
                        <button class="btn-action btn-edit" onclick="window.PharmaFlowSupplier.editSupplier('${supplier.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-action btn-delete" onclick="window.PharmaFlowSupplier.deleteSupplier('${supplier.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // ============================================
    // CRUD Operations
    // ============================================
    function editSupplier(supplierId) {
        const supplier = state.suppliers.find(s => s.id === supplierId);
        if (!supplier) return;

        state.editingSupplier = supplier;

        elements.supplierName.value = supplier.name;
        elements.supplierContact.value = supplier.contactPerson || '';
        elements.supplierPhone.value = supplier.phone;
        elements.supplierEmail.value = supplier.email || '';
        elements.supplierAddress.value = supplier.address || '';
        elements.supplierCategory.value = supplier.category || '';
        elements.supplierStatus.value = supplier.status;

        // Scroll to form
        elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        elements.supplierName.focus();
    }

    async function deleteSupplier(supplierId) {
        const supplier = state.suppliers.find(s => s.id === supplierId);
        if (!supplier) return;

        if (!confirm(`Are you sure you want to delete "${supplier.name}"?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'suppliers', supplierId));
            showSuccess('Supplier deleted successfully!');
        } catch (error) {
            console.error('Error deleting supplier:', error);
            showError('Failed to delete supplier');
        }
    }

    // ============================================
    // Helper Functions
    // ============================================
    function formatCategory(category) {
        if (!category) return 'N/A';
        return category.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    function showSuccess(message) {
        alert(message);
    }

    function showError(message) {
        alert(message);
    }

    // ============================================
    // Cleanup
    // ============================================
    function cleanup() {
        if (state.unsubscribe) {
            state.unsubscribe();
            state.unsubscribe = null;
        }
    }

    // ============================================
    // Public API
    // ============================================
    const api = {
        init,
        cleanup,
        editSupplier,
        deleteSupplier,
        getSuppliers: () => state.suppliers,
        refresh: handleRefresh
    };

    window.PharmaFlowSupplier = api;
    // Also expose as PharmaFlowSuppliers for global search compatibility
    window.PharmaFlowSuppliers = api;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

})(window, document);
