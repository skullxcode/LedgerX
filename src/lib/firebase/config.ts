import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Use environment variables for Firebase config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID,
};

// Validate required config
const validateFirebaseConfig = () => {
  const requiredFields = ['projectId', 'authDomain', 'apiKey'];
  const missing = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missing.join(', ')}. ` +
      `Please set environment variables: FIREBASE_${missing.join(', FIREBASE_').toUpperCase()}`
    );
  }
};

// Validate on module load
if (typeof window !== 'undefined') {
  validateFirebaseConfig();
}

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  // Enable offline persistence with multi-tab support
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  auth = getAuth(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  throw error;
}

export { app, db, auth, storage };
