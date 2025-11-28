// Settings Module - Profile and System Configuration
(function(window, document) {
    'use strict';

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        initThemeFromSettings();
        loadSavedSettings();
    });

    // Open Settings from Profile Dropdown
    window.openSettings = function(section) {
        // Close dropdown
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) dropdown.classList.remove('show');

        // Navigate to settings module
        if (typeof showModule === 'function') {
            showModule('module-settings');
        }

        // Show specific section
        setTimeout(() => {
            showSettingsSection(section);
        }, 100);
    };

    // Show Settings Section
    window.showSettingsSection = function(sectionId) {
        // Update nav
        document.querySelectorAll('.set-nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
            }
        });

        // Update sections
        document.querySelectorAll('.set-section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(`set-${sectionId}`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    };

    // Toggle Password Visibility
    window.togglePasswordVisibility = function(btn) {
        const input = btn.parentElement.querySelector('input');
        const icon = btn.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    };

    // Change Password
    window.changePassword = function() {
        const current = document.getElementById('setCurrentPassword')?.value;
        const newPass = document.getElementById('setNewPassword')?.value;
        const confirm = document.getElementById('setConfirmPassword')?.value;

        if (!current || !newPass || !confirm) {
            showNotification('Please fill in all password fields', 'error');
            return;
        }

        if (newPass !== confirm) {
            showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPass.length < 8) {
            showNotification('Password must be at least 8 characters', 'error');
            return;
        }

        // Simulate password change
        showNotification('Password updated successfully!', 'success');
        
        // Clear fields
        document.getElementById('setCurrentPassword').value = '';
        document.getElementById('setNewPassword').value = '';
        document.getElementById('setConfirmPassword').value = '';
    };

    // Save All Settings
    window.saveAllSettings = function() {
        const settings = {
            profile: {
                firstName: document.getElementById('setFirstName')?.value || '',
                lastName: document.getElementById('setLastName')?.value || '',
                email: document.getElementById('setEmail')?.value || '',
                phone: document.getElementById('setPhone')?.value || '',
                bio: document.getElementById('setBio')?.value || ''
            },
            account: {
                username: document.getElementById('setUsername')?.value || '',
                language: document.getElementById('setLanguage')?.value || 'en',
                timezone: document.getElementById('setTimezone')?.value || 'Africa/Nairobi'
            },
            notifications: {
                lowStock: document.getElementById('setNotifyLowStock')?.checked || false,
                expiry: document.getElementById('setNotifyExpiry')?.checked || false,
                sales: document.getElementById('setNotifySales')?.checked || false,
                orders: document.getElementById('setNotifyOrders')?.checked || false,
                sound: document.getElementById('setNotifySound')?.checked || false,
                desktop: document.getElementById('setNotifyDesktop')?.checked || false
            },
            appearance: {
                theme: document.querySelector('input[name="theme"]:checked')?.value || 'light',
                compact: document.getElementById('setCompactMode')?.checked || false,
                sidebarCollapsed: document.getElementById('setSidebarCollapsed')?.checked || false
            },
            business: {
                name: document.getElementById('setBizName')?.value || '',
                phone: document.getElementById('setBizPhone')?.value || '',
                email: document.getElementById('setBizEmail')?.value || '',
                address: document.getElementById('setBizAddress')?.value || '',
                regNo: document.getElementById('setBizRegNo')?.value || '',
                taxPin: document.getElementById('setBizTaxPin')?.value || '',
                receiptHeader: document.getElementById('setReceiptHeader')?.value || '',
                receiptFooter: document.getElementById('setReceiptFooter')?.value || '',
                receiptLogo: document.getElementById('setReceiptLogo')?.checked || false
            }
        };

        // Save to localStorage
        localStorage.setItem('pharmflow_settings', JSON.stringify(settings));

        // Apply theme
        applyTheme(settings.appearance.theme);

        // Update profile display
        updateProfileDisplay(settings.profile);

        showNotification('Settings saved successfully!', 'success');
    };

    // Load Saved Settings
    function loadSavedSettings() {
        const saved = localStorage.getItem('pharmflow_settings');
        if (!saved) return;

        try {
            const settings = JSON.parse(saved);

            // Profile
            if (settings.profile) {
                setInputValue('setFirstName', settings.profile.firstName);
                setInputValue('setLastName', settings.profile.lastName);
                setInputValue('setEmail', settings.profile.email);
                setInputValue('setPhone', settings.profile.phone);
                setInputValue('setBio', settings.profile.bio);
            }

            // Account
            if (settings.account) {
                setInputValue('setUsername', settings.account.username);
                setSelectValue('setLanguage', settings.account.language);
                setSelectValue('setTimezone', settings.account.timezone);
            }

            // Notifications
            if (settings.notifications) {
                setCheckbox('setNotifyLowStock', settings.notifications.lowStock);
                setCheckbox('setNotifyExpiry', settings.notifications.expiry);
                setCheckbox('setNotifySales', settings.notifications.sales);
                setCheckbox('setNotifyOrders', settings.notifications.orders);
                setCheckbox('setNotifySound', settings.notifications.sound);
                setCheckbox('setNotifyDesktop', settings.notifications.desktop);
            }

            // Appearance
            if (settings.appearance) {
                const themeRadio = document.querySelector(`input[name="theme"][value="${settings.appearance.theme}"]`);
                if (themeRadio) themeRadio.checked = true;
                setCheckbox('setCompactMode', settings.appearance.compact);
                setCheckbox('setSidebarCollapsed', settings.appearance.sidebarCollapsed);
            }

            // Business
            if (settings.business) {
                setInputValue('setBizName', settings.business.name);
                setInputValue('setBizPhone', settings.business.phone);
                setInputValue('setBizEmail', settings.business.email);
                setInputValue('setBizAddress', settings.business.address);
                setInputValue('setBizRegNo', settings.business.regNo);
                setInputValue('setBizTaxPin', settings.business.taxPin);
                setInputValue('setReceiptHeader', settings.business.receiptHeader);
                setInputValue('setReceiptFooter', settings.business.receiptFooter);
                setCheckbox('setReceiptLogo', settings.business.receiptLogo);
            }

        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }

    // Helper functions
    function setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    }

    function setSelectValue(id, value) {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    }

    function setCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }

    // Apply Theme
    function applyTheme(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        localStorage.setItem('pharmflow_theme', theme);
    }

    // Initialize theme from settings
    function initThemeFromSettings() {
        const saved = localStorage.getItem('pharmflow_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.appearance?.theme) {
                    applyTheme(settings.appearance.theme);
                }
            } catch (e) {}
        }

        // Listen for theme changes
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                applyTheme(e.target.value);
            });
        });
    }

    // Update Profile Display
    function updateProfileDisplay(profile) {
        const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Admin';
        
        // Update header profile
        const profileName = document.querySelector('.profile-name');
        if (profileName) profileName.textContent = name;

        // Update dropdown
        const dropdownName = document.querySelector('.dropdown-header h4');
        if (dropdownName) dropdownName.textContent = name;

        const dropdownEmail = document.querySelector('.dropdown-header .profile-info p');
        if (dropdownEmail && profile.email) dropdownEmail.textContent = profile.email;

        // Update settings display
        const setProfileName = document.getElementById('setProfileName');
        if (setProfileName) setProfileName.textContent = name;
    }

    // Deactivate Account
    window.deactivateAccount = function() {
        if (confirm('Are you sure you want to deactivate your account? This action cannot be undone.')) {
            showNotification('Account deactivation request submitted', 'warning');
        }
    };

    // Logout All Sessions
    window.logoutAllSessions = function() {
        if (confirm('This will log you out from all other devices. Continue?')) {
            showNotification('Logged out from all other sessions', 'success');
        }
    };

    // Export Data
    window.exportData = function() {
        showNotification('Preparing data export...', 'info');
        setTimeout(() => {
            showNotification('Data export started. Check your downloads.', 'success');
        }, 1500);
    };

    // Import Data
    window.importData = function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                showNotification(`Importing ${file.name}...`, 'info');
                setTimeout(() => {
                    showNotification('Data imported successfully!', 'success');
                }, 2000);
            }
        };
        input.click();
    };

    // Clear Cache
    window.clearCache = function() {
        if (confirm('Clear all cached data? This may temporarily slow down the application.')) {
            localStorage.removeItem('pharmflow_cache');
            showNotification('Cache cleared successfully!', 'success');
        }
    };

    // Reset Settings
    window.resetSettings = function() {
        if (confirm('Reset all settings to default values? Your profile data will be preserved.')) {
            localStorage.removeItem('pharmflow_settings');
            location.reload();
        }
    };

    // Notification helper
    function showNotification(message, type = 'success') {
        // Check if notification system exists
        if (window.showNotification && typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

})(window, document);
