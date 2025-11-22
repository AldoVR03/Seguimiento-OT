// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyvGTl21W5eQu1GUfre9MGiE23Gm_S8m0",
  authDomain: "lavanderiaelcobre-4212b.firebaseapp.com",
  projectId: "lavanderiaelcobre-4212b",
  storageBucket: "lavanderiaelcobre-4212b.firebasestorage.app",
  messagingSenderId: "250289358691",
  appId: "1:250289358691:web:05d026af7a59ecb98f3556",
  measurementId: "G-S8HV70WF2M"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };