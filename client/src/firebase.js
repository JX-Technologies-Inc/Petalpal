import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBs0pqyfM8eEMYdYS4qt1gwURtfohL6eEM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "petalpal-b212c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "petalpal-b212c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "petalpal-b212c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "879846854472",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:879846854472:web:02b860eacfaf5bb7616d7d"
});

export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
