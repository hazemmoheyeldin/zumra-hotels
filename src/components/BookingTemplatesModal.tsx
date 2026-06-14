/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookingTemplate, Agent, Hotel } from '../types';

interface BookingTemplatesModalProps {
  templates: BookingTemplate[];
  hotels: Hotel[];
  agents: Agent[];
  onSave: (name: string) => void;
  onLoad: (template: BookingTemplate) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function BookingTemplatesModal({
  templates,
  hotels,
  agents,
  onSave,
  onLoad,
  onDelete,
  onClose,
}: BookingTemplatesModalProps) {
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName('');
    setShowSaveForm(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">📋 Booking Templates</h2>
            <p className="text-xs text-indigo-200 mt-0.5">Save and reuse common booking configurations</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl transition">✕</button>
        </div>

        {/* Save Current Form */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          {showSaveForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Template name (e.g., 'Standard Sharm Double')"
                className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                Save
              </button>
              <button
                onClick={() => { setShowSaveForm(false); setSaveName(''); }}
                className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveForm(true)}
              className="w-full py-2.5 border-2 border-dashed border-indigo-300 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition flex items-center justify-center gap-2"
            >
              ➕ Save Current Form as Template
            </button>
          )}
        </div>

        {/* Templates List */}
        <div className="px-6 py-4">
          {templates.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-5xl mb-3">📋</div>
              <p className="font-bold text-sm">No templates saved yet</p>
              <p className="text-xs mt-1">Fill in the booking form and save it as a template for quick reuse</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(tmpl => {
                const hotel = hotels.find(h => h.id === tmpl.hotelId);
                const client = agents.find(a => a.id === tmpl.clientId);
                const supplier = agents.find(a => a.id === tmpl.supplierId);
                const roomSummary = (tmpl.rooms || []).map(r => `${r.qty}x ${r.roomType}`).join(', ');

                return (
                  <div
                    key={tmpl.id}
                    className="border border-slate-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-sm text-slate-900">{tmpl.name}</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 font-bold uppercase">Hotel: </span>
                            <span className="text-slate-700 font-semibold">{hotel?.name || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold uppercase">Client: </span>
                            <span className="text-slate-700 font-semibold">{client?.name || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold uppercase">Supplier: </span>
                            <span className="text-slate-700 font-semibold">{supplier?.name || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold uppercase">Rooms: </span>
                            <span className="text-slate-700 font-semibold">{roomSummary || 'None'}</span>
                          </div>
                          {tmpl.tags && tmpl.tags.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-slate-400 font-bold uppercase">Tags: </span>
                              {tmpl.tags.map(tag => (
                                <span key={tag} className="inline-block bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded mr-1">{tag}</span>
                              ))}
                            </div>
                          )}
                          {tmpl.bookingSource && (
                            <div>
                              <span className="text-slate-400 font-bold uppercase">Source: </span>
                              <span className="text-slate-700 font-semibold">{tmpl.bookingSource}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2">Created: {tmpl.createdAt}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => { onLoad(tmpl); onClose(); }}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition whitespace-nowrap"
                        >
                          📥 Load
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete template "${tmpl.name}"?`)) onDelete(tmpl.id);
                          }}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition whitespace-nowrap border border-rose-200"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
