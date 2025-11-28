/**
 * PharmaFlow Inventory Module
 * Handles inventory management with Firebase Firestore
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot, 
    query, 
    orderBy,
    where,
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
        editingItem: null,
        currentBarcode: '',
        scannedBarcode: ''
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Form
            form: document.getElementById('addInventoryForm'),
            
            // Basic Info
            itemName: document.getElementById('invItemName'),
            genericName: document.getElementById('invGenericName'),
            category: document.getElementById('invCategory'),
            dosageForm: document.getElementById('invDosageForm'),
            strength: document.getElementById('invStrength'),
            manufacturer: document.getElementById('invManufacturer'),
            
            // Stock & Pricing
            quantity: document.getElementById('invQuantity'),
            unit: document.getElementById('invUnit'),
            costPrice: document.getElementById('invCostPrice'),
            sellingPrice: document.getElementById('invSellingPrice'),
            reorderLevel: document.getElementById('invReorderLevel'),
            profitMargin: document.getElementById('invProfitMargin'),
            
            // Expiry & Batch
            batchNumber: document.getElementById('invBatchNumber'),
            expiryDate: document.getElementById('invExpiryDate'),
            manufactureDate: document.getElementById('invManufactureDate'),
            barcode: document.getElementById('invBarcode'),
            
            // Additional
            location: document.getElementById('invLocation'),
            supplier: document.getElementById('invSupplier'),
            description: document.getElementById('invDescription'),
            prescriptionRequired: document.getElementById('invPrescriptionRequired'),
            
            // Actions
            cancelBtn: document.getElementById('invCancelBtn'),
            saveDraftBtn: document.getElementById('invSaveDraftBtn'),
            submitBtn: document.getElementById('invSubmitBtn'),

            // Barcode
            generateBarcodeBtn: document.getElementById('generateBarcodeBtn'),
            printBarcodeBtn: document.getElementById('printBarcodeBtn'),

            // Barcode Modal
            barcodeModal: document.getElementById('barcodePrintModal'),
            closeBarcodeModal: document.getElementById('closeBarcodeModal'),
            cancelBarcodePrint: document.getElementById('cancelBarcodePrint'),
            confirmBarcodePrint: document.getElementById('confirmBarcodePrint'),
            barcodePreviewSvg: document.getElementById('barcodePreviewSvg'),
            barcodeProductName: document.getElementById('barcodeProductName'),
            barcodePriceTag: document.getElementById('barcodePriceTag'),
            barcodeCopies: document.getElementById('barcodeCopies'),
            barcodeSize: document.getElementById('barcodeSize'),
            showProductName: document.getElementById('showProductName'),
            showPrice: document.getElementById('showPrice'),

            // Header Buttons
            scanInventoryBtn: document.getElementById('scanInventoryBtn'),
            viewInventoryBtn: document.getElementById('viewInventoryBtn'),

            // Scan Modal
            scanModal: document.getElementById('barcodeScanModal'),
            closeScanModal: document.getElementById('closeScanModal'),
            cancelScan: document.getElementById('cancelScan'),
            scanBarcodeInput: document.getElementById('scanBarcodeInput'),
            searchBarcodeBtn: document.getElementById('searchBarcodeBtn'),
            scanResult: document.getElementById('scanResult'),
            scanResultFound: document.getElementById('scanResultFound'),
            scanResultNotFound: document.getElementById('scanResultNotFound'),
            foundProductName: document.getElementById('foundProductName'),
            foundProductBarcode: document.getElementById('foundProductBarcode'),
            foundProductStock: document.getElementById('foundProductStock'),
            editFoundProduct: document.getElementById('editFoundProduct'),
            addNewWithBarcode: document.getElementById('addNewWithBarcode')
        };
    }

    // ============================================
    // Initialize
    // ============================================
    function init() {
        cacheElements();
        bindEvents();
        startRealtimeListener();
        setDefaultExpiryDate();
        generateNewBarcode(); // Auto-generate barcode on init
        checkForEditingItem(); // Check if editing from view module
        console.info('PharmaFlow Inventory module initialized.');
    }

    // Check if there's an item to edit from the view module
    function checkForEditingItem() {
        if (window.editingInventoryItem) {
            const item = window.editingInventoryItem;
            populateFormWithItem(item);
            state.editingItem = item;
            if (elements.submitBtn) {
                elements.submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Inventory';
            }
            window.editingInventoryItem = null; // Clear the flag
        }
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        // Form submission
        if (elements.form) {
            elements.form.addEventListener('submit', handleSubmit);
        }

        // Profit margin calculation
        if (elements.costPrice) {
            elements.costPrice.addEventListener('input', updateProfitMargin);
        }
        if (elements.sellingPrice) {
            elements.sellingPrice.addEventListener('input', updateProfitMargin);
        }

        // Cancel button
        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener('click', handleCancel);
        }

        // Save draft button
        if (elements.saveDraftBtn) {
            elements.saveDraftBtn.addEventListener('click', handleSaveDraft);
        }

        // Barcode buttons
        if (elements.generateBarcodeBtn) {
            elements.generateBarcodeBtn.addEventListener('click', generateNewBarcode);
        }
        if (elements.printBarcodeBtn) {
            elements.printBarcodeBtn.addEventListener('click', openBarcodeModal);
        }

        // Barcode Modal events
        if (elements.closeBarcodeModal) {
            elements.closeBarcodeModal.addEventListener('click', closeBarcodeModal);
        }
        if (elements.cancelBarcodePrint) {
            elements.cancelBarcodePrint.addEventListener('click', closeBarcodeModal);
        }
        if (elements.confirmBarcodePrint) {
            elements.confirmBarcodePrint.addEventListener('click', handlePrintBarcode);
        }
        if (elements.barcodeModal) {
            elements.barcodeModal.addEventListener('click', (e) => {
                if (e.target === elements.barcodeModal) {
                    closeBarcodeModal();
                }
            });
        }

        // Barcode preview settings
        if (elements.showProductName) {
            elements.showProductName.addEventListener('change', updateBarcodePreview);
        }
        if (elements.showPrice) {
            elements.showPrice.addEventListener('change', updateBarcodePreview);
        }
        if (elements.barcodeSize) {
            elements.barcodeSize.addEventListener('change', updateBarcodePreview);
        }

        // Header buttons
        if (elements.scanInventoryBtn) {
            elements.scanInventoryBtn.addEventListener('click', openScanModal);
        }
        if (elements.viewInventoryBtn) {
            elements.viewInventoryBtn.addEventListener('click', navigateToViewInventory);
        }

        // Scan Modal events
        if (elements.closeScanModal) {
            elements.closeScanModal.addEventListener('click', closeScanModal);
        }
        if (elements.cancelScan) {
            elements.cancelScan.addEventListener('click', closeScanModal);
        }
        if (elements.scanModal) {
            elements.scanModal.addEventListener('click', (e) => {
                if (e.target === elements.scanModal) {
                    closeScanModal();
                }
            });
        }
        if (elements.searchBarcodeBtn) {
            elements.searchBarcodeBtn.addEventListener('click', searchBarcode);
        }
        if (elements.scanBarcodeInput) {
            elements.scanBarcodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchBarcode();
                }
            });
        }
        if (elements.editFoundProduct) {
            elements.editFoundProduct.addEventListener('click', handleEditFoundProduct);
        }
        if (elements.addNewWithBarcode) {
            elements.addNewWithBarcode.addEventListener('click', handleAddNewWithBarcode);
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
                state.inventory.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            console.info(`Inventory updated: ${state.inventory.length} items`);
        }, (error) => {
            console.error('Error listening to inventory:', error);
        });
    }

    // ============================================
    // Form Handling
    // ============================================
    async function handleSubmit(e) {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const inventoryItem = collectFormData();
        inventoryItem.status = calculateStatus(inventoryItem);
        inventoryItem.updatedAt = serverTimestamp();

        const isEditing = !!state.editingItem;

        try {
            // Disable submit button
            if (elements.submitBtn) {
                elements.submitBtn.disabled = true;
                elements.submitBtn.innerHTML = isEditing 
                    ? '<i class="fas fa-spinner fa-spin"></i> Updating...'
                    : '<i class="fas fa-spinner fa-spin"></i> Adding...';
            }

            if (isEditing) {
                // Update existing item
                const itemRef = doc(db, 'inventory', state.editingItem.id);
                await updateDoc(itemRef, inventoryItem);
                console.log('Inventory item updated:', state.editingItem.id);
                alert(`Item "${inventoryItem.name}" updated successfully!`);
            } else {
                // Add new item
                inventoryItem.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'inventory'), inventoryItem);
                console.log('Inventory item added:', docRef.id);
                alert(`Item "${inventoryItem.name}" added to inventory successfully!`);
            }
            
            resetForm();
            state.editingItem = null;

        } catch (error) {
            console.error('Error saving inventory item:', error);
            alert(`Failed to ${isEditing ? 'update' : 'add'} item. Please try again.`);
        } finally {
            if (elements.submitBtn) {
                elements.submitBtn.disabled = false;
                elements.submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add to Inventory';
            }
        }
    }

    function validateForm() {
        const name = elements.itemName?.value.trim();
        const category = elements.category?.value;
        const dosageForm = elements.dosageForm?.value;
        const quantity = elements.quantity?.value;
        const costPrice = elements.costPrice?.value;
        const sellingPrice = elements.sellingPrice?.value;
        const expiryDate = elements.expiryDate?.value;

        if (!name) {
            alert('Please enter the drug/product name.');
            elements.itemName?.focus();
            return false;
        }

        if (!category) {
            alert('Please select a category.');
            elements.category?.focus();
            return false;
        }

        if (!dosageForm) {
            alert('Please select a dosage form.');
            elements.dosageForm?.focus();
            return false;
        }

        if (!quantity || parseInt(quantity) < 0) {
            alert('Please enter a valid quantity.');
            elements.quantity?.focus();
            return false;
        }

        if (!costPrice || parseFloat(costPrice) < 0) {
            alert('Please enter a valid cost price.');
            elements.costPrice?.focus();
            return false;
        }

        if (!sellingPrice || parseFloat(sellingPrice) <= 0) {
            alert('Please enter a valid selling price.');
            elements.sellingPrice?.focus();
            return false;
        }

        if (!expiryDate) {
            alert('Please enter the expiry date.');
            elements.expiryDate?.focus();
            return false;
        }

        // Check if expiry date is in the past
        const expiry = new Date(expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (expiry < today) {
            if (!confirm('The expiry date is in the past. Are you sure you want to add this item?')) {
                return false;
            }
        }

        return true;
    }

    function collectFormData() {
        const costPrice = parseFloat(elements.costPrice?.value) || 0;
        const sellingPrice = parseFloat(elements.sellingPrice?.value) || 0;
        const quantity = parseInt(elements.quantity?.value) || 0;
        const reorderLevel = parseInt(elements.reorderLevel?.value) || 10;

        return {
            name: elements.itemName?.value.trim(),
            genericName: elements.genericName?.value.trim() || '',
            category: elements.category?.value,
            dosageForm: elements.dosageForm?.value,
            strength: elements.strength?.value.trim() || '',
            manufacturer: elements.manufacturer?.value.trim() || '',
            
            quantity: quantity,
            unit: elements.unit?.value || 'pieces',
            costPrice: costPrice,
            sellingPrice: sellingPrice,
            profitPerUnit: sellingPrice - costPrice,
            profitMargin: costPrice > 0 ? ((sellingPrice - costPrice) / costPrice * 100).toFixed(2) : 0,
            reorderLevel: reorderLevel,
            
            batchNumber: elements.batchNumber?.value.trim() || '',
            expiryDate: elements.expiryDate?.value || '',
            manufactureDate: elements.manufactureDate?.value || '',
            barcode: elements.barcode?.value.trim() || '',
            
            location: elements.location?.value.trim() || '',
            supplier: elements.supplier?.value.trim() || '',
            description: elements.description?.value.trim() || '',
            prescriptionRequired: elements.prescriptionRequired?.checked || false
        };
    }

    function calculateStatus(item) {
        const today = new Date();
        const expiryDate = new Date(item.expiryDate);
        const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        // Check stock status
        if (item.quantity === 0) {
            return 'out-of-stock';
        }
        
        // Check if expired
        if (daysToExpiry < 0) {
            return 'expired';
        }
        
        // Check if expiring soon (within 30 days)
        if (daysToExpiry <= 30) {
            return 'near-expiry';
        }
        
        // Check if low stock
        if (item.quantity <= item.reorderLevel) {
            return 'low-stock';
        }
        
        return 'in-stock';
    }

    // ============================================
    // Profit Margin Calculation
    // ============================================
    function updateProfitMargin() {
        const costPrice = parseFloat(elements.costPrice?.value) || 0;
        const sellingPrice = parseFloat(elements.sellingPrice?.value) || 0;
        const profit = sellingPrice - costPrice;
        const margin = costPrice > 0 ? ((profit / costPrice) * 100).toFixed(1) : 0;

        if (elements.profitMargin) {
            const marginValue = elements.profitMargin.querySelector('.margin-value');
            const marginAmount = elements.profitMargin.querySelector('.margin-amount');
            
            if (marginValue) {
                marginValue.textContent = `${margin}%`;
            }
            if (marginAmount) {
                marginAmount.textContent = `KSH ${profit.toFixed(2)}`;
            }

            // Update styling based on profit/loss
            elements.profitMargin.classList.remove('positive', 'negative', 'neutral');
            if (profit > 0) {
                elements.profitMargin.classList.add('positive');
            } else if (profit < 0) {
                elements.profitMargin.classList.add('negative');
            } else {
                elements.profitMargin.classList.add('neutral');
            }
        }
    }

    // ============================================
    // Barcode Generation & Management
    // ============================================
    function generateNewBarcode() {
        // Generate a unique SKU/Barcode
        // Format: PF-YYMMDD-XXXXX (PF = PharmaFlow, Date, Random 5 digits)
        const date = new Date();
        const year = String(date.getFullYear()).slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
        
        const barcode = `PF${year}${month}${day}${random}`;
        state.currentBarcode = barcode;

        if (elements.barcode) {
            elements.barcode.value = barcode;
        }

        console.log('Generated barcode:', barcode);
        return barcode;
    }

    function openBarcodeModal() {
        if (!state.currentBarcode) {
            generateNewBarcode();
        }

        // Update modal with current product info
        updateBarcodePreview();
        
        // Show modal
        if (elements.barcodeModal) {
            elements.barcodeModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeBarcodeModal() {
        if (elements.barcodeModal) {
            elements.barcodeModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    function updateBarcodePreview() {
        const productName = elements.itemName?.value.trim() || 'Product Name';
        const sellingPrice = parseFloat(elements.sellingPrice?.value) || 0;
        const showName = elements.showProductName?.checked ?? true;
        const showPrice = elements.showPrice?.checked ?? true;
        const size = elements.barcodeSize?.value || 'medium';

        // Update product name
        if (elements.barcodeProductName) {
            elements.barcodeProductName.textContent = productName;
            elements.barcodeProductName.style.display = showName ? 'block' : 'none';
        }

        // Update price
        if (elements.barcodePriceTag) {
            elements.barcodePriceTag.textContent = `KSH ${sellingPrice.toFixed(2)}`;
            elements.barcodePriceTag.style.display = showPrice ? 'block' : 'none';
        }

        // Get size dimensions
        const sizes = {
            small: { width: 1.5, height: 40 },
            medium: { width: 2, height: 50 },
            large: { width: 2.5, height: 60 }
        };
        const sizeConfig = sizes[size] || sizes.medium;

        // Generate barcode preview using JsBarcode
        if (elements.barcodePreviewSvg && state.currentBarcode && typeof JsBarcode !== 'undefined') {
            try {
                JsBarcode(elements.barcodePreviewSvg, state.currentBarcode, {
                    format: 'CODE128',
                    width: sizeConfig.width,
                    height: sizeConfig.height,
                    displayValue: true,
                    fontSize: 12,
                    font: 'monospace',
                    textMargin: 4,
                    margin: 10,
                    background: '#ffffff',
                    lineColor: '#000000'
                });
            } catch (error) {
                console.error('Error generating barcode:', error);
            }
        }
    }

    function handlePrintBarcode() {
        const copies = parseInt(elements.barcodeCopies?.value) || 1;
        const productName = elements.itemName?.value.trim() || 'Product Name';
        const sellingPrice = parseFloat(elements.sellingPrice?.value) || 0;
        const showName = elements.showProductName?.checked ?? true;
        const showPrice = elements.showPrice?.checked ?? true;
        const size = elements.barcodeSize?.value || 'medium';

        // Create print window
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        
        if (!printWindow) {
            alert('Please allow popups to print barcodes.');
            return;
        }

        // Size configurations
        const sizes = {
            small: { width: 180, barcodeWidth: 1.2, barcodeHeight: 35, fontSize: 10 },
            medium: { width: 220, barcodeWidth: 1.5, barcodeHeight: 45, fontSize: 11 },
            large: { width: 280, barcodeWidth: 2, barcodeHeight: 55, fontSize: 12 }
        };
        const sizeConfig = sizes[size] || sizes.medium;

        // Generate HTML for print
        let labelsHtml = '';
        for (let i = 0; i < copies; i++) {
            labelsHtml += `
                <div class="barcode-label" style="width: ${sizeConfig.width}px; padding: 10px; margin: 5px; border: 1px dashed #ccc; display: inline-block; text-align: center; page-break-inside: avoid;">
                    ${showName ? `<div style="font-size: ${sizeConfig.fontSize}px; font-weight: bold; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${productName}</div>` : ''}
                    <svg id="barcode-${i}"></svg>
                    ${showPrice ? `<div style="font-size: ${sizeConfig.fontSize + 1}px; font-weight: bold; color: #10b981; margin-top: 5px;">KSH ${sellingPrice.toFixed(2)}</div>` : ''}
                </div>
            `;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Barcodes - ${productName}</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px;
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                    @media print {
                        body { padding: 0; }
                        .barcode-label { border: none !important; }
                    }
                </style>
            </head>
            <body>
                ${labelsHtml}
                <script>
                    // Generate barcodes for each label
                    for (let i = 0; i < ${copies}; i++) {
                        JsBarcode('#barcode-' + i, '${state.currentBarcode}', {
                            format: 'CODE128',
                            width: ${sizeConfig.barcodeWidth},
                            height: ${sizeConfig.barcodeHeight},
                            displayValue: true,
                            fontSize: 10,
                            font: 'monospace',
                            textMargin: 2,
                            margin: 5
                        });
                    }
                    // Auto print after loading
                    setTimeout(() => {
                        window.print();
                    }, 500);
                <\/script>
            </body>
            </html>
        `);

        printWindow.document.close();
        closeBarcodeModal();
    }

    // ============================================
    // Scan Modal Functions
    // ============================================
    let currentFoundItem = null;

    function openScanModal() {
        if (elements.scanModal) {
            elements.scanModal.classList.add('show');
            // Reset modal state
            if (elements.scanBarcodeInput) {
                elements.scanBarcodeInput.value = '';
                elements.scanBarcodeInput.focus();
            }
            if (elements.scanResult) {
                elements.scanResult.style.display = 'none';
            }
            if (elements.scanResultFound) {
                elements.scanResultFound.style.display = 'none';
            }
            if (elements.scanResultNotFound) {
                elements.scanResultNotFound.style.display = 'none';
            }
            currentFoundItem = null;
        }
    }

    function closeScanModal() {
        if (elements.scanModal) {
            elements.scanModal.classList.remove('show');
        }
        if (elements.scanBarcodeInput) {
            elements.scanBarcodeInput.value = '';
        }
        currentFoundItem = null;
    }

    function searchBarcode() {
        const barcode = elements.scanBarcodeInput?.value.trim();
        
        if (!barcode) {
            alert('Please enter a barcode to search.');
            elements.scanBarcodeInput?.focus();
            return;
        }

        // Search in the real-time inventory state
        const foundItem = state.inventory.find(item => 
            item.barcode && item.barcode.toLowerCase() === barcode.toLowerCase()
        );

        if (elements.scanResult) {
            elements.scanResult.style.display = 'block';
        }

        if (foundItem) {
            // Product found
            currentFoundItem = foundItem;
            
            if (elements.scanResultFound) {
                elements.scanResultFound.style.display = 'flex';
            }
            if (elements.scanResultNotFound) {
                elements.scanResultNotFound.style.display = 'none';
            }
            
            // Update found product details
            if (elements.foundProductName) {
                elements.foundProductName.textContent = foundItem.name || 'N/A';
            }
            if (elements.foundProductBarcode) {
                elements.foundProductBarcode.textContent = foundItem.barcode || 'N/A';
            }
            if (elements.foundProductStock) {
                elements.foundProductStock.textContent = `${foundItem.quantity || 0} ${foundItem.unit || 'units'}`;
            }
        } else {
            // Product not found
            currentFoundItem = null;
            state.scannedBarcode = barcode; // Store for adding new product
            
            if (elements.scanResultFound) {
                elements.scanResultFound.style.display = 'none';
            }
            if (elements.scanResultNotFound) {
                elements.scanResultNotFound.style.display = 'flex';
            }
        }
    }

    function handleEditFoundProduct() {
        if (!currentFoundItem) return;
        
        // Close the scan modal
        closeScanModal();
        
        // Populate the form with the found item's data
        populateFormWithItem(currentFoundItem);
        
        // Mark as editing
        state.editingItem = currentFoundItem;
        
        // Update submit button text
        if (elements.submitBtn) {
            elements.submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Inventory';
        }
    }

    function handleAddNewWithBarcode() {
        const barcode = elements.scanBarcodeInput?.value.trim() || state.scannedBarcode;
        
        // Close the scan modal
        closeScanModal();
        
        // Reset the form
        resetForm();
        
        // Set the scanned barcode in the form
        if (elements.barcode && barcode) {
            elements.barcode.value = barcode;
            state.currentBarcode = barcode;
        }
        
        // Focus on the item name field
        if (elements.itemName) {
            elements.itemName.focus();
        }
    }

    function populateFormWithItem(item) {
        if (elements.itemName) elements.itemName.value = item.name || '';
        if (elements.genericName) elements.genericName.value = item.genericName || '';
        if (elements.category) elements.category.value = item.category || '';
        if (elements.dosageForm) elements.dosageForm.value = item.dosageForm || '';
        if (elements.strength) elements.strength.value = item.strength || '';
        if (elements.manufacturer) elements.manufacturer.value = item.manufacturer || '';
        if (elements.quantity) elements.quantity.value = item.quantity || '';
        if (elements.unit) elements.unit.value = item.unit || 'pieces';
        if (elements.costPrice) elements.costPrice.value = item.costPrice || '';
        if (elements.sellingPrice) elements.sellingPrice.value = item.sellingPrice || '';
        if (elements.reorderLevel) elements.reorderLevel.value = item.reorderLevel || '10';
        if (elements.batchNumber) elements.batchNumber.value = item.batchNumber || '';
        if (elements.expiryDate) elements.expiryDate.value = item.expiryDate || '';
        if (elements.manufactureDate) elements.manufactureDate.value = item.manufactureDate || '';
        if (elements.barcode) elements.barcode.value = item.barcode || '';
        if (elements.location) elements.location.value = item.location || '';
        if (elements.supplier) elements.supplier.value = item.supplier || '';
        if (elements.description) elements.description.value = item.description || '';
        if (elements.prescriptionRequired) elements.prescriptionRequired.checked = item.prescriptionRequired || false;
        
        // Update current barcode state
        state.currentBarcode = item.barcode || '';
        
        // Update profit margin display
        updateProfitMargin();
    }

    function navigateToViewInventory() {
        if (window.PharmaFlow && window.PharmaFlow.setActiveModule) {
            window.PharmaFlow.setActiveModule('inventory-view');
        }
    }

    // ============================================
    // Form Actions
    // ============================================
    function handleCancel() {
        if (isFormDirty()) {
            if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                return;
            }
        }
        resetForm();
        // Navigate back to inventory view if available
        if (window.showModule) {
            window.showModule('inventory');
        }
    }

    async function handleSaveDraft() {
        const name = elements.itemName?.value.trim();
        if (!name) {
            alert('Please enter at least the item name to save as draft.');
            return;
        }

        const draftItem = collectFormData();
        draftItem.status = 'draft';
        draftItem.isDraft = true;
        draftItem.createdAt = serverTimestamp();
        draftItem.updatedAt = serverTimestamp();

        try {
            if (elements.saveDraftBtn) {
                elements.saveDraftBtn.disabled = true;
                elements.saveDraftBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            const docRef = await addDoc(collection(db, 'inventory'), draftItem);
            console.log('Draft saved:', docRef.id);
            alert('Draft saved successfully!');
            resetForm();

        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Failed to save draft. Please try again.');
        } finally {
            if (elements.saveDraftBtn) {
                elements.saveDraftBtn.disabled = false;
                elements.saveDraftBtn.innerHTML = '<i class="fas fa-save"></i> Save Draft';
            }
        }
    }

    function resetForm() {
        if (elements.form) {
            elements.form.reset();
        }
        
        // Reset profit margin display
        if (elements.profitMargin) {
            const marginValue = elements.profitMargin.querySelector('.margin-value');
            const marginAmount = elements.profitMargin.querySelector('.margin-amount');
            if (marginValue) marginValue.textContent = '0%';
            if (marginAmount) marginAmount.textContent = 'KSH 0.00';
            elements.profitMargin.classList.remove('positive', 'negative', 'neutral');
        }

        // Reset default values
        if (elements.reorderLevel) {
            elements.reorderLevel.value = '10';
        }
        if (elements.unit) {
            elements.unit.value = 'pieces';
        }
        
        setDefaultExpiryDate();
        generateNewBarcode(); // Generate new barcode on form reset
        state.editingItem = null;
    }

    function setDefaultExpiryDate() {
        // Set minimum expiry date to today
        if (elements.expiryDate) {
            const today = new Date().toISOString().split('T')[0];
            elements.expiryDate.min = today;
        }
        // Set maximum manufacture date to today
        if (elements.manufactureDate) {
            const today = new Date().toISOString().split('T')[0];
            elements.manufactureDate.max = today;
        }
    }

    function isFormDirty() {
        return !!(
            elements.itemName?.value.trim() ||
            elements.genericName?.value.trim() ||
            elements.category?.value ||
            elements.dosageForm?.value ||
            elements.quantity?.value ||
            elements.costPrice?.value ||
            elements.sellingPrice?.value
        );
    }

    // ============================================
    // Utility Functions
    // ============================================
    function formatCurrency(amount) {
        return `KSH ${parseFloat(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function getStatusLabel(status) {
        const labels = {
            'in-stock': 'In Stock',
            'low-stock': 'Low Stock',
            'out-of-stock': 'Out of Stock',
            'near-expiry': 'Near Expiry',
            'expired': 'Expired',
            'draft': 'Draft'
        };
        return labels[status] || status;
    }

    function getStatusClass(status) {
        const classes = {
            'in-stock': 'status-success',
            'low-stock': 'status-warning',
            'out-of-stock': 'status-danger',
            'near-expiry': 'status-warning',
            'expired': 'status-danger',
            'draft': 'status-info'
        };
        return classes[status] || '';
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
    window.PharmaFlowInventory = {
        init,
        getInventory: () => state.inventory,
        getItemById: (id) => state.inventory.find(item => item.id === id),
        getItemByBarcode: (barcode) => state.inventory.find(item => item.barcode === barcode),
        generateBarcode: generateNewBarcode,
        openPrintModal: openBarcodeModal,
        openScanModal: openScanModal,
        searchByBarcode: searchBarcode,
        cleanup
    };

})(window, document);
