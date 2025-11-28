/**
 * PharmaFlow - Firebase configuration and service exposure
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-analytics.js";
import { 
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

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

const app = initializeApp(firebaseConfig);

let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (error) {
    console.warn('PharmaFlow: analytics not available in this environment.', error);
}

const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

const services = { app, analytics, db, rtdb, auth, storage };

window.PharmaFlowFirebase = services;

export { 
    app, 
    analytics, 
    db, 
    rtdb, 
    auth,
    storage,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    onSnapshot,
    serverTimestamp
};
export default services;
