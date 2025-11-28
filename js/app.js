/**
 * PharmaFlow - Pharmacy Management System
 * Main Application JavaScript
 */

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const themeToggle = document.getElementById('themeToggle');
const notificationBtn = document.getElementById('notificationBtn');
const notificationDropdown = document.getElementById('notificationDropdown');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const navLinks = document.querySelectorAll('.nav-link[data-module]');
const submenuLinks = document.querySelectorAll('.submenu-link[data-module]');
const moduleContents = document.querySelectorAll('.module-content');
const submenuParents = document.querySelectorAll('.nav-item.has-submenu');

// Sidebar Overlay for mobile
const overlayElement = document.createElement('div');
overlayElement.className = 'sidebar-overlay';
document.body.appendChild(overlayElement);

/**
 * Initialize the application
 */
function init() {
    loadTheme();
    setupEventListeners();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Notification dropdown
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        notificationDropdown.classList.toggle('show');
    });
    
    // Profile dropdown
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        profileDropdown.classList.toggle('show');
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
        if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    });
    
    // Navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const parentItem = link.closest('.nav-item');
            
            // Check if this is a submenu parent
            if (parentItem && parentItem.classList.contains('has-submenu')) {
                parentItem.classList.toggle('open');
                return;
            }
            
            const module = link.getAttribute('data-module');
            setActiveModule(module);
            
            // Close sidebar on mobile after navigation
            if (window.innerWidth <= 992) {
                sidebar.classList.remove('open');
                overlayElement.classList.remove('show');
            }
        });
    });
    
    // Submenu links
    submenuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const module = link.getAttribute('data-module');
            setActiveModule(module, link);
            
            // Close sidebar on mobile after navigation
            if (window.innerWidth <= 992) {
                sidebar.classList.remove('open');
                overlayElement.classList.remove('show');
            }
        });
    });
    
    // Sidebar overlay click
    overlayElement.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlayElement.classList.remove('show');
    });
    
    // Mark all notifications as read
    const markReadBtn = document.querySelector('.mark-read');
    if (markReadBtn) {
        markReadBtn.addEventListener('click', markAllNotificationsRead);
    }
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
}

/**
 * Toggle sidebar collapsed state
 */
function toggleSidebar() {
    if (window.innerWidth <= 992) {
        // Mobile: toggle open class
        sidebar.classList.toggle('open');
        overlayElement.classList.toggle('show');
    } else {
        // Desktop: toggle collapsed class
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
}

/**
 * Toggle theme between light and dark
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    const icon = themeToggle.querySelector('i');
    if (newTheme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

/**
 * Load saved theme from localStorage
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update icon based on saved theme
    const icon = themeToggle.querySelector('i');
    if (savedTheme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
    
    // Load sidebar state
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed && window.innerWidth > 992) {
        sidebar.classList.add('collapsed');
    }
}

/**
 * Set active module
 * @param {string} moduleName - The name of the module to activate
 * @param {Element} clickedLink - The clicked link element (optional)
 */
function setActiveModule(moduleName, clickedLink = null) {
    // Remove active class from all nav links, submenu links, and module contents
    navLinks.forEach(link => link.classList.remove('active'));
    submenuLinks.forEach(link => link.classList.remove('active'));
    moduleContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to selected link
    if (clickedLink) {
        clickedLink.classList.add('active');
    } else {
        const activeLink = document.querySelector(`.nav-link[data-module="${moduleName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
    
    // Show selected module content
    const activeModule = document.getElementById(`module-${moduleName}`);
    if (activeModule) {
        activeModule.classList.add('active');
    }
    
    // Save active module
    localStorage.setItem('activeModule', moduleName);
}

/**
 * Close all dropdowns
 */
function closeAllDropdowns() {
    notificationDropdown.classList.remove('show');
    profileDropdown.classList.remove('show');
}

/**
 * Mark all notifications as read
 */
function markAllNotificationsRead() {
    const unreadItems = document.querySelectorAll('.notification-item.unread');
    unreadItems.forEach(item => item.classList.remove('unread'));
    
    // Update badge
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.style.display = 'none';
    }
}

/**
 * Handle window resize
 */
function handleResize() {
    if (window.innerWidth > 992) {
        sidebar.classList.remove('open');
        overlayElement.classList.remove('show');
    }
}

// Global dashboard update functions for real-time implementation
window.updateDashboardStats = {
    salesToday: function(value) {
        document.getElementById('salesToday').textContent = `KSH ${parseFloat(value).toFixed(2)}`;
    },
    overallSales: function(value) {
        document.getElementById('overallSales').textContent = `KSH ${parseFloat(value).toFixed(2)}`;
    },
    expensesToday: function(value) {
        document.getElementById('expensesToday').textContent = `KSH ${parseFloat(value).toFixed(2)}`;
    },
    itemsSold: function(value) {
        document.getElementById('itemsSold').textContent = parseInt(value);
    },
    outOfStock: function(value) {
        document.getElementById('outOfStock').textContent = parseInt(value);
    },
    expiringSoon: function(value) {
        document.getElementById('expiringSoon').textContent = parseInt(value);
    },
    bulkSales: function(value) {
        document.getElementById('bulkSales').textContent = `KSH ${parseFloat(value).toFixed(2)}`;
    },
    totalCustomers: function(value) {
        document.getElementById('totalCustomers').textContent = parseInt(value);
    },
    inventoryValue: function(value) {
        document.getElementById('inventoryValue').textContent = `KSH ${parseFloat(value).toFixed(2)}`;
    },
    updateAll: function(data) {
        if (data.salesToday !== undefined) this.salesToday(data.salesToday);
        if (data.overallSales !== undefined) this.overallSales(data.overallSales);
        if (data.expensesToday !== undefined) this.expensesToday(data.expensesToday);
        if (data.itemsSold !== undefined) this.itemsSold(data.itemsSold);
        if (data.outOfStock !== undefined) this.outOfStock(data.outOfStock);
        if (data.expiringSoon !== undefined) this.expiringSoon(data.expiringSoon);
        if (data.bulkSales !== undefined) this.bulkSales(data.bulkSales);
        if (data.totalCustomers !== undefined) this.totalCustomers(data.totalCustomers);
        if (data.inventoryValue !== undefined) this.inventoryValue(data.inventoryValue);
    }
};

// Global refresh dashboard function
window.refreshDashboard = function() {
    console.log('Dashboard refresh triggered');
    // Add your Firebase data fetch logic here
    // Example:
    // fetchDashboardData().then(data => {
    //     window.updateDashboardStats.updateAll(data);
    // });
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Set default module to dashboard
function init() {
    loadTheme();
    setupEventListeners();
    setActiveModule('dashboard');
    
    // Setup dashboard controls
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            icon.style.animation = 'spin 0.5s linear';
            setTimeout(() => {
                icon.style.animation = '';
            }, 500);
            window.refreshDashboard();
        });
    }
    
    // Setup dashboard search
    const searchInput = document.getElementById('dashboardSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const statCards = document.querySelectorAll('.stat-card');
            statCards.forEach(card => {
                const label = card.querySelector('.stat-label').textContent.toLowerCase();
                if (label.includes(searchTerm)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
    
    // Setup quick action buttons
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-module');
            if (moduleId) {
                setActiveModule(moduleId);
            }
        });
    });
    
    // Setup view all activities button
    const viewAllBtn = document.querySelector('.view-all-btn');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-module');
            if (moduleId) {
                setActiveModule(moduleId);
            }
        });
    }
}
