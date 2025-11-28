/**
 * PharmaFlow Prescription Module
 * Complete prescription generation with inventory integration
 */
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

(function(window, document) {
    'use strict';

    // ============================================
    // Real-time Inventory Data from Firestore
    // ============================================
    let inventoryData = [];
    let unsubscribeInventory = null;

    // ============================================
    // State Management
    // ============================================
    const state = {
        medications: [],
        patientInfo: {},
        doctorInfo: {}
    };

    // ============================================
    // DOM Elements
    // ============================================
    let elements = {};

    function cacheElements() {
        elements = {
            // Patient & Doctor Info
            patientName: document.getElementById('rxPatientName'),
            patientAge: document.getElementById('rxPatientAge'),
            patientGender: document.getElementById('rxPatientGender'),
            patientPhone: document.getElementById('rxPatientPhone'),
            doctorName: document.getElementById('rxDoctorName'),
            doctorLicense: document.getElementById('rxDoctorLicense'),
            diagnosis: document.getElementById('rxDiagnosis'),
            notes: document.getElementById('rxNotes'),
            
            // Search
            searchInput: document.getElementById('rxSearchInput'),
            searchResults: document.getElementById('rxSearchResults'),
            manualAddBtn: document.getElementById('rxManualAddBtn'),
            
            // Medications List
            medsBody: document.getElementById('rxMedsBody'),
            medsEmpty: document.getElementById('rxMedsEmpty'),
            clearMeds: document.getElementById('rxClearMeds'),
            
            // Preview
            preview: document.getElementById('rxPreview'),
            previewDate: document.getElementById('rxPreviewDate'),
            previewPatient: document.getElementById('rxPreviewPatient'),
            previewAge: document.getElementById('rxPreviewAge'),
            previewDiagnosis: document.getElementById('rxPreviewDiagnosis'),
            previewMedsList: document.getElementById('rxPreviewMedsList'),
            previewNotes: document.getElementById('rxPreviewNotes'),
            previewDoctor: document.getElementById('rxPreviewDoctor'),
            previewLicense: document.getElementById('rxPreviewLicense'),
            
            // Actions
            printBtn: document.getElementById('rxPrintBtn'),
            sendCartBtn: document.getElementById('rxSendCartBtn'),
            saveBtn: document.getElementById('rxSaveBtn'),
            clearBtn: document.getElementById('rxClearBtn'),
            
            // Manual Entry Modal
            manualMedModal: document.getElementById('rxManualMedModal'),
            manualMedClose: document.getElementById('rxManualMedClose'),
            manualMedCancel: document.getElementById('rxManualMedCancel'),
            manualMedAdd: document.getElementById('rxManualMedAdd'),
            manualMedName: document.getElementById('rxManualMedName'),
            manualMedDosage: document.getElementById('rxManualMedDosage'),
            manualMedFrequency: document.getElementById('rxManualMedFrequency'),
            manualMedDuration: document.getElementById('rxManualMedDuration'),
            manualMedQuantity: document.getElementById('rxManualMedQuantity'),
            manualMedInstructions: document.getElementById('rxManualMedInstructions')
        };
    }

    // ============================================
    // Initialize Module
    // ============================================
    function init() {
        console.log('Prescription module: Starting initialization...');
        cacheElements();
        console.log('Prescription module: Elements cached');
        bindEvents();
        console.log('Prescription module: Events bound');
        setupInventoryListener();
        console.log('Prescription module: Inventory listener setup');
        updateMedicationsList();
        updatePreview();
        console.info('PharmaFlow Prescription module initialized successfully!');
    }

    // ============================================
    // Real-time Inventory Listener
    // ============================================
    function setupInventoryListener() {
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
                        stock: parseInt(data.quantity) || 0,
                        unit: data.unit || 'pieces'
                    });
                });
                console.info(`Prescription: Loaded ${inventoryData.length} inventory items`);
            }, (error) => {
                console.error('Prescription: Error listening to inventory:', error);
            });
        } catch (error) {
            console.error('Prescription: Failed to setup inventory listener:', error);
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

        // Manual add button
        if (elements.manualAddBtn) {
            elements.manualAddBtn.addEventListener('click', openManualMedModal);
        }

        // Empty state add button
        const emptyAddBtn = document.getElementById('rxEmptyAddBtn');
        if (emptyAddBtn) {
            emptyAddBtn.addEventListener('click', openManualMedModal);
        }

        // Clear medications
        if (elements.clearMeds) {
            elements.clearMeds.addEventListener('click', clearAllMedications);
        }

        // Action buttons
        if (elements.printBtn) {
            elements.printBtn.addEventListener('click', handlePrint);
        }
        if (elements.sendCartBtn) {
            elements.sendCartBtn.addEventListener('click', handleSendToCart);
        }
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', handleSave);
        }
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', handleClearForm);
        }

        // Update preview on input changes
        const formInputs = [
            elements.patientName, elements.patientAge, elements.patientGender,
            elements.diagnosis, elements.notes, elements.doctorName, elements.doctorLicense
        ];
        formInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', updatePreview);
            }
        });

        // Manual medication modal
        if (elements.manualMedClose) {
            elements.manualMedClose.addEventListener('click', closeManualMedModal);
        }
        if (elements.manualMedCancel) {
            elements.manualMedCancel.addEventListener('click', closeManualMedModal);
        }
        if (elements.manualMedAdd) {
            elements.manualMedAdd.addEventListener('click', handleAddManualMed);
        }
        if (elements.manualMedModal) {
            elements.manualMedModal.addEventListener('click', (e) => {
                if (e.target === elements.manualMedModal) closeManualMedModal();
            });
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
            item.genericName.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.dosage.toLowerCase().includes(query)
        ).slice(0, 10);
    }

    function displaySearchResults(results) {
        if (!elements.searchResults) return;

        if (results.length === 0) {
            elements.searchResults.innerHTML = `
                <div class="prescription-search-empty">
                    <i class="fas fa-search"></i>
                    <p>No medications found</p>
                </div>
            `;
        } else {
            elements.searchResults.innerHTML = results.map(item => `
                <div class="prescription-search-item" data-id="${item.id}">
                    <div class="prescription-search-item-info">
                        <div class="prescription-search-item-name">${item.name}</div>
                        <div class="prescription-search-item-details">${item.dosage} • ${item.category}</div>
                    </div>
                    <span class="prescription-search-item-stock ${getStockClass(item.stock)}">${item.stock} ${item.unit}</span>
                </div>
            `).join('');

            // Add click handlers to results
            elements.searchResults.querySelectorAll('.prescription-search-item').forEach(el => {
                el.addEventListener('click', () => {
                    const itemId = el.dataset.id;
                    const item = inventoryData.find(i => i.id === itemId);
                    if (item) {
                        addMedication(item);
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
        if (!e.target.closest('.rx-search-container') && 
            !e.target.closest('.rx-search-results')) {
            hideSearchResults();
        }
    }

    function getStockClass(stock) {
        if (stock === 0) return 'out-of-stock';
        if (stock < 20) return 'low-stock';
        return 'in-stock';
    }

    // ============================================
    // Manual Medication Entry
    // ============================================
    function openManualMedModal() {
        if (elements.manualMedModal) {
            elements.manualMedModal.classList.add('show');
            // Clear previous values
            elements.manualMedName.value = '';
            elements.manualMedDosage.value = '';
            elements.manualMedFrequency.value = 'Once daily';
            elements.manualMedDuration.value = '';
            elements.manualMedQuantity.value = '1';
            elements.manualMedInstructions.value = '';
        }
    }

    function closeManualMedModal() {
        if (elements.manualMedModal) {
            elements.manualMedModal.classList.remove('show');
        }
    }

    function handleAddManualMed() {
        const name = elements.manualMedName.value.trim();
        const dosage = elements.manualMedDosage.value.trim();
        const frequency = elements.manualMedFrequency.value;
        const duration = elements.manualMedDuration.value.trim();
        const quantity = parseInt(elements.manualMedQuantity.value) || 1;
        const instructions = elements.manualMedInstructions.value.trim();

        if (!name || !dosage || !frequency || !duration) {
            alert('Please fill in all required fields');
            return;
        }

        const medication = {
            id: 'manual-' + Date.now(),
            name: name,
            dosage: dosage,
            frequency: frequency,
            duration: duration,
            quantity: quantity,
            instructions: instructions,
            isManual: true
        };

        addMedication(medication);
        closeManualMedModal();
    }

    // ============================================
    // Medication Management
    // ============================================
    function addMedication(item) {
        console.log('Adding medication:', item);
        
        const medication = {
            id: item.id,
            name: item.name,
            dosage: item.dosage || '',
            frequency: item.frequency || 'Twice daily',
            duration: item.duration || '7 days',
            quantity: item.quantity || 1,
            instructions: item.instructions || '',
            isManual: item.isManual || false
        };

        state.medications.push(medication);
        console.log('Total medications:', state.medications.length);
        
        updateMedicationsList();
        updatePreview();
    }

    function removeMedication(index) {
        state.medications.splice(index, 1);
        updateMedicationsList();
        updatePreview();
    }

    function updateMedicationField(index, field, value) {
        if (state.medications[index]) {
            state.medications[index][field] = value;
            updatePreview();
        }
    }

    function clearAllMedications() {
        if (state.medications.length === 0) return;
        
        if (confirm('Clear all medications from prescription?')) {
            state.medications = [];
            updateMedicationsList();
            updatePreview();
        }
    }

    function updateMedicationsList() {
        if (!elements.medsBody || !elements.medsEmpty) return;

        // Update count badge
        const countBadge = document.getElementById('rxMedsCount');
        if (countBadge) {
            countBadge.textContent = state.medications.length;
        }

        // Find the table container
        const tableContainer = document.querySelector('.rx-meds-table-container');

        if (state.medications.length === 0) {
            elements.medsBody.innerHTML = '';
            elements.medsEmpty.style.display = 'flex';
            if (tableContainer) {
                tableContainer.style.display = 'none';
            }
        } else {
            elements.medsEmpty.style.display = 'none';
            if (tableContainer) {
                tableContainer.style.display = 'block';
            }
            
            elements.medsBody.innerHTML = state.medications.map((med, index) => `
                <tr>
                    <td>
                        <div class="med-name">${med.name}</div>
                        ${med.isManual ? '<span class="badge-manual">Manual</span>' : ''}
                    </td>
                    <td>
                        <input type="text" class="med-input" value="${med.dosage}" 
                               onchange="window.PharmaFlowPrescription.updateField(${index}, 'dosage', this.value)">
                    </td>
                    <td>
                        <select class="med-select" onchange="window.PharmaFlowPrescription.updateField(${index}, 'frequency', this.value)">
                            <option value="Once daily" ${med.frequency === 'Once daily' ? 'selected' : ''}>Once daily</option>
                            <option value="Twice daily" ${med.frequency === 'Twice daily' ? 'selected' : ''}>Twice daily</option>
                            <option value="Three times daily" ${med.frequency === 'Three times daily' ? 'selected' : ''}>Three times daily</option>
                            <option value="Four times daily" ${med.frequency === 'Four times daily' ? 'selected' : ''}>Four times daily</option>
                            <option value="Every 4 hours" ${med.frequency === 'Every 4 hours' ? 'selected' : ''}>Every 4 hours</option>
                            <option value="Every 6 hours" ${med.frequency === 'Every 6 hours' ? 'selected' : ''}>Every 6 hours</option>
                            <option value="Every 8 hours" ${med.frequency === 'Every 8 hours' ? 'selected' : ''}>Every 8 hours</option>
                            <option value="As needed" ${med.frequency === 'As needed' ? 'selected' : ''}>As needed</option>
                            <option value="Before meals" ${med.frequency === 'Before meals' ? 'selected' : ''}>Before meals</option>
                            <option value="After meals" ${med.frequency === 'After meals' ? 'selected' : ''}>After meals</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="med-input" value="${med.duration}" 
                               onchange="window.PharmaFlowPrescription.updateField(${index}, 'duration', this.value)">
                    </td>
                    <td>
                        <input type="number" class="med-input-qty" value="${med.quantity}" min="1"
                               onchange="window.PharmaFlowPrescription.updateField(${index}, 'quantity', parseInt(this.value))">
                    </td>
                    <td>
                        <button class="btn-remove-med" onclick="window.PharmaFlowPrescription.removeMed(${index})" title="Remove">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        console.log('Medications list updated. Total:', state.medications.length);
    }

    // ============================================
    // Preview Update
    // ============================================
    function updatePreview() {
        if (!elements.preview) return;

        // Update date
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        elements.previewDate.textContent = today;

        // Update patient info
        const patientName = elements.patientName.value.trim() || '--';
        const patientAge = elements.patientAge.value.trim();
        const patientGender = elements.patientGender.value;
        const ageGender = [patientAge, patientGender].filter(x => x).join(', ') || '--';
        
        elements.previewPatient.textContent = patientName;
        elements.previewAge.textContent = ageGender;
        
        // Update diagnosis
        elements.previewDiagnosis.textContent = elements.diagnosis.value.trim() || '--';
        
        // Update medications
        if (state.medications.length === 0) {
            elements.previewMedsList.innerHTML = '<p class="rx-preview-empty">No medications added</p>';
        } else {
            elements.previewMedsList.innerHTML = state.medications.map((med, i) => `
                <div class="rx-preview-med-item">
                    <div class="rx-med-number">${i + 1}.</div>
                    <div class="rx-med-details">
                        <div class="rx-med-name"><strong>${med.name}</strong> - ${med.dosage}</div>
                        <div class="rx-med-sig">
                            ${med.frequency} for ${med.duration}
                            ${med.quantity > 1 ? ` (Qty: ${med.quantity})` : ''}
                        </div>
                        ${med.instructions ? `<div class="rx-med-instructions"><em>${med.instructions}</em></div>` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        // Update notes
        elements.previewNotes.textContent = elements.notes.value.trim() || '--';
        
        // Update doctor info
        elements.previewDoctor.textContent = 'Dr. ' + (elements.doctorName.value.trim() || '--');
        elements.previewLicense.textContent = elements.doctorLicense.value.trim() || '--';
    }

    // ============================================
    // Actions
    // ============================================
    function handlePrint() {
        if (!validateForm()) return;

        // Create print window
        const printWindow = window.open('', '', 'width=800,height=600');
        const printContent = generatePrintContent();
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }

    function generatePrintContent() {
        const today = new Date().toLocaleDateString('en-US', { 
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });
        
        const printTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const rxNumber = 'RX-' + Date.now().toString().slice(-6);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Prescription ${rxNumber}</title>
                <style>
                    * { 
                        margin: 0; 
                        padding: 0; 
                        box-sizing: border-box; 
                    }
                    
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    
                    body { 
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 11px;
                        line-height: 1.4;
                        color: #000;
                        background: #fff;
                        width: 80mm;
                        margin: 0 auto;
                        padding: 10mm 5mm;
                    }
                    
                    .receipt {
                        width: 100%;
                    }
                    
                    .header {
                        text-align: center;
                        margin-bottom: 12px;
                        padding-bottom: 8px;
                        border-bottom: 2px dashed #000;
                    }
                    
                    .header .logo {
                        font-size: 32px;
                        margin-bottom: 4px;
                    }
                    
                    .header .clinic-name {
                        font-size: 16px;
                        font-weight: bold;
                        letter-spacing: 1px;
                        margin-bottom: 2px;
                    }
                    
                    .header .tagline {
                        font-size: 9px;
                        margin-top: 2px;
                    }
                    
                    .rx-number {
                        text-align: center;
                        font-size: 12px;
                        font-weight: bold;
                        margin: 8px 0;
                        letter-spacing: 1px;
                    }
                    
                    .date-time {
                        display: flex;
                        justify-content: space-between;
                        font-size: 10px;
                        margin-bottom: 10px;
                        padding-bottom: 6px;
                        border-bottom: 1px solid #000;
                    }
                    
                    .rx-symbol {
                        text-align: center;
                        font-size: 36px;
                        font-weight: bold;
                        font-family: serif;
                        margin: 8px 0;
                    }
                    
                    .section {
                        margin: 10px 0;
                    }
                    
                    .section-title {
                        font-size: 11px;
                        font-weight: bold;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                        border-bottom: 1px solid #000;
                        padding-bottom: 3px;
                    }
                    
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 4px;
                        font-size: 10px;
                    }
                    
                    .info-label {
                        font-weight: bold;
                        width: 35%;
                    }
                    
                    .info-value {
                        width: 65%;
                        text-align: right;
                    }
                    
                    .divider {
                        border-bottom: 1px dashed #000;
                        margin: 8px 0;
                    }
                    
                    .medications {
                        margin: 10px 0;
                    }
                    
                    .med-item {
                        margin-bottom: 10px;
                        padding-bottom: 8px;
                        border-bottom: 1px dotted #000;
                    }
                    
                    .med-item:last-child {
                        border-bottom: none;
                    }
                    
                    .med-header {
                        font-weight: bold;
                        font-size: 11px;
                        margin-bottom: 4px;
                    }
                    
                    .med-number {
                        display: inline-block;
                        width: 18px;
                        height: 18px;
                        background: #000;
                        color: #fff;
                        text-align: center;
                        line-height: 18px;
                        border-radius: 50%;
                        font-size: 10px;
                        margin-right: 6px;
                    }
                    
                    .med-details {
                        font-size: 10px;
                        margin-left: 24px;
                        line-height: 1.5;
                    }
                    
                    .med-sig {
                        margin-top: 3px;
                    }
                    
                    .med-qty {
                        font-weight: bold;
                        margin-top: 2px;
                    }
                    
                    .med-instructions {
                        font-style: italic;
                        margin-top: 3px;
                        font-size: 9px;
                    }
                    
                    .notes {
                        margin: 10px 0;
                        padding: 8px;
                        border: 1px solid #000;
                        font-size: 9px;
                        background: #f5f5f5;
                    }
                    
                    .notes-title {
                        font-weight: bold;
                        margin-bottom: 4px;
                        text-transform: uppercase;
                    }
                    
                    .signature {
                        margin-top: 20px;
                        text-align: right;
                    }
                    
                    .signature-line {
                        border-top: 1px solid #000;
                        width: 100px;
                        margin: 30px 0 8px auto;
                    }
                    
                    .doctor-name {
                        font-weight: bold;
                        font-size: 11px;
                    }
                    
                    .doctor-license {
                        font-size: 9px;
                        margin-top: 2px;
                    }
                    
                    .footer {
                        text-align: center;
                        font-size: 9px;
                        margin-top: 15px;
                        padding-top: 8px;
                        border-top: 2px dashed #000;
                    }
                    
                    .footer p {
                        margin: 3px 0;
                    }
                    
                    @media print {
                        body {
                            width: 80mm;
                            padding: 5mm 3mm;
                        }
                        
                        .no-print {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <!-- Header -->
                    <div class="header">
                        <div class="logo">⚕</div>
                        <div class="clinic-name">PHARMAFLOW CLINIC</div>
                        <div class="tagline">Prescription Services</div>
                    </div>
                    
                    <!-- RX Number -->
                    <div class="rx-number">PRESCRIPTION: ${rxNumber}</div>
                    
                    <!-- Date & Time -->
                    <div class="date-time">
                        <span>Date: ${today}</span>
                        <span>Time: ${printTime}</span>
                    </div>
                    
                    <!-- Rx Symbol -->
                    <div class="rx-symbol">℞</div>
                    
                    <!-- Patient Information -->
                    <div class="section">
                        <div class="section-title">Patient Information</div>
                        <div class="info-row">
                            <span class="info-label">Name:</span>
                            <span class="info-value">${elements.patientName.value || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Age:</span>
                            <span class="info-value">${elements.patientAge.value || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Gender:</span>
                            <span class="info-value">${elements.patientGender.value || 'N/A'}</span>
                        </div>
                        ${elements.patientPhone.value ? `
                        <div class="info-row">
                            <span class="info-label">Phone:</span>
                            <span class="info-value">${elements.patientPhone.value}</span>
                        </div>
                        ` : ''}
                        ${elements.diagnosis.value ? `
                        <div class="info-row">
                            <span class="info-label">Diagnosis:</span>
                            <span class="info-value">${elements.diagnosis.value}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <!-- Medications -->
                    <div class="section">
                        <div class="section-title">Prescribed Medications</div>
                        <div class="medications">
                            ${state.medications.map((med, i) => `
                                <div class="med-item">
                                    <div class="med-header">
                                        <span class="med-number">${i + 1}</span>
                                        ${med.name}
                                    </div>
                                    <div class="med-details">
                                        <div>Dosage: ${med.dosage}</div>
                                        <div class="med-sig">Sig: ${med.frequency} for ${med.duration}</div>
                                        ${med.quantity > 1 ? `<div class="med-qty">Dispense Qty: ${med.quantity}</div>` : ''}
                                        ${med.instructions ? `<div class="med-instructions">Note: ${med.instructions}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    ${elements.notes.value ? `
                        <div class="divider"></div>
                        <div class="notes">
                            <div class="notes-title">Additional Notes</div>
                            <div>${elements.notes.value}</div>
                        </div>
                    ` : ''}
                    
                    <div class="divider"></div>
                    
                    <!-- Signature -->
                    <div class="signature">
                        <div class="signature-line"></div>
                        <div class="doctor-name">Dr. ${elements.doctorName.value || 'N/A'}</div>
                        <div class="doctor-license">License: ${elements.doctorLicense.value || 'N/A'}</div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="footer">
                        <p>*** Computer Generated Prescription ***</p>
                        <p>Thank you for choosing PharmaFlow</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    async function handleSendToCart() {
        if (!validateForm()) return;

        if (state.medications.length === 0) {
            alert('Please add at least one medication to send to POS');
            return;
        }

        // Check if POS module is available
        if (!window.PharmaFlowPOS) {
            alert('POS module not available. Please navigate to POS first.');
            return;
        }

        // Send medications to POS cart
        let addedCount = 0;
        state.medications.forEach(med => {
            if (!med.isManual) {
                const inventoryItem = inventoryData.find(item => item.id === med.id);
                if (inventoryItem) {
                    window.PharmaFlowPOS.addToCart(inventoryItem, med.quantity);
                    addedCount++;
                }
            }
        });

        if (addedCount > 0) {
            alert(`${addedCount} medication(s) added to POS cart. Switching to POS...`);
            // Switch to POS module
            if (window.PharmaFlow && window.PharmaFlow.setActiveModule) {
                window.PharmaFlow.setActiveModule('pharmacy-pos');
            }
        } else {
            alert('No inventory items found to add to cart. Manual entries cannot be added automatically.');
        }
    }

    async function handleSave() {
        if (!validateForm()) return;

        try {
            const prescription = {
                patientName: elements.patientName.value.trim(),
                patientAge: elements.patientAge.value.trim(),
                patientGender: elements.patientGender.value,
                patientPhone: elements.patientPhone.value.trim(),
                doctorName: elements.doctorName.value.trim(),
                doctorLicense: elements.doctorLicense.value.trim(),
                diagnosis: elements.diagnosis.value.trim(),
                notes: elements.notes.value.trim(),
                medications: state.medications,
                createdAt: serverTimestamp(),
                status: 'active'
            };

            const docRef = await addDoc(collection(db, 'prescriptions'), prescription);
            console.info('Prescription saved:', docRef.id);
            
            alert('Prescription saved successfully!');
            handleClearForm();
        } catch (error) {
            console.error('Error saving prescription:', error);
            alert('Failed to save prescription. Please try again.');
        }
    }

    function handleClearForm() {
        if (!confirm('Clear the entire prescription form?')) return;

        // Clear all inputs
        elements.patientName.value = '';
        elements.patientAge.value = '';
        elements.patientGender.value = '';
        elements.patientPhone.value = '';
        elements.doctorName.value = '';
        elements.doctorLicense.value = '';
        elements.diagnosis.value = '';
        elements.notes.value = '';
        
        // Clear medications
        state.medications = [];
        updateMedicationsList();
        updatePreview();
    }

    function validateForm() {
        if (!elements.patientName.value.trim()) {
            alert('Please enter patient name');
            elements.patientName.focus();
            return false;
        }

        if (!elements.doctorName.value.trim()) {
            alert('Please enter doctor name');
            elements.doctorName.focus();
            return false;
        }

        if (state.medications.length === 0) {
            alert('Please add at least one medication');
            return false;
        }

        return true;
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
    // Cleanup listeners
    // ============================================
    function cleanup() {
        if (unsubscribeInventory) {
            unsubscribeInventory();
            unsubscribeInventory = null;
        }
    }

    // ============================================
    // Public API
    // ============================================
    const api = {
        init,
        cleanup,
        updateField: updateMedicationField,
        removeMed: removeMedication,
        addToCart: addMedication
    };

    window.PharmaFlowPrescription = api;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

})(window, document);
