/**
 * PharmaFlow POS Module
 * Complete Point of Sale functionality with inventory search, cart management, and checkout
 */
(function(window, document) {
    'use strict';

    // ============================================
    // Firebase Firestore imports
    // ============================================
    let db = null;
    let collection, query, where, orderBy, limit, getDocs, onSnapshot;

    // ============================================
    // Real-time Inventory Data from Firestore
    // ============================================
    let inventoryData = [];
    let unsubscribeInventory = null;

    // ============================================
    // State Management
    // ============================================
    const state = {
        cartItems: [],
        subtotal: 0,
        discount: 0,
        taxPercent: 0,
        taxAmount: 0,
        grandTotal: 0,
        amountTendered: 0,
        change: 0,
        paymentMethod: 'cash',
        customer: ''
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Search
            searchInput: document.getElementById('posSearchInput'),
            searchResults: document.getElementById('posSearchResults'),
            scannerBtn: document.getElementById('posScannerBtn'),
            manualAddBtn: document.getElementById('posManualAddBtn'),
            
            // Cart
            cartBody: document.getElementById('posCartBody'),
            cartEmpty: document.getElementById('posCartEmpty'),
            clearCartBtn: document.getElementById('posClearCartBtn'),
            
            // Checkout
            subtotal: document.getElementById('posSubtotal'),
            discountInput: document.getElementById('posDiscount'),
            taxInput: document.getElementById('posTax'),
            taxAmount: document.getElementById('posTaxAmount'),
            grandTotal: document.getElementById('posGrandTotal'),
            viewAllSalesBtn: document.getElementById('posViewAllSalesBtn'),
            
            // Payment
            paymentMethods: document.querySelectorAll('.pos-payment-method'),
            tenderedSection: document.getElementById('posTenderedSection'),
            amountTendered: document.getElementById('posAmountTendered'),
            change: document.getElementById('posChange'),
            
            // Customer
            customerInput: document.getElementById('posCustomer'),
            
            // Actions
            holdBtn: document.getElementById('posHoldBtn'),
            checkoutBtn: document.getElementById('posCheckoutBtn'),
            
            // Manual Entry Modal
            manualEntryModal: document.getElementById('posManualEntryModal'),
            manualEntryClose: document.getElementById('posManualEntryClose'),
            manualEntryCancel: document.getElementById('posManualEntryCancel'),
            manualEntryAdd: document.getElementById('posManualEntryAdd'),
            manualItemName: document.getElementById('manualItemName'),
            manualItemCostPrice: document.getElementById('manualItemCostPrice'),
            manualItemPrice: document.getElementById('manualItemPrice'),
            manualItemQty: document.getElementById('manualItemQty'),
            manualItemProfit: document.getElementById('manualItemProfit'),
            
            // Scanner Modal
            scannerModal: document.getElementById('posScannerModal'),
            scannerClose: document.getElementById('posScannerClose'),
            scannerCancel: document.getElementById('posScannerCancel'),
            barcodeInput: document.getElementById('posBarcodeInput')
        };
    }

    // ============================================
    // Initialize Module
    // ============================================
    async function init() {
        cacheElements();
        await initFirebase();
        bindEvents();
        setupInventoryListener();
        updateCartDisplay();
        console.info('PharmaFlow POS module initialized.');
    }

    // ============================================
    // Firebase Initialization
    // ============================================
    async function initFirebase() {
        try {
            // Wait for Firebase to be available
            let attempts = 0;
            while (!window.PharmaFlowFirebase && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.PharmaFlowFirebase) {
                console.error('POS: Firebase not available');
                return;
            }

            db = window.PharmaFlowFirebase.db;

            // Import Firestore functions
            const firestore = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            collection = firestore.collection;
            query = firestore.query;
            where = firestore.where;
            orderBy = firestore.orderBy;
            limit = firestore.limit;
            getDocs = firestore.getDocs;
            onSnapshot = firestore.onSnapshot;

            console.info('POS: Firebase initialized successfully');
        } catch (error) {
            console.error('POS: Failed to initialize Firebase:', error);
        }
    }

    // ============================================
    // Real-time Inventory Listener
    // ============================================
    function setupInventoryListener() {
        if (!db || !collection || !onSnapshot) {
            console.warn('POS: Firebase not ready, inventory will be empty');
            return;
        }

        try {
            const inventoryRef = collection(db, 'inventory');
            const inventoryQuery = query(inventoryRef, orderBy('name'));

            unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
                inventoryData = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    inventoryData.push({
                        id: doc.id,
                        name: data.name || '',
                        genericName: data.genericName || '',
                        dosage: data.strength || data.dosageForm || '',
                        category: data.category || '',
                        price: parseFloat(data.sellingPrice) || 0,
                        costPrice: parseFloat(data.costPrice) || 0,
                        stock: parseInt(data.quantity) || 0,
                        barcode: data.barcode || '',
                        unit: data.unit || 'pieces',
                        manufacturer: data.manufacturer || '',
                        expiryDate: data.expiryDate || '',
                        prescriptionRequired: data.prescriptionRequired || false
                    });
                });
                console.info(`POS: Loaded ${inventoryData.length} inventory items`);
            }, (error) => {
                console.error('POS: Error listening to inventory:', error);
            });
        } catch (error) {
            console.error('POS: Failed to setup inventory listener:', error);
        }
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        // Search functionality
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
            elements.searchInput.addEventListener('focus', handleSearchFocus);
            document.addEventListener('click', handleClickOutside);
        }

        // Scanner button
        if (elements.scannerBtn) {
            elements.scannerBtn.addEventListener('click', openScannerModal);
        }

        // Manual add button
        if (elements.manualAddBtn) {
            elements.manualAddBtn.addEventListener('click', openManualEntryModal);
        }

        // Clear cart
        if (elements.clearCartBtn) {
            elements.clearCartBtn.addEventListener('click', clearCart);
        }

        // Discount and Tax inputs
        if (elements.discountInput) {
            elements.discountInput.addEventListener('input', recalculateTotals);
        }
        if (elements.taxInput) {
            elements.taxInput.addEventListener('input', recalculateTotals);
        }

        // Amount tendered
        if (elements.amountTendered) {
            elements.amountTendered.addEventListener('input', calculateChange);
        }

        // Payment methods
        elements.paymentMethods.forEach(btn => {
            btn.addEventListener('click', handlePaymentMethodChange);
        });

        // Checkout button
        if (elements.checkoutBtn) {
            elements.checkoutBtn.addEventListener('click', handleCheckout);
        }

        // Hold button
        if (elements.holdBtn) {
            elements.holdBtn.addEventListener('click', handleHold);
        }

        // View All Sales button
        if (elements.viewAllSalesBtn) {
            elements.viewAllSalesBtn.addEventListener('click', navigateToAllSales);
        }

        // Manual Entry Modal
        if (elements.manualEntryClose) {
            elements.manualEntryClose.addEventListener('click', closeManualEntryModal);
        }
        if (elements.manualEntryCancel) {
            elements.manualEntryCancel.addEventListener('click', closeManualEntryModal);
        }
        if (elements.manualEntryAdd) {
            elements.manualEntryAdd.addEventListener('click', handleManualAdd);
        }
        // Real-time profit calculation
        if (elements.manualItemCostPrice) {
            elements.manualItemCostPrice.addEventListener('input', updateProfitDisplay);
        }
        if (elements.manualItemPrice) {
            elements.manualItemPrice.addEventListener('input', updateProfitDisplay);
        }

        // Scanner Modal
        if (elements.scannerClose) {
            elements.scannerClose.addEventListener('click', closeScannerModal);
        }
        if (elements.scannerCancel) {
            elements.scannerCancel.addEventListener('click', closeScannerModal);
        }
        if (elements.barcodeInput) {
            elements.barcodeInput.addEventListener('keypress', handleBarcodeInput);
        }

        // Customer input
        if (elements.customerInput) {
            elements.customerInput.addEventListener('input', (e) => {
                state.customer = e.target.value;
            });
        }
    }

    // ============================================
    // Navigation
    // ============================================
    function navigateToAllSales() {
        // Navigate to the All Sales module
        const salesLink = document.querySelector('.submenu-link[data-module="pharmacy-sales"]');
        if (salesLink) {
            salesLink.click();
        }
    }

    // ============================================
    // Search Functionality
    // ============================================
    function handleSearch(e) {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length < 2) {
            hideSearchResults();
            return;
        }

        const results = searchInventory(query);
        displaySearchResults(results);
    }

    function handleSearchFocus() {
        const query = elements.searchInput.value.trim().toLowerCase();
        if (query.length >= 2) {
            const results = searchInventory(query);
            displaySearchResults(results);
        }
    }

    function searchInventory(searchQuery) {
        if (!inventoryData || inventoryData.length === 0) {
            return [];
        }

        return inventoryData.filter(item => {
            const name = (item.name || '').toLowerCase();
            const genericName = (item.genericName || '').toLowerCase();
            const category = (item.category || '').toLowerCase();
            const barcode = (item.barcode || '').toLowerCase();
            const dosage = (item.dosage || '').toLowerCase();
            const manufacturer = (item.manufacturer || '').toLowerCase();

            return name.includes(searchQuery) ||
                   genericName.includes(searchQuery) ||
                   category.includes(searchQuery) ||
                   barcode.includes(searchQuery) ||
                   dosage.includes(searchQuery) ||
                   manufacturer.includes(searchQuery);
        }).slice(0, 10);
    }

    function displaySearchResults(results) {
        if (!elements.searchResults) return;

        if (inventoryData.length === 0) {
            elements.searchResults.innerHTML = `
                <div class="pos-search-empty">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading inventory...</p>
                </div>
            `;
        } else if (results.length === 0) {
            elements.searchResults.innerHTML = `
                <div class="pos-search-empty">
                    <i class="fas fa-search"></i>
                    <p>No items found</p>
                </div>
            `;
        } else {
            elements.searchResults.innerHTML = results.map(item => `
                <div class="pos-search-item" data-id="${item.id}">
                    <div class="pos-search-item-info">
                        <div class="pos-search-item-name">${escapeHtml(item.name)}</div>
                        <div class="pos-search-item-details">
                            ${escapeHtml(item.dosage)}${item.dosage && item.category ? ' • ' : ''}${escapeHtml(item.category)}
                            ${item.genericName ? `<span class="pos-search-generic">(${escapeHtml(item.genericName)})</span>` : ''}
                        </div>
                    </div>
                    <div class="pos-search-item-price">KSH ${item.price.toFixed(2)}</div>
                    <span class="pos-search-item-stock ${getStockClass(item.stock)}">${getStockLabel(item.stock)}</span>
                </div>
            `).join('');

            // Add click handlers to results
            elements.searchResults.querySelectorAll('.pos-search-item').forEach(el => {
                el.addEventListener('click', () => {
                    const itemId = el.dataset.id;
                    const item = inventoryData.find(i => i.id === itemId);
                    if (item && item.stock > 0) {
                        addToCart(item);
                        hideSearchResults();
                        elements.searchInput.value = '';
                    } else if (item && item.stock <= 0) {
                        showNotification('Item is out of stock', 'warning');
                    }
                });
            });
        }

        elements.searchResults.classList.add('show');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function hideSearchResults() {
        if (elements.searchResults) {
            elements.searchResults.classList.remove('show');
        }
    }

    function handleClickOutside(e) {
        if (!e.target.closest('.pos-search-section')) {
            hideSearchResults();
        }
    }

    function getStockClass(stock) {
        if (stock === 0) return 'out-of-stock';
        if (stock < 20) return 'low-stock';
        return 'in-stock';
    }

    function getStockLabel(stock) {
        if (stock === 0) return 'Out of Stock';
        if (stock < 20) return `Low: ${stock}`;
        return `In Stock: ${stock}`;
    }

    // ============================================
    // Cart Management
    // ============================================
    function addToCart(item, quantity = 1) {
        const existingIndex = state.cartItems.findIndex(i => i.id === item.id);
        
        if (existingIndex > -1) {
            state.cartItems[existingIndex].quantity += quantity;
        } else {
            state.cartItems.push({
                id: item.id,
                name: item.name,
                dosage: item.dosage || '',
                costPrice: item.costPrice || 0,
                price: item.price,
                profit: item.profit || 0,
                quantity: quantity,
                isManual: item.isManual || false
            });
        }

        updateCartDisplay();
        recalculateTotals();
    }

    function removeFromCart(index) {
        state.cartItems.splice(index, 1);
        updateCartDisplay();
        recalculateTotals();
    }

    function updateQuantity(index, change) {
        const item = state.cartItems[index];
        const newQty = item.quantity + change;
        
        if (newQty <= 0) {
            removeFromCart(index);
        } else {
            item.quantity = newQty;
            updateCartDisplay();
            recalculateTotals();
        }
    }

    function clearCart() {
        if (state.cartItems.length === 0) return;
        
        if (confirm('Are you sure you want to clear the cart?')) {
            state.cartItems = [];
            updateCartDisplay();
            recalculateTotals();
        }
    }

    function updateCartDisplay() {
        if (!elements.cartBody || !elements.cartEmpty) return;

        if (state.cartItems.length === 0) {
            elements.cartBody.innerHTML = '';
            elements.cartEmpty.style.display = 'flex';
            elements.cartBody.closest('.pos-cart-table-wrapper').style.display = 'none';
        } else {
            elements.cartEmpty.style.display = 'none';
            elements.cartBody.closest('.pos-cart-table-wrapper').style.display = 'block';
            
            elements.cartBody.innerHTML = state.cartItems.map((item, index) => `
                <tr>
                    <td>
                        <div class="pos-cart-item-name">${item.name}</div>
                        ${item.dosage ? `<div class="pos-cart-item-dosage">${item.dosage}</div>` : ''}
                    </td>
                    <td>KSH ${item.price.toFixed(2)}</td>
                    <td>
                        <div class="pos-qty-control">
                            <button class="pos-qty-btn" onclick="PharmaFlowPOS.updateQuantity(${index}, -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="pos-qty-value">${item.quantity}</span>
                            <button class="pos-qty-btn" onclick="PharmaFlowPOS.updateQuantity(${index}, 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </td>
                    <td><strong>KSH ${(item.price * item.quantity).toFixed(2)}</strong></td>
                    <td>
                        <button class="pos-remove-btn" onclick="PharmaFlowPOS.removeFromCart(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // ============================================
    // Calculations
    // ============================================
    function recalculateTotals() {
        // Calculate subtotal
        state.subtotal = state.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Get discount (in KSH)
        state.discount = parseFloat(elements.discountInput?.value) || 0;
        
        // Get tax percentage
        state.taxPercent = parseFloat(elements.taxInput?.value) || 0;
        
        // Calculate tax amount after discount
        const afterDiscount = state.subtotal - state.discount;
        state.taxAmount = (afterDiscount * state.taxPercent) / 100;
        
        // Calculate grand total
        state.grandTotal = afterDiscount + state.taxAmount;
        if (state.grandTotal < 0) state.grandTotal = 0;

        // Update display
        updateTotalsDisplay();
        calculateChange();
    }

    function updateTotalsDisplay() {
        if (elements.subtotal) {
            elements.subtotal.textContent = `KSH ${state.subtotal.toFixed(2)}`;
        }
        if (elements.taxAmount) {
            elements.taxAmount.textContent = `KSH ${state.taxAmount.toFixed(2)}`;
        }
        if (elements.grandTotal) {
            elements.grandTotal.textContent = `KSH ${state.grandTotal.toFixed(2)}`;
        }
    }

    function calculateChange() {
        state.amountTendered = parseFloat(elements.amountTendered?.value) || 0;
        state.change = state.amountTendered - state.grandTotal;
        
        if (elements.change) {
            elements.change.textContent = `KSH ${state.change.toFixed(2)}`;
            elements.change.classList.toggle('negative', state.change < 0);
        }
    }

    // ============================================
    // Payment Methods
    // ============================================
    function handlePaymentMethodChange(e) {
        const btn = e.currentTarget;
        state.paymentMethod = btn.dataset.method;
        
        elements.paymentMethods.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show/hide tendered section based on payment method
        if (elements.tenderedSection) {
            elements.tenderedSection.style.display = state.paymentMethod === 'cash' ? 'block' : 'none';
        }
    }

    // ============================================
    // Checkout
    // ============================================
    async function handleCheckout() {
        if (state.cartItems.length === 0) {
            alert('Cart is empty. Please add items before checkout.');
            return;
        }

        if (state.paymentMethod === 'cash' && state.amountTendered < state.grandTotal) {
            alert('Amount tendered is less than the total. Please collect sufficient payment.');
            return;
        }

        // Create sale record
        const sale = {
            id: Date.now(),
            items: [...state.cartItems],
            subtotal: state.subtotal,
            discount: state.discount,
            taxPercent: state.taxPercent,
            taxAmount: state.taxAmount,
            grandTotal: state.grandTotal,
            paymentMethod: state.paymentMethod,
            amountTendered: state.amountTendered,
            change: state.change,
            customer: state.customer || 'Walk-in Customer',
            timestamp: new Date().toISOString()
        };

        // Save to Firestore via Sales module
        if (window.PharmaFlowSales && typeof window.PharmaFlowSales.addSaleFromPOS === 'function') {
            try {
                // Disable checkout button while processing
                if (elements.checkoutBtn) {
                    elements.checkoutBtn.disabled = true;
                    elements.checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                }

                const result = await window.PharmaFlowSales.addSaleFromPOS(sale);
                
                if (result.success) {
                    console.log('Sale saved to Firestore:', result.id);
                    alert(`Sale completed successfully!\n\nReceipt: ${result.receiptNumber}\nTotal: KSH ${state.grandTotal.toFixed(2)}\nPayment: ${state.paymentMethod.toUpperCase()}\n${state.paymentMethod === 'cash' ? `Change: KSH ${state.change.toFixed(2)}` : ''}`);
                } else {
                    console.error('Failed to save sale:', result.error);
                    alert(`Sale completed locally but failed to sync.\n\nTotal: KSH ${state.grandTotal.toFixed(2)}\nPayment: ${state.paymentMethod.toUpperCase()}`);
                }
            } catch (error) {
                console.error('Error saving sale:', error);
                alert(`Sale completed!\n\nTotal: KSH ${state.grandTotal.toFixed(2)}\nPayment: ${state.paymentMethod.toUpperCase()}`);
            } finally {
                if (elements.checkoutBtn) {
                    elements.checkoutBtn.disabled = false;
                    elements.checkoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
                }
            }
        } else {
            console.log('Sale completed (local only):', sale);
            alert(`Sale completed successfully!\n\nTotal: KSH ${state.grandTotal.toFixed(2)}\nPayment: ${state.paymentMethod.toUpperCase()}\n${state.paymentMethod === 'cash' ? `Change: KSH ${state.change.toFixed(2)}` : ''}`);
        }
        
        // Reset POS
        resetPOS();
    }

    function handleHold() {
        if (state.cartItems.length === 0) {
            alert('Cart is empty. Nothing to hold.');
            return;
        }

        const heldOrder = {
            id: Date.now(),
            items: [...state.cartItems],
            customer: state.customer || 'Walk-in Customer',
            timestamp: new Date().toISOString()
        };

        console.log('Order held:', heldOrder);
        alert('Order has been placed on hold.');
        resetPOS();
    }

    function resetPOS() {
        state.cartItems = [];
        state.subtotal = 0;
        state.discount = 0;
        state.taxPercent = 0;
        state.taxAmount = 0;
        state.grandTotal = 0;
        state.amountTendered = 0;
        state.change = 0;
        state.customer = '';

        if (elements.discountInput) elements.discountInput.value = '0';
        if (elements.taxInput) elements.taxInput.value = '0';
        if (elements.amountTendered) elements.amountTendered.value = '0';
        if (elements.customerInput) elements.customerInput.value = '';

        updateCartDisplay();
        recalculateTotals();
    }

    // ============================================
    // Manual Entry Modal
    // ============================================
    function openManualEntryModal() {
        if (elements.manualEntryModal) {
            elements.manualEntryModal.classList.add('show');
            elements.manualItemName.value = '';
            elements.manualItemCostPrice.value = '';
            elements.manualItemPrice.value = '';
            elements.manualItemQty.value = '1';
            if (elements.manualItemProfit) {
                elements.manualItemProfit.textContent = 'KSH 0.00';
                elements.manualItemProfit.className = 'profit-display';
            }
            elements.manualItemName.focus();
        }
    }

    function closeManualEntryModal() {
        if (elements.manualEntryModal) {
            elements.manualEntryModal.classList.remove('show');
        }
    }

    function updateProfitDisplay() {
        const costPrice = parseFloat(elements.manualItemCostPrice?.value) || 0;
        const sellingPrice = parseFloat(elements.manualItemPrice?.value) || 0;
        const profit = sellingPrice - costPrice;
        
        if (elements.manualItemProfit) {
            elements.manualItemProfit.textContent = `KSH ${profit.toFixed(2)}`;
            
            // Add color based on profit/loss
            if (profit > 0) {
                elements.manualItemProfit.className = 'profit-display profit-positive';
            } else if (profit < 0) {
                elements.manualItemProfit.className = 'profit-display profit-negative';
            } else {
                elements.manualItemProfit.className = 'profit-display';
            }
        }
    }

    function handleManualAdd() {
        const name = elements.manualItemName?.value.trim();
        const costPrice = parseFloat(elements.manualItemCostPrice?.value);
        const sellingPrice = parseFloat(elements.manualItemPrice?.value);
        const qty = parseInt(elements.manualItemQty?.value) || 1;

        if (!name) {
            alert('Please enter an item name.');
            return;
        }

        if (isNaN(costPrice) || costPrice < 0) {
            alert('Please enter a valid cost price.');
            return;
        }

        if (isNaN(sellingPrice) || sellingPrice <= 0) {
            alert('Please enter a valid selling price.');
            return;
        }

        if (sellingPrice < costPrice) {
            if (!confirm('Selling price is less than cost price. You will make a loss. Continue anyway?')) {
                return;
            }
        }

        const manualItem = {
            id: `manual-${Date.now()}`,
            name: name,
            dosage: '',
            costPrice: costPrice,
            price: sellingPrice,
            profit: sellingPrice - costPrice,
            isManual: true
        };

        addToCart(manualItem, qty);
        closeManualEntryModal();
    }

    // ============================================
    // Scanner Modal
    // ============================================
    function openScannerModal() {
        if (elements.scannerModal) {
            elements.scannerModal.classList.add('show');
            elements.barcodeInput.value = '';
            elements.barcodeInput.focus();
        }
    }

    function closeScannerModal() {
        if (elements.scannerModal) {
            elements.scannerModal.classList.remove('show');
        }
    }

    function handleBarcodeInput(e) {
        if (e.key === 'Enter') {
            const barcode = elements.barcodeInput.value.trim();
            if (barcode) {
                const item = inventoryData.find(i => i.barcode === barcode);
                if (item) {
                    addToCart(item);
                    elements.barcodeInput.value = '';
                    closeScannerModal();
                } else {
                    alert('Item not found. Please check the barcode.');
                }
            }
        }
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

    function showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.pos-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `pos-notification pos-notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ============================================
    // Global Functions for External Access
    // ============================================
    function getInventory() {
        return [...inventoryData];
    }

    function searchItems(query) {
        return searchInventory(query.toLowerCase());
    }

    function getCartSnapshot() {
        return {
            items: [...state.cartItems],
            subtotal: state.subtotal,
            discount: state.discount,
            taxPercent: state.taxPercent,
            taxAmount: state.taxAmount,
            grandTotal: state.grandTotal,
            paymentMethod: state.paymentMethod
        };
    }

    // ============================================
    // Initialize on DOM Ready
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================
    // Expose Public API
    // ============================================
    window.PharmaFlowPOS = {
        init,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getInventory,
        searchItems,
        getCartSnapshot,
        resetPOS
    };

})(window, document);
