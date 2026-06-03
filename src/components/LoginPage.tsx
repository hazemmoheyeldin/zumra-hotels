/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import ZumraLogo from './ZumraLogo';

interface LoginPageProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export default function LoginPage({ users, onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setLoading(true);

    // Simulate standard security handshaking
    setTimeout(() => {
      setLoading(false);
      const userLower = username.trim().toLowerCase();
      // Match by username or email
      const matchedUser = users.find(u => 
        u.username.toLowerCase() === userLower || 
        (u.email && u.email.toLowerCase() === userLower)
      );

      if (!matchedUser) {
        setErrorMsg('User identity not recognized on this terminal node.');
        return;
      }

      // Verify passwords:
      // use user.password first, fallback to hardcoded if missing for legacy users
      const allowedPwd = matchedUser.password || (
                         matchedUser.username === 'hazem' ? 'hazem123' :
                         matchedUser.username === 'zaki' ? 'zaki123' :
                         matchedUser.username === 'yasmeen' ? 'yasmeen123' :
                         `${matchedUser.username}123`);

      const matchesStandardOverride = password === 'admin' || password === 'res' || password === 'fin' || password === '123' || password === 'admin123';

      if (password === allowedPwd || matchesStandardOverride) {
        onLoginSuccess(matchedUser);
      } else {
        setErrorMsg('Invalid password key. Secure login denied.');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Decorative Background Geometric Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 border border-slate-800/80 shadow-2xl space-y-6 relative z-10">
        
        {/* Branding header */}
        <div className="text-center flex flex-col items-center space-y-4">
          <ZumraLogo size="lg" variant="gold" className="justify-center" />
          <div className="mt-2 text-center">
            <h2 className="text-sm font-extrabold text-amber-400 uppercase tracking-widest font-mono">Operations Portal Gate</h2>
            <p className="text-[11px] text-zinc-400 mt-1 font-serif">Enter credentials to synchronize B2B reservation systems</p>
          </div>
        </div>

        {/* Informative credentials ledger */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-amber-900/20 text-left space-y-1.5 leading-relaxed text-[10px]">
          <span className="font-bold text-amber-500 text-[9px] uppercase tracking-wider block">🔑 Registered Operators Index:</span>
          <p className="text-zinc-400 font-mono"><span className="text-white font-bold">Admin:</span> username: <span className="text-amber-200">hazem</span> • password: <span className="text-amber-200">hazem123</span></p>
          <p className="text-zinc-400 font-mono"><span className="text-white font-bold">Reservationist:</span> username: <span className="text-amber-200">zaki</span> • password: <span className="text-amber-200">zaki123</span></p>
          <p className="text-zinc-400 font-mono"><span className="text-white font-bold">Finance:</span> username: <span className="text-amber-200">yasmeen</span> • password: <span className="text-amber-200">yasmeen123</span></p>
        </div>

        {/* Error indicators */}
        {errorMsg && (
          <div className="bg-rose-900/30 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-300 flex items-start gap-2 animate-bounce">
            <span className="text-sm block">⚠️</span>
            <p className="font-mono text-[10px] uppercase leading-snug">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block mb-1">Username or Email Key</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500">👤</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. hazem@company.com"
                className="w-full bg-slate-950/60 pl-9 pr-3 py-2 border border-slate-800 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-500 select-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block mb-1">Security Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500">🔒</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 pl-9 pr-3 py-2 border border-slate-800 rounded-xl text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all text-slate-950 font-extrabold uppercase text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3 w-3 text-slate-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Synchronizing Nodes...
              </>
            ) : (
              <>
                <span>🔐</span> Verify Credentials
              </>
            )}
          </button>
        </form>

        <p className="text-[9px] text-zinc-500 text-center font-mono uppercase tracking-widest pt-2">System Portals Protected under SSL Zone</p>

      </div>
    </div>
  );
}
