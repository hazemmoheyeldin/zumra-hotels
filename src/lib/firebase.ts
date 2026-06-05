/**
 * Firebase Configuration and Initialization for Zumra Hotels RMS
 * 
 * Config reads from VITE_FIREBASE_* env vars (Vercel) with hardcoded fallback.
 * Project: zumrahotels-rms
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, getDocs, setDoc, onSnapshot, query, deleteDoc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDHkLzahkk0ZKckDqmS0AZNnoLqgRFEQ4A",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "zumrahotels-rms.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://zumrahotels-rms-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "zumrahotels-rms",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "zumrahotels-rms.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "845381748480",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:845381748480:web:6b7c2ee8dc0c85cd4855e5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-7GWFX3PRSM",
};

// Check if Firebase is configured
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('[Firebase] Initialized successfully');
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    db = null;
  }
}

export { db };
export { collection, doc, getDocs, setDoc, onSnapshot, query, deleteDoc, writeBatch };

/**
 * Firestore collection names (mirror localStorage keys)
 */
export const COLLECTIONS = {
  HOTELS: 'hotels',
  AGENTS: 'agents',
  ALLOTMENTS: 'allotments',
  RESERVATIONS: 'reservations',
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  USERS: 'users',
  FOLLOW_UPS: 'follow_ups',
  EXTERNAL_TRANSFERS: 'external_transfers',
  SETTINGS: 'settings',
} as const;

/**
 * Helper: Save a single document to Firestore
 */
export async function firestoreSave(collectionName: string, id: string, data: any): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, collectionName, id), { ...data, _updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error(`[Firebase] Error saving ${collectionName}/${id}:`, error);
  }
}

/**
 * Helper: Delete a document from Firestore
 */
export async function firestoreDelete(collectionName: string, id: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`[Firebase] Error deleting ${collectionName}/${id}:`, error);
  }
}

/**
 * Helper: Load all documents from a Firestore collection
 */
export async function firestoreLoadAll<T>(collectionName: string): Promise<T[]> {
  if (!db) return [];
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
  } catch (error) {
    console.error(`[Firebase] Error loading ${collectionName}:`, error);
    return [];
  }
}

/**
 * Helper: Bulk save entire collection to Firestore (used for initial sync)
 */
export async function firestoreBulkSave(collectionName: string, items: any[]): Promise<void> {
  if (!db || items.length === 0) return;
  try {
    const batch = writeBatch(db);
    items.forEach(item => {
      const docRef = doc(db, collectionName, item.id);
      batch.set(docRef, { ...item, _updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    console.log(`[Firebase] Bulk saved ${items.length} items to ${collectionName}`);
  } catch (error) {
    console.error(`[Firebase] Error bulk saving ${collectionName}:`, error);
  }
}

/**
 * Subscribe to real-time changes in a Firestore collection
 */
export function firestoreSubscribe<T>(collectionName: string, callback: (data: T[]) => void): () => void {
  if (!db) return () => {};
  
  try {
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
      callback(data);
    }, (error) => {
      console.error(`[Firebase] Snapshot error for ${collectionName}:`, error);
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}
