/**
 * PharmaFlow - Order Management Module
 * Handles order creation with supplier and inventory integration
 */

import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc,
    query, 
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

class OrderManager {
    constructor() {
        this.selectedSupplier = null;
        this.orderItems = [];
        this.suppliers = [];
        this.medications = [];
        this.suppliersUnsubscribe = null;
        this.medicationsUnsubscribe = null;
        this.handleInventoryBridgeUpdate = this.handleInventoryBridgeUpdate.bind(this);
        this.init();
    }

    async init() {
        try {
            // Wait for Firebase to be initialized
            if (!window.PharmaFlowFirebase?.db) {
                console.log('OrderManager: Waiting for Firebase initialization...');
                setTimeout(() => this.init(), 500);
                return;
            }

            console.log('OrderManager: Firebase initialized, setting up...');
            this.setupEventListeners();
            this.loadSuppliersRealtime();
            this.attachInventoryBridge();

            // Fallback to direct Firestore listener if inventory bridge not available
            if (!window.PharmaFlowInventory) {
                this.loadMedicationsRealtime();
            }

            console.log('OrderManager: Setup complete');
        } catch (error) {
            console.error('OrderManager initialization error:', error);
            this.showError('Failed to initialize order manager');
        }
    }

    setupEventListeners() {
        // Supplier dropdown
        const supplierDropdown = document.getElementById('supplierDropdown');
        if (supplierDropdown) {
            supplierDropdown.addEventListener('change', (e) => {
                const supplierId = e.target.value;
                if (supplierId) {
                    const supplier = this.suppliers.find(s => s.id === supplierId);
                    if (supplier) this.selectSupplier(supplier);
                } else {
                    this.removeSupplier();
                }
            });
        }

        // Item search - NEW
        const itemSearch = document.getElementById('orderItemSearch');
        if (itemSearch) {
            itemSearch.addEventListener('input', (e) => {
                this.handleItemSearch(e.target.value);
            });
            // Hide results when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-inventory-section')) {
                    const results = document.getElementById('orderSearchResults');
                    if (results) results.style.display = 'none';
                }
            });
        }

        // Manual add
        const addManualBtn = document.getElementById('addManualItemBtn');
        if (addManualBtn) {
            addManualBtn.addEventListener('click', () => this.addManualItem());
        }

        // Inventory filters
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.filterInventory(e.target.dataset.filter));
        });

        // Refresh inventory
        const refreshBtn = document.getElementById('refreshInventoryBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.displayInventory(this.medications));
        }

        // Order actions
        const createOrderBtn = document.getElementById('createOrderBtn');
        if (createOrderBtn) {
            createOrderBtn.addEventListener('click', () => this.createOrder());
        }

        const clearOrderBtn = document.getElementById('clearOrderBtn');
        if (clearOrderBtn) {
            clearOrderBtn.addEventListener('click', () => this.clearOrder());
        }
    }

    loadSuppliersRealtime() {
        try {
            const suppliersRef = collection(db, 'suppliers');
            const q = query(suppliersRef, orderBy('name', 'asc'));

            this.suppliersUnsubscribe = onSnapshot(q, (snapshot) => {
                this.suppliers = [];
                snapshot.forEach((doc) => {
                    this.suppliers.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                console.log(`Loaded ${this.suppliers.length} suppliers`);
                this.populateSupplierDropdown();
            }, (error) => {
                console.error('Error loading suppliers:', error);
                this.suppliers = [];
            });
        } catch (error) {
            console.error('Error setting up suppliers listener:', error);
            this.suppliers = [];
        }
    }

    populateSupplierDropdown() {
        const dropdown = document.getElementById('supplierDropdown');
        if (!dropdown) return;

        // Keep the default option and clear others
        dropdown.innerHTML = '<option value="">-- Select Supplier --</option>';

        // Add all suppliers
        this.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = `${supplier.name} - ${supplier.contactNumber || 'N/A'}`;
            dropdown.appendChild(option);
        });
    }

    attachInventoryBridge() {
        document.addEventListener('pharmaflow-inventory-updated', this.handleInventoryBridgeUpdate);

        if (window.PharmaFlowInventory?.getInventory) {
            const existingInventory = window.PharmaFlowInventory.getInventory();
            if (existingInventory && existingInventory.length) {
                this.updateMedicationsFromData(existingInventory);
            }
        }
    }

    handleInventoryBridgeUpdate(event) {
        const inventoryData = event?.detail || [];
        this.updateMedicationsFromData(inventoryData);
    }

    updateMedicationsFromData(data) {
        if (!Array.isArray(data)) {
            return;
        }

        this.medications = data.map(item => this.transformInventoryItem(item));
        console.log(`OrderManager: Inventory synced (${this.medications.length} items)`);
        this.displayInventory(this.medications);
    }

    transformInventoryItem(item = {}) {
        return {
            id: item.id || item.documentId || `manual_${Date.now()}`,
            name: item.itemName || item.name || 'Unnamed Item',
            dosage: item.strength || item.dosage || 'N/A',
            manufacturer: item.manufacturer || 'Unknown',
            stockQuantity: parseInt(item.quantity ?? item.stockQuantity ?? 0, 10) || 0,
            reorderPoint: parseInt(item.reorderLevel ?? item.reorderPoint ?? 10, 10) || 0,
            unitPrice: parseFloat(item.sellingPrice ?? item.unitPrice ?? 0) || 0,
            expirationDate: item.expiryDate || item.expirationDate || '',
            description: item.description || '',
            category: item.category || '',
            batchNumber: item.batchNumber || ''
        };
    }

    loadMedicationsRealtime() {
        const inventoryList = document.getElementById('inventoryList');
        if (inventoryList) {
            inventoryList.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading inventory...</p></div>';
        }

        try {
            const inventoryRef = collection(db, 'inventory');
            const q = query(inventoryRef, orderBy('itemName', 'asc'));

            this.medicationsUnsubscribe = onSnapshot(q, (snapshot) => {
                const payload = [];
                snapshot.forEach((doc) => {
                    payload.push({ id: doc.id, ...doc.data() });
                });
                this.updateMedicationsFromData(payload);
            }, (error) => {
                console.error('Error loading inventory:', error);
                this.medications = [];
                if (inventoryList) {
                    inventoryList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load inventory</p></div>';
                }
            });
        } catch (error) {
            console.error('Error setting up inventory listener:', error);
            this.medications = [];
            if (inventoryList) {
                inventoryList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load inventory</p></div>';
            }
        }
    }

    selectSupplier(supplier) {
        this.selectedSupplier = supplier;

        // Update UI
        const card = document.getElementById('selectedSupplierCard');
        const name = document.getElementById('selectedSupplierName');
        const contact = document.getElementById('selectedSupplierContact');
        const phone = document.getElementById('selectedSupplierPhone');

        if (card && name && contact && phone) {
            name.textContent = supplier.name;
            contact.textContent = `Contact: ${supplier.contactPerson || 'N/A'}`;
            phone.textContent = `Phone: ${supplier.contactNumber || 'N/A'}`;
            card.style.display = 'block';
        }

        this.updateOrderButton();
    }

    removeSupplier() {
        this.selectedSupplier = null;
        const card = document.getElementById('selectedSupplierCard');
        const dropdown = document.getElementById('supplierDropdown');
        
        if (card) card.style.display = 'none';
        if (dropdown) dropdown.value = '';
        
        this.updateOrderButton();
    }

    handleItemSearch(query) {
        const resultsContainer = document.getElementById('orderSearchResults');
        if (!resultsContainer) return;

        // Clear if empty
        if (!query.trim()) {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        // Search through inventory
        const searchTerm = query.toLowerCase();
        const results = this.medications.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            (item.dosage && item.dosage.toLowerCase().includes(searchTerm)) ||
            (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm)) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );

        // Display results
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No items found</div>';
            resultsContainer.style.display = 'block';
            return;
        }

        resultsContainer.innerHTML = results.map(item => {
            const stockStatus = this.getStockClass(item);
            const stockLabel = this.getStockLabel(item);
            
            return `
                <div class="search-result-item" data-item-id="${item.id}">
                    <div class="result-info">
                        <div class="result-name">${item.name}</div>
                        <div class="result-details">
                            ${item.dosage || 'N/A'} • ${item.manufacturer || 'N/A'}
                        </div>
                    </div>
                    <div class="result-stock">
                        <span class="stock-badge ${stockStatus}">${stockLabel}</span>
                        <div class="result-price">KSH ${(item.unitPrice || 0).toFixed(2)}</div>
                        <div class="result-qty">Stock: ${item.stockQuantity}</div>
                    </div>
                    <button class="btn-add-to-order" data-item-id="${item.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
        }).join('');

        resultsContainer.style.display = 'block';

        // Add click handlers
        resultsContainer.querySelectorAll('.btn-add-to-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.itemId;
                const item = this.medications.find(m => m.id === itemId);
                if (item) {
                    this.addItemToOrder(item);
                    // Clear search
                    document.getElementById('orderItemSearch').value = '';
                    resultsContainer.style.display = 'none';
                }
            });
        });
    }

    addItemToOrder(medication, isManual = false) {
        const existingItem = this.orderItems.find(i => i.id === medication.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
            existingItem.subtotal = existingItem.quantity * existingItem.unitPrice;
        } else {
            this.orderItems.push({
                id: medication.id || `manual_${Date.now()}`,
                name: medication.name,
                dosage: medication.dosage || 'N/A',
                quantity: 1,
                unitPrice: parseFloat(medication.unitPrice || 0),
                subtotal: parseFloat(medication.unitPrice || 0),
                isManual: isManual
            });
        }

        // Clear search
        const itemSearch = document.getElementById('itemSearchInput');
        const suggestions = document.getElementById('itemSuggestions');
        if (itemSearch) itemSearch.value = '';
        if (suggestions) {
            suggestions.innerHTML = '';
            suggestions.style.display = 'none';
        }

        this.updateOrderPreview();
    }

    addManualItem() {
        const name = document.getElementById('manualItemName')?.value.trim();
        const dosage = document.getElementById('manualItemDosage')?.value.trim();
        const quantity = parseInt(document.getElementById('manualItemQuantity')?.value) || 0;
        const price = parseFloat(document.getElementById('manualItemPrice')?.value) || 0;

        if (!name) {
            this.showError('Item name is required');
            return;
        }

        if (quantity <= 0) {
            this.showError('Quantity must be greater than 0');
            return;
        }

        const manualItem = {
            id: `manual_${Date.now()}`,
            name: name,
            dosage: dosage || 'N/A',
            quantity: quantity,
            unitPrice: price,
            subtotal: quantity * price,
            isManual: true
        };

        this.orderItems.push(manualItem);

        // Clear form
        document.getElementById('manualItemName').value = '';
        document.getElementById('manualItemDosage').value = '';
        document.getElementById('manualItemQuantity').value = '';
        document.getElementById('manualItemPrice').value = '';

        this.updateOrderPreview();
    }

    updateOrderPreview() {
        const itemsList = document.getElementById('orderItemsList');
        if (!itemsList) return;

        if (this.orderItems.length === 0) {
            itemsList.innerHTML = '<div class="empty-order"><i class="fas fa-shopping-cart"></i><p>No items added yet</p></div>';
        } else {
            itemsList.innerHTML = this.orderItems.map((item, index) => `
                <div class="order-item">
                    <div class="item-details">
                        <strong>${item.name}</strong>
                        <span>${item.dosage}</span>
                    </div>
                    <div class="item-controls">
                        <button class="btn-qty" data-index="${index}" data-action="decrease">-</button>
                        <input type="number" class="qty-input" value="${item.quantity}" data-index="${index}" min="1">
                        <button class="btn-qty" data-index="${index}" data-action="increase">+</button>
                    </div>
                    <div class="item-price">
                        <input type="number" class="price-input" value="${item.unitPrice}" data-index="${index}" step="0.01" min="0">
                        <span>KSH ${item.subtotal.toFixed(2)}</span>
                    </div>
                    <button class="btn-remove-item" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');

            // Add event listeners
            itemsList.querySelectorAll('.btn-qty').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    const action = e.currentTarget.dataset.action;
                    this.updateQuantity(index, action);
                });
            });

            itemsList.querySelectorAll('.qty-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    const newQty = parseInt(e.target.value) || 1;
                    this.orderItems[index].quantity = Math.max(1, newQty);
                    this.orderItems[index].subtotal = this.orderItems[index].quantity * this.orderItems[index].unitPrice;
                    this.updateOrderPreview();
                });
            });

            itemsList.querySelectorAll('.price-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    const newPrice = parseFloat(e.target.value) || 0;
                    this.orderItems[index].unitPrice = Math.max(0, newPrice);
                    this.orderItems[index].subtotal = this.orderItems[index].quantity * this.orderItems[index].unitPrice;
                    this.updateOrderPreview();
                });
            });

            itemsList.querySelectorAll('.btn-remove-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    this.removeItem(index);
                });
            });
        }

        this.updateSummary();
        this.updateOrderButton();
    }

    updateQuantity(index, action) {
        if (action === 'increase') {
            this.orderItems[index].quantity += 1;
        } else if (action === 'decrease' && this.orderItems[index].quantity > 1) {
            this.orderItems[index].quantity -= 1;
        }
        this.orderItems[index].subtotal = this.orderItems[index].quantity * this.orderItems[index].unitPrice;
        this.updateOrderPreview();
    }

    removeItem(index) {
        this.orderItems.splice(index, 1);
        this.updateOrderPreview();
    }

    updateSummary() {
        const totalItems = this.orderItems.length;
        const totalQuantity = this.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = this.orderItems.reduce((sum, item) => sum + item.subtotal, 0);

        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('totalQuantity').textContent = totalQuantity;
        document.getElementById('totalAmount').textContent = `KSH ${totalAmount.toFixed(2)}`;
    }

    updateOrderButton() {
        const createBtn = document.getElementById('createOrderBtn');
        if (createBtn) {
            createBtn.disabled = !this.selectedSupplier || this.orderItems.length === 0;
        }
    }

    displayInventory(medications) {
        const inventoryList = document.getElementById('inventoryList');
        if (!inventoryList) return;

        if (medications.length === 0) {
            inventoryList.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No inventory items</p></div>';
            return;
        }

        inventoryList.innerHTML = medications.map(med => {
            const stockClass = this.getStockClass(med);
            const stockLabel = this.getStockLabel(med);
            
            return `
                <div class="inventory-item ${stockClass}" data-id="${med.id}">
                    <div class="item-info">
                        <strong>${med.name}</strong>
                        <span>${med.dosage}</span>
                        <span class="manufacturer">${med.manufacturer}</span>
                    </div>
                    <div class="item-stock">
                        <span class="stock-badge ${stockClass}">${stockLabel}</span>
                        <span>Stock: ${med.stockQuantity}</span>
                        <span>Price: KSH ${med.unitPrice || 0}</span>
                    </div>
                    <button class="btn-add-item" data-id="${med.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Add click handlers
        inventoryList.querySelectorAll('.btn-add-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const medId = e.currentTarget.dataset.id;
                const medication = this.medications.find(m => m.id === medId);
                if (medication) this.addItemToOrder(medication);
            });
        });
    }

    getStockClass(medication) {
        if (medication.stockQuantity === 0) return 'out-of-stock';
        if (medication.stockQuantity <= medication.reorderPoint) return 'low-stock';
        return 'in-stock';
    }

    getStockLabel(medication) {
        if (medication.stockQuantity === 0) return 'Out of Stock';
        if (medication.stockQuantity <= medication.reorderPoint) return 'Low Stock';
        return 'In Stock';
    }

    filterInventory(filter) {
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        let filtered = this.medications;

        if (filter === 'low') {
            filtered = this.medications.filter(m => m.stockQuantity > 0 && m.stockQuantity <= m.reorderPoint);
        } else if (filter === 'out') {
            filtered = this.medications.filter(m => m.stockQuantity === 0);
        }

        this.displayInventory(filtered);
    }

    async createOrder() {
        if (!this.selectedSupplier || this.orderItems.length === 0) {
            this.showError('Please select a supplier and add items');
            return;
        }

        const createBtn = document.getElementById('createOrderBtn');
        const originalText = createBtn.innerHTML;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        createBtn.disabled = true;

        try {
            const orderNumber = `ORD-${Date.now()}`;
            const totalAmount = this.orderItems.reduce((sum, item) => sum + item.subtotal, 0);
            const notes = document.getElementById('orderNotes')?.value || '';

            // Save order to Firestore
            const orderData = {
                orderNumber,
                orderDate: serverTimestamp(),
                supplierId: this.selectedSupplier.id,
                supplierName: this.selectedSupplier.name,
                supplierContact: this.selectedSupplier.contactPerson || '',
                supplierPhone: this.selectedSupplier.contactNumber || '',
                totalAmount,
                totalItems: this.orderItems.length,
                totalQuantity: this.orderItems.reduce((sum, item) => sum + item.quantity, 0),
                status: 'pending',
                notes,
                items: this.orderItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    dosage: item.dosage,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.subtotal,
                    isManual: item.isManual || false
                })),
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'orders'), orderData);

            console.log('Order created successfully:', orderNumber);

            // Show success
            this.showSuccess(`Order ${orderNumber} created successfully!`);
            
            // Clear order
            setTimeout(() => {
                this.clearOrder();
                createBtn.innerHTML = originalText;
            }, 1500);

        } catch (error) {
            console.error('Error creating order:', error);
            this.showError('Failed to create order: ' + error.message);
            createBtn.innerHTML = originalText;
            createBtn.disabled = false;
        }
    }

    clearOrder() {
        this.orderItems = [];
        this.removeSupplier();
        
        const notes = document.getElementById('orderNotes');
        if (notes) notes.value = '';

        const itemSearch = document.getElementById('orderItemSearch');
        if (itemSearch) itemSearch.value = '';

        const searchResults = document.getElementById('orderSearchResults');
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
        }

        const supplierDropdown = document.getElementById('supplierDropdown');
        if (supplierDropdown) supplierDropdown.value = '';

        this.updateOrderPreview();
    }

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        alert('Success: ' + message);
    }

    destroy() {
        // Cleanup listeners
        if (this.suppliersUnsubscribe) {
            this.suppliersUnsubscribe();
        }
        if (this.medicationsUnsubscribe) {
            this.medicationsUnsubscribe();
        }
        document.removeEventListener('pharmaflow-inventory-updated', this.handleInventoryBridgeUpdate);
    }
}

// Initialize when DOM is ready and module is active
function initOrderManager() {
    const orderModule = document.getElementById('module-orders-create');
    if (orderModule && !window.orderManager) {
        console.log('OrderManager: Initializing...');
        window.orderManager = new OrderManager();
    }
}

// Initialize on page load if module exists
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrderManager);
} else {
    initOrderManager();
}

// Re-initialize when navigating to the module
document.addEventListener('click', (e) => {
    const navLink = e.target.closest('[data-module="orders-create"]');
    if (navLink) {
        setTimeout(initOrderManager, 100);
    }
});

export default OrderManager;
