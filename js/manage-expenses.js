// Manage Expenses Module - Real-time Firestore Integration
import { db, collection, doc, updateDoc, deleteDoc, getDoc, query, orderBy, onSnapshot, Timestamp } from './firebase-config.js';

// State
let allExpenses = [];
let filteredExpenses = [];
let currentPage = 1;
const itemsPerPage = 10;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initManageExpenses();
});

function initManageExpenses() {
    // Setup real-time listener
    setupRealtimeListener();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Manage Expenses module initialized');
}

function setupRealtimeListener() {
    const expensesRef = collection(db, 'expenses');
    const q = query(expensesRef, orderBy('createdAt', 'desc'));
    
    onSnapshot(q, (snapshot) => {
        allExpenses = [];
        snapshot.forEach((doc) => {
            allExpenses.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Expenses updated:', allExpenses.length);
        
        // Apply filters and render
        applyFilters();
        updateStats();
    }, (error) => {
        console.error('Error fetching expenses:', error);
        showTableError();
    });
}

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('meSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            currentPage = 1;
            applyFilters();
        }, 300));
    }
    
    // Category filter
    const categoryFilter = document.getElementById('meCategoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
    }
    
    // Payment filter
    const paymentFilter = document.getElementById('mePaymentFilter');
    if (paymentFilter) {
        paymentFilter.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('meStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
    }
    
    // Date filter
    const dateFilter = document.getElementById('meDateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
    }
    
    // Pagination buttons
    const prevBtn = document.getElementById('mePrevBtn');
    const nextBtn = document.getElementById('meNextBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('meSearchInput')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('meCategoryFilter')?.value || '';
    const paymentFilter = document.getElementById('mePaymentFilter')?.value || '';
    const statusFilter = document.getElementById('meStatusFilter')?.value || '';
    const dateFilter = document.getElementById('meDateFilter')?.value || '';
    
    filteredExpenses = allExpenses.filter(expense => {
        // Search filter
        const matchesSearch = !searchTerm || 
            expense.description?.toLowerCase().includes(searchTerm) ||
            expense.category?.toLowerCase().includes(searchTerm) ||
            expense.notes?.toLowerCase().includes(searchTerm);
        
        // Category filter
        const matchesCategory = !categoryFilter || expense.category === categoryFilter;
        
        // Payment filter
        const matchesPayment = !paymentFilter || expense.paymentMethod === paymentFilter;
        
        // Status filter
        const matchesStatus = !statusFilter || expense.status === statusFilter;
        
        // Date filter
        const matchesDate = !dateFilter || expense.date === dateFilter;
        
        return matchesSearch && matchesCategory && matchesPayment && matchesStatus && matchesDate;
    });
    
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('meTableBody');
    if (!tbody) return;
    
    if (filteredExpenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="me-empty">
                    <i class="fas fa-inbox"></i> No expenses found
                </td>
            </tr>
        `;
        updatePagination(0, 0, 0);
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredExpenses.length);
    const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);
    
    // Render rows
    tbody.innerHTML = paginatedExpenses.map(expense => {
        const status = expense.status || 'pending';
        const showApproveBtn = status === 'pending';
        const showCancelBtn = status === 'pending';
        
        return `
        <tr>
            <td>${formatDate(expense.date)}</td>
            <td><span class="me-category-badge ${expense.category}">${expense.category || 'N/A'}</span></td>
            <td>${expense.description || '-'}</td>
            <td><span class="me-payment-badge">${formatPaymentMethod(expense.paymentMethod)}</span></td>
            <td class="me-amount">Ksh ${formatNumber(expense.amount)}</td>
            <td><span class="me-status-badge ${status}">${formatStatus(status)}</span></td>
            <td>
                <div class="me-actions">
                    ${showApproveBtn ? `<button class="me-action-btn approve" onclick="approveExpense('${expense.id}')" title="Approve">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                    ${showCancelBtn ? `<button class="me-action-btn cancel" onclick="cancelExpense('${expense.id}')" title="Cancel">
                        <i class="fas fa-ban"></i>
                    </button>` : ''}
                    <button class="me-action-btn" onclick="viewExpense('${expense.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="me-action-btn" onclick="editExpense('${expense.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="me-action-btn delete" onclick="deleteExpense('${expense.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    
    updatePagination(startIndex + 1, endIndex, filteredExpenses.length);
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Total expenses
    const totalAmount = allExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    document.getElementById('meTotalExpenses').textContent = `Ksh ${formatNumber(totalAmount)}`;
    
    // Today's expenses
    const todayAmount = allExpenses
        .filter(exp => exp.date === today)
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    document.getElementById('meTodayExpenses').textContent = `Ksh ${formatNumber(todayAmount)}`;
    
    // Expense count
    document.getElementById('meExpenseCount').textContent = allExpenses.length;
    
    // This month's expenses
    const monthAmount = allExpenses
        .filter(exp => exp.date?.startsWith(currentMonth))
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    document.getElementById('meMonthExpenses').textContent = `Ksh ${formatNumber(monthAmount)}`;
}

function updatePagination(start, end, total) {
    document.getElementById('meShowingStart').textContent = start;
    document.getElementById('meShowingEnd').textContent = end;
    document.getElementById('meTotalRecords').textContent = total;
    document.getElementById('meCurrentPage').textContent = currentPage;
    
    const totalPages = Math.ceil(total / itemsPerPage);
    document.getElementById('mePrevBtn').disabled = currentPage <= 1;
    document.getElementById('meNextBtn').disabled = currentPage >= totalPages;
}

function showTableError() {
    const tbody = document.getElementById('meTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="me-empty" style="color: #ef4444;">
                    <i class="fas fa-exclamation-circle"></i> Error loading expenses
                </td>
            </tr>
        `;
    }
}

// View Expense
window.viewExpense = async function(id) {
    const expense = allExpenses.find(exp => exp.id === id);
    if (!expense) return;
    
    const status = expense.status || 'pending';
    const content = document.getElementById('meViewContent');
    content.innerHTML = `
        <div class="me-view-item">
            <span class="me-view-label">Category</span>
            <span class="me-view-value"><span class="me-category-badge ${expense.category}">${expense.category}</span></span>
        </div>
        <div class="me-view-item">
            <span class="me-view-label">Amount</span>
            <span class="me-view-value me-amount">Ksh ${formatNumber(expense.amount)}</span>
        </div>
        <div class="me-view-item">
            <span class="me-view-label">Date</span>
            <span class="me-view-value">${formatDate(expense.date)}</span>
        </div>
        <div class="me-view-item">
            <span class="me-view-label">Payment Method</span>
            <span class="me-view-value">${formatPaymentMethod(expense.paymentMethod)}</span>
        </div>
        <div class="me-view-item">
            <span class="me-view-label">Status</span>
            <span class="me-view-value"><span class="me-status-badge ${status}">${formatStatus(status)}</span></span>
        </div>
        <div class="me-view-item full-width">
            <span class="me-view-label">Description</span>
            <span class="me-view-value">${expense.description || '-'}</span>
        </div>
        <div class="me-view-item full-width">
            <span class="me-view-label">Notes</span>
            <span class="me-view-value">${expense.notes || '-'}</span>
        </div>
        <div class="me-view-item">
            <span class="me-view-label">Created</span>
            <span class="me-view-value">${formatTimestamp(expense.createdAt)}</span>
        </div>
        <div class="me-view-item">
            <span class="me-view-label">Last Updated</span>
            <span class="me-view-value">${formatTimestamp(expense.updatedAt)}</span>
        </div>
    `;
    
    document.getElementById('meViewModal').classList.add('active');
};

window.closeViewExpenseModal = function() {
    document.getElementById('meViewModal').classList.remove('active');
};

// Edit Expense
window.editExpense = async function(id) {
    const expense = allExpenses.find(exp => exp.id === id);
    if (!expense) return;
    
    document.getElementById('meEditId').value = id;
    document.getElementById('meEditCategory').value = expense.category || '';
    document.getElementById('meEditAmount').value = expense.amount || '';
    document.getElementById('meEditDate').value = expense.date || '';
    document.getElementById('meEditPayment').value = expense.paymentMethod || 'cash';
    document.getElementById('meEditDescription').value = expense.description || '';
    document.getElementById('meEditNotes').value = expense.notes || '';
    
    document.getElementById('meEditModal').classList.add('active');
};

window.closeEditExpenseModal = function() {
    document.getElementById('meEditModal').classList.remove('active');
};

window.saveEditedExpense = async function() {
    const id = document.getElementById('meEditId').value;
    if (!id) return;
    
    const category = document.getElementById('meEditCategory').value;
    const amount = parseFloat(document.getElementById('meEditAmount').value);
    const date = document.getElementById('meEditDate').value;
    const paymentMethod = document.getElementById('meEditPayment').value;
    const description = document.getElementById('meEditDescription').value;
    const notes = document.getElementById('meEditNotes').value;
    
    if (!category || !amount || !date || !description) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        const expenseRef = doc(db, 'expenses', id);
        await updateDoc(expenseRef, {
            category,
            amount,
            date,
            paymentMethod,
            description,
            notes,
            updatedAt: Timestamp.now()
        });
        
        showNotification('Expense updated successfully!', 'success');
        closeEditExpenseModal();
    } catch (error) {
        console.error('Error updating expense:', error);
        showNotification('Error updating expense', 'error');
    }
};

// Delete Expense
window.deleteExpense = async function(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
        await deleteDoc(doc(db, 'expenses', id));
        showNotification('Expense deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting expense:', error);
        showNotification('Error deleting expense', 'error');
    }
};

// Approve Expense
window.approveExpense = async function(id) {
    try {
        const expenseRef = doc(db, 'expenses', id);
        await updateDoc(expenseRef, {
            status: 'approved',
            approvedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        showNotification('Expense approved successfully!', 'success');
    } catch (error) {
        console.error('Error approving expense:', error);
        showNotification('Error approving expense', 'error');
    }
};

// Cancel Expense
window.cancelExpense = async function(id) {
    if (!confirm('Are you sure you want to cancel this expense?')) return;
    
    try {
        const expenseRef = doc(db, 'expenses', id);
        await updateDoc(expenseRef, {
            status: 'cancelled',
            cancelledAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        showNotification('Expense cancelled!', 'success');
    } catch (error) {
        console.error('Error cancelling expense:', error);
        showNotification('Error cancelling expense', 'error');
    }
};

// Helper functions
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatNumber(num) {
    if (!num && num !== 0) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPaymentMethod(method) {
    const methods = {
        'cash': 'Cash',
        'mpesa': 'M-Pesa',
        'bank': 'Bank Transfer',
        'cheque': 'Cheque'
    };
    return methods[method] || method || 'N/A';
}

function formatStatus(status) {
    const statuses = {
        'pending': 'Pending',
        'approved': 'Approved',
        'cancelled': 'Cancelled'
    };
    return statuses[status] || 'Pending';
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

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.me-notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `me-notification me-notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        backgroundColor: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '10000',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        animation: 'slideIn 0.3s ease'
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Export Expenses as PDF
window.exportExpensesPDF = function() {
    if (filteredExpenses.length === 0) {
        showNotification('No expenses to export', 'error');
        return;
    }
    
    // Calculate totals
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const approvedAmount = filteredExpenses.filter(e => e.status === 'approved').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const pendingAmount = filteredExpenses.filter(e => e.status === 'pending' || !e.status).reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    // Create print window
    const printWindow = window.open('', '_blank');
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Expenses Report - PharmFlow</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Courier New', monospace;
                    padding: 20px;
                    font-size: 12px;
                    color: #000;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 15px;
                }
                .header h1 {
                    font-size: 24px;
                    margin-bottom: 5px;
                }
                .header p {
                    font-size: 12px;
                    color: #666;
                }
                .report-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    font-size: 11px;
                }
                .summary {
                    display: flex;
                    gap: 30px;
                    margin-bottom: 20px;
                    padding: 15px;
                    background: #f5f5f5;
                }
                .summary-item {
                    text-align: center;
                }
                .summary-item .label {
                    font-size: 10px;
                    color: #666;
                    text-transform: uppercase;
                }
                .summary-item .value {
                    font-size: 16px;
                    font-weight: bold;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 8px;
                    text-align: left;
                    font-size: 11px;
                }
                th {
                    background: #000;
                    color: #fff;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .amount {
                    text-align: right;
                    font-weight: bold;
                }
                .status {
                    text-transform: uppercase;
                    font-weight: bold;
                    font-size: 10px;
                }
                .status.approved { color: #10b981; }
                .status.pending { color: #f59e0b; }
                .status.cancelled { color: #ef4444; }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 10px;
                    color: #666;
                    border-top: 1px solid #ccc;
                    padding-top: 15px;
                }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>PHARMFLOW</h1>
                <p>Pharmacy Management System</p>
                <h2 style="margin-top: 10px;">EXPENSES REPORT</h2>
            </div>
            
            <div class="report-info">
                <div>Generated: ${new Date().toLocaleString('en-GB')}</div>
                <div>Total Records: ${filteredExpenses.length}</div>
            </div>
            
            <div class="summary">
                <div class="summary-item">
                    <div class="label">Total Expenses</div>
                    <div class="value">Ksh ${formatNumber(totalAmount)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Approved</div>
                    <div class="value" style="color: #10b981;">Ksh ${formatNumber(approvedAmount)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Pending</div>
                    <div class="value" style="color: #f59e0b;">Ksh ${formatNumber(pendingAmount)}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredExpenses.map((expense, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${formatDate(expense.date)}</td>
                            <td>${expense.category || 'N/A'}</td>
                            <td>${expense.description || '-'}</td>
                            <td>${formatPaymentMethod(expense.paymentMethod)}</td>
                            <td class="status ${expense.status || 'pending'}">${formatStatus(expense.status || 'pending')}</td>
                            <td class="amount">Ksh ${formatNumber(expense.amount)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="6" style="text-align: right; font-weight: bold;">TOTAL:</td>
                        <td class="amount">Ksh ${formatNumber(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div class="footer">
                <p>PharmFlow Pharmacy Management System</p>
                <p>This is a computer-generated report</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    showNotification('PDF export ready for printing', 'success');
};

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
