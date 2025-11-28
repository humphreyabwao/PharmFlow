/**
 * PharmaFlow - Real-time Notifications & Activities System
 * Global notification and activity tracking from Firestore
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    Timestamp,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // State Management
    // ============================================
    const state = {
        notifications: [],
        activities: [],
        unreadCount: 0,
        listeners: {
            notifications: null,
            activities: null,
            sales: null,
            inventory: null,
            orders: null,
            expenses: null,
            customers: null
        }
    };

    // ============================================
    // Notification Types & Icons
    // ============================================
    const NOTIFICATION_TYPES = {
        sale: { icon: 'fa-cash-register', color: 'success', label: 'Sale' },
        inventory: { icon: 'fa-boxes', color: 'primary', label: 'Inventory' },
        order: { icon: 'fa-shopping-cart', color: 'info', label: 'Order' },
        expense: { icon: 'fa-money-bill-wave', color: 'danger', label: 'Expense' },
        customer: { icon: 'fa-user-plus', color: 'purple', label: 'Customer' },
        lowStock: { icon: 'fa-exclamation-triangle', color: 'warning', label: 'Low Stock' },
        expiring: { icon: 'fa-calendar-times', color: 'danger', label: 'Expiring' },
        wholesale: { icon: 'fa-warehouse', color: 'info', label: 'Wholesale' },
        system: { icon: 'fa-cog', color: 'secondary', label: 'System' },
        prescription: { icon: 'fa-prescription', color: 'primary', label: 'Prescription' }
    };

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        console.info('PharmaFlow: Initializing notifications & activities module...');
        setupNotificationsListener();
        setupActivitiesListener();
        setupModuleListeners();
        bindUIEvents();
    }

    // ============================================
    // Real-time Notifications Listener
    // ============================================
    function setupNotificationsListener() {
        try {
            const notificationsRef = collection(db, 'notifications');
            const notificationsQuery = query(
                notificationsRef,
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            state.listeners.notifications = onSnapshot(notificationsQuery, (snapshot) => {
                state.notifications = [];
                state.unreadCount = 0;

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const notification = {
                        id: docSnap.id,
                        type: data.type || 'system',
                        title: data.title || '',
                        message: data.message || '',
                        read: data.read || false,
                        createdAt: data.createdAt,
                        module: data.module || '',
                        data: data.data || {}
                    };
                    state.notifications.push(notification);
                    
                    if (!notification.read) {
                        state.unreadCount++;
                    }
                });

                renderNotifications();
                updateNotificationBadge();
                
                console.info(`Notifications: Loaded ${state.notifications.length} notifications (${state.unreadCount} unread)`);
            }, (error) => {
                console.error('Notifications: Error listening to notifications:', error);
            });
        } catch (error) {
            console.error('Notifications: Failed to setup notifications listener:', error);
        }
    }

    // ============================================
    // Real-time Activities Listener
    // ============================================
    function setupActivitiesListener() {
        try {
            const activitiesRef = collection(db, 'activities');
            const activitiesQuery = query(
                activitiesRef,
                orderBy('createdAt', 'desc'),
                limit(100)
            );

            state.listeners.activities = onSnapshot(activitiesQuery, (snapshot) => {
                state.activities = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    state.activities.push({
                        id: docSnap.id,
                        type: data.type || 'system',
                        action: data.action || '',
                        description: data.description || '',
                        user: data.user || 'System',
                        amount: data.amount || null,
                        status: data.status || 'completed',
                        createdAt: data.createdAt,
                        module: data.module || '',
                        data: data.data || {}
                    });
                });

                renderActivities();
                
                console.info(`Activities: Loaded ${state.activities.length} recent activities`);
            }, (error) => {
                console.error('Activities: Error listening to activities:', error);
            });
        } catch (error) {
            console.error('Activities: Failed to setup activities listener:', error);
        }
    }

    // ============================================
    // Cross-Module Listeners for Auto-Notifications
    // ============================================
    function setupModuleListeners() {
        // Listen to sales for real-time notifications
        setupSalesWatcher();
        // Listen to inventory for low stock & expiring alerts
        setupInventoryWatcher();
        // Listen to orders
        setupOrdersWatcher();
        // Listen to expenses
        setupExpensesWatcher();
        // Listen to customers
        setupCustomersWatcher();
    }

    function setupSalesWatcher() {
        try {
            const salesRef = collection(db, 'sales');
            const salesQuery = query(salesRef, orderBy('createdAt', 'desc'), limit(1));
            
            let isFirstLoad = true;
            
            state.listeners.sales = onSnapshot(salesQuery, (snapshot) => {
                if (isFirstLoad) {
                    isFirstLoad = false;
                    return; // Skip first load to prevent showing old data as new
                }

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        const total = parseFloat(data.grandTotal || data.total || 0);
                        
                        // Create notification for new sale
                        createNotification({
                            type: 'sale',
                            title: 'New Sale Completed',
                            message: `Sale of KSH ${total.toFixed(2)} completed${data.customer ? ` for ${data.customer}` : ''}`,
                            module: 'pharmacy-sales',
                            data: { saleId: change.doc.id, total }
                        });

                        // Create activity
                        createActivity({
                            type: 'sale',
                            action: 'Sale Completed',
                            description: `New sale${data.customer ? ` to ${data.customer}` : ''} - ${data.items?.length || 0} items`,
                            amount: total,
                            status: 'completed',
                            module: 'pharmacy-sales',
                            data: { saleId: change.doc.id }
                        });
                    }
                });
            });
        } catch (error) {
            console.error('Notifications: Failed to setup sales watcher:', error);
        }
    }

    function setupInventoryWatcher() {
        try {
            const inventoryRef = collection(db, 'inventory');
            
            let isFirstLoad = true;
            let previousInventory = new Map();

            state.listeners.inventory = onSnapshot(inventoryRef, (snapshot) => {
                if (isFirstLoad) {
                    // Store initial state
                    snapshot.forEach((docSnap) => {
                        previousInventory.set(docSnap.id, docSnap.data());
                    });
                    isFirstLoad = false;
                    return;
                }

                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const itemName = data.name || 'Unknown Item';

                    if (change.type === 'added') {
                        createNotification({
                            type: 'inventory',
                            title: 'New Inventory Added',
                            message: `${itemName} has been added to inventory (Qty: ${data.quantity || 0})`,
                            module: 'inventory-view',
                            data: { itemId: change.doc.id }
                        });

                        createActivity({
                            type: 'inventory',
                            action: 'Item Added',
                            description: `${itemName} added with quantity ${data.quantity || 0}`,
                            status: 'completed',
                            module: 'inventory-add',
                            data: { itemId: change.doc.id }
                        });
                    }

                    if (change.type === 'modified') {
                        const prevData = previousInventory.get(change.doc.id);
                        const quantity = parseInt(data.quantity) || 0;
                        const lowStockThreshold = parseInt(data.lowStockThreshold) || 10;

                        // Check for low stock alert
                        if (quantity > 0 && quantity <= lowStockThreshold) {
                            createNotification({
                                type: 'lowStock',
                                title: 'Low Stock Alert',
                                message: `${itemName} is running low (${quantity} remaining)`,
                                module: 'inventory-view',
                                data: { itemId: change.doc.id, quantity }
                            });
                        }

                        // Check for out of stock
                        if (quantity === 0 && prevData && prevData.quantity > 0) {
                            createNotification({
                                type: 'lowStock',
                                title: 'Out of Stock!',
                                message: `${itemName} is now out of stock`,
                                module: 'inventory-view',
                                data: { itemId: change.doc.id }
                            });
                        }

                        // Stock updated activity
                        if (prevData && prevData.quantity !== quantity) {
                            createActivity({
                                type: 'inventory',
                                action: 'Stock Updated',
                                description: `${itemName}: ${prevData.quantity || 0} → ${quantity}`,
                                status: quantity === 0 ? 'warning' : 'completed',
                                module: 'inventory-view',
                                data: { itemId: change.doc.id }
                            });
                        }
                    }

                    // Update previous state
                    previousInventory.set(change.doc.id, data);
                });
            });
        } catch (error) {
            console.error('Notifications: Failed to setup inventory watcher:', error);
        }
    }

    function setupOrdersWatcher() {
        try {
            const ordersRef = collection(db, 'orders');
            const ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'), limit(1));
            
            let isFirstLoad = true;

            state.listeners.orders = onSnapshot(ordersQuery, (snapshot) => {
                if (isFirstLoad) {
                    isFirstLoad = false;
                    return;
                }

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        
                        createNotification({
                            type: 'order',
                            title: 'New Order Created',
                            message: `Order #${data.orderNumber || change.doc.id.slice(-6)} created for ${data.supplier || 'Unknown Supplier'}`,
                            module: 'orders-view',
                            data: { orderId: change.doc.id }
                        });

                        createActivity({
                            type: 'order',
                            action: 'Order Created',
                            description: `Order to ${data.supplier || 'Unknown'} - ${data.items?.length || 0} items`,
                            amount: parseFloat(data.totalAmount) || 0,
                            status: data.status || 'pending',
                            module: 'orders-view',
                            data: { orderId: change.doc.id }
                        });
                    }

                    if (change.type === 'modified') {
                        const data = change.doc.data();
                        if (data.status === 'received' || data.status === 'completed') {
                            createNotification({
                                type: 'order',
                                title: 'Order Received',
                                message: `Order #${data.orderNumber || change.doc.id.slice(-6)} has been received`,
                                module: 'orders-view',
                                data: { orderId: change.doc.id }
                            });

                            createActivity({
                                type: 'order',
                                action: 'Order Received',
                                description: `Order from ${data.supplier || 'Unknown'} received`,
                                amount: parseFloat(data.totalAmount) || 0,
                                status: 'completed',
                                module: 'orders-view',
                                data: { orderId: change.doc.id }
                            });
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Notifications: Failed to setup orders watcher:', error);
        }
    }

    function setupExpensesWatcher() {
        try {
            const expensesRef = collection(db, 'expenses');
            const expensesQuery = query(expensesRef, orderBy('createdAt', 'desc'), limit(1));
            
            let isFirstLoad = true;

            state.listeners.expenses = onSnapshot(expensesQuery, (snapshot) => {
                if (isFirstLoad) {
                    isFirstLoad = false;
                    return;
                }

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        const amount = parseFloat(data.amount) || 0;
                        
                        createNotification({
                            type: 'expense',
                            title: 'New Expense Recorded',
                            message: `${data.description || 'Expense'} - KSH ${amount.toFixed(2)}`,
                            module: 'expenses-manage',
                            data: { expenseId: change.doc.id }
                        });

                        createActivity({
                            type: 'expense',
                            action: 'Expense Added',
                            description: `${data.category || 'General'}: ${data.description || 'Expense'}`,
                            amount: amount,
                            status: data.status || 'paid',
                            module: 'expenses-manage',
                            data: { expenseId: change.doc.id }
                        });
                    }
                });
            });
        } catch (error) {
            console.error('Notifications: Failed to setup expenses watcher:', error);
        }
    }

    function setupCustomersWatcher() {
        try {
            const customersRef = collection(db, 'customers');
            const customersQuery = query(customersRef, orderBy('createdAt', 'desc'), limit(1));
            
            let isFirstLoad = true;

            state.listeners.customers = onSnapshot(customersQuery, (snapshot) => {
                if (isFirstLoad) {
                    isFirstLoad = false;
                    return;
                }

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        
                        createNotification({
                            type: 'customer',
                            title: 'New Customer Added',
                            message: `${data.name || 'Customer'} has been added to the system`,
                            module: 'customers-manage',
                            data: { customerId: change.doc.id }
                        });

                        createActivity({
                            type: 'customer',
                            action: 'Customer Added',
                            description: `New customer: ${data.name || 'Unknown'}`,
                            status: 'completed',
                            module: 'customers-manage',
                            data: { customerId: change.doc.id }
                        });
                    }
                });
            });
        } catch (error) {
            console.error('Notifications: Failed to setup customers watcher:', error);
        }
    }

    // ============================================
    // Create Notification
    // ============================================
    async function createNotification(data) {
        try {
            const notificationsRef = collection(db, 'notifications');
            await addDoc(notificationsRef, {
                type: data.type || 'system',
                title: data.title || '',
                message: data.message || '',
                read: false,
                module: data.module || '',
                data: data.data || {},
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Notifications: Failed to create notification:', error);
        }
    }

    // ============================================
    // Create Activity
    // ============================================
    async function createActivity(data) {
        try {
            const activitiesRef = collection(db, 'activities');
            await addDoc(activitiesRef, {
                type: data.type || 'system',
                action: data.action || '',
                description: data.description || '',
                user: data.user || getCurrentUser(),
                amount: data.amount || null,
                status: data.status || 'completed',
                module: data.module || '',
                data: data.data || {},
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Activities: Failed to create activity:', error);
        }
    }

    // ============================================
    // Get Current User
    // ============================================
    function getCurrentUser() {
        // Try to get user from auth or settings
        if (window.PharmaFlowAuth && window.PharmaFlowAuth.getCurrentUser) {
            const user = window.PharmaFlowAuth.getCurrentUser();
            return user?.name || user?.email || 'Admin';
        }
        return 'Admin';
    }

    // ============================================
    // Render Notifications UI
    // ============================================
    function renderNotifications() {
        const dropdownBody = document.querySelector('#notificationDropdown .dropdown-body');
        if (!dropdownBody) return;

        if (state.notifications.length === 0) {
            dropdownBody.innerHTML = `
                <div class="notification-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications</p>
                </div>
            `;
            return;
        }

        let html = '';
        const recentNotifications = state.notifications.slice(0, 10);

        recentNotifications.forEach((notification) => {
            const typeInfo = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system;
            const timeAgo = formatTimeAgo(notification.createdAt);
            const unreadClass = notification.read ? '' : 'unread';

            html += `
                <div class="notification-item ${unreadClass}" data-id="${notification.id}" data-module="${notification.module}">
                    <i class="fas ${typeInfo.icon}" style="background-color: var(--${typeInfo.color}-color);"></i>
                    <div class="notification-content">
                        <p><strong>${notification.title}</strong></p>
                        <p>${notification.message}</p>
                        <span class="notification-time">${timeAgo}</span>
                    </div>
                </div>
            `;
        });

        dropdownBody.innerHTML = html;

        // Bind click events to notification items
        dropdownBody.querySelectorAll('.notification-item').forEach((item) => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const module = item.dataset.module;
                
                markAsRead(id);
                
                if (module && window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                    window.PharmaFlow.setActiveModule(module);
                }
                
                // Close dropdown
                const dropdown = document.getElementById('notificationDropdown');
                if (dropdown) dropdown.classList.remove('show');
            });
        });
    }

    // ============================================
    // Render Activities UI
    // ============================================
    function renderActivities() {
        const activitiesBody = document.getElementById('activitiesTableBody');
        if (!activitiesBody) return;

        if (state.activities.length === 0) {
            activitiesBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div class="activities-empty">
                            <i class="fas fa-history"></i>
                            <p>No recent activities</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        const recentActivities = state.activities.slice(0, 15);

        recentActivities.forEach((activity) => {
            const typeInfo = NOTIFICATION_TYPES[activity.type] || NOTIFICATION_TYPES.system;
            const timeAgo = formatTimeAgo(activity.createdAt);
            const statusClass = getStatusClass(activity.status);
            const amountDisplay = activity.amount !== null ? `KSH ${parseFloat(activity.amount).toFixed(2)}` : '-';

            html += `
                <tr class="activity-row" data-module="${activity.module}">
                    <td>
                        <span class="activity-time">${timeAgo}</span>
                    </td>
                    <td>
                        <div class="activity-info">
                            <span class="activity-icon ${typeInfo.color}">
                                <i class="fas ${typeInfo.icon}"></i>
                            </span>
                            <div class="activity-details">
                                <span class="activity-action">${activity.action}</span>
                                <span class="activity-description">${activity.description}</span>
                            </div>
                        </div>
                    </td>
                    <td>${activity.user}</td>
                    <td class="activity-amount">${amountDisplay}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${capitalizeFirst(activity.status)}</span>
                    </td>
                </tr>
            `;
        });

        activitiesBody.innerHTML = html;

        // Bind click events to activity rows
        activitiesBody.querySelectorAll('.activity-row').forEach((row) => {
            row.addEventListener('click', () => {
                const module = row.dataset.module;
                if (module && window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                    window.PharmaFlow.setActiveModule(module);
                }
            });
        });
    }

    // ============================================
    // Update Notification Badge
    // ============================================
    function updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (!badge) return;

        if (state.unreadCount > 0) {
            badge.textContent = state.unreadCount > 99 ? '99+' : state.unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ============================================
    // Mark Notification as Read
    // ============================================
    async function markAsRead(notificationId) {
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, { read: true });
        } catch (error) {
            console.error('Notifications: Failed to mark as read:', error);
        }
    }

    // ============================================
    // Mark All Notifications as Read
    // ============================================
    async function markAllAsRead() {
        try {
            const unreadNotifications = state.notifications.filter(n => !n.read);
            const updatePromises = unreadNotifications.map(n => {
                const notificationRef = doc(db, 'notifications', n.id);
                return updateDoc(notificationRef, { read: true });
            });
            await Promise.all(updatePromises);
            
            showToast('All notifications marked as read', 'success');
        } catch (error) {
            console.error('Notifications: Failed to mark all as read:', error);
        }
    }

    // ============================================
    // Clear Old Notifications
    // ============================================
    async function clearOldNotifications(daysOld = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

            const notificationsRef = collection(db, 'notifications');
            const oldQuery = query(
                notificationsRef,
                where('createdAt', '<', cutoffTimestamp),
                where('read', '==', true)
            );

            const snapshot = await getDocs(oldQuery);
            const deletePromises = [];
            snapshot.forEach((docSnap) => {
                deletePromises.push(deleteDoc(doc(db, 'notifications', docSnap.id)));
            });

            await Promise.all(deletePromises);
            console.info(`Notifications: Cleared ${deletePromises.length} old notifications`);
        } catch (error) {
            console.error('Notifications: Failed to clear old notifications:', error);
        }
    }

    // ============================================
    // Bind UI Events
    // ============================================
    function bindUIEvents() {
        // Mark all as read button
        const markReadBtn = document.querySelector('.mark-read');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                markAllAsRead();
            });
        }

        // View all notifications link
        const viewAllLink = document.querySelector('#notificationDropdown .dropdown-footer a');
        if (viewAllLink) {
            viewAllLink.addEventListener('click', (e) => {
                e.preventDefault();
                openAllNotificationsModal();
            });
        }

        // View all activities button - navigate to All Activities module
        const viewAllActivitiesBtn = document.querySelector('.recent-activities .view-all-btn');
        if (viewAllActivitiesBtn) {
            viewAllActivitiesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Navigate to all-activities module instead of opening modal
                if (window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                    window.PharmaFlow.setActiveModule('all-activities');
                }
            });
        }
    }

    // ============================================
    // Open All Notifications Modal
    // ============================================
    function openAllNotificationsModal() {
        const existingModal = document.getElementById('allNotificationsModal');
        if (existingModal) {
            existingModal.remove();
        }

        let notificationsHtml = '';
        state.notifications.forEach((notification) => {
            const typeInfo = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system;
            const timeAgo = formatTimeAgo(notification.createdAt);
            const unreadClass = notification.read ? '' : 'unread';

            notificationsHtml += `
                <div class="notification-item ${unreadClass}" data-id="${notification.id}" data-module="${notification.module}">
                    <i class="fas ${typeInfo.icon}" style="background-color: var(--${typeInfo.color}-color);"></i>
                    <div class="notification-content">
                        <p><strong>${notification.title}</strong></p>
                        <p>${notification.message}</p>
                        <span class="notification-time">${timeAgo}</span>
                    </div>
                </div>
            `;
        });

        if (state.notifications.length === 0) {
            notificationsHtml = `
                <div class="notification-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications</p>
                </div>
            `;
        }

        const modal = document.createElement('div');
        modal.id = 'allNotificationsModal';
        modal.className = 'pf-modal-overlay';
        modal.innerHTML = `
            <div class="pf-modal pf-modal-lg">
                <div class="pf-modal-header">
                    <h3><i class="fas fa-bell"></i> All Notifications</h3>
                    <button class="pf-modal-close" id="closeNotificationsModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="pf-modal-body">
                    <div class="notifications-actions">
                        <button class="btn btn-secondary btn-sm" id="markAllReadBtn">
                            <i class="fas fa-check-double"></i> Mark All as Read
                        </button>
                        <button class="btn btn-danger btn-sm" id="clearOldNotificationsBtn">
                            <i class="fas fa-trash"></i> Clear Old (7+ days)
                        </button>
                    </div>
                    <div class="all-notifications-list">
                        ${notificationsHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);

        // Close button
        document.getElementById('closeNotificationsModal').addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        });

        // Mark all read
        document.getElementById('markAllReadBtn').addEventListener('click', () => {
            markAllAsRead();
        });

        // Clear old
        document.getElementById('clearOldNotificationsBtn').addEventListener('click', () => {
            clearOldNotifications(7);
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            }
        });

        // Notification item clicks
        modal.querySelectorAll('.notification-item').forEach((item) => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const module = item.dataset.module;
                
                markAsRead(id);
                
                if (module && window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                    window.PharmaFlow.setActiveModule(module);
                }
                
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            });
        });
    }

    // ============================================
    // Open All Activities Modal
    // ============================================
    function openAllActivitiesModal() {
        const existingModal = document.getElementById('allActivitiesModal');
        if (existingModal) {
            existingModal.remove();
        }

        let activitiesHtml = '';
        state.activities.forEach((activity) => {
            const typeInfo = NOTIFICATION_TYPES[activity.type] || NOTIFICATION_TYPES.system;
            const timeAgo = formatTimeAgo(activity.createdAt);
            const statusClass = getStatusClass(activity.status);
            const amountDisplay = activity.amount !== null ? `KSH ${parseFloat(activity.amount).toFixed(2)}` : '-';

            activitiesHtml += `
                <tr class="activity-row" data-module="${activity.module}">
                    <td>
                        <span class="activity-time">${timeAgo}</span>
                    </td>
                    <td>
                        <div class="activity-info">
                            <span class="activity-icon ${typeInfo.color}">
                                <i class="fas ${typeInfo.icon}"></i>
                            </span>
                            <div class="activity-details">
                                <span class="activity-action">${activity.action}</span>
                                <span class="activity-description">${activity.description}</span>
                            </div>
                        </div>
                    </td>
                    <td>${activity.user}</td>
                    <td class="activity-amount">${amountDisplay}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${capitalizeFirst(activity.status)}</span>
                    </td>
                </tr>
            `;
        });

        if (state.activities.length === 0) {
            activitiesHtml = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div class="activities-empty">
                            <i class="fas fa-history"></i>
                            <p>No activities recorded</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        const modal = document.createElement('div');
        modal.id = 'allActivitiesModal';
        modal.className = 'pf-modal-overlay';
        modal.innerHTML = `
            <div class="pf-modal pf-modal-xl">
                <div class="pf-modal-header">
                    <h3><i class="fas fa-history"></i> All Activities</h3>
                    <button class="pf-modal-close" id="closeActivitiesModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="pf-modal-body">
                    <div class="activities-filter">
                        <select id="activityTypeFilter" class="form-control">
                            <option value="">All Types</option>
                            <option value="sale">Sales</option>
                            <option value="inventory">Inventory</option>
                            <option value="order">Orders</option>
                            <option value="expense">Expenses</option>
                            <option value="customer">Customers</option>
                        </select>
                    </div>
                    <div class="activities-table-wrapper">
                        <table class="activities-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Activity</th>
                                    <th>User</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="allActivitiesTableBody">
                                ${activitiesHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);

        // Close button
        document.getElementById('closeActivitiesModal').addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        });

        // Filter
        document.getElementById('activityTypeFilter').addEventListener('change', (e) => {
            const filterType = e.target.value;
            const rows = modal.querySelectorAll('.activity-row');
            rows.forEach((row) => {
                const activity = state.activities.find(a => a.module === row.dataset.module);
                if (!filterType || (activity && activity.type === filterType)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            }
        });

        // Activity row clicks
        modal.querySelectorAll('.activity-row').forEach((row) => {
            row.addEventListener('click', () => {
                const module = row.dataset.module;
                if (module && window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                    window.PharmaFlow.setActiveModule(module);
                }
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            });
        });
    }

    // ============================================
    // Helper Functions
    // ============================================
    function formatTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';

        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        const now = new Date();
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 60) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function getStatusClass(status) {
        const statusMap = {
            completed: 'status-success',
            success: 'status-success',
            paid: 'status-success',
            pending: 'status-warning',
            processing: 'status-warning',
            warning: 'status-warning',
            failed: 'status-danger',
            cancelled: 'status-danger',
            error: 'status-danger',
            active: 'status-primary',
            info: 'status-info'
        };
        return statusMap[status?.toLowerCase()] || 'status-default';
    }

    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `pf-toast pf-toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ============================================
    // Cleanup
    // ============================================
    function cleanup() {
        Object.values(state.listeners).forEach((unsubscribe) => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
    }

    // ============================================
    // Public API
    // ============================================
    const api = {
        init,
        cleanup,
        createNotification,
        createActivity,
        markAsRead,
        markAllAsRead,
        clearOldNotifications,
        getNotifications: () => [...state.notifications],
        getActivities: () => [...state.activities],
        getUnreadCount: () => state.unreadCount,
        openAllNotificationsModal,
        openAllActivitiesModal,
        showToast
    };

    window.PharmaFlowNotifications = api;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

})(window, document);
