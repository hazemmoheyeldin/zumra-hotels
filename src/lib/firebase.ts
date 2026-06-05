/**
 * Firebase Configuration and Initialization for Zumra Hotels RMS
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (free tier)
 * 3. Enable Firestore Database (in test mode initially)
 * 4. Go to Project Settings > General > Your Apps > Web App
 * 5. Register a web app and copy the config below
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, getDocs, setDoc, onSnapshot, query, deleteDoc, writeBatch } from 'firebase/firestore';

// ============================================
// PASTE YOUR FIREBASE CONFIG HERE
// ============================================
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
// ============================================

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
