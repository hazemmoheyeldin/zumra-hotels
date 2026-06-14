/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { showToast } from './Toast';

interface PermissionsPageProps {
  currentUser: User;
}

const ROLES = ['Admin', 'ReservationsManager', 'Sales', 'Finance', 'Reservationist'] as const;
type Role = typeof ROLES[number];

const PAGES = [
  'Dashboard', 'Analytics', 'Graphs',
  'Reservations', 'Calendar', 'Allotments', 'Other Services',
  'Sales', 'Production', 'Guests',
  'Hotels', 'Agents',
  'Transactions', 'External Transfers', 'Banks & Safes', 'Reports', 'Ledger', 'Expenses', 'Payment Gateways',
  'Audit Log', 'Users', 'General Data', 'Client Portal', 'Permissions',
];

// Default (hardcoded) permissions matching App.tsx permittedNavItems
const DEFAULT_PERMISSIONS: Record<Role, string[]> = {
  Admin: PAGES, // Admin gets everything
  ReservationsManager: ['Dashboard', 'Calendar', 'Graphs', 'Reservations', 'Hotels', 'Agents', 'Allotments', 'Other Services', 'Reports', 'General Data', 'Expenses'],
  Sales: ['Dashboard', 'Calendar', 'Reservations', 'Sales', 'Production', 'Hotels', 'Agents', 'Guests', 'Allotments', 'Other Services'],
  Finance: ['Dashboard', 'Calendar', 'Analytics', 'Graphs', 'Reservations', 'Hotels', 'Agents', 'Transactions', 'External Transfers', 'Banks & Safes', 'Reports', 'Payment Gateways', 'Other Services', 'Expenses'],
  Reservationist: ['Dashboard', 'Calendar', 'Reservations', 'Hotels', 'Agents', 'Guests', 'Allotments', 'Other Services', 'General Data', 'Expenses'],
};

const STORAGE_KEY = 'zumra_custom_permissions';

function loadCustomPermissions(): Record<Role, string[]> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCustomPermissions(perms: Record<Role, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
}

export default function PermissionsPage({ currentUser }: PermissionsPageProps) {
  const isAdmin = currentUser.role === 'Admin';
  const [customize, setCustomize] = useState(false);
  const [customPerms, setCustomPerms] = useState<Record<Role, string[]>>(() => {
    return loadCustomPermissions() || { ...DEFAULT_PERMISSIONS };
  });

  const activePerms = customize ? customPerms : DEFAULT_PERMISSIONS;

  const hasCustom = useMemo(() => {
    const stored = loadCustomPermissions();
    return stored !== null;
  }, []);

  const togglePage = (role: Role, page: string) => {
    if (!customize) return;
    setCustomPerms(prev => {
      const current = prev[role] || [];
      const updated = current.includes(page)
        ? current.filter(p => p !== page)
        : [...current, page];
      return { ...prev, [role]: updated };
    });
  };

  const handleSave = () => {
    saveCustomPermissions(customPerms);
    showToast('Permissions saved. Changes take effect on next login.', 'success');
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCustomPerms({ ...DEFAULT_PERMISSIONS });
    setCustomize(false);
    showToast('Permissions reset to defaults', 'warning');
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">🔐 Page Permissions</h2>
            <p className="text-xs text-slate-500">Control which pages each role can access</p>
          </div>
          <div className="flex items-center gap-2">
            {hasCustom && (
              <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Custom Active</span>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => setCustomize(!customize)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                    customize ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {customize ? '✓ Editing' : 'Customize'}
                </button>
                {customize && (
                  <>
                    <button onClick={handleSave} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition">Save</button>
                    <button onClick={handleReset} className="text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg transition">Reset</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400 inline-block"></span> Granted</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block"></span> Denied</span>
          {!isAdmin && <span className="text-slate-400 italic">View only — ask Admin to customize</span>}
        </div>

        {/* Permissions Matrix */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-50 sticky top-0">
                <th className="py-2 px-3 border-r border-b border-slate-200 font-bold text-slate-600 min-w-[160px]">Page</th>
                {ROLES.map(role => (
                  <th key={role} className="py-2 px-2 border-r border-b border-slate-200 font-bold text-slate-600 text-center min-w-[90px]">
                    {role === 'ReservationsManager' ? 'Res. Manager' : role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PAGES.map(page => (
                <tr key={page} className="hover:bg-slate-50/50">
                  <td className="py-1.5 px-3 border-r border-slate-200 font-medium text-slate-700 whitespace-nowrap">{page}</td>
                  {ROLES.map(role => {
                    const has = (activePerms[role] || []).includes(page);
                    return (
                      <td key={role} className="py-1.5 px-2 border-r border-slate-100 text-center">
                        {customize ? (
                          <button
                            onClick={() => togglePage(role, page)}
                            className={`w-5 h-5 rounded border-2 transition inline-flex items-center justify-center ${
                              has ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                            }`}
                          >
                            {has && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </button>
                        ) : (
                          <span className={`inline-block w-5 h-5 rounded border-2 ${
                            has ? 'bg-emerald-200 border-emerald-400' : 'bg-slate-100 border-slate-300'
                          }`} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary per role */}
        <div className="mt-4 flex flex-wrap gap-3">
          {ROLES.map(role => {
            const count = (activePerms[role] || []).length;
            return (
              <div key={role} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-center">
                <div className="text-[9px] uppercase font-bold text-slate-400">{role === 'ReservationsManager' ? 'Res. Manager' : role}</div>
                <div className="text-lg font-black text-slate-800">{count}</div>
                <div className="text-[8px] text-slate-400">/ {PAGES.length} pages</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
