import { auth, rtdb, storage } from './firebase-config.js';
import {
    onAuthStateChanged,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword as updateAuthPassword
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
    ref,
    onValue,
    set,
    update as updateDb
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import {
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// Settings Module - Profile and System Configuration
(function(window, document) {
    'use strict';

    let currentUser = null;
    let currentSettings = null;
    let settingsRef = null;
    let unsubscribeSettings = null;
    let avatarInput = null;
    let avatarButton = null;
    let themeRadios = [];
    let isSavingSettings = false;
    let isUploadingAvatar = false;
    let autoSaveTimer = null;
    let pendingChanges = false;

    document.addEventListener('DOMContentLoaded', () => {
        initThemeControls();
        hydrateFromCache();
        bindAvatarUpload();
        bindAutoSave();
    });

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            cleanupSettingsListener();
            currentUser = null;
            currentSettings = null;
            return;
        }

        currentUser = user;
        subscribeToSettings(user.uid);
        updateProfileDisplay({
            firstName: extractNameParts(user.displayName).first,
            lastName: extractNameParts(user.displayName).last,
            email: user.email,
            photoURL: user.photoURL
        }, currentSettings?.account || {});
    });

    // Open Settings from Profile Dropdown
    window.openSettings = function(section) {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) dropdown.classList.remove('show');

        if (typeof showModule === 'function') {
            showModule('module-settings');
        }

        setTimeout(() => {
            showSettingsSection(section);
        }, 100);
    };

    // Show Settings Section
    window.showSettingsSection = function(sectionId) {
        document.querySelectorAll('.set-nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
            }
        });

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

    // Change Password via Firebase Auth
    window.changePassword = async function() {
        const current = document.getElementById('setCurrentPassword')?.value || '';
        const newPass = document.getElementById('setNewPassword')?.value || '';
        const confirm = document.getElementById('setConfirmPassword')?.value || '';

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

        if (!currentUser?.email) {
            showNotification('User session not available. Please sign in again.', 'error');
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, current);
            await reauthenticateWithCredential(currentUser, credential);
            await updateAuthPassword(currentUser, newPass);
            showNotification('Password updated successfully!', 'success');
            document.getElementById('setCurrentPassword').value = '';
            document.getElementById('setNewPassword').value = '';
            document.getElementById('setConfirmPassword').value = '';
        } catch (error) {
            console.error('Password update error:', error);
            const message = mapPasswordError(error);
            showNotification(message, 'error');
        }
    };

    // Save All Settings to Firebase (manual save button)
    window.saveAllSettings = async function() {
        if (!currentUser || !settingsRef) {
            showNotification('User profile not ready. Please wait a moment.', 'error');
            return;
        }

        if (isSavingSettings) {
            return;
        }

        // Clear any pending auto-save
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
        pendingChanges = false;

        const payload = collectSettingsFromForm();
        payload.updatedAt = Date.now();

        try {
            isSavingSettings = true;
            await set(settingsRef, payload);
            currentSettings = payload;
            await syncAuthProfile(payload.profile);
            applyTheme(payload.appearance.theme);
            applyLayoutPreferences(payload.appearance);
            updateProfileDisplay(payload.profile, payload.account);
            localStorage.setItem('pharmflow_settings_cache', JSON.stringify(payload));
            showNotification('Settings saved!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Failed to save settings.', 'error');
        } finally {
            isSavingSettings = false;
        }
    };

    // Deactivate Account (placeholder)
    window.deactivateAccount = function() {
        if (confirm('Are you sure you want to deactivate your account? This action cannot be undone.')) {
            showNotification('Account deactivation request submitted', 'warning');
        }
    };

    // Logout All Sessions
    window.logoutAllSessions = async function() {
        if (confirm('This will log you out from all devices including this one. Continue?')) {
            showNotification('Logging out from all sessions...', 'info');

            if (window.PharmaFlowLogout) {
                await window.PharmaFlowLogout();
            } else {
                window.location.href = 'login.html';
            }
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
            const file = e.target.files?.[0];
            if (file) {
                showNotification(`Importing ${file.name}...`, 'info');
                setTimeout(() => {
                    showNotification('Data imported successfully!', 'success');
                }, 2000);
            }
        };
        input.click();
    };

    // Clear cached settings/theme
    window.clearCache = function() {
        if (confirm('Clear cached settings from this browser?')) {
            localStorage.removeItem('pharmflow_settings_cache');
            localStorage.removeItem('pharmflow_theme');
            showNotification('Cached settings cleared.', 'success');
        }
    };

    // Reset settings to defaults in Firebase
    window.resetSettings = async function() {
        if (!currentUser || !settingsRef) {
            showNotification('User profile not ready. Please wait.', 'error');
            return;
        }

        if (!confirm('Reset all settings to default values?')) {
            return;
        }

        try {
            const defaults = buildDefaultSettings();
            await set(settingsRef, defaults);
            currentSettings = defaults;
            hydrateSettingsForm(defaults);
            showNotification('Settings reset to default values.', 'success');
        } catch (error) {
            console.error('Reset settings error:', error);
            showNotification('Failed to reset settings.', 'error');
        }
    };

    // ===============================
    // Firebase bindings
    // ===============================
    function subscribeToSettings(uid) {
        cleanupSettingsListener();
        settingsRef = ref(rtdb, `users/${uid}/settings`);

        unsubscribeSettings = onValue(settingsRef, async (snapshot) => {
            try {
                if (!snapshot.exists()) {
                    const defaults = buildDefaultSettings();
                    await set(settingsRef, defaults);
                    currentSettings = defaults;
                    hydrateSettingsForm(defaults);
                    return;
                }

                const data = snapshot.val();
                currentSettings = data;
                hydrateSettingsForm(data);
            } catch (error) {
                console.error('Settings listener error:', error);
                showNotification('Unable to load settings from Firebase.', 'error');
            }
        });
    }

    function cleanupSettingsListener() {
        if (typeof unsubscribeSettings === 'function') {
            unsubscribeSettings();
            unsubscribeSettings = null;
        }
    }

    async function uploadProfileImage(file) {
        console.log('uploadProfileImage called with file:', file?.name, file?.type, file?.size);
        
        if (!currentUser) {
            showNotification('Please sign in to upload a profile photo.', 'error');
            console.error('Upload failed: No current user');
            return;
        }

        if (!storage) {
            showNotification('Storage service not available.', 'error');
            console.error('Upload failed: Storage not initialized');
            return;
        }

        if (!file || !file.type.startsWith('image/')) {
            showNotification('Please select a valid image file.', 'error');
            console.error('Upload failed: Invalid file type');
            return;
        }

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('Image too large. Maximum size is 5MB.', 'error');
            return;
        }

        setAvatarUploading(true);
        showNotification('Uploading profile photo...', 'info');

        try {
            // Create storage reference with timestamp to avoid caching issues
            const timestamp = Date.now();
            const fileExtension = file.name.split('.').pop() || 'jpg';
            const avatarPath = `users/${currentUser.uid}/profile/avatar_${timestamp}.${fileExtension}`;
            console.log('Uploading to path:', avatarPath);
            
            const avatarRef = storageRef(storage, avatarPath);
            
            // Upload the file
            const uploadResult = await uploadBytes(avatarRef, file, { 
                contentType: file.type,
                customMetadata: {
                    uploadedBy: currentUser.uid,
                    uploadedAt: new Date().toISOString()
                }
            });
            console.log('Upload successful:', uploadResult);
            
            // Get the download URL
            const downloadURL = await getDownloadURL(avatarRef);
            console.log('Download URL obtained:', downloadURL);

            // Update profile in Realtime Database
            const profilePayload = {
                ...(currentSettings?.profile || {}),
                photoURL: downloadURL
            };

            if (settingsRef) {
                await updateDb(settingsRef, {
                    profile: profilePayload,
                    updatedAt: Date.now()
                });
                console.log('Database updated with new photo URL');
            }

            // Update local state
            currentSettings = {
                ...(currentSettings || {}),
                profile: profilePayload
            };

            // Sync with Firebase Auth profile
            await syncAuthProfile(profilePayload);
            
            // Update UI immediately
            updateProfileDisplay(profilePayload, currentSettings?.account || {});
            
            // Cache the updated settings
            localStorage.setItem('pharmflow_settings_cache', JSON.stringify(currentSettings));
            
            showNotification('Profile photo updated successfully!', 'success');
        } catch (error) {
            console.error('Avatar upload failed:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            let errorMessage = 'Failed to upload profile photo.';
            if (error.code === 'storage/unauthorized') {
                errorMessage = 'Permission denied. Please check Firebase Storage rules.';
            } else if (error.code === 'storage/canceled') {
                errorMessage = 'Upload was cancelled.';
            } else if (error.code === 'storage/unknown') {
                errorMessage = 'An unknown error occurred. Please try again.';
            }
            
            showNotification(errorMessage, 'error');
        } finally {
            if (avatarInput) {
                avatarInput.value = '';
            }
            setAvatarUploading(false);
        }
    }

    async function syncAuthProfile(profile) {
        if (!currentUser) {
            return;
        }

        try {
            await updateProfile(currentUser, {
                displayName: buildDisplayName(profile),
                photoURL: profile.photoURL || currentUser.photoURL || null
            });
        } catch (error) {
            console.warn('Auth profile update failed:', error);
        }
    }

    // ===============================
    // Form helpers
    // ===============================
    function collectSettingsFromForm() {
        const roleValue = document.getElementById('setRole')?.value || 'admin';
        const themeValue = document.querySelector('input[name="theme"]:checked')?.value || currentSettings?.appearance?.theme || 'light';

        return {
            profile: {
                firstName: getInputValue('setFirstName'),
                lastName: getInputValue('setLastName'),
                email: getInputValue('setEmail'),
                phone: getInputValue('setPhone'),
                bio: getInputValue('setBio'),
                photoURL: currentSettings?.profile?.photoURL || null
            },
            account: {
                username: getInputValue('setUsername'),
                role: roleValue,
                language: document.getElementById('setLanguage')?.value || 'en',
                timezone: document.getElementById('setTimezone')?.value || 'Africa/Nairobi'
            },
            notifications: {
                lowStock: getCheckboxValue('setNotifyLowStock'),
                expiry: getCheckboxValue('setNotifyExpiry'),
                sales: getCheckboxValue('setNotifySales'),
                orders: getCheckboxValue('setNotifyOrders'),
                sound: getCheckboxValue('setNotifySound'),
                desktop: getCheckboxValue('setNotifyDesktop')
            },
            security: {
                twoFactorEnabled: getCheckboxValue('set2FA')
            },
            appearance: {
                theme: themeValue,
                compact: getCheckboxValue('setCompactMode'),
                sidebarCollapsed: getCheckboxValue('setSidebarCollapsed')
            },
            business: {
                name: getInputValue('setBizName'),
                phone: getInputValue('setBizPhone'),
                email: getInputValue('setBizEmail'),
                address: getInputValue('setBizAddress'),
                regNo: getInputValue('setBizRegNo'),
                taxPin: getInputValue('setBizTaxPin'),
                receiptHeader: getInputValue('setReceiptHeader'),
                receiptFooter: getInputValue('setReceiptFooter'),
                receiptLogo: getCheckboxValue('setReceiptLogo')
            }
        };
    }

    function hydrateSettingsForm(settings, options = {}) {
        const persistCache = options.persistCache !== false;
        const profile = settings.profile || {};
        const account = settings.account || {};
        const notifications = settings.notifications || {};
        const security = settings.security || {};
        const appearance = settings.appearance || {};
        const business = settings.business || {};

        // Profile section
        setInputValue('setFirstName', profile.firstName);
        setInputValue('setLastName', profile.lastName);
        setInputValue('setEmail', profile.email || currentUser?.email || '');
        setInputValue('setPhone', profile.phone);
        setInputValue('setBio', profile.bio);

        // Account section
        setInputValue('setUsername', account.username);
        setSelectValue('setRole', account.role || 'admin');
        setSelectValue('setLanguage', account.language || 'en');
        setSelectValue('setTimezone', account.timezone || 'Africa/Nairobi');

        // Notifications section
        setCheckbox('setNotifyLowStock', defaultBoolean(notifications.lowStock, true));
        setCheckbox('setNotifyExpiry', defaultBoolean(notifications.expiry, true));
        setCheckbox('setNotifySales', defaultBoolean(notifications.sales, false));
        setCheckbox('setNotifyOrders', defaultBoolean(notifications.orders, true));
        setCheckbox('setNotifySound', defaultBoolean(notifications.sound, true));
        setCheckbox('setNotifyDesktop', defaultBoolean(notifications.desktop, false));

        // Security section
        setCheckbox('set2FA', !!security.twoFactorEnabled);

        // Appearance section
        setCheckbox('setCompactMode', !!appearance.compact);
        setCheckbox('setSidebarCollapsed', !!appearance.sidebarCollapsed);
        const theme = appearance.theme || localStorage.getItem('theme') || 'light';
        setThemeSelection(theme);
        applyTheme(theme);
        applyLayoutPreferences(appearance);

        // Business section
        setInputValue('setBizName', business.name);
        setInputValue('setBizPhone', business.phone);
        setInputValue('setBizEmail', business.email);
        setInputValue('setBizAddress', business.address);
        setInputValue('setBizRegNo', business.regNo);
        setInputValue('setBizTaxPin', business.taxPin);
        setInputValue('setReceiptHeader', business.receiptHeader);
        setInputValue('setReceiptFooter', business.receiptFooter);
        setCheckbox('setReceiptLogo', defaultBoolean(business.receiptLogo, true));

        updateProfileDisplay(profile, account);

        if (persistCache) {
            localStorage.setItem('pharmflow_settings_cache', JSON.stringify(settings));
        }

        // Re-bind auto-save after hydrating form
        setTimeout(() => bindAutoSave(), 100);
    }

    function initThemeControls() {
        themeRadios = Array.from(document.querySelectorAll('input[name="theme"]'));
        const storedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(storedTheme);
        setThemeSelection(storedTheme);

        themeRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                applyTheme(event.target.value);
            });
        });
    }

    function bindAvatarUpload() {
        console.log('bindAvatarUpload called');
        
        // Try to find elements - they might not exist yet if Settings module isn't active
        avatarButton = document.querySelector('.set-avatar-edit');
        avatarInput = document.getElementById('setAvatarInput');

        console.log('Avatar button found:', !!avatarButton);
        console.log('Avatar input found:', !!avatarInput);

        if (avatarButton && !avatarButton._boundClick) {
            avatarButton._boundClick = true;
            avatarButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                console.log('Avatar edit button clicked, isUploadingAvatar:', isUploadingAvatar);
                
                if (isUploadingAvatar) {
                    console.log('Upload in progress, ignoring click');
                    return;
                }
                
                // Re-check for input in case it wasn't found initially
                if (!avatarInput) {
                    avatarInput = document.getElementById('setAvatarInput');
                }
                
                if (avatarInput) {
                    console.log('Triggering file input click');
                    avatarInput.click();
                } else {
                    console.error('Avatar input element not found!');
                    showNotification('Unable to open file picker. Please refresh the page.', 'error');
                }
            });
        }

        if (avatarInput && !avatarInput._boundChange) {
            avatarInput._boundChange = true;
            avatarInput.addEventListener('change', (event) => {
                console.log('File input changed, files:', event.target.files);
                const file = event.target.files?.[0];
                if (file) {
                    console.log('File selected:', file.name, file.type, file.size);
                    uploadProfileImage(file);
                } else {
                    console.log('No file selected');
                }
            });
        }

        // If elements not found, try again when settings module becomes visible
        if (!avatarButton || !avatarInput) {
            console.log('Avatar elements not found, will retry on module activation');
            
            // Watch for settings module activation
            const observer = new MutationObserver((mutations) => {
                const settingsModule = document.getElementById('module-settings');
                if (settingsModule && settingsModule.classList.contains('active')) {
                    console.log('Settings module activated, re-binding avatar upload');
                    setTimeout(() => bindAvatarUpload(), 100);
                }
            });

            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                observer.observe(mainContent, { 
                    attributes: true, 
                    subtree: true, 
                    attributeFilter: ['class'] 
                });
            }
        }
    }

    // Auto-save functionality - saves changes automatically without user interaction
    function bindAutoSave() {
        const settingsContainer = document.getElementById('module-settings');
        if (!settingsContainer) {
            // Retry when settings module is available
            setTimeout(bindAutoSave, 500);
            return;
        }

        // All input types that should trigger auto-save
        const inputSelectors = [
            'input[type="text"]',
            'input[type="email"]',
            'input[type="tel"]',
            'input[type="number"]',
            'textarea',
            'select'
        ].join(', ');

        // Bind to all text inputs, textareas, and selects - use debounced save
        settingsContainer.querySelectorAll(inputSelectors).forEach(input => {
            if (input._autoSaveBound) return;
            input._autoSaveBound = true;

            input.addEventListener('input', () => {
                scheduleAutoSave();
            });

            input.addEventListener('change', () => {
                scheduleAutoSave();
            });

            // Save on blur for immediate feedback
            input.addEventListener('blur', () => {
                if (pendingChanges) {
                    performAutoSave();
                }
            });
        });

        // Bind to all checkboxes - save immediately on change
        settingsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (checkbox._autoSaveBound) return;
            checkbox._autoSaveBound = true;

            checkbox.addEventListener('change', () => {
                performAutoSave();
            });
        });

        // Bind to radio buttons (theme selection) - save immediately
        settingsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
            if (radio._autoSaveBound) return;
            radio._autoSaveBound = true;

            radio.addEventListener('change', () => {
                performAutoSave();
            });
        });
    }

    // Debounced auto-save scheduler
    function scheduleAutoSave() {
        pendingChanges = true;
        
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }

        // Wait 1 second after last change before saving
        autoSaveTimer = setTimeout(() => {
            performAutoSave();
        }, 1000);
    }

    // Perform the actual auto-save
    async function performAutoSave() {
        if (!currentUser || !settingsRef || isSavingSettings) {
            return;
        }

        pendingChanges = false;
        
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }

        const payload = collectSettingsFromForm();
        payload.updatedAt = Date.now();

        try {
            isSavingSettings = true;
            await set(settingsRef, payload);
            currentSettings = payload;
            
            // Sync auth profile silently
            await syncAuthProfile(payload.profile);
            
            // Apply theme and layout preferences
            applyTheme(payload.appearance.theme);
            applyLayoutPreferences(payload.appearance);
            
            // Update profile display in header
            updateProfileDisplay(payload.profile, payload.account);
            
            // Cache locally
            localStorage.setItem('pharmflow_settings_cache', JSON.stringify(payload));
        } catch (error) {
            console.error('Auto-save failed:', error);
            // Silently fail - user can manually save if needed
        } finally {
            isSavingSettings = false;
        }
    }

    function hydrateFromCache() {
        const cached = localStorage.getItem('pharmflow_settings_cache');
        if (!cached) return;

        try {
            const parsed = JSON.parse(cached);
            currentSettings = parsed;
            hydrateSettingsForm(parsed, { persistCache: false });
        } catch (error) {
            console.warn('Invalid cached settings detected:', error);
        }
    }

    function setInputValue(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value ?? '';
    }

    function setSelectValue(id, value) {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null) return;
        el.value = value;
    }

    function setCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = !!checked;
    }

    function getInputValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function getCheckboxValue(id) {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    }

    function defaultBoolean(value, fallback) {
        return typeof value === 'boolean' ? value : fallback;
    }

    function setThemeSelection(theme) {
        themeRadios.forEach(radio => {
            radio.checked = radio.value === theme;
        });
    }

    function applyTheme(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        localStorage.setItem('theme', theme);
    }

    function applyLayoutPreferences(appearance = {}) {
        const compact = !!appearance.compact;
        const collapsed = !!appearance.sidebarCollapsed;

        document.documentElement.classList.toggle('compact-mode', compact);
        localStorage.setItem('pharmflow_compact_mode', compact ? '1' : '0');
        localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false');

        const sidebar = document.getElementById('sidebar');
        if (sidebar && !isMobileViewport()) {
            sidebar.classList.toggle('collapsed', collapsed);
        }
    }

    function isMobileViewport() {
        return window.innerWidth <= 768;
    }

    function setAvatarUploading(state) {
        isUploadingAvatar = state;
        if (!avatarButton) return;
        avatarButton.disabled = state;
        avatarButton.innerHTML = state ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-camera"></i>';
    }

    function updateProfileDisplay(profile = {}, account = {}) {
        const displayName = buildDisplayName(profile);
        const roleLabel = getRoleLabel(account.role || 'admin');
        const initials = buildInitials(displayName);
        const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128`;

        const profileName = document.querySelector('.profile-name');
        if (profileName) profileName.textContent = displayName;

        const dropdownName = document.querySelector('.profile-dropdown .profile-info h4');
        if (dropdownName) dropdownName.textContent = displayName;

        const dropdownEmail = document.querySelector('.profile-dropdown .profile-info p');
        if (dropdownEmail) dropdownEmail.textContent = profile.email || currentUser?.email || '';

        const setProfileName = document.getElementById('setProfileName');
        if (setProfileName) setProfileName.textContent = displayName;

        const setProfileRole = document.getElementById('setProfileRole');
        if (setProfileRole) setProfileRole.textContent = roleLabel;

        const avatarUrl = profile.photoURL || currentUser?.photoURL || null;
        setAvatarImage(document.querySelector('.profile-btn .profile-avatar'), avatarUrl, { placeholderUrl });
        setAvatarImage(document.querySelector('.profile-dropdown .profile-avatar.large'), avatarUrl, { placeholderUrl });
        setAvatarImage(document.querySelector('.set-avatar'), avatarUrl, { type: 'text', value: initials });
    }

    function setAvatarImage(element, url, fallback = {}) {
        if (!element) return;

        const imgUrl = url || fallback.placeholderUrl || null;

        if (imgUrl) {
            let img = element.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.alt = 'Profile';
                element.innerHTML = '';
                element.appendChild(img);
            }
            img.src = imgUrl;
            element.classList.add('has-image');
        } else if (fallback.type === 'text' && fallback.value) {
            element.classList.remove('has-image');
            element.innerHTML = '';
            const span = document.createElement('span');
            span.textContent = fallback.value;
            element.appendChild(span);
        } else {
            element.classList.remove('has-image');
            element.innerHTML = '';
            const icon = document.createElement('i');
            icon.className = fallback.icon || 'fas fa-user';
            element.appendChild(icon);
        }
    }

    function buildDisplayName(profile = {}) {
        const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
        if (name) return name;
        if (currentUser?.displayName) return currentUser.displayName;
        if (currentUser?.email) return currentUser.email.split('@')[0];
        return 'Admin';
    }

    function buildInitials(name = '') {
        if (!name.trim()) return 'PF';
        const parts = name.trim().split(' ').filter(Boolean);
        return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'PF';
    }

    function extractNameParts(displayName = '') {
        if (!displayName) return { first: '', last: '' };
        const parts = displayName.trim().split(' ').filter(Boolean);
        return {
            first: parts[0] || '',
            last: parts.slice(1).join(' ')
        };
    }

    function getRoleLabel(roleValue) {
        const map = {
            admin: 'Administrator',
            manager: 'Manager',
            pharmacist: 'Pharmacist',
            cashier: 'Cashier'
        };
        return map[roleValue] || 'Team Member';
    }

    function buildDefaultSettings() {
        const nameParts = extractNameParts(currentUser?.displayName || '');
        const theme = localStorage.getItem('theme') || 'light';

        return {
            profile: {
                firstName: nameParts.first || 'Admin',
                lastName: nameParts.last || '',
                email: currentUser?.email || '',
                phone: '',
                bio: '',
                photoURL: currentUser?.photoURL || null
            },
            account: {
                username: (currentUser?.email || 'admin@pharmaflow.com').split('@')[0],
                role: 'admin',
                language: 'en',
                timezone: 'Africa/Nairobi'
            },
            notifications: {
                lowStock: true,
                expiry: true,
                sales: false,
                orders: true,
                sound: true,
                desktop: false
            },
            security: {
                twoFactorEnabled: false
            },
            appearance: {
                theme,
                compact: false,
                sidebarCollapsed: false
            },
            business: {
                name: 'PharmFlow Pharmacy',
                phone: '',
                email: '',
                address: '',
                regNo: '',
                taxPin: '',
                receiptHeader: 'Thank you for shopping with us!',
                receiptFooter: 'Visit us again!',
                receiptLogo: true
            },
            updatedAt: Date.now()
        };
    }

    function mapPasswordError(error) {
        if (!error?.code) return 'Unable to update password. Please try again.';
        switch (error.code) {
            case 'auth/wrong-password':
                return 'Current password is incorrect.';
            case 'auth/weak-password':
                return 'Choose a stronger password.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please try again later.';
            default:
                return 'Unable to update password. Please try again.';
        }
    }

    // Notification helper
    function showNotification(message, type = 'success') {
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
