/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { OtherService, Agent, TaxSettings, ServiceType, User, Reservation, ConsolidatedInvoice } from '../types';
import { ZumraDB, ZumraSync, exportToCSV } from '../lib/storage';
import { showToast } from './Toast';
import ConsolidatedInvoiceBuilder from './ConsolidatedInvoiceBuilder';
import ConsolidatedInvoicePDF from './ConsolidatedInvoicePDF';

interface OtherServicesPageProps {
  otherServices: OtherService[];
  setOtherServices: (list: OtherService[]) => void;
  agents: Agent[];
  taxSettings: TaxSettings[];
  currentUser: User;
  onLogAudit: (action: string, entityType: any, entityId: string, detail: string) => void;
  reservations?: Reservation[];
  consolidatedInvoices?: ConsolidatedInvoice[];
  onSaveConsolidatedInvoice?: (ci: ConsolidatedInvoice) => void;
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  OutboundHotel: 'Outbound Hotel',
  Flight: 'Flight',
  Visa: 'Visa',
  Transportation: 'Transportation',
};

const SERVICE_ICONS: Record<ServiceType, string> = {
  OutboundHotel: '🏨',
  Flight: '✈️',
  Visa: '🛂',
  Transportation: '🚐',
};

export default function OtherServicesPage({
  otherServices, setOtherServices, agents, taxSettings, currentUser, onLogAudit,
  reservations = [], consolidatedInvoices = [], onSaveConsolidatedInvoice,
}: OtherServicesPageProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<OtherService | null>(null);
  const [showConsolidatedBuilder, setShowConsolidatedBuilder] = useState(false);
  const [viewConsolidatedInvoice, setViewConsolidatedInvoice] = useState<ConsolidatedInvoice | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<OtherService>>({
    serviceType: 'OutboundHotel',
    quantity: 1,
    status: 'Pending',
    taxRate: 15,
    details: {},
  });

  // Type-specific detail fields
  const detailFields: Record<ServiceType, { key: string; label: string; placeholder: string }[]> = {
    OutboundHotel: [
      { key: 'hotelName', label: 'Hotel Name', placeholder: 'Hotel name' },
      { key: 'city', label: 'City', placeholder: 'City' },
      { key: 'checkIn', label: 'Check-in', placeholder: 'YYYY-MM-DD' },
      { key: 'checkOut', label: 'Check-out', placeholder: 'YYYY-MM-DD' },
      { key: 'roomType', label: 'Room Type', placeholder: 'e.g. Double' },
    ],
    Flight: [
      { key: 'airline', label: 'Airline', placeholder: 'Airline name' },
      { key: 'route', label: 'Route', placeholder: 'e.g. CAI-JED' },
      { key: 'date', label: 'Departure Date', placeholder: 'YYYY-MM-DD' },
      { key: 'class', label: 'Class', placeholder: 'e.g. Economy' },
    ],
    Visa: [
      { key: 'visaType', label: 'Visa Type', placeholder: 'e.g. Tourist, Umrah' },
      { key: 'country', label: 'Country', placeholder: 'Destination country' },
      { key: 'processingTime', label: 'Processing Time', placeholder: 'e.g. 5 days' },
    ],
    Transportation: [
      { key: 'vehicleType', label: 'Vehicle Type', placeholder: 'e.g. Bus, Sedan' },
      { key: 'route', label: 'Route', placeholder: 'From - To' },
      { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD' },
    ],
  };

  const clients = useMemo(() => agents.filter(a => a.type === 'Customer' || a.type === 'Both'), [agents]);

  const filtered = useMemo(() => {
    return otherServices.filter(svc => {
      if (typeFilter !== 'All' && svc.serviceType !== typeFilter) return false;
      if (statusFilter !== 'All' && svc.status !== statusFilter) return false;
      if (dateFrom && svc.date < dateFrom) return false;
      if (dateTo && svc.date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const client = clients.find(a => a.id === svc.clientId);
        return (
          svc.description.toLowerCase().includes(q) ||
          (client?.name.toLowerCase().includes(q)) ||
          svc.invoiceNo?.toLowerCase().includes(q) ||
          SERVICE_LABELS[svc.serviceType].toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [otherServices, search, typeFilter, statusFilter, dateFrom, dateTo, clients]);

  const handleSave = () => {
    if (!form.clientId) { showToast('Client is required', 'error'); return; }
    if (!form.description?.trim()) { showToast('Description is required', 'error'); return; }
    if (!form.date) { showToast('Date is required', 'error'); return; }

    const id = editingId || `svc_${Date.now()}`;
    const defaultTax = taxSettings.find(t => t.active && t.appliesTo.includes(form.serviceType as ServiceType));
    const entry: OtherService = {
      id,
      serviceType: (form.serviceType || 'OutboundHotel') as ServiceType,
      clientId: form.clientId!,
      description: form.description?.trim() || '',
      quantity: form.quantity || 1,
      sellPrice: form.sellPrice || 0,
      buyPrice: form.buyPrice || 0,
      taxRate: form.taxRate ?? defaultTax?.rate ?? 15,
      date: form.date || new Date().toISOString().slice(0, 10),
      status: (form.status || 'Pending') as OtherService['status'],
      invoiceNo: form.invoiceNo || (editingId ? form.invoiceNo : `SVC-${Date.now().toString(36).toUpperCase()}`),
      notes: form.notes || '',
      createdBy: editingId ? (form.createdBy || currentUser.name) : currentUser.name,
      createdAt: editingId ? (form.createdAt || new Date().toISOString()) : new Date().toISOString(),
      details: form.details || {},
    };

    let updated: OtherService[];
    if (editingId) {
      updated = otherServices.map(s => s.id === editingId ? entry : s);
      onLogAudit('Update', 'OtherService', id, `Updated service: ${SERVICE_LABELS[entry.serviceType]} - ${entry.description}`);
    } else {
      updated = [...otherServices, entry];
      onLogAudit('Create', 'OtherService', id, `Created service: ${SERVICE_LABELS[entry.serviceType]} - ${entry.description}`);
    }
    setOtherServices(updated);
    ZumraDB.saveOtherServices(updated);
    ZumraSync.saveOtherService(entry);
    resetForm();
    showToast(editingId ? 'Service updated' : 'Service created');
  };

  const handleEdit = (svc: OtherService) => {
    setForm(svc);
    setEditingId(svc.id);
    setShowForm(true);
  };

  const handleDelete = (svc: OtherService) => {
    if (!confirm(`Delete this ${SERVICE_LABELS[svc.serviceType]} service?`)) return;
    const updated = otherServices.filter(s => s.id !== svc.id);
    setOtherServices(updated);
    ZumraDB.saveOtherServices(updated);
    ZumraSync.deleteOtherService(svc.id);
    onLogAudit('Delete', 'OtherService', svc.id, `Deleted service: ${SERVICE_LABELS[svc.serviceType]} - ${svc.description}`);
    showToast('Service deleted');
  };

  const handleStatusChange = (svc: OtherService, newStatus: OtherService['status']) => {
    const updated = otherServices.map(s => s.id === svc.id ? { ...s, status: newStatus } : s);
    setOtherServices(updated);
    ZumraDB.saveOtherServices(updated);
    ZumraSync.saveOtherService({ ...svc, status: newStatus });
    onLogAudit('Update', 'OtherService', svc.id, `Status changed to ${newStatus}`);
    showToast(`Status updated to ${newStatus}`);
  };

  const resetForm = () => {
    setForm({ serviceType: 'OutboundHotel', quantity: 1, status: 'Pending', taxRate: 15, details: {} });
    setEditingId(null);
    setShowForm(false);
  };

  const handleExport = () => {
    const rows = filtered.map(svc => {
      const client = clients.find(a => a.id === svc.clientId);
      return {
        Invoice: svc.invoiceNo || '',
        Type: SERVICE_LABELS[svc.serviceType],
        Date: svc.date,
        Client: client?.name || '',
        Description: svc.description,
        Quantity: svc.quantity,
        'Sell Price': svc.sellPrice,
        'Buy Price': svc.buyPrice,
        Profit: svc.sellPrice - svc.buyPrice,
        'Tax Rate': `${svc.taxRate}%`,
        Status: svc.status,
      };
    });
    exportToCSV(`other_services_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  // Totals
  const totals = useMemo(() => {
    let totalSell = 0, totalBuy = 0, totalTax = 0;
    filtered.forEach(svc => {
      totalSell += svc.sellPrice * svc.quantity;
      totalBuy += svc.buyPrice * svc.quantity;
      totalTax += (svc.sellPrice * svc.quantity * svc.taxRate) / 100;
    });
    return { totalSell, totalBuy, totalProfit: totalSell - totalBuy, totalTax };
  }, [filtered]);

  const handleServiceTypeChange = (type: ServiceType) => {
    const defaultTax = taxSettings.find(t => t.active && t.appliesTo.includes(type));
    setForm({ ...form, serviceType: type, taxRate: defaultTax?.rate ?? 15, details: {} });
  };

  const setDetail = (key: string, value: string) => {
    setForm({ ...form, details: { ...(form.details || {}), [key]: value } });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Other Services</h1>
          <p className="text-sm text-gray-500">Outbound hotels, flights, visas, and transportation</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            Export CSV
          </button>
          <button onClick={() => setShowConsolidatedBuilder(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            + Create Invoice
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + New Service
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium">Total Revenue</p>
          <p className="text-xl font-bold text-gray-900">{totals.totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium">Total Cost</p>
          <p className="text-xl font-bold text-gray-900">{totals.totalBuy.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium">Profit</p>
          <p className={`text-xl font-bold ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{totals.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium">Tax Collected</p>
          <p className="text-xl font-bold text-amber-600">{totals.totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="col-span-2 md:col-span-1 px-3 py-2 border rounded-lg text-sm" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="All">All Types</option>
          {(Object.keys(SERVICE_LABELS) as ServiceType[]).map(t => (
            <option key={t} value={t}>{SERVICE_LABELS[t]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="All">All Status</option>
          {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" placeholder="From" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" placeholder="To" />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-lg">{editingId ? 'Edit Service' : 'New Service'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Service Type *</label>
              <select value={form.serviceType || 'OutboundHotel'} onChange={e => handleServiceTypeChange(e.target.value as ServiceType)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" disabled={!!editingId}>
                {(Object.keys(SERVICE_LABELS) as ServiceType[]).map(t => (
                  <option key={t} value={t}>{SERVICE_ICONS[t]} {SERVICE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Client *</label>
              <select value={form.clientId || ''} onChange={e => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select client...</option>
                {clients.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date *</label>
              <input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <input placeholder="Service description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            {/* Type-specific fields */}
            {form.serviceType && detailFields[form.serviceType as ServiceType]?.map(field => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  placeholder={field.placeholder}
                  value={form.details?.[field.key] || ''}
                  onChange={e => setDetail(field.key, e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Quantity</label>
              <input type="number" min={1} value={form.quantity || 1} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sell Price (SAR)</label>
              <input type="number" min={0} step={0.01} value={form.sellPrice ?? 0} onChange={e => setForm({ ...form, sellPrice: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Buy Price (SAR)</label>
              <input type="number" min={0} step={0.01} value={form.buyPrice ?? 0} onChange={e => setForm({ ...form, buyPrice: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tax Rate (%)</label>
              <input type="number" min={0} max={100} step={0.5} value={form.taxRate ?? 15} onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={form.status || 'Pending'} onChange={e => setForm({ ...form, status: e.target.value as OtherService['status'] })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Invoice No</label>
              <input placeholder="Auto-generated" value={form.invoiceNo || ''} onChange={e => setForm({ ...form, invoiceNo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm resize-y" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              {editingId ? 'Update' : 'Create Service'}
            </button>
            <button onClick={resetForm} className="px-5 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Sell</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Buy</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Profit</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">No services found</td></tr>
              ) : (
                filtered.map(svc => {
                  const client = clients.find(a => a.id === svc.clientId);
                  const profit = (svc.sellPrice - svc.buyPrice) * svc.quantity;
                  return (
                    <tr key={svc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{svc.invoiceNo}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {SERVICE_ICONS[svc.serviceType]}
                          <span className="text-gray-700">{SERVICE_LABELS[svc.serviceType]}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{svc.date}</td>
                      <td className="px-4 py-3 font-medium">{client?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-600" title={svc.description}>{svc.description}</td>
                      <td className="px-4 py-3 text-right font-medium">{(svc.sellPrice * svc.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{(svc.buyPrice * svc.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className={`px-4 py-3 text-right font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={svc.status}
                          onChange={e => handleStatusChange(svc, e.target.value as OtherService['status'])}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${
                            svc.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            svc.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
                            svc.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button onClick={() => setViewInvoice(svc)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Invoice</button>
                        <button onClick={() => handleEdit(svc)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Edit</button>
                        <button onClick={() => handleDelete(svc)} className="text-red-500 hover:text-red-700 text-xs font-medium">Del</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewInvoice(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Service Invoice</h2>
              <button onClick={() => setViewInvoice(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div id="service-invoice" className="border rounded-lg p-4 space-y-3">
              <div className="text-center border-b pb-3">
                <h3 className="font-bold text-xl text-gray-900">ZUMRA HOTELS</h3>
                <p className="text-xs text-gray-500">Service Invoice</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Invoice #:</span> <span className="font-medium">{viewInvoice.invoiceNo}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewInvoice.date}</span></div>
                <div><span className="text-gray-500">Client:</span> <span className="font-medium">{clients.find(a => a.id === viewInvoice.clientId)?.name}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="font-medium">{SERVICE_LABELS[viewInvoice.serviceType]}</span></div>
              </div>
              <div className="border-t pt-3 text-sm">
                <p className="font-medium">{viewInvoice.description}</p>
                {viewInvoice.details && Object.entries(viewInvoice.details).filter(([,v]) => v).map(([k, v]) => (
                  <p key={k} className="text-gray-500"><span className="capitalize">{k}:</span> {v}</p>
                ))}
              </div>
              <div className="border-t pt-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Quantity:</span><span>{viewInvoice.quantity}</span></div>
                <div className="flex justify-between"><span>Unit Price:</span><span>{viewInvoice.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</span></div>
                <div className="flex justify-between font-medium"><span>Subtotal:</span><span>{(viewInvoice.sellPrice * viewInvoice.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</span></div>
                <div className="flex justify-between text-amber-600"><span>VAT ({viewInvoice.taxRate}%):</span><span>{((viewInvoice.sellPrice * viewInvoice.quantity * viewInvoice.taxRate) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total:</span><span>{(viewInvoice.sellPrice * viewInvoice.quantity * (1 + viewInvoice.taxRate / 100)).toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</span></div>
              </div>
              {viewInvoice.notes && <div className="border-t pt-3 text-xs text-gray-500"><strong>Notes:</strong> {viewInvoice.notes}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Print</button>
              <button onClick={() => setViewInvoice(null)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Invoices List */}
      {consolidatedInvoices.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Consolidated Invoices ({consolidatedInvoices.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-purple-50 border-b border-purple-100">
                  <th className="px-3 py-2 text-left font-bold">Invoice #</th>
                  <th className="px-3 py-2 text-left font-bold">Client</th>
                  <th className="px-3 py-2 text-center font-bold">Items</th>
                  <th className="px-3 py-2 text-right font-bold">Total (SAR)</th>
                  <th className="px-3 py-2 text-center font-bold">Currency</th>
                  <th className="px-3 py-2 text-left font-bold">Date</th>
                  <th className="px-3 py-2 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedInvoices.slice().reverse().map(ci => {
                  const client = agents.find(a => a.id === ci.clientId);
                  return (
                    <tr key={ci.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-bold text-purple-700">{ci.invoiceNo}</td>
                      <td className="px-3 py-2">{client?.companyName || client?.name || 'N/A'}</td>
                      <td className="px-3 py-2 text-center">{ci.items.length}</td>
                      <td className="px-3 py-2 text-right font-bold">{ci.totalWithVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ci.currency === 'SAR' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ci.currency}</span></td>
                      <td className="px-3 py-2 text-gray-500">{ci.createdAt.split('T')[0]}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setViewConsolidatedInvoice(ci)} className="text-purple-600 hover:text-purple-800 font-medium">View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consolidated Invoice Builder Modal */}
      {showConsolidatedBuilder && (
        <ConsolidatedInvoiceBuilder
          agents={agents}
          otherServices={otherServices}
          reservations={reservations}
          currentUser={currentUser}
          onSave={(ci) => {
            onSaveConsolidatedInvoice?.(ci);
            setShowConsolidatedBuilder(false);
          }}
          onClose={() => setShowConsolidatedBuilder(false)}
        />
      )}

      {/* Consolidated Invoice PDF Modal */}
      {viewConsolidatedInvoice && (
        <ConsolidatedInvoicePDF
          invoice={viewConsolidatedInvoice}
          client={agents.find(a => a.id === viewConsolidatedInvoice.clientId)}
          onClose={() => setViewConsolidatedInvoice(null)}
        />
      )}
    </div>
  );
}
