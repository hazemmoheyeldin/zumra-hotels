/**
 * Zumra Hotels RMS — Cloud Functions
 * 
 * Provides secure backend operations that require Firebase Admin SDK privileges.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin SDK (uses default project config)
initializeApp();
const adminAuth = getAuth();
const adminDb = getFirestore();

/**
 * hardDeleteUser — Permanently deletes a user's Auth account AND Firestore profile.
 * 
 * Only callable by authenticated Admin users.
 * 
 * @param {Object} data
 * @param {string} data.uid — The Firebase Auth UID of the user to delete
 * @param {string} data.userName — Display name (for logging only)
 */
exports.hardDeleteUser = onCall(async (request) => {
  // ═══ SECURITY: Validate authentication ═══
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
  }

  const callerUid = request.auth.uid;
  const callerEmail = request.auth.token?.email || "";

  // ═══ SECURITY: Validate caller is Admin by checking Firestore ═══
  let callerRole = null;
  try {
    // Try by UID first, then by email
    let callerDoc = await adminDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists && callerEmail) {
      const emailQuery = await adminDb.collection("users")
        .where("email", "==", callerEmail)
        .limit(1)
        .get();
      if (!emailQuery.empty) {
        callerDoc = emailQuery.docs[0];
      }
    }
    if (callerDoc.exists) {
      callerRole = callerDoc.data().role;
    }
  } catch (err) {
    console.error("[hardDeleteUser] Failed to verify caller role:", err);
    throw new HttpsError("internal", "Failed to verify your admin status.");
  }

  if (callerRole !== "Admin") {
    throw new HttpsError("permission-denied", "Only administrators can permanently delete users.");
  }

  // ═══ Validate input ═══
  const { uid, userName } = request.data || {};
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid 'uid' parameter.");
  }

  // ═══ SECURITY: Prevent self-deletion ═══
  if (uid === callerUid) {
    throw new HttpsError("failed-precondition", "You cannot delete your own account.");
  }

  // ═══ SECURITY: Protect primary admin ═══
  try {
    const targetDoc = await adminDb.collection("users").doc(uid).get();
    if (targetDoc.exists) {
      const targetData = targetDoc.data();
      if (targetData.email === "hazem8383@gmail.com") {
        throw new HttpsError("failed-precondition", "The primary admin account cannot be deleted.");
      }
      // Prevent deleting the last admin
      if (targetData.role === "Admin") {
        const adminSnapshot = await adminDb.collection("users")
          .where("role", "==", "Admin")
          .where("isActive", "==", true)
          .get();
        if (adminSnapshot.size <= 1) {
          throw new HttpsError("failed-precondition", "Cannot delete the last active admin.");
        }
      }
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.warn("[hardDeleteUser] Could not check target user:", err);
  }

  // ═══ EXECUTE: Delete Auth account ═══
  try {
    await adminAuth.deleteUser(uid);
    console.log(`[hardDeleteUser] ✅ Auth account deleted: ${uid} (${userName || "unknown"})`);
  } catch (err) {
    // If user doesn't exist in Auth, that's fine — still delete Firestore doc
    if (err.code !== "auth/user-not-found") {
      console.error(`[hardDeleteUser] ❌ Auth deletion failed for ${uid}:`, err);
      throw new HttpsError("internal", `Failed to delete Auth account: ${err.message}`);
    }
    console.log(`[hardDeleteUser] ℹ️ Auth account not found for ${uid} — proceeding with Firestore deletion`);
  }

  // ═══ EXECUTE: Delete Firestore profile ═══
  try {
    await adminDb.collection("users").doc(uid).delete();
    console.log(`[hardDeleteUser] ✅ Firestore profile deleted: users/${uid}`);
  } catch (err) {
    console.error(`[hardDeleteUser] ❌ Firestore deletion failed for users/${uid}:`, err);
    throw new HttpsError("internal", `Auth was deleted but Firestore deletion failed: ${err.message}`);
  }

  return {
    success: true,
    message: `User "${userName || uid}" has been permanently deleted.`,
  };
});
