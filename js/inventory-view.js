/**
 * PharmaFlow View Inventory Module
 * Real-time inventory display with Firebase Firestore
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy,
    doc,
    deleteDoc,
    updateDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // State Management
    // ============================================
    const state = {
        inventory: [],
        filteredInventory: [],
        unsubscribe: null,
        currentPage: 1,
        itemsPerPage: 50,
        searchTerm: '',
        filterCategory: '',
        filterStatus: '',
        sortBy: 'name-asc',
        isLoading: true,
        // Import state
        importData: [],
        importErrors: [],
        validImportItems: [],
        // Edit state
        currentViewItem: null,
        currentEditItem: null
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Stats
            statTotalItems: document.getElementById('statTotalItems'),
            statInStock: document.getElementById('statInStock'),
            statLowStock: document.getElementById('statLowStock'),
            statOutOfStock: document.getElementById('statOutOfStock'),
            statExpiring: document.getElementById('statExpiring'),
            statTotalValue: document.getElementById('statTotalValue'),

            // Toolbar
            searchInput: document.getElementById('inventorySearch'),
            clearSearch: document.getElementById('clearSearch'),
            filterCategory: document.getElementById('filterCategory'),
            filterStatus: document.getElementById('filterStatus'),
            sortBy: document.getElementById('sortBy'),
            exportBtn: document.getElementById('exportInventory'),
            refreshBtn: document.getElementById('refreshInventory'),
            refreshIcon: document.getElementById('refreshIcon'),
            goToAddBtn: document.getElementById('goToAddInventory'),
            bulkImportBtn: document.getElementById('bulkImportInventory'),

            // Table
            tableBody: document.getElementById('inventoryTableBody'),
            tableEmpty: document.getElementById('tableEmpty'),
            tableLoading: document.getElementById('tableLoading'),

            // Pagination
            paginationInfo: document.getElementById('paginationInfo'),
            itemsPerPage: document.getElementById('itemsPerPage'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            pageNumbers: document.getElementById('pageNumbers'),

            // Import Modal
            importModal: document.getElementById('bulkImportModal'),
            closeImportModal: document.getElementById('closeImportModal'),
            importDropzone: document.getElementById('importDropzone'),
            importFileInput: document.getElementById('importFileInput'),
            downloadTemplate: document.getElementById('downloadTemplate'),
            importUploadSection: document.getElementById('importUploadSection'),
            importPreviewSection: document.getElementById('importPreviewSection'),
            importProgressSection: document.getElementById('importProgressSection'),
            importSuccessSection: document.getElementById('importSuccessSection'),
            importPreviewHead: document.getElementById('importPreviewHead'),
            importPreviewBody: document.getElementById('importPreviewBody'),
            validCount: document.getElementById('validCount'),
            errorCount: document.getElementById('errorCount'),
            totalCount: document.getElementById('totalCount'),
            importErrorList: document.getElementById('importErrorList'),
            errorListItems: document.getElementById('errorListItems'),
            importProgressBar: document.getElementById('importProgressBar'),
            importedCount: document.getElementById('importedCount'),
            totalImportCount: document.getElementById('totalImportCount'),
            successCount: document.getElementById('successCount'),
            cancelImport: document.getElementById('cancelImport'),
            backToUpload: document.getElementById('backToUpload'),
            startImport: document.getElementById('startImport'),
            importBtnCount: document.getElementById('importBtnCount'),
            doneImport: document.getElementById('doneImport'),
            importModalFooter: document.getElementById('importModalFooter'),

            // View Item Modal
            viewModal: document.getElementById('viewItemModal'),
            closeViewModal: document.getElementById('closeViewModal'),
            viewItemBody: document.getElementById('viewItemBody'),
            closeViewBtn: document.getElementById('closeViewBtn'),
            editFromViewBtn: document.getElementById('editFromViewBtn'),

            // Edit Item Modal
            editModal: document.getElementById('editItemModal'),
            closeEditModal: document.getElementById('closeEditModal'),
            editItemForm: document.getElementById('editItemForm'),
            editItemId: document.getElementById('editItemId'),
            editName: document.getElementById('editName'),
            editGenericName: document.getElementById('editGenericName'),
            editCategory: document.getElementById('editCategory'),
            editDosageForm: document.getElementById('editDosageForm'),
            editStrength: document.getElementById('editStrength'),
            editManufacturer: document.getElementById('editManufacturer'),
            editQuantity: document.getElementById('editQuantity'),
            editUnit: document.getElementById('editUnit'),
            editCostPrice: document.getElementById('editCostPrice'),
            editSellingPrice: document.getElementById('editSellingPrice'),
            editReorderLevel: document.getElementById('editReorderLevel'),
            editBarcode: document.getElementById('editBarcode'),
            editBatchNumber: document.getElementById('editBatchNumber'),
            editExpiryDate: document.getElementById('editExpiryDate'),
            editManufactureDate: document.getElementById('editManufactureDate'),
            editLocation: document.getElementById('editLocation'),
            editSupplier: document.getElementById('editSupplier'),
            editDescription: document.getElementById('editDescription'),
            editPrescriptionRequired: document.getElementById('editPrescriptionRequired'),
            cancelEditBtn: document.getElementById('cancelEditBtn'),
            saveEditBtn: document.getElementById('saveEditBtn')
        };
    }

    // ============================================
    // Initialize
    // ============================================
    function init() {
        cacheElements();
        bindEvents();
        startRealtimeListener();
        console.info('PharmaFlow View Inventory module initialized.');
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        // Search
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
        }
        if (elements.clearSearch) {
            elements.clearSearch.addEventListener('click', clearSearch);
        }

        // Filters
        if (elements.filterCategory) {
            elements.filterCategory.addEventListener('change', handleFilterChange);
        }
        if (elements.filterStatus) {
            elements.filterStatus.addEventListener('change', handleFilterChange);
        }
        if (elements.sortBy) {
            elements.sortBy.addEventListener('change', handleSortChange);
        }

        // Toolbar actions
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportToCSV);
        }
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', refreshData);
        }
        if (elements.goToAddBtn) {
            elements.goToAddBtn.addEventListener('click', navigateToAddInventory);
        }

        // Pagination
        if (elements.itemsPerPage) {
            elements.itemsPerPage.addEventListener('change', handleItemsPerPageChange);
        }
        if (elements.prevPage) {
            elements.prevPage.addEventListener('click', goToPrevPage);
        }
        if (elements.nextPage) {
            elements.nextPage.addEventListener('click', goToNextPage);
        }

        // Table actions (event delegation)
        if (elements.tableBody) {
            elements.tableBody.addEventListener('click', handleTableAction);
        }

        // Bulk Import
        if (elements.bulkImportBtn) {
            elements.bulkImportBtn.addEventListener('click', openImportModal);
        }
        if (elements.closeImportModal) {
            elements.closeImportModal.addEventListener('click', closeImportModal);
        }
        if (elements.importModal) {
            elements.importModal.addEventListener('click', (e) => {
                if (e.target === elements.importModal) {
                    closeImportModal();
                }
            });
        }
        if (elements.importDropzone) {
            elements.importDropzone.addEventListener('click', () => elements.importFileInput?.click());
            elements.importDropzone.addEventListener('dragover', handleDragOver);
            elements.importDropzone.addEventListener('dragleave', handleDragLeave);
            elements.importDropzone.addEventListener('drop', handleFileDrop);
        }
        if (elements.importFileInput) {
            elements.importFileInput.addEventListener('change', handleFileSelect);
        }
        if (elements.downloadTemplate) {
            elements.downloadTemplate.addEventListener('click', downloadCSVTemplate);
        }
        if (elements.cancelImport) {
            elements.cancelImport.addEventListener('click', closeImportModal);
        }
        if (elements.backToUpload) {
            elements.backToUpload.addEventListener('click', showUploadSection);
        }
        if (elements.startImport) {
            elements.startImport.addEventListener('click', executeImport);
        }
        if (elements.doneImport) {
            elements.doneImport.addEventListener('click', closeImportModal);
        }

        // View Item Modal
        if (elements.closeViewModal) {
            elements.closeViewModal.addEventListener('click', closeViewModal);
        }
        if (elements.closeViewBtn) {
            elements.closeViewBtn.addEventListener('click', closeViewModal);
        }
        if (elements.editFromViewBtn) {
            elements.editFromViewBtn.addEventListener('click', editFromView);
        }
        if (elements.viewModal) {
            elements.viewModal.addEventListener('click', (e) => {
                if (e.target === elements.viewModal) {
                    closeViewModal();
                }
            });
        }

        // Edit Item Modal
        if (elements.closeEditModal) {
            elements.closeEditModal.addEventListener('click', closeEditModal);
        }
        if (elements.cancelEditBtn) {
            elements.cancelEditBtn.addEventListener('click', closeEditModal);
        }
        if (elements.saveEditBtn) {
            elements.saveEditBtn.addEventListener('click', saveEditedItem);
        }
        if (elements.editModal) {
            elements.editModal.addEventListener('click', (e) => {
                if (e.target === elements.editModal) {
                    closeEditModal();
                }
            });
        }
        if (elements.editItemForm) {
            elements.editItemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveEditedItem();
            });
        }
    }

    // ============================================
    // Firestore Real-time Listener
    // ============================================
    function startRealtimeListener() {
        const inventoryRef = collection(db, 'inventory');
        const inventoryQuery = query(inventoryRef, orderBy('createdAt', 'desc'));

        state.unsubscribe = onSnapshot(inventoryQuery, (snapshot) => {
            state.inventory = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                state.inventory.push({
                    id: doc.id,
                    ...data,
                    // Recalculate status
                    status: calculateStatus(data)
                });
            });

            state.isLoading = false;
            applyFiltersAndSort();
            updateStats();
            console.info(`View Inventory updated: ${state.inventory.length} items`);
        }, (error) => {
            console.error('Error listening to inventory:', error);
            state.isLoading = false;
            showError('Failed to load inventory. Please refresh the page.');
        });
    }

    // ============================================
    // Status Calculation
    // ============================================
    function calculateStatus(item) {
        const quantity = parseInt(item.quantity) || 0;
        const reorderLevel = parseInt(item.reorderLevel) || 10;
        const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (item.isDraft) return 'draft';
        if (expiryDate && expiryDate < today) return 'expired';
        if (expiryDate && expiryDate <= thirtyDaysFromNow) return 'near-expiry';
        if (quantity <= 0) return 'out-of-stock';
        if (quantity <= reorderLevel) return 'low-stock';
        return 'in-stock';
    }

    // ============================================
    // Stats Update
    // ============================================
    function updateStats() {
        const stats = {
            total: state.inventory.length,
            inStock: 0,
            lowStock: 0,
            outOfStock: 0,
            expiring: 0,
            totalValue: 0
        };

        state.inventory.forEach(item => {
            const status = item.status;
            const quantity = parseInt(item.quantity) || 0;
            const sellingPrice = parseFloat(item.sellingPrice) || 0;

            if (status === 'in-stock') stats.inStock++;
            else if (status === 'low-stock') stats.lowStock++;
            else if (status === 'out-of-stock') stats.outOfStock++;
            
            if (status === 'near-expiry' || status === 'expired') stats.expiring++;

            stats.totalValue += quantity * sellingPrice;
        });

        // Update DOM
        if (elements.statTotalItems) elements.statTotalItems.textContent = formatNumber(stats.total);
        if (elements.statInStock) elements.statInStock.textContent = formatNumber(stats.inStock);
        if (elements.statLowStock) elements.statLowStock.textContent = formatNumber(stats.lowStock);
        if (elements.statOutOfStock) elements.statOutOfStock.textContent = formatNumber(stats.outOfStock);
        if (elements.statExpiring) elements.statExpiring.textContent = formatNumber(stats.expiring);
        if (elements.statTotalValue) elements.statTotalValue.textContent = formatCurrencyCompact(stats.totalValue);
    }

    // ============================================
    // Filtering & Sorting
    // ============================================
    function applyFiltersAndSort() {
        let filtered = [...state.inventory];

        // Search filter
        if (state.searchTerm) {
            const term = state.searchTerm.toLowerCase();
            filtered = filtered.filter(item => 
                (item.name && item.name.toLowerCase().includes(term)) ||
                (item.genericName && item.genericName.toLowerCase().includes(term)) ||
                (item.barcode && item.barcode.toLowerCase().includes(term)) ||
                (item.category && item.category.toLowerCase().includes(term)) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(term))
            );
        }

        // Category filter
        if (state.filterCategory) {
            filtered = filtered.filter(item => item.category === state.filterCategory);
        }

        // Status filter
        if (state.filterStatus) {
            filtered = filtered.filter(item => item.status === state.filterStatus);
        }

        // Sorting
        filtered = sortInventory(filtered, state.sortBy);

        state.filteredInventory = filtered;
        state.currentPage = 1;
        renderTable();
        updatePagination();
    }

    function sortInventory(items, sortBy) {
        const [field, direction] = sortBy.split('-');
        const multiplier = direction === 'asc' ? 1 : -1;

        return items.sort((a, b) => {
            let valueA, valueB;

            switch (field) {
                case 'name':
                    valueA = (a.name || '').toLowerCase();
                    valueB = (b.name || '').toLowerCase();
                    return valueA.localeCompare(valueB) * multiplier;
                case 'quantity':
                    valueA = parseInt(a.quantity) || 0;
                    valueB = parseInt(b.quantity) || 0;
                    break;
                case 'expiry':
                    valueA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
                    valueB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
                    break;
                case 'price':
                    valueA = parseFloat(a.sellingPrice) || 0;
                    valueB = parseFloat(b.sellingPrice) || 0;
                    break;
                default:
                    return 0;
            }

            return (valueA - valueB) * multiplier;
        });
    }

    // ============================================
    // Table Rendering
    // ============================================
    function renderTable() {
        if (!elements.tableBody) return;

        // Hide loading
        if (elements.tableLoading) {
            elements.tableLoading.style.display = 'none';
        }

        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const pageItems = state.filteredInventory.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
            elements.tableBody.innerHTML = '';
            if (elements.tableEmpty) {
                elements.tableEmpty.style.display = 'block';
            }
            return;
        }

        if (elements.tableEmpty) {
            elements.tableEmpty.style.display = 'none';
        }

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();

        pageItems.forEach(item => {
            const row = createTableRow(item);
            fragment.appendChild(row);
        });

        elements.tableBody.innerHTML = '';
        elements.tableBody.appendChild(fragment);
    }

    function createTableRow(item) {
        const tr = document.createElement('tr');
        tr.dataset.id = item.id;

        const statusClass = item.status || 'in-stock';
        const statusLabel = formatStatusLabel(item.status);

        tr.innerHTML = `
            <td class="col-name">
                <div class="product-cell">
                    <span class="product-name">${escapeHtml(item.name || 'N/A')}</span>
                    ${item.genericName ? `<span class="product-generic">${escapeHtml(item.genericName)}</span>` : ''}
                </div>
            </td>
            <td class="col-category">${formatCategory(item.category)}</td>
            <td class="col-barcode">
                <span class="barcode-cell">${escapeHtml(item.barcode || '-')}</span>
            </td>
            <td class="col-quantity">
                <div class="quantity-cell">
                    <span class="quantity-value">${item.quantity || 0}</span>
                    <span class="quantity-unit">${item.unit || 'pcs'}</span>
                </div>
            </td>
            <td class="col-price">
                <span class="price-cell">${formatCurrency(item.sellingPrice)}</span>
            </td>
            <td class="col-expiry">${formatDate(item.expiryDate)}</td>
            <td class="col-status">
                <span class="status-badge ${statusClass}">${statusLabel}</span>
            </td>
            <td class="col-actions">
                <div class="action-buttons">
                    <button class="action-btn view" data-action="view" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" data-action="edit" title="Edit Item">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" data-action="delete" title="Delete Item">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        return tr;
    }

    // ============================================
    // Pagination
    // ============================================
    function updatePagination() {
        const totalItems = state.filteredInventory.length;
        const totalPages = Math.ceil(totalItems / state.itemsPerPage);
        const startItem = totalItems === 0 ? 0 : (state.currentPage - 1) * state.itemsPerPage + 1;
        const endItem = Math.min(state.currentPage * state.itemsPerPage, totalItems);

        // Update info
        if (elements.paginationInfo) {
            elements.paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} items`;
        }

        // Update buttons
        if (elements.prevPage) {
            elements.prevPage.disabled = state.currentPage <= 1;
        }
        if (elements.nextPage) {
            elements.nextPage.disabled = state.currentPage >= totalPages;
        }

        // Update page numbers
        if (elements.pageNumbers) {
            elements.pageNumbers.innerHTML = generatePageNumbers(state.currentPage, totalPages);
            
            // Bind page number clicks
            elements.pageNumbers.querySelectorAll('.page-number').forEach(btn => {
                btn.addEventListener('click', () => {
                    goToPage(parseInt(btn.dataset.page));
                });
            });
        }
    }

    function generatePageNumbers(current, total) {
        if (total <= 1) return '';

        const pages = [];
        const maxVisible = 5;

        if (total <= maxVisible + 2) {
            // Show all pages
            for (let i = 1; i <= total; i++) {
                pages.push(createPageButton(i, current));
            }
        } else {
            // Show first, last, and pages around current
            pages.push(createPageButton(1, current));

            if (current > 3) {
                pages.push('<span class="page-ellipsis">...</span>');
            }

            const start = Math.max(2, current - 1);
            const end = Math.min(total - 1, current + 1);

            for (let i = start; i <= end; i++) {
                pages.push(createPageButton(i, current));
            }

            if (current < total - 2) {
                pages.push('<span class="page-ellipsis">...</span>');
            }

            pages.push(createPageButton(total, current));
        }

        return pages.join('');
    }

    function createPageButton(page, current) {
        const activeClass = page === current ? 'active' : '';
        return `<button class="page-number ${activeClass}" data-page="${page}">${page}</button>`;
    }

    function goToPage(page) {
        const totalPages = Math.ceil(state.filteredInventory.length / state.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            state.currentPage = page;
            renderTable();
            updatePagination();
            scrollToTop();
        }
    }

    function goToPrevPage() {
        if (state.currentPage > 1) {
            goToPage(state.currentPage - 1);
        }
    }

    function goToNextPage() {
        const totalPages = Math.ceil(state.filteredInventory.length / state.itemsPerPage);
        if (state.currentPage < totalPages) {
            goToPage(state.currentPage + 1);
        }
    }

    // ============================================
    // Event Handlers
    // ============================================
    function handleSearch(e) {
        state.searchTerm = e.target.value.trim();
        
        if (elements.clearSearch) {
            elements.clearSearch.style.display = state.searchTerm ? 'block' : 'none';
        }
        
        applyFiltersAndSort();
    }

    function clearSearch() {
        if (elements.searchInput) {
            elements.searchInput.value = '';
        }
        if (elements.clearSearch) {
            elements.clearSearch.style.display = 'none';
        }
        state.searchTerm = '';
        applyFiltersAndSort();
    }

    function handleFilterChange() {
        state.filterCategory = elements.filterCategory?.value || '';
        state.filterStatus = elements.filterStatus?.value || '';
        applyFiltersAndSort();
    }

    function handleSortChange() {
        state.sortBy = elements.sortBy?.value || 'name-asc';
        applyFiltersAndSort();
    }

    function handleItemsPerPageChange() {
        state.itemsPerPage = parseInt(elements.itemsPerPage?.value) || 50;
        state.currentPage = 1;
        renderTable();
        updatePagination();
    }

    function handleTableAction(e) {
        const btn = e.target.closest('.action-btn');
        if (!btn) return;

        const row = btn.closest('tr');
        const itemId = row?.dataset.id;
        const action = btn.dataset.action;

        if (!itemId) return;

        const item = state.inventory.find(i => i.id === itemId);
        if (!item) return;

        switch (action) {
            case 'view':
                viewItem(item);
                break;
            case 'edit':
                editItem(item);
                break;
            case 'delete':
                deleteItem(item);
                break;
        }
    }

    // ============================================
    // Item Actions
    // ============================================
    function viewItem(item) {
        state.currentViewItem = item;
        
        const statusClass = getStatusClass(item.status);
        const statusLabel = formatStatusLabel(item.status);
        
        const html = `
            <div class="view-item-details">
                <div class="view-item-section">
                    <h4>Basic Information</h4>
                    <div class="view-item-grid">
                        <div class="view-item-field">
                            <span class="view-item-label">Product Name</span>
                            <span class="view-item-value highlight">${escapeHtml(item.name)}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Generic Name</span>
                            <span class="view-item-value">${escapeHtml(item.genericName) || 'N/A'}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Category</span>
                            <span class="view-item-value">${formatCategory(item.category)}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Dosage Form</span>
                            <span class="view-item-value">${formatDosageForm(item.dosageForm) || 'N/A'}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Strength</span>
                            <span class="view-item-value">${escapeHtml(item.strength) || 'N/A'}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Manufacturer</span>
                            <span class="view-item-value">${escapeHtml(item.manufacturer) || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="view-item-section">
                    <h4>Stock & Pricing</h4>
                    <div class="view-item-grid">
                        <div class="view-item-field">
                            <span class="view-item-label">Quantity</span>
                            <span class="view-item-value">${item.quantity} ${item.unit || 'pcs'}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Status</span>
                            <span class="view-item-status ${statusClass}">${statusLabel}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Cost Price</span>
                            <span class="view-item-value">${formatCurrency(item.costPrice)}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Selling Price</span>
                            <span class="view-item-value highlight">${formatCurrency(item.sellingPrice)}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Reorder Level</span>
                            <span class="view-item-value">${item.reorderLevel || 10}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Barcode</span>
                            <span class="view-item-value">${escapeHtml(item.barcode) || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="view-item-section">
                    <h4>Batch & Expiry</h4>
                    <div class="view-item-grid">
                        <div class="view-item-field">
                            <span class="view-item-label">Batch Number</span>
                            <span class="view-item-value">${escapeHtml(item.batchNumber) || 'N/A'}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Expiry Date</span>
                            <span class="view-item-value">${formatDate(item.expiryDate)}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Manufacture Date</span>
                            <span class="view-item-value">${formatDate(item.manufactureDate) || 'N/A'}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Location</span>
                            <span class="view-item-value">${escapeHtml(item.location) || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="view-item-section">
                    <h4>Additional Info</h4>
                    <div class="view-item-grid">
                        <div class="view-item-field">
                            <span class="view-item-label">Supplier</span>
                            <span class="view-item-value">${escapeHtml(item.supplier) || 'N/A'}</span>
                        </div>
                        <div class="view-item-field">
                            <span class="view-item-label">Prescription Required</span>
                            <span class="view-item-value">${item.prescriptionRequired ? 'Yes' : 'No'}</span>
                        </div>
                        ${item.description ? `
                        <div class="view-item-field full-width">
                            <span class="view-item-label">Description</span>
                            <span class="view-item-value">${escapeHtml(item.description)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        if (elements.viewItemBody) {
            elements.viewItemBody.innerHTML = html;
        }
        
        openViewModal();
    }

    function openViewModal() {
        if (elements.viewModal) {
            elements.viewModal.classList.add('show');
        }
    }

    function closeViewModal() {
        if (elements.viewModal) {
            elements.viewModal.classList.remove('show');
        }
        state.currentViewItem = null;
    }

    function editFromView() {
        if (state.currentViewItem) {
            closeViewModal();
            editItem(state.currentViewItem);
        }
    }

    function editItem(item) {
        state.currentEditItem = item;
        
        // Populate form fields
        if (elements.editItemId) elements.editItemId.value = item.id;
        if (elements.editName) elements.editName.value = item.name || '';
        if (elements.editGenericName) elements.editGenericName.value = item.genericName || '';
        if (elements.editCategory) elements.editCategory.value = item.category || '';
        if (elements.editDosageForm) elements.editDosageForm.value = item.dosageForm || '';
        if (elements.editStrength) elements.editStrength.value = item.strength || '';
        if (elements.editManufacturer) elements.editManufacturer.value = item.manufacturer || '';
        if (elements.editQuantity) elements.editQuantity.value = item.quantity || 0;
        if (elements.editUnit) elements.editUnit.value = item.unit || 'pieces';
        if (elements.editCostPrice) elements.editCostPrice.value = item.costPrice || 0;
        if (elements.editSellingPrice) elements.editSellingPrice.value = item.sellingPrice || 0;
        if (elements.editReorderLevel) elements.editReorderLevel.value = item.reorderLevel || 10;
        if (elements.editBarcode) elements.editBarcode.value = item.barcode || '';
        if (elements.editBatchNumber) elements.editBatchNumber.value = item.batchNumber || '';
        if (elements.editExpiryDate) elements.editExpiryDate.value = item.expiryDate || '';
        if (elements.editManufactureDate) elements.editManufactureDate.value = item.manufactureDate || '';
        if (elements.editLocation) elements.editLocation.value = item.location || '';
        if (elements.editSupplier) elements.editSupplier.value = item.supplier || '';
        if (elements.editDescription) elements.editDescription.value = item.description || '';
        if (elements.editPrescriptionRequired) elements.editPrescriptionRequired.checked = item.prescriptionRequired || false;
        
        openEditModal();
    }

    function openEditModal() {
        if (elements.editModal) {
            elements.editModal.classList.add('show');
        }
    }

    function closeEditModal() {
        if (elements.editModal) {
            elements.editModal.classList.remove('show');
        }
        state.currentEditItem = null;
    }

    async function saveEditedItem() {
        if (!state.currentEditItem) return;
        
        // Validate form
        const name = elements.editName?.value.trim();
        const category = elements.editCategory?.value;
        const quantity = parseInt(elements.editQuantity?.value) || 0;
        const costPrice = parseFloat(elements.editCostPrice?.value) || 0;
        const sellingPrice = parseFloat(elements.editSellingPrice?.value) || 0;
        const expiryDate = elements.editExpiryDate?.value;

        if (!name) {
            alert('Please enter the product name.');
            elements.editName?.focus();
            return;
        }
        if (!category) {
            alert('Please select a category.');
            elements.editCategory?.focus();
            return;
        }
        if (!expiryDate) {
            alert('Please enter the expiry date.');
            elements.editExpiryDate?.focus();
            return;
        }

        // Collect form data
        const updatedData = {
            name: name,
            genericName: elements.editGenericName?.value.trim() || '',
            category: category,
            dosageForm: elements.editDosageForm?.value || '',
            strength: elements.editStrength?.value.trim() || '',
            manufacturer: elements.editManufacturer?.value.trim() || '',
            quantity: quantity,
            unit: elements.editUnit?.value || 'pieces',
            costPrice: costPrice,
            sellingPrice: sellingPrice,
            reorderLevel: parseInt(elements.editReorderLevel?.value) || 10,
            batchNumber: elements.editBatchNumber?.value.trim() || '',
            expiryDate: expiryDate,
            manufactureDate: elements.editManufactureDate?.value || '',
            location: elements.editLocation?.value.trim() || '',
            supplier: elements.editSupplier?.value.trim() || '',
            description: elements.editDescription?.value.trim() || '',
            prescriptionRequired: elements.editPrescriptionRequired?.checked || false,
            updatedAt: serverTimestamp()
        };

        // Calculate status
        updatedData.status = calculateItemStatus(updatedData);

        try {
            // Disable save button
            if (elements.saveEditBtn) {
                elements.saveEditBtn.disabled = true;
                elements.saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            // Update in Firestore using the document ID
            const itemRef = doc(db, 'inventory', state.currentEditItem.id);
            await updateDoc(itemRef, updatedData);
            
            console.log('Item updated:', state.currentEditItem.id);
            closeEditModal();
            
            // Show success message
            showToast('Item updated successfully!', 'success');

        } catch (error) {
            console.error('Error updating item:', error);
            alert('Failed to update item. Please try again.');
        } finally {
            if (elements.saveEditBtn) {
                elements.saveEditBtn.disabled = false;
                elements.saveEditBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        }
    }

    function calculateItemStatus(item) {
        const quantity = item.quantity || 0;
        const reorderLevel = item.reorderLevel || 10;
        const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check expiry first
        if (expiryDate) {
            if (expiryDate < today) {
                return 'expired';
            }
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry <= 30) {
                return 'near-expiry';
            }
        }

        // Check stock levels
        if (quantity <= 0) {
            return 'out-of-stock';
        }
        if (quantity <= reorderLevel) {
            return 'low-stock';
        }
        return 'in-stock';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDosageForm(form) {
        if (!form) return '';
        return form.charAt(0).toUpperCase() + form.slice(1);
    }

    function showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.inventory-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `inventory-toast inventory-toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async function deleteItem(item) {
        if (!confirm(`Are you sure you want to delete "${item.name}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'inventory', item.id));
            console.log('Item deleted:', item.id);
            // Toast notification would be better here
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Failed to delete item. Please try again.');
        }
    }

    // ============================================
    // Export to CSV
    // ============================================
    function exportToCSV() {
        if (state.filteredInventory.length === 0) {
            alert('No items to export.');
            return;
        }

        const headers = [
            'Name', 'Generic Name', 'Category', 'Barcode', 'Quantity', 'Unit',
            'Cost Price', 'Selling Price', 'Batch Number', 'Expiry Date',
            'Manufacturer', 'Supplier', 'Location', 'Status'
        ];

        const rows = state.filteredInventory.map(item => [
            item.name || '',
            item.genericName || '',
            item.category || '',
            item.barcode || '',
            item.quantity || 0,
            item.unit || '',
            item.costPrice || 0,
            item.sellingPrice || 0,
            item.batchNumber || '',
            item.expiryDate || '',
            item.manufacturer || '',
            item.supplier || '',
            item.location || '',
            item.status || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_${formatDateForFilename()}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function refreshData() {
        if (elements.refreshIcon) {
            elements.refreshIcon.classList.add('fa-spin');
            setTimeout(() => {
                elements.refreshIcon.classList.remove('fa-spin');
            }, 1000);
        }
        // Data refreshes automatically via real-time listener
    }

    function navigateToAddInventory() {
        if (window.PharmaFlow && window.PharmaFlow.setActiveModule) {
            window.PharmaFlow.setActiveModule('inventory-add');
        }
    }

    // ============================================
    // Bulk Import Functions
    // ============================================
    function openImportModal() {
        if (elements.importModal) {
            elements.importModal.classList.add('show');
            resetImportModal();
        }
    }

    function closeImportModal() {
        if (elements.importModal) {
            elements.importModal.classList.remove('show');
            resetImportModal();
        }
    }

    function resetImportModal() {
        state.importData = [];
        state.importErrors = [];
        state.validImportItems = [];

        if (elements.importFileInput) elements.importFileInput.value = '';
        showUploadSection();
    }

    function showUploadSection() {
        if (elements.importUploadSection) elements.importUploadSection.style.display = 'block';
        if (elements.importPreviewSection) elements.importPreviewSection.style.display = 'none';
        if (elements.importProgressSection) elements.importProgressSection.style.display = 'none';
        if (elements.importSuccessSection) elements.importSuccessSection.style.display = 'none';
        
        if (elements.cancelImport) elements.cancelImport.style.display = 'block';
        if (elements.backToUpload) elements.backToUpload.style.display = 'none';
        if (elements.startImport) elements.startImport.style.display = 'none';
        if (elements.doneImport) elements.doneImport.style.display = 'none';
    }

    function showPreviewSection() {
        if (elements.importUploadSection) elements.importUploadSection.style.display = 'none';
        if (elements.importPreviewSection) elements.importPreviewSection.style.display = 'block';
        if (elements.importProgressSection) elements.importProgressSection.style.display = 'none';
        if (elements.importSuccessSection) elements.importSuccessSection.style.display = 'none';
        
        if (elements.cancelImport) elements.cancelImport.style.display = 'none';
        if (elements.backToUpload) elements.backToUpload.style.display = 'block';
        if (elements.startImport) elements.startImport.style.display = 'block';
        if (elements.doneImport) elements.doneImport.style.display = 'none';
    }

    function showProgressSection() {
        if (elements.importUploadSection) elements.importUploadSection.style.display = 'none';
        if (elements.importPreviewSection) elements.importPreviewSection.style.display = 'none';
        if (elements.importProgressSection) elements.importProgressSection.style.display = 'block';
        if (elements.importSuccessSection) elements.importSuccessSection.style.display = 'none';
        
        if (elements.cancelImport) elements.cancelImport.style.display = 'none';
        if (elements.backToUpload) elements.backToUpload.style.display = 'none';
        if (elements.startImport) elements.startImport.style.display = 'none';
        if (elements.doneImport) elements.doneImport.style.display = 'none';
    }

    function showSuccessSection() {
        if (elements.importUploadSection) elements.importUploadSection.style.display = 'none';
        if (elements.importPreviewSection) elements.importPreviewSection.style.display = 'none';
        if (elements.importProgressSection) elements.importProgressSection.style.display = 'none';
        if (elements.importSuccessSection) elements.importSuccessSection.style.display = 'block';
        
        if (elements.cancelImport) elements.cancelImport.style.display = 'none';
        if (elements.backToUpload) elements.backToUpload.style.display = 'none';
        if (elements.startImport) elements.startImport.style.display = 'none';
        if (elements.doneImport) elements.doneImport.style.display = 'block';
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.importDropzone?.classList.add('dragover');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.importDropzone?.classList.remove('dragover');
    }

    function handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.importDropzone?.classList.remove('dragover');
        
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }

    function handleFileSelect(e) {
        const files = e.target?.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }

    function processFile(file) {
        const fileName = file.name.toLowerCase();
        const isCSV = fileName.endsWith('.csv');
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

        if (!isCSV && !isExcel) {
            alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls).');
            return;
        }

        if (isExcel) {
            processExcelFile(file);
        } else {
            processCSVFile(file);
        }
    }

    function processCSVFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result;
            if (content) {
                parseData(parseCSVContent(content));
            }
        };
        reader.onerror = () => {
            alert('Error reading file. Please try again.');
        };
        reader.readAsText(file);
    }

    function processExcelFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                if (jsonData.length < 2) {
                    alert('Excel file is empty or has no data rows.');
                    return;
                }

                parseData(jsonData);
            } catch (error) {
                console.error('Excel parse error:', error);
                alert('Error parsing Excel file. Please ensure it is a valid Excel file.');
            }
        };
        reader.onerror = () => {
            alert('Error reading file. Please try again.');
        };
        reader.readAsArrayBuffer(file);
    }

    function parseCSVContent(content) {
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => parseCSVLine(line));
    }

    function parseData(rows) {
        if (rows.length < 2) {
            alert('File is empty or has no data rows.');
            return;
        }

        const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
        
        // Map CSV headers to our field names
        const fieldMap = {
            'name': 'name',
            'product name': 'name',
            'drug name': 'name',
            'generic name': 'genericName',
            'genericname': 'genericName',
            'category': 'category',
            'dosage form': 'dosageForm',
            'dosageform': 'dosageForm',
            'form': 'dosageForm',
            'strength': 'strength',
            'manufacturer': 'manufacturer',
            'quantity': 'quantity',
            'qty': 'quantity',
            'stock': 'quantity',
            'unit': 'unit',
            'cost price': 'costPrice',
            'costprice': 'costPrice',
            'cost': 'costPrice',
            'selling price': 'sellingPrice',
            'sellingprice': 'sellingPrice',
            'price': 'sellingPrice',
            'reorder level': 'reorderLevel',
            'reorderlevel': 'reorderLevel',
            'batch number': 'batchNumber',
            'batchnumber': 'batchNumber',
            'batch': 'batchNumber',
            'expiry date': 'expiryDate',
            'expirydate': 'expiryDate',
            'expiry': 'expiryDate',
            'manufacture date': 'manufactureDate',
            'manufacturedate': 'manufactureDate',
            'mfg date': 'manufactureDate',
            'barcode': 'barcode',
            'sku': 'barcode',
            'location': 'location',
            'supplier': 'supplier',
            'description': 'description',
            'prescription required': 'prescriptionRequired',
            'prescriptionrequired': 'prescriptionRequired',
            'prescription': 'prescriptionRequired'
        };

        const headerIndices = {};
        headers.forEach((header, index) => {
            const mappedField = fieldMap[header];
            if (mappedField) {
                headerIndices[mappedField] = index;
            }
        });

        // Check for required fields
        const requiredFields = ['name', 'category', 'quantity', 'costPrice', 'sellingPrice'];
        const missingFields = requiredFields.filter(f => headerIndices[f] === undefined);
        
        if (missingFields.length > 0) {
            alert(`Missing required columns: ${missingFields.join(', ')}\n\nPlease ensure your CSV has these columns.`);
            return;
        }

        state.importData = [];
        state.importErrors = [];
        state.validImportItems = [];

        // Parse data rows
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            const rowErrors = [];
            
            const item = {
                rowNumber: i + 1,
                name: getValue(values, headerIndices.name),
                genericName: getValue(values, headerIndices.genericName),
                category: getValue(values, headerIndices.category),
                dosageForm: getValue(values, headerIndices.dosageForm),
                strength: getValue(values, headerIndices.strength),
                manufacturer: getValue(values, headerIndices.manufacturer),
                quantity: parseNumber(getValue(values, headerIndices.quantity)),
                unit: getValue(values, headerIndices.unit) || 'pieces',
                costPrice: parseNumber(getValue(values, headerIndices.costPrice)),
                sellingPrice: parseNumber(getValue(values, headerIndices.sellingPrice)),
                reorderLevel: parseNumber(getValue(values, headerIndices.reorderLevel)) || 10,
                batchNumber: getValue(values, headerIndices.batchNumber),
                expiryDate: parseDate(values[headerIndices.expiryDate]),
                manufactureDate: parseDate(values[headerIndices.manufactureDate]),
                barcode: getValue(values, headerIndices.barcode) || generateBarcode(),
                location: getValue(values, headerIndices.location),
                supplier: getValue(values, headerIndices.supplier),
                description: getValue(values, headerIndices.description),
                prescriptionRequired: parseBool(getValue(values, headerIndices.prescriptionRequired))
            };

            // Validate required fields
            if (!item.name) rowErrors.push('Name is required');
            if (!item.category) rowErrors.push('Category is required');
            if (item.quantity === null || item.quantity < 0) rowErrors.push('Valid quantity is required');
            if (item.costPrice === null || item.costPrice < 0) rowErrors.push('Valid cost price is required');
            if (item.sellingPrice === null || item.sellingPrice < 0) rowErrors.push('Valid selling price is required');
            
            // Validate dates if provided
            if (item.expiryDate && !isValidDate(item.expiryDate)) {
                rowErrors.push('Invalid expiry date format (use YYYY-MM-DD)');
            }
            if (item.manufactureDate && !isValidDate(item.manufactureDate)) {
                rowErrors.push('Invalid manufacture date format (use YYYY-MM-DD)');
            }

            item.errors = rowErrors;
            state.importData.push(item);

            if (rowErrors.length === 0) {
                state.validImportItems.push(item);
            } else {
                state.importErrors.push({ row: i + 1, errors: rowErrors });
            }
        }

        renderImportPreview();
        showPreviewSection();
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        
        return result;
    }

    function getValue(values, index) {
        if (index === undefined || !values || index >= values.length) return '';
        const val = values[index];
        if (val === null || val === undefined) return '';
        return String(val).trim();
    }

    function parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return value;
        const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? null : num;
    }

    function parseBool(value) {
        if (!value) return false;
        if (typeof value === 'boolean') return value;
        const lower = String(value).toLowerCase();
        return lower === 'true' || lower === 'yes' || lower === '1';
    }

    function isValidDate(dateStr) {
        if (!dateStr) return true;
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateStr)) return false;
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    }

    // Convert Excel serial date or various date formats to YYYY-MM-DD
    function parseDate(value) {
        if (!value) return '';
        
        // If it's a number (Excel serial date)
        if (typeof value === 'number') {
            // Excel uses 1900-01-01 as day 1 (with a leap year bug)
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + value * 86400000);
            return date.toISOString().split('T')[0];
        }
        
        // If it's a Date object
        if (value instanceof Date) {
            return value.toISOString().split('T')[0];
        }
        
        // If it's a string, try to parse it
        const str = String(value).trim();
        
        // Already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return str;
        }
        
        // Try DD/MM/YYYY or MM/DD/YYYY formats
        const parts = str.split(/[\/\-\.]/);
        if (parts.length === 3) {
            // If first part is 4 digits, assume YYYY-MM-DD
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            // If third part is 4 digits, assume DD/MM/YYYY or MM/DD/YYYY
            if (parts[2].length === 4) {
                // Assume DD/MM/YYYY (common in many countries)
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        
        // Return as-is and let validation catch issues
        return str;
    }

    function generateBarcode() {
        const date = new Date();
        const dateCode = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
        return `PF${dateCode}${random}`;
    }

    function renderImportPreview() {
        const validCount = state.validImportItems.length;
        const errorCount = state.importErrors.length;
        const totalCount = state.importData.length;

        if (elements.validCount) elements.validCount.textContent = validCount;
        if (elements.errorCount) elements.errorCount.textContent = errorCount;
        if (elements.totalCount) elements.totalCount.textContent = totalCount;
        if (elements.importBtnCount) elements.importBtnCount.textContent = validCount;

        // Enable/disable import button
        if (elements.startImport) {
            elements.startImport.disabled = validCount === 0;
        }

        // Render preview table header
        if (elements.importPreviewHead) {
            elements.importPreviewHead.innerHTML = `
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Cost</th>
                    <th>Price</th>
                    <th>Expiry</th>
                    <th>Status</th>
                </tr>
            `;
        }

        // Render preview table body (limit to first 50 for performance)
        if (elements.importPreviewBody) {
            const previewItems = state.importData.slice(0, 50);
            elements.importPreviewBody.innerHTML = previewItems.map(item => `
                <tr class="${item.errors.length > 0 ? 'error-row' : ''}">
                    <td>${item.rowNumber}</td>
                    <td>${escapeHtml(item.name || '-')}</td>
                    <td>${escapeHtml(item.category || '-')}</td>
                    <td>${item.quantity ?? '-'}</td>
                    <td>${item.costPrice ?? '-'}</td>
                    <td>${item.sellingPrice ?? '-'}</td>
                    <td>${item.expiryDate || '-'}</td>
                    <td>${item.errors.length > 0 ? '<span style="color:#dc2626;">Error</span>' : '<span style="color:#10b981;">Valid</span>'}</td>
                </tr>
            `).join('');

            if (state.importData.length > 50) {
                elements.importPreviewBody.innerHTML += `
                    <tr>
                        <td colspan="8" style="text-align:center; color:var(--text-secondary);">
                            ... and ${state.importData.length - 50} more items
                        </td>
                    </tr>
                `;
            }
        }

        // Render error list
        if (elements.importErrorList && elements.errorListItems) {
            if (state.importErrors.length > 0) {
                elements.importErrorList.style.display = 'block';
                const displayErrors = state.importErrors.slice(0, 10);
                elements.errorListItems.innerHTML = displayErrors.map(e => 
                    `<li>Row ${e.row}: ${e.errors.join(', ')}</li>`
                ).join('');
                
                if (state.importErrors.length > 10) {
                    elements.errorListItems.innerHTML += `<li>... and ${state.importErrors.length - 10} more errors</li>`;
                }
            } else {
                elements.importErrorList.style.display = 'none';
            }
        }
    }

    async function executeImport() {
        if (state.validImportItems.length === 0) return;

        showProgressSection();
        
        const total = state.validImportItems.length;
        let imported = 0;

        if (elements.totalImportCount) elements.totalImportCount.textContent = total;
        if (elements.importedCount) elements.importedCount.textContent = '0';
        if (elements.importProgressBar) elements.importProgressBar.style.width = '0%';

        // Import in batches for better performance
        const batchSize = 20;
        const batches = [];
        
        for (let i = 0; i < state.validImportItems.length; i += batchSize) {
            batches.push(state.validImportItems.slice(i, i + batchSize));
        }

        try {
            for (const batch of batches) {
                const promises = batch.map(item => {
                    const inventoryItem = {
                        name: item.name,
                        genericName: item.genericName || '',
                        category: item.category,
                        dosageForm: item.dosageForm || '',
                        strength: item.strength || '',
                        manufacturer: item.manufacturer || '',
                        quantity: item.quantity,
                        unit: item.unit,
                        costPrice: item.costPrice,
                        sellingPrice: item.sellingPrice,
                        reorderLevel: item.reorderLevel,
                        batchNumber: item.batchNumber || '',
                        expiryDate: item.expiryDate || '',
                        manufactureDate: item.manufactureDate || '',
                        barcode: item.barcode,
                        location: item.location || '',
                        supplier: item.supplier || '',
                        description: item.description || '',
                        prescriptionRequired: item.prescriptionRequired,
                        status: calculateImportStatus(item),
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    return addDoc(collection(db, 'inventory'), inventoryItem);
                });

                await Promise.all(promises);
                imported += batch.length;

                // Update progress
                const progress = Math.round((imported / total) * 100);
                if (elements.importedCount) elements.importedCount.textContent = imported;
                if (elements.importProgressBar) elements.importProgressBar.style.width = `${progress}%`;
            }

            // Show success
            if (elements.successCount) elements.successCount.textContent = imported;
            showSuccessSection();

        } catch (error) {
            console.error('Import error:', error);
            alert(`Import failed after ${imported} items. Error: ${error.message}`);
            showPreviewSection();
        }
    }

    function calculateImportStatus(item) {
        const quantity = parseInt(item.quantity) || 0;
        const reorderLevel = parseInt(item.reorderLevel) || 10;
        const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (expiryDate && expiryDate < today) return 'expired';
        if (expiryDate && expiryDate <= thirtyDaysFromNow) return 'near-expiry';
        if (quantity <= 0) return 'out-of-stock';
        if (quantity <= reorderLevel) return 'low-stock';
        return 'in-stock';
    }

    function downloadCSVTemplate() {
        const headers = [
            'name',
            'genericName',
            'category',
            'dosageForm',
            'strength',
            'manufacturer',
            'quantity',
            'unit',
            'costPrice',
            'sellingPrice',
            'reorderLevel',
            'batchNumber',
            'expiryDate',
            'manufactureDate',
            'barcode',
            'location',
            'supplier',
            'description',
            'prescriptionRequired'
        ];

        const sampleRow = [
            'Drug Name',
            'Generic Name',
            'Category',
            'Dosage Form',
            'Strength',
            'Manufacturer',
            'Quantity',
            'Unit',
            'Unit Price',
            'Selling Price',
            'Reorder Level',
            'Batch Number',
            'Expiry Date (YYYY-MM-DD)',
            'Manufacturing Date (YYYY-MM-DD)',
            'Barcode',
            'Location',
            'Supplier',
            'Description',
            'Prescription Required (true/false)'
        ];

        const csvContent = [
            headers.join(','),
            sampleRow.map(cell => `"${cell}"`).join(',')
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'inventory_import_template.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ============================================
    // Utility Functions
    // ============================================
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNumber(num) {
        // Format large numbers compactly for stats display
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        }
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return new Intl.NumberFormat().format(num);
    }

    function formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return `KSH ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatCurrencyCompact(amount) {
        const num = parseFloat(amount) || 0;
        if (num >= 1000000000) {
            return 'KSH ' + (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        }
        if (num >= 1000000) {
            return 'KSH ' + (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return 'KSH ' + (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return `KSH ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-KE', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function formatDateForFilename() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }

    function formatCategory(category) {
        if (!category) return '-';
        return category.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    function formatStatusLabel(status) {
        const labels = {
            'in-stock': 'In Stock',
            'low-stock': 'Low Stock',
            'out-of-stock': 'Out of Stock',
            'near-expiry': 'Near Expiry',
            'expired': 'Expired',
            'draft': 'Draft'
        };
        return labels[status] || 'Unknown';
    }

    function getStatusClass(status) {
        return status || 'in-stock';
    }

    function scrollToTop() {
        const container = document.getElementById('module-inventory-view');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function showError(message) {
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--danger-color);">
                        <i class="fas fa-exclamation-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <p>${message}</p>
                    </td>
                </tr>
            `;
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
    // Initialize on DOM Ready
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // ============================================
    // Expose Public API
    // ============================================
    window.PharmaFlowInventoryView = {
        init,
        getInventory: () => state.inventory,
        getFilteredInventory: () => state.filteredInventory,
        refresh: refreshData,
        exportCSV: exportToCSV,
        cleanup
    };

    // Also expose as PharmaFlowInventory for global search compatibility
    window.PharmaFlowInventory = {
        getInventory: () => state.inventory,
        refresh: refreshData
    };

})(window, document);
