/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SalesPerson, CancellationReason, TermsAndConditions } from '../types';
import { ZumraDB, ZumraSync } from '../lib/storage';
import { showToast } from './Toast';

interface GeneralDataPageProps {
  salesPersons: SalesPerson[];
  setSalesPersons: (list: SalesPerson[]) => void;
  cancellationReasons: CancellationReason[];
  setCancellationReasons: (list: CancellationReason[]) => void;
  termsAndConditions: TermsAndConditions[];
  setTermsAndConditions: (list: TermsAndConditions[]) => void;
  onLogAudit: (action: string, entityType: any, entityId: string, detail: string) => void;
}

type Tab = 'salesPersons' | 'cancellationReasons' | 'termsConditions';

export default function GeneralDataPage({
  salesPersons, setSalesPersons,
  cancellationReasons, setCancellationReasons,
  termsAndConditions, setTermsAndConditions,
  onLogAudit,
}: GeneralDataPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('salesPersons');
  const [search, setSearch] = useState('');

  // Sales Person form
  const [spForm, setSpForm] = useState<Partial<SalesPerson>>({});
  const [spEditingId, setSpEditingId] = useState<string | null>(null);
  const [spShowForm, setSpShowForm] = useState(false);

  // Cancellation Reason form
  const [crForm, setCrForm] = useState<Partial<CancellationReason>>({});
  const [crEditingId, setCrEditingId] = useState<string | null>(null);
  const [crShowForm, setCrShowForm] = useState(false);

  // Terms & Conditions form
  const [tcForm, setTcForm] = useState<Partial<TermsAndConditions>>({});
  const [tcEditingId, setTcEditingId] = useState<string | null>(null);
  const [tcShowForm, setTcShowForm] = useState(false);

  // View T&C content
  const [viewingTc, setViewingTc] = useState<TermsAndConditions | null>(null);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'salesPersons', label: 'Sales Persons', icon: '👤' },
    { key: 'cancellationReasons', label: 'Cancellation Reasons', icon: '❌' },
    { key: 'termsConditions', label: 'Terms & Conditions', icon: '📜' },
  ];

  // ==================== Sales Persons ====================
  const filteredSP = useMemo(() => {
    if (!search) return salesPersons;
    const q = search.toLowerCase();
    return salesPersons.filter(sp => sp.name.toLowerCase().includes(q) || sp.email.toLowerCase().includes(q) || sp.phone.includes(q));
  }, [salesPersons, search]);

  const handleSaveSP = () => {
    if (!spForm.name?.trim()) { showToast('Name is required', 'error'); return; }
    const id = spEditingId || `sp_${Date.now()}`;
    const entry: SalesPerson = {
      id,
      name: spForm.name?.trim() || '',
      phone: spForm.phone || '',
      email: spForm.email || '',
      commission: spForm.commission || 0,
      active: spForm.active !== false,
    };
    let updated: SalesPerson[];
    if (spEditingId) {
      updated = salesPersons.map(sp => sp.id === spEditingId ? entry : sp);
      onLogAudit('Update', 'GeneralData', id, `Updated sales person: ${entry.name}`);
    } else {
      updated = [...salesPersons, entry];
      onLogAudit('Create', 'GeneralData', id, `Created sales person: ${entry.name}`);
    }
    setSalesPersons(updated);
    ZumraDB.saveSalesPersons(updated);
    ZumraSync.saveSalesPerson(entry);
    resetSPForm();
    showToast(spEditingId ? 'Sales person updated' : 'Sales person added');
  };

  const handleEditSP = (sp: SalesPerson) => {
    setSpForm(sp);
    setSpEditingId(sp.id);
    setSpShowForm(true);
  };

  const handleDeleteSP = (sp: SalesPerson) => {
    if (!confirm(`Delete sales person "${sp.name}"?`)) return;
    const updated = salesPersons.filter(s => s.id !== sp.id);
    setSalesPersons(updated);
    ZumraDB.saveSalesPersons(updated);
    ZumraSync.deleteSalesPerson(sp.id);
    onLogAudit('Delete', 'GeneralData', sp.id, `Deleted sales person: ${sp.name}`);
    showToast('Sales person deleted');
  };

  const resetSPForm = () => {
    setSpForm({});
    setSpEditingId(null);
    setSpShowForm(false);
  };

  // ==================== Cancellation Reasons ====================
  const filteredCR = useMemo(() => {
    if (!search) return cancellationReasons;
    const q = search.toLowerCase();
    return cancellationReasons.filter(cr => cr.reason.toLowerCase().includes(q));
  }, [cancellationReasons, search]);

  const handleSaveCR = () => {
    if (!crForm.reason?.trim()) { showToast('Reason is required', 'error'); return; }
    const id = crEditingId || `cr_${Date.now()}`;
    const entry: CancellationReason = {
      id,
      reason: crForm.reason?.trim() || '',
      active: crForm.active !== false,
    };
    let updated: CancellationReason[];
    if (crEditingId) {
      updated = cancellationReasons.map(cr => cr.id === crEditingId ? entry : cr);
      onLogAudit('Update', 'GeneralData', id, `Updated cancellation reason: ${entry.reason}`);
    } else {
      updated = [...cancellationReasons, entry];
      onLogAudit('Create', 'GeneralData', id, `Created cancellation reason: ${entry.reason}`);
    }
    setCancellationReasons(updated);
    ZumraDB.saveCancellationReasons(updated);
    ZumraSync.saveCancellationReason(entry);
    resetCRForm();
    showToast(crEditingId ? 'Reason updated' : 'Reason added');
  };

  const handleEditCR = (cr: CancellationReason) => {
    setCrForm(cr);
    setCrEditingId(cr.id);
    setCrShowForm(true);
  };

  const handleDeleteCR = (cr: CancellationReason) => {
    if (!confirm(`Delete reason "${cr.reason}"?`)) return;
    const updated = cancellationReasons.filter(c => c.id !== cr.id);
    setCancellationReasons(updated);
    ZumraDB.saveCancellationReasons(updated);
    ZumraSync.deleteCancellationReason(cr.id);
    onLogAudit('Delete', 'GeneralData', cr.id, `Deleted cancellation reason: ${cr.reason}`);
    showToast('Reason deleted');
  };

  const resetCRForm = () => {
    setCrForm({});
    setCrEditingId(null);
    setCrShowForm(false);
  };

  // ==================== Terms & Conditions ====================
  const filteredTC = useMemo(() => {
    if (!search) return termsAndConditions;
    const q = search.toLowerCase();
    return termsAndConditions.filter(tc => tc.title.toLowerCase().includes(q) || tc.content.toLowerCase().includes(q));
  }, [termsAndConditions, search]);

  const handleSaveTC = () => {
    if (!tcForm.title?.trim()) { showToast('Title is required', 'error'); return; }
    if (!tcForm.content?.trim()) { showToast('Content is required', 'error'); return; }
    const id = tcEditingId || `tc_${Date.now()}`;
    const entry: TermsAndConditions = {
      id,
      title: tcForm.title?.trim() || '',
      content: tcForm.content?.trim() || '',
      active: tcForm.active !== false,
    };
    let updated: TermsAndConditions[];
    if (tcEditingId) {
      updated = termsAndConditions.map(tc => tc.id === tcEditingId ? entry : tc);
      onLogAudit('Update', 'GeneralData', id, `Updated T&C: ${entry.title}`);
    } else {
      updated = [...termsAndConditions, entry];
      onLogAudit('Create', 'GeneralData', id, `Created T&C: ${entry.title}`);
    }
    setTermsAndConditions(updated);
    ZumraDB.saveTermsAndConditions(updated);
    ZumraSync.saveTermsAndConditions(entry);
    resetTCForm();
    showToast(tcEditingId ? 'T&C updated' : 'T&C added');
  };

  const handleEditTC = (tc: TermsAndConditions) => {
    setTcForm(tc);
    setTcEditingId(tc.id);
    setTcShowForm(true);
  };

  const handleDeleteTC = (tc: TermsAndConditions) => {
    if (!confirm(`Delete T&C "${tc.title}"?`)) return;
    const updated = termsAndConditions.filter(t => t.id !== tc.id);
    setTermsAndConditions(updated);
    ZumraDB.saveTermsAndConditions(updated);
    ZumraSync.deleteTermsAndConditions(tc.id);
    onLogAudit('Delete', 'GeneralData', tc.id, `Deleted T&C: ${tc.title}`);
    showToast('T&C deleted');
  };

  const resetTCForm = () => {
    setTcForm({});
    setTcEditingId(null);
    setTcShowForm(false);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearch('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">General Data</h1>
        <p className="text-sm text-gray-500">Manage sales persons, cancellation reasons, and terms & conditions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder={`Search ${tabs.find(t => t.key === activeTab)?.label}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* ==================== SALES PERSONS TAB ==================== */}
      {activeTab === 'salesPersons' && (
        <div className="space-y-4">
          <button
            onClick={() => { resetSPForm(); setSpShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Add Sales Person
          </button>

          {spShowForm && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">{spEditingId ? 'Edit Sales Person' : 'New Sales Person'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input placeholder="Name *" value={spForm.name || ''} onChange={e => setSpForm({ ...spForm, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Phone" value={spForm.phone || ''} onChange={e => setSpForm({ ...spForm, phone: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Email" type="email" value={spForm.email || ''} onChange={e => setSpForm({ ...spForm, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Commission %:</label>
                  <input type="number" min={0} max={100} step={0.5} value={spForm.commission ?? 0} onChange={e => setSpForm({ ...spForm, commission: Number(e.target.value) })} className="w-20 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={spForm.active !== false} onChange={e => setSpForm({ ...spForm, active: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveSP} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {spEditingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetSPForm} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Commission</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSP.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No sales persons found</td></tr>
                ) : (
                  filteredSP.map(sp => (
                    <tr key={sp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{sp.name}</td>
                      <td className="px-4 py-3 text-gray-600">{sp.phone || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{sp.email || '-'}</td>
                      <td className="px-4 py-3">{sp.commission}%</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sp.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {sp.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEditSP(sp)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                        <button onClick={() => handleDeleteSP(sp)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== CANCELLATION REASONS TAB ==================== */}
      {activeTab === 'cancellationReasons' && (
        <div className="space-y-4">
          <button
            onClick={() => { resetCRForm(); setCrShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Add Reason
          </button>

          {crShowForm && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">{crEditingId ? 'Edit Reason' : 'New Cancellation Reason'}</h3>
              <div className="flex items-center gap-3">
                <input placeholder="Reason *" value={crForm.reason || ''} onChange={e => setCrForm({ ...crForm, reason: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input type="checkbox" checked={crForm.active !== false} onChange={e => setCrForm({ ...crForm, active: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveCR} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {crEditingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetCRForm} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCR.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-gray-400">No reasons found</td></tr>
                ) : (
                  filteredCR.map(cr => (
                    <tr key={cr.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{cr.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cr.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {cr.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEditCR(cr)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                        <button onClick={() => handleDeleteCR(cr)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TERMS & CONDITIONS TAB ==================== */}
      {activeTab === 'termsConditions' && (
        <div className="space-y-4">
          <button
            onClick={() => { resetTCForm(); setTcShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Add Terms & Conditions
          </button>

          {tcShowForm && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">{tcEditingId ? 'Edit T&C' : 'New Terms & Conditions'}</h3>
              <div className="flex items-center gap-3">
                <input placeholder="Title *" value={tcForm.title || ''} onChange={e => setTcForm({ ...tcForm, title: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input type="checkbox" checked={tcForm.active !== false} onChange={e => setTcForm({ ...tcForm, active: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
              <textarea
                placeholder="Content *"
                rows={8}
                value={tcForm.content || ''}
                onChange={e => setTcForm({ ...tcForm, content: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-y"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveTC} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {tcEditingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetTCForm} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Preview</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTC.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No T&C found</td></tr>
                ) : (
                  filteredTC.map(tc => (
                    <tr key={tc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{tc.title}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{tc.content.slice(0, 80)}{tc.content.length > 80 ? '...' : ''}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {tc.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => setViewingTc(tc)} className="text-emerald-600 hover:text-emerald-800 font-medium">View</button>
                        <button onClick={() => handleEditTC(tc)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                        <button onClick={() => handleDeleteTC(tc)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View T&C Modal */}
      {viewingTc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingTc(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{viewingTc.title}</h2>
              <button onClick={() => setViewingTc(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
              {viewingTc.content}
            </div>
            <button onClick={() => setViewingTc(null)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
