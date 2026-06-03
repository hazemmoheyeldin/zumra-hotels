/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent, FollowUp } from '../types';

interface SalesPageProps {
  agents: Agent[];
  followUps: FollowUp[];
  currentUser: string;
  onSaveFollowUp: (fu: FollowUp) => void;
  onDeleteFollowUp: (id: string) => void;
}

export default function SalesPage({ agents, followUps, currentUser, onSaveFollowUp, onDeleteFollowUp }: SalesPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Pending' | 'Completed'>('Pending');

  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Completed'>('Upcoming');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !date || !topic) return;

    const newFu: FollowUp = {
      id: editingId || `fu_${Date.now()}`,
      clientId,
      date,
      topic,
      notes,
      status,
      createdBy: editingId ? (followUps.find(f => f.id === editingId)?.createdBy || currentUser) : currentUser
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
    return agents.find(a => a.id === id)?.name || id;
  };

  const filtered = followUps.filter(f => f.status === (activeTab === 'Upcoming' ? 'Pending' : 'Completed'));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Sales & CRM Engine</h2>
            <p className="text-sm text-slate-500">Track meetings, follow-ups, and sales progress.</p>
          </div>
          <button
            onClick={() => { if(showForm) resetForm(); else setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition shadow"
          >
            {showForm ? 'View List' : 'Add New Activity'}
          </button>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client / Agent</label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  required
                >
                  <option value="">-- Select Client --</option>
                  {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => (
                    <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Follow-Up Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Subject / Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Discuss Ramadan Allotments"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Meeting Notes / Details</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white min-h-[100px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="Pending">Pending / Upcoming</option>
                  <option value="Completed">Completed / Done</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="bg-indigo-600 font-bold text-white px-5 py-2 rounded-xl">Save Activity</button>
              <button type="button" onClick={resetForm} className="bg-slate-200 text-slate-700 font-bold px-5 py-2 rounded-xl">Cancel</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex gap-2 mb-4 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveTab('Upcoming')}
                className={`py-1.5 px-4 rounded-full text-xs font-bold ${activeTab === 'Upcoming' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Upcoming / Pending
              </button>
              <button
                onClick={() => setActiveTab('Completed')}
                className={`py-1.5 px-4 rounded-full text-xs font-bold ${activeTab === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Completed Notes
              </button>
            </div>

            <div className="space-y-4">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic">No {activeTab.toLowerCase()} activities found.</div>
              ) : (
                filtered.map(fu => (
                  <div key={fu.id} className="bg-white border text-left border-slate-200 rounded-xl p-4 flex justify-between items-center hover:border-indigo-300 transition shadow-sm">
                    <div>
                      <div className="flex gap-2 items-center">
                        <h4 className="text-sm font-extrabold text-slate-900">{fu.topic}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${fu.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {fu.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-indigo-600 mt-1 uppercase tracking-wide">
                        👤 {getAgentName(fu.clientId)}
                      </p>
                      <p className="text-xs mt-1 text-slate-600">{fu.notes}</p>
                      <p className="text-[10px] uppercase font-mono mt-2 text-slate-400">Date: <span className="font-bold">{fu.date}</span> | Rep: {fu.createdBy}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {fu.status === 'Pending' && (
                        <button
                          onClick={() => {
                            onSaveFollowUp({...fu, status: 'Completed'});
                          }}
                          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                        >
                          Mark Done
                        </button>
                      )}
                      <button
                        onClick={() => editFu(fu)}
                        className="bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteFollowUp(fu.id)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
