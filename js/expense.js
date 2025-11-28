// Expense Module - Add Expense Form Handler
import { db, collection, addDoc, Timestamp } from './firebase-config.js';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initExpenseForm();
});

function initExpenseForm() {
    const form = document.getElementById('addExpenseForm');
    
    if (!form) {
        console.log('Add Expense form not found');
        return;
    }
    
    // Set default date to today
    const dateInput = form.querySelector('#expenseDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
    
    // Handle form submission
    form.addEventListener('submit', handleExpenseSubmit);
    
    // Handle form reset
    form.addEventListener('reset', function() {
        setTimeout(() => {
            if (dateInput) {
                const today = new Date().toISOString().split('T')[0];
                dateInput.value = today;
            }
        }, 10);
    });
    
    console.log('Expense form initialized');
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Get form values
    const category = form.querySelector('#expenseCategory').value.trim();
    const description = form.querySelector('#expenseDescription').value.trim();
    const amount = parseFloat(form.querySelector('#expenseAmount').value);
    const date = form.querySelector('#expenseDate').value;
    const paymentMethod = form.querySelector('#expensePaymentMethod').value.trim();
    const notes = form.querySelector('#expenseNotes').value.trim();
    
    // Validation
    if (!category) {
        showNotification('Please select a category', 'error');
        return;
    }
    
    if (!description) {
        showNotification('Please enter a description', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }
    
    if (!date) {
        showNotification('Please select a date', 'error');
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        // Create expense object
        const expenseData = {
            category: category,
            description: description,
            amount: amount,
            date: date,
            paymentMethod: paymentMethod || 'cash',
            notes: notes || '',
            status: 'pending',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, 'expenses'), expenseData);
        
        console.log('Expense saved with ID:', docRef.id);
        
        // Show success notification
        showNotification('Expense saved successfully!', 'success');
        
        // Reset form
        form.reset();
        
        // Reset date to today
        const dateInput = form.querySelector('#expenseDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
        
    } catch (error) {
        console.error('Error saving expense:', error);
        showNotification('Error saving expense. Please try again.', 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.expense-notification');
    existing.forEach(n => n.remove());
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `expense-notification expense-notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Style the notification
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
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add animation styles
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
