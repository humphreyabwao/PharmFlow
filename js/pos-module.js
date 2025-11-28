/**
 * PharmaFlow POS Module
 * Complete Point of Sale functionality with Firestore integration
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // Sample Inventory Data (Replace with actual data source)
    // ============================================
    const inventoryData = [
        { id: 1, name: 'Amoxicillin', dosage: '250mg', category: 'Antibiotics', price: 550.00, stock: 100, barcode: '1234567890123' },
        { id: 2, name: 'Ibuprofen', dosage: '200mg', category: 'Pain Relief', price: 375.00, stock: 150, barcode: '1234567890124' },
        { id: 3, name: 'Paracetamol', dosage: '500mg', category: 'Pain Relief', price: 120.00, stock: 200, barcode: '1234567890125' },
        { id: 4, name: 'Omeprazole', dosage: '20mg', category: 'Antacids', price: 450.00, stock: 80, barcode: '1234567890126' },
        { id: 5, name: 'Metformin', dosage: '500mg', category: 'Diabetes', price: 280.00, stock: 120, barcode: '1234567890127' },
        { id: 6, name: 'Amlodipine', dosage: '5mg', category: 'Cardiovascular', price: 320.00, stock: 90, barcode: '1234567890128' },
        { id: 7, name: 'Ciprofloxacin', dosage: '500mg', category: 'Antibiotics', price: 680.00, stock: 60, barcode: '1234567890129' },
        { id: 8, name: 'Loratadine', dosage: '10mg', category: 'Allergy', price: 250.00, stock: 140, barcode: '1234567890130' },
        { id: 9, name: 'Salbutamol Inhaler', dosage: '100mcg', category: 'Respiratory', price: 850.00, stock: 45, barcode: '1234567890131' },
        { id: 10, name: 'Vitamin C', dosage: '1000mg', category: 'Supplements', price: 180.00, stock: 300, barcode: '1234567890132' },
        { id: 11, name: 'Diclofenac', dosage: '50mg', category: 'Pain Relief', price: 220.00, stock: 110, barcode: '1234567890133' },
        { id: 12, name: 'Cetirizine', dosage: '10mg', category: 'Allergy', price: 150.00, stock: 180, barcode: '1234567890134' },
        { id: 13, name: 'Azithromycin', dosage: '250mg', category: 'Antibiotics', price: 720.00, stock: 55, barcode: '1234567890135' },
        { id: 14, name: 'Losartan', dosage: '50mg', category: 'Cardiovascular', price: 380.00, stock: 85, barcode: '1234567890136' },
        { id: 15, name: 'Multivitamin', dosage: 'Complex', category: 'Supplements', price: 450.00, stock: 200, barcode: '1234567890137' }
    ];

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
            manualItemPrice: document.getElementById('manualItemPrice'),
            manualItemQty: document.getElementById('manualItemQty'),
            
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
    function init() {
        cacheElements();
        bindEvents();
        updateCartDisplay();
        console.info('PharmaFlow POS module initialized with Firestore.');
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

    function searchInventory(query) {
        return inventoryData.filter(item => 
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.barcode.includes(query) ||
            item.dosage.toLowerCase().includes(query)
        ).slice(0, 10);
    }

    function displaySearchResults(results) {
        if (!elements.searchResults) return;

        if (results.length === 0) {
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
                        <div class="pos-search-item-name">${item.name}</div>
                        <div class="pos-search-item-details">${item.dosage} • ${item.category}</div>
                    </div>
                    <div class="pos-search-item-price">KSH ${item.price.toFixed(2)}</div>
                    <span class="pos-search-item-stock ${getStockClass(item.stock)}">${getStockLabel(item.stock)}</span>
                </div>
            `).join('');

            // Add click handlers to results
            elements.searchResults.querySelectorAll('.pos-search-item').forEach(el => {
                el.addEventListener('click', () => {
                    const itemId = parseInt(el.dataset.id);
                    const item = inventoryData.find(i => i.id === itemId);
                    if (item && item.stock > 0) {
                        addToCart(item);
                        hideSearchResults();
                        elements.searchInput.value = '';
                    }
                });
            });
        }

        elements.searchResults.classList.add('show');
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
                price: item.price,
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
    // Generate Receipt Number
    // ============================================
    function generateReceiptNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `RCP-${year}${month}${day}-${random}`;
    }

    // ============================================
    // Checkout - Save to Firestore
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

        const receiptNumber = generateReceiptNumber();

        // Create sale record for Firestore
        const sale = {
            receiptNumber: receiptNumber,
            customer: state.customer || 'Walk-in Customer',
            paymentMethod: state.paymentMethod,
            items: state.cartItems.map(item => ({
                id: item.id,
                name: item.name,
                dosage: item.dosage || '',
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity
            })),
            subtotal: state.subtotal,
            discount: state.discount,
            taxPercent: state.taxPercent,
            taxAmount: state.taxAmount,
            grandTotal: state.grandTotal,
            amountTendered: state.amountTendered,
            change: state.change,
            status: 'completed',
            createdAt: serverTimestamp()
        };

        try {
            // Disable checkout button while processing
            if (elements.checkoutBtn) {
                elements.checkoutBtn.disabled = true;
                elements.checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }

            // Save directly to Firestore
            const docRef = await addDoc(collection(db, 'sales'), sale);
            
            console.log('Sale saved to Firestore:', docRef.id);
            
            // Show success message
            showSuccessMessage(receiptNumber);
            
            // Reset POS
            resetPOS();

        } catch (error) {
            console.error('Error saving sale to Firestore:', error);
            alert(`Error saving sale: ${error.message}\n\nPlease check your internet connection and try again.`);
        } finally {
            if (elements.checkoutBtn) {
                elements.checkoutBtn.disabled = false;
                elements.checkoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
            }
        }
    }

    function showSuccessMessage(receiptNumber) {
        const message = `✅ Sale Completed Successfully!\n\n` +
            `Receipt: ${receiptNumber}\n` +
            `Total: KSH ${state.grandTotal.toFixed(2)}\n` +
            `Payment: ${state.paymentMethod.toUpperCase()}` +
            (state.paymentMethod === 'cash' ? `\nChange: KSH ${state.change.toFixed(2)}` : '');
        
        alert(message);
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
            elements.manualItemPrice.value = '';
            elements.manualItemQty.value = '1';
            elements.manualItemName.focus();
        }
    }

    function closeManualEntryModal() {
        if (elements.manualEntryModal) {
            elements.manualEntryModal.classList.remove('show');
        }
    }

    function handleManualAdd() {
        const name = elements.manualItemName?.value.trim();
        const price = parseFloat(elements.manualItemPrice?.value);
        const qty = parseInt(elements.manualItemQty?.value) || 1;

        if (!name) {
            alert('Please enter an item name.');
            return;
        }

        if (isNaN(price) || price <= 0) {
            alert('Please enter a valid price.');
            return;
        }

        const manualItem = {
            id: `manual-${Date.now()}`,
            name: name,
            dosage: '',
            price: price,
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
