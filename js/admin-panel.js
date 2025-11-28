/**
 * PharmaFlow Admin Panel Module
 * Comprehensive Role-Based Access Control (RBAC) System
 * User Management, Branch Management, Audit Trail & Login Sessions
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDoc,
    getDocs,
    query, 
    orderBy, 
    where,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // Constants & Configuration
    // ============================================
    const ROLES = {
        SUPERADMIN: 'superadmin',
        ADMIN: 'admin',
        STAFF: 'staff'
    };

    const MODULES = [
        { id: 'dashboard', name: 'Dashboard', icon: 'fa-tachometer-alt' },
        { id: 'pos', name: 'Point of Sale', icon: 'fa-cash-register' },
        { id: 'inventory', name: 'Inventory', icon: 'fa-boxes' },
        { id: 'sales', name: 'Sales', icon: 'fa-chart-line' },
        { id: 'customers', name: 'Customers', icon: 'fa-users' },
        { id: 'orders', name: 'Orders', icon: 'fa-shopping-cart' },
        { id: 'prescriptions', name: 'Prescriptions', icon: 'fa-prescription' },
        { id: 'expenses', name: 'Expenses', icon: 'fa-money-bill-wave' },
        { id: 'suppliers', name: 'Suppliers', icon: 'fa-truck' },
        { id: 'wholesale', name: 'Wholesale', icon: 'fa-warehouse' },
        { id: 'reports', name: 'Reports', icon: 'fa-file-alt' },
        { id: 'notifications', name: 'Notifications', icon: 'fa-bell' },
        { id: 'settings', name: 'Settings', icon: 'fa-cog' },
        { id: 'admin', name: 'Admin Panel', icon: 'fa-user-shield' }
    ];

    const PERMISSIONS = ['view', 'create', 'edit', 'delete'];

    const DEFAULT_PERMISSIONS = {
        superadmin: MODULES.reduce((acc, mod) => {
            acc[mod.id] = { view: true, create: true, edit: true, delete: true };
            return acc;
        }, {}),
        admin: {
            dashboard: { view: true, create: false, edit: false, delete: false },
            pos: { view: true, create: true, edit: true, delete: false },
            inventory: { view: true, create: true, edit: true, delete: true },
            sales: { view: true, create: true, edit: true, delete: false },
            customers: { view: true, create: true, edit: true, delete: true },
            orders: { view: true, create: true, edit: true, delete: false },
            prescriptions: { view: true, create: true, edit: true, delete: false },
            expenses: { view: true, create: true, edit: true, delete: true },
            suppliers: { view: true, create: true, edit: true, delete: true },
            wholesale: { view: true, create: true, edit: true, delete: false },
            reports: { view: true, create: true, edit: false, delete: false },
            notifications: { view: true, create: true, edit: false, delete: true },
            settings: { view: true, create: false, edit: true, delete: false },
            admin: { view: true, create: true, edit: true, delete: false }
        },
        staff: {
            dashboard: { view: true, create: false, edit: false, delete: false },
            pos: { view: true, create: true, edit: false, delete: false },
            inventory: { view: true, create: false, edit: false, delete: false },
            sales: { view: true, create: true, edit: false, delete: false },
            customers: { view: true, create: true, edit: false, delete: false },
            orders: { view: true, create: true, edit: false, delete: false },
            prescriptions: { view: true, create: true, edit: false, delete: false },
            expenses: { view: false, create: false, edit: false, delete: false },
            suppliers: { view: false, create: false, edit: false, delete: false },
            wholesale: { view: false, create: false, edit: false, delete: false },
            reports: { view: false, create: false, edit: false, delete: false },
            notifications: { view: true, create: false, edit: false, delete: false },
            settings: { view: true, create: false, edit: false, delete: false },
            admin: { view: false, create: false, edit: false, delete: false }
        }
    };

    // ============================================
    // State Management
    // ============================================
    const state = {
        currentUser: null,
        users: [],
        branches: [],
        auditLogs: [],
        sessions: [],
        filteredUsers: [],
        filteredAudit: [],
        filteredSessions: [],
        currentTab: 'users',
        editingUserId: null,
        editingBranchId: null,
        deleteCallback: null,
        auditPage: 1,
        auditPerPage: 20
    };

    let unsubscribeUsers = null;
    let unsubscribeBranches = null;
    let unsubscribeAudit = null;
    let unsubscribeSessions = null;

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        console.info('PharmaFlow Admin Panel initializing...');
        
        // Set current user as superadmin (first user)
        initCurrentUser();
        
        // Setup real-time listeners
        setupUsersListener();
        setupBranchesListener();
        setupAuditListener();
        setupSessionsListener();
        
        // Render permissions table
        renderPermissionsTable();
        renderUserPermissionsForm();
        
        console.info('PharmaFlow Admin Panel initialized.');
    }

    // ============================================
    // Current User Management
    // ============================================
    function initCurrentUser() {
        // Check localStorage for current user, default to superadmin
        const storedUser = localStorage.getItem('pharmaflow_current_user');
        if (storedUser) {
            state.currentUser = JSON.parse(storedUser);
        } else {
            // Default superadmin user
            state.currentUser = {
                id: 'superadmin_default',
                firstName: 'Super',
                lastName: 'Admin',
                email: 'admin@pharmaflow.com',
                role: ROLES.SUPERADMIN,
                permissions: DEFAULT_PERMISSIONS.superadmin,
                status: 'active',
                branch: 'main'
            };
            localStorage.setItem('pharmaflow_current_user', JSON.stringify(state.currentUser));
        }
        
        // Apply role-based visibility
        applyRoleBasedAccess();
        
        // Log session start
        logUserSession('login');
    }

    function getCurrentUser() {
        return state.currentUser;
    }

    function hasPermission(module, action) {
        if (!state.currentUser) return false;
        if (state.currentUser.role === ROLES.SUPERADMIN) return true;
        
        const perms = state.currentUser.permissions || DEFAULT_PERMISSIONS[state.currentUser.role];
        return perms && perms[module] && perms[module][action];
    }

    function applyRoleBasedAccess() {
        const user = state.currentUser;
        if (!user) return;

        // Hide/show navigation items based on permissions
        document.querySelectorAll('.nav-link[data-module], .submenu-link[data-module]').forEach(link => {
            const moduleName = link.dataset.module;
            const moduleKey = getModuleKey(moduleName);
            
            if (moduleKey && !hasPermission(moduleKey, 'view')) {
                link.style.display = 'none';
            } else {
                link.style.display = '';
            }
        });

        // Hide action buttons based on permissions
        applyActionButtonsVisibility();
    }

    function getModuleKey(moduleName) {
        // Map module names to permission keys
        const mapping = {
            'dashboard': 'dashboard',
            'pharmacy-pos': 'pos',
            'pharmacy-sales': 'sales',
            'all-sales': 'sales',
            'inventory': 'inventory',
            'inventory-view': 'inventory',
            'customers': 'customers',
            'manage-customers': 'customers',
            'orders': 'orders',
            'manage-orders': 'orders',
            'prescriptions': 'prescriptions',
            'expenses': 'expenses',
            'manage-expenses': 'expenses',
            'suppliers': 'suppliers',
            'orders-supplier': 'suppliers',
            'wholesale': 'wholesale',
            'manage-wholesale': 'wholesale',
            'reports': 'reports',
            'notifications': 'notifications',
            'all-activities': 'notifications',
            'settings': 'settings',
            'admin': 'admin',
            'admin-users': 'admin'
        };
        return mapping[moduleName] || moduleName;
    }

    function applyActionButtonsVisibility() {
        // This will be called when modules load to hide create/edit/delete buttons
        // based on user permissions
    }

    // ============================================
    // Users Management
    // ============================================
    function setupUsersListener() {
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, orderBy('createdAt', 'desc'));

        unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            state.users = [];
            snapshot.forEach((doc) => {
                state.users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            state.filteredUsers = [...state.users];
            renderUsersTable();
            updateStats();
            
            console.info(`Admin: Loaded ${state.users.length} users`);
        }, (error) => {
            console.error('Admin: Error loading users:', error);
            // Show empty state
            renderUsersTable();
        });
    }

    function filterUsers() {
        // Get search/filter values from both admin panel and users module
        const adminSearch = document.getElementById('adminUserSearch')?.value.toLowerCase() || '';
        const usersModuleSearch = document.getElementById('usersModuleSearch')?.value.toLowerCase() || '';
        const searchTerm = adminSearch || usersModuleSearch;
        
        const adminRoleFilter = document.getElementById('adminUserRoleFilter')?.value || '';
        const usersModuleRoleFilter = document.getElementById('usersModuleRoleFilter')?.value || '';
        const roleFilter = adminRoleFilter || usersModuleRoleFilter;
        
        const adminStatusFilter = document.getElementById('adminUserStatusFilter')?.value || '';
        const usersModuleStatusFilter = document.getElementById('usersModuleStatusFilter')?.value || '';
        const statusFilter = adminStatusFilter || usersModuleStatusFilter;

        state.filteredUsers = state.users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.firstName?.toLowerCase().includes(searchTerm) ||
                user.lastName?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm);
            
            const matchesRole = !roleFilter || user.role === roleFilter;
            const matchesStatus = !statusFilter || user.status === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });

        renderUsersTable();
    }

    function renderUsersTable() {
        // Render to both admin panel and users module tables
        const adminTbody = document.getElementById('adminUsersTableBody');
        const usersTbody = document.getElementById('usersModuleTableBody');
        
        const tableContent = generateUsersTableContent();
        
        if (adminTbody) adminTbody.innerHTML = tableContent;
        if (usersTbody) usersTbody.innerHTML = tableContent;
    }

    function generateUsersTableContent() {
        if (state.filteredUsers.length === 0) {
            return `
                <tr class="admin-empty-row">
                    <td colspan="7">
                        <i class="fas fa-users"></i>
                        <p>No users found</p>
                    </td>
                </tr>
            `;
        }

        return state.filteredUsers.map(user => {
            const initials = getInitials(user.firstName, user.lastName);
            const lastLogin = user.lastLogin ? formatDateTime(user.lastLogin) : 'Never';
            const canEdit = hasPermission('admin', 'edit');
            const canDelete = hasPermission('admin', 'delete') && user.role !== ROLES.SUPERADMIN;

            return `
                <tr>
                    <td>
                        <div class="admin-user-info">
                            <div class="admin-user-avatar" style="background-color: ${getAvatarColor(user.role)}">
                                ${initials}
                            </div>
                            <span class="admin-user-name">${escapeHtml(user.firstName || '')} ${escapeHtml(user.lastName || '')}</span>
                        </div>
                    </td>
                    <td>${escapeHtml(user.email || '')}</td>
                    <td><span class="admin-badge admin-badge-${user.role}">${capitalizeFirst(user.role)}</span></td>
                    <td>${escapeHtml(user.branch || 'Main')}</td>
                    <td><span class="admin-badge admin-badge-${user.status || 'active'}">${capitalizeFirst(user.status || 'Active')}</span></td>
                    <td>${lastLogin}</td>
                    <td>
                        <div class="admin-actions">
                            <button class="admin-action-btn view" onclick="AdminPanel.viewUser('${user.id}')" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${canEdit ? `
                            <button class="admin-action-btn edit" onclick="AdminPanel.editUser('${user.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            ` : ''}
                            ${canDelete ? `
                            <button class="admin-action-btn delete" onclick="AdminPanel.confirmDeleteUser('${user.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openAddUserModal() {
        state.editingUserId = null;
        document.getElementById('adminUserModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Add New User';
        document.getElementById('adminUserForm').reset();
        document.getElementById('adminUserId').value = '';
        document.getElementById('adminUserPassword').required = true;
        document.getElementById('adminPasswordHint').style.display = 'block';
        document.getElementById('adminUserSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Save User';
        
        // Load branches
        populateBranchSelect();
        
        // Reset permissions
        renderUserPermissionsForm();
        
        document.getElementById('adminUserModal').classList.add('show');
    }

    function editUser(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;

        state.editingUserId = userId;
        document.getElementById('adminUserModalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Edit User';
        document.getElementById('adminUserId').value = userId;
        document.getElementById('adminUserFirstName').value = user.firstName || '';
        document.getElementById('adminUserLastName').value = user.lastName || '';
        document.getElementById('adminUserEmail').value = user.email || '';
        document.getElementById('adminUserPhone').value = user.phone || '';
        document.getElementById('adminUserPassword').value = '';
        document.getElementById('adminUserPassword').required = false;
        document.getElementById('adminPasswordHint').style.display = 'none';
        document.getElementById('adminUserRole').value = user.role || 'staff';
        document.getElementById('adminUserStatus').value = user.status || 'active';
        document.getElementById('adminUserSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Update User';
        
        // Load branches and select current
        populateBranchSelect(user.branch);
        
        // Load permissions
        renderUserPermissionsForm(user.permissions);
        onRoleChange();
        
        document.getElementById('adminUserModal').classList.add('show');
    }

    function viewUser(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;

        const content = document.getElementById('adminViewUserContent');
        const initials = getInitials(user.firstName, user.lastName);
        const permissions = user.permissions || DEFAULT_PERMISSIONS[user.role] || {};

        const permTags = Object.entries(permissions)
            .filter(([_, perms]) => perms && perms.view)
            .map(([module, _]) => {
                const mod = MODULES.find(m => m.id === module);
                return mod ? `<span class="admin-view-perm-tag"><i class="fas ${mod.icon}"></i> ${mod.name}</span>` : '';
            }).join('');

        content.innerHTML = `
            <div class="admin-view-user-header">
                <div class="admin-view-user-avatar" style="background-color: ${getAvatarColor(user.role)}">
                    ${initials}
                </div>
                <div class="admin-view-user-info">
                    <h3>${escapeHtml(user.firstName || '')} ${escapeHtml(user.lastName || '')}</h3>
                    <p>${escapeHtml(user.email || '')}</p>
                </div>
            </div>
            <div class="admin-view-user-grid">
                <div class="admin-view-user-item">
                    <label>Role</label>
                    <span><span class="admin-badge admin-badge-${user.role}">${capitalizeFirst(user.role)}</span></span>
                </div>
                <div class="admin-view-user-item">
                    <label>Status</label>
                    <span><span class="admin-badge admin-badge-${user.status || 'active'}">${capitalizeFirst(user.status || 'Active')}</span></span>
                </div>
                <div class="admin-view-user-item">
                    <label>Phone</label>
                    <span>${escapeHtml(user.phone || 'Not provided')}</span>
                </div>
                <div class="admin-view-user-item">
                    <label>Branch</label>
                    <span>${escapeHtml(user.branch || 'Main')}</span>
                </div>
                <div class="admin-view-user-item">
                    <label>Created</label>
                    <span>${user.createdAt ? formatDateTime(user.createdAt) : 'N/A'}</span>
                </div>
                <div class="admin-view-user-item">
                    <label>Last Login</label>
                    <span>${user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}</span>
                </div>
            </div>
            <div class="admin-view-permissions">
                <h4><i class="fas fa-lock"></i> Accessible Modules</h4>
                <div class="admin-view-perm-list">
                    ${permTags || '<span class="admin-view-perm-tag" style="background-color: rgba(107, 114, 128, 0.1); color: #6b7280;">No permissions assigned</span>'}
                </div>
            </div>
        `;

        document.getElementById('adminViewUserModal').classList.add('show');
    }

    async function saveUser(event) {
        event.preventDefault();

        const userId = document.getElementById('adminUserId').value;
        const firstName = document.getElementById('adminUserFirstName').value.trim();
        const lastName = document.getElementById('adminUserLastName').value.trim();
        const email = document.getElementById('adminUserEmail').value.trim();
        const phone = document.getElementById('adminUserPhone').value.trim();
        const password = document.getElementById('adminUserPassword').value;
        const role = document.getElementById('adminUserRole').value;
        const branch = document.getElementById('adminUserBranch').value;
        const status = document.getElementById('adminUserStatus').value;

        // Collect permissions
        const permissions = collectUserPermissions();

        const userData = {
            firstName,
            lastName,
            email,
            phone,
            role,
            branch,
            status,
            permissions,
            updatedAt: serverTimestamp()
        };

        if (password) {
            userData.password = password; // In production, hash this!
        }

        try {
            if (userId) {
                // Update existing user
                await updateDoc(doc(db, 'users', userId), userData);
                await logAudit('update', 'users', `Updated user: ${firstName} ${lastName}`);
                showNotification('User updated successfully', 'success');
            } else {
                // Create new user
                userData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'users'), userData);
                await logAudit('create', 'users', `Created user: ${firstName} ${lastName}`);
                showNotification('User created successfully', 'success');
            }

            closeUserModal();
        } catch (error) {
            console.error('Error saving user:', error);
            showNotification('Failed to save user', 'error');
        }
    }

    function confirmDeleteUser(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;

        if (user.role === ROLES.SUPERADMIN) {
            showNotification('Cannot delete super admin user', 'error');
            return;
        }

        document.getElementById('adminConfirmMessage').textContent = 
            `Are you sure you want to delete user "${user.firstName} ${user.lastName}"? This action cannot be undone.`;
        
        state.deleteCallback = async () => {
            try {
                await deleteDoc(doc(db, 'users', userId));
                await logAudit('delete', 'users', `Deleted user: ${user.firstName} ${user.lastName}`);
                showNotification('User deleted successfully', 'success');
                closeConfirmModal();
            } catch (error) {
                console.error('Error deleting user:', error);
                showNotification('Failed to delete user', 'error');
            }
        };

        document.getElementById('adminConfirmDeleteBtn').onclick = state.deleteCallback;
        document.getElementById('adminConfirmModal').classList.add('show');
    }

    function closeUserModal() {
        document.getElementById('adminUserModal').classList.remove('show');
        state.editingUserId = null;
    }

    function closeViewUserModal() {
        document.getElementById('adminViewUserModal').classList.remove('show');
    }

    function onRoleChange() {
        const role = document.getElementById('adminUserRole').value;
        const permSection = document.getElementById('adminPermissionsSection');
        
        if (role === 'staff') {
            permSection.style.display = 'block';
        } else {
            permSection.style.display = 'none';
        }
    }

    function collectUserPermissions() {
        const permissions = {};
        
        MODULES.forEach(mod => {
            const checkbox = document.getElementById(`perm_${mod.id}`);
            if (checkbox && checkbox.checked) {
                permissions[mod.id] = {
                    view: document.getElementById(`perm_${mod.id}_view`)?.checked || false,
                    create: document.getElementById(`perm_${mod.id}_create`)?.checked || false,
                    edit: document.getElementById(`perm_${mod.id}_edit`)?.checked || false,
                    delete: document.getElementById(`perm_${mod.id}_delete`)?.checked || false
                };
            }
        });

        return permissions;
    }

    function renderUserPermissionsForm(existingPerms = null) {
        const container = document.getElementById('adminUserPermissions');
        if (!container) return;

        container.innerHTML = MODULES.filter(m => m.id !== 'admin').map(mod => {
            const perms = existingPerms && existingPerms[mod.id] ? existingPerms[mod.id] : { view: false, create: false, edit: false, delete: false };
            const isChecked = perms.view || perms.create || perms.edit || perms.delete;

            return `
                <div class="admin-perm-item">
                    <input type="checkbox" id="perm_${mod.id}" ${isChecked ? 'checked' : ''} onchange="AdminPanel.toggleModulePerms('${mod.id}')">
                    <div class="admin-perm-item-info">
                        <span class="admin-perm-item-name"><i class="fas ${mod.icon}"></i> ${mod.name}</span>
                        <div class="admin-perm-item-access">
                            <label><input type="checkbox" id="perm_${mod.id}_view" ${perms.view ? 'checked' : ''}> View</label>
                            <label><input type="checkbox" id="perm_${mod.id}_create" ${perms.create ? 'checked' : ''}> Create</label>
                            <label><input type="checkbox" id="perm_${mod.id}_edit" ${perms.edit ? 'checked' : ''}> Edit</label>
                            <label><input type="checkbox" id="perm_${mod.id}_delete" ${perms.delete ? 'checked' : ''}> Delete</label>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function toggleModulePerms(moduleId) {
        const mainCheckbox = document.getElementById(`perm_${moduleId}`);
        const checked = mainCheckbox.checked;
        
        ['view', 'create', 'edit', 'delete'].forEach(action => {
            const cb = document.getElementById(`perm_${moduleId}_${action}`);
            if (cb) cb.checked = checked ? (action === 'view') : false;
        });
    }

    // ============================================
    // Branches Management
    // ============================================
    function setupBranchesListener() {
        const branchesRef = collection(db, 'branches');
        const branchesQuery = query(branchesRef, orderBy('createdAt', 'desc'));

        unsubscribeBranches = onSnapshot(branchesQuery, (snapshot) => {
            state.branches = [];
            snapshot.forEach((doc) => {
                state.branches.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Add default main branch if no branches exist
            if (state.branches.length === 0) {
                state.branches.push({
                    id: 'main',
                    name: 'Main Branch',
                    location: 'Headquarters',
                    status: 'active'
                });
            }
            
            renderBranchesGrid();
            updateStats();
            
            console.info(`Admin: Loaded ${state.branches.length} branches`);
        }, (error) => {
            console.error('Admin: Error loading branches:', error);
            // Add default branch
            state.branches = [{
                id: 'main',
                name: 'Main Branch',
                location: 'Headquarters',
                status: 'active'
            }];
            renderBranchesGrid();
        });
    }

    function filterBranches() {
        const searchTerm = document.getElementById('adminBranchSearch')?.value.toLowerCase() || '';
        
        const filtered = state.branches.filter(branch => {
            return !searchTerm || 
                branch.name?.toLowerCase().includes(searchTerm) ||
                branch.location?.toLowerCase().includes(searchTerm);
        });

        renderBranchesGrid(filtered);
    }

    function renderBranchesGrid(branches = state.branches) {
        const grid = document.getElementById('adminBranchesGrid');
        if (!grid) return;

        if (branches.length === 0) {
            grid.innerHTML = `
                <div class="admin-empty-row">
                    <i class="fas fa-building"></i>
                    <p>No branches found</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = branches.map(branch => {
            const userCount = state.users.filter(u => u.branch === branch.name || u.branch === branch.id).length;
            const canEdit = hasPermission('admin', 'edit');
            const canDelete = hasPermission('admin', 'delete') && branch.id !== 'main';

            return `
                <div class="admin-branch-card">
                    <div class="admin-branch-header">
                        <div>
                            <div class="admin-branch-name">${escapeHtml(branch.name)}</div>
                            <div class="admin-branch-location">
                                <i class="fas fa-map-marker-alt"></i> ${escapeHtml(branch.location || 'No location')}
                            </div>
                        </div>
                        <div class="admin-branch-icon">
                            <i class="fas fa-building"></i>
                        </div>
                    </div>
                    <div class="admin-branch-stats">
                        <div class="admin-branch-stat">
                            <div class="admin-branch-stat-value">${userCount}</div>
                            <div class="admin-branch-stat-label">Users</div>
                        </div>
                        <div class="admin-branch-stat">
                            <div class="admin-branch-stat-value">
                                <span class="admin-badge admin-badge-${branch.status || 'active'}">${capitalizeFirst(branch.status || 'Active')}</span>
                            </div>
                            <div class="admin-branch-stat-label">Status</div>
                        </div>
                    </div>
                    <div class="admin-actions" style="margin-top: 16px; justify-content: flex-end;">
                        ${canEdit ? `
                        <button class="admin-action-btn edit" onclick="AdminPanel.editBranch('${branch.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        ` : ''}
                        ${canDelete ? `
                        <button class="admin-action-btn delete" onclick="AdminPanel.confirmDeleteBranch('${branch.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function openAddBranchModal() {
        state.editingBranchId = null;
        document.getElementById('adminBranchModalTitle').innerHTML = '<i class="fas fa-building"></i> Add New Branch';
        document.getElementById('adminBranchForm').reset();
        document.getElementById('adminBranchId').value = '';
        document.getElementById('adminBranchModal').classList.add('show');
    }

    function editBranch(branchId) {
        const branch = state.branches.find(b => b.id === branchId);
        if (!branch) return;

        state.editingBranchId = branchId;
        document.getElementById('adminBranchModalTitle').innerHTML = '<i class="fas fa-building"></i> Edit Branch';
        document.getElementById('adminBranchId').value = branchId;
        document.getElementById('adminBranchName').value = branch.name || '';
        document.getElementById('adminBranchLocation').value = branch.location || '';
        document.getElementById('adminBranchPhone').value = branch.phone || '';
        document.getElementById('adminBranchStatus').value = branch.status || 'active';
        document.getElementById('adminBranchModal').classList.add('show');
    }

    async function saveBranch(event) {
        event.preventDefault();

        const branchId = document.getElementById('adminBranchId').value;
        const name = document.getElementById('adminBranchName').value.trim();
        const location = document.getElementById('adminBranchLocation').value.trim();
        const phone = document.getElementById('adminBranchPhone').value.trim();
        const status = document.getElementById('adminBranchStatus').value;

        const branchData = {
            name,
            location,
            phone,
            status,
            updatedAt: serverTimestamp()
        };

        try {
            if (branchId && branchId !== 'main') {
                await updateDoc(doc(db, 'branches', branchId), branchData);
                await logAudit('update', 'branches', `Updated branch: ${name}`);
                showNotification('Branch updated successfully', 'success');
            } else {
                branchData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'branches'), branchData);
                await logAudit('create', 'branches', `Created branch: ${name}`);
                showNotification('Branch created successfully', 'success');
            }

            closeBranchModal();
        } catch (error) {
            console.error('Error saving branch:', error);
            showNotification('Failed to save branch', 'error');
        }
    }

    function confirmDeleteBranch(branchId) {
        const branch = state.branches.find(b => b.id === branchId);
        if (!branch) return;

        if (branchId === 'main') {
            showNotification('Cannot delete main branch', 'error');
            return;
        }

        document.getElementById('adminConfirmMessage').textContent = 
            `Are you sure you want to delete branch "${branch.name}"? All users in this branch will be moved to Main Branch.`;
        
        state.deleteCallback = async () => {
            try {
                await deleteDoc(doc(db, 'branches', branchId));
                await logAudit('delete', 'branches', `Deleted branch: ${branch.name}`);
                showNotification('Branch deleted successfully', 'success');
                closeConfirmModal();
            } catch (error) {
                console.error('Error deleting branch:', error);
                showNotification('Failed to delete branch', 'error');
            }
        };

        document.getElementById('adminConfirmDeleteBtn').onclick = state.deleteCallback;
        document.getElementById('adminConfirmModal').classList.add('show');
    }

    function closeBranchModal() {
        document.getElementById('adminBranchModal').classList.remove('show');
        state.editingBranchId = null;
    }

    function populateBranchSelect(selectedBranch = null) {
        const select = document.getElementById('adminUserBranch');
        if (!select) return;

        select.innerHTML = '<option value="">Select Branch</option>' +
            state.branches.map(branch => 
                `<option value="${branch.name}" ${selectedBranch === branch.name ? 'selected' : ''}>${branch.name}</option>`
            ).join('');
    }

    // ============================================
    // Audit Trail
    // ============================================
    function setupAuditListener() {
        const auditRef = collection(db, 'auditLogs');
        const auditQuery = query(auditRef, orderBy('timestamp', 'desc'), limit(500));

        unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
            state.auditLogs = [];
            snapshot.forEach((doc) => {
                state.auditLogs.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            state.filteredAudit = [...state.auditLogs];
            renderAuditTable();
            updateStats();
            
            console.info(`Admin: Loaded ${state.auditLogs.length} audit logs`);
        }, (error) => {
            console.error('Admin: Error loading audit logs:', error);
            renderAuditTable();
        });
    }

    async function logAudit(action, module, details, additionalData = {}) {
        try {
            const user = state.currentUser || { firstName: 'System', lastName: '' };
            
            await addDoc(collection(db, 'auditLogs'), {
                action,
                module,
                details,
                userId: user.id || 'system',
                userName: `${user.firstName} ${user.lastName}`.trim(),
                userEmail: user.email || '',
                ipAddress: await getClientIP(),
                userAgent: navigator.userAgent,
                timestamp: serverTimestamp(),
                ...additionalData
            });
        } catch (error) {
            console.error('Error logging audit:', error);
        }
    }

    async function getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'Unknown';
        }
    }

    function filterAudit() {
        const searchTerm = document.getElementById('adminAuditSearch')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('adminAuditTypeFilter')?.value || '';
        const moduleFilter = document.getElementById('adminAuditModuleFilter')?.value || '';
        const dateFilter = document.getElementById('adminAuditDateFilter')?.value || '';

        state.filteredAudit = state.auditLogs.filter(log => {
            const matchesSearch = !searchTerm || 
                log.userName?.toLowerCase().includes(searchTerm) ||
                log.details?.toLowerCase().includes(searchTerm);
            
            const matchesType = !typeFilter || log.action === typeFilter;
            const matchesModule = !moduleFilter || log.module === moduleFilter;
            
            let matchesDate = true;
            if (dateFilter && log.timestamp) {
                const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                const filterDate = new Date(dateFilter);
                matchesDate = logDate.toDateString() === filterDate.toDateString();
            }

            return matchesSearch && matchesType && matchesModule && matchesDate;
        });

        state.auditPage = 1;
        renderAuditTable();
    }

    function renderAuditTable() {
        const tbody = document.getElementById('adminAuditTableBody');
        if (!tbody) return;

        const startIdx = (state.auditPage - 1) * state.auditPerPage;
        const endIdx = startIdx + state.auditPerPage;
        const pageData = state.filteredAudit.slice(startIdx, endIdx);

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr class="admin-empty-row">
                    <td colspan="6">
                        <i class="fas fa-clipboard-list"></i>
                        <p>No audit logs found</p>
                    </td>
                </tr>
            `;
            renderAuditPagination();
            return;
        }

        tbody.innerHTML = pageData.map(log => {
            const timestamp = log.timestamp ? formatDateTime(log.timestamp) : 'N/A';
            
            return `
                <tr>
                    <td>${timestamp}</td>
                    <td>${escapeHtml(log.userName || 'System')}</td>
                    <td><span class="admin-audit-action ${log.action}">${capitalizeFirst(log.action)}</span></td>
                    <td>${capitalizeFirst(log.module || '')}</td>
                    <td><span class="admin-audit-details" title="${escapeHtml(log.details || '')}">${escapeHtml(log.details || '')}</span></td>
                    <td>${log.ipAddress || 'N/A'}</td>
                </tr>
            `;
        }).join('');

        renderAuditPagination();
    }

    function renderAuditPagination() {
        const container = document.getElementById('adminAuditPagination');
        if (!container) return;

        const totalPages = Math.ceil(state.filteredAudit.length / state.auditPerPage);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <button onclick="AdminPanel.auditPrevPage()" ${state.auditPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            <span>Page ${state.auditPage} of ${totalPages}</span>
            <button onclick="AdminPanel.auditNextPage()" ${state.auditPage === totalPages ? 'disabled' : ''}>
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    function auditPrevPage() {
        if (state.auditPage > 1) {
            state.auditPage--;
            renderAuditTable();
        }
    }

    function auditNextPage() {
        const totalPages = Math.ceil(state.filteredAudit.length / state.auditPerPage);
        if (state.auditPage < totalPages) {
            state.auditPage++;
            renderAuditTable();
        }
    }

    function exportAuditLog() {
        if (state.filteredAudit.length === 0) {
            showNotification('No audit logs to export', 'warning');
            return;
        }

        const headers = ['Timestamp', 'User', 'Action', 'Module', 'Details', 'IP Address'];
        const rows = state.filteredAudit.map(log => {
            const timestamp = log.timestamp ? formatDateTime(log.timestamp) : 'N/A';
            return [
                timestamp,
                log.userName || 'System',
                log.action || '',
                log.module || '',
                log.details || '',
                log.ipAddress || 'N/A'
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pharmaflow-audit-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        showNotification('Audit log exported successfully', 'success');
    }

    // ============================================
    // Login Sessions
    // ============================================
    function setupSessionsListener() {
        const sessionsRef = collection(db, 'loginSessions');
        const sessionsQuery = query(sessionsRef, orderBy('loginTime', 'desc'), limit(200));

        unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
            state.sessions = [];
            snapshot.forEach((doc) => {
                state.sessions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            state.filteredSessions = [...state.sessions];
            renderSessionsTable();
            
            console.info(`Admin: Loaded ${state.sessions.length} login sessions`);
        }, (error) => {
            console.error('Admin: Error loading sessions:', error);
            renderSessionsTable();
        });
    }

    async function logUserSession(action) {
        try {
            const user = state.currentUser;
            if (!user) return;

            const sessionData = {
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`.trim(),
                userEmail: user.email,
                userRole: user.role,
                ipAddress: await getClientIP(),
                userAgent: navigator.userAgent,
                device: getDeviceType()
            };

            if (action === 'login') {
                sessionData.loginTime = serverTimestamp();
                sessionData.status = 'active';
                const docRef = await addDoc(collection(db, 'loginSessions'), sessionData);
                localStorage.setItem('pharmaflow_session_id', docRef.id);
            } else if (action === 'logout') {
                const sessionId = localStorage.getItem('pharmaflow_session_id');
                if (sessionId) {
                    await updateDoc(doc(db, 'loginSessions', sessionId), {
                        logoutTime: serverTimestamp(),
                        status: 'expired'
                    });
                    localStorage.removeItem('pharmaflow_session_id');
                }
            }
        } catch (error) {
            console.error('Error logging session:', error);
        }
    }

    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/mobile/i.test(ua)) return 'Mobile';
        if (/tablet/i.test(ua)) return 'Tablet';
        return 'Desktop';
    }

    function filterSessions() {
        const searchTerm = document.getElementById('adminSessionSearch')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('adminSessionStatusFilter')?.value || '';

        state.filteredSessions = state.sessions.filter(session => {
            const matchesSearch = !searchTerm || 
                session.userName?.toLowerCase().includes(searchTerm) ||
                session.userEmail?.toLowerCase().includes(searchTerm);
            
            const matchesStatus = !statusFilter || session.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        renderSessionsTable();
    }

    function renderSessionsTable() {
        const tbody = document.getElementById('adminSessionsTableBody');
        if (!tbody) return;

        if (state.filteredSessions.length === 0) {
            tbody.innerHTML = `
                <tr class="admin-empty-row">
                    <td colspan="7">
                        <i class="fas fa-sign-in-alt"></i>
                        <p>No login sessions found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = state.filteredSessions.map(session => {
            const loginTime = session.loginTime ? formatDateTime(session.loginTime) : 'N/A';
            const logoutTime = session.logoutTime ? formatDateTime(session.logoutTime) : '-';
            const duration = calculateDuration(session.loginTime, session.logoutTime);
            
            return `
                <tr>
                    <td>${escapeHtml(session.userName || 'Unknown')}</td>
                    <td>${loginTime}</td>
                    <td>${logoutTime}</td>
                    <td>${duration}</td>
                    <td>${session.ipAddress || 'N/A'}</td>
                    <td>${session.device || 'Unknown'}</td>
                    <td><span class="admin-badge admin-badge-${session.status || 'active'}">${capitalizeFirst(session.status || 'Active')}</span></td>
                </tr>
            `;
        }).join('');
    }

    function calculateDuration(start, end) {
        if (!start) return '-';
        
        const startDate = start.toDate ? start.toDate() : new Date(start);
        const endDate = end ? (end.toDate ? end.toDate() : new Date(end)) : new Date();
        
        const diffMs = endDate - startDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffHours > 0) {
            return `${diffHours}h ${diffMins % 60}m`;
        }
        return `${diffMins}m`;
    }

    // ============================================
    // Permissions Table
    // ============================================
    function renderPermissionsTable() {
        const tbody = document.getElementById('adminPermissionsTableBody');
        if (!tbody) return;

        tbody.innerHTML = MODULES.map(mod => {
            const superPerms = DEFAULT_PERMISSIONS.superadmin[mod.id];
            const adminPerms = DEFAULT_PERMISSIONS.admin[mod.id];
            const staffPerms = DEFAULT_PERMISSIONS.staff[mod.id];

            return `
                <tr>
                    <td><i class="fas ${mod.icon}"></i> ${mod.name}</td>
                    <td>${renderPermissionIcons(superPerms)}</td>
                    <td>${renderPermissionIcons(adminPerms)}</td>
                    <td>${renderPermissionIcons(staffPerms)}</td>
                </tr>
            `;
        }).join('');
    }

    function renderPermissionIcons(perms) {
        if (!perms) return '<i class="fas fa-times admin-perm-x"></i>';
        
        const hasAll = perms.view && perms.create && perms.edit && perms.delete;
        const hasNone = !perms.view && !perms.create && !perms.edit && !perms.delete;
        
        if (hasAll) return '<i class="fas fa-check admin-perm-check"></i>';
        if (hasNone) return '<i class="fas fa-times admin-perm-x"></i>';
        return '<i class="fas fa-minus admin-perm-partial" title="Partial access"></i>';
    }

    // ============================================
    // Tab Navigation
    // ============================================
    function switchTab(tabName) {
        state.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `admin-tab-${tabName}`);
        });
    }

    // ============================================
    // Stats Update
    // ============================================
    function updateStats() {
        const totalUsers = state.users.length;
        const activeUsers = state.users.filter(u => u.status === 'active').length;
        const totalBranches = state.branches.length;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayActivities = state.auditLogs.filter(log => {
            if (!log.timestamp) return false;
            const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
            return logDate >= today;
        }).length;

        const statTotalUsers = document.getElementById('adminTotalUsers');
        const statActiveUsers = document.getElementById('adminActiveUsers');
        const statTotalBranches = document.getElementById('adminTotalBranches');
        const statTodayActivities = document.getElementById('adminTodayActivities');

        if (statTotalUsers) statTotalUsers.textContent = totalUsers;
        if (statActiveUsers) statActiveUsers.textContent = activeUsers;
        if (statTotalBranches) statTotalBranches.textContent = totalBranches;
        if (statTodayActivities) statTodayActivities.textContent = todayActivities;
    }

    // ============================================
    // Utility Functions
    // ============================================
    function closeConfirmModal() {
        document.getElementById('adminConfirmModal').classList.remove('show');
        state.deleteCallback = null;
    }

    function getInitials(firstName, lastName) {
        return ((firstName || '')[0] || '') + ((lastName || '')[0] || '') || 'U';
    }

    function getAvatarColor(role) {
        const colors = {
            superadmin: '#ef4444',
            admin: '#3b82f6',
            staff: '#10b981'
        };
        return colors[role] || '#6b7280';
    }

    function formatDateTime(timestamp) {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.PharmaFlowShowNotification) {
            window.PharmaFlowShowNotification(message, type);
        } else {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            `;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 20px;
                border-radius: 8px;
                background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
                color: white;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transform: translateX(120%);
                transition: transform 0.3s ease;
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.style.transform = 'translateX(0)', 100);
            setTimeout(() => {
                notification.style.transform = 'translateX(120%)';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    // ============================================
    // Cleanup
    // ============================================
    function cleanup() {
        if (unsubscribeUsers) unsubscribeUsers();
        if (unsubscribeBranches) unsubscribeBranches();
        if (unsubscribeAudit) unsubscribeAudit();
        if (unsubscribeSessions) unsubscribeSessions();
    }

    // ============================================
    // Initialize
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('beforeunload', () => {
        logUserSession('logout');
        cleanup();
    });

    // ============================================
    // Public API
    // ============================================
    window.AdminPanel = {
        init,
        cleanup,
        
        // User Management
        openAddUserModal,
        editUser,
        viewUser,
        saveUser,
        confirmDeleteUser,
        closeUserModal,
        closeViewUserModal,
        onRoleChange,
        filterUsers,
        toggleModulePerms,
        
        // Branch Management
        openAddBranchModal,
        editBranch,
        saveBranch,
        confirmDeleteBranch,
        closeBranchModal,
        filterBranches,
        
        // Audit
        filterAudit,
        exportAuditLog,
        auditPrevPage,
        auditNextPage,
        logAudit,
        
        // Sessions
        filterSessions,
        
        // Tabs
        switchTab,
        
        // Modals
        closeConfirmModal,
        
        // RBAC
        getCurrentUser,
        hasPermission,
        applyRoleBasedAccess,
        
        // Stats
        getStats: () => ({
            totalUsers: state.users.length,
            activeUsers: state.users.filter(u => u.status === 'active').length,
            totalBranches: state.branches.length
        })
    };

    // Global RBAC helper for other modules
    window.PharmaFlowRBAC = {
        hasPermission,
        getCurrentUser,
        applyRoleBasedAccess,
        logAudit
    };

    // Backward compatibility
    window.PharmaFlowAdmin = window.AdminPanel;

})(window, document);
