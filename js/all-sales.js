/**
 * PharmaFlow All Sales Module
 * Complete sales history with Firestore real-time sync
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // State Management
    // ============================================
    const state = {
        sales: [],
        filteredSales: [],
        unsubscribe: null,
        dateFilter: 'all',
        paymentFilter: 'all',
        statusFilter: 'all',
        currentSale: null
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Stat cards
            totalCount: document.getElementById('allSalesTotalCount'),
            revenueAmount: document.getElementById('allSalesRevenueAmount'),
            profitAmount: document.getElementById('allSalesProfitAmount'),
            cashCount: document.getElementById('allCashSalesCount'),
            mpesaCount: document.getElementById('allMpesaSalesCount'),

            // Table
            tableBody: document.getElementById('allSalesTableBody'),
            tableEmpty: document.getElementById('allSalesTableEmpty'),
            tableLoading: document.getElementById('allSalesTableLoading'),
            searchInput: document.getElementById('allSalesSearchInput'),
            filterDate: document.getElementById('allSalesFilterDate'),
            filterPayment: document.getElementById('allSalesFilterPayment'),
            filterStatus: document.getElementById('allSalesFilterStatus'),

            // Export Button
            btnExport: document.getElementById('btnExportAllSales'),

            // View Sale Modal
            viewModal: document.getElementById('viewAllSaleModal'),
            closeViewModal: document.getElementById('closeViewAllSaleModal'),
            detailsContent: document.getElementById('allSaleDetailsContent'),
            btnPrint: document.getElementById('btnPrintAllReceipt'),
            btnCloseDetails: document.getElementById('btnCloseAllDetails')
        };
    }

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        cacheElements();
        bindEvents();
        startRealtimeListener();
        console.info('PharmaFlow All Sales module initialized.');
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        // View Sale Modal
        if (elements.closeViewModal) {
            elements.closeViewModal.addEventListener('click', closeViewModal);
        }
        if (elements.btnCloseDetails) {
            elements.btnCloseDetails.addEventListener('click', closeViewModal);
        }
        if (elements.btnPrint) {
            elements.btnPrint.addEventListener('click', handlePrintReceipt);
        }

        // Filters
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce(applyFilters, 300));
        }
        if (elements.filterDate) {
            elements.filterDate.addEventListener('change', handleDateFilterChange);
        }
        if (elements.filterPayment) {
            elements.filterPayment.addEventListener('change', handlePaymentFilterChange);
        }
        if (elements.filterStatus) {
            elements.filterStatus.addEventListener('change', handleStatusFilterChange);
        }

        // Export
        if (elements.btnExport) {
            elements.btnExport.addEventListener('click', handleExport);
        }

        // Close modals on outside click
        if (elements.viewModal) {
            elements.viewModal.addEventListener('click', (e) => {
                if (e.target === elements.viewModal) closeViewModal();
            });
        }
    }

    // ============================================
    // Firestore Real-time Listener
    // ============================================
    function startRealtimeListener() {
        showLoading(true);
        
        const salesRef = collection(db, 'sales');
        const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));

        state.unsubscribe = onSnapshot(salesQuery, (snapshot) => {
            state.sales = [];
            snapshot.forEach((doc) => {
                state.sales.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            applyFilters();
            updateStats();
            showLoading(false);
            console.info(`All sales updated: ${state.sales.length} records`);
        }, (error) => {
            console.error('Error listening to sales:', error);
            showLoading(false);
            showEmptyState(true);
        });
    }

    // ============================================
    // Date Filtering
    // ============================================
    function getDateRange(filter) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (filter) {
            case 'today':
                return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
            case 'yesterday':
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                return { start: yesterday, end: today };
            case 'week':
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                return { start: weekAgo, end: new Date() };
            case 'month':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                return { start: monthStart, end: new Date() };
            case 'year':
                const yearStart = new Date(now.getFullYear(), 0, 1);
                return { start: yearStart, end: new Date() };
            default:
                return null; // All time
        }
    }

    // ============================================
    // Filter & Search
    // ============================================
    function handleDateFilterChange() {
        state.dateFilter = elements.filterDate.value;
        applyFilters();
    }

    function handlePaymentFilterChange() {
        state.paymentFilter = elements.filterPayment.value;
        applyFilters();
    }

    function handleStatusFilterChange() {
        state.statusFilter = elements.filterStatus.value;
        applyFilters();
    }

    function applyFilters() {
        const searchTerm = elements.searchInput?.value.toLowerCase().trim() || '';
        const dateFilter = state.dateFilter;
        const paymentFilter = state.paymentFilter;
        const statusFilter = state.statusFilter;
        const dateRange = getDateRange(dateFilter);

        state.filteredSales = state.sales.filter(sale => {
            // Date filter
            if (dateRange) {
                const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
                if (saleDate < dateRange.start || saleDate >= dateRange.end) return false;
            }

            // Payment filter
            if (paymentFilter !== 'all' && sale.paymentMethod !== paymentFilter) return false;

            // Status filter
            if (statusFilter !== 'all' && (sale.status || 'completed') !== statusFilter) return false;

            // Search filter
            if (searchTerm) {
                const searchFields = [
                    sale.receiptNumber || '',
                    sale.customer || '',
                    sale.paymentMethod || '',
                    ...(sale.items || []).map(item => item.name || '')
                ].join(' ').toLowerCase();

                if (!searchFields.includes(searchTerm)) return false;
            }

            return true;
        });

        renderSalesTable();
        updateFilteredStats();
    }

    // ============================================
    // Stats Calculation
    // ============================================
    function updateStats() {
        const allSales = state.sales;

        const totalCount = allSales.length;
        const totalRevenue = allSales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
        const totalProfit = totalRevenue * 0.2; // 20% margin estimation

        const cashSales = allSales.filter(sale => sale.paymentMethod === 'cash').length;
        const mpesaSales = allSales.filter(sale => sale.paymentMethod === 'mpesa').length;

        // Update DOM
        if (elements.totalCount) elements.totalCount.textContent = totalCount;
        if (elements.revenueAmount) elements.revenueAmount.textContent = formatCurrency(totalRevenue);
        if (elements.profitAmount) elements.profitAmount.textContent = formatCurrency(totalProfit);
        if (elements.cashCount) elements.cashCount.textContent = cashSales;
        if (elements.mpesaCount) elements.mpesaCount.textContent = mpesaSales;
    }

    function updateFilteredStats() {
        // Update stats based on filtered results
        const filtered = state.filteredSales;

        const totalCount = filtered.length;
        const totalRevenue = filtered.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
        const totalProfit = totalRevenue * 0.2;

        const cashSales = filtered.filter(sale => sale.paymentMethod === 'cash').length;
        const mpesaSales = filtered.filter(sale => sale.paymentMethod === 'mpesa').length;

        if (elements.totalCount) elements.totalCount.textContent = totalCount;
        if (elements.revenueAmount) elements.revenueAmount.textContent = formatCurrency(totalRevenue);
        if (elements.profitAmount) elements.profitAmount.textContent = formatCurrency(totalProfit);
        if (elements.cashCount) elements.cashCount.textContent = cashSales;
        if (elements.mpesaCount) elements.mpesaCount.textContent = mpesaSales;
    }

    // ============================================
    // Table Rendering
    // ============================================
    function renderSalesTable() {
        if (!elements.tableBody) return;

        if (state.filteredSales.length === 0) {
            elements.tableBody.innerHTML = '';
            showEmptyState(true);
            return;
        }

        showEmptyState(false);

        elements.tableBody.innerHTML = state.filteredSales.map(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            const formattedDate = formatDateTime(saleDate);
            const itemCount = (sale.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
            const statusClass = getStatusClass(sale.status || 'completed');
            const paymentIcon = getPaymentIcon(sale.paymentMethod);
            const isApproved = sale.status === 'approved';

            return `
                <tr data-sale-id="${sale.id}">
                    <td>
                        <span class="receipt-number">${sale.receiptNumber || 'N/A'}</span>
                    </td>
                    <td>
                        <div class="sale-date">
                            <span class="date">${formattedDate.date}</span>
                            <span class="time">${formattedDate.time}</span>
                        </div>
                    </td>
                    <td>${sale.customer || 'Walk-in'}</td>
                    <td>
                        <span class="item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td>
                        <span class="payment-badge ${sale.paymentMethod}">
                            <i class="${paymentIcon}"></i>
                            ${capitalizeFirst(sale.paymentMethod || 'cash')}
                        </span>
                    </td>
                    <td><strong>${formatCurrency(sale.grandTotal || 0)}</strong></td>
                    <td>
                        <span class="status-badge ${statusClass}">${capitalizeFirst(sale.status || 'completed')}</span>
                    </td>
                    <td>
                        <div class="sale-actions">
                            <button class="btn-view-sale" onclick="PharmaFlowAllSales.viewSale('${sale.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-approve-sale ${isApproved ? 'approved' : ''}" onclick="PharmaFlowAllSales.approveSale('${sale.id}')" title="${isApproved ? 'Already Approved' : 'Approve Sale'}" ${isApproved ? 'disabled' : ''}>
                                <i class="fas fa-check"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ============================================
    // View Sale Modal
    // ============================================
    function viewSale(saleId) {
        const sale = state.sales.find(s => s.id === saleId);
        if (!sale) return;

        state.currentSale = sale;
        const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);

        const itemsHtml = (sale.items || []).map(item => `
            <tr>
                <td>${item.name}${item.dosage ? ` (${item.dosage})` : ''}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.total || item.price * item.quantity)}</td>
            </tr>
        `).join('');

        if (elements.detailsContent) {
            elements.detailsContent.innerHTML = `
                <div class="sale-detail-header">
                    <div class="receipt-info">
                        <h4>Receipt #${sale.receiptNumber || 'N/A'}</h4>
                        <p>${formatDateTime(date).full}</p>
                    </div>
                    <span class="status-badge ${getStatusClass(sale.status)}">${capitalizeFirst(sale.status || 'Completed')}</span>
                </div>
                
                <div class="sale-detail-row">
                    <span class="label">Customer:</span>
                    <span class="value">${sale.customer || 'Walk-in Customer'}</span>
                </div>
                <div class="sale-detail-row">
                    <span class="label">Payment Method:</span>
                    <span class="value payment-badge ${sale.paymentMethod}">${capitalizeFirst(sale.paymentMethod || 'Cash')}</span>
                </div>

                <div class="sale-items-detail">
                    <h4>Items</h4>
                    <table class="items-detail-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>

                <div class="sale-totals-detail">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(sale.subtotal || 0)}</span>
                    </div>
                    <div class="total-row">
                        <span>Discount:</span>
                        <span>- ${formatCurrency(sale.discount || 0)}</span>
                    </div>
                    <div class="total-row">
                        <span>Tax (${sale.taxPercent || 0}%):</span>
                        <span>${formatCurrency(sale.taxAmount || 0)}</span>
                    </div>
                    <div class="total-row grand">
                        <span>Grand Total:</span>
                        <span>${formatCurrency(sale.grandTotal || 0)}</span>
                    </div>
                </div>
            `;
        }

        if (elements.viewModal) {
            elements.viewModal.classList.add('show');
        }
    }

    function closeViewModal() {
        if (elements.viewModal) {
            elements.viewModal.classList.remove('show');
            state.currentSale = null;
        }
    }

    function handlePrintReceipt() {
        window.print();
    }

    // ============================================
    // Approve Sale
    // ============================================
    async function approveSale(saleId) {
        const sale = state.sales.find(s => s.id === saleId);
        if (!sale) {
            alert('Sale not found.');
            return;
        }

        if (sale.status === 'approved') {
            alert('This sale is already approved.');
            return;
        }

        try {
            await updateDoc(doc(db, 'sales', saleId), {
                status: 'approved',
                approvedAt: serverTimestamp(),
                approvedBy: 'Super Admin'
            });
            // Real-time listener will update the UI automatically
        } catch (error) {
            console.error('Error approving sale:', error);
            alert('Failed to approve sale. Please try again.');
        }
    }

    // ============================================
    // Export Functionality
    // ============================================
    function handleExport() {
        if (state.filteredSales.length === 0) {
            alert('No sales data to export.');
            return;
        }

        const headers = ['Receipt #', 'Date', 'Time', 'Customer', 'Items', 'Payment', 'Total', 'Status'];
        const rows = state.filteredSales.map(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            const formatted = formatDateTime(saleDate);
            const itemCount = (sale.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
            
            return [
                sale.receiptNumber || 'N/A',
                formatted.date,
                formatted.time,
                sale.customer || 'Walk-in',
                `${itemCount} item(s)`,
                capitalizeFirst(sale.paymentMethod || 'cash'),
                sale.grandTotal || 0,
                capitalizeFirst(sale.status || 'completed')
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pharmaflow-sales-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    // ============================================
    // UI Helpers
    // ============================================
    function showLoading(show) {
        if (elements.tableLoading) {
            elements.tableLoading.style.display = show ? 'flex' : 'none';
        }
        if (elements.tableBody && show) {
            elements.tableBody.closest('.sales-table-wrapper').style.display = 'none';
        }
    }

    function showEmptyState(show) {
        if (elements.tableEmpty) {
            elements.tableEmpty.style.display = show ? 'flex' : 'none';
        }
        if (elements.tableBody) {
            elements.tableBody.closest('.sales-table-wrapper').style.display = show ? 'none' : 'block';
        }
    }

    // ============================================
    // Utility Functions
    // ============================================
    function formatCurrency(amount) {
        return `KSH ${parseFloat(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatDateTime(date) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        
        return {
            date: date.toLocaleDateString('en-KE', options),
            time: date.toLocaleTimeString('en-KE', timeOptions),
            full: date.toLocaleString('en-KE', { ...options, ...timeOptions })
        };
    }

    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function getStatusClass(status) {
        const statusMap = {
            'completed': 'status-completed',
            'approved': 'approved',
            'pending': 'status-pending',
            'cancelled': 'status-cancelled',
            'refunded': 'status-refunded'
        };
        return statusMap[status?.toLowerCase()] || 'status-completed';
    }

    function getPaymentIcon(method) {
        const iconMap = {
            'cash': 'fas fa-money-bill-wave',
            'mpesa': 'fas fa-mobile-alt',
            'card': 'fas fa-credit-card'
        };
        return iconMap[method?.toLowerCase()] || 'fas fa-money-bill-wave';
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ============================================
    // Initialize on DOM Ready
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================
    // Expose Public API
    // ============================================
    window.PharmaFlowAllSales = {
        init,
        viewSale,
        approveSale,
        refresh: applyFilters
    };

})(window, document);
