import { db, collection, addDoc, Timestamp } from './firebase-config.js';

class CustomerModule {
    constructor() {
        console.log('CustomerModule: Initializing...');
        this.form = null;
        this.submitBtn = null;
        this.init();
    }

    init() {
        // Use the correct form ID from HTML
        this.form = document.getElementById('addCustomerForm');
        
        if (this.form) {
            console.log('CustomerModule: Form found');
            this.submitBtn = this.form.querySelector('.btn-primary');
            this.setupEventListeners();
        } else {
            console.warn('CustomerModule: Form not found, will retry...');
            // Retry after a short delay in case DOM isn't fully ready
            setTimeout(() => this.init(), 500);
        }
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        console.log('CustomerModule: Event listeners attached');
    }

    async handleSubmit(e) {
        e.preventDefault();
        console.log('CustomerModule: Form submitted');

        // Get form values
        const customerName = document.getElementById('customerName')?.value.trim() || '';
        const customerPhone = document.getElementById('customerPhone')?.value.trim() || '';
        const customerEmail = document.getElementById('customerEmail')?.value.trim() || '';
        const customerAddress = document.getElementById('customerAddress')?.value.trim() || '';
        const customerNotes = document.getElementById('customerNotes')?.value.trim() || '';

        // Validate required fields
        if (!customerName) {
            alert('Customer name is required');
            return;
        }

        if (!customerPhone) {
            alert('Phone number is required');
            return;
        }

        // Disable submit button
        if (this.submitBtn) {
            this.submitBtn.disabled = true;
            this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        try {
            // Prepare customer data
            const customerData = {
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                address: customerAddress,
                notes: customerNotes,
                status: 'active',
                totalPurchases: 0,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            console.log('CustomerModule: Saving to Firestore...', customerData);

            // Add to Firebase
            const docRef = await addDoc(collection(db, 'customers'), customerData);
            
            console.log('CustomerModule: Customer added with ID:', docRef.id);
            
            // Show success message
            this.showNotification('Customer added successfully!', 'success');
            
            // Reset form
            this.form.reset();
            document.getElementById('customerName')?.focus();

        } catch (error) {
            console.error('CustomerModule: Error adding customer:', error);
            this.showNotification('Failed to add customer: ' + error.message, 'error');
        } finally {
            // Re-enable submit button
            if (this.submitBtn) {
                this.submitBtn.disabled = false;
                this.submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Customer';
            }
        }
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `customer-notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('CustomerModule: DOM loaded');
        window.customerModule = new CustomerModule();
    });
} else {
    console.log('CustomerModule: DOM already loaded');
    window.customerModule = new CustomerModule();
}

export { CustomerModule };
