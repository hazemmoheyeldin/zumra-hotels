/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { GlobalAuditEntry, User } from '../types';
import { exportToCSV } from '../lib/storage';

interface AuditLogPageProps {
  auditLog: GlobalAuditEntry[];
  currentUser: User;
}

const PAGE_SIZE = 50;

export default function AuditLogPage({ auditLog, currentUser }: AuditLogPageProps) {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  const entityTypes = useMemo(() => {
    const types = new Set(auditLog.map(e => e.entityType));
    return ['All', ...Array.from(types).sort()];
  }, [auditLog]);

  const actionTypes = useMemo(() => {
    const types = new Set(auditLog.map(e => e.action));
    return ['All', ...Array.from(types).sort()];
  }, [auditLog]);

  const userList = useMemo(() => {
    const users = new Set(auditLog.map(e => e.user));
    return ['All', ...Array.from(users).sort()];
  }, [auditLog]);

  const filtered = useMemo(() => {
    return auditLog.filter(entry => {
      if (entityFilter !== 'All' && entry.entityType !== entityFilter) return false;
      if (actionFilter !== 'All' && entry.action !== actionFilter) return false;
      if (userFilter !== 'All' && entry.user !== userFilter) return false;
      if (entityIdFilter && !entry.entityId.toLowerCase().includes(entityIdFilter.toLowerCase())) return false;
      if (dateFrom && entry.timestamp < dateFrom) return false;
      if (dateTo && entry.timestamp.slice(0, 10) > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          entry.user.toLowerCase().includes(q) ||
          entry.detail.toLowerCase().includes(q) ||
          entry.entityId.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLog, search, entityFilter, actionFilter, userFilter, entityIdFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExport = () => {
    const rows = filtered.map(e => ({
      Timestamp: new Date(e.timestamp).toLocaleString('en-GB'),
      User: e.user,
      Action: e.action,
      Entity: e.entityType,
      'Entity ID': e.entityId,
      Detail: e.detail,
    }));
    exportToCSV(`audit_log_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const getActionColor = (action: string): string => {
    if (action.startsWith('Create') || action === 'Login') return 'bg-green-100 text-green-800';
    if (action.startsWith('Delete')) return 'bg-red-100 text-red-800';
    if (action.startsWith('Update') || action.startsWith('Edit')) return 'bg-blue-100 text-blue-800';
    if (action === 'Cancel') return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getEntityIcon = (type: string): string => {
    switch (type) {
      case 'Reservation': return '📅';
      case 'Transaction': return '💰';
      case 'Agent': return '👥';
      case 'User': return '🔑';
      case 'Hotel': return '🏢';
      case 'Allotment': return '📦';
      case 'Login': return '🔐';
      default: return '📄';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500">{filtered.length.toLocaleString()} entries total</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <select
          value={entityFilter}
          onChange={e => { setEntityFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={userFilter}
          onChange={e => { setUserFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          {userList.map(u => <option key={u} value={u}>{u === 'All' ? 'All Users' : u}</option>)}
        </select>
        <input
          type="text"
          placeholder="Entity ID filter..."
          value={entityIdFilter}
          onChange={e => { setEntityIdFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(0); }}
          className="px-3 py-2 border rounded-lg text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(0); }}
          className="px-3 py-2 border rounded-lg text-sm"
          placeholder="To"
        />
        {(entityFilter !== 'All' || actionFilter !== 'All' || userFilter !== 'All' || entityIdFilter || dateFrom || dateTo || search) && (
          <button onClick={() => { setSearch(''); setEntityFilter('All'); setActionFilter('All'); setUserFilter('All'); setEntityIdFilter(''); setDateFrom(''); setDateTo(''); setPage(0); }} className="px-3 py-2 text-sm text-rose-600 font-medium hover:bg-rose-50 rounded-lg transition">Clear Filters</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Timestamp</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No audit entries found</td></tr>
              ) : (
                paged.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 font-mono text-xs">
                      {new Date(entry.timestamp).toLocaleString('en-GB', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{entry.user}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {getEntityIcon(entry.entityType)}
                        <span className="text-gray-600">{entry.entityType}</span>
                        <span className="text-gray-400 text-xs">#{entry.entityId}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-600" title={entry.detail}>
                      {entry.detail}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-gray-500">
              Page {page + 1} of {totalPages} ({filtered.length} entries)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-white"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
