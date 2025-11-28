// Wholesale Module - Real-time Firebase Integration
import { db, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, onSnapshot, Timestamp, where } from './firebase-config.js';

// State
let cart = [];
let selectedCustomer = null;
let allProducts = [];
let allCustomers = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initWholesaleModule();
});

function initWholesaleModule() {
    setupRealtimeListeners();
    setupEventListeners();
    console.log('Wholesale module initialized');
}

// Real-time listeners for products and customers
function setupRealtimeListeners() {
    // Listen to inventory/products
    const productsRef = collection(db, 'inventory');
    onSnapshot(productsRef, (snapshot) => {
        allProducts = [];
        snapshot.forEach((doc) => {
            allProducts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log('Products loaded:', allProducts.length);
    });
    
    // Listen to customers
    const customersRef = collection(db, 'customers');
    onSnapshot(customersRef, (snapshot) => {
        allCustomers = [];
        snapshot.forEach((doc) => {
            allCustomers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log('Customers loaded:', allCustomers.length);
    });
}

function setupEventListeners() {
    // Customer search
    const customerSearch = document.getElementById('wsCustomerSearch');
    if (customerSearch) {
        customerSearch.addEventListener('input', debounce((e) => {
            searchCustomers(e.target.value);
        }, 300));
        
        customerSearch.addEventListener('focus', () => {
            if (customerSearch.value) {
                searchCustomers(customerSearch.value);
            }
        });
    }
    
    // Product search
    const productSearch = document.getElementById('wsProductSearch');
    if (productSearch) {
        productSearch.addEventListener('input', debounce((e) => {
            searchProducts(e.target.value);
        }, 300));
        
        productSearch.addEventListener('focus', () => {
            if (productSearch.value) {
                searchProducts(productSearch.value);
            }
        });
    }
    
    // Discount and Tax inputs
    const discountInput = document.getElementById('wsDiscountAmount');
    const taxInput = document.getElementById('wsTaxPercent');
    
    if (discountInput) {
        discountInput.addEventListener('input', updateTotals);
    }
    
    if (taxInput) {
        taxInput.addEventListener('input', updateTotals);
    }
    
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ws-customer-search')) {
            document.getElementById('wsCustomerResults')?.classList.remove('active');
        }
        if (!e.target.closest('.ws-product-search')) {
            document.getElementById('wsProductResults')?.classList.remove('active');
        }
    });
}

// Customer Search
function searchCustomers(term) {
    const resultsDiv = document.getElementById('wsCustomerResults');
    if (!resultsDiv) return;
    
    if (!term || term.length < 2) {
        resultsDiv.classList.remove('active');
        return;
    }
    
    const filtered = allCustomers.filter(c => 
        c.name?.toLowerCase().includes(term.toLowerCase()) ||
        c.phone?.includes(term) ||
        c.business?.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 5);
    
    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="ws-result-item"><p class="ws-result-name">No customers found</p></div>';
    } else {
        resultsDiv.innerHTML = filtered.map(customer => `
            <div class="ws-result-item" onclick="selectCustomer('${customer.id}')">
                <p class="ws-result-name">${customer.name || 'Unknown'}</p>
                <p class="ws-result-info">${customer.phone || ''} ${customer.business ? '• ' + customer.business : ''}</p>
            </div>
        `).join('');
    }
    
    resultsDiv.classList.add('active');
}

// Select Customer
window.selectCustomer = function(customerId) {
    selectedCustomer = allCustomers.find(c => c.id === customerId);
    if (!selectedCustomer) return;
    
    const selectedDiv = document.getElementById('wsSelectedCustomer');
    selectedDiv.innerHTML = `
        <div class="ws-customer-info">
            <div class="ws-customer-details">
                <h4>${selectedCustomer.name}</h4>
                <p>${selectedCustomer.phone || ''} ${selectedCustomer.business ? '• ' + selectedCustomer.business : ''}</p>
            </div>
            <button class="ws-remove-customer" onclick="removeSelectedCustomer()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.getElementById('wsCustomerResults').classList.remove('active');
    document.getElementById('wsCustomerSearch').value = '';
};

window.removeSelectedCustomer = function() {
    selectedCustomer = null;
    document.getElementById('wsSelectedCustomer').innerHTML = '<p class="ws-no-customer">No customer selected (Walk-in)</p>';
};

// Product Search
function searchProducts(term) {
    const resultsDiv = document.getElementById('wsProductResults');
    if (!resultsDiv) return;
    
    if (!term || term.length < 2) {
        resultsDiv.classList.remove('active');
        return;
    }
    
    const filtered = allProducts.filter(p => 
        p.name?.toLowerCase().includes(term.toLowerCase()) ||
        p.code?.toLowerCase().includes(term.toLowerCase()) ||
        p.sku?.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 8);
    
    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="ws-result-item"><p class="ws-result-name">No products found</p></div>';
    } else {
        resultsDiv.innerHTML = filtered.map(product => `
            <div class="ws-result-item" onclick="addProductToCart('${product.id}')">
                <p class="ws-result-name">${product.name || 'Unknown'}</p>
                <p class="ws-result-info">Ksh ${formatNumber(product.wholesalePrice || product.sellingPrice || product.price || 0)} • Stock: ${product.quantity || product.stock || 0}</p>
            </div>
        `).join('');
    }
    
    resultsDiv.classList.add('active');
}

// Add Product to Cart
window.addProductToCart = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    // Check if already in cart
    const existingIndex = cart.findIndex(item => item.id === productId);
    
    if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.wholesalePrice || product.sellingPrice || product.price || 0,
            quantity: 1,
            isManual: false
        });
    }
    
    renderCart();
    document.getElementById('wsProductResults').classList.remove('active');
    document.getElementById('wsProductSearch').value = '';
    showNotification('Product added to cart', 'success');
};

// Add Manual Product
window.addManualProduct = function() {
    const name = document.getElementById('wsManualProductName').value.trim();
    const price = parseFloat(document.getElementById('wsManualProductPrice').value);
    const quantity = parseInt(document.getElementById('wsManualProductQty').value);
    
    if (!name) {
        showNotification('Please enter product name', 'error');
        return;
    }
    
    if (!price || price <= 0) {
        showNotification('Please enter valid price', 'error');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        showNotification('Please enter valid quantity', 'error');
        return;
    }
    
    cart.push({
        id: 'manual_' + Date.now(),
        name: name,
        price: price,
        quantity: quantity,
        isManual: true
    });
    
    renderCart();
    closeManualProductModal();
    document.getElementById('wsManualProductForm').reset();
    showNotification('Product added to cart', 'success');
};

// Render Cart
function renderCart() {
    const tbody = document.getElementById('wsCartBody');
    if (!tbody) return;
    
    if (cart.length === 0) {
        tbody.innerHTML = `
            <tr class="ws-cart-empty">
                <td colspan="5">
                    <i class="fas fa-shopping-basket"></i>
                    <p>Cart is empty</p>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = cart.map((item, index) => `
            <tr>
                <td class="ws-product-name">${item.name}</td>
                <td>
                    <input type="number" class="ws-price-input" value="${item.price}" 
                           min="0" step="0.01" onchange="updateCartItemPrice(${index}, this.value)">
                </td>
                <td>
                    <input type="number" class="ws-qty-input" value="${item.quantity}" 
                           min="1" onchange="updateCartItemQty(${index}, this.value)">
                </td>
                <td>Ksh ${formatNumber(item.price * item.quantity)}</td>
                <td>
                    <button class="ws-remove-item" onclick="removeCartItem(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    updateTotals();
    updateQuickStats();
}

// Update Cart Item Quantity
window.updateCartItemQty = function(index, value) {
    const qty = parseInt(value);
    if (qty && qty > 0) {
        cart[index].quantity = qty;
        renderCart();
    }
};

// Update Cart Item Price
window.updateCartItemPrice = function(index, value) {
    const price = parseFloat(value);
    if (price >= 0) {
        cart[index].price = price;
        renderCart();
    }
};

// Remove Cart Item
window.removeCartItem = function(index) {
    cart.splice(index, 1);
    renderCart();
};

// Clear Cart
window.clearWholesaleCart = function() {
    if (cart.length === 0) return;
    if (!confirm('Are you sure you want to clear the cart?')) return;
    
    cart = [];
    renderCart();
    showNotification('Cart cleared', 'success');
};

// Update Totals
function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = parseFloat(document.getElementById('wsDiscountAmount')?.value) || 0;
    const taxPercent = parseFloat(document.getElementById('wsTaxPercent')?.value) || 0;
    
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const grandTotal = afterDiscount + taxAmount;
    
    document.getElementById('wsSubtotal').textContent = `Ksh ${formatNumber(subtotal)}`;
    document.getElementById('wsTaxAmount').textContent = `+ Ksh ${formatNumber(taxAmount)}`;
    document.getElementById('wsGrandTotal').textContent = `Ksh ${formatNumber(grandTotal)}`;
}

// Update Quick Stats
function updateQuickStats() {
    document.getElementById('wsCartCount').textContent = cart.length;
    document.getElementById('wsTotalQty').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

// Show/Hide Loading
function showLoading(message = 'Processing...') {
    let overlay = document.getElementById('wsLoadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'wsLoadingOverlay';
        overlay.className = 'ws-loading-overlay';
        overlay.innerHTML = `
            <div class="ws-loading-content">
                <div class="ws-spinner"></div>
                <p class="ws-loading-text">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.ws-loading-text').textContent = message;
    }
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('wsLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Process Sale
window.processWholesaleSale = async function() {
    if (cart.length === 0) {
        showNotification('Cart is empty', 'error');
        return;
    }
    
    // Show loading animation
    showLoading('Processing Sale...');
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = parseFloat(document.getElementById('wsDiscountAmount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('wsTaxPercent').value) || 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const grandTotal = afterDiscount + taxAmount;
    
    const paymentMethod = document.querySelector('input[name="wsPayment"]:checked')?.value || 'cash';
    const notes = document.getElementById('wsOrderNotes').value.trim();
    
    try {
        const saleData = {
            type: 'wholesale',
            customer: selectedCustomer ? {
                id: selectedCustomer.id,
                name: selectedCustomer.name,
                phone: selectedCustomer.phone || '',
                business: selectedCustomer.business || ''
            } : null,
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity,
                isManual: item.isManual
            })),
            subtotal: subtotal,
            discountAmount: discountAmount,
            taxPercent: taxPercent,
            taxAmount: taxAmount,
            grandTotal: grandTotal,
            paymentMethod: paymentMethod,
            notes: notes,
            status: 'completed',
            createdAt: Timestamp.now()
        };
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, 'wholesaleSales'), saleData);
        
        console.log('Wholesale sale saved:', docRef.id);
        
        // Update inventory for non-manual items
        for (const item of cart) {
            if (!item.isManual) {
                const product = allProducts.find(p => p.id === item.id);
                if (product) {
                    const newStock = (product.quantity || product.stock || 0) - item.quantity;
                    await updateDoc(doc(db, 'inventory', item.id), {
                        quantity: Math.max(0, newStock),
                        stock: Math.max(0, newStock),
                        updatedAt: Timestamp.now()
                    });
                }
            }
        }
        
        showNotification('Sale processed successfully!', 'success');
        
        // Reset form
        cart = [];
        selectedCustomer = null;
        document.getElementById('wsSelectedCustomer').innerHTML = '<p class="ws-no-customer">No customer selected (Walk-in)</p>';
        document.getElementById('wsDiscountAmount').value = 0;
        document.getElementById('wsTaxPercent').value = 0;
        document.getElementById('wsOrderNotes').value = '';
        document.querySelector('input[name="wsPayment"][value="cash"]').checked = true;
        renderCart();
        
        // Hide loading
        hideLoading();
        
    } catch (error) {
        console.error('Error processing sale:', error);
        hideLoading();
        showNotification('Error processing sale. Please try again.', 'error');
    }
};

// Save Draft
window.saveWholesaleDraft = async function() {
    if (cart.length === 0) {
        showNotification('Cart is empty', 'error');
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = parseFloat(document.getElementById('wsDiscountAmount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('wsTaxPercent').value) || 0;
    const notes = document.getElementById('wsOrderNotes').value.trim();
    
    try {
        const draftData = {
            type: 'wholesale',
            customer: selectedCustomer ? {
                id: selectedCustomer.id,
                name: selectedCustomer.name,
                phone: selectedCustomer.phone || ''
            } : null,
            items: cart,
            subtotal: subtotal,
            discountAmount: discountAmount,
            taxPercent: taxPercent,
            notes: notes,
            status: 'draft',
            createdAt: Timestamp.now()
        };
        
        await addDoc(collection(db, 'wholesaleSales'), draftData);
        showNotification('Draft saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving draft:', error);
        showNotification('Error saving draft', 'error');
    }
};

// Hold Order
window.holdWholesaleOrder = function() {
    if (cart.length === 0) {
        showNotification('Cart is empty', 'error');
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = parseFloat(document.getElementById('wsDiscountAmount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('wsTaxPercent').value) || 0;
    const notes = document.getElementById('wsOrderNotes').value.trim();
    
    const holdData = {
        customer: selectedCustomer,
        items: [...cart],
        subtotal: subtotal,
        discountAmount: discountAmount,
        taxPercent: taxPercent,
        notes: notes,
        holdTime: new Date().toISOString()
    };
    
    // Get existing held orders
    let heldOrders = JSON.parse(localStorage.getItem('wholesaleHeldOrders') || '[]');
    heldOrders.push(holdData);
    localStorage.setItem('wholesaleHeldOrders', JSON.stringify(heldOrders));
    
    showNotification('Order held successfully! You can resume later.', 'success');
    
    // Clear current cart
    cart = [];
    selectedCustomer = null;
    renderCart();
    updateSelectedCustomerDisplay();
    document.getElementById('wsDiscountAmount').value = '0';
    document.getElementById('wsTaxPercent').value = '0';
    document.getElementById('wsOrderNotes').value = '';
};

// Modal Functions
window.openAddCustomerModal = function() {
    document.getElementById('wsAddCustomerModal').classList.add('active');
};

window.closeAddCustomerModal = function() {
    document.getElementById('wsAddCustomerModal').classList.remove('active');
    document.getElementById('wsQuickCustomerForm').reset();
};

window.openManualProductModal = function() {
    document.getElementById('wsManualProductModal').classList.add('active');
};

window.closeManualProductModal = function() {
    document.getElementById('wsManualProductModal').classList.remove('active');
    document.getElementById('wsManualProductForm').reset();
};

// Save Quick Customer
window.saveQuickCustomer = async function() {
    const name = document.getElementById('wsNewCustomerName').value.trim();
    const phone = document.getElementById('wsNewCustomerPhone').value.trim();
    const email = document.getElementById('wsNewCustomerEmail').value.trim();
    const business = document.getElementById('wsNewCustomerBusiness').value.trim();
    const address = document.getElementById('wsNewCustomerAddress').value.trim();
    
    if (!name) {
        showNotification('Please enter customer name', 'error');
        return;
    }
    
    if (!phone) {
        showNotification('Please enter phone number', 'error');
        return;
    }
    
    try {
        const customerData = {
            name: name,
            phone: phone,
            email: email || '',
            business: business || '',
            address: address || '',
            type: 'wholesale',
            createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(collection(db, 'customers'), customerData);
        
        // Auto-select the new customer
        selectedCustomer = { id: docRef.id, ...customerData };
        document.getElementById('wsSelectedCustomer').innerHTML = `
            <div class="ws-customer-info">
                <div class="ws-customer-details">
                    <h4>${name}</h4>
                    <p>${phone} ${business ? '• ' + business : ''}</p>
                </div>
                <button class="ws-remove-customer" onclick="removeSelectedCustomer()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        closeAddCustomerModal();
        showNotification('Customer added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding customer:', error);
        showNotification('Error adding customer', 'error');
    }
};

// Helper Functions
function formatNumber(num) {
    if (!num && num !== 0) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.ws-notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `ws-notification ws-notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        backgroundColor: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '10000',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        animation: 'slideIn 0.3s ease'
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
