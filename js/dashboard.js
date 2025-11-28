/**
 * PharmaFlow Dashboard Module
 * Real-time dashboard statistics from Firestore
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

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        console.info('PharmaFlow: Initializing dashboard module...');
        setupInventoryListener();
        setupSalesListener();
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
                        category: data.category || ''
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
                        customer: data.customer || ''
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
    // Calculate Inventory Statistics
    // ============================================
    function calculateInventoryStats() {
        // Out of stock items
        state.stats.outOfStock = state.inventoryData.filter(item => item.quantity === 0).length;

        // Items expiring soon (within 30 days)
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        state.stats.expiringSoon = state.inventoryData.filter(item => {
            if (!item.expiryDate) return false;
            const expiryDate = new Date(item.expiryDate);
            return expiryDate > today && expiryDate <= thirtyDaysFromNow;
        }).length;

        // Total inventory value (cost price * quantity)
        state.stats.inventoryValue = state.inventoryData.reduce((sum, item) => {
            return sum + (item.sellingPrice * item.quantity);
        }, 0);
    }

    // ============================================
    // Calculate Sales Statistics
    // ============================================
    function calculateSalesStats() {
        // Today's sales total
        state.stats.salesToday = state.todaySales.reduce((sum, sale) => sum + sale.total, 0);

        // Overall sales total
        state.stats.overallSales = state.salesData.reduce((sum, sale) => sum + sale.total, 0);

        // Bulk sales today (sales with multiple items or high quantity)
        state.stats.bulkSales = state.todaySales.reduce((sum, sale) => {
            const isBulk = sale.items && sale.items.length > 5 || 
                          sale.items && sale.items.some(item => item.quantity >= 10);
            return isBulk ? sum + sale.total : sum;
        }, 0);

        // Total unique customers (count unique customer names)
        const uniqueCustomers = new Set();
        state.salesData.forEach(sale => {
            if (sale.customer && sale.customer.trim() !== '') {
                uniqueCustomers.add(sale.customer.toLowerCase());
            }
        });
        state.stats.totalCustomers = uniqueCustomers.size;

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
    }

    // ============================================
    // Public API
    // ============================================
    const api = {
        init,
        cleanup,
        getStats: () => ({ ...state.stats }),
        refresh: () => {
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
