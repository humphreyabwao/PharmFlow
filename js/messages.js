/**
 * PharmaFlow - Real-time Messaging System
 * Enables live chat between logged-in users with Firebase Realtime Database
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set,
    onValue, 
    remove, 
    query,
    orderByChild,
    limitToLast
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyB88Ttg2c9HMn1k3Me1KHtuTscYKUP4Wys",
    authDomain: "pharmaflow-8481d.firebaseapp.com",
    databaseURL: "https://pharmaflow-8481d-default-rtdb.firebaseio.com",
    projectId: "pharmaflow-8481d",
    storageBucket: "pharmaflow-8481d.firebasestorage.app",
    messagingSenderId: "327113671676",
    appId: "1:327113671676:web:da7b674de0c5b9f9a4a879",
    measurementId: "G-37H0CBXGEX"
};

// Use existing app or create new one
let app;
try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
    app = initializeApp(firebaseConfig, 'messages-app-' + Date.now());
}

const rtdb = getDatabase(app);
const auth = getAuth(app);

// DOM Elements
let messageBtn, messageDropdown, messageBadge, messageList;
let composeModal, closeComposeModalBtn, cancelComposeBtn, sendMessageBtn;
let messageContent, charCount, clearMessagesBtn;

// Current user info
let currentUser = null;
let currentUserName = 'User';
let currentUserInitials = 'U';

// Track unread messages
let unreadCount = 0;
let lastReadTimestamp = 0;
let previousMessageCount = 0;
let isFirstLoad = true;

// Notification sound using Web Audio API
let audioContext = null;

/**
 * Play notification sound
 */
function playNotificationSound() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Could not play notification sound:', e);
    }
}

/**
 * Show new message alert
 */
function showNewMessageAlert(senderName, messageText) {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = 'msg-new-alert';
    alert.innerHTML = `
        <div class="msg-alert-icon">
            <i class="fas fa-envelope"></i>
        </div>
        <div class="msg-alert-content">
            <strong>New message from ${senderName}</strong>
            <p>${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}</p>
        </div>
        <button class="msg-alert-close">&times;</button>
    `;
    
    // Add styles if not exists
    if (!document.getElementById('msg-alert-styles')) {
        const styles = document.createElement('style');
        styles.id = 'msg-alert-styles';
        styles.textContent = `
            .msg-new-alert {
                position: fixed;
                top: 80px;
                right: 20px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 14px 16px;
                background: var(--surface-color, #fff);
                border: 1px solid var(--border-color, #e5e7eb);
                border-left: 4px solid var(--primary-color, #4682b4);
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10002;
                animation: msgAlertSlideIn 0.3s ease;
                max-width: 350px;
            }
            .msg-alert-icon {
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--primary-color, #4682b4);
                color: #fff;
                border-radius: 50%;
                font-size: 14px;
            }
            .msg-alert-content {
                flex: 1;
            }
            .msg-alert-content strong {
                display: block;
                font-size: 14px;
                color: var(--text-primary, #1f2937);
                margin-bottom: 4px;
            }
            .msg-alert-content p {
                font-size: 13px;
                color: var(--text-secondary, #6b7280);
                margin: 0;
                line-height: 1.4;
            }
            .msg-alert-close {
                background: none;
                border: none;
                font-size: 20px;
                color: var(--text-secondary, #6b7280);
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }
            .msg-alert-close:hover {
                color: var(--text-primary, #1f2937);
            }
            @keyframes msgAlertSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes msgAlertSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(alert);
    
    // Close button
    alert.querySelector('.msg-alert-close').addEventListener('click', () => {
        alert.style.animation = 'msgAlertSlideOut 0.3s ease';
        setTimeout(() => alert.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.style.animation = 'msgAlertSlideOut 0.3s ease';
            setTimeout(() => alert.remove(), 300);
        }
    }, 5000);
}

/**
 * Initialize messaging system
 */
function initMessaging() {
    console.log('Initializing messaging system...');
    
    // Get DOM elements
    messageBtn = document.getElementById('messageBtn');
    messageDropdown = document.getElementById('messageDropdown');
    messageBadge = document.getElementById('messageBadge');
    messageList = document.getElementById('messageList');
    composeModal = document.getElementById('composeMessageModal');
    closeComposeModalBtn = document.getElementById('closeComposeModal');
    cancelComposeBtn = document.getElementById('cancelComposeBtn');
    sendMessageBtn = document.getElementById('sendMessageBtn');
    messageContent = document.getElementById('messageContent');
    charCount = document.getElementById('charCount');
    clearMessagesBtn = document.getElementById('clearMessagesBtn');

    console.log('Elements found:', {
        messageBtn: !!messageBtn,
        messageDropdown: !!messageDropdown,
        composeModal: !!composeModal,
        sendMessageBtn: !!sendMessageBtn,
        messageContent: !!messageContent
    });

    if (!messageBtn || !messageDropdown) {
        console.warn('Messaging elements not found');
        return;
    }

    // Setup event listeners
    setupEventListeners();

    // Listen for auth state
    onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? user.email : 'No user');
        if (user) {
            currentUser = user;
            currentUserName = user.displayName || user.email?.split('@')[0] || 'User';
            currentUserInitials = getInitials(currentUserName);
            
            // Load last read timestamp from localStorage
            lastReadTimestamp = parseInt(localStorage.getItem(`lastRead_${user.uid}`) || '0');
            
            // Start listening for messages
            listenForMessages();
        }
    });
}

/**
 * Get initials from name or email
 */
function getInitials(name) {
    if (!name) return 'U';
    
    // If it's an email, use first letter
    if (name.includes('@')) {
        return name.charAt(0).toUpperCase();
    }
    
    // Get initials from name (up to 2 characters)
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Toggle dropdown
    messageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (messageDropdown && !messageDropdown.contains(e.target) && !messageBtn.contains(e.target)) {
            closeDropdown();
        }
    });

    // Compose button
    const composeBtn = document.getElementById('composeMessageBtn');
    if (composeBtn) {
        composeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openComposeModal();
        });
    }

    // Close compose modal
    if (closeComposeModalBtn) {
        closeComposeModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeComposeModalFn();
        });
    }
    if (cancelComposeBtn) {
        cancelComposeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeComposeModalFn();
        });
    }

    // Close modal on overlay click
    if (composeModal) {
        composeModal.addEventListener('click', (e) => {
            if (e.target === composeModal) {
                closeComposeModalFn();
            }
        });
    }

    // Character count and enable send button
    if (messageContent) {
        messageContent.addEventListener('input', () => {
            const count = messageContent.value.length;
            if (charCount) charCount.textContent = count;
            
            // Enable/disable send button
            if (sendMessageBtn) {
                sendMessageBtn.disabled = count === 0;
            }
        });
    }

    // Send message
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    // Clear messages
    if (clearMessagesBtn) {
        clearMessagesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearAllMessages();
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && composeModal && composeModal.classList.contains('show')) {
            closeComposeModalFn();
        }
        if (e.key === 'Enter' && e.ctrlKey && composeModal && composeModal.classList.contains('show')) {
            e.preventDefault();
            sendMessage();
        }
    });
}

/**
 * Toggle dropdown visibility
 */
function toggleDropdown() {
    const isOpen = messageDropdown.classList.contains('show');
    
    // Close other dropdowns first
    document.querySelectorAll('.notification-dropdown, .profile-dropdown').forEach(d => {
        d.classList.remove('show');
    });
    
    if (isOpen) {
        closeDropdown();
    } else {
        messageDropdown.classList.add('show');
        markMessagesAsRead();
    }
}

/**
 * Close dropdown
 */
function closeDropdown() {
    messageDropdown.classList.remove('show');
}

/**
 * Open compose modal
 */
function openComposeModal() {
    console.log('Opening compose modal...');
    closeDropdown();
    
    if (messageContent) {
        messageContent.value = '';
    }
    if (charCount) {
        charCount.textContent = '0';
    }
    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }
    if (composeModal) {
        composeModal.classList.add('show');
        if (messageContent) {
            setTimeout(() => messageContent.focus(), 100);
        }
    }
}

/**
 * Close compose modal
 */
function closeComposeModalFn() {
    console.log('Closing compose modal...');
    if (composeModal) {
        composeModal.classList.remove('show');
    }
}

/**
 * Send message to Firebase
 */
async function sendMessage() {
    console.log('Send message clicked');
    
    if (!messageContent) {
        console.error('Message content element not found');
        return;
    }
    
    const text = messageContent.value.trim();
    console.log('Message text:', text);
    
    if (!text) {
        showToast('Please enter a message', 'error');
        return;
    }
    
    if (!currentUser) {
        showToast('You must be logged in to send messages', 'error');
        return;
    }

    sendMessageBtn.disabled = true;
    const originalBtnText = sendMessageBtn.innerHTML;
    sendMessageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const messagesRef = ref(rtdb, 'messages');
        const newMessageRef = push(messagesRef);
        
        const messageData = {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUserName,
            senderInitials: currentUserInitials,
            senderEmail: currentUser.email || '',
            timestamp: Date.now()
        };
        
        console.log('Sending message:', messageData);
        
        await set(newMessageRef, messageData);
        
        console.log('Message sent successfully!');
        
        // Clear and close
        messageContent.value = '';
        if (charCount) charCount.textContent = '0';
        closeComposeModalFn();
        
        showToast('Message sent successfully!', 'success');
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message: ' + error.message, 'error');
    } finally {
        sendMessageBtn.disabled = false;
        sendMessageBtn.innerHTML = originalBtnText;
    }
}

/**
 * Listen for messages in real-time
 */
function listenForMessages() {
    console.log('Starting to listen for messages...');
    const messagesRef = ref(rtdb, 'messages');
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(50));

    onValue(messagesQuery, (snapshot) => {
        const messages = [];
        snapshot.forEach((child) => {
            messages.push({
                id: child.key,
                ...child.val()
            });
        });

        console.log('Received messages:', messages.length);

        // Sort by timestamp descending (newest first)
        messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Check for new messages (not on first load)
        if (!isFirstLoad && messages.length > 0) {
            const newestMessage = messages[0];
            
            // If this is a new message from someone else
            if (newestMessage.senderId !== currentUser?.uid && 
                newestMessage.timestamp > lastReadTimestamp &&
                messages.length > previousMessageCount) {
                
                // Play sound
                playNotificationSound();
                
                // Show alert
                showNewMessageAlert(newestMessage.senderName || 'Someone', newestMessage.text);
            }
        }
        
        isFirstLoad = false;
        previousMessageCount = messages.length;

        // Count unread messages
        unreadCount = messages.filter(m => 
            m.timestamp > lastReadTimestamp && 
            m.senderId !== currentUser?.uid
        ).length;

        updateBadge();
        renderMessages(messages);
    }, (error) => {
        console.error('Error listening for messages:', error);
    });
}

/**
 * Render messages in dropdown
 */
function renderMessages(messages) {
    if (!messageList) return;

    if (messages.length === 0) {
        messageList.innerHTML = `
            <div class="message-empty">
                <i class="fas fa-comments"></i>
                <p>No messages yet</p>
            </div>
        `;
        return;
    }

    messageList.innerHTML = messages.map(msg => {
        const isUnread = msg.timestamp > lastReadTimestamp && msg.senderId !== currentUser?.uid;
        const isOwn = msg.senderId === currentUser?.uid;
        const timeStr = formatTime(msg.timestamp);
        
        return `
            <div class="message-item ${isUnread ? 'unread' : ''}" data-id="${msg.id}">
                <div class="message-avatar" style="${isOwn ? 'background: linear-gradient(135deg, #10b981 0%, #059669 100%)' : ''}">
                    ${msg.senderInitials || 'U'}
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">${isOwn ? 'You' : msg.senderName || 'Unknown'}</span>
                        <span class="message-time">${timeStr}</span>
                    </div>
                    <p class="message-text">${escapeHtml(msg.text)}</p>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update badge count
 */
function updateBadge() {
    if (!messageBadge) return;

    if (unreadCount > 0) {
        messageBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        messageBadge.style.display = 'flex';
    } else {
        messageBadge.style.display = 'none';
    }
}

/**
 * Mark messages as read
 */
function markMessagesAsRead() {
    lastReadTimestamp = Date.now();
    if (currentUser) {
        localStorage.setItem(`lastRead_${currentUser.uid}`, lastReadTimestamp.toString());
    }
    unreadCount = 0;
    updateBadge();
}

/**
 * Clear all messages (admin function)
 */
async function clearAllMessages() {
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
        return;
    }

    try {
        const messagesRef = ref(rtdb, 'messages');
        await remove(messagesRef);
        showToast('All messages cleared', 'success');
    } catch (error) {
        console.error('Error clearing messages:', error);
        showToast('Failed to clear messages', 'error');
    }
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Check if there's an existing toast function
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    // Create simple toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10001;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation keyframes
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMessaging);
} else {
    initMessaging();
}

// Export for potential external use
export { initMessaging };
