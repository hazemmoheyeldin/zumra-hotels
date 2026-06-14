/**
 * Firebase Admin SDK singleton for Vercel Serverless functions.
 * Provides server-side Firestore access (bypasses client security rules).
 * Lazy-initialized on first use to avoid cold-start overhead.
 *
 * Compatible with firebase-admin v12+ modular exports.
 */

import { initializeApp, getApps, getApp, cert, type App, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let appInstance: App | null = null;

function ensureInit(): App {
  if (appInstance) return appInstance;

  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error(
      '[Firebase Admin] FIREBASE_ADMIN_SERVICE_ACCOUNT not configured. ' +
      'Generate a service account key from Firebase Console > Project Settings > Service Accounts.'
    );
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
  } catch {
    throw new Error('[Firebase Admin] FIREBASE_ADMIN_SERVICE_ACCOUNT is not valid JSON');
  }

  // Reuse existing app if already initialized (warm invocations)
  if (getApps().length > 0) {
    appInstance = getApp();
    return appInstance;
  }

  appInstance = initializeApp({
    credential: cert(serviceAccount),
  });

  console.log('[Firebase Admin] Initialized with project:', serviceAccount.projectId);
  return appInstance;
}

/** Get the Firestore instance from Firebase Admin SDK */
export function getFirestoreAdmin(): Firestore {
  ensureInit();
  return getFirestore();
}

/** Get the Firebase Admin app instance */
export function getAdminApp(): App {
  return ensureInit();
}
