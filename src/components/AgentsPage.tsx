/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent, Reservation, Account, Transaction } from '../types';
import BulkPaymentDialog from './BulkPaymentDialog';
import { useLang } from '../lib/LanguageContext';
import { showToast } from './Toast';

import { getAgentActualBalance, exportToExcel } from '../lib/storage';

interface AgentsPageProps {
  agents: Agent[];
  reservations: Reservation[];
  accounts: Account[];
  transactions: Transaction[];
  currentUser: string;
  onSaveAgent: (agent: Agent) => void;
  onDeleteAgent: (id: string) => void;
  onBulkPaymentSave: (updatedReservations: Reservation[], updatedTransactions: Transaction[], updatedAccounts: Account[]) => void;
}

export default function AgentsPage({ agents, reservations, accounts, transactions, currentUser, onSaveAgent, onDeleteAgent, onBulkPaymentSave }: AgentsPageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const { t, lang } = useLang();
  
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
    const filteredAgents = agents.filter(a => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = a.name.toLowerCase().includes(searchLower) || (a.companyName && a.companyName.toLowerCase().includes(searchLower)) || a.phone.includes(searchLower);
      if (filterType !== 'All' && a.type !== filterType) return false;
      return matchesSearch;
    });
    const rows = filteredAgents.map(a => ({
      'Agent ID': a.agentNumber,
      'Name': a.name,
      'Company Name': a.companyName || '',
      'Country': a.country,
      'Type': a.type,
      'Phone': a.phone,
      'Email': a.email,
      'Address': a.address || '',
      'Balance (SAR)': getAgentActualBalance(a, reservations, transactions),
    }));
    exportToExcel('Agents Directory.xlsx', rows, 'Agents');
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
    setShowForm(true);
    setActiveMenuId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showToast('Please fill out the agent name field.', 'warning');
      return;
    }

    // Auto calculate incremental Agent Number
    let nextAgentNumber = 1;
    if (!editingId) {
      const highestNum = agents.reduce((max, a) => a.agentNumber > max ? a.agentNumber : max, 0);
      nextAgentNumber = highestNum + 1;
    } else {
      const current = agents.find(a => a.id === editingId);
      nextAgentNumber = current ? current.agentNumber : 1;
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
      auditLogs: [newLog, ...pastLogs]
    };

    onSaveAgent(newAgent);
    resetForm();
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
    setShowForm(false);
  };

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
      
      {/* Table & controls bar */}
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t('agents.title')}</h2>
          <p className="text-xs text-slate-500 font-serif">{lang === 'ar' ? 'كشف حساب العملاء والموردين' : 'Client & supplier account statements - Auto agent ID incremental counting enabled'}</p>
        </div>
        <div className="flex gap-3 text-xs w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search Agent / Client Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg max-w-[200px] flex-grow focus:outline-none"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
          >
            <option value="All">All Types</option>
            <option value="Customer">Customers</option>
            <option value="Supplier">Suppliers</option>
            <option value="Both">Both (Cust & Supp)</option>
          </select>
          <button
            onClick={handleExportExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-3 py-2 rounded-xl transition border border-emerald-200 flex items-center gap-1 whitespace-nowrap"
            title="Export filtered agents to Excel"
          >
            ⬇️ Excel
          </button>
          <button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-xl transition shadow flex items-center gap-1 whitespace-nowrap"
          >
            {showForm ? 'View Directory' : 'Add New Agent'}
          </button>
        </div>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-slate-50 border border-slate-200/60 p-5 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {editingId ? 'Edit Agent Portfolio' : 'Register New Partner Agent'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Agent Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marseilia Tours"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Company Trade Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Marseilia Travel Group"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Domicile Country</label>
              <input
                type="text"
                list="countries"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Egypt"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Agent Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="Customer">Customer (Client / Tour Operator)</option>
                <option value="Supplier">Supplier (Hotel/Voucher Provider)</option>
                <option value="Both">Both Customer & Supplier</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Physical Office Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Opening Balance Adjusted (SAR)</label>
              <input
                type="number"
                value={openingBalance || ''}
                onChange={(e) => setOpeningBalance(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Credit Limit (SAR) <span className="text-slate-400 font-normal">Optional</span></label>
              <input
                type="number"
                value={creditLimit ?? ''}
                onChange={(e) => setCreditLimit(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="No limit"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Client Status</label>
              <select
                value={clientStatus}
                onChange={(e) => setClientStatus(e.target.value as any)}
                className={`w-full px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none ${
                  clientStatus === 'Suspended' ? 'border-amber-400 bg-amber-50' :
                  clientStatus === 'Blacklisted' ? 'border-red-400 bg-red-50' :
                  'border-slate-200'
                }`}
              >
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Blacklisted">Blacklisted</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition"
            >
              {editingId ? 'Modify Agent' : 'Create Agent'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-5 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {agents.filter(a => {
              const searchLower = searchQuery.toLowerCase();
              const matchesSearch = a.name.toLowerCase().includes(searchLower) || (a.companyName && a.companyName.toLowerCase().includes(searchLower)) || a.phone.includes(searchLower);
              if (filterType !== 'All' && a.type !== filterType) return false;
              return matchesSearch;
            }).map((agent) => {
              const bal = getAgentActualBalance(agent, reservations, transactions);
              return (
                <div key={agent.id} className="border border-slate-100 rounded-xl p-3 bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">ID#{agent.agentNumber}</span>
                      <h4 className="font-bold text-slate-900 text-xs mt-1">{agent.name}</h4>
                      <p className="text-[10px] text-slate-500">{agent.companyName || '-'}</p>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      agent.type === 'Customer' ? 'bg-indigo-50 text-indigo-700' :
                      agent.type === 'Supplier' ? 'bg-amber-50 text-amber-800' :
                      'bg-emerald-50 text-emerald-800'
                    }`}>{agent.type}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mb-2">
                    <span>{agent.country}</span>
                    <span className="font-mono">{agent.phone}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-50 pt-2">
                    <span className={`font-mono font-bold text-xs ${bal < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {bal < 0 ? `(${Math.abs(bal).toLocaleString()})` : bal.toLocaleString()} SAR
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => { setViewingAgent(agent); setActiveMenuId(null); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm">👁️</button>
                      <button onClick={() => handleEdit(agent)} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg text-sm">✏️</button>
                      <button onClick={() => { setAuditingAgent(agent); setActiveMenuId(null); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-sm">📋</button>
                      {agent.type !== 'Supplier' && (
                        <button onClick={() => setBulkPaymentAgent(agent)} className="min-h-[36px] bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 font-bold px-2 rounded-lg text-[10px] border border-emerald-100">Bulk Pay</button>
                      )}
                      <button onClick={() => { if (confirm('Delete this agent directory registry?')) onDeleteAgent(agent.id); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 hover:text-red-600 rounded-lg text-sm">🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold tracking-wider text-[10px] uppercase">
                <th className="py-3 px-3">Agent ID#</th>
                <th className="py-3 px-3">Name</th>
                <th className="py-3 px-3">Company Name</th>
                <th className="py-3 px-3">Country</th>
                <th className="py-3 px-3 text-center">Type</th>
                <th className="py-3 px-3 font-mono">Phone / Email</th>
                <th className="py-3 px-3 text-right">Actual Balance (SAR)</th>
                <th className="py-3 px-3 text-center">Credit Limit</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {agents.filter(a => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch = a.name.toLowerCase().includes(searchLower) || (a.companyName && a.companyName.toLowerCase().includes(searchLower)) || a.phone.includes(searchLower);
                if (filterType !== 'All' && a.type !== filterType) return false;
                return matchesSearch;
              }).map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50/40 text-xs">
                  <td className="py-3 px-3 font-bold font-mono text-slate-900 bg-amber-50/15">
                    {agent.agentNumber}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {agent.name}
                    {agent.clientStatus && agent.clientStatus !== 'Active' && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        agent.clientStatus === 'Suspended' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {agent.clientStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">{agent.companyName || '-'}</td>
                  <td className="py-3 px-3 font-medium">{agent.country}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      agent.type === 'Customer' ? 'bg-indigo-50 text-indigo-700' :
                      agent.type === 'Supplier' ? 'bg-amber-50 text-amber-800' :
                      'bg-emerald-50 text-emerald-800'
                    }`}>
                      {agent.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                    <div>{agent.phone}</div>
                    <div className="text-[10px] text-slate-400">{agent.email}</div>
                  </td>
                  <td className={`py-3 px-3 text-right font-mono font-bold ${getAgentActualBalance(agent, reservations, transactions) < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {getAgentActualBalance(agent, reservations, transactions) < 0 ? `(${Math.abs(getAgentActualBalance(agent, reservations, transactions)).toLocaleString()})` : getAgentActualBalance(agent, reservations, transactions).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {agent.creditLimit && agent.creditLimit > 0 ? (() => {
                      const actualBal = Math.abs(getAgentActualBalance(agent, reservations, transactions));
                      const pct = Math.min(100, (actualBal / agent.creditLimit) * 100);
                      const color = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                      return (
                        <div className="w-20 mx-auto">
                          <div className="text-[9px] font-bold text-slate-500 mb-0.5">{actualBal.toLocaleString()} / {agent.creditLimit.toLocaleString()}</div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className={`text-[8px] font-bold ${pct >= 100 ? 'text-rose-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })() : <span className="text-[10px] text-slate-400">—</span>}
                  </td>
                  <td className="py-3 px-3 text-center relative">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => {
                          setViewingAgent(agent);
                          setActiveMenuId(null);
                        }}
                        className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="View details"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleEdit(agent)}
                        className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-55/40 rounded"
                        title="Edit Details"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          setAuditingAgent(agent);
                          setActiveMenuId(null);
                        }}
                        className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                        title="Audit Log"
                      >
                        📋
                      </button>
                      
                      {/* Customer bulk downpayment feature */}
                      {agent.type !== 'Supplier' && (
                        <button
                          onClick={() => setBulkPaymentAgent(agent)}
                          className="bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 font-bold px-2 py-1 rounded text-[10px] border border-emerald-100 min-h-[28px]"
                          title="Auto distribute payment FIFO across unpaid reservations"
                        >
                          Bulk Pay
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (confirm('Delete this agent directory registry?')) onDeleteAgent(agent.id);
                        }}
                        className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-300 hover:text-red-650 rounded"
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Viewing details overlay */}
      {viewingAgent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4" onClick={() => setViewingAgent(null)}>
          <div className="bg-white rounded-none md:rounded-xl shadow-2xl max-w-md w-full p-4 md:p-6 max-h-[100dvh] md:max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2.5">Agent Specifications</h3>
            <div className="mt-4 space-y-2.5 text-xs text-slate-600">
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Agent ID Number:</span> {viewingAgent.agentNumber}</p>
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Legal Registered Name:</span> {viewingAgent.name}</p>
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Company Trade:</span> {viewingAgent.companyName || 'N/A'}</p>
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Domicile Country:</span> {viewingAgent.country}</p>
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Type Focus:</span> {viewingAgent.type}</p>
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Contact Office Line:</span> {viewingAgent.phone}</p>
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Email Inbox:</span> {viewingAgent.email}</p>
              <p><span className="font-bold text-slate-500 uppercase text-[9px] block">Headquarters:</span> {viewingAgent.address || 'N/A'}</p>
            </div>
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-3">
              <button onClick={() => setViewingAgent(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auditing logging details overlay */}
      {auditingAgent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4" onClick={() => setAuditingAgent(null)}>
          <div className="bg-white rounded-none md:rounded-xl shadow-2xl max-w-lg w-full p-4 md:p-6 max-h-[100dvh] md:max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2.5">Audit Security Logs — Agent ID# {auditingAgent.agentNumber}</h3>
            <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-1 no-scrollbar text-xs">
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
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-3">
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
