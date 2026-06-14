/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { useLang } from '../lib/LanguageContext';
import { sendInvitationEmail, isEmailConfigured } from '../lib/email';

interface UserManagementPageProps {
  users: User[];
  currentUser: User;
  onSetCurrentUser: (user: User) => void;
  onAddUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onReactivateUser?: (userId: string) => void;
  onToast?: (type: 'success' | 'error' | 'warning', msg: string) => void;
}

type FormErrors = { [key: string]: string };

// FormField must be OUTSIDE the component to prevent re-creation on every render
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{label}</label>
      {children}
      {error && <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1"><span>⚠</span>{error}</p>}
    </div>
  );
}

export default function UserManagementPage({ users, currentUser, onSetCurrentUser, onAddUser, onDeleteUser, onReactivateUser, onToast }: UserManagementPageProps) {
  const { t, lang } = useLang();
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<'Admin' | 'Sales' | 'Finance' | 'Reservationist' | 'ReservationsManager'>('Sales');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [showAddForm, setShowAddForm] = useState(false);

  // Password change modal state
  const [pwdModalUserId, setPwdModalUserId] = useState<string | null>(null);
  const [pwdModalIsSelf, setPwdModalIsSelf] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdErrors, setPwdErrors] = useState<FormErrors>({});

  // Invite loading state
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!username.trim()) errors.username = 'Username is required';
    if (!name.trim()) errors.name = 'Full name is required';
    if (!email.trim()) errors.email = 'Email is required';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email format';
    if (!editingUserId && !password) errors.password = 'Password is required for new users';
    if (password && password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (!editingUserId) {
      const usernameNorm = username.toLowerCase().replace(/\s+/g, '');
      if (users.some(u => u.username.toLowerCase() === usernameNorm && u.id !== editingUserId)) {
        errors.username = 'This username is already taken';
      }
      if (users.some(u => u.email?.toLowerCase() === email.toLowerCase().trim() && u.id !== editingUserId)) {
        errors.email = 'This email is already in use';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // New users created by admin must change password on first login
    const isNewUser = !editingUserId;
    const isEditingSelf = editingUserId === currentUser.id;
    const updatedUser: User = {
      id: editingUserId || `u_${Date.now()}`,
      username: username.toLowerCase().replace(/\s+/g, ''),
      name,
      email,
      password: password || (editingUserId ? users.find(u => u.id === editingUserId)?.password : '') || '',
      jobTitle,
      role,
      mustChangePassword: isNewUser && !isEditingSelf ? true : (isEditingSelf ? false : undefined),
      status: editingUserId ? (users.find(u => u.id === editingUserId)?.status || 'Active') : 'Active',
      isActive: editingUserId ? (users.find(u => u.id === editingUserId)?.isActive ?? true) : true,
    };

    onAddUser(updatedUser);
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
    setFormErrors({});
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
    setFormErrors({});
  };

  const openPasswordModal = (userId: string, isSelf: boolean) => {
    setPwdModalUserId(userId);
    setPwdModalIsSelf(isSelf);
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
    setPwdErrors({});
  };

  const handlePasswordChange = () => {
    const errors: FormErrors = {};
    const targetUser = users.find(u => u.id === pwdModalUserId);
    if (!targetUser) return;

    if (pwdModalIsSelf) {
      const currentPwd = targetUser.password || (
        targetUser.username === 'hazem' ? 'hazem123' :
        targetUser.username === 'zaki' ? 'zaki123' :
        targetUser.username === 'yasmeen' ? 'yasmeen123' :
        `${targetUser.username}123`
      );
      if (!pwdCurrent) errors.current = 'Current password is required';
      else if (pwdCurrent !== currentPwd) errors.current = 'Current password is incorrect';
    }
    if (!pwdNew) errors.new = 'New password is required';
    else if (pwdNew.length < 6) errors.new = 'Minimum 6 characters';
    if (pwdNew !== pwdConfirm) errors.confirm = 'Passwords do not match';

    setPwdErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Self-change: no forced change. Admin reset: force change on next login.
    const updatedUser = { ...targetUser, password: pwdNew, mustChangePassword: !pwdModalIsSelf };
    onAddUser(updatedUser);
    onToast?.('success', pwdModalIsSelf
      ? 'Password updated successfully'
      : `Password reset for ${targetUser.name}. They must change it on next login.`);
    setPwdModalUserId(null);
  };

  const handleInvite = async (user: User) => {
    if (!user.email) {
      onToast?.('error', 'User has no email address');
      return;
    }
    setInvitingUserId(user.id);
    const tempPwd = user.password || `${user.username}123`;
    const result = await sendInvitationEmail(user.email, user.name, user.username, tempPwd);
    setInvitingUserId(null);
    if (result.success) {
      onToast?.('success', `Invitation email sent to ${user.email}`);
    } else {
      onToast?.('error', result.error || 'Failed to send invitation');
    }
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'Pending' ? 'Active' : 'Pending';
    const updatedUser: User = { ...user, status: newStatus };
    onAddUser(updatedUser);
    onToast?.('success', `${user.name} is now ${newStatus}`);
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
            onClick={() => { if (showAddForm) resetForm(); else setShowAddForm(true); }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1"
          >
            {showAddForm ? t('users.viewList') : t('users.addNew')}
          </button>
        </div>

        {showAddForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md bg-slate-50 border border-slate-200/60 p-5 rounded-2xl" noValidate>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {editingUserId ? t('users.editUser') : t('users.newUser')}
            </h3>

            <FormField label="Worker Username" error={formErrors.username}>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFormErrors(prev => ({ ...prev, username: '' })); }}
                placeholder="e.g. zaki"
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:outline-none transition ${formErrors.username ? 'border-rose-400 focus:border-rose-500 bg-rose-50/50' : 'border-slate-200 focus:border-amber-500'}`}
                required
              />
            </FormField>

            <FormField label="Full Name" error={formErrors.name}>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setFormErrors(prev => ({ ...prev, name: '' })); }}
                placeholder="e.g. Zaki Makkawi"
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:outline-none transition ${formErrors.name ? 'border-rose-400 focus:border-rose-500 bg-rose-50/50' : 'border-slate-200 focus:border-amber-500'}`}
                required
              />
            </FormField>

            <FormField label="Job Title">
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Reservations Specialist"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </FormField>

            <FormField label="Email Address" error={formErrors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFormErrors(prev => ({ ...prev, email: '' })); }}
                placeholder="e.g. zaki@zumrahotels.com"
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:outline-none transition ${formErrors.email ? 'border-rose-400 focus:border-rose-500 bg-rose-50/50' : 'border-slate-200 focus:border-amber-500'}`}
                required
              />
            </FormField>

            <FormField label={editingUserId ? 'New Password (leave blank to keep current)' : 'Password'} error={formErrors.password}>
              <input
                type="text"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFormErrors(prev => ({ ...prev, password: '' })); }}
                placeholder="Min. 6 characters"
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:outline-none transition ${formErrors.password ? 'border-rose-400 focus:border-rose-500 bg-rose-50/50' : 'border-slate-200 focus:border-amber-500'}`}
                required={!editingUserId}
              />
              {password && (
                <div className="mt-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getPasswordStrength(password).color}`} style={{ width: `${getPasswordStrength(password).pct}%` }} />
                    </div>
                    <span className={`text-[9px] font-bold ${getPasswordStrength(password).color.replace('bg-', 'text-')}`}>
                      {getPasswordStrength(password).label}
                    </span>
                  </div>
                </div>
              )}
            </FormField>

            <FormField label="Auth Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
              >
                <option value="Admin">Admin</option>
                <option value="Sales">Sales Operator</option>
                <option value="Finance">Finance Controller</option>
                <option value="Reservationist">Reservationist</option>
                                <option value="ReservationsManager">Reservations Manager</option>
              </select>
            </FormField>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition">
                {editingUserId ? t('users.updateAccount') : t('users.createAccount')}
              </button>
              <button type="button" onClick={resetForm} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-4 py-2 rounded-lg transition">
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
                  onClick={() => openPasswordModal(currentUser.id, true)}
                  className="bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase shadow-sm cursor-pointer transition"
                >
                  Change Password 🔑
                </button>
                <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase shadow-sm">
                  System Active Identity
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">{t('users.allUsers')}</h3>
              {users.some(u => u.isActive === false) && (
                <button
                  onClick={() => setShowDeactivated(!showDeactivated)}
                  className={`text-[10px] font-bold px-3 py-1 rounded-lg transition ${showDeactivated ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                >
                  {showDeactivated ? '🚫 Hide Deactivated' : `👻 Show Deactivated (${users.filter(u => u.isActive === false).length})`}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.filter(u => showDeactivated ? true : u.isActive !== false).map((u) => {
                const isCurrentUser = u.id === currentUser.id;
                const isDeactivated = u.isActive === false;
                const isAdmin = currentUser.role === 'Admin';
                const isInviting = invitingUserId === u.id;
                return (
                  <div
                    key={u.id}
                    className={`border rounded-2xl p-4 flex justify-between items-center transition flex-wrap gap-2 ${
                      isDeactivated ? 'border-rose-200 bg-rose-50/30 opacity-70' :
                      isCurrentUser ? 'border-amber-500 bg-amber-50/10 shadow-sm' : 'border-slate-100 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-full xl:w-auto">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wide font-mono px-2 py-0.5 rounded font-bold border ${getRoleColor(u.role)}`}>
                          {u.role}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wide font-mono px-2 py-0.5 rounded font-bold border ${
                          (u.status || 'Active') === 'Active'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-orange-100 text-orange-700 border-orange-200'
                        }`}>
                          {u.status || 'Active'}
                        </span>
                        {u.mustChangePassword && (
                          <span className="text-[9px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                            MUST CHANGE PW
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 uppercase mt-1.5">{u.name}</h4>
                      <p className="text-[10px] text-slate-450 mt-0.5">@{u.username} • {u.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 xl:mt-0 items-center justify-end w-full xl:w-auto">
                      {isAdmin && !isCurrentUser && (
                        <button
                          onClick={() => handleInvite(u)}
                          disabled={isInviting || !isEmailConfigured}
                          title={!isEmailConfigured ? 'EmailJS not configured — set VITE_EMAILJS_* env vars' : ''}
                          className={`font-bold text-xs px-3 py-1.5 rounded-xl transition border flex items-center gap-1 ${
                            !isEmailConfigured
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200'
                          }`}
                        >
                          {isInviting ? (
                            <>
                              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              Sending...
                            </>
                          ) : '✉ Invite'}
                        </button>
                      )}
                      {isAdmin && (u.status || 'Active') === 'Pending' && !isDeactivated && (
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`font-bold text-xs px-3 py-1.5 rounded-xl transition border flex items-center gap-1 ${
                            (u.status || 'Active') === 'Active'
                              ? 'bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                          }`}
                          title={(u.status || 'Active') === 'Active' ? 'Set to Pending (block login)' : 'Approve user (allow login)'}
                        >
                          {(u.status || 'Active') === 'Active' ? '🔒 Set Pending' : '✅ Approve'}
                        </button>
                      )}
                      {isCurrentUser && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          Logged In
                        </span>
                      )}
                      {isDeactivated ? (
                        <>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            🚫 Deactivated
                          </span>
                          {onReactivateUser && (
                            <button
                              onClick={() => { if (confirm(`Reactivate user ${u.name}? They will be able to log in again.`)) onReactivateUser(u.id); }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold text-xs px-3 py-1.5 rounded-xl transition border border-emerald-200"
                            >
                              ✅ Reactivate
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => onDeleteUser(u.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3 py-1.5 rounded-xl transition border border-rose-200"
                          title="Deactivate user (soft delete)"
                        >
                          🚫 Deactivate
                        </button>
                      )}
                      <button onClick={() => initiateEdit(u)} className="bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition border border-slate-200">
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => openPasswordModal(u.id, false)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs px-3 py-1.5 rounded-xl transition border border-amber-200"
                          title="Reset user password"
                        >
                          Reset PW
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

      {/* Password Change Modal */}
      {pwdModalUserId && (() => {
        const targetUser = users.find(u => u.id === pwdModalUserId);
        if (!targetUser) return null;
        const strength = getPasswordStrength(pwdNew);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setPwdModalUserId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90dvh] flex flex-col overflow-hidden p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  {pwdModalIsSelf ? 'Change Your Password' : `Reset Password: ${targetUser.name}`}
                </h3>
                <button onClick={() => setPwdModalUserId(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
              </div>

              {pwdModalIsSelf && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Current Password</label>
                  <input
                    type="password"
                    value={pwdCurrent}
                    onChange={(e) => { setPwdCurrent(e.target.value); setPwdErrors(prev => ({ ...prev, current: '' })); }}
                    placeholder="Enter current password"
                    className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${pwdErrors.current ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-amber-500'}`}
                  />
                  {pwdErrors.current && <p className="text-[10px] text-rose-500 mt-1">{pwdErrors.current}</p>}
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">New Password</label>
                <input
                  type="password"
                  value={pwdNew}
                  onChange={(e) => { setPwdNew(e.target.value); setPwdErrors(prev => ({ ...prev, new: '' })); }}
                  placeholder="Min. 6 characters"
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${pwdErrors.new ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-amber-500'}`}
                />
                {pwdErrors.new && <p className="text-[10px] text-rose-500 mt-1">{pwdErrors.new}</p>}
                {pwdNew && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${strength.pct}%` }} />
                    </div>
                    <span className={`text-[9px] font-bold ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={pwdConfirm}
                  onChange={(e) => { setPwdConfirm(e.target.value); setPwdErrors(prev => ({ ...prev, confirm: '' })); }}
                  placeholder="Re-enter new password"
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none ${pwdErrors.confirm ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-amber-500'}`}
                />
                {pwdErrors.confirm && <p className="text-[10px] text-rose-500 mt-1">{pwdErrors.confirm}</p>}
              </div>

              {!pwdModalIsSelf && (
                <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  User will be required to change this password on their next login.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handlePasswordChange}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded-lg transition"
                >
                  {pwdModalIsSelf ? 'Update Password' : 'Reset & Notify'}
                </button>
                <button
                  onClick={() => setPwdModalUserId(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-4 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
