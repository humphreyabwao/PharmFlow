// Manage Wholesale Module
import { db, collection, doc, updateDoc, deleteDoc, getDocs, query, orderBy, onSnapshot, Timestamp, where } from './firebase-config.js';

// State
let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
const ordersPerPage = 10;
let currentViewOrder = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupRealtimeListener();
    setupFilterListeners();
});

// Helper function to format numbers
function formatNumber(num) {
    return num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper function to format date
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Helper function to format short date
function formatShortDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Notification helper
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Setup Real-time Listener
function setupRealtimeListener() {
    const q = query(collection(db, 'wholesaleSales'), orderBy('createdAt', 'desc'));
    
    onSnapshot(q, (snapshot) => {
        allOrders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        applyFilters();
        updateStats();
    }, (error) => {
        console.error('Error listening to wholesale orders:', error);
    });
}

// Update Stats
function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalOrders = allOrders.length;
    const totalRevenue = allOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    
    const todaySales = allOrders
        .filter(o => {
            if (!o.createdAt) return false;
            const orderDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            return orderDate.getTime() === today.getTime() && o.status === 'completed';
        })
        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    
    const pendingOrders = allOrders.filter(o => o.status === 'draft').length;
    
    document.getElementById('mwTotalOrders').textContent = totalOrders;
    document.getElementById('mwTotalRevenue').textContent = `Ksh ${formatNumber(totalRevenue)}`;
    document.getElementById('mwTodaySales').textContent = `Ksh ${formatNumber(todaySales)}`;
    document.getElementById('mwPendingOrders').textContent = pendingOrders;
}

// Setup Filter Listeners
function setupFilterListeners() {
    const searchInput = document.getElementById('mwSearchInput');
    const statusFilter = document.getElementById('mwStatusFilter');
    const paymentFilter = document.getElementById('mwPaymentFilter');
    const dateFrom = document.getElementById('mwDateFrom');
    const dateTo = document.getElementById('mwDateTo');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => applyFilters(), 300));
    }
    
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (paymentFilter) paymentFilter.addEventListener('change', applyFilters);
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
}

// Debounce helper
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

// Apply Filters
function applyFilters() {
    const searchTerm = document.getElementById('mwSearchInput')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('mwStatusFilter')?.value || '';
    const paymentFilter = document.getElementById('mwPaymentFilter')?.value || '';
    const dateFrom = document.getElementById('mwDateFrom')?.value;
    const dateTo = document.getElementById('mwDateTo')?.value;
    
    filteredOrders = allOrders.filter(order => {
        // Search filter
        if (searchTerm) {
            const customerName = order.customer?.name?.toLowerCase() || '';
            const orderId = order.id.toLowerCase();
            if (!customerName.includes(searchTerm) && !orderId.includes(searchTerm)) {
                return false;
            }
        }
        
        // Status filter
        if (statusFilter && order.status !== statusFilter) {
            return false;
        }
        
        // Payment filter
        if (paymentFilter && order.paymentMethod !== paymentFilter) {
            return false;
        }
        
        // Date range filter
        if (dateFrom || dateTo) {
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (orderDate < fromDate) return false;
            }
            
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                if (orderDate > toDate) return false;
            }
        }
        
        return true;
    });
    
    currentPage = 1;
    renderTable();
    updatePagination();
}

// Render Table
function renderTable() {
    const tbody = document.getElementById('mwTableBody');
    if (!tbody) return;
    
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const pageOrders = filteredOrders.slice(startIndex, endIndex);
    
    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr class="mw-empty-row">
                <td colspan="8">
                    <div class="mw-empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No wholesale orders found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = pageOrders.map(order => {
        const customerName = order.customer?.name || 'Walk-in Customer';
        const customerPhone = order.customer?.phone || '';
        const itemsCount = order.items?.length || 0;
        const paymentClass = `mw-payment-${order.paymentMethod || 'cash'}`;
        const statusClass = `mw-status-${order.status || 'completed'}`;
        
        return `
            <tr>
                <td><span class="mw-order-id">#${order.id.slice(-6).toUpperCase()}</span></td>
                <td>${formatShortDate(order.createdAt)}</td>
                <td>
                    <div class="mw-customer-name">${customerName}</div>
                    ${customerPhone ? `<div class="mw-customer-phone">${customerPhone}</div>` : ''}
                </td>
                <td><span class="mw-items-count">${itemsCount} items</span></td>
                <td><span class="mw-total">Ksh ${formatNumber(order.grandTotal || 0)}</span></td>
                <td><span class="mw-payment-badge ${paymentClass}">${order.paymentMethod || 'Cash'}</span></td>
                <td><span class="mw-status-badge ${statusClass}">${order.status || 'Completed'}</span></td>
                <td>
                    <div class="mw-actions">
                        <button class="mw-action-icon mw-view" onclick="viewWholesaleOrder('${order.id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="mw-action-icon mw-edit" onclick="editWholesaleOrder('${order.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="mw-action-icon mw-print" onclick="printWholesaleOrderById('${order.id}')" title="Print">
                            <i class="fas fa-print"></i>
                        </button>
                        ${order.status !== 'cancelled' ? `
                            <button class="mw-action-icon mw-cancel" onclick="cancelWholesaleOrder('${order.id}')" title="Cancel">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Update Pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage + 1;
    const endIndex = Math.min(currentPage * ordersPerPage, filteredOrders.length);
    
    const pageInfo = document.getElementById('mwPageInfo');
    const prevBtn = document.getElementById('mwPrevBtn');
    const nextBtn = document.getElementById('mwNextBtn');
    
    if (pageInfo) {
        if (filteredOrders.length === 0) {
            pageInfo.textContent = 'Showing 0 of 0 orders';
        } else {
            pageInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredOrders.length} orders`;
        }
    }
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// Pagination controls
window.prevWholesalePage = function() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
    }
};

window.nextWholesalePage = function() {
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
    }
};

// Reset Filters
window.resetWholesaleFilters = function() {
    document.getElementById('mwSearchInput').value = '';
    document.getElementById('mwStatusFilter').value = '';
    document.getElementById('mwPaymentFilter').value = '';
    document.getElementById('mwDateFrom').value = '';
    document.getElementById('mwDateTo').value = '';
    applyFilters();
};

// View Order
window.viewWholesaleOrder = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    currentViewOrder = order;
    
    const content = document.getElementById('mwViewContent');
    if (!content) return;
    
    const customerName = order.customer?.name || 'Walk-in Customer';
    const customerPhone = order.customer?.phone || '-';
    const customerBusiness = order.customer?.business || '-';
    
    content.innerHTML = `
        <div class="mw-order-details">
            <div class="mw-detail-section">
                <h4>Order Information</h4>
                <div class="mw-detail-grid">
                    <div class="mw-detail-item">
                        <label>Order ID</label>
                        <span>#${order.id.slice(-6).toUpperCase()}</span>
                    </div>
                    <div class="mw-detail-item">
                        <label>Date</label>
                        <span>${formatDate(order.createdAt)}</span>
                    </div>
                    <div class="mw-detail-item">
                        <label>Status</label>
                        <span class="mw-status-badge mw-status-${order.status || 'completed'}">${order.status || 'Completed'}</span>
                    </div>
                    <div class="mw-detail-item">
                        <label>Payment Method</label>
                        <span>${order.paymentMethod || 'Cash'}</span>
                    </div>
                </div>
            </div>
            
            <div class="mw-detail-section">
                <h4>Customer Information</h4>
                <div class="mw-detail-grid">
                    <div class="mw-detail-item">
                        <label>Name</label>
                        <span>${customerName}</span>
                    </div>
                    <div class="mw-detail-item">
                        <label>Phone</label>
                        <span>${customerPhone}</span>
                    </div>
                    <div class="mw-detail-item">
                        <label>Business</label>
                        <span>${customerBusiness}</span>
                    </div>
                </div>
            </div>
            
            <div class="mw-detail-section">
                <h4>Items</h4>
                <table class="mw-items-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Price</th>
                            <th>Qty</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items?.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>Ksh ${formatNumber(item.price)}</td>
                                <td>${item.quantity}</td>
                                <td>Ksh ${formatNumber(item.total || item.price * item.quantity)}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4">No items</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <div class="mw-detail-section">
                <h4>Summary</h4>
                <div class="mw-summary-row">
                    <span>Subtotal</span>
                    <span>Ksh ${formatNumber(order.subtotal || 0)}</span>
                </div>
                <div class="mw-summary-row">
                    <span>Discount</span>
                    <span>- Ksh ${formatNumber(order.discountAmount || 0)}</span>
                </div>
                <div class="mw-summary-row">
                    <span>Tax (${order.taxPercent || 0}%)</span>
                    <span>+ Ksh ${formatNumber(order.taxAmount || 0)}</span>
                </div>
                <div class="mw-summary-row mw-total-row">
                    <span>Grand Total</span>
                    <span>Ksh ${formatNumber(order.grandTotal || 0)}</span>
                </div>
            </div>
            
            ${order.notes ? `
                <div class="mw-detail-section">
                    <h4>Notes</h4>
                    <p style="font-size: 13px; color: var(--text-secondary);">${order.notes}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('mwViewModal').classList.add('active');
};

// Close View Modal
window.closeWholesaleViewModal = function() {
    document.getElementById('mwViewModal').classList.remove('active');
    currentViewOrder = null;
};

// Cancel Order
window.cancelWholesaleOrder = async function(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
        await updateDoc(doc(db, 'wholesaleSales', orderId), {
            status: 'cancelled',
            cancelledAt: Timestamp.now()
        });
        showNotification('Order cancelled successfully', 'success');
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification('Error cancelling order', 'error');
    }
};

// Print Order
window.printWholesaleOrder = function() {
    if (!currentViewOrder) return;
    printOrderReceipt(currentViewOrder);
};

window.printWholesaleOrderById = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (order) printOrderReceipt(order);
};

function printOrderReceipt(order) {
    const customerName = order.customer?.name || 'Walk-in Customer';
    const customerPhone = order.customer?.phone || '';
    
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Wholesale Order #${order.id.slice(-6).toUpperCase()}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
                .header h1 { font-size: 20px; margin-bottom: 5px; }
                .header p { font-size: 12px; }
                .info { margin-bottom: 15px; font-size: 12px; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 10px; }
                .item { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
                .item-name { flex: 2; }
                .item-qty { flex: 0.5; text-align: center; }
                .item-price { flex: 1; text-align: right; }
                .totals { font-size: 12px; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .grand-total { font-size: 16px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
                .footer { text-align: center; margin-top: 20px; font-size: 11px; border-top: 1px dashed #000; padding-top: 15px; }
                @media print { body { padding: 10px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>PHARMFLOW</h1>
                <p>Wholesale Order Receipt</p>
            </div>
            
            <div class="info">
                <div class="info-row">
                    <span>Order #:</span>
                    <span>${order.id.slice(-6).toUpperCase()}</span>
                </div>
                <div class="info-row">
                    <span>Date:</span>
                    <span>${formatDate(order.createdAt)}</span>
                </div>
                <div class="info-row">
                    <span>Customer:</span>
                    <span>${customerName}</span>
                </div>
                ${customerPhone ? `
                    <div class="info-row">
                        <span>Phone:</span>
                        <span>${customerPhone}</span>
                    </div>
                ` : ''}
                <div class="info-row">
                    <span>Payment:</span>
                    <span>${order.paymentMethod || 'Cash'}</span>
                </div>
            </div>
            
            <div class="items">
                <div class="item" style="font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px;">
                    <span class="item-name">Item</span>
                    <span class="item-qty">Qty</span>
                    <span class="item-price">Total</span>
                </div>
                ${order.items?.map(item => `
                    <div class="item">
                        <span class="item-name">${item.name}</span>
                        <span class="item-qty">${item.quantity}</span>
                        <span class="item-price">Ksh ${formatNumber(item.total || item.price * item.quantity)}</span>
                    </div>
                `).join('') || ''}
            </div>
            
            <div class="totals">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>Ksh ${formatNumber(order.subtotal || 0)}</span>
                </div>
                <div class="total-row">
                    <span>Discount:</span>
                    <span>- Ksh ${formatNumber(order.discountAmount || 0)}</span>
                </div>
                <div class="total-row">
                    <span>Tax (${order.taxPercent || 0}%):</span>
                    <span>+ Ksh ${formatNumber(order.taxAmount || 0)}</span>
                </div>
                <div class="total-row grand-total">
                    <span>GRAND TOTAL:</span>
                    <span>Ksh ${formatNumber(order.grandTotal || 0)}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>PharmFlow - Your Trusted Pharmacy Partner</p>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// Export PDF
window.exportWholesalePDF = function() {
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Wholesale Orders Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; padding: 30px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { font-size: 24px; margin-bottom: 5px; }
                .header p { font-size: 12px; color: #666; }
                .stats { display: flex; justify-content: space-around; margin-bottom: 30px; padding: 15px; background: #f5f5f5; }
                .stat { text-align: center; }
                .stat-value { font-size: 20px; font-weight: bold; color: #22c55e; }
                .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background: #f5f5f5; font-weight: 600; text-transform: uppercase; font-size: 10px; }
                .status-completed { color: #16a34a; }
                .status-draft { color: #d97706; }
                .status-cancelled { color: #dc2626; }
                .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; }
                @media print { body { padding: 15px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>PHARMFLOW</h1>
                <p>Wholesale Orders Report - Generated on ${new Date().toLocaleDateString('en-KE')}</p>
            </div>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${allOrders.length}</div>
                    <div class="stat-label">Total Orders</div>
                </div>
                <div class="stat">
                    <div class="stat-value">Ksh ${formatNumber(allOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.grandTotal || 0), 0))}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${allOrders.filter(o => o.status === 'completed').length}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${allOrders.filter(o => o.status === 'draft').length}</div>
                    <div class="stat-label">Drafts</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredOrders.map(order => `
                        <tr>
                            <td>#${order.id.slice(-6).toUpperCase()}</td>
                            <td>${formatShortDate(order.createdAt)}</td>
                            <td>${order.customer?.name || 'Walk-in'}</td>
                            <td>${order.items?.length || 0}</td>
                            <td>Ksh ${formatNumber(order.grandTotal || 0)}</td>
                            <td>${order.paymentMethod || 'Cash'}</td>
                            <td class="status-${order.status || 'completed'}">${order.status || 'Completed'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="footer">
                <p>PharmFlow - Pharmacy Management System</p>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
};

// ========== EDIT ORDER FUNCTIONALITY ==========
let currentEditOrder = null;
let editItems = [];

// Edit Order
window.editWholesaleOrder = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    currentEditOrder = order;
    editItems = order.items ? [...order.items] : [];
    
    // Populate form fields
    document.getElementById('mwEditOrderId').value = `#${order.id.slice(-6).toUpperCase()}`;
    document.getElementById('mwEditStatus').value = order.status || 'completed';
    document.getElementById('mwEditPayment').value = order.paymentMethod || 'cash';
    document.getElementById('mwEditCustomer').value = order.customer?.name || '';
    document.getElementById('mwEditDiscount').value = order.discountAmount || 0;
    document.getElementById('mwEditTax').value = order.taxPercent || 0;
    document.getElementById('mwEditNotes').value = order.notes || '';
    
    renderEditItems();
    recalculateEditTotals();
    
    document.getElementById('mwEditModal').classList.add('active');
};

// Close Edit Modal
window.closeWholesaleEditModal = function() {
    document.getElementById('mwEditModal').classList.remove('active');
    currentEditOrder = null;
    editItems = [];
};

// Render Edit Items
function renderEditItems() {
    const tbody = document.getElementById('mwEditItemsBody');
    if (!tbody) return;
    
    if (editItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    No items. Click "Add Item" to add products.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = editItems.map((item, index) => `
        <tr>
            <td>
                <input type="text" class="mw-item-name-input" value="${item.name}" 
                       onchange="updateEditItem(${index}, 'name', this.value)">
            </td>
            <td>
                <input type="number" class="mw-item-price-input" value="${item.price}" 
                       min="0" step="0.01" onchange="updateEditItem(${index}, 'price', this.value)">
            </td>
            <td>
                <input type="number" class="mw-item-qty-input" value="${item.quantity}" 
                       min="1" onchange="updateEditItem(${index}, 'quantity', this.value)">
            </td>
            <td class="mw-item-total">Ksh ${formatNumber(item.price * item.quantity)}</td>
            <td>
                <button class="mw-remove-item-btn" onclick="removeEditItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Update Edit Item
window.updateEditItem = function(index, field, value) {
    if (field === 'price' || field === 'quantity') {
        value = parseFloat(value) || 0;
    }
    editItems[index][field] = value;
    editItems[index].total = editItems[index].price * editItems[index].quantity;
    renderEditItems();
    recalculateEditTotals();
};

// Remove Edit Item
window.removeEditItem = function(index) {
    editItems.splice(index, 1);
    renderEditItems();
    recalculateEditTotals();
};

// Add Edit Order Item
window.addEditOrderItem = function() {
    editItems.push({
        name: 'New Product',
        price: 0,
        quantity: 1,
        total: 0,
        isManual: true
    });
    renderEditItems();
    recalculateEditTotals();
};

// Recalculate Edit Totals
window.recalculateEditTotals = function() {
    const subtotal = editItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = parseFloat(document.getElementById('mwEditDiscount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('mwEditTax').value) || 0;
    
    const afterDiscount = subtotal - discount;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const grandTotal = afterDiscount + taxAmount;
    
    document.getElementById('mwEditSubtotal').textContent = `Ksh ${formatNumber(subtotal)}`;
    document.getElementById('mwEditGrandTotal').textContent = `Ksh ${formatNumber(grandTotal)}`;
};

// Save Wholesale Order Edit
window.saveWholesaleOrderEdit = async function() {
    if (!currentEditOrder) return;
    
    const subtotal = editItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = parseFloat(document.getElementById('mwEditDiscount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('mwEditTax').value) || 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const grandTotal = afterDiscount + taxAmount;
    
    const updatedData = {
        status: document.getElementById('mwEditStatus').value,
        paymentMethod: document.getElementById('mwEditPayment').value,
        customer: {
            ...currentEditOrder.customer,
            name: document.getElementById('mwEditCustomer').value || 'Walk-in Customer'
        },
        items: editItems.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            isManual: item.isManual || false
        })),
        subtotal: subtotal,
        discountAmount: discountAmount,
        taxPercent: taxPercent,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
        notes: document.getElementById('mwEditNotes').value,
        updatedAt: Timestamp.now()
    };
    
    try {
        await updateDoc(doc(db, 'wholesaleSales', currentEditOrder.id), updatedData);
        showNotification('Order updated successfully!', 'success');
        closeWholesaleEditModal();
    } catch (error) {
        console.error('Error updating order:', error);
        showNotification('Error updating order', 'error');
    }
};
