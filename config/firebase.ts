import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAaXzKWP-AUWfDrH12TtzuG0dnxvB3_qEE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sreemeditec-35f21.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sreemeditec-35f21",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sreemeditec-35f21.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "117300572565",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:117300572565:web:887143d5c209510352469c",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L38P10TF9B"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
