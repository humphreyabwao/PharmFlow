/**
 * PharmaFlow - Manage Orders Module
 * Clean, simple order management with pagination
 */

import { db } from './firebase-config.js';
import { 
    collection, 
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    where,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

class ManageOrdersModule {
    constructor() {
        this.orders = [];
        this.allOrders = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalOrders = 0;
        this.totalPages = 0;
        this.statusFilter = 'all';
        this.searchQuery = '';
        this.lastVisible = null;
        this.firstVisible = null;
        this.pageDocs = {};
        this.currentOrderId = null;
        this.selectedOrders = new Set();
        this.unsubscribe = null;
        
        this.init();
    }

    init() {
        if (!window.PharmaFlowFirebase?.db) {
            console.log('ManageOrders: Waiting for Firebase...');
            setTimeout(() => this.init(), 500);
            return;
        }

        console.log('ManageOrders: Initializing...');
        this.cacheElements();
        this.attachListeners();
        this.loadStats();
        this.loadOrders();
    }

    cacheElements() {
        this.elements = {
            // Stats
            totalOrders: document.getElementById('moTotalOrders'),
            pendingOrders: document.getElementById('moPendingOrders'),
            totalValue: document.getElementById('moTotalValue'),
            completedOrders: document.getElementById('moCompletedOrders'),
            
            // Controls
            statusFilter: document.getElementById('moStatusFilter'),
            searchInput: document.getElementById('moSearchInput'),
            refreshBtn: document.getElementById('moRefreshBtn'),
            exportExcel: document.getElementById('moExportExcel'),
            exportPDF: document.getElementById('moExportPDF'),
            markCompleted: document.getElementById('moMarkCompleted'),
            printInvoice: document.getElementById('moPrintInvoice'),
            deleteOrder: document.getElementById('moDeleteOrder'),
            
            // Table
            loading: document.getElementById('moLoading'),
            empty: document.getElementById('moEmpty'),
            table: document.getElementById('moTable'),
            tableBody: document.getElementById('moTableBody'),
            
            // Pagination
            pagination: document.getElementById('moPagination'),
            pageStart: document.getElementById('moPageStart'),
            pageEnd: document.getElementById('moPageEnd'),
            pageTotal: document.getElementById('moPageTotal'),
            pageNumbers: document.getElementById('moPageNumbers'),
            firstPage: document.getElementById('moFirstPage'),
            prevPage: document.getElementById('moPrevPage'),
            nextPage: document.getElementById('moNextPage'),
            lastPage: document.getElementById('moLastPage'),
            pageSize: document.getElementById('moPageSize'),
            
            // Modal
            modal: document.getElementById('moDetailsModal'),
            modalClose: document.getElementById('moModalClose'),
            modalCloseBtn: document.getElementById('moModalCloseBtn'),
            modalSaveBtn: document.getElementById('moModalSaveBtn'),
            modalOrderNum: document.getElementById('moModalOrderNum'),
            modalOrderDate: document.getElementById('moModalOrderDate'),
            modalStatus: document.getElementById('moModalStatus'),
            modalSupplier: document.getElementById('moModalSupplier'),
            modalContact: document.getElementById('moModalContact'),
            modalItems: document.getElementById('moModalItems'),
            modalTotal: document.getElementById('moModalTotal'),
            modalNotes: document.getElementById('moModalNotes'),
            modalNotesSection: document.getElementById('moModalNotesSection')
        };
    }

    attachListeners() {
        // Status filter
        this.elements.statusFilter?.addEventListener('change', () => {
            this.statusFilter = this.elements.statusFilter.value;
            this.currentPage = 1;
            this.pageDocs = {};
            this.loadOrders();
        });

        // Search with debounce
        let searchTimeout;
        this.elements.searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = this.elements.searchInput.value.trim().toLowerCase();
                this.currentPage = 1;
                this.pageDocs = {};
                this.loadOrders();
            }, 300);
        });

        // Refresh
        this.elements.refreshBtn?.addEventListener('click', () => {
            this.loadStats();
            this.loadOrders();
        });

        // Export buttons
        this.elements.exportExcel?.addEventListener('click', () => this.exportToExcel());
        this.elements.exportPDF?.addEventListener('click', () => this.exportToPDF());

        // Quick action buttons
        this.elements.markCompleted?.addEventListener('click', () => {
            console.log('Mark completed clicked');
            this.markSelectedAsCompleted();
        });
        this.elements.printInvoice?.addEventListener('click', () => {
            console.log('Print invoice clicked', 'Selected orders:', this.selectedOrders.size);
            this.printSelectedInvoice();
        });
        this.elements.deleteOrder?.addEventListener('click', () => {
            console.log('Delete clicked');
            this.deleteSelectedOrder();
        });

        // Pagination
        this.elements.firstPage?.addEventListener('click', () => this.goToPage(1));
        this.elements.prevPage?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.elements.nextPage?.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.elements.lastPage?.addEventListener('click', () => this.goToPage(this.totalPages));
        
        this.elements.pageSize?.addEventListener('change', () => {
            this.pageSize = parseInt(this.elements.pageSize.value);
            this.currentPage = 1;
            this.pageDocs = {};
            this.loadOrders();
        });

        // Modal
        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.modalCloseBtn?.addEventListener('click', () => this.closeModal());
        this.elements.modal?.querySelector('.mo-modal-overlay')?.addEventListener('click', () => this.closeModal());
        
        this.elements.modalSaveBtn?.addEventListener('click', () => this.saveOrderChanges());

        // Quick access buttons
        document.querySelectorAll('[data-module="orders-create"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const link = document.querySelector('.submenu-link[data-module="orders-create"]');
                if (link) link.click();
            });
        });

        document.querySelectorAll('[data-module="orders-supplier"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const link = document.querySelector('.submenu-link[data-module="orders-supplier"]');
                if (link) link.click();
            });
        });

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('moSelectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                document.querySelectorAll('.mo-order-checkbox').forEach(checkbox => {
                    checkbox.checked = isChecked;
                    const orderId = checkbox.dataset.orderId;
                    if (isChecked) {
                        this.selectedOrders.add(orderId);
                    } else {
                        this.selectedOrders.delete(orderId);
                    }
                });
                this.updateActionButtonsState();
            });
        }
    }

    async loadStats() {
        try {
            const ordersRef = collection(db, 'orders');
            
            // Get all orders for stats calculation
            const allOrdersSnap = await getDocs(ordersRef);
            const pendingQuery = query(ordersRef, where('status', '==', 'pending'));
            const completedQuery = query(ordersRef, where('status', '==', 'completed'));
            
            const [pendingSnap, completedSnap] = await Promise.all([
                getCountFromServer(pendingQuery),
                getCountFromServer(completedQuery)
            ]);

            let totalValue = 0;
            allOrdersSnap.forEach(doc => {
                const order = doc.data();
                totalValue += order.grandTotal || 0;
            });

            if (this.elements.totalOrders) {
                this.elements.totalOrders.textContent = allOrdersSnap.size;
            }
            if (this.elements.pendingOrders) {
                this.elements.pendingOrders.textContent = pendingSnap.data().count;
            }
            if (this.elements.completedOrders) {
                this.elements.completedOrders.textContent = completedSnap.data().count;
            }
            if (this.elements.totalValue) {
                this.elements.totalValue.textContent = `KSH ${totalValue.toLocaleString()}`;
            }

        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadOrders() {
        this.showLoading();

        try {
            const ordersRef = collection(db, 'orders');
            let q;

            // Build query
            if (this.statusFilter !== 'all') {
                q = query(
                    ordersRef,
                    where('status', '==', this.statusFilter),
                    orderBy('createdAt', 'desc')
                );
            } else {
                q = query(
                    ordersRef,
                    orderBy('createdAt', 'desc')
                );
            }

            // Get all matching orders for client-side filtering and pagination
            const snapshot = await getDocs(q);
            this.allOrders = [];
            
            snapshot.forEach(doc => {
                const order = { id: doc.id, ...doc.data() };
                
                // Apply search filter
                if (this.searchQuery) {
                    const searchText = `${order.orderNumber} ${order.supplierName}`.toLowerCase();
                    if (searchText.includes(this.searchQuery)) {
                        this.allOrders.push(order);
                    }
                } else {
                    this.allOrders.push(order);
                }
            });

            this.totalOrders = this.allOrders.length;
            this.totalPages = Math.ceil(this.totalOrders / this.pageSize);

            // Get orders for current page
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            this.orders = this.allOrders.slice(startIndex, endIndex);

            this.renderOrders();
            this.updatePagination();

        } catch (error) {
            console.error('Error loading orders:', error);
            this.showEmpty();
        }
    }

    showLoading() {
        if (this.elements.loading) this.elements.loading.style.display = 'flex';
        if (this.elements.empty) this.elements.empty.style.display = 'none';
        if (this.elements.table) this.elements.table.style.display = 'none';
        if (this.elements.pagination) this.elements.pagination.style.display = 'none';
    }

    showEmpty() {
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.empty) this.elements.empty.style.display = 'flex';
        if (this.elements.table) this.elements.table.style.display = 'none';
        if (this.elements.pagination) this.elements.pagination.style.display = 'none';
    }

    renderOrders() {
        if (this.orders.length === 0) {
            this.showEmpty();
            return;
        }

        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.empty) this.elements.empty.style.display = 'none';
        if (this.elements.table) this.elements.table.style.display = 'table';
        if (this.elements.pagination) this.elements.pagination.style.display = 'flex';

        const tbody = this.elements.tableBody;
        tbody.innerHTML = '';

        this.orders.forEach(order => {
            const row = document.createElement('tr');
            
            const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
            const dateStr = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });

            const isChecked = this.selectedOrders.has(order.id);

            row.innerHTML = `
                <td><input type="checkbox" class="mo-order-checkbox" data-order-id="${order.id}" ${isChecked ? 'checked' : ''}></td>
                <td><strong>${order.orderNumber || 'N/A'}</strong></td>
                <td>${dateStr}</td>
                <td>${order.supplierName || 'Unknown'}</td>
                <td>${order.items?.length || 0} items</td>
                <td><strong>KSH ${(order.grandTotal || 0).toLocaleString()}</strong></td>
                <td><span class="mo-status-badge mo-status-${order.status}">${this.capitalizeFirst(order.status || 'pending')}</span></td>
                <td>
                    <button class="mo-btn-icon" data-action="view" data-id="${order.id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;

            // Attach checkbox event
            const checkbox = row.querySelector('.mo-order-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedOrders.add(order.id);
                } else {
                    this.selectedOrders.delete(order.id);
                }
                this.updateActionButtonsState();
            });

            // Attach event to view button
            row.querySelector('[data-action="view"]').addEventListener('click', () => {
                this.viewOrderDetails(order);
            });

            tbody.appendChild(row);
        });

        this.updateActionButtonsState();
    }

    updatePagination() {
        const startIndex = (this.currentPage - 1) * this.pageSize + 1;
        const endIndex = Math.min(this.currentPage * this.pageSize, this.totalOrders);

        if (this.elements.pageStart) this.elements.pageStart.textContent = this.totalOrders > 0 ? startIndex : 0;
        if (this.elements.pageEnd) this.elements.pageEnd.textContent = endIndex;
        if (this.elements.pageTotal) this.elements.pageTotal.textContent = this.totalOrders;

        // Update buttons
        if (this.elements.firstPage) this.elements.firstPage.disabled = this.currentPage === 1;
        if (this.elements.prevPage) this.elements.prevPage.disabled = this.currentPage === 1;
        if (this.elements.nextPage) this.elements.nextPage.disabled = this.currentPage === this.totalPages;
        if (this.elements.lastPage) this.elements.lastPage.disabled = this.currentPage === this.totalPages;

        // Render page numbers
        this.renderPageNumbers();
    }

    renderPageNumbers() {
        if (!this.elements.pageNumbers) return;

        const maxPages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxPages - 1);

        if (endPage - startPage < maxPages - 1) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }

        let html = '';
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="mo-page-num ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        this.elements.pageNumbers.innerHTML = html;

        // Attach listeners
        this.elements.pageNumbers.querySelectorAll('.mo-page-num').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                this.goToPage(page);
            });
        });
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        this.currentPage = page;
        this.loadOrders();
    }

    viewOrderDetails(order) {
        this.currentOrderId = order.id;

        if (this.elements.modalOrderNum) {
            this.elements.modalOrderNum.textContent = order.orderNumber || 'N/A';
        }
        
        if (this.elements.modalOrderDate) {
            const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
            this.elements.modalOrderDate.textContent = date.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        if (this.elements.modalStatus) {
            this.elements.modalStatus.value = order.status || 'pending';
        }

        if (this.elements.modalSupplier) {
            this.elements.modalSupplier.textContent = order.supplierName || 'Unknown';
        }

        if (this.elements.modalContact) {
            this.elements.modalContact.textContent = order.supplierContact || 'N/A';
        }

        // Render items
        if (this.elements.modalItems) {
            this.elements.modalItems.innerHTML = '';
            
            (order.items || []).forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>KSH ${item.price?.toLocaleString() || '0'}</td>
                    <td><strong>KSH ${((item.quantity * item.price) || 0).toLocaleString()}</strong></td>
                `;
                this.elements.modalItems.appendChild(row);
            });
        }

        if (this.elements.modalTotal) {
            this.elements.modalTotal.textContent = `KSH ${(order.grandTotal || 0).toLocaleString()}`;
        }

        if (order.notes && order.notes.trim()) {
            if (this.elements.modalNotesSection) this.elements.modalNotesSection.style.display = 'block';
            if (this.elements.modalNotes) this.elements.modalNotes.textContent = order.notes;
        } else {
            if (this.elements.modalNotesSection) this.elements.modalNotesSection.style.display = 'none';
        }

        this.openModal();
    }

    async saveOrderChanges() {
        if (!this.currentOrderId) return;

        try {
            const newStatus = this.elements.modalStatus.value;
            const orderRef = doc(db, 'orders', this.currentOrderId);
            
            await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: new Date()
            });

            console.log('Order status updated successfully');
            this.closeModal();
            this.loadStats();
            this.loadOrders();

        } catch (error) {
            console.error('Error updating order:', error);
            alert('Failed to update order status');
        }
    }

    openModal() {
        if (this.elements.modal) {
            this.elements.modal.style.display = 'flex';
        }
    }

    closeModal() {
        if (this.elements.modal) {
            this.elements.modal.style.display = 'none';
        }
        this.currentOrderId = null;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    updateActionButtonsState() {
        const hasSelection = this.selectedOrders.size > 0;
        
        if (this.elements.markCompleted) {
            this.elements.markCompleted.disabled = !hasSelection;
            this.elements.markCompleted.style.opacity = hasSelection ? '1' : '0.5';
            this.elements.markCompleted.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
        }
        if (this.elements.printInvoice) {
            this.elements.printInvoice.disabled = this.selectedOrders.size !== 1;
            this.elements.printInvoice.style.opacity = this.selectedOrders.size === 1 ? '1' : '0.5';
            this.elements.printInvoice.style.cursor = this.selectedOrders.size === 1 ? 'pointer' : 'not-allowed';
        }
        if (this.elements.deleteOrder) {
            this.elements.deleteOrder.disabled = !hasSelection;
            this.elements.deleteOrder.style.opacity = hasSelection ? '1' : '0.5';
            this.elements.deleteOrder.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
        }
    }

    async markSelectedAsCompleted() {
        if (this.selectedOrders.size === 0) {
            alert('Please select at least one order');
            return;
        }

        if (!confirm(`Mark ${this.selectedOrders.size} order(s) as completed?`)) {
            return;
        }

        try {
            const promises = Array.from(this.selectedOrders).map(orderId => {
                const orderRef = doc(db, 'orders', orderId);
                return updateDoc(orderRef, {
                    status: 'completed',
                    updatedAt: new Date()
                });
            });

            await Promise.all(promises);
            
            alert(`Successfully marked ${this.selectedOrders.size} order(s) as completed`);
            this.selectedOrders.clear();
            this.loadStats();
            this.loadOrders();

        } catch (error) {
            console.error('Error marking orders as completed:', error);
            alert('Failed to update orders. Please try again.');
        }
    }

    async deleteSelectedOrder() {
        if (this.selectedOrders.size === 0) {
            alert('Please select at least one order to delete');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${this.selectedOrders.size} order(s)? This action cannot be undone.`)) {
            return;
        }

        try {
            const promises = Array.from(this.selectedOrders).map(orderId => {
                const orderRef = doc(db, 'orders', orderId);
                return deleteDoc(orderRef);
            });

            await Promise.all(promises);
            
            alert(`Successfully deleted ${this.selectedOrders.size} order(s)`);
            this.selectedOrders.clear();
            this.loadStats();
            this.loadOrders();

        } catch (error) {
            console.error('Error deleting orders:', error);
            alert('Failed to delete orders. Please try again.');
        }
    }

    printSelectedInvoice() {
        try {
            if (this.selectedOrders.size !== 1) {
                alert('Please select exactly one order to print');
                return;
            }

            const orderId = Array.from(this.selectedOrders)[0];
            const order = this.allOrders.find(o => o.id === orderId);

            if (!order) {
                alert('Order not found');
                return;
            }

            if (!order.items || order.items.length === 0) {
                alert('This order has no items to print');
                return;
            }

            const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
            
            let itemsHTML = '';
            let subtotal = 0;
            let itemNumber = 1;
            
            order.items.forEach(item => {
                const quantity = item.quantity || 0;
                const price = item.price || 0;
                const itemTotal = quantity * price;
                subtotal += itemTotal;
                itemsHTML += `
                    <tr>
                        <td>${itemNumber++}</td>
                        <td>${item.name || 'N/A'}</td>
                        <td>${quantity}</td>
                        <td>KSH ${price.toLocaleString()}</td>
                        <td>KSH ${itemTotal.toLocaleString()}</td>
                    </tr>
                `;
            });

        const invoiceHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice - ${order.orderNumber}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 11px;
                        line-height: 1.4;
                        padding: 20px;
                        color: #000;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .invoice-container {
                        border: 2px solid #000;
                        padding: 15px;
                    }
                    .invoice-header {
                        text-align: center;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                        margin-bottom: 15px;
                    }
                    .invoice-header h1 {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 3px;
                        letter-spacing: 2px;
                    }
                    .invoice-header .company-name {
                        font-size: 14px;
                        font-weight: bold;
                        margin-bottom: 2px;
                    }
                    .invoice-header .tagline {
                        font-size: 9px;
                        font-style: italic;
                    }
                    .invoice-details {
                        display: table;
                        width: 100%;
                        margin-bottom: 15px;
                        border-bottom: 1px solid #000;
                        padding-bottom: 10px;
                    }
                    .details-row {
                        display: table-row;
                    }
                    .details-cell {
                        display: table-cell;
                        width: 50%;
                        padding: 3px 0;
                        vertical-align: top;
                    }
                    .details-cell.right {
                        text-align: right;
                    }
                    .section-title {
                        font-weight: bold;
                        font-size: 11px;
                        text-decoration: underline;
                        margin-bottom: 5px;
                        margin-top: 5px;
                    }
                    .detail-line {
                        margin: 2px 0;
                        font-size: 10px;
                    }
                    .detail-label {
                        font-weight: bold;
                        display: inline-block;
                        min-width: 80px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 10px 0;
                        font-size: 10px;
                    }
                    table thead {
                        border-top: 2px solid #000;
                        border-bottom: 2px solid #000;
                    }
                    table th {
                        padding: 5px 3px;
                        text-align: left;
                        font-weight: bold;
                        background-color: #f0f0f0;
                    }
                    table th:first-child {
                        width: 10%;
                    }
                    table th:nth-child(2) {
                        width: 40%;
                    }
                    table th:nth-child(3),
                    table th:nth-child(4),
                    table th:nth-child(5) {
                        text-align: right;
                        width: 16.66%;
                    }
                    table tbody tr {
                        border-bottom: 1px dotted #666;
                    }
                    table td {
                        padding: 4px 3px;
                        vertical-align: top;
                    }
                    table td:nth-child(3),
                    table td:nth-child(4),
                    table td:nth-child(5) {
                        text-align: right;
                    }
                    table tfoot {
                        border-top: 2px solid #000;
                    }
                    table tfoot td {
                        padding: 5px 3px;
                        font-weight: bold;
                    }
                    .totals-section {
                        margin-top: 10px;
                        border-top: 2px solid #000;
                        padding-top: 10px;
                    }
                    .total-line {
                        display: flex;
                        justify-content: space-between;
                        padding: 3px 0;
                        font-size: 10px;
                    }
                    .total-line.grand {
                        font-size: 12px;
                        font-weight: bold;
                        border-top: 2px double #000;
                        border-bottom: 2px double #000;
                        padding: 5px 0;
                        margin-top: 5px;
                    }
                    .notes-section {
                        margin-top: 15px;
                        border: 1px solid #000;
                        padding: 8px;
                        font-size: 9px;
                    }
                    .notes-title {
                        font-weight: bold;
                        margin-bottom: 3px;
                    }
                    .footer {
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 1px solid #000;
                        text-align: center;
                        font-size: 9px;
                    }
                    .footer-line {
                        margin: 3px 0;
                    }
                    .signature-section {
                        margin-top: 30px;
                        display: flex;
                        justify-content: space-between;
                    }
                    .signature-box {
                        width: 45%;
                        text-align: center;
                    }
                    .signature-line {
                        border-top: 1px solid #000;
                        margin-top: 40px;
                        padding-top: 3px;
                        font-size: 9px;
                    }
                    @media print {
                        body { padding: 10px; }
                        .invoice-container { border: 1px solid #000; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <div class="invoice-header">
                        <div class="company-name">PHARMAFLOW</div>
                        <h1>PURCHASE ORDER</h1>
                        <div class="tagline">Pharmacy Management System</div>
                    </div>
                    
                    <div class="invoice-details">
                        <div class="details-row">
                            <div class="details-cell">
                                <div class="section-title">ORDER INFORMATION</div>
                                <div class="detail-line"><span class="detail-label">Order No:</span> ${order.orderNumber}</div>
                                <div class="detail-line"><span class="detail-label">Date:</span> ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                <div class="detail-line"><span class="detail-label">Time:</span> ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                <div class="detail-line"><span class="detail-label">Status:</span> ${this.capitalizeFirst(order.status).toUpperCase()}</div>
                            </div>
                            <div class="details-cell right">
                                <div class="section-title">SUPPLIER DETAILS</div>
                                <div class="detail-line"><span class="detail-label">Name:</span> ${order.supplierName}</div>
                                <div class="detail-line"><span class="detail-label">Contact:</span> ${order.supplierContact || 'N/A'}</div>
                                <div class="detail-line"><span class="detail-label">Phone:</span> ${order.supplierPhone || 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>ITEM DESCRIPTION</th>
                                <th>QTY</th>
                                <th>UNIT PRICE</th>
                                <th>AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div class="totals-section">
                        <div class="total-line">
                            <span>SUBTOTAL:</span>
                            <span>KSH ${subtotal.toLocaleString()}</span>
                        </div>
                        <div class="total-line">
                            <span>TAX (0%):</span>
                            <span>KSH 0.00</span>
                        </div>
                        <div class="total-line grand">
                            <span>GRAND TOTAL:</span>
                            <span>KSH ${(order.grandTotal || subtotal).toLocaleString()}</span>
                        </div>
                        <div class="detail-line" style="text-align: right; margin-top: 5px; font-size: 9px; font-style: italic;">
                            Total Items: ${order.items?.length || 0}
                        </div>
                    </div>

                    ${order.notes ? `
                        <div class="notes-section">
                            <div class="notes-title">NOTES / TERMS:</div>
                            <div>${order.notes}</div>
                        </div>
                    ` : ''}

                    <div class="signature-section">
                        <div class="signature-box">
                            <div class="signature-line">Authorized By</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-line">Received By</div>
                        </div>
                    </div>

                    <div class="footer">
                        <div class="footer-line">*** PURCHASE ORDER ***</div>
                        <div class="footer-line">Generated: ${new Date().toLocaleDateString('en-US')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div class="footer-line">PharmaFlow - Professional Pharmacy Management</div>
                        <div class="footer-line">Thank you for your business!</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `;

            // Open new window and write content
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (!printWindow) {
                alert('Pop-up blocked. Please allow pop-ups for this site.');
                return;
            }
            
            printWindow.document.open();
            printWindow.document.write(invoiceHTML);
            printWindow.document.close();
            printWindow.focus();
            
        } catch (error) {
            console.error('Error printing invoice:', error);
            alert('Failed to print invoice: ' + error.message);
        }
    }

    exportToExcel() {
        try {
            // Prepare data for export
            const exportData = this.allOrders.map(order => {
                const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                return {
                    'Order Number': order.orderNumber || 'N/A',
                    'Date': date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    'Supplier': order.supplierName || 'Unknown',
                    'Contact': order.supplierContact || 'N/A',
                    'Items': order.items?.length || 0,
                    'Total (KSH)': order.grandTotal || 0,
                    'Status': this.capitalizeFirst(order.status || 'pending')
                };
            });

            // Check if XLSX library is available
            if (typeof XLSX === 'undefined') {
                alert('Excel export library not loaded. Please refresh the page.');
                return;
            }

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Set column widths
            ws['!cols'] = [
                { wch: 15 }, // Order Number
                { wch: 12 }, // Date
                { wch: 25 }, // Supplier
                { wch: 20 }, // Contact
                { wch: 8 },  // Items
                { wch: 15 }, // Total
                { wch: 12 }  // Status
            ];

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Orders');

            // Generate filename with date
            const filename = `Orders_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Save file
            XLSX.writeFile(wb, filename);

            console.log('Excel export successful');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export to Excel. Please try again.');
        }
    }

    exportToPDF() {
        try {
            // Check if jsPDF is available
            if (typeof window.jspdf === 'undefined') {
                alert('PDF export library not loaded. Please refresh the page.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Add title
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('Orders Report', 14, 20);

            // Add date
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 14, 28);

            // Add stats
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Summary:', 14, 38);
            doc.setFont(undefined, 'normal');
            doc.text(`Total Orders: ${this.totalOrders}`, 14, 44);
            doc.text(`Pending: ${this.elements.pendingOrders?.textContent || 0}`, 70, 44);
            doc.text(`Completed: ${this.elements.completedOrders?.textContent || 0}`, 126, 44);
            doc.text(`Total Value: ${this.elements.totalValue?.textContent || 'KSH 0'}`, 14, 50);

            // Prepare table data
            const tableData = this.allOrders.map(order => {
                const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                return [
                    order.orderNumber || 'N/A',
                    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    order.supplierName || 'Unknown',
                    `${order.items?.length || 0} items`,
                    `KSH ${(order.grandTotal || 0).toLocaleString()}`,
                    this.capitalizeFirst(order.status || 'pending')
                ];
            });

            // Add table
            doc.autoTable({
                head: [['Order #', 'Date', 'Supplier', 'Items', 'Total', 'Status']],
                body: tableData,
                startY: 58,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [26, 115, 232], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { top: 58, left: 14, right: 14 }
            });

            // Generate filename with date
            const filename = `Orders_${new Date().toISOString().split('T')[0]}.pdf`;

            // Save file
            doc.save(filename);

            console.log('PDF export successful');
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            alert('Failed to export to PDF. Please try again.');
        }
    }
}

// Initialize when DOM is ready
let manageOrdersInstance = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        manageOrdersInstance = new ManageOrdersModule();
        window.PharmaFlowManageOrders = manageOrdersInstance;
        // Expose public API for global search
        window.PharmaFlowOrders = {
            getOrders: () => manageOrdersInstance.allOrders,
            refresh: () => manageOrdersInstance.loadOrders()
        };
    });
} else {
    manageOrdersInstance = new ManageOrdersModule();
    window.PharmaFlowManageOrders = manageOrdersInstance;
    // Expose public API for global search
    window.PharmaFlowOrders = {
        getOrders: () => manageOrdersInstance.allOrders,
        refresh: () => manageOrdersInstance.loadOrders()
    };
}

export default ManageOrdersModule;
