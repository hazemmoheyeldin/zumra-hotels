/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { SalesPerson, CancellationReason, TermsAndConditions, BlackoutPeriod, EmailTemplate, Hotel } from '../types';
import { ZumraDB, ZumraSync, loadBlackoutPeriods, saveBlackoutPeriods, loadEmailTemplates, saveEmailTemplates, loadMarginThreshold, saveMarginThreshold, getEgyptTime } from '../lib/storage';
import { showToast } from './Toast';

interface GeneralDataPageProps {
  salesPersons: SalesPerson[];
  setSalesPersons: (list: SalesPerson[]) => void;
  cancellationReasons: CancellationReason[];
  setCancellationReasons: (list: CancellationReason[]) => void;
  termsAndConditions: TermsAndConditions[];
  setTermsAndConditions: (list: TermsAndConditions[]) => void;
  hotels: Hotel[];
  onLogAudit: (action: string, entityType: any, entityId: string, detail: string) => void;
}

type Tab = 'salesPersons' | 'cancellationReasons' | 'termsConditions' | 'blackoutPeriods' | 'emailTemplates' | 'backup';

export default function GeneralDataPage({
  salesPersons, setSalesPersons,
  cancellationReasons, setCancellationReasons,
  termsAndConditions, setTermsAndConditions,
  hotels,
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

  // Blackout Period state
  const [blackoutPeriods, setBlackoutPeriods] = useState<BlackoutPeriod[]>([]);
  const [bpForm, setBpForm] = useState<Partial<BlackoutPeriod>>({});
  const [bpEditingId, setBpEditingId] = useState<string | null>(null);
  const [bpShowForm, setBpShowForm] = useState(false);

  // Email Template state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [etForm, setEtForm] = useState<Partial<EmailTemplate>>({});
  const [etEditingId, setEtEditingId] = useState<string | null>(null);
  const [etShowForm, setEtShowForm] = useState(false);
  const [previewingEt, setPreviewingEt] = useState<EmailTemplate | null>(null);

  // Margin threshold
  const [marginThreshold, setMarginThreshold] = useState<number>(15);

  // View T&C content
  const [viewingTc, setViewingTc] = useState<TermsAndConditions | null>(null);

  useEffect(() => {
    setBlackoutPeriods(loadBlackoutPeriods());
    setEmailTemplates(loadEmailTemplates());
    setMarginThreshold(loadMarginThreshold());
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'salesPersons', label: 'Sales Persons', icon: '👤' },
    { key: 'cancellationReasons', label: 'Cancellation Reasons', icon: '❌' },
    { key: 'termsConditions', label: 'Terms & Conditions', icon: '📜' },
    { key: 'blackoutPeriods', label: 'Blackout Periods', icon: '🚫' },
    { key: 'emailTemplates', label: 'Email Templates', icon: '📧' },
    { key: 'backup', label: 'Backup & Restore', icon: '💾' },
  ];

  const emailVariables = [
    { key: '{{guestName}}', label: 'Guest Name' },
    { key: '{{hotel}}', label: 'Hotel' },
    { key: '{{checkIn}}', label: 'Check-In' },
    { key: '{{checkOut}}', label: 'Check-Out' },
    { key: '{{nights}}', label: 'Nights' },
    { key: '{{rooms}}', label: 'Rooms' },
    { key: '{{totalPrice}}', label: 'Total Price' },
    { key: '{{bookingRef}}', label: 'Booking Ref' },
    { key: '{{agentName}}', label: 'Agent Name' },
    { key: '{{specialRequests}}', label: 'Special Requests' },
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

  const handleSetDefaultTC = (tc: TermsAndConditions) => {
    const updated = termsAndConditions.map(t => ({ ...t, isDefault: t.id === tc.id }));
    setTermsAndConditions(updated);
    ZumraDB.saveTermsAndConditions(updated);
    ZumraSync.saveTermsAndConditions({ ...tc, isDefault: true });
    onLogAudit('Update', 'GeneralData', tc.id, `Set "${tc.title}" as default T&C`);
    showToast(`"${tc.title}" set as default`);
  };

  const resetTCForm = () => {
    setTcForm({});
    setTcEditingId(null);
    setTcShowForm(false);
  };

  // ==================== Blackout Periods ====================
  const filteredBP = useMemo(() => {
    if (!search) return blackoutPeriods;
    const q = search.toLowerCase();
    return blackoutPeriods.filter(bp => bp.name.toLowerCase().includes(q) || bp.startDate.includes(q) || bp.endDate.includes(q));
  }, [blackoutPeriods, search]);

  const handleSaveBP = () => {
    if (!bpForm.name?.trim()) { showToast('Name is required', 'error'); return; }
    if (!bpForm.startDate || !bpForm.endDate) { showToast('Start and end dates are required', 'error'); return; }
    if (bpForm.startDate > bpForm.endDate) { showToast('End date must be after start date', 'error'); return; }
    const id = bpEditingId || `bp_${Date.now()}`;
    const entry: BlackoutPeriod = {
      id,
      name: bpForm.name?.trim() || '',
      startDate: bpForm.startDate,
      endDate: bpForm.endDate,
      rateMultiplier: bpForm.rateMultiplier ?? 1,
      blockBookings: bpForm.blockBookings ?? false,
      affectedHotels: bpForm.affectedHotels || [],
      notes: bpForm.notes || '',
      createdBy: bpForm.createdBy || '',
      createdAt: bpForm.createdAt || getEgyptTime().toISOString(),
    };
    let updated: BlackoutPeriod[];
    if (bpEditingId) {
      updated = blackoutPeriods.map(bp => bp.id === bpEditingId ? entry : bp);
      onLogAudit('Update', 'GeneralData', id, `Updated blackout period: ${entry.name}`);
    } else {
      updated = [...blackoutPeriods, entry];
      onLogAudit('Create', 'GeneralData', id, `Created blackout period: ${entry.name}`);
    }
    setBlackoutPeriods(updated);
    saveBlackoutPeriods(updated);
    resetBPForm();
    showToast(bpEditingId ? 'Blackout period updated' : 'Blackout period added');
  };

  const handleEditBP = (bp: BlackoutPeriod) => {
    setBpForm(bp);
    setBpEditingId(bp.id);
    setBpShowForm(true);
  };

  const handleDeleteBP = (bp: BlackoutPeriod) => {
    if (!confirm(`Delete blackout period "${bp.name}"?`)) return;
    const updated = blackoutPeriods.filter(b => b.id !== bp.id);
    setBlackoutPeriods(updated);
    saveBlackoutPeriods(updated);
    onLogAudit('Delete', 'GeneralData', bp.id, `Deleted blackout period: ${bp.name}`);
    showToast('Blackout period deleted');
  };

  const resetBPForm = () => {
    setBpForm({});
    setBpEditingId(null);
    setBpShowForm(false);
  };

  // ==================== Email Templates ====================
  const filteredET = useMemo(() => {
    if (!search) return emailTemplates;
    const q = search.toLowerCase();
    return emailTemplates.filter(et => et.name.toLowerCase().includes(q) || et.subject.toLowerCase().includes(q) || et.type.includes(q));
  }, [emailTemplates, search]);

  const handleSaveET = () => {
    if (!etForm.name?.trim()) { showToast('Name is required', 'error'); return; }
    if (!etForm.subject?.trim()) { showToast('Subject is required', 'error'); return; }
    if (!etForm.body?.trim()) { showToast('Body is required', 'error'); return; }
    const id = etEditingId || `et_${Date.now()}`;
    const entry: EmailTemplate = {
      id,
      name: etForm.name?.trim() || '',
      subject: etForm.subject?.trim() || '',
      body: etForm.body?.trim() || '',
      type: etForm.type || 'custom',
      active: etForm.active !== false,
      createdBy: etForm.createdBy || '',
      createdAt: etForm.createdAt || getEgyptTime().toISOString(),
    };
    let updated: EmailTemplate[];
    if (etEditingId) {
      updated = emailTemplates.map(et => et.id === etEditingId ? entry : et);
      onLogAudit('Update', 'GeneralData', id, `Updated email template: ${entry.name}`);
    } else {
      updated = [...emailTemplates, entry];
      onLogAudit('Create', 'GeneralData', id, `Created email template: ${entry.name}`);
    }
    setEmailTemplates(updated);
    saveEmailTemplates(updated);
    resetETForm();
    showToast(etEditingId ? 'Email template updated' : 'Email template added');
  };

  const handleEditET = (et: EmailTemplate) => {
    setEtForm(et);
    setEtEditingId(et.id);
    setEtShowForm(true);
  };

  const handleDeleteET = (et: EmailTemplate) => {
    if (!confirm(`Delete email template "${et.name}"?`)) return;
    const updated = emailTemplates.filter(e => e.id !== et.id);
    setEmailTemplates(updated);
    saveEmailTemplates(updated);
    onLogAudit('Delete', 'GeneralData', et.id, `Deleted email template: ${et.name}`);
    showToast('Email template deleted');
  };

  const resetETForm = () => {
    setEtForm({});
    setEtEditingId(null);
    setEtShowForm(false);
  };

  const insertVariable = (variable: string) => {
    setEtForm(prev => ({ ...prev, body: (prev.body || '') + variable }));
  };

  const handleSaveMarginThreshold = (val: number) => {
    const v = Math.max(1, Math.min(100, val));
    setMarginThreshold(v);
    saveMarginThreshold(v);
    showToast(`Margin threshold set to ${v}%`);
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
        <p className="text-sm text-slate-500">Manage sales persons, cancellation reasons, terms, blackout periods, email templates, and settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-slate-500 hover:text-gray-700'
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
                  <label className="text-sm text-gray-600">SAR / Room / Night:</label>
                  <input type="number" min={0} step={1} value={spForm.commission ?? 0} onChange={e => setSpForm({ ...spForm, commission: Number(e.target.value) })} className="w-24 px-3 py-2 border rounded-lg text-sm" />
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">SAR/Room/Night</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSP.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">No sales persons found</td></tr>
                ) : (
                  filteredSP.map(sp => (
                    <tr key={sp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{sp.name}</td>
                      <td className="px-4 py-3 text-gray-600">{sp.phone || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{sp.email || '-'}</td>
                      <td className="px-4 py-3 font-mono">{sp.commission} SAR</td>
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
                  <tr><td colSpan={3} className="text-center py-8 text-slate-400">No reasons found</td></tr>
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Default</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTC.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">No T&C found</td></tr>
                ) : (
                  filteredTC.map(tc => (
                    <tr key={tc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{tc.title}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{tc.content.slice(0, 80)}{tc.content.length > 80 ? '...' : ''}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {tc.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {tc.isDefault ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">★ Default</span>
                        ) : (
                          <button onClick={() => handleSetDefaultTC(tc)} className="text-xs text-slate-400 hover:text-amber-600 font-medium">Set Default</button>
                        )}
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

      {/* ==================== BLACKOUT PERIODS TAB ==================== */}
      {activeTab === 'blackoutPeriods' && (
        <div className="space-y-4">
          {/* Margin Threshold Setting */}
          <div className="bg-white border rounded-xl p-4 flex items-center gap-4">
            <label className="text-sm font-bold text-gray-700">Profit Margin Alert Threshold (%):</label>
            <input
              type="number" min={1} max={100} step={1}
              value={marginThreshold}
              onChange={e => handleSaveMarginThreshold(Number(e.target.value))}
              className="w-20 px-3 py-2 border rounded-lg text-sm"
            />
            <span className="text-xs text-slate-500">Reservations below this margin will show a warning</span>
          </div>

          <button
            onClick={() => { resetBPForm(); setBpShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Add Blackout Period
          </button>

          {bpShowForm && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">{bpEditingId ? 'Edit Blackout Period' : 'New Blackout Period'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input placeholder="Name * (e.g., Ramadan 2026, Hajj Season)" value={bpForm.name || ''} onChange={e => setBpForm({ ...bpForm, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 whitespace-nowrap">Start:</label>
                  <input type="date" value={bpForm.startDate || ''} onChange={e => setBpForm({ ...bpForm, startDate: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 whitespace-nowrap">End:</label>
                  <input type="date" value={bpForm.endDate || ''} onChange={e => setBpForm({ ...bpForm, endDate: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 whitespace-nowrap">Rate Multiplier:</label>
                  <input type="number" min={0.5} max={10} step={0.1} value={bpForm.rateMultiplier ?? 1} onChange={e => setBpForm({ ...bpForm, rateMultiplier: Number(e.target.value) })} className="w-20 px-3 py-2 border rounded-lg text-sm" />
                  <span className="text-xs text-slate-400">e.g., 1.5 = 50% markup</span>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={bpForm.blockBookings ?? false} onChange={e => setBpForm({ ...bpForm, blockBookings: e.target.checked })} className="rounded" />
                  Block new bookings during this period
                </label>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium block mb-1">Affected Hotels (leave empty for all):</label>
                <div className="flex flex-wrap gap-2">
                  {hotels.map(h => (
                    <label key={h.id} className="flex items-center gap-1 text-xs bg-gray-50 px-2 py-1 rounded">
                      <input type="checkbox" checked={(bpForm.affectedHotels || []).includes(h.id)} onChange={e => {
                        const current = bpForm.affectedHotels || [];
                        setBpForm({ ...bpForm, affectedHotels: e.target.checked ? [...current, h.id] : current.filter(id => id !== h.id) });
                      }} className="rounded" />
                      {h.name}
                    </label>
                  ))}
                </div>
              </div>
              <textarea placeholder="Notes (optional)" rows={2} value={bpForm.notes || ''} onChange={e => setBpForm({ ...bpForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm resize-y" />
              <div className="flex gap-2">
                <button onClick={handleSaveBP} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {bpEditingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetBPForm} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Period</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Rate</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Block</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Hotels</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBP.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">No blackout periods found</td></tr>
                ) : (
                  filteredBP.map(bp => {
                    const isActive = new Date() >= new Date(bp.startDate) && new Date() <= new Date(bp.endDate);
                    return (
                      <tr key={bp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {bp.name}
                          {isActive && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">ACTIVE NOW</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{bp.startDate} → {bp.endDate}</td>
                        <td className="px-4 py-3">{bp.rateMultiplier}x</td>
                        <td className="px-4 py-3">
                          {bp.blockBookings ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Blocked</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Open</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {!bp.affectedHotels || bp.affectedHotels.length === 0 ? 'All' : bp.affectedHotels.map(hid => hotels.find(h => h.id === hid)?.name || hid).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button onClick={() => handleEditBP(bp)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                          <button onClick={() => handleDeleteBP(bp)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== EMAIL TEMPLATES TAB ==================== */}
      {activeTab === 'emailTemplates' && (
        <div className="space-y-4">
          <button
            onClick={() => { resetETForm(); setEtShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Add Email Template
          </button>

          {etShowForm && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">{etEditingId ? 'Edit Email Template' : 'New Email Template'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input placeholder="Template Name *" value={etForm.name || ''} onChange={e => setEtForm({ ...etForm, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <select value={etForm.type || 'custom'} onChange={e => setEtForm({ ...etForm, type: e.target.value as EmailTemplate['type'] })} className="px-3 py-2 border rounded-lg text-sm">
                  <option value="confirmation">Confirmation</option>
                  <option value="reminder">Reminder</option>
                  <option value="payment">Payment</option>
                  <option value="cancellation">Cancellation</option>
                  <option value="preArrival">Pre-Arrival</option>
                  <option value="custom">Custom</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={etForm.active !== false} onChange={e => setEtForm({ ...etForm, active: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
              <input placeholder="Email Subject *" value={etForm.subject || ''} onChange={e => setEtForm({ ...etForm, subject: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-600">Email Body *</label>
                  <div className="flex flex-wrap gap-1">
                    {emailVariables.map(v => (
                      <button key={v.key} type="button" onClick={() => insertVariable(v.key)} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold hover:bg-indigo-100 border border-indigo-200" title={v.label}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder="Email body... Use {{guestName}}, {{hotel}}, {{checkIn}}, etc."
                  rows={8}
                  value={etForm.body || ''}
                  onChange={e => setEtForm({ ...etForm, body: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-y font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveET} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {etEditingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetETForm} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Subject</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredET.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">No email templates found</td></tr>
                ) : (
                  filteredET.map(et => (
                    <tr key={et.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{et.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 capitalize">{et.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{et.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${et.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {et.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => setPreviewingEt(et)} className="text-emerald-600 hover:text-emerald-800 font-medium">Preview</button>
                        <button onClick={() => handleEditET(et)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                        <button onClick={() => handleDeleteET(et)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== BACKUP & RESTORE TAB ==================== */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">📤 Export Backup</h3>
            <p className="text-sm text-slate-500">Download a complete backup of all application data as a JSON file. Use this for disaster recovery or to migrate data.</p>
            <button
              onClick={() => {
                const backup: Record<string, any> = { _backupDate: new Date().toISOString(), _version: 1 };
                const keys = ['hotels','agents','allotments','reservations','accounts','transactions','users','followups','external_transfers','audit_log','sales_persons','cancellation_reasons','terms_conditions','other_services','payment_gateways','pay_by_links','edit_approvals','tax_settings','expenses','expense_categories','consolidated_invoices','messages'];
                keys.forEach(k => { try { backup[k] = JSON.parse(localStorage.getItem(`zumra_${k}`) || '[]'); } catch { backup[k] = []; } });
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `zumra-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
                URL.revokeObjectURL(url);
                showToast('Backup downloaded successfully');
                onLogAudit('Backup', 'GeneralData', 'backup', `Exported full backup`);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Download Full Backup
            </button>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">📥 Restore from Backup</h3>
            <p className="text-sm text-slate-500">Restore data from a previously exported JSON backup file. <span className="text-red-500 font-medium">This will overwrite current data.</span></p>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm('This will OVERWRITE all current data with the backup. Are you sure?')) { e.target.value = ''; return; }
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const backup = JSON.parse(ev.target?.result as string);
                    if (!backup._backupDate) { showToast('Invalid backup file', 'error'); return; }
                    const keys = Object.keys(backup).filter(k => !k.startsWith('_'));
                    keys.forEach(k => { localStorage.setItem(`zumra_${k}`, JSON.stringify(backup[k])); });
                    showToast(`Restored ${keys.length} collections. Reloading...`);
                    onLogAudit('Restore', 'GeneralData', 'restore', `Restored from backup dated ${backup._backupDate}`);
                    setTimeout(() => window.location.reload(), 1500);
                  } catch (err) {
                    showToast('Failed to parse backup file', 'error');
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
              className="block text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">🗂️ Data Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {(['hotels','agents','reservations','transactions','allotments','accounts','other_services','expenses'] as const).map(k => {
                try { const d = JSON.parse(localStorage.getItem(`zumra_${k}`) || '[]'); return (
                  <div key={k} className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-800">{Array.isArray(d) ? d.length : 1}</div>
                    <div className="text-xs text-slate-500 capitalize">{k.replace(/_/g,' ')}</div>
                  </div>
                ); } catch { return null; }
              })}
            </div>
          </div>

          
        </div>
      )}

      {/* View T&C Modal */}
      {viewingTc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingTc(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85dvh] flex flex-col overflow-hidden p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{viewingTc.title}</h2>
              <button onClick={() => setViewingTc(null)} className="text-slate-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
              {viewingTc.content}
            </div>
            <button onClick={() => setViewingTc(null)} className="flex-shrink-0 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Email Template Preview Modal */}
      {previewingEt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewingEt(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85dvh] flex flex-col overflow-hidden p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewingEt.name}</h2>
                <span className="text-xs text-slate-500 capitalize">{previewingEt.type} template</span>
              </div>
              <button onClick={() => setPreviewingEt(null)} className="text-slate-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-slate-500">SUBJECT:</div>
              <div className="text-sm font-medium text-gray-800">{previewingEt.subject}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-slate-500">BODY PREVIEW:</div>
              <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {previewingEt.body.replace(/\{\{([^}]+)\}\}/g, (_, key) => `[${key}]`)}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 text-[9px]">
              {emailVariables.map(v => (
                <span key={v.key} className={`px-1.5 py-0.5 rounded font-mono ${previewingEt.body.includes(v.key) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-slate-400'}`}>
                  {v.key}
                </span>
              ))}
            </div>
            </div>
            <button onClick={() => setPreviewingEt(null)} className="flex-shrink-0 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
