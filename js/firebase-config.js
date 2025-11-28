/**
 * PharmaFlow - Firebase Configuration
 * Firebase SDK Setup and Initialization
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const analytics = getAnalytics(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// Export Firebase services for use in other modules
export { app, analytics, db, rtdb, auth };

// Log successful initialization
console.log('Firebase initialized successfully');
