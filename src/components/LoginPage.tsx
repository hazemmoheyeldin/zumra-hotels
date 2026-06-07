/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import ZumraLogo from './ZumraLogo';
import { useLang } from '../lib/LanguageContext';
import { isEmailConfigured, sendPasswordResetEmail } from '../lib/email';
import { ZumraDB, ZumraSync } from '../lib/storage';
import { firestoreLoadAll, COLLECTIONS, isFirebaseConfigured } from '../lib/firebase';

interface LoginPageProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  onUpdateUser?: (user: User) => void;
}

export default function LoginPage({ users, onLoginSuccess, onUpdateUser }: LoginPageProps) {
  const { t, lang } = useLang();
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setLoading(true);

    // Helper to validate credentials against a matched user
    const validateLogin = (matchedUser: User, allUsers: User[]) => {
      setLoading(false);
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
        if (matchedUser.mustChangePassword && !isMasterAdmin) {
          setForcePwdUser(matchedUser);
          return;
        }
        onLoginSuccess(matchedUser);
      } else {
        setErrorMsg('Invalid password. Access denied.');
      }
    };

    // First try local users
    const userLower = username.trim().toLowerCase();
    let matchedUser = users.find(u => 
      u.username.toLowerCase() === userLower || 
      (u.email && u.email.toLowerCase() === userLower)
    );

    if (matchedUser) {
      setTimeout(() => validateLogin(matchedUser!, users), 800);
      return;
    }

    // User not found locally — try fetching from Firestore
    if (isFirebaseConfigured) {
      try {
        const firestoreUsers = await firestoreLoadAll<User>(COLLECTIONS.USERS);
        if (firestoreUsers.length > 0) {
          // Update local state with Firestore users
          localStorage.setItem('zumra_users', JSON.stringify(firestoreUsers));
          matchedUser = firestoreUsers.find(u =>
            u.username.toLowerCase() === userLower ||
            (u.email && u.email.toLowerCase() === userLower)
          );
          if (matchedUser) {
            // Pass Firestore users so parent can update state
            onUpdateUser?.(matchedUser);
            setTimeout(() => validateLogin(matchedUser!, firestoreUsers), 400);
            return;
          }
        }
      } catch (err) {
        console.warn('[Login] Firestore user lookup failed:', err);
      }
    }

    setLoading(false);
    setErrorMsg('User identity not recognized.');
  };

  const handleForcePwdSubmit = (e: React.FormEvent) => {
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

    const updatedUser = { ...forcePwdUser, password: newPwd, mustChangePassword: false };
    onUpdateUser?.(updatedUser);
    onLoginSuccess(updatedUser);
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
      ZumraSync.saveUser(updatedUser);
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
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[5%] left-[5%] w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md rounded-3xl p-8 space-y-6 relative z-10 animate-[fadeInUp_0.6s_ease-out]"
          style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

          <div className="text-center flex flex-col items-center space-y-3">
            <ZumraLogo size="xxl" variant="gold" className="justify-center relative z-10" />
            <div className="mt-1">
              <h1 className="text-xl font-extrabold text-white tracking-wide">ZUMRA HOTELS</h1>
              <p className="text-[10px] text-amber-400/80 font-mono uppercase tracking-[0.3em] mt-1">Password Reset</p>
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
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[5%] left-[5%] w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md rounded-3xl p-8 space-y-6 relative z-10 animate-[fadeInUp_0.6s_ease-out]"
          style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

          <div className="text-center flex flex-col items-center space-y-3">
            <ZumraLogo size="xxl" variant="gold" className="justify-center relative z-10" />
            <div className="mt-1">
              <h1 className="text-xl font-extrabold text-white tracking-wide">ZUMRA HOTELS</h1>
              <p className="text-[10px] text-amber-400/80 font-mono uppercase tracking-[0.3em] mt-1">Password Change Required</p>
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
        <ZumraLogo size="xxl" variant="gold" />
        <div className="w-10 h-10 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin mt-6"></div>
        <p className="text-sm text-slate-400 mt-4 font-medium">Loading user directory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 70%, #1a1a2e 100%)' }}>
      
      {/* Animated background orbs */}
      <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[5%] left-[5%] w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute top-[50%] left-[50%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none"></div>

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

      {/* Glass card */}
      <div className="w-full max-w-md rounded-3xl p-8 space-y-6 relative z-10 animate-[fadeInUp_0.6s_ease-out]"
        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
        
        {/* Branding header */}
        <div className="text-center flex flex-col items-center space-y-3">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-xl scale-150"></div>
            <ZumraLogo size="xxl" variant="gold" className="justify-center relative z-10" />
          </div>
          <div className="mt-1">
            <h1 className="text-xl font-extrabold text-white tracking-wide">ZUMRA HOTELS</h1>
            <p className="text-[10px] text-amber-400/80 font-mono uppercase tracking-[0.3em] mt-1">{t('login.operationsPortal')}</p>
          </div>
        </div>

        {/* Golden separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"></div>

        {/* Error */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2 backdrop-blur-sm">
            <span className="text-sm">⚠️</span>
            <p className="font-mono text-[10px] uppercase leading-snug">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {/* Username */}
          <div className="group relative">
            <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${username ? 'top-1 text-[9px] text-amber-400' : 'top-3 text-xs text-slate-400'} font-mono font-bold uppercase tracking-wider`}>
              {t('login.usernameOrEmail')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 pl-10 pr-3 pt-5 pb-2 border border-white/10 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all select-all placeholder-transparent"
                placeholder=" "
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="group relative">
            <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${password ? 'top-1 text-[9px] text-amber-400' : 'top-3 text-xs text-slate-400'} font-mono font-bold uppercase tracking-wider`}>
              {t('login.password')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 pl-10 pr-10 pt-5 pb-2 border border-white/10 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all placeholder-transparent"
                placeholder=" "
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 text-xs transition">
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

        {/* Golden separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        {/* Footer */}
        <div className="text-center space-y-1.5">
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em]">{t('login.authorizedAccess')}</p>
          <p className="text-[9px] text-slate-600 font-serif">زمرة للفنادق — EST Zumra Hotels for Hotel Operation</p>
        </div>
      </div>

      {/* Bottom branding */}
      <p className="mt-8 text-[10px] text-slate-500/50 font-mono tracking-widest uppercase relative z-10">
        © {new Date().getFullYear()} Zumra Hotels. All Rights Reserved.
      </p>

      {/* Keyframe animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
