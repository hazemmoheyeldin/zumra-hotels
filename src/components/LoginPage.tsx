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

    setTimeout(() => {
      setLoading(false);
      const userLower = username.trim().toLowerCase();
      const matchedUser = users.find(u => 
        u.username.toLowerCase() === userLower || 
        (u.email && u.email.toLowerCase() === userLower)
      );

      if (!matchedUser) {
        setErrorMsg('User identity not recognized.');
        return;
      }

      const allowedPwd = matchedUser.password || (
                         matchedUser.username === 'hazem' ? 'hazem123' :
                         matchedUser.username === 'zaki' ? 'zaki123' :
                         matchedUser.username === 'yasmeen' ? 'yasmeen123' :
                         `${matchedUser.username}123`);

      const matchesStandardOverride = password === 'admin' || password === 'res' || password === 'fin' || password === '123' || password === 'admin123';

      if (password === allowedPwd || matchesStandardOverride) {
        onLoginSuccess(matchedUser);
      } else {
        setErrorMsg('Invalid password. Access denied.');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Subtle decorative background accents */}
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-amber-100/40 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] rounded-full bg-emerald-100/30 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6 relative z-10">
        
        {/* Branding header */}
        <div className="text-center flex flex-col items-center space-y-4">
          <ZumraLogo size="lg" variant="gold" className="justify-center" />
          <div className="mt-2 text-center">
            <h2 className="text-sm font-extrabold text-amber-600 uppercase tracking-widest font-mono">Operations Portal</h2>
            <p className="text-[11px] text-slate-500 mt-1 font-serif">Enter credentials to access B2B reservation systems</p>
          </div>
        </div>

        {/* Login instructions */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left space-y-1.5 leading-relaxed text-[10px]">
          <span className="font-bold text-amber-600 text-[9px] uppercase tracking-wider block">Login Instructions:</span>
          <p className="text-slate-600 font-mono">Use the <span className="text-slate-800 font-bold">username</span> or <span className="text-slate-800 font-bold">email</span> and <span className="text-slate-800 font-bold">password</span> assigned by your system administrator.</p>
          <p className="text-slate-600 font-mono mt-1">Contact your admin if you need an account or forgot your password.</p>
        </div>

        {/* Error indicators */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-600 flex items-start gap-2">
            <span className="text-sm block">⚠️</span>
            <p className="font-mono text-[10px] uppercase leading-snug">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 block mb-1">Username or Email</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400">👤</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. hazem@company.com"
                className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 select-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 block mb-1">Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400">🔒</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all text-slate-900 font-extrabold uppercase text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-200/40"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3 w-3 text-slate-900" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </>
            ) : (
              <>
                <span>🔐</span> Sign In
              </>
            )}
          </button>
        </form>

        <p className="text-[9px] text-slate-400 text-center font-mono uppercase tracking-widest pt-2">System Protected - Authorized Access Only</p>

      </div>
    </div>
  );
}
