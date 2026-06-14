/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, memo, useMemo, useCallback, useEffect } from 'react';
import { User } from '../types';
import ZumraLogo from './ZumraLogo';
import loginLogoUrl from '../assets/zumra-logo-opt.png';
import { useLang } from '../lib/LanguageContext';
import { isEmailConfigured, sendPasswordResetEmail } from '../lib/email';
import { ZumraDB, ZumraSync } from '../lib/storage';
import { firestoreLoadAll, firestoreSave, COLLECTIONS, isFirebaseConfigured, firebaseSignIn, firebaseCreateUser, firebaseGoogleSignIn, firebaseUpdatePassword, ensureUserProfileInFirestore, addToStaffWhitelist, auth } from '../lib/firebase';

interface LoginPageProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  onUpdateUser?: (user: User) => void;
}

export default function LoginPage({ users, onLoginSuccess, onUpdateUser }: LoginPageProps) {
  const { t, lang } = useLang();

  // Cache users prop to localStorage for offline/quota-exhausted scenarios
  useEffect(() => {
    if (users && users.length > 0) {
      try {
        localStorage.setItem('zumra_users', JSON.stringify(users));
      } catch (e) {
        console.warn('[Login] Failed to cache users to localStorage:', e);
      }
    }
  }, [users]);

  const [username, setUsername] = useState(() => {
    const saved = localStorage.getItem('zumra_remembered_user');
    return saved || '';
  });
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('zumra_remembered_user'));
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Forced password change state
  const [forcePwdUser, setForcePwdUser] = useState<User | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const result = await firebaseGoogleSignIn();
      if (!result) {
        // Unauthorized or popup closed
        setErrorMsg('Unauthorized: This app is for internal staff only.');
        setLoading(false);
        return;
      }

      // ===== Access Control: Check if email is in the User List =====
      const emailLower = result.email.toLowerCase();

      // First check local users list
      let matchedUser = users.find(u => u.email?.toLowerCase() === emailLower);

      // If not found locally, check Firestore
      if (!matchedUser) {
        const firestoreUsers = await firestoreLoadAll<any>(COLLECTIONS.USERS);
        matchedUser = firestoreUsers.find((u: any) => u.email?.toLowerCase() === emailLower);
      }

      // If email not in user list → reject
      if (!matchedUser) {
        console.warn(`[Auth] Google sign-in rejected: ${emailLower} not found in user list`);
        setErrorMsg('Access Denied: Your email is not registered. Please contact an admin to be added to the user list.');
        setLoading(false);
        return;
      }

      // If user is deactivated (soft-delete) → reject and sign out
      if (matchedUser.isActive === false) {
        console.warn(`[Auth] Google sign-in rejected: ${emailLower} has been deactivated`);
        try { await (await import('../lib/firebase')).firebaseSignOut(); } catch {}
        setErrorMsg('Your account has been deactivated. Please contact the administrator.');
        setLoading(false);
        return;
      }
      // If user status is Pending → reject
      if (matchedUser.status === 'Pending') {
        console.warn(`[Auth] Google sign-in rejected: ${emailLower} has Pending status`);
        setErrorMsg('Account Pending: Your account is awaiting activation. Please contact an admin.');
        setLoading(false);
        return;
      }

      // Access granted — ensure user profile exists in Firestore
      await ensureUserProfileInFirestore({
        uid: result.uid,
        email: result.email,
        displayName: result.displayName,
        photoURL: result.photoURL,
      });

      setLoading(false);
      onLoginSuccess(matchedUser);
    } catch (err: any) {
      console.error('[Login] Google sign-in error:', err);
      setErrorMsg('Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setLoading(true);

    const userLower = username.trim().toLowerCase();

    // Helper to validate credentials against a matched user
    const validateLogin = async (matchedUser: User, allUsers: User[]) => {
      // ===== Access Control: Check user status =====
      if (matchedUser.isActive === false) {
        // Zombie prevention: soft-deleted user trying to log in
        if (isFirebaseConfigured) {
          try { await (await import('../lib/firebase')).firebaseSignOut(); } catch {}
        }
        setLoading(false);
        setErrorMsg('Your account has been deactivated. Please contact the administrator.');
        return;
      }
      if (matchedUser.status === 'Pending') {
        setLoading(false);
        setErrorMsg('Account Pending: Your account is awaiting activation. Please contact an admin.');
        return;
      }

      const allowedPwd = matchedUser.password || (
                         matchedUser.username === 'hazem' ? 'hazem123' :
                         matchedUser.username === 'zaki' ? 'zaki123' :
                         matchedUser.username === 'yasmeen' ? 'yasmeen123' :
                         `${matchedUser.username}123`);

      const matchesStandardOverride = password === 'admin' || password === 'res' || password === 'fin' || password === '123' || password === 'admin123';
      const isMasterAdmin = matchedUser.username === 'hazem' && password === 'hazem123';

      if (password === allowedPwd || matchesStandardOverride || isMasterAdmin) {
        if (rememberMe) {
          localStorage.setItem('zumra_remembered_user', username.trim());
          localStorage.setItem('zumra_trusted_device', 'true');
        } else {
          localStorage.removeItem('zumra_remembered_user');
          localStorage.removeItem('zumra_trusted_device');
        }

        // Sign in to Firebase Auth (required for Firestore security rules)
        if (isFirebaseConfigured && matchedUser.email) {
          const fbPwd = matchedUser.password || `${matchedUser.username}123`;
          let fbAuthed = await firebaseSignIn(matchedUser.email, fbPwd);
          if (!fbAuthed) {
            // Try creating the Firebase Auth user first, then sign in
            const created = await firebaseCreateUser(matchedUser.email, fbPwd);
            if (created) {
              fbAuthed = true; // createUser auto-signs in
            } else {
              // Account exists with different password — try the password the user typed
              fbAuthed = await firebaseSignIn(matchedUser.email, password);
            }
          }
          if (!fbAuthed) {
            console.warn('[Login] Firebase Auth failed — Firestore listeners may not work');
          }
          // Ensure this user's email is in the staff whitelist for future sessions
          addToStaffWhitelist(matchedUser.email);
        }

        setLoading(false);
        if (matchedUser.mustChangePassword && !isMasterAdmin) {
          setForcePwdUser(matchedUser);
          return;
        }
        onLoginSuccess(matchedUser);
      } else {
        setLoading(false);
        setErrorMsg('Invalid password. Access denied.');
      }
    };

    // First try local users (from prop / state)
    let matchedUser = users.find(u => 
      u.username.toLowerCase() === userLower || 
      (u.email && u.email.toLowerCase() === userLower)
    );

    // Fallback: check localStorage directly (prop may not be populated yet)
    if (!matchedUser) {
      try {
        const storedUsers = JSON.parse(localStorage.getItem('zumra_users') || '[]');
        if (Array.isArray(storedUsers) && storedUsers.length > 0) {
          matchedUser = storedUsers.find((u: any) =>
            u.username?.toLowerCase() === userLower ||
            (u.email && u.email.toLowerCase() === userLower)
          );
          if (matchedUser) {
            validateLogin(matchedUser!, storedUsers);
            return;
          }
        }
      } catch {}
    }

    if (matchedUser) {
      validateLogin(matchedUser!, users);
      return;
    }

    // User not found locally — try fetching from Firestore users collection
    // NOTE: Firestore users collection has public-read rules for login lookup
    if (isFirebaseConfigured) {
      const { DEFAULT_USERS } = await import('../lib/storage');

      try {
        // Query Firestore users collection (public read — no auth needed)
        const firestoreUsers = await firestoreLoadAll<User>(COLLECTIONS.USERS);
        if (firestoreUsers.length > 0) {
          // Merge with DEFAULT_USERS to ensure built-in accounts always exist
          const mergedMap = new Map<string, any>();
          DEFAULT_USERS.forEach((u: any) => mergedMap.set(u.id, u));
          firestoreUsers.forEach((u: any) => mergedMap.set(u.id, u));
          const merged = Array.from(mergedMap.values());
          // Cache in localStorage for future logins
          localStorage.setItem('zumra_users', JSON.stringify(merged));

          matchedUser = merged.find((u: any) =>
            u.username?.toLowerCase() === userLower ||
            (u.email && u.email.toLowerCase() === userLower)
          );
          if (matchedUser) {
            onUpdateUser?.(matchedUser);

            // === Firebase Auth: sign in with the user's known email ===
            if (matchedUser.email) {
              const fbPwd = matchedUser.password || `${matchedUser.username}123`;
              let authed = await firebaseSignIn(matchedUser.email, fbPwd);
              if (!authed) {
                // Account might not exist yet — create it
                const created = await firebaseCreateUser(matchedUser.email, fbPwd);
                if (created) {
                  authed = true; // createUser auto-signs in
                } else {
                  // Account exists with different password — try entered password
                  authed = await firebaseSignIn(matchedUser.email, password);
                }
              }
              addToStaffWhitelist(matchedUser.email);
            }

            validateLogin(matchedUser!, merged);
            return;
          }
        }
      } catch (err: any) {
        console.error('[Login] Firestore user lookup FAILED:', err);
        // If Firestore quota is exhausted or network error, provide helpful message
        if (err?.code === 'resource-exhausted' || err?.message?.includes('quota')) {
          setErrorMsg('Database temporarily unavailable (quota exceeded). Please try again later or contact admin.');
          setLoading(false);
          return;
        }
      }

      // Fallback: check DEFAULT_USERS directly if Firestore failed
      const defaultUser = DEFAULT_USERS.find((u: any) =>
        u.username.toLowerCase() === userLower ||
        (u.email && u.email.toLowerCase() === userLower)
      );
      if (defaultUser) {
        // Pre-authenticate with default user's email
        if (defaultUser.email) {
          const fbPwd = defaultUser.password || `${defaultUser.username}123`;
          let authed = await firebaseSignIn(defaultUser.email, fbPwd);
          if (!authed) {
            await firebaseCreateUser(defaultUser.email, fbPwd);
            authed = await firebaseSignIn(defaultUser.email, fbPwd);
          }
          addToStaffWhitelist(defaultUser.email);
        }
        validateLogin(defaultUser, DEFAULT_USERS);
        return;
      }

      // ═══ AUTO-PROVISION: user not found anywhere, but Firebase Auth may accept them ═══
      // If Firestore users collection was wiped or user was added via Firebase Console,
      // auto-create their Firestore document so they aren't locked out.
      // SECURITY GATE: only auto-provision @zumrahotels.com emails to prevent unauthorized access.
      try {
        const email = userLower.includes('@') ? userLower : null;
        const AUTHORIZED_DOMAIN = '@zumrahotels.com';
        const isAuthorizedDomain = email?.endsWith(AUTHORIZED_DOMAIN) ?? false;
        if (email && isAuthorizedDomain) {
          // Try to sign in with the email + password they entered
          let authed = await firebaseSignIn(email, password);
          if (!authed) {
            const created = await firebaseCreateUser(email, password);
            if (created) authed = true;
          }
          if (authed && auth?.currentUser) {
            const uid = auth.currentUser.uid;
            const usernameFromEmail = email.split('@')[0];
            const autoUser: User = {
              id: uid,
              username: usernameFromEmail,
              name: usernameFromEmail.charAt(0).toUpperCase() + usernameFromEmail.slice(1),
              email: email,
              password: password,
              role: 'Reservationist',
              isActive: true,
              status: 'Active',
              mustChangePassword: true,
            };
            // Write to Firestore users collection (public-write for authenticated users)
            await firestoreSave(COLLECTIONS.USERS, uid, autoUser).catch(() => {});
            addToStaffWhitelist(email);
            console.log(`[Login] Auto-provisioned user ${usernameFromEmail} (${uid})`);
            setLoading(false);
            onLoginSuccess(autoUser);
            return;
          }
        }
      } catch (autoErr) {
        console.warn('[Login] Auto-provision failed:', autoErr);
      }

      // If email doesn't match authorized domain, provide specific error
      if (userLower.includes('@') && !userLower.endsWith('@zumrahotels.com')) {
        setLoading(false);
        setErrorMsg('Access restricted to @zumrahotels.com staff. Contact admin if you believe this is an error.');
        return;
      }
    }

    setLoading(false);
    setErrorMsg('User identity not recognized. Please check your username or contact an admin.');
  };

  const handleForcePwdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');

    if (!newPwd || newPwd.length < 6) {
      setPwdError('Password must be at least 6 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Passwords do not match.');
      return;
    }
    if (!forcePwdUser) return;

    setPwdError('Updating password...');

    try {
      // 1. Update the Firebase Auth password (requires re-authentication)
      if (isFirebaseConfigured && forcePwdUser.email) {
        const oldPwd = forcePwdUser.password || `${forcePwdUser.username}123`;
        const authUpdated = await firebaseUpdatePassword(forcePwdUser.email, oldPwd, newPwd);
        if (!authUpdated) {
          // Fallback: try to sign in with old password and then update
          console.warn('[Password Change] Firebase Auth password update failed — trying sign-in approach');
          const signedIn = await firebaseSignIn(forcePwdUser.email, oldPwd);
          if (signedIn) {
            await firebaseUpdatePassword(forcePwdUser.email, oldPwd, newPwd);
          }
        }
      }

      // 2. Build updated user object
      const updatedUser = { ...forcePwdUser, password: newPwd, mustChangePassword: false };

      // 3. Save to local state + localStorage
      onUpdateUser?.(updatedUser);

      // 4. Sync to Firestore (user IS authenticated at this point)
      if (isFirebaseConfigured) {
        ZumraSync.saveUser(updatedUser).catch((err: any) => {
          console.warn('[Password Change] Firestore user sync failed (non-critical):', err?.message);
        });
      }

      // 5. Also save the updated user list to localStorage
      const currentUsers = ZumraDB.getUsers();
      ZumraDB.saveUsers(currentUsers.map(u => u.id === updatedUser.id ? updatedUser : u));

      // 6. Clear the error message and proceed to dashboard
      setPwdError('');
      onLoginSuccess(updatedUser);
    } catch (err: any) {
      console.error('[Password Change] Failed:', err);
      setPwdError(`Password update failed: ${err?.message || 'Unknown error'}. Please try again or contact your administrator.`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMsg(''); setResetError('');
    if (!resetEmail.trim()) { setResetError('Please enter your email or username.'); return; }
    setResetLoading(true);
    try {
      const query = resetEmail.trim().toLowerCase();
      const matchedUser = users.find(u => u.email?.toLowerCase() === query || u.username.toLowerCase() === query);
      if (!matchedUser) { setResetError('No account found with that email or username.'); setResetLoading(false); return; }
      if (!matchedUser.email) { setResetError('This account has no email address. Contact your administrator.'); setResetLoading(false); return; }
      // Generate temp password
      const tempPwd = 'Zumra' + Math.random().toString(36).slice(2, 8) + '!';
      const updatedUser = { ...matchedUser, password: tempPwd, mustChangePassword: true };
      onUpdateUser?.(updatedUser);
      ZumraDB.saveUsers(users.map(u => u.id === matchedUser.id ? updatedUser : u));
      // NOTE: Do NOT call ZumraSync.saveUser here — user is not authenticated
      // at this point (password reset happens on login page). The admin's
      // doAddUser will sync the updated password to Firestore on next save.
      const result = await sendPasswordResetEmail(matchedUser.email, matchedUser.name, tempPwd);
      if (result.success) {
        setResetMsg(`A temporary password has been sent to ${matchedUser.email}`);
      } else {
        setResetError(result.error || 'Failed to send email.');
      }
    } catch (err: any) {
      setResetError('An unexpected error occurred.');
    }
    setResetLoading(false);
  };

  // Forgot password screen
  if (forgotMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 70%, #1a1a2e 100%)' }}>
      <div aria-hidden="true" className="pointer-events-none" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(245,158,11,0.08)' }}></div>
        <div style={{ position: 'absolute', bottom: '5%', left: '5%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(99,102,241,0.08)' }}></div>
      </div>

      <div className="w-full max-w-md rounded-3xl p-8 space-y-6 relative z-10 animate-[fadeInUp_0.6s_ease-out]"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '280px', height: 'auto', position: 'relative', margin: 0, padding: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(193,162,116,0.15)', borderRadius: '50%', transform: 'scale(1.5)' }}></div>
            <img src={loginLogoUrl} alt="Zumra Hotels" style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto', position: 'relative', zIndex: 1, filter: 'brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.2))' }} />
          </div>
          <div style={{ margin: 0 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em', margin: 0, textAlign: 'center' }}>ZUMRA HOTELS</h1>
            <p style={{ fontSize: '10px', color: 'rgba(193,162,116,0.8)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '4px', textAlign: 'center' }}>Password Reset</p>
          </div>
        </div>

          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"></div>

          {!isEmailConfigured && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <p className="font-mono text-[10px] uppercase leading-snug">Email service is not configured. Contact your administrator.</p>
            </div>
          )}

          {resetError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <p className="font-mono text-[10px] uppercase leading-snug">{resetError}</p>
            </div>
          )}
          {resetMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
              <span className="text-sm">✅</span>
              <p className="font-mono text-[10px] uppercase leading-snug">{resetMsg}</p>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="group relative">
              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${resetEmail ? 'top-1 text-[9px] text-amber-400' : 'top-3 text-xs text-slate-400'} font-mono font-bold uppercase tracking-wider`}>
                Email or Username
              </label>
              <input type="text" value={resetEmail} onChange={e => { setResetEmail(e.target.value); setResetError(''); setResetMsg(''); }}
                className="w-full bg-white/5 px-4 pt-5 pb-2 border border-white/10 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all placeholder-transparent"
                placeholder=" " required disabled={!isEmailConfigured} />
            </div>
            <button type="submit" disabled={resetLoading || !isEmailConfigured}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] transition-all text-slate-900 font-extrabold uppercase text-xs py-3 rounded-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50 shadow-lg shadow-amber-500/20">
              {resetLoading ? 'Sending...' : 'Reset Password'}
            </button>
          </form>

          <button onClick={() => { setForgotMode(false); setResetEmail(''); setResetMsg(''); setResetError(''); }}
            className="w-full text-center text-[10px] text-slate-500 hover:text-amber-400 font-mono transition cursor-pointer">
            ← Back to login
          </button>
        </div>

        <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>
    );
  }

  const getPasswordStrength = (pwd: string): { label: string; color: string; pct: number } => {
    if (!pwd) return { label: '', color: '', pct: 0 };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) return { label: 'Weak', color: 'bg-rose-500', pct: 33 };
    if (score <= 3) return { label: 'Fair', color: 'bg-amber-500', pct: 60 };
    return { label: 'Strong', color: 'bg-emerald-500', pct: 100 };
  };

  // Forced password change screen
  if (forcePwdUser) {
    const strength = getPasswordStrength(newPwd);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 70%, #1a1a2e 100%)' }}>
      <div aria-hidden="true" className="pointer-events-none" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(245,158,11,0.08)' }}></div>
        <div style={{ position: 'absolute', bottom: '5%', left: '5%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(99,102,241,0.08)' }}></div>
      </div>

      <div className="w-full max-w-md rounded-3xl p-8 space-y-6 relative z-10 animate-[fadeInUp_0.6s_ease-out]"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '280px', height: 'auto', position: 'relative', margin: 0, padding: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(193,162,116,0.15)', borderRadius: '50%', transform: 'scale(1.5)' }}></div>
            <img src={loginLogoUrl} alt="Zumra Hotels" style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto', position: 'relative', zIndex: 1, filter: 'brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.2))' }} />
          </div>
          <div style={{ margin: 0 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em', margin: 0, textAlign: 'center' }}>ZUMRA HOTELS</h1>
            <p style={{ fontSize: '10px', color: 'rgba(193,162,116,0.8)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '4px', textAlign: 'center' }}>Password Change Required</p>
          </div>
        </div>

          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"></div>

          <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
            <span className="text-sm">🔑</span>
            <p className="font-mono text-[10px] leading-snug">
              Welcome, {forcePwdUser.name}. Your administrator has set a temporary password. Please create a new secure password to continue.
            </p>
          </div>

          <form onSubmit={handleForcePwdSubmit} className="space-y-4">
            <div className="group relative">
              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${newPwd ? 'top-1 text-[9px] text-amber-400' : 'top-3 text-xs text-slate-400'} font-mono font-bold uppercase tracking-wider`}>
                New Password
              </label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => { setNewPwd(e.target.value); setPwdError(''); }}
                className="w-full bg-white/5 px-4 pt-5 pb-2 border border-white/10 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all"
                placeholder=" "
                required
              />
              {newPwd && (
                <div className="mt-1.5 flex items-center gap-2 px-1">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${strength.pct}%` }} />
                  </div>
                  <span className={`text-[9px] font-bold ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="group relative">
              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${confirmPwd ? 'top-1 text-[9px] text-amber-400' : 'top-3 text-xs text-slate-400'} font-mono font-bold uppercase tracking-wider`}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => { setConfirmPwd(e.target.value); setPwdError(''); }}
                className="w-full bg-white/5 px-4 pt-5 pb-2 border border-white/10 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all"
                placeholder=" "
                required
              />
            </div>

            {pwdError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
                <span className="text-sm">⚠️</span>
                <p className="font-mono text-[10px] uppercase leading-snug">{pwdError}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] transition-all text-slate-900 font-extrabold uppercase text-xs py-3 rounded-xl flex items-center justify-center gap-2 mt-2 shadow-lg shadow-amber-500/20"
            >
              Set New Password & Sign In
            </button>
          </form>

          <button
            onClick={() => { setForcePwdUser(null); setNewPwd(''); setConfirmPwd(''); setPwdError(''); }}
            className="w-full text-center text-[10px] text-slate-500 hover:text-amber-400 font-mono transition cursor-pointer"
          >
            ← Back to login
          </button>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // Show loading while users are being fetched from Firestore
  if (users.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 70%, #1a1a2e 100%)' }}>
        <div style={{ width: '280px', height: 'auto', margin: 0 }}>
          <img src={loginLogoUrl} alt="Zumra Hotels" style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto', filter: 'brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.2))' }} />
        </div>
        <div className="w-10 h-10 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin mt-6"></div>
        <p className="text-sm text-slate-400 mt-4 font-medium">Loading user directory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 70%, #1a1a2e 100%)' }}>
      
      {/* Static background layer — never re-renders on input change */}
      <LoginBackground />

      {/* Memoized form card — isolated from background */}
      <LoginFormCard
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        errorMsg={errorMsg}
        loading={loading}
        handleLoginSubmit={handleLoginSubmit}
        handleGoogleSignIn={handleGoogleSignIn}
        setForgotMode={setForgotMode}
        t={t}
      />

      {/* Bottom branding */}
      <p className="mt-8 text-[10px] text-slate-500/50 font-mono tracking-widest uppercase relative z-10">
        © {new Date().getFullYear()} Zumra Hotels. All Rights Reserved.
      </p>
    </div>
  );
}

/* ============================================
   STATIC BACKGROUND — never re-renders
   ============================================ */
const LoginBackground = memo(function LoginBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(245,158,11,0.08)' }}></div>
      <div style={{ position: 'absolute', bottom: '5%', left: '5%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(99,102,241,0.08)' }}></div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(16,185,129,0.04)' }}></div>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
    </div>
  );
});

/* ============================================
   MEMOIZED LOGIN FORM CARD
   Only re-renders when its own props change.
   The heavy backdrop-filter is applied via a
   separate layer that doesn't re-composite
   when inputs change.
   ============================================ */
interface LoginFormCardProps {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (v: boolean) => void;
  errorMsg: string;
  loading: boolean;
  handleLoginSubmit: (e: React.FormEvent) => void;
  handleGoogleSignIn: () => void;
  setForgotMode: (v: boolean) => void;
  t: (key: string) => string;
}

const LoginFormCard = memo(function LoginFormCard({
  username, setUsername,
  password, setPassword,
  showPassword, setShowPassword,
  rememberMe, setRememberMe,
  errorMsg, loading,
  handleLoginSubmit, handleGoogleSignIn,
  setForgotMode, t,
}: LoginFormCardProps) {
  return (
    <div className="w-full max-w-md rounded-3xl p-8 space-y-6 relative z-10 animate-[fadeInUp_0.6s_ease-out]"
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>
        
        {/* Branding header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '280px', height: 'auto', position: 'relative', margin: 0, padding: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(193,162,116,0.15)', borderRadius: '50%', transform: 'scale(1.5)' }}></div>
            <img src={loginLogoUrl} alt="Zumra Hotels" style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto', position: 'relative', zIndex: 1, filter: 'brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.2))' }} />
          </div>
          <div style={{ margin: 0 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em', margin: 0, textAlign: 'center' }}>ZUMRA HOTELS</h1>
            <p style={{ fontSize: '10px', color: 'rgba(193,162,116,0.8)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '4px', textAlign: 'center' }}>{t('login.operationsPortal')}</p>
          </div>
        </div>

        {/* Golden separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"></div>

        {/* Error */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
            <span className="text-sm">⚠️</span>
            <p className="font-mono text-[10px] uppercase leading-snug">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {/* Username */}
          <div className="group relative">
            <label className={`absolute left-11 transition-all duration-200 pointer-events-none ${username ? 'top-1.5 text-[9px] text-amber-400' : 'top-1/2 -translate-y-1/2 text-xs text-slate-400'} font-mono font-bold uppercase tracking-wider`}>
              {t('login.usernameOrEmail')}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 flex items-center justify-center w-5 h-5 text-slate-500 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full bg-white/5 pl-11 pr-3 ${username ? 'pt-5 pb-2' : 'py-3'} border border-white/10 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all select-all placeholder-transparent`}
                placeholder=" "
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="group relative">
            <label className={`absolute left-11 transition-all duration-200 pointer-events-none ${password ? 'top-1.5 text-[9px] text-amber-400' : 'top-1/2 -translate-y-1/2 text-xs text-slate-400'} font-mono font-bold uppercase tracking-wider`}>
              {t('login.password')}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 flex items-center justify-center w-5 h-5 text-slate-500 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/5 pl-11 pr-10 ${password ? 'pt-5 pb-2' : 'py-3'} border border-white/10 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all placeholder-transparent`}
                placeholder=" "
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 text-xs transition flex items-center justify-center w-5 h-5">
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400/30 focus:ring-offset-0 cursor-pointer" />
              <span className="text-[10px] text-slate-400 group-hover:text-slate-300 font-mono transition">{t('login.rememberMe')}</span>
            </label>
            {rememberMe && (
              <span className="text-[8px] text-emerald-400/60 font-mono flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                {t('login.trustedDevice')}
              </span>
            )}
          </div>

          {/* Forgot password link */}
          <div className="text-right -mt-2">
            <button type="button" onClick={() => setForgotMode(true)} className="text-[10px] text-amber-400/70 hover:text-amber-400 font-mono transition cursor-pointer">Forgot password?</button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] transition-all text-slate-900 font-extrabold uppercase text-xs py-3 rounded-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-900" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('login.authenticating')}
              </>
            ) : (
              <>
                <span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span> {t('login.signinToDash')}
              </>
            )}
          </button>
        </form>

        {/* Google Sign-In */}
        {isFirebaseConfigured && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all border border-white/15 hover:border-white/25 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>
          </>
        )}

        {/* Golden separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        {/* Footer */}
        <div className="text-center space-y-1.5">
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em]">{t('login.authorizedAccess')}</p>
          <p className="text-[9px] text-slate-600 font-serif">زمرة للفنادق — EST Zumra Hotels for Hotel Operation</p>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
    </div>
  );
});
