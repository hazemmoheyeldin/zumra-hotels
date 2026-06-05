/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { useLang } from '../lib/LanguageContext';

interface UserManagementPageProps {
  users: User[];
  currentUser: User;
  onSetCurrentUser: (user: User) => void;
  onAddUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

export default function UserManagementPage({ users, currentUser, onSetCurrentUser, onAddUser, onDeleteUser }: UserManagementPageProps) {
  const { t, lang } = useLang();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<'Admin' | 'Sales' | 'Finance' | 'Reservationist'>('Sales');
  
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !name || !email || !password) {
      alert('Please fill out all fields including password.');
      return;
    }

    const updatedUser: User = {
      id: editingUserId || `u_${Date.now()}`,
      username: username.toLowerCase().replace(/\s+/g, ''),
      name,
      email,
      password,
      jobTitle,
      role
    };

    onAddUser(updatedUser); // In App.tsx we need to ensure this functions as upsert
    resetForm();
  };

  const resetForm = () => {
    setUsername('');
    setName('');
    setEmail('');
    setPassword('');
    setJobTitle('');
    setRole('Sales');
    setEditingUserId(null);
    setShowAddForm(false);
  };

  const initiateEdit = (user: User) => {
    setUsername(user.username);
    setName(user.name);
    setEmail(user.email || '');
    setPassword(user.password || '');
    setJobTitle(user.jobTitle || '');
    setRole(user.role);
    setEditingUserId(user.id);
    setShowAddForm(true);
  };

  // KPI counts
  const adminCount = users.filter(u => u.role === 'Admin').length;
  const salesCount = users.filter(u => u.role === 'Sales').length;
  const financeCount = users.filter(u => u.role === 'Finance').length;
  const resCount = users.filter(u => u.role === 'Reservationist').length;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Sales': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Finance': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Reservationist': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('users.totalUsers')}</div>
          <div className="text-2xl font-black text-slate-900">{users.length}</div>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-rose-600 mb-1">{t('users.admins')}</div>
          <div className="text-2xl font-black text-rose-800">{adminCount}</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1">{t('users.sales')}</div>
          <div className="text-2xl font-black text-indigo-800">{salesCount}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">{t('users.finance')}</div>
          <div className="text-2xl font-black text-emerald-800">{financeCount}</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">{t('users.reservationists')}</div>
          <div className="text-2xl font-black text-amber-800">{resCount}</div>
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
        <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">{t('users.permissionMatrix')}</h3>
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-2 py-2 text-left font-bold text-slate-600 border border-slate-200">Module</th>
              <th className="px-2 py-2 text-center font-bold text-rose-600 border border-slate-200">Admin</th>
              <th className="px-2 py-2 text-center font-bold text-indigo-600 border border-slate-200">Sales</th>
              <th className="px-2 py-2 text-center font-bold text-emerald-600 border border-slate-200">Finance</th>
              <th className="px-2 py-2 text-center font-bold text-amber-600 border border-slate-200">Reservationist</th>
            </tr>
          </thead>
          <tbody>
            {[
              { mod: 'Dashboard & Calendar', admin: true, sales: true, finance: true, res: true },
              { mod: 'Analytics', admin: true, sales: false, finance: true, res: false },
              { mod: 'Reservations', admin: true, sales: true, finance: true, res: true },
              { mod: 'Sales & Follow-ups', admin: true, sales: true, finance: false, res: false },
              { mod: 'Hotels & Agents', admin: true, sales: true, finance: true, res: true },
              { mod: 'Allotments', admin: true, sales: true, finance: false, res: true },
              { mod: 'Transactions', admin: true, sales: false, finance: true, res: false },
              { mod: 'External Transfers', admin: true, sales: false, finance: true, res: false },
              { mod: 'Banks & Safes', admin: true, sales: false, finance: true, res: false },
              { mod: 'Reports', admin: true, sales: false, finance: true, res: false },
              { mod: 'User Management', admin: true, sales: false, finance: false, res: false },
              { mod: 'Buy Rates / Margins', admin: true, sales: false, finance: true, res: false },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-2 py-1.5 font-medium text-slate-700 border border-slate-200">{row.mod}</td>
                <td className="px-2 py-1.5 text-center border border-slate-200">{row.admin ? '✅' : '❌'}</td>
                <td className="px-2 py-1.5 text-center border border-slate-200">{row.sales ? '✅' : '❌'}</td>
                <td className="px-2 py-1.5 text-center border border-slate-200">{row.finance ? '✅' : '❌'}</td>
                <td className="px-2 py-1.5 text-center border border-slate-200">{row.res ? '✅' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t('users.subtitle')}</h2>
          <p className="text-xs text-slate-500">{t('users.subtitleDesc')}</p>
        </div>
        <button
          onClick={() => {
            if (showAddForm) resetForm();
            else setShowAddForm(true);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1"
        >
          {showAddForm ? t('users.viewList') : t('users.addNew')}
        </button>
      </div>

      {showAddForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md bg-slate-50 border border-slate-200/60 p-5 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{editingUserId ? t('users.editUser') : t('users.newUser')}</h3>
          
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Worker Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. zaki"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zaki Makkawi"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Reservations Specialist"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. zaki@zumrahotels.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. zaki123"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Auth Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
            >
              <option value="Admin">Admin</option>
              <option value="Sales">Sales Operator</option>
              <option value="Finance">Finance Controller</option>
              <option value="Reservationist">Reservationist</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
            >
              {editingUserId ? t('users.updateAccount') : t('users.createAccount')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-4 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50/40 p-4 border border-amber-200/65 rounded-2xl flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">{t('users.currentSession')}:</p>
              <p className="text-sm font-bold text-slate-800 uppercase mt-1">{currentUser.name}</p>
              <p className="text-[10px] text-slate-600 font-mono mt-0.5">Role: {currentUser.role} | Email: {currentUser.email}</p>
            </div>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => {
                  const newPassword = prompt('Enter new password for your account (min 6 chars):');
                  if (newPassword && newPassword.length >= 6) {
                    onAddUser({ ...currentUser, password: newPassword });
                    alert('Password successfully updated. Save this securely.');
                  } else if (newPassword) {
                    alert('Password too short. Must be at least 6 characters.');
                  }
                }}
                className="bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase shadow-sm cursor-pointer transition"
              >
                Change Password 🔑
              </button>
              <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase shadow-sm">
                System Active Identity
              </div>
            </div>
          </div>

          <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">{t('users.allUsers')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((u) => {
              const isActive = u.id === currentUser.id;
              const isAdmin = currentUser.role === 'Admin';
              return (
                <div 
                  key={u.id} 
                  className={`border rounded-2xl p-4 flex justify-between items-center transition flex-wrap gap-2 ${
                    isActive ? 'border-amber-500 bg-amber-50/10 shadow-sm' : 'border-slate-100 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="w-full xl:w-auto">
                    <span className={`text-[10px] uppercase tracking-wide font-mono px-2 py-0.5 rounded font-bold border ${getRoleColor(u.role)}`}>
                      {u.role}
                    </span>
                    <h4 className="font-bold text-slate-800 uppercase mt-1.5">{u.name}</h4>
                    <p className="text-[10px] text-slate-450 mt-0.5">@{u.username} • {u.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 xl:mt-0 items-center justify-end w-full xl:w-auto">
                    {isAdmin && !isActive && (
                      <button
                        onClick={() => alert(`Secure platform Invitation email sent to ${u.email} to join Zumra Hotels PMS!`)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs px-3 py-1.5 rounded-xl transition border border-indigo-200"
                      >
                        Invite
                      </button>
                    )}
                    {isActive && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                        Logged In
                      </span>
                    )}
                    <button
                      onClick={() => initiateEdit(u)}
                      className="bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition border border-slate-200"
                    >
                      Edit
                    </button>
                    {!isActive && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete user ${u.name}?`)) onDeleteUser(u.id);
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3 py-1.5 rounded-xl transition border border-rose-200"
                      >
                        Delete
                      </button>
                    )}
                    {!isActive && (
                      <button
                        onClick={() => onSetCurrentUser(u)}
                        className="bg-slate-100 hover:bg-amber-600 hover:text-white text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
