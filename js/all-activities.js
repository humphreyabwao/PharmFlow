/**
 * PharmaFlow - All Activities Module
 * Complete activity history with filtering, pagination, and export
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    getDocs,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // Activity Types Configuration
    // ============================================
    const ACTIVITY_TYPES = {
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
    // State Management
    // ============================================
    const state = {
        activities: [],
        filteredActivities: [],
        currentPage: 1,
        pageSize: 25,
        totalPages: 1,
        sortField: 'createdAt',
        sortDirection: 'desc',
        filters: {
            type: '',
            status: '',
            dateFrom: null,
            dateTo: null,
            search: ''
        },
        selectedActivity: null,
        unsubscribe: null
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Filters
            typeFilter: document.getElementById('activityTypeFilter'),
            statusFilter: document.getElementById('activityStatusFilter'),
            dateFromFilter: document.getElementById('activityDateFrom'),
            dateToFilter: document.getElementById('activityDateTo'),
            searchInput: document.getElementById('activitySearchInput'),
            clearFiltersBtn: document.getElementById('clearActivityFiltersBtn'),

            // Stats
            completedCount: document.getElementById('completedActivitiesCount'),
            pendingCount: document.getElementById('pendingActivitiesCount'),
            todayCount: document.getElementById('todayActivitiesCount'),
            totalCount: document.getElementById('totalActivitiesCount'),

            // Table
            tableWrapper: document.getElementById('activitiesTableWrapper'),
            tableBody: document.getElementById('allActivitiesTableBody'),
            loadingState: document.getElementById('activitiesLoadingState'),
            emptyState: document.getElementById('activitiesEmptyState'),

            // Pagination
            showingFrom: document.getElementById('activitiesShowingFrom'),
            showingTo: document.getElementById('activitiesShowingTo'),
            totalCountPagination: document.getElementById('activitiesTotalCount'),
            prevBtn: document.getElementById('activitiesPrevBtn'),
            nextBtn: document.getElementById('activitiesNextBtn'),
            paginationPages: document.getElementById('activitiesPaginationPages'),
            pageSize: document.getElementById('activitiesPageSize'),

            // Actions
            refreshBtn: document.getElementById('refreshActivitiesBtn'),
            exportBtn: document.getElementById('exportActivitiesBtn'),

            // Modal
            detailsModal: document.getElementById('activityDetailsModal'),
            detailsContent: document.getElementById('activityDetailsContent'),
            closeDetailsModal: document.getElementById('closeActivityDetailsModal'),
            closeDetailsBtn: document.getElementById('closeActivityDetailsBtn'),
            goToModuleBtn: document.getElementById('goToActivityModuleBtn')
        };
    }

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        cacheElements();
        bindEvents();
        setupRealtimeListener();
        console.info('PharmaFlow All Activities module initialized.');
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        // Filters
        if (elements.typeFilter) {
            elements.typeFilter.addEventListener('change', handleFilterChange);
        }
        if (elements.statusFilter) {
            elements.statusFilter.addEventListener('change', handleFilterChange);
        }
        if (elements.dateFromFilter) {
            elements.dateFromFilter.addEventListener('change', handleFilterChange);
        }
        if (elements.dateToFilter) {
            elements.dateToFilter.addEventListener('change', handleFilterChange);
        }
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce(handleSearchChange, 300));
        }
        if (elements.clearFiltersBtn) {
            elements.clearFiltersBtn.addEventListener('click', clearFilters);
        }

        // Pagination
        if (elements.prevBtn) {
            elements.prevBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
        }
        if (elements.nextBtn) {
            elements.nextBtn.addEventListener('click', () => goToPage(state.currentPage + 1));
        }
        if (elements.pageSize) {
            elements.pageSize.addEventListener('change', handlePageSizeChange);
        }

        // Actions
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', handleRefresh);
        }
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', handleExport);
        }

        // Modal
        if (elements.closeDetailsModal) {
            elements.closeDetailsModal.addEventListener('click', closeDetailsModal);
        }
        if (elements.closeDetailsBtn) {
            elements.closeDetailsBtn.addEventListener('click', closeDetailsModal);
        }
        if (elements.goToModuleBtn) {
            elements.goToModuleBtn.addEventListener('click', handleGoToModule);
        }
        if (elements.detailsModal) {
            elements.detailsModal.addEventListener('click', (e) => {
                if (e.target === elements.detailsModal) {
                    closeDetailsModal();
                }
            });
        }

        // Sortable headers
        document.querySelectorAll('#allActivitiesTable th.sortable').forEach(th => {
            th.addEventListener('click', () => handleSort(th.dataset.sort));
        });
    }

    // ============================================
    // Real-time Listener
    // ============================================
    function setupRealtimeListener() {
        // Only show loading on initial load
        if (state.activities.length === 0) {
            showLoading();
        }

        try {
            const activitiesRef = collection(db, 'activities');
            const activitiesQuery = query(
                activitiesRef,
                orderBy('createdAt', 'desc'),
                limit(500)
            );

            state.unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
                const newActivities = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    newActivities.push({
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

                // Only update if data has changed
                state.activities = newActivities;
                applyFilters();
                updateStats();
                hideLoading();

                console.info(`All Activities: Loaded ${state.activities.length} activities`);
            }, (error) => {
                console.error('All Activities: Error listening to activities:', error);
                hideLoading();
                if (state.activities.length === 0) {
                    showEmpty();
                }
            });
        } catch (error) {
            console.error('All Activities: Failed to setup listener:', error);
            hideLoading();
            if (state.activities.length === 0) {
                showEmpty();
            }
        }
    }

    // ============================================
    // Filter Handling
    // ============================================
    function handleFilterChange() {
        state.filters.type = elements.typeFilter?.value || '';
        state.filters.status = elements.statusFilter?.value || '';
        state.filters.dateFrom = elements.dateFromFilter?.value ? new Date(elements.dateFromFilter.value) : null;
        state.filters.dateTo = elements.dateToFilter?.value ? new Date(elements.dateToFilter.value + 'T23:59:59') : null;
        
        state.currentPage = 1;
        applyFilters();
    }

    function handleSearchChange(e) {
        state.filters.search = e.target.value.toLowerCase().trim();
        state.currentPage = 1;
        applyFilters();
    }

    function clearFilters() {
        state.filters = {
            type: '',
            status: '',
            dateFrom: null,
            dateTo: null,
            search: ''
        };

        if (elements.typeFilter) elements.typeFilter.value = '';
        if (elements.statusFilter) elements.statusFilter.value = '';
        if (elements.dateFromFilter) elements.dateFromFilter.value = '';
        if (elements.dateToFilter) elements.dateToFilter.value = '';
        if (elements.searchInput) elements.searchInput.value = '';

        state.currentPage = 1;
        applyFilters();
    }

    function applyFilters() {
        let filtered = [...state.activities];

        // Type filter
        if (state.filters.type) {
            filtered = filtered.filter(a => a.type === state.filters.type);
        }

        // Status filter
        if (state.filters.status) {
            filtered = filtered.filter(a => a.status === state.filters.status);
        }

        // Date range filter
        if (state.filters.dateFrom) {
            filtered = filtered.filter(a => {
                const activityDate = getActivityDate(a.createdAt);
                return activityDate >= state.filters.dateFrom;
            });
        }
        if (state.filters.dateTo) {
            filtered = filtered.filter(a => {
                const activityDate = getActivityDate(a.createdAt);
                return activityDate <= state.filters.dateTo;
            });
        }

        // Search filter
        if (state.filters.search) {
            const searchTerm = state.filters.search;
            filtered = filtered.filter(a => 
                (a.action && a.action.toLowerCase().includes(searchTerm)) ||
                (a.description && a.description.toLowerCase().includes(searchTerm)) ||
                (a.user && a.user.toLowerCase().includes(searchTerm)) ||
                (a.type && a.type.toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        filtered = sortActivities(filtered);

        state.filteredActivities = filtered;
        state.totalPages = Math.ceil(filtered.length / state.pageSize) || 1;
        
        if (state.currentPage > state.totalPages) {
            state.currentPage = state.totalPages;
        }

        renderTable();
        updatePagination();
    }

    function sortActivities(activities) {
        return activities.sort((a, b) => {
            let valA, valB;

            if (state.sortField === 'createdAt' || state.sortField === 'time') {
                valA = getActivityDate(a.createdAt)?.getTime() || 0;
                valB = getActivityDate(b.createdAt)?.getTime() || 0;
            } else if (state.sortField === 'amount') {
                valA = parseFloat(a.amount) || 0;
                valB = parseFloat(b.amount) || 0;
            } else {
                valA = a[state.sortField] || '';
                valB = b[state.sortField] || '';
            }

            if (state.sortDirection === 'asc') {
                return valA > valB ? 1 : -1;
            } else {
                return valA < valB ? 1 : -1;
            }
        });
    }

    function handleSort(field) {
        if (state.sortField === field) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortField = field;
            state.sortDirection = 'desc';
        }

        // Update sort icons
        document.querySelectorAll('#allActivitiesTable th.sortable').forEach(th => {
            const icon = th.querySelector('i');
            if (th.dataset.sort === field) {
                icon.className = state.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            } else {
                icon.className = 'fas fa-sort';
            }
        });

        applyFilters();
    }

    // ============================================
    // Render Table
    // ============================================
    function renderTable() {
        if (!elements.tableBody) return;

        const startIndex = (state.currentPage - 1) * state.pageSize;
        const endIndex = startIndex + state.pageSize;
        const pageActivities = state.filteredActivities.slice(startIndex, endIndex);

        if (pageActivities.length === 0) {
            elements.tableBody.innerHTML = '';
            if (state.activities.length === 0) {
                showEmpty();
            } else {
                // Show "no results" for filtered empty state
                elements.tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 40px;">
                            <i class="fas fa-search" style="font-size: 32px; color: var(--border-color); margin-bottom: 12px; display: block;"></i>
                            <p style="color: var(--text-secondary);">No activities match your filters</p>
                        </td>
                    </tr>
                `;
                hideEmpty();
            }
            return;
        }

        hideEmpty();

        let html = '';
        pageActivities.forEach((activity, index) => {
            const typeInfo = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.system;
            const timeDisplay = formatDateTime(activity.createdAt);
            const timeAgo = formatTimeAgo(activity.createdAt);
            const statusClass = getStatusClass(activity.status);
            const amountDisplay = activity.amount !== null ? `KSH ${parseFloat(activity.amount).toFixed(2)}` : '-';

            html += `
                <tr class="activity-row" data-id="${activity.id}" data-index="${startIndex + index}">
                    <td data-label="Time">
                        <div class="time-cell">
                            <span class="time-display">${timeDisplay}</span>
                            <span class="time-ago">${timeAgo}</span>
                        </div>
                    </td>
                    <td data-label="Type">
                        <span class="activity-type-badge ${typeInfo.color}">
                            <i class="fas ${typeInfo.icon}"></i>
                            ${typeInfo.label}
                        </span>
                    </td>
                    <td data-label="Action">
                        <strong>${escapeHtml(activity.action)}</strong>
                    </td>
                    <td data-label="Description">
                        <span class="activity-description">${escapeHtml(activity.description)}</span>
                    </td>
                    <td data-label="User">
                        <span class="activity-user">
                            <i class="fas fa-user"></i>
                            ${escapeHtml(activity.user)}
                        </span>
                    </td>
                    <td data-label="Amount" class="amount-cell">
                        ${amountDisplay}
                    </td>
                    <td data-label="Status">
                        <span class="status-badge ${statusClass}">${capitalizeFirst(activity.status)}</span>
                    </td>
                    <td data-label="Actions">
                        <div class="action-buttons">
                            <button class="action-btn view-btn" title="View Details" data-id="${activity.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${activity.module ? `
                                <button class="action-btn go-btn" title="Go to Module" data-module="${activity.module}">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        elements.tableBody.innerHTML = html;

        // Bind action button events
        elements.tableBody.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const activity = state.activities.find(a => a.id === id);
                if (activity) {
                    showActivityDetails(activity);
                }
            });
        });

        elements.tableBody.querySelectorAll('.go-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const module = btn.dataset.module;
                if (module && window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                    window.PharmaFlow.setActiveModule(module);
                }
            });
        });

        // Row click for details
        elements.tableBody.querySelectorAll('.activity-row').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                const activity = state.activities.find(a => a.id === id);
                if (activity) {
                    showActivityDetails(activity);
                }
            });
        });
    }

    // ============================================
    // Pagination
    // ============================================
    function updatePagination() {
        const total = state.filteredActivities.length;
        const startIndex = (state.currentPage - 1) * state.pageSize + 1;
        const endIndex = Math.min(state.currentPage * state.pageSize, total);

        if (elements.showingFrom) elements.showingFrom.textContent = total > 0 ? startIndex : 0;
        if (elements.showingTo) elements.showingTo.textContent = endIndex;
        if (elements.totalCountPagination) elements.totalCountPagination.textContent = total;

        if (elements.prevBtn) elements.prevBtn.disabled = state.currentPage <= 1;
        if (elements.nextBtn) elements.nextBtn.disabled = state.currentPage >= state.totalPages;

        renderPaginationPages();
    }

    function renderPaginationPages() {
        if (!elements.paginationPages) return;

        let html = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(state.totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            html += `<button class="pagination-page" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === state.currentPage ? 'active' : '';
            html += `<button class="pagination-page ${activeClass}" data-page="${i}">${i}</button>`;
        }

        if (endPage < state.totalPages) {
            if (endPage < state.totalPages - 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
            html += `<button class="pagination-page" data-page="${state.totalPages}">${state.totalPages}</button>`;
        }

        elements.paginationPages.innerHTML = html;

        // Bind page click events
        elements.paginationPages.querySelectorAll('.pagination-page').forEach(btn => {
            btn.addEventListener('click', () => {
                goToPage(parseInt(btn.dataset.page));
            });
        });
    }

    function goToPage(page) {
        if (page < 1 || page > state.totalPages) return;
        state.currentPage = page;
        renderTable();
        updatePagination();

        // Scroll to top of table
        if (elements.tableWrapper) {
            elements.tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function handlePageSizeChange() {
        state.pageSize = parseInt(elements.pageSize.value) || 25;
        state.currentPage = 1;
        state.totalPages = Math.ceil(state.filteredActivities.length / state.pageSize) || 1;
        renderTable();
        updatePagination();
    }

    // ============================================
    // Update Stats
    // ============================================
    function updateStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completed = state.activities.filter(a => a.status === 'completed').length;
        const pending = state.activities.filter(a => a.status === 'pending').length;
        const todayActivities = state.activities.filter(a => {
            const activityDate = getActivityDate(a.createdAt);
            return activityDate && activityDate >= today;
        }).length;

        if (elements.completedCount) elements.completedCount.textContent = completed;
        if (elements.pendingCount) elements.pendingCount.textContent = pending;
        if (elements.todayCount) elements.todayCount.textContent = todayActivities;
        if (elements.totalCount) elements.totalCount.textContent = state.activities.length;
    }

    // ============================================
    // Activity Details Modal
    // ============================================
    function showActivityDetails(activity) {
        state.selectedActivity = activity;
        const typeInfo = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.system;
        const timeDisplay = formatDateTime(activity.createdAt);
        const statusClass = getStatusClass(activity.status);
        const amountDisplay = activity.amount !== null ? `KSH ${parseFloat(activity.amount).toFixed(2)}` : 'N/A';

        const html = `
            <div class="activity-detail-card">
                <div class="detail-header">
                    <span class="activity-type-badge large ${typeInfo.color}">
                        <i class="fas ${typeInfo.icon}"></i>
                        ${typeInfo.label}
                    </span>
                    <span class="status-badge ${statusClass}">${capitalizeFirst(activity.status)}</span>
                </div>
                
                <div class="detail-section">
                    <h4>Activity Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Action</label>
                            <span>${escapeHtml(activity.action)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Description</label>
                            <span>${escapeHtml(activity.description)}</span>
                        </div>
                        <div class="detail-item">
                            <label>User</label>
                            <span><i class="fas fa-user"></i> ${escapeHtml(activity.user)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Amount</label>
                            <span class="amount">${amountDisplay}</span>
                        </div>
                        <div class="detail-item">
                            <label>Date & Time</label>
                            <span>${timeDisplay}</span>
                        </div>
                        <div class="detail-item">
                            <label>Module</label>
                            <span>${activity.module || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                ${Object.keys(activity.data || {}).length > 0 ? `
                    <div class="detail-section">
                        <h4>Additional Data</h4>
                        <div class="detail-data">
                            <pre>${JSON.stringify(activity.data, null, 2)}</pre>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        if (elements.detailsContent) {
            elements.detailsContent.innerHTML = html;
        }

        if (elements.goToModuleBtn) {
            elements.goToModuleBtn.style.display = activity.module ? 'inline-flex' : 'none';
        }

        if (elements.detailsModal) {
            elements.detailsModal.classList.add('show');
        }
    }

    function closeDetailsModal() {
        if (elements.detailsModal) {
            elements.detailsModal.classList.remove('show');
        }
        state.selectedActivity = null;
    }

    function handleGoToModule() {
        if (state.selectedActivity && state.selectedActivity.module) {
            closeDetailsModal();
            if (window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                window.PharmaFlow.setActiveModule(state.selectedActivity.module);
            }
        }
    }

    // ============================================
    // Export Functionality
    // ============================================
    function handleExport() {
        if (state.filteredActivities.length === 0) {
            showToast('No activities to export', 'warning');
            return;
        }

        try {
            const csvContent = generateCSV();
            downloadCSV(csvContent, `activities_${formatDateForFilename(new Date())}.csv`);
            showToast('Activities exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Failed to export activities', 'error');
        }
    }

    function generateCSV() {
        const headers = ['Date/Time', 'Type', 'Action', 'Description', 'User', 'Amount', 'Status', 'Module'];
        const rows = state.filteredActivities.map(activity => {
            return [
                formatDateTime(activity.createdAt),
                activity.type,
                activity.action,
                activity.description,
                activity.user,
                activity.amount !== null ? activity.amount : '',
                activity.status,
                activity.module
            ].map(val => `"${String(val).replace(/"/g, '""')}"`);
        });

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    function downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ============================================
    // Refresh
    // ============================================
    function handleRefresh() {
        const icon = elements.refreshBtn?.querySelector('i');
        if (icon) {
            icon.classList.add('fa-spin');
        }

        // Re-apply filters to refresh the view
        applyFilters();
        updateStats();

        setTimeout(() => {
            if (icon) {
                icon.classList.remove('fa-spin');
            }
            showToast('Activities refreshed', 'success');
        }, 500);
    }

    // ============================================
    // Loading & Empty States
    // ============================================
    function showLoading() {
        if (elements.loadingState) {
            elements.loadingState.style.display = 'flex';
        }
        if (elements.emptyState) {
            elements.emptyState.style.display = 'none';
        }
        if (elements.tableWrapper) {
            elements.tableWrapper.style.display = 'none';
        }
    }

    function hideLoading() {
        if (elements.loadingState) {
            elements.loadingState.style.display = 'none';
        }
        if (elements.tableWrapper) {
            elements.tableWrapper.style.display = 'block';
        }
    }

    function showEmpty() {
        if (elements.emptyState) {
            elements.emptyState.style.display = 'flex';
        }
        if (elements.tableWrapper) {
            elements.tableWrapper.style.display = 'none';
        }
    }

    function hideEmpty() {
        if (elements.emptyState) {
            elements.emptyState.style.display = 'none';
        }
        if (elements.tableWrapper) {
            elements.tableWrapper.style.display = 'block';
        }
    }

    // ============================================
    // Helper Functions
    // ============================================
    function getActivityDate(timestamp) {
        if (!timestamp) return null;
        if (timestamp.toDate) return timestamp.toDate();
        if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
        return new Date(timestamp);
    }

    function formatDateTime(timestamp) {
        const date = getActivityDate(timestamp);
        if (!date) return 'N/A';
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatTimeAgo(timestamp) {
        const date = getActivityDate(timestamp);
        if (!date) return '';

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
        
        return '';
    }

    function formatDateForFilename(date) {
        return date.toISOString().split('T')[0];
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

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function showToast(message, type = 'info') {
        if (window.PharmaFlowNotifications && window.PharmaFlowNotifications.showToast) {
            window.PharmaFlowNotifications.showToast(message, type);
        } else {
            console.info(`${type}: ${message}`);
        }
    }

    // ============================================
    // Cleanup
    // ============================================
    function cleanup() {
        if (state.unsubscribe) {
            state.unsubscribe();
            state.unsubscribe = null;
        }
    }

    // ============================================
    // Public API
    // ============================================
    const api = {
        init,
        cleanup,
        refresh: handleRefresh,
        getActivities: () => [...state.activities],
        getFilteredActivities: () => [...state.filteredActivities]
    };

    window.PharmaFlowAllActivities = api;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

})(window, document);
