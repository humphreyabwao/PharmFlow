/**
 * PharmaFlow Sales Module
 * Real-time sales management with Firestore
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    where,
    Timestamp,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // State Management
    // ============================================
    const state = {
        sales: [],
        todaySales: [],
        filteredSales: [],
        unsubscribe: null,
        paymentFilter: 'all',
        statusFilter: 'all'
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Stat cards
            salesTodayCount: document.getElementById('salesTodayCount'),
            revenueTodayAmount: document.getElementById('revenueTodayAmount'),
            profitTodayAmount: document.getElementById('profitTodayAmount'),
            cashSalesCount: document.getElementById('cashSalesCount'),
            mpesaSalesCount: document.getElementById('mpesaSalesCount'),

            // Table
            salesTableBody: document.getElementById('salesTableBody'),
            salesTableEmpty: document.getElementById('salesTableEmpty'),
            salesTableLoading: document.getElementById('salesTableLoading'),
            salesSearchInput: document.getElementById('salesSearchInput'),
            salesFilterPayment: document.getElementById('salesFilterPayment'),
            salesFilterStatus: document.getElementById('salesFilterStatus'),

            // Add Sale Button (navigates to POS)
            btnAddSale: document.getElementById('btnAddSale'),

            // View Sale Modal
            viewSaleModal: document.getElementById('viewSaleModal'),
            closeViewSaleModal: document.getElementById('closeViewSaleModal'),
            saleDetailsContent: document.getElementById('saleDetailsContent'),
            btnPrintReceipt: document.getElementById('btnPrintReceipt'),
            btnCloseDetails: document.getElementById('btnCloseDetails')
        };
    }

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        cacheElements();
        bindEvents();
        startRealtimeListener();
        console.info('PharmaFlow Sales module initialized.');
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        // Add Sale Button - Navigate to POS
        if (elements.btnAddSale) {
            elements.btnAddSale.addEventListener('click', navigateToPOS);
        }

        // View Sale Modal
        if (elements.closeViewSaleModal) {
            elements.closeViewSaleModal.addEventListener('click', closeViewSaleModal);
        }
        if (elements.btnCloseDetails) {
            elements.btnCloseDetails.addEventListener('click', closeViewSaleModal);
        }
        if (elements.btnPrintReceipt) {
            elements.btnPrintReceipt.addEventListener('click', handlePrintReceipt);
        }

        // Filters
        if (elements.salesSearchInput) {
            elements.salesSearchInput.addEventListener('input', debounce(handleSearch, 300));
        }
        if (elements.salesFilterPayment) {
            elements.salesFilterPayment.addEventListener('change', handlePaymentFilterChange);
        }
        if (elements.salesFilterStatus) {
            elements.salesFilterStatus.addEventListener('change', handleStatusFilterChange);
        }

        // Close modals on outside click
        if (elements.viewSaleModal) {
            elements.viewSaleModal.addEventListener('click', (e) => {
                if (e.target === elements.viewSaleModal) closeViewSaleModal();
            });
        }
    }

    // ============================================
    // Navigation to POS
    // ============================================
    function navigateToPOS() {
        // Navigate to the POS module
        const posLink = document.querySelector('.submenu-link[data-module="pharmacy-pos"]');
        if (posLink) {
            posLink.click();
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

            // Filter to only today's sales
            filterTodaySales();
            applyFilters();
            updateStats();
            showLoading(false);
            console.info(`Today's sales updated: ${state.todaySales.length} records`);
        }, (error) => {
            console.error('Error listening to sales:', error);
            showLoading(false);
            showEmptyState(true);
        });
    }

    // ============================================
    // Filter Today's Sales
    // ============================================
    function filterTodaySales() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        state.todaySales = state.sales.filter(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            return saleDate >= today;
        });
    }

    // ============================================
    // Filter & Search
    // ============================================
    function handleSearch() {
        applyFilters();
    }

    function handlePaymentFilterChange() {
        state.paymentFilter = elements.salesFilterPayment.value;
        applyFilters();
    }

    function handleStatusFilterChange() {
        state.statusFilter = elements.salesFilterStatus.value;
        applyFilters();
    }

    function applyFilters() {
        const searchTerm = elements.salesSearchInput?.value.toLowerCase().trim() || '';
        const paymentFilter = state.paymentFilter;
        const statusFilter = state.statusFilter;

        // Start with today's sales only
        state.filteredSales = state.todaySales.filter(sale => {
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
    }

    // ============================================
    // Stats Calculation
    // ============================================
    function updateStats() {
        // All stats are for today only
        const todaySales = state.todaySales;

        const salesTodayCount = todaySales.length;
        const revenueToday = todaySales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
        // Profit estimation (assuming 20% profit margin for demo)
        const profitToday = revenueToday * 0.2;

        // Count by payment method
        const cashSales = todaySales.filter(sale => sale.paymentMethod === 'cash').length;
        const mpesaSales = todaySales.filter(sale => sale.paymentMethod === 'mpesa').length;

        // Update DOM
        if (elements.salesTodayCount) elements.salesTodayCount.textContent = salesTodayCount;
        if (elements.revenueTodayAmount) elements.revenueTodayAmount.textContent = formatCurrency(revenueToday);
        if (elements.profitTodayAmount) elements.profitTodayAmount.textContent = formatCurrency(profitToday);
        if (elements.cashSalesCount) elements.cashSalesCount.textContent = cashSales;
        if (elements.mpesaSalesCount) elements.mpesaSalesCount.textContent = mpesaSales;

        // Also update dashboard if elements exist
        const dashboardSalesToday = document.getElementById('salesToday');
        if (dashboardSalesToday) {
            dashboardSalesToday.textContent = formatCurrency(revenueToday);
        }
    }

    // ============================================
    // Table Rendering
    // ============================================
    function renderSalesTable() {
        if (!elements.salesTableBody) return;

        if (state.filteredSales.length === 0) {
            elements.salesTableBody.innerHTML = '';
            showEmptyState(true);
            return;
        }

        showEmptyState(false);

        elements.salesTableBody.innerHTML = state.filteredSales.map(sale => {
            const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            const formattedDate = formatDate(date);
            const itemCount = sale.items?.length || 0;
            const itemSummary = itemCount === 1 ? '1 item' : `${itemCount} items`;

            return `
                <tr data-sale-id="${sale.id}">
                    <td><span class="receipt-number">${sale.receiptNumber || 'N/A'}</span></td>
                    <td>${formattedDate}</td>
                    <td>${escapeHtml(sale.customer || 'Walk-in Customer')}</td>
                    <td><span class="items-badge">${itemSummary}</span></td>
                    <td><span class="payment-badge ${sale.paymentMethod}">${capitalizeFirst(sale.paymentMethod || 'cash')}</span></td>
                    <td><strong>${formatCurrency(sale.grandTotal || 0)}</strong></td>
                    <td><span class="status-badge ${sale.status || 'completed'}">${capitalizeFirst(sale.status || 'Completed')}</span></td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn view" onclick="PharmaFlowSales.viewSale('${sale.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn delete" onclick="PharmaFlowSales.deleteSale('${sale.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function showLoading(show) {
        if (elements.salesTableLoading) {
            elements.salesTableLoading.style.display = show ? 'flex' : 'none';
        }
        if (elements.salesTableBody && show) {
            elements.salesTableBody.innerHTML = '';
        }
    }

    function showEmptyState(show) {
        if (elements.salesTableEmpty) {
            elements.salesTableEmpty.style.display = show ? 'flex' : 'none';
        }
    }

    // ============================================
    // View Sale Modal
    // ============================================
    function viewSale(saleId) {
        const sale = state.sales.find(s => s.id === saleId);
        if (!sale) return;

        const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);

        const itemsHtml = (sale.items || []).map(item => `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.total || item.price * item.quantity)}</td>
            </tr>
        `).join('');

        if (elements.saleDetailsContent) {
            elements.saleDetailsContent.innerHTML = `
                <div class="sale-detail-header">
                    <div class="receipt-info">
                        <h4>Receipt #${sale.receiptNumber || 'N/A'}</h4>
                        <p>${formatDate(date)}</p>
                    </div>
                    <span class="status-badge ${sale.status}">${capitalizeFirst(sale.status || 'Completed')}</span>
                </div>
                
                <div class="sale-detail-row">
                    <span class="label">Customer:</span>
                    <span class="value">${escapeHtml(sale.customer || 'Walk-in Customer')}</span>
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

        if (elements.viewSaleModal) {
            elements.viewSaleModal.classList.add('show');
        }
    }

    function closeViewSaleModal() {
        if (elements.viewSaleModal) {
            elements.viewSaleModal.classList.remove('show');
        }
    }

    function handlePrintReceipt() {
        window.print();
    }

    // ============================================
    // Delete Sale
    // ============================================
    async function deleteSale(saleId) {
        if (!confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'sales', saleId));
            alert('Sale deleted successfully.');
        } catch (error) {
            console.error('Error deleting sale:', error);
            alert('Failed to delete sale. Please try again.');
        }
    }

    // ============================================
    // Integration with POS Module
    // ============================================
    async function addSaleFromPOS(saleData) {
        const sale = {
            receiptNumber: generateReceiptNumber(),
            customer: saleData.customer || 'Walk-in Customer',
            paymentMethod: saleData.paymentMethod || 'cash',
            items: saleData.items.map(item => ({
                name: item.name,
                dosage: item.dosage || '',
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity
            })),
            subtotal: saleData.subtotal,
            discount: saleData.discount,
            taxPercent: saleData.taxPercent,
            taxAmount: saleData.taxAmount,
            grandTotal: saleData.grandTotal,
            amountTendered: saleData.amountTendered || 0,
            change: saleData.change || 0,
            status: 'completed',
            createdAt: serverTimestamp()
        };

        try {
            const docRef = await addDoc(collection(db, 'sales'), sale);
            console.log('Sale added from POS:', docRef.id);
            return { success: true, id: docRef.id, receiptNumber: sale.receiptNumber };
        } catch (error) {
            console.error('Error adding sale from POS:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // Utility Functions
    // ============================================
    function generateReceiptNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `RCP-${year}${month}${day}-${random}`;
    }

    function formatCurrency(amount) {
        return `KSH ${parseFloat(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
    // Cleanup
    // ============================================
    function cleanup() {
        if (state.unsubscribe) {
            state.unsubscribe();
        }
    }

    // ============================================
    // Initialize on DOM Ready
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // ============================================
    // Expose Public API
    // ============================================
    window.PharmaFlowSales = {
        init,
        addSaleFromPOS,
        viewSale,
        deleteSale,
        navigateToPOS,
        cleanup
    };

})(window, document);
