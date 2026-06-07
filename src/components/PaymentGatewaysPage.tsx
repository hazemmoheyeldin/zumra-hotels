/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PaymentGateway, PayByLink, User } from '../types';
import { ZumraDB, ZumraSync, exportToCSV } from '../lib/storage';
import { showToast } from './Toast';

interface PaymentGatewaysPageProps {
  gateways: PaymentGateway[];
  setGateways: (list: PaymentGateway[]) => void;
  payByLinks: PayByLink[];
  setPayByLinks: (list: PayByLink[]) => void;
  currentUser: User;
  onLogAudit: (action: string, entityType: any, entityId: string, detail: string) => void;
}

type Tab = 'gateways' | 'payByLink';
type GatewayType = PaymentGateway['type'];

export default function PaymentGatewaysPage({
  gateways, setGateways, payByLinks, setPayByLinks, currentUser, onLogAudit,
}: PaymentGatewaysPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('gateways');

  // Gateway form
  const [gwForm, setGwForm] = useState<Partial<PaymentGateway>>({ type: 'Bank', active: true });
  const [gwEditingId, setGwEditingId] = useState<string | null>(null);
  const [gwShowForm, setGwShowForm] = useState(false);

  // Pay-by-link form
  const [plForm, setPlForm] = useState<Partial<PayByLink>>({ currency: 'SAR', status: 'Draft' });
  const [plEditingId, setPlEditingId] = useState<string | null>(null);
  const [plShowForm, setPlShowForm] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const isAdmin = currentUser.role === 'Admin';

  // ==================== Gateway CRUD ====================
  const handleSaveGateway = () => {
    if (!gwForm.name?.trim()) { showToast('Gateway name is required', 'error'); return; }
    const id = gwEditingId || `gw_${Date.now()}`;
    const entry: PaymentGateway = {
      id,
      name: gwForm.name?.trim() || '',
      type: (gwForm.type || 'Bank') as GatewayType,
      merchantId: gwForm.merchantId || '',
      apiKey: gwForm.apiKey || '',
      secretKey: gwForm.secretKey || '',
      webhookUrl: gwForm.webhookUrl || '',
      active: gwForm.active !== false,
    };
    let updated: PaymentGateway[];
    if (gwEditingId) {
      updated = gateways.map(g => g.id === gwEditingId ? entry : g);
      onLogAudit('Update', 'PaymentGateway', id, `Updated gateway: ${entry.name}`);
    } else {
      updated = [...gateways, entry];
      onLogAudit('Create', 'PaymentGateway', id, `Created gateway: ${entry.name}`);
    }
    setGateways(updated);
    ZumraDB.savePaymentGateways(updated);
    ZumraSync.savePaymentGateway(entry);
    resetGwForm();
    showToast(gwEditingId ? 'Gateway updated' : 'Gateway added');
  };

  const handleEditGw = (gw: PaymentGateway) => {
    setGwForm(gw);
    setGwEditingId(gw.id);
    setGwShowForm(true);
  };

  const handleDeleteGw = (gw: PaymentGateway) => {
    if (!confirm(`Delete gateway "${gw.name}"?`)) return;
    const updated = gateways.filter(g => g.id !== gw.id);
    setGateways(updated);
    ZumraDB.savePaymentGateways(updated);
    ZumraSync.deletePaymentGateway(gw.id);
    onLogAudit('Delete', 'PaymentGateway', gw.id, `Deleted gateway: ${gw.name}`);
    showToast('Gateway deleted');
  };

  const resetGwForm = () => {
    setGwForm({ type: 'Bank', active: true });
    setGwEditingId(null);
    setGwShowForm(false);
  };

  // ==================== Pay-by-Link CRUD ====================
  const handleSaveLink = () => {
    if (!plForm.gatewayId) { showToast('Select a gateway', 'error'); return; }
    if (!plForm.amount || plForm.amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }
    if (!plForm.description?.trim()) { showToast('Description is required', 'error'); return; }
    const id = plEditingId || `pl_${Date.now()}`;
    const entry: PayByLink = {
      id,
      gatewayId: plForm.gatewayId!,
      amount: plForm.amount || 0,
      currency: plForm.currency || 'SAR',
      description: plForm.description?.trim() || '',
      clientEmail: plForm.clientEmail || '',
      clientPhone: plForm.clientPhone || '',
      reservationId: plForm.reservationId || '',
      status: (plForm.status || 'Draft') as PayByLink['status'],
      expiresAt: plForm.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      createdAt: plEditingId ? (plForm.createdAt || new Date().toISOString()) : new Date().toISOString(),
      createdBy: plEditingId ? (plForm.createdBy || currentUser.name) : currentUser.name,
    };
    let updated: PayByLink[];
    if (plEditingId) {
      updated = payByLinks.map(l => l.id === plEditingId ? entry : l);
      onLogAudit('Update', 'PaymentGateway', id, `Updated pay link: ${entry.description}`);
    } else {
      updated = [...payByLinks, entry];
      onLogAudit('Create', 'PaymentGateway', id, `Created pay link: ${entry.description}`);
    }
    setPayByLinks(updated);
    ZumraDB.savePayByLinks(updated);
    ZumraSync.savePayByLink(entry);
    resetPlForm();
    showToast(plEditingId ? 'Link updated' : 'Link created');
  };

  const handleEditLink = (link: PayByLink) => {
    setPlForm(link);
    setPlEditingId(link.id);
    setPlShowForm(true);
  };

  const handleStatusChange = (link: PayByLink, newStatus: PayByLink['status']) => {
    const updated = payByLinks.map(l => l.id === link.id ? { ...l, status: newStatus } : l);
    setPayByLinks(updated);
    ZumraDB.savePayByLinks(updated);
    ZumraSync.savePayByLink({ ...link, status: newStatus });
    onLogAudit('Update', 'PaymentGateway', link.id, `Link status: ${newStatus}`);
    showToast(`Status: ${newStatus}`);
  };

  const handleCopyLink = (link: PayByLink) => {
    const mockUrl = `${window.location.origin}/pay/${link.id}`;
    navigator.clipboard.writeText(mockUrl).then(() => showToast('Link copied to clipboard'));
  };

  const resetPlForm = () => {
    setPlForm({ currency: 'SAR', status: 'Draft' });
    setPlEditingId(null);
    setPlShowForm(false);
  };

  // Filtered links
  const filteredLinks = useMemo(() => {
    return payByLinks.filter(l => {
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return l.description.toLowerCase().includes(q) || (l.clientEmail?.toLowerCase().includes(q)) || (l.clientPhone?.includes(q));
      }
      return true;
    });
  }, [payByLinks, search, statusFilter]);

  const handleExportLinks = () => {
    const rows = filteredLinks.map(l => {
      const gw = gateways.find(g => g.id === l.gatewayId);
      return {
        ID: l.id,
        Gateway: gw?.name || '',
        Amount: l.amount,
        Currency: l.currency,
        Description: l.description,
        Client: l.clientEmail || l.clientPhone || '',
        Status: l.status,
        Expires: l.expiresAt,
        Created: l.createdAt.slice(0, 10),
      };
    });
    exportToCSV('pay_by_links.csv', rows);
  };

  const getGatewayTypeIcon = (type: string): string => {
    switch (type) {
      case 'Bank': return '🏦';
      case 'Visa': return '💳';
      case 'Mada': return '🟢';
      case 'ApplePay': return '';
      default: return '💰';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Sent': return 'bg-blue-100 text-blue-800';
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Expired': return 'bg-orange-100 text-orange-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Gateways & Pay-by-Link</h1>
        <p className="text-sm text-gray-500">Configure payment gateways and create payment links</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('gateways')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'gateways' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          {isAdmin ? 'Gateways Config' : 'Gateways'}
        </button>
        <button onClick={() => setActiveTab('payByLink')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'payByLink' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          Pay-by-Link
        </button>
      </div>

      {/* ==================== GATEWAYS TAB ==================== */}
      {activeTab === 'gateways' && (
        <div className="space-y-4">
          {isAdmin && (
            <button onClick={() => { resetGwForm(); setGwShowForm(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              + Add Gateway
            </button>
          )}

          {gwShowForm && isAdmin && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">{gwEditingId ? 'Edit Gateway' : 'New Payment Gateway'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name *</label>
                  <input placeholder="Gateway name" value={gwForm.name || ''} onChange={e => setGwForm({ ...gwForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={gwForm.type || 'Bank'} onChange={e => setGwForm({ ...gwForm, type: e.target.value as GatewayType })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    {(['Bank', 'Visa', 'Mada', 'ApplePay'] as GatewayType[]).map(t => (
                      <option key={t} value={t}>{getGatewayTypeIcon(t)} {t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Merchant ID</label>
                  <input placeholder="Merchant ID" value={gwForm.merchantId || ''} onChange={e => setGwForm({ ...gwForm, merchantId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">API Key</label>
                  <input type="password" placeholder="API Key" value={gwForm.apiKey || ''} onChange={e => setGwForm({ ...gwForm, apiKey: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Secret Key</label>
                  <input type="password" placeholder="Secret Key" value={gwForm.secretKey || ''} onChange={e => setGwForm({ ...gwForm, secretKey: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Webhook URL</label>
                  <input placeholder="https://..." value={gwForm.webhookUrl || ''} onChange={e => setGwForm({ ...gwForm, webhookUrl: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm mt-4">
                  <input type="checkbox" checked={gwForm.active !== false} onChange={e => setGwForm({ ...gwForm, active: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveGateway} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">{gwEditingId ? 'Update' : 'Save'}</button>
                <button onClick={resetGwForm} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {/* Gateway Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gateways.length === 0 ? (
              <div className="col-span-full text-center py-10 text-gray-400">No payment gateways configured</div>
            ) : (
              gateways.map(gw => (
                <div key={gw.id} className={`border rounded-xl p-4 ${gw.active ? 'bg-white' : 'bg-gray-50 opacity-70'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{getGatewayTypeIcon(gw.type)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gw.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {gw.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900">{gw.name}</h4>
                  <p className="text-xs text-gray-500">{gw.type}</p>
                  {gw.merchantId && <p className="text-xs text-gray-400 mt-1">Merchant: {gw.merchantId.slice(0, 8)}...</p>}
                  <div className="flex gap-2 mt-3">
                    {isAdmin && (
                      <>
                        <button onClick={() => handleEditGw(gw)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                        <button onClick={() => handleDeleteGw(gw)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </>
                    )}
                    <button onClick={() => showToast('Connection test: UI only (not connected)', 'info')} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Test</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================== PAY-BY-LINK TAB ==================== */}
      {activeTab === 'payByLink' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => { resetPlForm(); setPlShowForm(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700" disabled={gateways.filter(g => g.active).length === 0}>
              + Create Payment Link
            </button>
            <button onClick={handleExportLinks} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
              Export CSV
            </button>
          </div>
          {gateways.filter(g => g.active).length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
              No active gateways. Configure and activate a gateway first.
            </p>
          )}

          {plShowForm && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">{plEditingId ? 'Edit Payment Link' : 'New Payment Link'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Gateway *</label>
                  <select value={plForm.gatewayId || ''} onChange={e => setPlForm({ ...plForm, gatewayId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="">Select gateway...</option>
                    {gateways.filter(g => g.active).map(g => <option key={g.id} value={g.id}>{getGatewayTypeIcon(g.type)} {g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount *</label>
                  <input type="number" min={0} step={0.01} value={plForm.amount || ''} onChange={e => setPlForm({ ...plForm, amount: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Currency</label>
                  <select value={plForm.currency || 'SAR'} onChange={e => setPlForm({ ...plForm, currency: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="SAR">SAR</option>
                    <option value="EGP">EGP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Description *</label>
                  <input placeholder="Payment description" value={plForm.description || ''} onChange={e => setPlForm({ ...plForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Client Email</label>
                  <input type="email" placeholder="client@email.com" value={plForm.clientEmail || ''} onChange={e => setPlForm({ ...plForm, clientEmail: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Client Phone</label>
                  <input placeholder="+966..." value={plForm.clientPhone || ''} onChange={e => setPlForm({ ...plForm, clientPhone: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Booking Ref (optional)</label>
                  <input placeholder="RSV-123" value={plForm.reservationId || ''} onChange={e => setPlForm({ ...plForm, reservationId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Expires</label>
                  <input type="date" value={plForm.expiresAt || ''} onChange={e => setPlForm({ ...plForm, expiresAt: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select value={plForm.status || 'Draft'} onChange={e => setPlForm({ ...plForm, status: e.target.value as PayByLink['status'] })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    {['Draft', 'Sent', 'Paid', 'Expired', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveLink} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">{plEditingId ? 'Update' : 'Create Link'}</button>
                <button onClick={resetPlForm} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white border rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="All">All Status</option>
              {['Draft', 'Sent', 'Paid', 'Expired', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Links Table */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Gateway</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Expires</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLinks.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No payment links found</td></tr>
                  ) : (
                    filteredLinks.map(link => {
                      const gw = gateways.find(g => g.id === link.gatewayId);
                      return (
                        <tr key={link.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1">
                              {gw ? getGatewayTypeIcon(gw.type) : '?'}
                              <span className="font-medium">{gw?.name || 'Unknown'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={link.description}>{link.description}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">{link.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {link.currency}</td>
                          <td className="px-4 py-3 text-gray-600">{link.clientEmail || link.clientPhone || '-'}</td>
                          <td className="px-4 py-3">
                            <select value={link.status} onChange={e => handleStatusChange(link, e.target.value as PayByLink['status'])} className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(link.status)}`}>
                              {['Draft', 'Sent', 'Paid', 'Expired', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{link.expiresAt}</td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <button onClick={() => handleCopyLink(link)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Copy Link</button>
                            <button onClick={() => handleEditLink(link)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Edit</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
