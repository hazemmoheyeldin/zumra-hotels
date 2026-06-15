/**
 * Firebase Configuration and Initialization for Zumra Hotels RMS
 * 
 * Config reads from VITE_FIREBASE_* env vars (Vercel) with hardcoded fallback.
 * Project: zumrahotels-rms
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, getDoc, getDocs, setDoc, onSnapshot, query, deleteDoc, writeBatch, enableNetwork, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentSnapshot, connectFirestoreEmulator, serverTimestamp, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import {
  getAuth, Auth, browserLocalPersistence, setPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential,
  signOut as fbSignOut, onAuthStateChanged as fbOnAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
  connectAuthEmulator,
  deleteUser as fbDeleteUser,
  User as FBUser
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDHkLzahkk0ZKckDqmS0AZNnoLqgRFEQ4A",
  authDomain: "zumrahotels-rms.firebaseapp.com",
  databaseURL: "https://zumrahotels-rms-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "zumrahotels-rms",
  storageBucket: "zumrahotels-rms.firebasestorage.app",
  messagingSenderId: "845381748480",
  appId: "1:845381748480:web:6b7c2ee8dc0c85cd4855e5",
  measurementId: "G-7GWFX3PRSM",
};

// Check if Firebase is configured
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

// ═══ CIRCUIT BREAKER: stops ALL Firestore operations after repeated permission-denied errors ═══
// With 22 staggered listeners, transient auth timing errors during initial load are expected.
// The circuit only trips if errors PERSIST after a grace period, not during the initial burst.
let _circuitOpen = false;
let _permissionDeniedCount = 0;
const CIRCUIT_THRESHOLD = 8; // Need 8+ persistent errors AFTER grace period to trip
const _circuitInitTime = Date.now();
const CIRCUIT_GRACE_MS = 15000; // 15s grace period for initial auth + listener attachment

function tripCircuit(reason: string) {
  _permissionDeniedCount++;
  const elapsed = Date.now() - _circuitInitTime;
  // During grace period: log but never trip (transient auth timing errors are expected)
  if (elapsed < CIRCUIT_GRACE_MS) {
    if (_permissionDeniedCount <= 3 || _permissionDeniedCount % 5 === 0) {
      console.warn(`[Circuit Breaker] Permission denied (${_permissionDeniedCount}x) during grace period — not tripping. Reason: ${reason}`);
    }
    return;
  }
  if (_permissionDeniedCount >= CIRCUIT_THRESHOLD && !_circuitOpen) {
    _circuitOpen = true;
    console.error(`[Circuit Breaker] TRIPPED after ${_permissionDeniedCount} permission-denied errors. Reason: ${reason}. All Firestore operations halted.`);
  }
}

export function isCircuitOpen(): boolean { return _circuitOpen; }
export function resetCircuit() { _circuitOpen = false; _permissionDeniedCount = 0; }

/**
 * Force-reconnect Firestore to live server.
 * Resets circuit breaker + calls enableNetwork() to break out of offline mode.
 * Called on: auth state change, page visibility change, manual reconnect.
 */
export async function forceFirestoreReconnect(): Promise<void> {
  resetCircuit();
  if (db) {
    try {
      await enableNetwork(db);
      console.log('[Firestore] forceReconnect: enableNetwork() succeeded — live mode restored');
    } catch (err: any) {
      console.warn('[Firestore] forceReconnect: enableNetwork() failed:', err?.message);
    }
  }
}

// Auto-reconnect when page becomes visible again (tab switch, phone unlock)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && db) {
      // If circuit was open, auto-reset and reconnect
      if (_circuitOpen) {
        console.log('[Firestore] Page visible — auto-resetting circuit breaker and reconnecting...');
        forceFirestoreReconnect();
      } else {
        // Proactive: ensure network is enabled even if not tripped
        enableNetwork(db).catch(() => {});
      }
    }
  });
}

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
    // ★ CRITICAL: Use MemoryLocalCache to explicitly prevent IndexedDB persistence.
    // This ensures NO stale offline data ever overrides the live database.
    // Ghost data from old sessions is impossible with in-memory cache.
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    
    // Check if using emulators (skip persistence for emulators)
    const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true' || 
                       (window.location.hostname === 'localhost' && import.meta.env.DEV);
    
    // DISABLED: Offline persistence (IndexedDB cache).
    // During launch phase we need the app to strictly read from the live server
    // on every page load to prevent stale data conflicts and split-brain cache.
    // enableMultiTabIndexedDbPersistence(db) — disabled intentionally.
    console.log('[Firestore] Offline persistence DISABLED — live-only mode');
    auth = getAuth(app);
    // ★ CRITICAL: Await persistence before any auth operations.
    // This prevents the "Verifying Session" loop and ensures
    // onAuthStateChanged reports the correct persisted state.
    authReadyPromise = Promise.race([
      setPersistence(auth, browserLocalPersistence)
        .then(() => {
          // Auth persistence configured
        })
        .catch(err => {
          console.warn('[Firebase Auth] Persistence setup failed:', err?.message);
        }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('authReadyPromise timeout after 5s')), 5000))
    ]).catch(err => {
      console.warn('[Firebase Auth] authReadyPromise rejected:', err?.message || err);
      // Proceed anyway — auth operations will work, just without guaranteed persistence
    });
    // Firebase initialized

    // ═══ EMULATOR CONNECTION (for local development) ═══
    // Connect to Firebase Emulators when VITE_USE_EMULATOR=true or when running on localhost
    if (useEmulator && db && auth) {
      try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        console.log('[Firebase] Emulator mode active');
      } catch (err) {
        console.warn('[Firebase] Failed to connect to emulators:', err);
      }
    }
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    db = null;
    auth = null;
  }
}

export { db, auth, authReadyPromise };
export { collection, doc, getDoc, getDocs, setDoc, onSnapshot, query, deleteDoc, writeBatch, serverTimestamp };
export { orderBy, limit, startAfter };
export type { QueryDocumentSnapshot, DocumentSnapshot };
export type { FBUser };

// ===== Staff Whitelist (Authorization Guard) =====
// Only these emails can access the app via Google Sign-In
// Persisted to localStorage so dynamically-added users survive page refresh
const _defaultWhitelist = [
  'hazemmoheyeldin@gmail.com',
  'hazem8383@gmail.com',
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

// Authorized hosting domains (app deployment domains)
export const AUTHORIZED_HOSTING_DOMAINS: string[] = [
  'zumrahotels-rms.web.app',          // Firebase Hosting (primary)
  'rms.zumrahotels.com',               // Vercel production domain
  'zumrahotels-rms.firebaseapp.com',   // Firebase default domain
  'localhost',                         // Local development
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
    // Staff whitelist entry added
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

    // Google sign-in successful
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
    // New user account created
    return { uid: cred.user.uid };
  } catch (err: any) {
    // If user already exists, try signing in with the provided password
    if (err?.code === 'auth/email-already-in-use') {
      // Existing user — attempting sign-in
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // Signed in existing user
        return { uid: cred.user.uid };
      } catch (signinErr: any) {
        console.warn(`[Auth] Sign-in failed: ${signinErr?.code}`);
        return null; // Caller should handle this case
      }
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
    // Email sign-in successful
    return true;
  } catch (err: any) {
    console.warn(`[Firebase Auth] Sign in failed for ${email}:`, err?.code || err?.message || err);
    return false;
  }
}

/**
 * Update the currently authenticated user's Firebase Auth password.
 * Re-authenticates first (required by Firebase for sensitive operations),
 * then updates the password. Returns true on success.
 */
export async function firebaseUpdatePassword(email: string, oldPassword: string, newPassword: string): Promise<boolean> {
  if (!auth || !auth.currentUser) {
    console.warn('[Firebase Auth] Cannot update password: no authenticated user');
    return false;
  }
  await authReadyPromise;
  try {
    // Re-authenticate (Firebase requires recent login for password changes)
    const credential = EmailAuthProvider.credential(email, oldPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    // Update password
    await updatePassword(auth.currentUser, newPassword);
    // Password updated
    return true;
  } catch (err: any) {
    console.warn(`[Firebase Auth] Password update failed for ${email}:`, err?.code || err?.message || err);
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
 * Delete a Firebase Auth user by UID.
 * Used for rollback when Firestore profile creation fails after Auth account was created.
 * NOTE: Requires the caller to be authenticated as the user to delete OR use Admin SDK.
 * For admin-side deletion of another user, this re-authenticates as the target user first.
 */
export async function firebaseDeleteAuthUser(email: string, password: string): Promise<boolean> {
  if (!auth) return false;
  try {
    // Sign in as the target user to get their credential
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fbDeleteUser(cred.user);
    console.log('[Firebase Auth] Deleted user:', email);
    return true;
  } catch (err: any) {
    console.warn('[Firebase Auth] Delete user failed:', email, err?.code || err?.message);
    return false;
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
  DOCUMENT_TEMPLATES: 'document_templates',
};

/**
 * Fetch a user document from the LIVE Firestore users collection.
 * Tries: (1) by UID, (2) by email match, (3) by username match.
 * Returns the user data or null. This is the SINGLE SOURCE OF TRUTH.
 */
export async function fetchUserFromFirestore(identifier: string): Promise<any | null> {
  if (!db) return null;
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    const allUsers: any[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const idLower = identifier.toLowerCase();

    // Match by UID
    const byUid = allUsers.find(u => u.id?.toLowerCase() === idLower || u.uid?.toLowerCase() === idLower);
    if (byUid) return byUid;

    // Match by email
    const byEmail = allUsers.find(u => u.email?.toLowerCase() === idLower);
    if (byEmail) return byEmail;

    // Match by username
    const byUsername = allUsers.find(u => u.username?.toLowerCase() === idLower);
    if (byUsername) return byUsername;

    return null;
  } catch (err: any) {
    console.warn('[Firestore] fetchUserFromFirestore failed:', err?.code || err?.message);
    return null;
  }
}

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
      // User profile auto-created
    } else {
      // User profile already exists
    }
  } catch (err) {
    console.warn('[Firestore] Failed to ensure user profile:', err);
  }
}

/**
 * Helper: Load all documents from a Firestore collection
 */
export async function firestoreLoadAll<T>(collectionName: string): Promise<T[]> {
  if (!db || _circuitOpen) return [];
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
  } catch (error: any) {
    if (error?.code === 'permission-denied') tripCircuit(`firestoreLoadAll(${collectionName})`);
    console.error(`[Firebase] Error loading ${collectionName}:`, error?.code || error?.message || error);
    return [];
  }
}

/**
 * Helper: Save a single document to Firestore with exponential backoff retry
 */
export async function firestoreSave(collectionName: string, id: string, data: any): Promise<void> {
  if (!db || _circuitOpen) {
    if (_circuitOpen) console.warn(`[Circuit Breaker] Skipping save ${collectionName}/${id}`);
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
    // Retry for transient errors (network blip, contention, auth timing)
    if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
      tripCircuit(`save(${collectionName}/${id})`);
      if (_circuitOpen) {
        throw error; // Circuit is open — don't even retry
      }
      // Auth timing issue — wait for auth to propagate, then retry once
      if (auth?.currentUser) {
        try {
          console.log(`[Firebase] Permission denied for ${collectionName}/${id} — retrying after auth settle (1.5s)`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          const savePromise2 = setDoc(doc(db, collectionName, id), { ...data, _updatedAt: new Date().toISOString() });
          const timeoutPromise2 = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Firestore write timeout after ${timeoutMs}ms`)), timeoutMs)
          );
          await Promise.race([savePromise2, timeoutPromise2]);
          return; // success on retry
        } catch (retryErr: any) {
          throw retryErr; // Genuine permission denied — let sync queue handle it
        }
      }
      // No auth.currentUser — genuinely unauthenticated, don't retry
      throw error;
    }
    // Retry other transient errors (network, timeout, etc.)
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
  if (!db || items.length === 0 || _circuitOpen) {
    if (_circuitOpen) console.warn(`[Circuit Breaker] Skipping bulk save ${collectionName} (${items.length} items)`);
    return;
  }
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
 * Atomic multi-collection write using Firestore writeBatch.
 * All writes succeed or fail together — critical for financial ledger consistency.
 * @param writes Array of { collection, id, data } operations to commit atomically.
 */
export async function firestoreAtomicWrite(
  writes: Array<{ collection: string; id: string; data: any }>
): Promise<void> {
  if (!db || writes.length === 0) return;
  if (_circuitOpen) {
    console.warn('[Circuit Breaker] Skipping atomic write');
    throw new Error('Circuit breaker open');
  }
  const batch = writeBatch(db);
  const timestamp = new Date().toISOString();
  writes.forEach(({ collection, id, data }) => {
    const docRef = doc(db, collection, String(id));
    batch.set(docRef, { ...data, _updatedAt: timestamp });
  });
  await batch.commit();
  console.log(`[Firebase] Atomic write: ${writes.length} docs committed`);
}

/**
 * Subscribe to real-time changes in a Firestore collection
 */
export function firestoreSubscribe<T>(collectionName: string, callback: (data: T[], snapshot?: any) => void): () => void {
  if (!db) {
    console.warn(`[Firestore] firestoreSubscribe: db is null, cannot subscribe to ${collectionName}`);
    return () => {};
  }
  
  try {
    const q = query(collection(db, collectionName));
    let firstEmission = true;
    let retryCount = 0;
    const maxRetries = 3;
    let currentUnsub: (() => void) | null = null;

    const subscribe = (): (() => void) => {
      // Unsubscribe previous listener BEFORE creating a new one (prevents leak)
      if (currentUnsub) {
        try { currentUnsub(); } catch {}
        currentUnsub = null;
      }
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
        // Log removals explicitly for debugging ghost data issues
        if (!firstEmission) {
          const removals = snapshot.docChanges().filter(c => c.type === 'removed');
          if (removals.length > 0) {
            console.log(`[Firestore] ${collectionName}: ${removals.length} document(s) REMOVED:`, removals.map(c => c.doc.id));
          }
        }
        if (firstEmission) {
          console.log(`[Firestore] Listener: ${collectionName} — ${data.length} records (from: ${snapshot.metadata.fromCache ? 'cache' : 'server'})`);
          firstEmission = false;
          retryCount = 0; // Reset retries on success
        }
        callback(data, snapshot);
      }, (error) => {
        console.error(`[Firebase] Snapshot error for ${collectionName}:`, error?.code, error?.message);
        if (error?.code === 'permission-denied') {
          tripCircuit(`listener(${collectionName})`);
          // Unsubscribe this listener IMMEDIATELY to prevent leak
          if (currentUnsub) {
            try { currentUnsub(); } catch {}
            currentUnsub = null;
          }
          // Stop retrying if circuit breaker tripped
          if (_circuitOpen) {
            console.error(`[Circuit Breaker] No retry for ${collectionName} — circuit is OPEN`);
            return;
          }
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = retryCount * 2000;
            console.log(`[Firestore] Retrying ${collectionName} listener in ${delay / 1000}s (attempt ${retryCount}/${maxRetries})...`);
            setTimeout(() => {
              if (!_circuitOpen) currentUnsub = subscribe();
            }, delay);
          } else {
            console.error(`[Firestore] GIVING UP on ${collectionName} after ${maxRetries} retries — permission denied`);
          }
        }
      });
    };
    currentUnsub = subscribe();
    return () => {
      if (currentUnsub) {
        try { currentUnsub(); } catch {}
        currentUnsub = null;
      }
    };
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
    let retryCount = 0;
    const maxRetries = 3;
    let currentUnsub: (() => void) | null = null;

    const subscribe = (): (() => void) => {
      // Unsubscribe previous listener BEFORE creating a new one (prevents leak)
      if (currentUnsub) {
        try { currentUnsub(); } catch {}
        currentUnsub = null;
      }
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
        const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        // Log removals explicitly for debugging ghost data issue
        if (!firstEmission) {
          const removals = snapshot.docChanges().filter(c => c.type === 'removed');
          if (removals.length > 0) {
            console.log(`[Firestore] ${collectionName} (limited): ${removals.length} document(s) REMOVED:`, removals.map(c => c.doc.id));
          }
        }
        if (firstEmission) {
          console.log(`[Firestore] Limited listener: ${collectionName} — ${data.length}/${limitCount} records (from: ${snapshot.metadata.fromCache ? 'cache' : 'server'})`);
          firstEmission = false;
          retryCount = 0;
        }
        callback(data, lastDoc);
      }, (error) => {
        console.error(`[Firebase] Snapshot error for ${collectionName}:`, error?.code, error?.message);
        if (error?.code === 'permission-denied') {
          tripCircuit(`limitedListener(${collectionName})`);
          // Unsubscribe this listener IMMEDIATELY to prevent leak
          if (currentUnsub) {
            try { currentUnsub(); } catch {}
            currentUnsub = null;
          }
          // Stop retrying if circuit breaker tripped
          if (_circuitOpen) {
            console.error(`[Circuit Breaker] No retry for ${collectionName} — circuit is OPEN`);
            return;
          }
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = retryCount * 2000;
            console.log(`[Firestore] Retrying ${collectionName} limited listener in ${delay / 1000}s (attempt ${retryCount}/${maxRetries})...`);
            setTimeout(() => {
              if (!_circuitOpen) currentUnsub = subscribe();
            }, delay);
          } else {
            console.error(`[Firestore] GIVING UP on ${collectionName} after ${maxRetries} retries — permission denied`);
          }
        }
        if (error?.code === 'failed-precondition') {
          console.error(`[Firebase] MISSING INDEX: Create a composite index on '${collectionName}' for field '${orderByField}'.`, error?.message);
        }
      });
    };
    currentUnsub = subscribe();
    return () => {
      if (currentUnsub) {
        try { currentUnsub(); } catch {}
        currentUnsub = null;
      }
    };
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
