/**
 * PharmaFlow - Pharmacy Management System
 * Main application shell and UI interactions
 */
(function(window, document) {
    'use strict';

    const selectors = {
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        themeToggle: document.getElementById('themeToggle'),
        notificationBtn: document.getElementById('notificationBtn'),
        notificationDropdown: document.getElementById('notificationDropdown'),
        profileBtn: document.getElementById('profileBtn'),
        profileDropdown: document.getElementById('profileDropdown'),
        navLinks: document.querySelectorAll('.nav-link[data-module]'),
        submenuLinks: document.querySelectorAll('.submenu-link[data-module]'),
        moduleContents: document.querySelectorAll('.module-content')
    };

    const state = {
        activeModule: 'dashboard'
    };

    const overlayElement = document.createElement('div');
    overlayElement.className = 'sidebar-overlay';
    document.body.appendChild(overlayElement);

    function init() {
        loadTheme();
        setupEventListeners();
        restoreActiveModule();
        initDashboardControls();
    }

    function setupEventListeners() {
        bindClick(selectors.sidebarToggle, toggleSidebar);
        bindClick(selectors.themeToggle, toggleTheme);

        bindClick(selectors.notificationBtn, (event) => {
            event.stopPropagation();
            toggleDropdown(selectors.notificationDropdown);
        });

        bindClick(selectors.profileBtn, (event) => {
            event.stopPropagation();
            toggleDropdown(selectors.profileDropdown);
        });

        document.addEventListener('click', handleDocumentClick);

        selectors.navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const parentItem = link.closest('.nav-item');

                if (parentItem && parentItem.classList.contains('has-submenu')) {
                    parentItem.classList.toggle('open');
                    return;
                }

                setActiveModule(link.dataset.module);
                closeMobileSidebar();
            });
        });

        selectors.submenuLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                setActiveModule(link.dataset.module, link);
                closeMobileSidebar();
            });
        });

        overlayElement.addEventListener('click', closeMobileSidebar);

        const markReadBtn = document.querySelector('.mark-read');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', markAllNotificationsRead);
        }

        window.addEventListener('resize', handleResize);
    }

    function bindClick(element, handler) {
        if (element && typeof handler === 'function') {
            element.addEventListener('click', handler);
        }
    }

    function toggleSidebar() {
        if (!selectors.sidebar) {
            return;
        }

        if (isMobileViewport()) {
            selectors.sidebar.classList.toggle('open');
            overlayElement.classList.toggle('show');
            return;
        }

        selectors.sidebar.classList.toggle('collapsed');
        persist('sidebarCollapsed', selectors.sidebar.classList.contains('collapsed'));
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        persist('theme', nextTheme);
        updateThemeIcon(nextTheme);
    }

    function updateThemeIcon(theme) {
        if (!selectors.themeToggle) {
            return;
        }

        const icon = selectors.themeToggle.querySelector('i');
        if (!icon) {
            return;
        }

        icon.classList.remove('fa-sun', 'fa-moon');
        icon.classList.add(theme === 'dark' ? 'fa-sun' : 'fa-moon');
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);

        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed && selectors.sidebar && !isMobileViewport()) {
            selectors.sidebar.classList.add('collapsed');
        }
    }

    function restoreActiveModule() {
        const savedModule = localStorage.getItem('activeModule');
        setActiveModule(savedModule || state.activeModule);
    }

    function setActiveModule(moduleName, clickedLink) {
        if (!moduleName) {
            return;
        }

        selectors.navLinks.forEach(link => link.classList.remove('active'));
        selectors.submenuLinks.forEach(link => link.classList.remove('active'));
        selectors.moduleContents.forEach(content => content.classList.remove('active'));

        if (clickedLink) {
            clickedLink.classList.add('active');
        } else {
            const matchingLink = document.querySelector(`.nav-link[data-module="${moduleName}"]`) ||
                document.querySelector(`.submenu-link[data-module="${moduleName}"]`);
            if (matchingLink) {
                matchingLink.classList.add('active');
            }
        }

        const activeModule = document.getElementById(`module-${moduleName}`);
        if (activeModule) {
            activeModule.classList.add('active');
            state.activeModule = moduleName;
            persist('activeModule', moduleName);
        } else {
            console.warn(`PharmaFlow: module "${moduleName}" does not exist.`);
        }
    }

    function toggleDropdown(dropdownElement) {
        if (!dropdownElement) {
            return;
        }
        closeAllDropdowns(dropdownElement);
        dropdownElement.classList.toggle('show');
    }

    function handleDocumentClick(event) {
        const target = event.target;
        const isNotificationClick = selectors.notificationDropdown &&
            (selectors.notificationDropdown.contains(target) || (selectors.notificationBtn && selectors.notificationBtn.contains(target)));
        const isProfileClick = selectors.profileDropdown &&
            (selectors.profileDropdown.contains(target) || (selectors.profileBtn && selectors.profileBtn.contains(target)));

        if (!isNotificationClick && !isProfileClick) {
            closeAllDropdowns();
        }
    }

    function closeAllDropdowns(excludedDropdown) {
        [selectors.notificationDropdown, selectors.profileDropdown].forEach(dropdown => {
            if (dropdown && dropdown !== excludedDropdown) {
                dropdown.classList.remove('show');
            }
        });
    }

    function markAllNotificationsRead() {
        // Use the notification system if available
        if (window.PharmaFlowNotifications && window.PharmaFlowNotifications.markAllAsRead) {
            window.PharmaFlowNotifications.markAllAsRead();
        } else {
            // Fallback to DOM manipulation
            document.querySelectorAll('.notification-item.unread').forEach(item => item.classList.remove('unread'));
            const badge = document.querySelector('.notification-badge');
            if (badge) {
                badge.style.display = 'none';
            }
        }
    }

    function handleResize() {
        if (!selectors.sidebar) {
            return;
        }

        if (!isMobileViewport()) {
            selectors.sidebar.classList.remove('open');
            overlayElement.classList.remove('show');
        }
    }

    function initDashboardControls() {
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const icon = refreshBtn.querySelector('i');
                if (icon) {
                    icon.classList.add('fa-spin');
                    setTimeout(() => {
                        icon.classList.remove('fa-spin');
                    }, 1000);
                }
                refreshAllModules();
            });
        }

        // Global Search Setup
        initGlobalSearch();

        document.querySelectorAll('.quick-action-btn').forEach(button => {
            button.addEventListener('click', () => {
                const targetModule = button.getAttribute('data-module');
                setActiveModule(targetModule);
            });
        });

        const viewAllBtn = document.querySelector('.view-all-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                const targetModule = viewAllBtn.getAttribute('data-module');
                setActiveModule(targetModule);
            });
        }
    }

    // ============================================
    // Global Search Functionality
    // ============================================
    let searchDebounceTimer = null;
    let globalSearchData = {
        inventory: [],
        sales: [],
        customers: [],
        orders: [],
        suppliers: [],
        expenses: []
    };

    function initGlobalSearch() {
        const searchInput = document.getElementById('dashboardSearch');
        const clearBtn = document.getElementById('clearGlobalSearch');
        const resultsContainer = document.getElementById('globalSearchResults');

        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                const term = event.target.value.trim();
                
                // Show/hide clear button
                if (clearBtn) {
                    clearBtn.style.display = term.length > 0 ? 'flex' : 'none';
                }

                // Clear existing timer
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                }

                if (term.length < 2) {
                    hideSearchResults();
                    return;
                }

                // Debounce search
                searchDebounceTimer = setTimeout(() => {
                    performGlobalSearch(term);
                }, 300);
            });

            searchInput.addEventListener('focus', () => {
                const term = searchInput.value.trim();
                if (term.length >= 2) {
                    showSearchResults();
                }
            });

            // Close results when clicking outside
            document.addEventListener('click', (event) => {
                const container = document.querySelector('.global-search-container');
                if (container && !container.contains(event.target)) {
                    hideSearchResults();
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                }
                hideSearchResults();
            });
        }
    }

    async function performGlobalSearch(term) {
        const resultsContainer = document.getElementById('globalSearchResults');
        const loadingEl = document.getElementById('searchResultsLoading');
        const emptyEl = document.getElementById('searchResultsEmpty');
        const contentEl = document.getElementById('searchResultsContent');

        if (!resultsContainer) return;

        // Show loading state
        showSearchResults();
        if (loadingEl) loadingEl.style.display = 'flex';
        if (emptyEl) emptyEl.style.display = 'none';
        if (contentEl) contentEl.innerHTML = '';

        try {
            const results = await searchAllCollections(term.toLowerCase());
            
            if (loadingEl) loadingEl.style.display = 'none';

            const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

            if (totalResults === 0) {
                if (emptyEl) emptyEl.style.display = 'flex';
                return;
            }

            renderSearchResults(results, contentEl);
        } catch (error) {
            console.error('Global search error:', error);
            if (loadingEl) loadingEl.style.display = 'none';
            if (emptyEl) {
                emptyEl.style.display = 'flex';
                emptyEl.querySelector('span').textContent = 'Error searching. Please try again.';
            }
        }
    }

    async function searchAllCollections(term) {
        const results = {
            inventory: [],
            sales: [],
            customers: [],
            orders: [],
            suppliers: [],
            expenses: []
        };

        // Search Inventory - Access from PharmaFlow state if available
        if (window.PharmaFlowInventory && window.PharmaFlowInventory.getInventory) {
            const inventoryData = window.PharmaFlowInventory.getInventory();
            results.inventory = inventoryData.filter(item => 
                (item.name && item.name.toLowerCase().includes(term)) ||
                (item.category && item.category.toLowerCase().includes(term)) ||
                (item.barcode && item.barcode.toLowerCase().includes(term)) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(term))
            ).slice(0, 5);
        }

        // Search Sales
        if (window.PharmaFlowSales && window.PharmaFlowSales.getSales) {
            const salesData = window.PharmaFlowSales.getSales();
            results.sales = salesData.filter(sale => 
                (sale.id && sale.id.toLowerCase().includes(term)) ||
                (sale.customer && sale.customer.toLowerCase().includes(term)) ||
                (sale.receiptNumber && sale.receiptNumber.toLowerCase().includes(term)) ||
                (sale.paymentMethod && sale.paymentMethod.toLowerCase().includes(term))
            ).slice(0, 5);
        }

        // Search Customers
        if (window.PharmaFlowCustomers && window.PharmaFlowCustomers.getCustomers) {
            const customersData = window.PharmaFlowCustomers.getCustomers();
            results.customers = customersData.filter(customer => 
                (customer.name && customer.name.toLowerCase().includes(term)) ||
                (customer.phone && customer.phone.toLowerCase().includes(term)) ||
                (customer.email && customer.email.toLowerCase().includes(term))
            ).slice(0, 5);
        }

        // Search Orders
        if (window.PharmaFlowOrders && window.PharmaFlowOrders.getOrders) {
            const ordersData = window.PharmaFlowOrders.getOrders();
            results.orders = ordersData.filter(order => 
                (order.id && order.id.toLowerCase().includes(term)) ||
                (order.orderNumber && order.orderNumber.toLowerCase().includes(term)) ||
                (order.supplier && order.supplier.toLowerCase().includes(term)) ||
                (order.status && order.status.toLowerCase().includes(term))
            ).slice(0, 5);
        }

        // Search Suppliers
        if (window.PharmaFlowSuppliers && window.PharmaFlowSuppliers.getSuppliers) {
            const suppliersData = window.PharmaFlowSuppliers.getSuppliers();
            results.suppliers = suppliersData.filter(supplier => 
                (supplier.name && supplier.name.toLowerCase().includes(term)) ||
                (supplier.contact && supplier.contact.toLowerCase().includes(term)) ||
                (supplier.phone && supplier.phone.toLowerCase().includes(term)) ||
                (supplier.email && supplier.email.toLowerCase().includes(term))
            ).slice(0, 5);
        }

        // Search Expenses
        if (window.PharmaFlowExpenses && window.PharmaFlowExpenses.getExpenses) {
            const expensesData = window.PharmaFlowExpenses.getExpenses();
            results.expenses = expensesData.filter(expense => 
                (expense.description && expense.description.toLowerCase().includes(term)) ||
                (expense.category && expense.category.toLowerCase().includes(term)) ||
                (expense.payee && expense.payee.toLowerCase().includes(term))
            ).slice(0, 5);
        }

        return results;
    }

    function renderSearchResults(results, container) {
        if (!container) return;

        let html = '';

        // Inventory Results
        if (results.inventory.length > 0) {
            html += renderResultSection('Inventory', 'fas fa-boxes', 'inventory-view', results.inventory, (item) => ({
                title: item.name || 'Unknown Item',
                subtitle: `${item.category || 'No category'} • Qty: ${item.quantity || 0}`,
                badge: item.quantity > 0 ? 'In Stock' : 'Out of Stock',
                badgeClass: item.quantity > 0 ? 'success' : 'danger'
            }));
        }

        // Sales Results
        if (results.sales.length > 0) {
            html += renderResultSection('Sales', 'fas fa-receipt', 'pharmacy-sales', results.sales, (sale) => ({
                title: sale.receiptNumber || `Sale #${sale.id?.slice(-6) || 'N/A'}`,
                subtitle: `${sale.customer || 'Walk-in'} • ${formatCurrency(sale.total || sale.grandTotal || 0)}`,
                badge: sale.paymentMethod || 'Cash',
                badgeClass: 'primary'
            }));
        }

        // Customers Results
        if (results.customers.length > 0) {
            html += renderResultSection('Customers', 'fas fa-users', 'customers-manage', results.customers, (customer) => ({
                title: customer.name || 'Unknown Customer',
                subtitle: customer.phone || customer.email || 'No contact info',
                badge: customer.status || 'Active',
                badgeClass: customer.status === 'Active' ? 'success' : 'warning'
            }));
        }

        // Orders Results
        if (results.orders.length > 0) {
            html += renderResultSection('Orders', 'fas fa-shopping-cart', 'orders-view', results.orders, (order) => ({
                title: order.orderNumber || `Order #${order.id?.slice(-6) || 'N/A'}`,
                subtitle: order.supplier || 'Unknown Supplier',
                badge: order.status || 'Pending',
                badgeClass: order.status === 'Completed' ? 'success' : order.status === 'Pending' ? 'warning' : 'primary'
            }));
        }

        // Suppliers Results
        if (results.suppliers.length > 0) {
            html += renderResultSection('Suppliers', 'fas fa-truck', 'orders-supplier', results.suppliers, (supplier) => ({
                title: supplier.name || 'Unknown Supplier',
                subtitle: supplier.phone || supplier.email || 'No contact info',
                badge: supplier.status || 'Active',
                badgeClass: supplier.status === 'Active' ? 'success' : 'warning'
            }));
        }

        // Expenses Results
        if (results.expenses.length > 0) {
            html += renderResultSection('Expenses', 'fas fa-money-bill-wave', 'expenses-manage', results.expenses, (expense) => ({
                title: expense.description || 'Unknown Expense',
                subtitle: `${expense.category || 'General'} • ${formatCurrency(expense.amount || 0)}`,
                badge: expense.status || 'Paid',
                badgeClass: expense.status === 'Paid' ? 'success' : 'warning'
            }));
        }

        container.innerHTML = html;

        // Add click handlers for result items
        container.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const module = item.dataset.module;
                if (module) {
                    setActiveModule(module);
                    hideSearchResults();
                    const searchInput = document.getElementById('dashboardSearch');
                    if (searchInput) searchInput.value = '';
                    const clearBtn = document.getElementById('clearGlobalSearch');
                    if (clearBtn) clearBtn.style.display = 'none';
                }
            });
        });
    }

    function renderResultSection(title, icon, module, items, getItemData) {
        let html = `
            <div class="search-result-section">
                <div class="search-result-header">
                    <i class="${icon}"></i>
                    <span>${title}</span>
                    <span class="result-count">${items.length}</span>
                </div>
                <div class="search-result-items">
        `;

        items.forEach(item => {
            const data = getItemData(item);
            html += `
                <div class="search-result-item" data-module="${module}">
                    <div class="result-info">
                        <div class="result-title">${data.title}</div>
                        <div class="result-subtitle">${data.subtitle}</div>
                    </div>
                    <span class="result-badge ${data.badgeClass}">${data.badge}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    function showSearchResults() {
        const resultsContainer = document.getElementById('globalSearchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
        }
    }

    function hideSearchResults() {
        const resultsContainer = document.getElementById('globalSearchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }

    // ============================================
    // Refresh All Modules
    // ============================================
    function refreshAllModules() {
        console.info('PharmaFlow: Refreshing all modules...');
        
        // Refresh Dashboard
        if (window.PharmaFlowDashboard && window.PharmaFlowDashboard.refresh) {
            window.PharmaFlowDashboard.refresh();
        }

        // Refresh Inventory
        if (window.PharmaFlowInventory && window.PharmaFlowInventory.refresh) {
            window.PharmaFlowInventory.refresh();
        }

        // Refresh Sales
        if (window.PharmaFlowSales && window.PharmaFlowSales.refresh) {
            window.PharmaFlowSales.refresh();
        }

        // Refresh Customers
        if (window.PharmaFlowCustomers && window.PharmaFlowCustomers.refresh) {
            window.PharmaFlowCustomers.refresh();
        }

        // Refresh Orders
        if (window.PharmaFlowOrders && window.PharmaFlowOrders.refresh) {
            window.PharmaFlowOrders.refresh();
        }

        // Refresh Suppliers
        if (window.PharmaFlowSuppliers && window.PharmaFlowSuppliers.refresh) {
            window.PharmaFlowSuppliers.refresh();
        }

        // Refresh Expenses
        if (window.PharmaFlowExpenses && window.PharmaFlowExpenses.refresh) {
            window.PharmaFlowExpenses.refresh();
        }

        // Refresh Wholesale
        if (window.PharmaFlowWholesale && window.PharmaFlowWholesale.refresh) {
            window.PharmaFlowWholesale.refresh();
        }

        // Show success notification
        showNotification('All modules refreshed successfully!', 'success');
    }

    function showNotification(message, type = 'info') {
        // Use the notification system toast if available
        if (window.PharmaFlowNotifications && window.PharmaFlowNotifications.showToast) {
            window.PharmaFlowNotifications.showToast(message, type);
            return;
        }

        // Fallback to global notification
        const notification = document.createElement('div');
        notification.className = `global-notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function refreshDashboard() {
        console.info('PharmaFlow dashboard refresh requested.');
        if (window.PharmaFlowDashboard && window.PharmaFlowDashboard.refresh) {
            window.PharmaFlowDashboard.refresh();
        }
    }

    function formatCurrency(value) {
        const amount = Number(value);
        return `KSH ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
    }

    function formatInteger(value) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element !== null && element !== undefined) {
            element.textContent = value;
        }
    }

    const dashboardStats = {
        salesToday(value) {
            setText('salesToday', formatCurrency(value));
        },
        overallSales(value) {
            setText('overallSales', formatCurrency(value));
        },
        expensesToday(value) {
            setText('expensesToday', formatCurrency(value));
        },
        outOfStock(value) {
            setText('outOfStock', formatInteger(value));
        },
        expiringSoon(value) {
            setText('expiringSoon', formatInteger(value));
        },
        bulkSales(value) {
            setText('bulkSales', formatCurrency(value));
        },
        totalCustomers(value) {
            setText('totalCustomers', formatInteger(value));
        },
        inventoryValue(value) {
            setText('inventoryValue', formatCurrency(value));
        },
        updateAll(payload = {}) {
            Object.entries(payload).forEach(([key, val]) => {
                if (typeof dashboardStats[key] === 'function' && key !== 'updateAll') {
                    dashboardStats[key](val);
                }
            });
        }
    };

    function closeMobileSidebar() {
        if (selectors.sidebar && isMobileViewport()) {
            selectors.sidebar.classList.remove('open');
            overlayElement.classList.remove('show');
        }
    }

    function persist(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('PharmaFlow: unable to persist state', error);
        }
    }

    function isMobileViewport() {
        return window.innerWidth <= 992;
    }

    const api = {
        init,
        toggleSidebar,
        toggleTheme,
        setActiveModule,
        closeAllDropdowns,
        markAllNotificationsRead,
        handleResize,
        dashboard: {
            refresh: refreshDashboard,
            stats: dashboardStats
        }
    };

    window.PharmaFlow = api;

    // Global showModule function for direct module navigation
    window.showModule = function(moduleId) {
        // Hide all module contents
        selectors.moduleContents.forEach(content => content.classList.remove('active'));
        
        // Show the target module
        const targetModule = document.getElementById(moduleId);
        if (targetModule) {
            targetModule.classList.add('active');
            
            // Update sidebar active states
            selectors.navLinks.forEach(link => link.classList.remove('active'));
            selectors.submenuLinks.forEach(link => link.classList.remove('active'));
            
            // Try to find and activate the corresponding sidebar link
            const moduleName = moduleId.replace('module-', '');
            const matchingLink = document.querySelector(`.nav-link[data-module="${moduleName}"]`) ||
                document.querySelector(`.submenu-link[data-module="${moduleName}"]`);
            if (matchingLink) {
                matchingLink.classList.add('active');
                // Open parent submenu if exists
                const parentItem = matchingLink.closest('.nav-item.has-submenu');
                if (parentItem) {
                    parentItem.classList.add('open');
                }
            }
            
            persist('activeModule', moduleName);
        } else {
            console.warn(`PharmaFlow: module "${moduleId}" does not exist.`);
        }
    };

    // Global notification helper functions
    window.PharmaFlowShowNotification = showNotification;
    
    // Global function to create a notification
    window.PharmaFlowCreateNotification = function(data) {
        if (window.PharmaFlowNotifications && window.PharmaFlowNotifications.createNotification) {
            return window.PharmaFlowNotifications.createNotification(data);
        }
        console.warn('PharmaFlow: Notification system not initialized');
    };

    // Global function to create an activity
    window.PharmaFlowCreateActivity = function(data) {
        if (window.PharmaFlowNotifications && window.PharmaFlowNotifications.createActivity) {
            return window.PharmaFlowNotifications.createActivity(data);
        }
        console.warn('PharmaFlow: Activity system not initialized');
    };

    document.addEventListener('DOMContentLoaded', init);
})(window, document);
