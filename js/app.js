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
        document.querySelectorAll('.notification-item.unread').forEach(item => item.classList.remove('unread'));
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.style.display = 'none';
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
                    icon.style.animation = 'spin 0.5s linear';
                    setTimeout(() => {
                        icon.style.animation = '';
                    }, 500);
                }
                refreshDashboard();
            });
        }

        const searchInput = document.getElementById('dashboardSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                const term = event.target.value.toLowerCase();
                document.querySelectorAll('.stat-card').forEach(card => {
                    const label = card.querySelector('.stat-label');
                    const matches = label && label.textContent.toLowerCase().includes(term);
                    card.style.display = matches ? 'flex' : 'none';
                });
            });
        }

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

    document.addEventListener('DOMContentLoaded', init);
})(window, document);
