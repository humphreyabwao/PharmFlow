/**
 * PharmaFlow Dashboard Module
 * Real-time dashboard statistics from Firestore
 * With Branch-based filtering and RBAC integration
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    query,
    where,
    onSnapshot,
    orderBy,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // State Management
    // ============================================
    const state = {
        inventoryData: [],
        salesData: [],
        todaySales: [],
        customersData: [],
        wholesaleData: [],
        todayWholesale: [],
        branches: [],
        currentBranch: 'all',
        currentUser: null,
        stats: {
            salesToday: 0,
            overallSales: 0,
            expensesToday: 0,
            outOfStock: 0,
            expiringSoon: 0,
            bulkSales: 0,
            totalCustomers: 0,
            inventoryValue: 0
        }
    };

    let unsubscribeInventory = null;
    let unsubscribeSales = null;
    let unsubscribeCustomers = null;
    let unsubscribeWholesale = null;
    let unsubscribeBranches = null;

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        console.info('PharmaFlow: Initializing dashboard module...');
        
        // Initialize branch selector based on user role
        initBranchSelector();
        
        // Setup listeners
        setupBranchesListener();
        setupInventoryListener();
        setupSalesListener();
        setupCustomersListener();
        setupWholesaleListener();
    }

    // ============================================
    // Branch Selector Initialization
    // ============================================
    function initBranchSelector() {
        // Get current user from RBAC system
        const currentUser = window.PharmaFlowRBAC?.getCurrentUser() || 
                           JSON.parse(localStorage.getItem('pharmaflow_current_user') || 'null');
        
        state.currentUser = currentUser;
        
        const container = document.getElementById('branchSelectorContainer');
        if (!container) return;
        
        if (!currentUser) {
            // No user, hide selector
            container.style.display = 'none';
            return;
        }
        
        const role = currentUser.role?.toLowerCase();
        
        if (role === 'superadmin' || role === 'admin') {
            // Show branch dropdown for superadmin/admin
            container.style.display = 'flex';
            container.innerHTML = `
                <div class="branch-selector">
                    <i class="fas fa-building"></i>
                    <select id="dashboardBranchSelect" onchange="PharmaFlowDashboard.changeBranch(this.value)">
                        <option value="all">All Branches</option>
                    </select>
                </div>
            `;
            state.currentBranch = 'all';
        } else if (role === 'staff') {
            // Show fixed branch indicator for staff
            const userBranch = currentUser.branch || 'Main Branch';
            container.style.display = 'flex';
            container.innerHTML = `
                <div class="branch-indicator">
                    <i class="fas fa-building"></i>
                    <span>${escapeHtml(userBranch)}</span>
                </div>
            `;
            state.currentBranch = userBranch;
        }
    }

    // ============================================
    // Real-time Branches Listener
    // ============================================
    function setupBranchesListener() {
        try {
            const branchesRef = collection(db, 'branches');
            const branchesQuery = query(branchesRef, orderBy('name', 'asc'));

            unsubscribeBranches = onSnapshot(branchesQuery, (snapshot) => {
                state.branches = [{ id: 'main', name: 'Main Branch' }];
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.status === 'active' || !data.status) {
                        state.branches.push({
                            id: doc.id,
                            name: data.name || 'Unnamed Branch'
                        });
                    }
                });
                
                // Update dropdown if user is admin/superadmin
                updateBranchDropdown();
                
                console.info(`Dashboard: Loaded ${state.branches.length} branches`);
            }, (error) => {
                console.error('Dashboard: Error listening to branches:', error);
                // Default branch
                state.branches = [{ id: 'main', name: 'Main Branch' }];
                updateBranchDropdown();
            });
        } catch (error) {
            console.error('Dashboard: Failed to setup branches listener:', error);
        }
    }

    function updateBranchDropdown() {
        const select = document.getElementById('dashboardBranchSelect');
        if (!select) return;
        
        const currentValue = select.value || 'all';
        
        select.innerHTML = '<option value="all">All Branches</option>' +
            state.branches.map(branch => 
                `<option value="${escapeHtml(branch.name)}" ${currentValue === branch.name ? 'selected' : ''}>${escapeHtml(branch.name)}</option>`
            ).join('');
    }

    function changeBranch(branchName) {
        state.currentBranch = branchName;
        console.info(`Dashboard: Switched to branch: ${branchName}`);
        
        // Recalculate stats based on selected branch
        calculateInventoryStats();
        calculateSalesStats();
        updateDashboard();
        
        // Show notification
        showBranchNotification(branchName);
    }

    function showBranchNotification(branchName) {
        const message = branchName === 'all' 
            ? 'Viewing all branches' 
            : `Viewing ${branchName}`;
        
        // Use existing notification if available
        if (window.PharmaFlowShowNotification) {
            window.PharmaFlowShowNotification(message, 'info');
        } else {
            const notification = document.createElement('div');
            notification.className = 'branch-notification';
            notification.innerHTML = `<i class="fas fa-building"></i> ${message}`;
            notification.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                transform: translateX(120%);
                transition: transform 0.3s ease;
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.style.transform = 'translateX(0)', 100);
            setTimeout(() => {
                notification.style.transform = 'translateX(120%)';
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ============================================
    // Real-time Inventory Listener
    // ============================================
    function setupInventoryListener() {
        try {
            const inventoryRef = collection(db, 'inventory');
            const inventoryQuery = query(inventoryRef);

            unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
                state.inventoryData = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    state.inventoryData.push({
                        id: doc.id,
                        name: data.name || '',
                        quantity: parseInt(data.quantity) || 0,
                        sellingPrice: parseFloat(data.sellingPrice) || 0,
                        costPrice: parseFloat(data.costPrice) || 0,
                        expiryDate: data.expiryDate || null,
                        category: data.category || '',
                        branch: data.branch || 'Main Branch'
                    });
                });
                
                calculateInventoryStats();
                updateDashboard();
                
                console.info(`Dashboard: Loaded ${state.inventoryData.length} inventory items`);
            }, (error) => {
                console.error('Dashboard: Error listening to inventory:', error);
            });
        } catch (error) {
            console.error('Dashboard: Failed to setup inventory listener:', error);
        }
    }

    // ============================================
    // Real-time Sales Listener
    // ============================================
    function setupSalesListener() {
        try {
            const salesRef = collection(db, 'sales');
            const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));

            unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
                state.salesData = [];
                state.todaySales = [];
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayTimestamp = Timestamp.fromDate(today);

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const saleData = {
                        id: doc.id,
                        timestamp: data.createdAt || data.timestamp,
                        total: parseFloat(data.grandTotal) || parseFloat(data.total) || 0,
                        subtotal: parseFloat(data.subtotal) || 0,
                        paymentMethod: data.paymentMethod || 'cash',
                        items: data.items || [],
                        customer: data.customer || '',
                        branch: data.branch || 'Main Branch'
                    };
                    
                    state.salesData.push(saleData);
                    
                    // Check if sale is from today
                    const saleTimestamp = data.createdAt || data.timestamp;
                    if (saleTimestamp && saleTimestamp.seconds >= todayTimestamp.seconds) {
                        state.todaySales.push(saleData);
                    }
                });
                
                calculateSalesStats();
                updateDashboard();
                
                console.info(`Dashboard: Loaded ${state.salesData.length} sales (${state.todaySales.length} today)`);
            }, (error) => {
                console.error('Dashboard: Error listening to sales:', error);
            });
        } catch (error) {
            console.error('Dashboard: Failed to setup sales listener:', error);
        }
    }

    // ============================================
    // Real-time Customers Listener
    // ============================================
    function setupCustomersListener() {
        try {
            const customersRef = collection(db, 'customers');
            const customersQuery = query(customersRef);

            unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
                state.customersData = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    state.customersData.push({
                        id: doc.id,
                        branch: data.branch || 'Main Branch',
                        ...data
                    });
                });
                
                // Update total customers count (will be filtered in calculateSalesStats)
                calculateSalesStats();
                updateDashboard();
                
                console.info(`Dashboard: Loaded ${state.customersData.length} customers`);
            }, (error) => {
                console.error('Dashboard: Error listening to customers:', error);
            });
        } catch (error) {
            console.error('Dashboard: Failed to setup customers listener:', error);
        }
    }

    // ============================================
    // Real-time Wholesale/Bulk Sales Listener
    // ============================================
    function setupWholesaleListener() {
        try {
            const wholesaleRef = collection(db, 'wholesaleSales');
            const wholesaleQuery = query(wholesaleRef, orderBy('createdAt', 'desc'));

            unsubscribeWholesale = onSnapshot(wholesaleQuery, (snapshot) => {
                state.wholesaleData = [];
                state.todayWholesale = [];
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayTimestamp = Timestamp.fromDate(today);

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const wholesaleOrder = {
                        id: doc.id,
                        timestamp: data.createdAt || data.timestamp,
                        total: parseFloat(data.grandTotal) || parseFloat(data.total) || 0,
                        status: data.status || 'pending',
                        customer: data.customerName || data.customer || '',
                        items: data.items || [],
                        branch: data.branch || 'Main Branch'
                    };
                    
                    state.wholesaleData.push(wholesaleOrder);
                    
                    // Check if wholesale sale is from today and completed
                    const orderTimestamp = data.createdAt || data.timestamp;
                    if (orderTimestamp && orderTimestamp.seconds >= todayTimestamp.seconds) {
                        // Only count completed/delivered orders
                        if (data.status === 'completed' || data.status === 'delivered' || !data.status) {
                            state.todayWholesale.push(wholesaleOrder);
                        }
                    }
                });
                
                // Calculate bulk/wholesale sales for today (will be recalculated with branch filter)
                calculateSalesStats();
                updateDashboard();
                
                console.info(`Dashboard: Loaded ${state.wholesaleData.length} wholesale orders (${state.todayWholesale.length} today)`);
            }, (error) => {
                console.error('Dashboard: Error listening to wholesale:', error);
            });
        } catch (error) {
            console.error('Dashboard: Failed to setup wholesale listener:', error);
        }
    }

    // ============================================
    // Filter Data by Branch
    // ============================================
    function filterByBranch(data) {
        if (state.currentBranch === 'all') {
            return data;
        }
        return data.filter(item => {
            const itemBranch = item.branch || 'Main Branch';
            return itemBranch === state.currentBranch;
        });
    }

    // ============================================
    // Calculate Inventory Statistics
    // ============================================
    function calculateInventoryStats() {
        const filteredInventory = filterByBranch(state.inventoryData);
        
        // Out of stock items
        state.stats.outOfStock = filteredInventory.filter(item => item.quantity === 0).length;

        // Items expiring soon (within 30 days)
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        state.stats.expiringSoon = filteredInventory.filter(item => {
            if (!item.expiryDate) return false;
            const expiryDate = new Date(item.expiryDate);
            return expiryDate > today && expiryDate <= thirtyDaysFromNow;
        }).length;

        // Total inventory value (cost price * quantity)
        state.stats.inventoryValue = filteredInventory.reduce((sum, item) => {
            return sum + (item.sellingPrice * item.quantity);
        }, 0);
    }

    // ============================================
    // Calculate Sales Statistics
    // ============================================
    function calculateSalesStats() {
        const filteredTodaySales = filterByBranch(state.todaySales);
        const filteredAllSales = filterByBranch(state.salesData);
        const filteredTodayWholesale = filterByBranch(state.todayWholesale);
        const filteredCustomers = filterByBranch(state.customersData);
        
        // Today's sales total
        state.stats.salesToday = filteredTodaySales.reduce((sum, sale) => sum + sale.total, 0);

        // Overall sales total
        state.stats.overallSales = filteredAllSales.reduce((sum, sale) => sum + sale.total, 0);

        // Bulk/Wholesale sales for today
        state.stats.bulkSales = filteredTodayWholesale.reduce((sum, order) => sum + order.total, 0);
        
        // Total customers (filtered by branch)
        state.stats.totalCustomers = filteredCustomers.length;

        // Expenses today (placeholder - would need expenses collection)
        state.stats.expensesToday = 0;
    }

    // ============================================
    // Update Dashboard Display
    // ============================================
    function updateDashboard() {
        if (window.PharmaFlow && window.PharmaFlow.dashboard && window.PharmaFlow.dashboard.stats) {
            window.PharmaFlow.dashboard.stats.updateAll(state.stats);
        }
    }

    // ============================================
    // Cleanup listeners
    // ============================================
    function cleanup() {
        if (unsubscribeInventory) {
            unsubscribeInventory();
            unsubscribeInventory = null;
        }
        if (unsubscribeSales) {
            unsubscribeSales();
            unsubscribeSales = null;
        }
        if (unsubscribeCustomers) {
            unsubscribeCustomers();
            unsubscribeCustomers = null;
        }
        if (unsubscribeWholesale) {
            unsubscribeWholesale();
            unsubscribeWholesale = null;
        }
        if (unsubscribeBranches) {
            unsubscribeBranches();
            unsubscribeBranches = null;
        }
    }

    // ============================================
    // Public API
    // ============================================
    const api = {
        init,
        cleanup,
        getStats: () => ({ ...state.stats }),
        getCustomersCount: () => filterByBranch(state.customersData).length,
        getWholesaleTodayTotal: () => state.stats.bulkSales,
        getCurrentBranch: () => state.currentBranch,
        getBranches: () => [...state.branches],
        changeBranch,
        refresh: () => {
            initBranchSelector();
            calculateInventoryStats();
            calculateSalesStats();
            updateDashboard();
        }
    };

    window.PharmaFlowDashboard = api;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

})(window, document);
