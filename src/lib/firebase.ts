/**
 * Firebase Configuration and Initialization for Zumra Hotels RMS
 * 
 * Config reads from VITE_FIREBASE_* env vars (Vercel) with hardcoded fallback.
 * Project: zumrahotels-rms
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, getDocs, setDoc, onSnapshot, query, deleteDoc, writeBatch, enableMultiTabIndexedDbPersistence, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentSnapshot } from 'firebase/firestore';
import {
  getAuth, Auth, browserLocalPersistence, setPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged as fbOnAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
  User as FBUser
} from 'firebase/auth';

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
let auth: Auth | null = null;

/**
 * Resolves when Firebase Auth persistence is fully initialized.
 * All auth-dependent operations MUST await this before proceeding.
 * Prevents race condition where onAuthStateChanged fires before
 * the persisted session is loaded from IndexedDB.
 */
let authReadyPromise: Promise<void> = Promise.resolve();

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    // Enable offline persistence (IndexedDB cache, multi-tab sync)
    enableMultiTabIndexedDbPersistence(db).catch((err: any) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firestore] Persistence failed: browser not supported');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firestore] Persistence not supported in this browser');
      } else {
        console.warn('[Firestore] Persistence error:', err?.message);
      }
    });
    auth = getAuth(app);
    // ★ CRITICAL: Await persistence before any auth operations.
    // This prevents the "Verifying Session" loop and ensures
    // onAuthStateChanged reports the correct persisted state.
    authReadyPromise = setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('[Firebase Auth] Persistence set to LOCAL');
      })
      .catch(err => {
        console.warn('[Firebase Auth] Persistence setup failed:', err?.message);
      });
    console.log('[Firebase] Initialized successfully | Project:', firebaseConfig.projectId);
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    db = null;
    auth = null;
  }
}

export { db, auth, authReadyPromise };
export { collection, doc, getDocs, setDoc, onSnapshot, query, deleteDoc, writeBatch };
export { orderBy, limit, startAfter };
export type { QueryDocumentSnapshot, DocumentSnapshot };
export type { FBUser };

// ===== Staff Whitelist (Authorization Guard) =====
// Only these emails can access the app via Google Sign-In
// Persisted to localStorage so dynamically-added users survive page refresh
const _defaultWhitelist = [
  'hazemmoheyeldin@gmail.com',
  'hazem@zumrahotels.com',
  'zaki@zumrahotels.com',
  'yasmeen@zumrahotels.com',
];
const STAFF_WHITELIST: string[] = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem('zumra_staff_whitelist') || '[]');
    if (Array.isArray(stored) && stored.length > 0) {
      // Merge defaults with stored
      const merged = new Set([..._defaultWhitelist.map(e => e.toLowerCase()), ...stored.map((e: string) => e.toLowerCase())]);
      return Array.from(merged);
    }
  } catch {}
  return [..._defaultWhitelist];
})();

const _persistWhitelist = () => {
  try { localStorage.setItem('zumra_staff_whitelist', JSON.stringify(STAFF_WHITELIST)); } catch {}
};

// Allowed domains (any email matching these domains is allowed)
const ALLOWED_DOMAINS: string[] = [
  '@zumrahotels.com',
];

/**
 * Check if an email is authorized to use the app.
 * Returns true if the email is in the whitelist or matches an allowed domain.
 */
export function isStaffAuthorized(email: string): boolean {
  const lower = email.toLowerCase();
  if (STAFF_WHITELIST.some(e => e.toLowerCase() === lower)) return true;
  if (ALLOWED_DOMAINS.some(d => lower.endsWith(d))) return true;
  return false;
}

/**
 * Add an email to the staff whitelist (called when admin adds a new user).
 */
export function addToStaffWhitelist(email: string): void {
  const lower = email.toLowerCase();
  if (!STAFF_WHITELIST.some(e => e.toLowerCase() === lower)) {
    STAFF_WHITELIST.push(lower);
    _persistWhitelist();
    console.log(`[Auth] Added ${email} to staff whitelist`);
  }
}

// ===== Google Sign-In =====
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google.
 * Returns { uid, email, displayName, photoURL } on success.
 * Throws if unauthorized or failed.
 */
export async function firebaseGoogleSignIn(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
} | null> {
  if (!auth) return null;
  await authReadyPromise; // Ensure persistence is ready before auth operations
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    const email = user.email || '';

    // Staff whitelist check
    if (!isStaffAuthorized(email)) {
      console.warn(`[Auth] Unauthorized Google sign-in attempt: ${email}`);
      await fbSignOut(auth);
      return null; // Caller should show "Unauthorized" message
    }

    console.log(`[Auth] Google sign-in: ${user.uid} (${email})`);
    return {
      uid: user.uid,
      email,
      displayName: user.displayName || email.split('@')[0],
      photoURL: user.photoURL || '',
    };
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user') {
      console.log('[Auth] Google sign-in popup closed by user');
      return null;
    }
    console.warn(`[Auth] Google sign-in failed:`, err?.code || err?.message || err);
    throw err;
  }
}

// ===== Firebase Auth Helpers =====

/**
 * Create a Firebase Auth user (called when admin creates a new user in the app).
 * Uses email + password so Firestore rules (request.auth != null) work.
 */
export async function firebaseCreateUser(email: string, password: string): Promise<{ uid: string } | null> {
  if (!auth) return null;
  await authReadyPromise;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`[Firebase Auth] Created user: ${cred.user.uid} (${email})`);
    return { uid: cred.user.uid };
  } catch (err: any) {
    // If user already exists, that's fine
    if (err?.code === 'auth/email-already-in-use') {
      console.log(`[Firebase Auth] User ${email} already exists`);
      return { uid: 'existing' };
    }
    console.warn(`[Firebase Auth] Create user failed for ${email}:`, err?.code || err?.message || err);
    return null;
  }
}

/**
 * Sign in to Firebase Auth (called when user logs in to the app).
 * This populates request.auth for Firestore security rules.
 */
export async function firebaseSignIn(email: string, password: string): Promise<boolean> {
  if (!auth) return false;
  await authReadyPromise;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`[Firebase Auth] Signed in: ${cred.user.uid}`);
    return true;
  } catch (err: any) {
    console.warn(`[Firebase Auth] Sign in failed for ${email}:`, err?.code || err?.message || err);
    return false;
  }
}

/**
 * Sign out from Firebase Auth.
 */

export async function firebaseSignOut(): Promise<void> {
  if (!auth) return;
  await authReadyPromise;
  try {
    await fbSignOut(auth);
    console.log('[Firebase Auth] Signed out');
  } catch (err: any) {
    console.warn('[Firebase Auth] Sign out failed:', err?.message);
  }
}

/**
 * Listen to Firebase Auth state changes.
 * Waits for persistence to be ready before registering the listener.
 * This ensures onAuthStateChanged reports the CORRECT persisted session,
 * not a premature null that causes the "Verifying Session" loop.
 * Returns a cleanup function.
 */
export function onFirebaseAuthStateChanged(callback: (user: FBUser | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  let cancelled = false;
  let innerUnsub: (() => void) | null = null;
  // Wait for persistence before listening — prevents premature null auth state
  authReadyPromise.then(() => {
    if (cancelled) return;
    innerUnsub = fbOnAuthStateChanged(auth, callback);
  });
  return () => {
    cancelled = true;
    innerUnsub?.();
  };
}

/**
 * Check if a Firebase Auth user is currently signed in.
 */
export function isFirebaseAuthSignedIn(): boolean {
  return !!auth?.currentUser;
}

/**
 * Ensure Firebase Auth is signed in (for page refresh persistence).
 * If no user is signed in but we have a remembered user, try to sign them in.
 */
export async function ensureFirebaseAuthSession(userEmail?: string, userPassword?: string): Promise<boolean> {
  if (!auth) return false;
  // Already signed in
  if (auth.currentUser) return true;
  // Try to sign in with provided credentials
  if (userEmail && userPassword) {
    return firebaseSignIn(userEmail, userPassword);
  }
  return false;
}

/**
 * Firebase collection names (mirror localStorage keys)
 */
export const COLLECTIONS = {
  HOTELS: 'hotels',
  AGENTS: 'agents',
  ALLOTMENTS: 'allotments',
  RESERVATIONS: 'reservations',
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  EXTERNAL_TRANSFERS: 'external_transfers',
  USERS: 'users',
  FOLLOW_UPS: 'follow_ups',
  SETTINGS: 'settings',
  SALES_PERSONS: 'sales_persons',
  CANCELLATION_REASONS: 'cancellation_reasons',
  TERMS_CONDITIONS: 'terms_conditions',
  OTHER_SERVICES: 'other_services',
  PAYMENT_GATEWAYS: 'payment_gateways',
  PAY_BY_LINKS: 'pay_by_links',
  EDIT_APPROVALS: 'edit_approvals',
  TAX_SETTINGS: 'tax_settings',
  EXPENSES: 'expenses',
  EXPENSE_CATEGORIES: 'expense_categories',
  CONSOLIDATED_INVOICES: 'consolidated_invoices',
  AUDIT_LOG: 'audit_log',
  COMMISSIONS: 'commissions',
  MESSAGES: 'messages',
};

/**
 * Auto-create user profile in Firestore if it doesn't exist.
 * Called after Google Sign-In to ensure the user has a profile record.
 */
export async function ensureUserProfileInFirestore(profile: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: string;
}): Promise<void> {
  if (!db) return;
  try {
    const userRef = doc(db, COLLECTIONS.USERS, profile.uid);
    const existingDocs = await getDocs(collection(db, COLLECTIONS.USERS));
    const existingUsers = existingDocs.docs.map(d => d.data());
    const alreadyExists = existingUsers.some(u => u.email === profile.email || u.uid === profile.uid);

    if (!alreadyExists) {
      // Create profile with default role
      const userData = {
        id: profile.uid,
        uid: profile.uid,
        username: profile.email.split('@')[0],
        name: profile.displayName,
        email: profile.email,
        role: profile.role || 'Reservationist',
        photoURL: profile.photoURL || '',
        createdAt: new Date().toISOString(),
        mustChangePassword: false,
        authProvider: 'google',
      };
      await setDoc(userRef, userData);
      console.log(`[Firestore] Auto-created user profile: ${profile.email} (uid: ${profile.uid})`);
    } else {
      console.log(`[Firestore] User profile already exists: ${profile.email}`);
    }
  } catch (err) {
    console.warn('[Firestore] Failed to ensure user profile:', err);
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
 * Helper: Save a single document to Firestore with exponential backoff retry
 */
export async function firestoreSave(collectionName: string, id: string, data: any): Promise<void> {
  if (!db) {
    console.warn(`[Firebase] firestoreSave: db is null, skipping ${collectionName}/${id}`);
    return;
  }
  // Ensure id is a valid string — prevents SDK internal indexOf errors
  if (!id || typeof id !== 'string') {
    console.error(`[Firebase] firestoreSave: invalid doc id for ${collectionName}:`, id);
    return;
  }
  const timeoutMs = 8000;
  try {
    const savePromise = setDoc(doc(db, collectionName, id), { ...data, _updatedAt: new Date().toISOString() });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore write timeout after ${timeoutMs}ms`)), timeoutMs)
    );
    await Promise.race([savePromise, timeoutPromise]);
  } catch (error: any) {
    // Single retry for transient errors (network blip, contention)
    if (error?.code !== 'permission-denied' && error?.code !== 'unauthenticated') {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const savePromise2 = setDoc(doc(db, collectionName, id), { ...data, _updatedAt: new Date().toISOString() });
        const timeoutPromise2 = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Firestore write timeout after ${timeoutMs}ms`)), timeoutMs)
        );
        await Promise.race([savePromise2, timeoutPromise2]);
        return; // success on retry
      } catch (retryErr: any) {
        throw retryErr; // let sync queue handle it
      }
    }
    throw error;
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
  if (!db) {
    console.warn(`[Firestore] firestoreSubscribe: db is null, cannot subscribe to ${collectionName}`);
    return () => {};
  }
  
  try {
    const q = query(collection(db, collectionName));
    let firstEmission = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
      if (firstEmission) {
        console.log(`[Firestore] Listener: ${collectionName} — ${data.length} records (from: ${snapshot.metadata.fromCache ? 'cache' : 'server'})`);
        firstEmission = false;
      }
      callback(data);
    }, (error) => {
      console.error(`[Firebase] Snapshot error for ${collectionName}:`, error?.code, error?.message);
      if (error?.code === 'permission-denied') {
        console.error(`[Firebase] PERMISSION DENIED: Firestore security rules are blocking read access to '${collectionName}'. Check your Firestore rules.`);
      }
    });
    return unsubscribe;
  } catch (err: any) {
    console.error(`[Firestore] Failed to subscribe to ${collectionName}:`, err?.message);
    return () => {};
  }
}

/**
 * Delete ALL documents in a Firestore collection (used for strategic data reset).
 * Processes in batches of 500 to respect Firestore write limits.
 */
export async function firestoreClearCollection(collectionName: string): Promise<number> {
  if (!db) return 0;
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    if (snapshot.empty) return 0;
    
    const batchSize = 500;
    const docs = snapshot.docs;
    let deleted = 0;
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + batchSize);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += chunk.length;
    }
    
    console.log(`[Firebase] Cleared ${deleted} docs from ${collectionName}`);
    return deleted;
  } catch (error) {
    console.error(`[Firebase] Error clearing ${collectionName}:`, error);
    return 0;
  }
}

/**
 * Subscribe to a Firestore collection with limit + orderBy.
 * Real-time listener only watches a window of documents (not the full collection).
 * @param orderByField  Field to order by (e.g., 'id' for reservations, 'hotelNumber' for hotels)
 * @param direction     'desc' for newest-first (default) or 'asc'
 * @param limitCount    Max documents to listen to (default 50)
 */
export function firestoreSubscribeWithLimit<T>(
  collectionName: string,
  orderByField: string,
  direction: 'asc' | 'desc',
  limitCount: number,
  callback: (data: T[], lastDoc: DocumentSnapshot | null) => void
): () => void {
  if (!db) {
    console.warn(`[Firestore] firestoreSubscribeWithLimit: db is null, cannot subscribe to ${collectionName}`);
    return () => {};
  }

  try {
    const q = query(
      collection(db, collectionName),
      orderBy(orderByField, direction),
      limit(limitCount)
    );
    let firstEmission = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
      const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      if (firstEmission) {
        console.log(`[Firestore] Limited listener: ${collectionName} — ${data.length}/${limitCount} records (from: ${snapshot.metadata.fromCache ? 'cache' : 'server'})`);
        firstEmission = false;
      }
      callback(data, lastDoc);
    }, (error) => {
      console.error(`[Firebase] Snapshot error for ${collectionName}:`, error?.code, error?.message);
      if (error?.code === 'permission-denied') {
        console.error(`[Firebase] PERMISSION DENIED: Check Firestore rules for '${collectionName}'.`);
      }
      if (error?.code === 'failed-precondition') {
        console.error(`[Firebase] MISSING INDEX: Create a composite index on '${collectionName}' for field '${orderByField}'.`, error?.message);
      }
    });
    return unsubscribe;
  } catch (err: any) {
    console.error(`[Firestore] Failed to subscribe with limit to ${collectionName}:`, err?.message);
    return () => {};
  }
}

/**
 * Fetch the next page of documents from a Firestore collection using a cursor.
 * Returns the new documents + updated cursor for subsequent pages.
 */
export async function firestoreFetchPage<T>(
  collectionName: string,
  orderByField: string,
  direction: 'asc' | 'desc',
  limitCount: number,
  lastDoc: DocumentSnapshot
): Promise<{ data: T[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) return { data: [], lastDoc: null };

  try {
    const q = query(
      collection(db, collectionName),
      orderBy(orderByField, direction),
      startAfter(lastDoc),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    console.log(`[Firestore] Fetched page: ${collectionName} — ${data.length} more records`);
    return { data, lastDoc: newLastDoc };
  } catch (error: any) {
    console.error(`[Firebase] Error fetching page for ${collectionName}:`, error?.code, error?.message);
    return { data: [], lastDoc: null };
  }
}

/**
 * One-time full load of a Firestore collection (for Dashboard/Reports on-demand).
 * Same as firestoreLoadAll but with a clearer name for the split-architecture pattern.
 */
export async function firestoreLoadFull<T>(collectionName: string): Promise<T[]> {
  if (!db) return [];
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
    console.log(`[Firestore] Full load: ${collectionName} — ${data.length} records`);
    return data;
  } catch (error) {
    console.error(`[Firebase] Error loading full ${collectionName}:`, error);
    return [];
  }
}
