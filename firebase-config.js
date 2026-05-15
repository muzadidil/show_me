// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOUcQyQU-4NLDDogi3b9M9m3La_gaRSIk",
    authDomain: "kamus-83493.firebaseapp.com",
    projectId: "kamus-83493",
    storageBucket: "kamus-83493.firebasestorage.app",
    messagingSenderId: "638392844083",
    appId: "1:638392844083:web:ad1426e85b5d734484c846"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Auto sign-in anonymous (wajib untuk Firestore rules yang require auth)
export const authReady = new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            resolve(user);
        } else {
            signInAnonymously(auth).catch(reject);
        }
    });
});
