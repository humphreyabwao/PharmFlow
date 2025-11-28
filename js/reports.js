// Generate Report Module - Real-time Analytics and Report Generation
import { db, collection, onSnapshot, query, orderBy, where, Timestamp } from './firebase-config.js';

// State
let allSales = [];
let allWholesale = [];
let allExpenses = [];
let allInventory = [];
let allCustomers = [];
let allSuppliers = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupRealtimeListeners();
    setupEventListeners();
});

// Format currency
function formatCurrency(num) {
    return `Ksh ${parseFloat(num || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Setup Event Listeners
function setupEventListeners() {
    // Date range change
    const dateRange = document.getElementById('rptDateRange');
    if (dateRange) {
        dateRange.addEventListener('change', (e) => {
            const customDates = document.getElementById('rptCustomDates');
            if (customDates) {
                customDates.style.display = e.target.value === 'custom' ? 'grid' : 'none';
            }
        });
    }
}

// Setup Real-time Listeners
function setupRealtimeListeners() {
    // Sales
    const salesQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    onSnapshot(salesQuery, (snapshot) => {
        allSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateAnalytics();
    });

    // Wholesale
    const wholesaleQuery = query(collection(db, 'wholesaleSales'), orderBy('createdAt', 'desc'));
    onSnapshot(wholesaleQuery, (snapshot) => {
        allWholesale = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateAnalytics();
    });

    // Expenses
    const expenseQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    onSnapshot(expenseQuery, (snapshot) => {
        allExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateAnalytics();
    });

    // Inventory
    const inventoryQuery = query(collection(db, 'inventory'));
    onSnapshot(inventoryQuery, (snapshot) => {
        allInventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateAnalytics();
    });

    // Customers
    const customerQuery = query(collection(db, 'customers'));
    onSnapshot(customerQuery, (snapshot) => {
        allCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateAnalytics();
    });

    // Suppliers
    const supplierQuery = query(collection(db, 'suppliers'));
    onSnapshot(supplierQuery, (snapshot) => {
        allSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateAnalytics();
    });
}

// Update Analytics Cards
function updateAnalytics() {
    // Total Revenue (completed sales + completed wholesale)
    const salesRevenue = allSales
        .filter(s => s.status !== 'cancelled')
        .reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    const wholesaleRevenue = allWholesale
        .filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const totalRevenue = salesRevenue + wholesaleRevenue;

    // Total Sales Count
    const totalSalesCount = allSales.filter(s => s.status !== 'cancelled').length + 
                           allWholesale.filter(s => s.status === 'completed').length;

    // Total Expenses
    const totalExpenses = allExpenses
        .filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Update UI
    const el = (id) => document.getElementById(id);
    if (el('rptTotalRevenue')) el('rptTotalRevenue').textContent = formatCurrency(totalRevenue);
    if (el('rptTotalSales')) el('rptTotalSales').textContent = totalSalesCount.toLocaleString();
    if (el('rptTotalInventory')) el('rptTotalInventory').textContent = allInventory.length.toLocaleString();
    if (el('rptTotalCustomers')) el('rptTotalCustomers').textContent = allCustomers.length.toLocaleString();
    if (el('rptTotalSuppliers')) el('rptTotalSuppliers').textContent = allSuppliers.length.toLocaleString();
    if (el('rptTotalExpenses')) el('rptTotalExpenses').textContent = formatCurrency(totalExpenses);
}

// Get Date Range
function getDateRange() {
    const range = document.getElementById('rptDateRange')?.value || 'month';
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (range) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'yesterday':
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'week':
            const dayOfWeek = startDate.getDay();
            startDate.setDate(startDate.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'custom':
            const customStart = document.getElementById('rptStartDate')?.value;
            const customEnd = document.getElementById('rptEndDate')?.value;
            if (customStart) startDate = new Date(customStart);
            if (customEnd) {
                endDate = new Date(customEnd);
                endDate.setHours(23, 59, 59, 999);
            }
            break;
        case 'all':
            startDate = new Date(2000, 0, 1);
            break;
    }

    return { startDate, endDate };
}

// Filter data by date range
function filterByDateRange(data, dateField = 'createdAt') {
    const { startDate, endDate } = getDateRange();
    return data.filter(item => {
        if (!item[dateField]) return false;
        const itemDate = item[dateField].toDate ? item[dateField].toDate() : new Date(item[dateField]);
        return itemDate >= startDate && itemDate <= endDate;
    });
}

// Get selected report type
function getSelectedReportType() {
    const selected = document.querySelector('input[name="reportType"]:checked');
    return selected ? selected.value : 'sales';
}

// Preview Report
window.previewReport = function() {
    const reportType = getSelectedReportType();
    const previewSection = document.getElementById('rptPreviewSection');
    const previewContainer = document.getElementById('rptPreviewContainer');

    if (!previewSection || !previewContainer) return;

    let reportHTML = '';

    switch (reportType) {
        case 'sales':
            reportHTML = generateSalesReport();
            break;
        case 'inventory':
            reportHTML = generateInventoryReport();
            break;
        case 'wholesale':
            reportHTML = generateWholesaleReport();
            break;
        case 'expenses':
            reportHTML = generateExpenseReport();
            break;
        case 'customers':
            reportHTML = generateCustomerReport();
            break;
        case 'suppliers':
            reportHTML = generateSupplierReport();
            break;
        case 'profit':
            reportHTML = generateProfitLossReport();
            break;
        case 'comprehensive':
            reportHTML = generateComprehensiveReport();
            break;
    }

    previewContainer.innerHTML = reportHTML;
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth' });
};

// Close Report Preview
window.closeReportPreview = function() {
    const previewSection = document.getElementById('rptPreviewSection');
    if (previewSection) {
        previewSection.style.display = 'none';
    }
};

// Generate Report (Print)
window.generateReport = function() {
    previewReport();
    setTimeout(() => {
        printReportPreview();
    }, 300);
};

// Print Report Preview
window.printReportPreview = function() {
    const previewContainer = document.getElementById('rptPreviewContainer');
    if (!previewContainer) return;

    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>PharmFlow Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1f2937; }
                .report-document { max-width: 100%; }
                .report-header { text-align: center; padding-bottom: 20px; border-bottom: 3px solid #22c55e; margin-bottom: 25px; }
                .report-header h1 { font-size: 26px; margin-bottom: 5px; color: #1f2937; }
                .report-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 10px; }
                .report-meta { display: flex; justify-content: center; gap: 30px; font-size: 12px; color: #6b7280; }
                .report-section { margin-bottom: 25px; page-break-inside: avoid; }
                .report-section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; margin-bottom: 15px; }
                .report-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
                .report-summary-item { padding: 15px; text-align: center; }
                .report-summary-item.green { background-color: #dcfce7; border-left: 4px solid #22c55e; }
                .report-summary-item.blue { background-color: #dbeafe; border-left: 4px solid #3b82f6; }
                .report-summary-item.purple { background-color: #f3e8ff; border-left: 4px solid #8b5cf6; }
                .report-summary-item.amber { background-color: #fef3c7; border-left: 4px solid #f59e0b; }
                .report-summary-item.rose { background-color: #ffe4e6; border-left: 4px solid #f43f5e; }
                .report-summary-item.cyan { background-color: #cffafe; border-left: 4px solid #06b6d4; }
                .report-summary-value { font-size: 22px; font-weight: 700; display: block; }
                .report-summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
                .report-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                .report-table th { background-color: #f3f4f6; font-weight: 600; text-align: left; padding: 10px 8px; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; }
                .report-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
                .report-table tr:nth-child(even) { background-color: #f9fafb; }
                .report-footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
                .text-green { color: #22c55e; }
                .text-rose { color: #f43f5e; }
                .text-blue { color: #3b82f6; }
                @media print { 
                    body { padding: 15px; }
                    .report-summary-grid { grid-template-columns: repeat(3, 1fr); }
                }
            </style>
        </head>
        <body>
            ${previewContainer.innerHTML}
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

// Generate Sales Report
function generateSalesReport() {
    const filteredSales = filterByDateRange(allSales);
    const statusFilter = document.getElementById('rptStatusFilter')?.value || 'all';
    const paymentFilter = document.getElementById('rptPaymentFilter')?.value || 'all';

    let sales = filteredSales;
    if (statusFilter !== 'all') sales = sales.filter(s => s.status === statusFilter);
    if (paymentFilter !== 'all') sales = sales.filter(s => s.paymentMethod === paymentFilter);

    const totalRevenue = sales.reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    const completedSales = sales.filter(s => s.status !== 'cancelled');
    const avgSale = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;

    const cashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    const mpesaSales = sales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);

    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Sales Report</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>Period: ${document.getElementById('rptDateRange')?.selectedOptions[0]?.text || 'This Month'}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Sales Summary</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${formatCurrency(totalRevenue)}</span>
                        <span class="report-summary-label">Total Revenue</span>
                    </div>
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${completedSales.length}</span>
                        <span class="report-summary-label">Total Sales</span>
                    </div>
                    <div class="report-summary-item purple">
                        <span class="report-summary-value">${formatCurrency(avgSale)}</span>
                        <span class="report-summary-label">Average Sale</span>
                    </div>
                </div>
                <div class="report-summary-grid">
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${formatCurrency(cashSales)}</span>
                        <span class="report-summary-label">Cash Sales</span>
                    </div>
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${formatCurrency(mpesaSales)}</span>
                        <span class="report-summary-label">M-Pesa Sales</span>
                    </div>
                    <div class="report-summary-item amber">
                        <span class="report-summary-value">${formatCurrency(totalRevenue - cashSales - mpesaSales)}</span>
                        <span class="report-summary-label">Other Methods</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Sales Details (Top 20)</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Receipt #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Payment</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sales.slice(0, 20).map(sale => `
                            <tr>
                                <td>${sale.receiptNumber || sale.id.slice(0, 8)}</td>
                                <td>${formatDate(sale.createdAt)}</td>
                                <td>${sale.customer || 'Walk-in'}</td>
                                <td>${sale.items?.length || 0}</td>
                                <td>${(sale.paymentMethod || 'cash').toUpperCase()}</td>
                                <td class="text-green">${formatCurrency(sale.grandTotal || sale.total || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
                <p>This is an automatically generated report. All figures are based on recorded transactions.</p>
            </div>
        </div>
    `;
}

// Generate Inventory Report
function generateInventoryReport() {
    const totalItems = allInventory.length;
    const totalValue = allInventory.reduce((sum, i) => sum + ((i.quantity || 0) * (i.costPrice || i.price || 0)), 0);
    const lowStock = allInventory.filter(i => (i.quantity || 0) <= (i.reorderLevel || 10));
    const outOfStock = allInventory.filter(i => (i.quantity || 0) === 0);

    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Inventory Report</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Inventory Summary</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${totalItems}</span>
                        <span class="report-summary-label">Total Products</span>
                    </div>
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${formatCurrency(totalValue)}</span>
                        <span class="report-summary-label">Total Stock Value</span>
                    </div>
                    <div class="report-summary-item amber">
                        <span class="report-summary-value">${lowStock.length}</span>
                        <span class="report-summary-label">Low Stock Items</span>
                    </div>
                </div>
                <div class="report-summary-grid">
                    <div class="report-summary-item rose">
                        <span class="report-summary-value">${outOfStock.length}</span>
                        <span class="report-summary-label">Out of Stock</span>
                    </div>
                    <div class="report-summary-item purple">
                        <span class="report-summary-value">${allInventory.reduce((sum, i) => sum + (i.quantity || 0), 0)}</span>
                        <span class="report-summary-label">Total Units</span>
                    </div>
                    <div class="report-summary-item cyan">
                        <span class="report-summary-value">${new Set(allInventory.map(i => i.category)).size}</span>
                        <span class="report-summary-label">Categories</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Low Stock Alert</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Category</th>
                            <th>Current Stock</th>
                            <th>Reorder Level</th>
                            <th>Unit Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lowStock.slice(0, 15).map(item => `
                            <tr>
                                <td>${item.name || 'N/A'}</td>
                                <td>${item.category || 'General'}</td>
                                <td class="text-rose">${item.quantity || 0}</td>
                                <td>${item.reorderLevel || 10}</td>
                                <td>${formatCurrency(item.price || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
            </div>
        </div>
    `;
}

// Generate Wholesale Report
function generateWholesaleReport() {
    const filteredWholesale = filterByDateRange(allWholesale);
    const statusFilter = document.getElementById('rptStatusFilter')?.value || 'all';
    
    let orders = filteredWholesale;
    if (statusFilter !== 'all') orders = orders.filter(o => o.status === statusFilter);

    const completed = orders.filter(o => o.status === 'completed');
    const totalRevenue = completed.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const avgOrder = completed.length > 0 ? totalRevenue / completed.length : 0;

    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Wholesale Sales Report</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>Period: ${document.getElementById('rptDateRange')?.selectedOptions[0]?.text || 'This Month'}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Wholesale Summary</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${formatCurrency(totalRevenue)}</span>
                        <span class="report-summary-label">Total Revenue</span>
                    </div>
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${completed.length}</span>
                        <span class="report-summary-label">Completed Orders</span>
                    </div>
                    <div class="report-summary-item purple">
                        <span class="report-summary-value">${formatCurrency(avgOrder)}</span>
                        <span class="report-summary-label">Average Order</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Wholesale Orders (Top 20)</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Status</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.slice(0, 20).map(order => `
                            <tr>
                                <td>${order.orderNumber || order.id.slice(0, 8)}</td>
                                <td>${formatDate(order.createdAt)}</td>
                                <td>${order.customerName || 'N/A'}</td>
                                <td>${order.items?.length || 0}</td>
                                <td>${(order.status || 'pending').toUpperCase()}</td>
                                <td class="text-green">${formatCurrency(order.grandTotal || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
            </div>
        </div>
    `;
}

// Generate Expense Report
function generateExpenseReport() {
    const filteredExpenses = filterByDateRange(allExpenses);
    const statusFilter = document.getElementById('rptStatusFilter')?.value || 'all';
    
    let expenses = filteredExpenses;
    if (statusFilter !== 'all') expenses = expenses.filter(e => e.status === statusFilter);

    const approved = expenses.filter(e => e.status === 'approved');
    const totalExpenses = approved.reduce((sum, e) => sum + (e.amount || 0), 0);
    const pending = expenses.filter(e => e.status === 'pending');
    const pendingAmount = pending.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Group by category
    const byCategory = {};
    approved.forEach(e => {
        const cat = e.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
    });

    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Expense Report</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>Period: ${document.getElementById('rptDateRange')?.selectedOptions[0]?.text || 'This Month'}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Expense Summary</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item rose">
                        <span class="report-summary-value">${formatCurrency(totalExpenses)}</span>
                        <span class="report-summary-label">Total Approved</span>
                    </div>
                    <div class="report-summary-item amber">
                        <span class="report-summary-value">${formatCurrency(pendingAmount)}</span>
                        <span class="report-summary-label">Pending Approval</span>
                    </div>
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${approved.length}</span>
                        <span class="report-summary-label">Total Entries</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Expenses by Category</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => `
                            <tr>
                                <td>${cat}</td>
                                <td class="text-rose">${formatCurrency(amount)}</td>
                                <td>${totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-section">
                <div class="report-section-title">Recent Expenses</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenses.slice(0, 15).map(exp => `
                            <tr>
                                <td>${formatDate(exp.createdAt)}</td>
                                <td>${exp.description || 'N/A'}</td>
                                <td>${exp.category || 'Other'}</td>
                                <td>${(exp.status || 'pending').toUpperCase()}</td>
                                <td class="text-rose">${formatCurrency(exp.amount || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
            </div>
        </div>
    `;
}

// Generate Customer Report
function generateCustomerReport() {
    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Customer Report</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Customer Summary</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${allCustomers.length}</span>
                        <span class="report-summary-label">Total Customers</span>
                    </div>
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${allCustomers.filter(c => c.type === 'wholesale').length}</span>
                        <span class="report-summary-label">Wholesale</span>
                    </div>
                    <div class="report-summary-item purple">
                        <span class="report-summary-value">${allCustomers.filter(c => c.type === 'retail' || !c.type).length}</span>
                        <span class="report-summary-label">Retail</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Customer List</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Email</th>
                            <th>Type</th>
                            <th>Added</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allCustomers.slice(0, 20).map(cust => `
                            <tr>
                                <td>${cust.name || 'N/A'}</td>
                                <td>${cust.phone || 'N/A'}</td>
                                <td>${cust.email || 'N/A'}</td>
                                <td>${(cust.type || 'retail').toUpperCase()}</td>
                                <td>${formatDate(cust.createdAt)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
            </div>
        </div>
    `;
}

// Generate Supplier Report
function generateSupplierReport() {
    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Supplier Report</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Supplier Summary</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item cyan">
                        <span class="report-summary-value">${allSuppliers.length}</span>
                        <span class="report-summary-label">Total Suppliers</span>
                    </div>
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${allSuppliers.filter(s => s.status === 'active').length}</span>
                        <span class="report-summary-label">Active</span>
                    </div>
                    <div class="report-summary-item amber">
                        <span class="report-summary-value">${allSuppliers.filter(s => s.status !== 'active').length}</span>
                        <span class="report-summary-label">Inactive</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Supplier List</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Contact</th>
                            <th>Phone</th>
                            <th>Email</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allSuppliers.slice(0, 20).map(sup => `
                            <tr>
                                <td>${sup.company || sup.name || 'N/A'}</td>
                                <td>${sup.contactPerson || 'N/A'}</td>
                                <td>${sup.phone || 'N/A'}</td>
                                <td>${sup.email || 'N/A'}</td>
                                <td>${(sup.status || 'active').toUpperCase()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
            </div>
        </div>
    `;
}

// Generate Profit & Loss Report
function generateProfitLossReport() {
    const filteredSales = filterByDateRange(allSales);
    const filteredWholesale = filterByDateRange(allWholesale);
    const filteredExpenses = filterByDateRange(allExpenses);

    const salesRevenue = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    const wholesaleRevenue = filteredWholesale.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const totalRevenue = salesRevenue + wholesaleRevenue;

    const totalExpenses = filteredExpenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Profit & Loss Statement</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>Period: ${document.getElementById('rptDateRange')?.selectedOptions[0]?.text || 'This Month'}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Revenue</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${formatCurrency(salesRevenue)}</span>
                        <span class="report-summary-label">Retail Sales</span>
                    </div>
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${formatCurrency(wholesaleRevenue)}</span>
                        <span class="report-summary-label">Wholesale Sales</span>
                    </div>
                    <div class="report-summary-item purple">
                        <span class="report-summary-value">${formatCurrency(totalRevenue)}</span>
                        <span class="report-summary-label">Total Revenue</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Expenses</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item rose">
                        <span class="report-summary-value">${formatCurrency(totalExpenses)}</span>
                        <span class="report-summary-label">Total Expenses</span>
                    </div>
                    <div class="report-summary-item amber">
                        <span class="report-summary-value">${filteredExpenses.filter(e => e.status === 'approved').length}</span>
                        <span class="report-summary-label">Expense Entries</span>
                    </div>
                    <div class="report-summary-item cyan">
                        <span class="report-summary-value">${formatCurrency(totalExpenses / (filteredExpenses.filter(e => e.status === 'approved').length || 1))}</span>
                        <span class="report-summary-label">Avg per Entry</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Net Position</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item ${netProfit >= 0 ? 'green' : 'rose'}">
                        <span class="report-summary-value">${formatCurrency(Math.abs(netProfit))}</span>
                        <span class="report-summary-label">${netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                    </div>
                    <div class="report-summary-item ${netProfit >= 0 ? 'green' : 'rose'}">
                        <span class="report-summary-value">${profitMargin}%</span>
                        <span class="report-summary-label">Profit Margin</span>
                    </div>
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%</span>
                        <span class="report-summary-label">Expense Ratio</span>
                    </div>
                </div>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
                <p style="margin-top: 10px; font-weight: 600; color: ${netProfit >= 0 ? '#22c55e' : '#f43f5e'};">
                    ${netProfit >= 0 ? '✓ Profitable Period' : '⚠ Loss Period - Review Expenses'}
                </p>
            </div>
        </div>
    `;
}

// Generate Comprehensive Report
function generateComprehensiveReport() {
    const filteredSales = filterByDateRange(allSales);
    const filteredWholesale = filterByDateRange(allWholesale);
    const filteredExpenses = filterByDateRange(allExpenses);

    const salesRevenue = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    const wholesaleRevenue = filteredWholesale.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const totalRevenue = salesRevenue + wholesaleRevenue;
    const totalExpenses = filteredExpenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const lowStock = allInventory.filter(i => (i.quantity || 0) <= (i.reorderLevel || 10));
    const inventoryValue = allInventory.reduce((sum, i) => sum + ((i.quantity || 0) * (i.costPrice || i.price || 0)), 0);

    return `
        <div class="report-document">
            <div class="report-header">
                <h1>PHARMFLOW</h1>
                <p class="report-subtitle">Comprehensive Business Report</p>
                <div class="report-meta">
                    <span>Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>Period: ${document.getElementById('rptDateRange')?.selectedOptions[0]?.text || 'This Month'}</span>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Financial Overview</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${formatCurrency(totalRevenue)}</span>
                        <span class="report-summary-label">Total Revenue</span>
                    </div>
                    <div class="report-summary-item rose">
                        <span class="report-summary-value">${formatCurrency(totalExpenses)}</span>
                        <span class="report-summary-label">Total Expenses</span>
                    </div>
                    <div class="report-summary-item ${netProfit >= 0 ? 'green' : 'rose'}">
                        <span class="report-summary-value">${formatCurrency(Math.abs(netProfit))}</span>
                        <span class="report-summary-label">${netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Sales Breakdown</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${formatCurrency(salesRevenue)}</span>
                        <span class="report-summary-label">Retail Sales</span>
                    </div>
                    <div class="report-summary-item purple">
                        <span class="report-summary-value">${formatCurrency(wholesaleRevenue)}</span>
                        <span class="report-summary-label">Wholesale Sales</span>
                    </div>
                    <div class="report-summary-item amber">
                        <span class="report-summary-value">${filteredSales.filter(s => s.status !== 'cancelled').length + filteredWholesale.filter(s => s.status === 'completed').length}</span>
                        <span class="report-summary-label">Total Transactions</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Inventory Status</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${allInventory.length}</span>
                        <span class="report-summary-label">Total Products</span>
                    </div>
                    <div class="report-summary-item green">
                        <span class="report-summary-value">${formatCurrency(inventoryValue)}</span>
                        <span class="report-summary-label">Stock Value</span>
                    </div>
                    <div class="report-summary-item amber">
                        <span class="report-summary-value">${lowStock.length}</span>
                        <span class="report-summary-label">Low Stock Items</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">Business Entities</div>
                <div class="report-summary-grid">
                    <div class="report-summary-item cyan">
                        <span class="report-summary-value">${allCustomers.length}</span>
                        <span class="report-summary-label">Customers</span>
                    </div>
                    <div class="report-summary-item purple">
                        <span class="report-summary-value">${allSuppliers.length}</span>
                        <span class="report-summary-label">Suppliers</span>
                    </div>
                    <div class="report-summary-item blue">
                        <span class="report-summary-value">${new Set(allInventory.map(i => i.category)).size}</span>
                        <span class="report-summary-label">Categories</span>
                    </div>
                </div>
            </div>

            <div class="report-footer">
                <p>PharmFlow - Pharmacy Management System</p>
                <p>Comprehensive Business Report - All Modules Included</p>
            </div>
        </div>
    `;
}

// Quick Reports
window.generateQuickReport = function(type) {
    // Set appropriate filters based on quick report type
    const dateRange = document.getElementById('rptDateRange');
    const reportTypes = document.querySelectorAll('input[name="reportType"]');

    switch (type) {
        case 'daily-sales':
            if (dateRange) dateRange.value = 'today';
            reportTypes.forEach(r => r.checked = r.value === 'sales');
            break;
        case 'weekly-sales':
            if (dateRange) dateRange.value = 'week';
            reportTypes.forEach(r => r.checked = r.value === 'sales');
            break;
        case 'monthly-summary':
            if (dateRange) dateRange.value = 'month';
            reportTypes.forEach(r => r.checked = r.value === 'comprehensive');
            break;
        case 'low-stock':
            reportTypes.forEach(r => r.checked = r.value === 'inventory');
            break;
        case 'expiring-items':
            reportTypes.forEach(r => r.checked = r.value === 'inventory');
            break;
        case 'profit-loss':
            if (dateRange) dateRange.value = 'month';
            reportTypes.forEach(r => r.checked = r.value === 'profit');
            break;
    }

    generateReport();
};

// Refresh Report Data
window.refreshReportData = function() {
    const btn = document.querySelector('.rpt-btn-refresh');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
        btn.disabled = true;
    }

    setTimeout(() => {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
            btn.disabled = false;
        }
        showNotification('Data refreshed successfully!', 'success');
    }, 1000);
};

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
