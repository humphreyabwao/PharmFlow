// Accounts Module - Real-time Financial Reconciliation
import { db, collection, onSnapshot, query, orderBy, where, Timestamp } from './firebase-config.js';

// State
let allSales = [];
let allWholesale = [];
let allExpenses = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupRealtimeListeners();
    updateTodayDate();
});

// Helper function to format numbers
function formatNumber(num) {
    return num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Update today's date display
function updateTodayDate() {
    const dateEl = document.getElementById('accTodayDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-KE', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Setup Real-time Listeners for all modules
function setupRealtimeListeners() {
    // Listen to POS/Retail Sales
    const salesQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    onSnapshot(salesQuery, (snapshot) => {
        allSales = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            source: 'retail'
        }));
        updateAllMetrics();
    }, (error) => {
        console.error('Error listening to sales:', error);
    });

    // Listen to Wholesale Sales
    const wholesaleQuery = query(collection(db, 'wholesaleSales'), orderBy('createdAt', 'desc'));
    onSnapshot(wholesaleQuery, (snapshot) => {
        allWholesale = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            source: 'wholesale'
        }));
        updateAllMetrics();
    }, (error) => {
        console.error('Error listening to wholesale:', error);
    });

    // Listen to Expenses
    const expenseQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    onSnapshot(expenseQuery, (snapshot) => {
        allExpenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        updateAllMetrics();
    }, (error) => {
        console.error('Error listening to expenses:', error);
    });
}

// Update All Metrics
function updateAllMetrics() {
    updateRevenueCards();
    updateReconciliation();
    updateTodayTransactions();
}

// Get today's start timestamp
function getTodayStart() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

// Check if timestamp is today
function isToday(timestamp) {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = getTodayStart();
    const orderDate = new Date(date);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
}

// Update Revenue Cards
function updateRevenueCards() {
    // Filter completed sales only
    const completedRetail = allSales.filter(s => s.status !== 'cancelled' && s.status !== 'draft');
    const completedWholesale = allWholesale.filter(s => s.status === 'completed');
    const approvedExpenses = allExpenses.filter(e => e.status === 'approved');

    // Calculate totals
    const retailTotal = completedRetail.reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    const wholesaleTotal = completedWholesale.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const totalRevenue = retailTotal + wholesaleTotal;
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    // Update UI
    document.getElementById('accTotalRevenue').textContent = `Ksh ${formatNumber(totalRevenue)}`;
    document.getElementById('accRetailSales').textContent = `Ksh ${formatNumber(retailTotal)}`;
    document.getElementById('accWholesaleSales').textContent = `Ksh ${formatNumber(wholesaleTotal)}`;
    document.getElementById('accTotalExpenses').textContent = `Ksh ${formatNumber(totalExpenses)}`;
    document.getElementById('accNetProfit').textContent = `Ksh ${formatNumber(netProfit)}`;

    // Update profit trend indicator
    const profitTrend = document.getElementById('accProfitTrend');
    if (profitTrend) {
        if (netProfit >= 0) {
            profitTrend.className = 'acc-card-trend acc-trend-up';
            profitTrend.innerHTML = '<i class="fas fa-arrow-up"></i><span>Profit</span>';
        } else {
            profitTrend.className = 'acc-card-trend acc-trend-down';
            profitTrend.innerHTML = '<i class="fas fa-arrow-down"></i><span>Loss</span>';
        }
    }

    // Calculate revenue trend (comparing to expenses ratio)
    const trendPercent = totalRevenue > 0 ? Math.round(((totalRevenue - totalExpenses) / totalRevenue) * 100) : 0;
    const revenueTrendEl = document.getElementById('accRevenueTrend');
    if (revenueTrendEl) {
        revenueTrendEl.textContent = `${Math.abs(trendPercent)}%`;
    }
}

// Update Reconciliation Panel
function updateReconciliation() {
    // Combine all sales for income breakdown
    const allCompletedSales = [
        ...allSales.filter(s => s.status !== 'cancelled' && s.status !== 'draft'),
        ...allWholesale.filter(s => s.status === 'completed')
    ];

    // Income by payment method
    const cashIncome = allCompletedSales
        .filter(s => s.paymentMethod === 'cash')
        .reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    
    const mpesaIncome = allCompletedSales
        .filter(s => s.paymentMethod === 'mpesa')
        .reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    
    const bankIncome = allCompletedSales
        .filter(s => s.paymentMethod === 'bank')
        .reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    
    const creditIncome = allCompletedSales
        .filter(s => s.paymentMethod === 'credit')
        .reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);

    const totalIncome = cashIncome + mpesaIncome + bankIncome + creditIncome;

    // Update income UI
    document.getElementById('accCashIncome').textContent = `Ksh ${formatNumber(cashIncome)}`;
    document.getElementById('accMpesaIncome').textContent = `Ksh ${formatNumber(mpesaIncome)}`;
    document.getElementById('accBankIncome').textContent = `Ksh ${formatNumber(bankIncome)}`;
    document.getElementById('accCreditIncome').textContent = `Ksh ${formatNumber(creditIncome)}`;
    document.getElementById('accTotalIncome').textContent = `Ksh ${formatNumber(totalIncome)}`;

    // Expense breakdown by category
    const approvedExpenses = allExpenses.filter(e => e.status === 'approved');
    
    const inventoryExpense = approvedExpenses
        .filter(e => e.category?.toLowerCase().includes('inventory') || e.category?.toLowerCase().includes('stock'))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const utilitiesExpense = approvedExpenses
        .filter(e => e.category?.toLowerCase().includes('utilit'))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const salariesExpense = approvedExpenses
        .filter(e => e.category?.toLowerCase().includes('salar') || e.category?.toLowerCase().includes('wage'))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const otherExpense = approvedExpenses
        .filter(e => {
            const cat = e.category?.toLowerCase() || '';
            return !cat.includes('inventory') && !cat.includes('stock') && 
                   !cat.includes('utilit') && !cat.includes('salar') && !cat.includes('wage');
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalExpenses = inventoryExpense + utilitiesExpense + salariesExpense + otherExpense;

    // Update expense UI
    document.getElementById('accInventoryExpense').textContent = `Ksh ${formatNumber(inventoryExpense)}`;
    document.getElementById('accUtilitiesExpense').textContent = `Ksh ${formatNumber(utilitiesExpense)}`;
    document.getElementById('accSalariesExpense').textContent = `Ksh ${formatNumber(salariesExpense)}`;
    document.getElementById('accOtherExpense').textContent = `Ksh ${formatNumber(otherExpense)}`;
    document.getElementById('accTotalExpensesRecon').textContent = `Ksh ${formatNumber(totalExpenses)}`;

    // Update summary
    const netProfit = totalIncome - totalExpenses;
    document.getElementById('accSummaryIncome').textContent = `Ksh ${formatNumber(totalIncome)}`;
    document.getElementById('accSummaryExpense').textContent = `Ksh ${formatNumber(totalExpenses)}`;
    document.getElementById('accSummaryProfit').textContent = `Ksh ${formatNumber(Math.abs(netProfit))}`;

    // Update profit/loss indicators
    const profitLossRow = document.getElementById('accProfitLossRow');
    const profitIndicator = document.getElementById('accProfitIndicator');
    
    if (netProfit >= 0) {
        profitLossRow.className = 'acc-summary-item acc-profit-item';
        profitLossRow.querySelector('span:first-child').textContent = 'Net Profit';
        profitIndicator.className = 'acc-profit-indicator';
        profitIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Healthy Finances</span>';
    } else {
        profitLossRow.className = 'acc-summary-item acc-profit-item acc-loss';
        profitLossRow.querySelector('span:first-child').textContent = 'Net Loss';
        profitIndicator.className = 'acc-profit-indicator acc-loss-indicator';
        profitIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Attention Needed</span>';
    }
}

// Update Today's Transactions
function updateTodayTransactions() {
    // Today's retail sales
    const todayRetail = allSales.filter(s => isToday(s.createdAt) && s.status !== 'cancelled');
    const todayRetailAmount = todayRetail.reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);

    // Today's wholesale
    const todayWholesale = allWholesale.filter(s => isToday(s.createdAt) && s.status === 'completed');
    const todayWholesaleAmount = todayWholesale.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    // Today's expenses
    const todayExpenses = allExpenses.filter(e => isToday(e.createdAt) && e.status === 'approved');
    const todayExpenseAmount = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Calculate today's profit
    const todayTotalSales = todayRetailAmount + todayWholesaleAmount;
    const todayNetProfit = todayTotalSales - todayExpenseAmount;
    const profitMargin = todayTotalSales > 0 ? Math.round(((todayTotalSales - todayExpenseAmount) / todayTotalSales) * 100) : 0;

    // Update UI
    document.getElementById('accTodaySalesCount').textContent = todayRetail.length;
    document.getElementById('accTodaySalesAmount').textContent = `Ksh ${formatNumber(todayRetailAmount)}`;
    
    document.getElementById('accTodayWholesaleCount').textContent = todayWholesale.length;
    document.getElementById('accTodayWholesaleAmount').textContent = `Ksh ${formatNumber(todayWholesaleAmount)}`;
    
    document.getElementById('accTodayExpenseCount').textContent = todayExpenses.length;
    document.getElementById('accTodayExpenseAmount').textContent = `Ksh ${formatNumber(todayExpenseAmount)}`;
    
    document.getElementById('accTodayProfitPercent').textContent = `${profitMargin}%`;
    document.getElementById('accTodayNetProfit').textContent = `Ksh ${formatNumber(todayNetProfit)}`;
}

// Refresh Data
window.refreshAccountsData = function() {
    const btn = document.querySelector('.acc-refresh-btn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
        btn.disabled = true;
    }
    
    // Data refreshes automatically via listeners, just show visual feedback
    setTimeout(() => {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            btn.disabled = false;
        }
        showNotification('Data refreshed successfully!', 'success');
    }, 1000);
};

// Export Accounts Report
window.exportAccountsReport = function() {
    const completedRetail = allSales.filter(s => s.status !== 'cancelled' && s.status !== 'draft');
    const completedWholesale = allWholesale.filter(s => s.status === 'completed');
    const approvedExpenses = allExpenses.filter(e => e.status === 'approved');

    const retailTotal = completedRetail.reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
    const wholesaleTotal = completedWholesale.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const totalRevenue = retailTotal + wholesaleTotal;
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Financial Report - PharmFlow</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; padding: 40px; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #22c55e; padding-bottom: 20px; }
                .header h1 { font-size: 28px; color: #1f2937; margin-bottom: 5px; }
                .header p { color: #6b7280; font-size: 14px; }
                .date { text-align: right; font-size: 12px; color: #6b7280; margin-bottom: 30px; }
                .section { margin-bottom: 30px; }
                .section h2 { font-size: 18px; color: #1f2937; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                .card { padding: 20px; border: 1px solid #e5e7eb; }
                .card h3 { font-size: 14px; color: #6b7280; text-transform: uppercase; margin-bottom: 10px; }
                .card .value { font-size: 24px; font-weight: bold; }
                .card.green .value { color: #22c55e; }
                .card.blue .value { color: #3b82f6; }
                .card.purple .value { color: #8b5cf6; }
                .card.red .value { color: #f43f5e; }
                .summary { background: #f0fdf4; padding: 25px; margin-top: 30px; }
                .summary-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; }
                .summary-row.total { border-top: 2px solid #22c55e; padding-top: 15px; margin-top: 10px; font-size: 20px; font-weight: bold; }
                .profit { color: #22c55e; }
                .loss { color: #f43f5e; }
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>PHARMFLOW</h1>
                <p>Financial Reconciliation Report</p>
            </div>
            
            <div class="date">Generated: ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            
            <div class="section">
                <h2>Revenue Overview</h2>
                <div class="grid">
                    <div class="card green">
                        <h3>Total Revenue</h3>
                        <div class="value">Ksh ${formatNumber(totalRevenue)}</div>
                    </div>
                    <div class="card blue">
                        <h3>Retail Sales</h3>
                        <div class="value">Ksh ${formatNumber(retailTotal)}</div>
                    </div>
                    <div class="card purple">
                        <h3>Wholesale Sales</h3>
                        <div class="value">Ksh ${formatNumber(wholesaleTotal)}</div>
                    </div>
                    <div class="card red">
                        <h3>Total Expenses</h3>
                        <div class="value">Ksh ${formatNumber(totalExpenses)}</div>
                    </div>
                </div>
            </div>
            
            <div class="summary">
                <h2 style="margin-bottom: 20px;">Profit & Loss Summary</h2>
                <div class="summary-row">
                    <span>Total Income</span>
                    <span class="profit">Ksh ${formatNumber(totalRevenue)}</span>
                </div>
                <div class="summary-row">
                    <span>Total Expenses</span>
                    <span class="loss">Ksh ${formatNumber(totalExpenses)}</span>
                </div>
                <div class="summary-row total">
                    <span>${netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                    <span class="${netProfit >= 0 ? 'profit' : 'loss'}">Ksh ${formatNumber(Math.abs(netProfit))}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>PharmFlow - Pharmacy Management System</p>
                <p>This report was generated automatically. All figures are based on recorded transactions.</p>
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
