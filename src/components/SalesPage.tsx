/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Agent, FollowUp, ActivityLogEntry } from '../types';

interface SalesPageProps {
  agents: Agent[];
  followUps: FollowUp[];
  currentUser: string;
  onSaveFollowUp: (fu: FollowUp) => void;
  onDeleteFollowUp: (id: string) => void;
}

type Priority = 'High' | 'Medium' | 'Low';
type ViewMode = 'Upcoming' | 'Completed' | 'All';

export default function SalesPage({ agents, followUps, currentUser, onSaveFollowUp, onDeleteFollowUp }: SalesPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Pending' | 'Completed' | 'Closed'>('Pending');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [newLogEntry, setNewLogEntry] = useState('');
  const [showLogFor, setShowLogFor] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ViewMode>('Upcoming');
  const [searchTerm, setSearchTerm] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // KPI metrics
  const kpis = useMemo(() => {
    const pending = followUps.filter(f => f.status === 'Pending');
    const completed = followUps.filter(f => f.status === 'Completed');
    const overdue = pending.filter(f => f.date < todayStr);
    const dueToday = pending.filter(f => f.date === todayStr);
    return {
      total: followUps.length,
      pending: pending.length,
      completed: completed.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
    };
  }, [followUps, todayStr]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !date || !topic) return;

    const newFu: FollowUp = {
      id: editingId || `fu_${Date.now()}`,
      clientId,
      date,
      topic,
      notes: priority !== 'Medium' ? `[${priority}] ${notes}` : notes,
      status,
      createdBy: editingId ? (followUps.find(f => f.id === editingId)?.createdBy || currentUser) : currentUser,
      activityLog: editingId ? (followUps.find(f => f.id === editingId)?.activityLog || []) : [{
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: currentUser,
        action: 'Created',
        detail: `Activity created with status: ${status}`
      }]
    };
    onSaveFollowUp(newFu);
    resetForm();
  };

  const resetForm = () => {
    setClientId('');
    setDate('');
    setTopic('');
    setNotes('');
    setStatus('Pending');
    setPriority('Medium');
    setEditingId(null);
    setShowForm(false);
  };

  const editFu = (fu: FollowUp) => {
    setEditingId(fu.id);
    setClientId(fu.clientId);
    setDate(fu.date);
    setTopic(fu.topic);
    setNotes(fu.notes);
    setStatus(fu.status);
    setShowForm(true);
  };

  const getAgentName = (id: string) => {
    return agents.find(a => a.id === id)?.companyName || agents.find(a => a.id === id)?.name || id;
  };

  const getAgentType = (id: string) => {
    return agents.find(a => a.id === id)?.type || 'Customer';
  };

  // Determine priority from notes (since FollowUp type doesn't have priority field)
  const getPriority = (fu: FollowUp): Priority => {
    if (fu.notes?.toLowerCase().includes('[high]') || fu.notes?.toLowerCase().includes('urgent')) return 'High';
    if (fu.notes?.toLowerCase().includes('[low]')) return 'Low';
    return 'Medium';
  };

  const filtered = useMemo(() => {
    let list = followUps;
    if (activeTab === 'Upcoming') list = list.filter(f => f.status === 'Pending');
    else if (activeTab === 'Completed') list = list.filter(f => f.status === 'Completed');

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(f =>
        f.topic.toLowerCase().includes(term) ||
        getAgentName(f.clientId).toLowerCase().includes(term) ||
        f.notes?.toLowerCase().includes(term) ||
        f.date.includes(term)
      );
    }

    // Sort: overdue first, then by date
    return list.sort((a, b) => {
      if (a.status === 'Pending' && b.status === 'Pending') {
        return a.date.localeCompare(b.date);
      }
      return b.date.localeCompare(a.date);
    });
  }, [followUps, activeTab, searchTerm]);

  const isOverdue = (fu: FollowUp) => fu.status === 'Pending' && fu.date < todayStr;
  const isDueToday = (fu: FollowUp) => fu.status === 'Pending' && fu.date === todayStr;

  const getDaysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff} days`;
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Activities</div>
          <div className="text-2xl font-black text-slate-900">{kpis.total}</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">Pending</div>
          <div className="text-2xl font-black text-amber-800">{kpis.pending}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Completed</div>
          <div className="text-2xl font-black text-emerald-800">{kpis.completed}</div>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-rose-600 mb-1">Overdue</div>
          <div className="text-2xl font-black text-rose-700">{kpis.overdue}</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1">Due Today</div>
          <div className="text-2xl font-black text-indigo-800">{kpis.dueToday}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">Sales & CRM Engine</h2>
            <p className="text-xs text-slate-500">Track meetings, follow-ups, and client interactions</p>
          </div>
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl transition shadow text-xs"
          >
            {showForm ? '← Back to List' : '+ New Activity'}
          </button>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6 rounded-2xl border border-slate-200 max-w-2xl">
            <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              {editingId ? 'Edit Activity' : 'New Follow-Up Activity'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client / Agent</label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-indigo-400 focus:outline-none"
                  required
                >
                  <option value="">-- Select Client --</option>
                  {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => (
                    <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Follow-Up Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-indigo-400 focus:outline-none"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subject / Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Discuss Ramadan Allotments"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-indigo-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Priority Level</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-indigo-400 focus:outline-none"
                >
                  <option value="High">🔴 High Priority</option>
                  <option value="Medium">🟡 Medium Priority</option>
                  <option value="Low">🟢 Low Priority</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-indigo-400 focus:outline-none"
                >
                  <option value="Pending">Pending / Upcoming</option>
                  <option value="Completed">Completed / Done</option>
                  <option value="Closed">Closed / Resolved</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Meeting Notes / Details</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add meeting notes, call outcomes, or action items..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white min-h-[100px] text-xs focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 font-bold text-white px-6 py-2.5 rounded-xl text-xs transition shadow">
                {editingId ? 'Update Activity' : 'Save Activity'}
              </button>
              <button type="button" onClick={resetForm} className="bg-white border border-slate-200 text-slate-600 font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-slate-50">Cancel</button>
            </div>
          </form>
        ) : (
          <div>
            {/* Tabs + Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {(['Upcoming', 'Completed', 'All'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-1.5 px-4 rounded-lg text-[10px] font-bold uppercase transition ${
                      activeTab === tab
                        ? tab === 'Completed' ? 'bg-emerald-600 text-white shadow' : tab === 'Upcoming' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-700 text-white shadow'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab} {tab === 'Upcoming' ? `(${kpis.pending})` : tab === 'Completed' ? `(${kpis.completed})` : `(${kpis.total})`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs w-56 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Activity List */}
            <div className="space-y-2.5">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-sm font-semibold">No {activeTab.toLowerCase()} activities found</p>
                  <p className="text-xs mt-1">Click "+ New Activity" to create one</p>
                </div>
              ) : (
                filtered.map(fu => {
                  const p = getPriority(fu);
                  const overdue = isOverdue(fu);
                  const dueToday = isDueToday(fu);
                  const agentType = getAgentType(fu.clientId);

                  return (
                    <div
                      key={fu.id}
                      className={`group border rounded-xl p-4 transition hover:shadow-md ${
                        overdue ? 'border-rose-300 bg-rose-50/30 hover:bg-rose-50/60' :
                        dueToday ? 'border-amber-300 bg-amber-50/20 hover:bg-amber-50/40' :
                        fu.status === 'Completed' ? 'border-emerald-200 bg-emerald-50/20' :
                        'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="text-sm font-extrabold text-slate-900 truncate">{fu.topic}</h4>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                              overdue ? 'bg-rose-100 text-rose-700 border-rose-200' :
                              dueToday ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              fu.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {overdue ? '⚠️ Overdue' : dueToday ? '📌 Due Today' : fu.status}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              p === 'High' ? 'bg-rose-50 text-rose-600' :
                              p === 'Low' ? 'bg-green-50 text-green-600' :
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {p === 'High' ? '🔴' : p === 'Low' ? '🟢' : '🟡'} {p}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="font-bold text-indigo-600 uppercase tracking-wide flex items-center gap-1">
                              👤 {getAgentName(fu.clientId)}
                              <span className="text-slate-400 font-normal">({agentType})</span>
                            </span>
                            <span className="font-mono text-slate-500">
                              📅 {fu.date}
                              {fu.status === 'Pending' && (
                                <span className={`ml-1 font-bold ${overdue ? 'text-rose-600' : dueToday ? 'text-amber-600' : 'text-slate-400'}`}>
                                  ({getDaysUntil(fu.date)})
                                </span>
                              )}
                            </span>
                            <span className="text-slate-400">by {fu.createdBy}</span>
                          </div>
                          {fu.notes && (
                            <p className="text-[11px] mt-2 text-slate-600 leading-relaxed line-clamp-2">{fu.notes}</p>
                          )}
                          {/* Activity Log Timeline */}
                          {fu.activityLog && fu.activityLog.length > 0 && showLogFor === fu.id && (
                            <div className="mt-3 border-t border-slate-200 pt-3">
                              <h5 className="text-[9px] uppercase font-bold text-slate-500 mb-2">Activity Timeline ({fu.activityLog.length} entries)</h5>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {fu.activityLog.slice().reverse().map((log) => (
                                  <div key={log.id} className="flex items-start gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="text-slate-400 font-mono shrink-0">{new Date(log.timestamp).toLocaleDateString('en-GB')} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="text-indigo-600 font-bold shrink-0">{log.action}:</span>
                                    <span className="text-slate-600 flex-1">{log.detail}</span>
                                    <span className="text-slate-400 shrink-0">by {log.user}</span>
                                  </div>
                                ))}
                              </div>
                              {/* Add new log entry */}
                              {fu.status !== 'Closed' && (
                                <div className="flex gap-2 mt-2">
                                  <input
                                    type="text"
                                    value={showLogFor === fu.id ? newLogEntry : ''}
                                    onChange={(e) => setNewLogEntry(e.target.value)}
                                    placeholder="Add update note..."
                                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] focus:border-indigo-400 focus:outline-none"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && newLogEntry.trim()) {
                                        const updated = { ...fu, activityLog: [...(fu.activityLog || []), { id: `log_${Date.now()}`, timestamp: new Date().toISOString(), user: currentUser, action: 'Update', detail: newLogEntry.trim() }] };
                                        onSaveFollowUp(updated);
                                        setNewLogEntry('');
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      if (newLogEntry.trim()) {
                                        const updated = { ...fu, activityLog: [...(fu.activityLog || []), { id: `log_${Date.now()}`, timestamp: new Date().toISOString(), user: currentUser, action: 'Update', detail: newLogEntry.trim() }] };
                                        onSaveFollowUp(updated);
                                        setNewLogEntry('');
                                      }
                                    }}
                                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[9px] font-bold px-2.5 py-1 rounded-lg border border-indigo-200"
                                  >
                                    + Log
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updated = { ...fu, status: 'Closed' as const, activityLog: [...(fu.activityLog || []), { id: `log_${Date.now()}`, timestamp: new Date().toISOString(), user: currentUser, action: 'Closed', detail: 'Case closed and resolved' }] };
                                      onSaveFollowUp(updated);
                                    }}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-bold px-2.5 py-1 rounded-lg border border-rose-200"
                                  >
                                    Close Case
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => setShowLogFor(showLogFor === fu.id ? null : fu.id)}
                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition ${showLogFor === fu.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 text-slate-500'}`}
                            title="View activity log"
                          >
                            📝 {fu.activityLog?.length || 0}
                          </button>
                          {fu.status === 'Pending' && (
                            <button
                              onClick={() => onSaveFollowUp({...fu, status: 'Completed', activityLog: [...(fu.activityLog || []), { id: `log_${Date.now()}`, timestamp: new Date().toISOString(), user: currentUser, action: 'Completed', detail: 'Marked as done' }]})}
                              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition border border-emerald-200"
                            >
                              ✓ Done
                            </button>
                          )}
                          <button
                            onClick={() => editFu(fu)}
                            className="bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 text-slate-500 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => onDeleteFollowUp(fu.id)}
                            className="bg-slate-100 hover:bg-rose-100 text-rose-500 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
