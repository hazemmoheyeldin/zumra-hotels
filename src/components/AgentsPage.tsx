/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent, Reservation, Account, Transaction } from '../types';
import BulkPaymentDialog from './BulkPaymentDialog';
import Tooltip from './Tooltip';
import { useLang } from '../lib/LanguageContext';
import { showToast } from './Toast';
import EmptyState from './EmptyState';

import { getAgentActualBalance, exportToExcel } from '../lib/storage';

// Generate a unique random token for client portal access
function generatePortalToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 32; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

interface AgentsPageProps {
  agents: Agent[];
  reservations: Reservation[];
  accounts: Account[];
  transactions: Transaction[];
  currentUser: string;
  onSaveAgent: (agent: Agent, onSuccess?: () => void) => void;
  onDeleteAgent: (id: string) => void;
  onBulkPaymentSave: (updatedReservations: Reservation[], updatedTransactions: Transaction[], updatedAccounts: Account[]) => void;
}

function AgentsPage({ agents, reservations, accounts, transactions, currentUser, onSaveAgent, onDeleteAgent, onBulkPaymentSave }: AgentsPageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const { t, lang } = useLang();
  const [portalMenuId, setPortalMenuId] = useState<string | null>(null);
  
  // Form States
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('Egypt');
  const [type, setType] = useState<'Customer' | 'Supplier' | 'Both'>('Customer');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [creditLimit, setCreditLimit] = useState<number | undefined>(undefined);
  const [clientStatus, setClientStatus] = useState<'Active' | 'Suspended' | 'Blacklisted'>('Active');
  const [supplierMarkupRate, setSupplierMarkupRate] = useState<number | undefined>(undefined);
  const [contactPersons, setContactPersons] = useState<{ name: string; phone: string; email?: string }[]>([]);
  const [formSection, setFormSection] = useState<'basic' | 'contact' | 'financial'>('basic');

  const [showForm, setShowForm] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Customer' | 'Supplier' | 'Both'>('All');

  // Auditing or Viewing overlays
  const [auditingAgent, setAuditingAgent] = useState<Agent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  
  // Bulk payment modal
  const [bulkPaymentAgent, setBulkPaymentAgent] = useState<Agent | null>(null);

  const handleExportExcel = () => {
    const rows = filteredAgents.map(a => ({
      'Agent ID': a.agentNumber,
      'Name': a.name,
      'Company Name': a.companyName || '',
      'Country': a.country,
      'Type': a.type,
      'Phone': a.phone,
      'Email': a.email,
      'Address': a.address || '',
      'Contact Persons': (a.contactPersons || []).map(cp => `${cp.name} (${cp.phone})`).join('; '),
      'Balance (SAR)': getAgentActualBalance(a, reservations, transactions),
    }));
    exportToExcel('Agents Directory.xlsx', rows, 'Agents');
  };

  const copyPortalLink = (agent: Agent) => {
      const token = agent.portalToken || 'no-token';
      const url = `${window.location.origin}${window.location.pathname}?portal=${token}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast(`Portal link for ${agent.name} copied!`, 'success');
        setPortalMenuId(null);
      }).catch(() => {
        showToast('Failed to copy link', 'error');
      });
    };
  
    const openPortal = (agent: Agent) => {
      const token = agent.portalToken || 'no-token';
      window.open(`${window.location.origin}${window.location.pathname}?portal=${token}`, '_blank');
      setPortalMenuId(null);
    };
  
  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setName(agent.name);
    setCompanyName(agent.companyName);
    setCountry(agent.country);
    setType(agent.type);
    setPhone(agent.phone);
    setEmail(agent.email);
    setAddress(agent.address);
    setOpeningBalance(agent.balance);
    setCreditLimit(agent.creditLimit);
    setClientStatus(agent.clientStatus || 'Active');
    setSupplierMarkupRate(agent.supplierMarkupRate);
    setContactPersons(agent.contactPersons || []);
    setShowForm(true);
    setFormSection('basic');
    setActiveMenuId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showToast('Please fill out the agent name field.', 'warning');
      return;
    }

    // Duplicate agent detection: same name + same type (skip when editing same agent)
    const duplicate = agents.find(a =>
      a.id !== editingId &&
      a.name.toLowerCase().trim() === name.toLowerCase().trim() &&
      a.type === type
    );
    if (duplicate) {
      if (!confirm(`⚠️ Possible duplicate detected!\n\nAn agent "${duplicate.name}" (${duplicate.type}) already exists (Agent #${duplicate.agentNumber}).\n\nSave anyway?`)) return;
    }

    // Auto calculate sequential Agent Number per type (C-### for customers, S-### for suppliers, B-### for both)
    const prefix = type === 'Customer' ? 'C' : type === 'Supplier' ? 'S' : 'B';
    let nextAgentNumber = `${prefix}-001`;
    if (!editingId) {
      const regex = new RegExp(`^${prefix}-(\\d+)$`);
      const maxNum = agents.reduce((max, a) => {
        const m = a.agentNumber.match(regex);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      nextAgentNumber = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    } else {
      const current = agents.find(a => a.id === editingId);
      nextAgentNumber = current ? current.agentNumber : `${prefix}-001`;
    }

    // Capture system log for changes
    const logDetails = editingId ? `Specs edited by system user ${currentUser}` : `Agent registered on portal with auto AgentID# ${nextAgentNumber}`;
    const newLog = {
      id: `l_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: currentUser,
      action: logDetails
    };

    const pastLogs = editingId ? (agents.find(a => a.id === editingId)?.auditLogs || []) : [];

    const newAgent: Agent = {
      id: editingId || `a_${Date.now()}`,
      agentNumber: nextAgentNumber,
      name,
      companyName,
      country,
      type,
      phone,
      email,
      address,
      balance: openingBalance,
      creditLimit,
      clientStatus,
      supplierMarkupRate: (type === 'Supplier' || type === 'Both') ? supplierMarkupRate : undefined,
      contactPersons: contactPersons.filter(cp => cp.name.trim()),
      portalToken: editingId ? (agents.find(a => a.id === editingId)?.portalToken || generatePortalToken()) : generatePortalToken(),
      auditLogs: [newLog, ...pastLogs]
    };

    onSaveAgent(newAgent, () => resetForm());
    // Note: resetForm is NOT called here — it's called by the parent after successful save
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCompanyName('');
    setCountry('Egypt');
    setType('Customer');
    setPhone('');
    setEmail('');
    setAddress('');
    setOpeningBalance(0);
    setCreditLimit(undefined);
    setClientStatus('Active');
    setSupplierMarkupRate(undefined);
    setContactPersons([]);
    setFormSection('basic');
    setShowForm(false);
  };

  // Filtered agents
  const filteredAgents = agents.filter(a => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = a.name.toLowerCase().includes(searchLower) || (a.companyName && a.companyName.toLowerCase().includes(searchLower)) || a.phone.includes(searchLower) || (a.email && a.email.toLowerCase().includes(searchLower));
    if (filterType !== 'All' && a.type !== filterType) return false;
    return matchesSearch;
  });

  const stats = {
    total: agents.length,
    customers: agents.filter(a => a.type === 'Customer').length,
    suppliers: agents.filter(a => a.type === 'Supplier').length,
    both: agents.filter(a => a.type === 'Both').length,
  };

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
      
      {/* Header & controls bar */}
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t('agents.title')}</h2>
          <p className="text-xs text-slate-500 font-serif">{lang === 'ar' ? 'كشف حساب العملاء والموردين' : 'Client & supplier account statements'}</p>
        </div>
        <div className="flex gap-2 text-xs w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:flex-initial">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search name, company, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-2 border border-slate-200 rounded-lg w-full sm:max-w-[220px] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 text-xs"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400"
          >
            <option value="All">All Types</option>
            <option value="Customer">Customers</option>
            <option value="Supplier">Suppliers</option>
            <option value="Both">Both</option>
          </select>
          <button
            onClick={handleExportExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-3 py-2 rounded-xl transition border border-emerald-200 flex items-center gap-1 whitespace-nowrap"
            title="Export filtered agents to Excel"
          >
            <span>📊</span> Export
          </button>
          <Tooltip label={showForm ? 'Go back to agent directory' : 'Add a new client, supplier or salesperson'} position="bottom">
            <button
              onClick={() => {
                if (showForm) resetForm();
                else setShowForm(true);
              }}
              className={`${showForm ? 'bg-slate-600 hover:bg-slate-700' : 'bg-amber-600 hover:bg-amber-700'} text-white font-semibold px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5 whitespace-nowrap`}
            >
              {showForm ? (<><span>←</span> Directory</>) : (<><span>+</span> New Agent</>)}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Stats bar — only in directory view */}
      {!showForm && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Agents</div>
            <div className="text-xl font-black text-slate-800 mt-0.5">{stats.total}</div>
          </div>
          <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
            <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Customers</div>
            <div className="text-xl font-black text-indigo-700 mt-0.5">{stats.customers}</div>
          </div>
          <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100">
            <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Suppliers</div>
            <div className="text-xl font-black text-amber-700 mt-0.5">{stats.suppliers}</div>
          </div>
          <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
            <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Both</div>
            <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.both}</div>
          </div>
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          {/* Section tabs */}
          <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
            {([
              { key: 'basic', label: 'Basic Info', icon: '👤' },
              { key: 'contact', label: 'Contact & Location', icon: '📍' },
              { key: 'financial', label: 'Financial & Contacts', icon: '💰' },
            ] as const).map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setFormSection(s.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  formSection === s.key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 md:p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              {editingId ? '✏️ Edit Agent Portfolio' : '➕ Register New Partner Agent'}
            </h3>

            {/* ===== BASIC INFO SECTION ===== */}
            {formSection === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Agent / Company Name <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Marseilia Tours"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Company Trade Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Marseilia Travel Group"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Agent Type <span className="text-rose-400">*</span></label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Customer', 'Supplier', 'Both'] as const).map(tp => (
                        <button
                          key={tp}
                          type="button"
                          onClick={() => setType(tp)}
                          className={`py-2.5 px-2 rounded-xl text-[11px] font-bold border-2 transition text-center ${
                            type === tp
                              ? tp === 'Customer' ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                : tp === 'Supplier' ? 'border-amber-400 bg-amber-50 text-amber-700'
                                : 'border-emerald-400 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {tp === 'Customer' ? '🏢' : tp === 'Supplier' ? '🏨' : '🔄'}
                          <br />{tp}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Client Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Active', 'Suspended', 'Blacklisted'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setClientStatus(st)}
                          className={`py-2.5 px-2 rounded-xl text-[11px] font-bold border-2 transition text-center ${
                            clientStatus === st
                              ? st === 'Active' ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                : st === 'Suspended' ? 'border-amber-400 bg-amber-50 text-amber-700'
                                : 'border-red-400 bg-red-50 text-red-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {st === 'Active' ? '✅' : st === 'Suspended' ? '⏸️' : '🚫'}
                          <br />{st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== CONTACT & LOCATION SECTION ===== */}
            {formSection === 'contact' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Domicile Country <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      list="countries"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Egypt"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+20 100 123 4567"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@company.com"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Physical Office Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, Country"
                    rows={2}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white resize-none"
                  />
                </div>
              </div>
            )}

            {/* ===== FINANCIAL & CONTACT PERSONS SECTION ===== */}
            {formSection === 'financial' && (
              <div className="space-y-5">
                {/* Financial fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Opening Balance (SAR)</label>
                    <input
                      type="number"
                      value={openingBalance || ''}
                      onChange={(e) => setOpeningBalance(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Credit Limit (SAR) <span className="text-slate-400 font-normal normal-case">— optional</span></label>
                    <input
                      type="number"
                      value={creditLimit ?? ''}
                      onChange={(e) => setCreditLimit(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="No limit"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                {(type === 'Supplier' || type === 'Both') && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Commission / Markup Rate (%) <span className="text-slate-400 font-normal normal-case">— optional</span></label>
                    <input
                      type="number"
                      step="0.1"
                      value={supplierMarkupRate ?? ''}
                      onChange={(e) => setSupplierMarkupRate(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="e.g. 10"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-white md:max-w-[280px]"
                    />
                  </div>
                )}

                {/* ─── Contact Persons ─── */}
                <div className="border-t border-slate-200 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500">Contact Persons</label>
                      <p className="text-[10px] text-slate-400 mt-0.5">Add key contacts for this agent</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactPersons([...contactPersons, { name: '', phone: '', email: '' }])}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition border border-amber-200"
                    >
                      + Add Contact
                    </button>
                  </div>

                  {contactPersons.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <div className="text-2xl mb-1">👥</div>
                      <p className="text-xs text-slate-400">No contact persons added yet</p>
                      <button
                        type="button"
                        onClick={() => setContactPersons([{ name: '', phone: '', email: '' }])}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 mt-2"
                      >
                        + Add first contact
                      </button>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {contactPersons.map((cp, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center group hover:border-amber-200 transition">
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <input
                          type="text"
                          value={cp.name}
                          onChange={e => { const updated = [...contactPersons]; updated[idx] = { ...updated[idx], name: e.target.value }; setContactPersons(updated); }}
                          placeholder="Contact name"
                          className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-amber-500 focus:outline-none"
                        />
                        <input
                          type="tel"
                          value={cp.phone}
                          onChange={e => { const updated = [...contactPersons]; updated[idx] = { ...updated[idx], phone: e.target.value }; setContactPersons(updated); }}
                          placeholder="Phone number"
                          className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <input
                          type="email"
                          value={cp.email || ''}
                          onChange={e => { const updated = [...contactPersons]; updated[idx] = { ...updated[idx], email: e.target.value }; setContactPersons(updated); }}
                          placeholder="Email (optional)"
                          className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setContactPersons(contactPersons.filter((_, i) => i !== idx))}
                          className="text-slate-300 hover:text-rose-500 transition text-lg leading-none shrink-0"
                          title="Remove contact"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form actions */}
          <div className="flex gap-2 pt-4 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs px-5 py-2.5 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-md shadow-amber-200"
            >
              {editingId ? '💾 Save Changes' : '✨ Create Agent'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Empty state */}
          {filteredAgents.length === 0 && (
            <EmptyState
              icon="📋"
              title="No agents found"
              description={searchQuery ? 'Try a different search term' : 'Click "New Agent" to add your first partner'}
              actionLabel={searchQuery ? undefined : '+ New Agent'}
              onAction={searchQuery ? undefined : () => { resetForm(); setShowForm(true); }}
            />
          )}

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filteredAgents.map((agent) => {
              const bal = getAgentActualBalance(agent, reservations, transactions);
              return (
                <div key={agent.id} className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{agent.agentNumber}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                          agent.type === 'Customer' ? 'bg-indigo-50 text-indigo-700' :
                          agent.type === 'Supplier' ? 'bg-amber-50 text-amber-800' :
                          'bg-emerald-50 text-emerald-800'
                        }`}>{agent.type}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm truncate">{agent.name}</h4>
                      {agent.companyName && <p className="text-[11px] text-slate-500 truncate">{agent.companyName}</p>}
                    </div>
                    <span className={`font-mono font-bold text-xs shrink-0 ml-2 ${bal < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {bal < 0 ? `(${Math.abs(bal).toLocaleString()})` : bal.toLocaleString()} <span className="text-[9px]">SAR</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-3">
                    <span>📍 {agent.country}</span>
                    {agent.phone && <span className="font-mono">📞 {agent.phone}</span>}
                  </div>
                  {agent.contactPersons && agent.contactPersons.length > 0 && (
                    <div className="mb-3 bg-slate-50 rounded-lg p-2">
                      <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Contacts</div>
                      {agent.contactPersons.slice(0, 2).map((cp, i) => (
                        <div key={i} className="text-[10px] text-slate-600 flex items-center gap-2">
                          <span className="font-medium">{cp.name}</span>
                          {cp.phone && <span className="font-mono text-slate-400">{cp.phone}</span>}
                        </div>
                      ))}
                      {agent.contactPersons.length > 2 && <div className="text-[9px] text-slate-400 mt-0.5">+{agent.contactPersons.length - 2} more</div>}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setViewingAgent(agent); setActiveMenuId(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm transition">👁️</button>
                      <button onClick={() => handleEdit(agent)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg text-sm transition">✏️</button>
                      <button onClick={() => { setAuditingAgent(agent); setActiveMenuId(null); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-sm transition">📋</button>
                    </div>
                    <div className="flex gap-1">
                      {agent.type !== 'Supplier' && (
                        <div className="relative">
                          <button onClick={() => setPortalMenuId(portalMenuId === agent.id ? null : agent.id)} className="h-8 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 font-bold px-2.5 rounded-lg text-[10px] border border-amber-100 transition">🚪 Portal</button>
                          {portalMenuId === agent.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[160px] py-1" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => openPortal(agent)} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-xs font-semibold text-slate-700 flex items-center gap-2">
                                <span>🔗</span> Open Portal
                              </button>
                              <button onClick={() => copyPortalLink(agent)} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-xs font-semibold text-slate-700 flex items-center gap-2">
                                <span>📋</span> Copy Link
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {agent.type !== 'Supplier' && (
                        <button onClick={() => setBulkPaymentAgent(agent)} className="h-8 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 font-bold px-2.5 rounded-lg text-[10px] border border-emerald-100 transition">💳 Pay</button>
                      )}
                      <button onClick={() => { if (confirm('Delete this agent directory registry?')) onDeleteAgent(agent.id); }} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg text-sm transition">🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-slate-500 font-semibold tracking-wider text-[10px] uppercase sticky top-0 z-10">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Agent</th>
                <th className="py-3 px-3 text-center">Type</th>
                <th className="py-3 px-3">Country</th>
                <th className="py-3 px-3 font-mono">Contact</th>
                <th className="py-3 px-3">Contact Persons</th>
                <th className="py-3 px-3 text-right">Balance (SAR)</th>
                <th className="py-3 px-3 text-center">Credit</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredAgents.map((agent) => {
                const bal = getAgentActualBalance(agent, reservations, transactions);
                return (
                <tr key={agent.id} className="hover:bg-slate-50 transition-colors cursor-pointer text-xs">
                  <td className="py-3 px-3 font-bold font-mono text-amber-700">
                    {agent.agentNumber}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{agent.name}</div>
                    {agent.companyName && <div className="text-[10px] text-slate-400 mt-0.5">{agent.companyName}</div>}
                    {agent.clientStatus && agent.clientStatus !== 'Active' && (
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        agent.clientStatus === 'Suspended' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {agent.clientStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-lg text-[9px] font-bold ${
                      agent.type === 'Customer' ? 'bg-indigo-50 text-indigo-700' :
                      agent.type === 'Supplier' ? 'bg-amber-50 text-amber-800' :
                      'bg-emerald-50 text-emerald-800'
                    }`}>
                      {agent.type === 'Customer' ? '🏢' : agent.type === 'Supplier' ? '🏨' : '🔄'} {agent.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-600">{agent.country}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                    {agent.phone && <div>{agent.phone}</div>}
                    {agent.email && <div className="text-[10px] text-slate-400">{agent.email}</div>}
                  </td>
                  <td className="py-3 px-3">
                    {agent.contactPersons && agent.contactPersons.length > 0 ? (
                      <div className="space-y-0.5">
                        {agent.contactPersons.slice(0, 2).map((cp, i) => (
                          <div key={i} className="text-[10px]">
                            <span className="font-medium text-slate-700">{cp.name}</span>
                            {cp.phone && <span className="text-slate-400 font-mono ml-1">{cp.phone}</span>}
                          </div>
                        ))}
                        {agent.contactPersons.length > 2 && <span className="text-[9px] text-slate-400">+{agent.contactPersons.length - 2} more</span>}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className={`py-3 px-3 text-right font-mono font-bold ${bal < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {bal < 0 ? `(${Math.abs(bal).toLocaleString()})` : bal.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {agent.creditLimit && agent.creditLimit > 0 ? (() => {
                      const actualBal = Math.abs(bal);
                      const pct = Math.min(100, (actualBal / agent.creditLimit) * 100);
                      const color = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                      return (
                        <div className="w-20 mx-auto">
                          <div className="text-[9px] font-bold text-slate-500 mb-0.5">{actualBal.toLocaleString()} / {agent.creditLimit.toLocaleString()}</div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className={`text-[8px] font-bold ${pct >= 100 ? 'text-rose-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })() : <span className="text-[10px] text-slate-300">—</span>}
                  </td>
                  <td className="py-3 px-3 text-center relative">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => { setViewingAgent(agent); setActiveMenuId(null); }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="View details"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleEdit(agent)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Edit Details"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => { setAuditingAgent(agent); setActiveMenuId(null); }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Audit Log"
                      >
                        📋
                      </button>
                      {agent.type !== 'Supplier' && (
                        <div className="relative">
                          <button
                            onClick={() => setPortalMenuId(portalMenuId === agent.id ? null : agent.id)}
                            className="h-8 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 font-bold px-2 rounded-lg text-[9px] border border-amber-100 transition"
                            title="Client portal actions"
                          >
                            🚪
                          </button>
                          {portalMenuId === agent.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[160px] py-1" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => openPortal(agent)} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-xs font-semibold text-slate-700 flex items-center gap-2">
                                <span>🔗</span> Open Portal
                              </button>
                              <button onClick={() => copyPortalLink(agent)} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-xs font-semibold text-slate-700 flex items-center gap-2">
                                <span>📋</span> Copy Link
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {agent.type !== 'Supplier' && (
                        <button
                          onClick={() => setBulkPaymentAgent(agent)}
                          className="h-8 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 font-bold px-2 rounded-lg text-[9px] border border-emerald-100 transition"
                          title="Auto distribute payment FIFO across unpaid reservations"
                        >
                          💳
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm('Delete this agent directory registry?')) onDeleteAgent(agent.id); }}
                        className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg transition"
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Viewing details overlay */}
      {viewingAgent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4" onClick={() => setViewingAgent(null)}>
          <div className="bg-white rounded-none md:rounded-2xl shadow-2xl max-w-lg w-full p-5 md:p-7 max-h-[100dvh] md:max-h-[95dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-black text-sm shrink-0">
                {viewingAgent.agentNumber}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">{viewingAgent.name}</h3>
                {viewingAgent.companyName && <p className="text-xs text-slate-500 truncate">{viewingAgent.companyName}</p>}
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 ${
                viewingAgent.type === 'Customer' ? 'bg-indigo-50 text-indigo-700' :
                viewingAgent.type === 'Supplier' ? 'bg-amber-50 text-amber-800' :
                'bg-emerald-50 text-emerald-800'
              }`}>{viewingAgent.type}</span>
            </div>

            {/* Details grid — scrollable body */}
            <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Country</span>
                <span className="text-slate-800 font-medium">📍 {viewingAgent.country}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Status</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  (viewingAgent.clientStatus || 'Active') === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                  viewingAgent.clientStatus === 'Suspended' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>{viewingAgent.clientStatus || 'Active'}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Phone</span>
                <span className="text-slate-800 font-mono text-[11px]">{viewingAgent.phone || '—'}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Email</span>
                <span className="text-slate-800 font-mono text-[11px] break-all">{viewingAgent.email || '—'}</span>
              </div>
              {viewingAgent.address && (
                <div className="col-span-2 bg-slate-50 rounded-xl p-3">
                  <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Office Address</span>
                  <span className="text-slate-800">{viewingAgent.address}</span>
                </div>
              )}
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Balance</span>
                <span className={`font-mono font-bold text-sm ${getAgentActualBalance(viewingAgent, reservations, transactions) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {getAgentActualBalance(viewingAgent, reservations, transactions).toLocaleString()} SAR
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Credit Limit</span>
                <span className="text-slate-800 font-mono font-medium">{viewingAgent.creditLimit ? `${viewingAgent.creditLimit.toLocaleString()} SAR` : 'No limit'}</span>
              </div>
            </div>

            {/* Contact Persons */}
            {viewingAgent.contactPersons && viewingAgent.contactPersons.length > 0 && (
              <div className="mt-5">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Contact Persons</h4>
                <div className="space-y-2">
                  {viewingAgent.contactPersons.map((cp, i) => (
                    <div key={i} className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">
                        {cp.name ? cp.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-xs">{cp.name || 'Unnamed'}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {cp.phone && <span className="text-[10px] font-mono text-slate-500">📞 {cp.phone}</span>}
                          {cp.email && <span className="text-[10px] font-mono text-slate-500">✉️ {cp.email}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>

            <div className="flex-shrink-0 mt-6 flex justify-end border-t border-slate-100 pt-3">
              <button onClick={() => setViewingAgent(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-xl text-xs font-semibold transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auditing logging details overlay */}
      {auditingAgent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4" onClick={() => setAuditingAgent(null)}>
          <div className="bg-white rounded-none md:rounded-xl shadow-2xl max-w-lg w-full p-4 md:p-6 max-h-[100dvh] md:max-h-[95dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex-shrink-0 text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2.5">Audit Security Logs — {auditingAgent.agentNumber}</h3>
            <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1 no-scrollbar text-xs">
              {auditingAgent.auditLogs && auditingAgent.auditLogs.length > 0 ? (
                auditingAgent.auditLogs.map((log) => (
                  <div key={log.id} className="border-b border-slate-50 pb-2 last:border-0">
                    <span className="font-mono text-[10px] text-slate-400 block">{log.timestamp} • User: {log.user}</span>
                    <p className="mt-0.5 text-slate-700 font-medium">{log.action}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 italic text-center py-6">No historical change logs recorded for this partner.</p>
              )}
            </div>
            <div className="flex-shrink-0 mt-6 flex justify-end border-t border-slate-100 pt-3">
              <button onClick={() => setAuditingAgent(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-semibold">
                Close Registry Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* bulk payment wizard */}
      {bulkPaymentAgent && (
        <BulkPaymentDialog
          client={bulkPaymentAgent}
          reservations={reservations}
          accounts={accounts}
          currentUser={currentUser}
          onClose={() => setBulkPaymentAgent(null)}
          onSave={(updatedR, updatedT, updatedA) => {
            onBulkPaymentSave(updatedR, updatedT, updatedA);
            setBulkPaymentAgent(null);
            showToast('Distributed payment across bookings successfully! Account balances synchronized.', 'success');
          }}
        />
      )}

    </div>
  );
}

export default React.memo(AgentsPage);
