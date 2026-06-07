/**
 * ConsolidatedInvoiceBuilder - Build multi-service invoices for a client.
 * Combines OtherService items (flights, visas, transport, outbound hotels)
 * and hotel Reservations into one consolidated invoice with SAR/EGP currency.
 */

import React, { useState, useMemo } from 'react';
import { Agent, OtherService, Reservation, ConsolidatedInvoice, ConsolidatedInvoiceItem, StampPosition, User } from '../types';
import { getReservationTotals } from '../lib/storage';
import { getStampSettings } from './StampOverlay';
import { showToast } from './Toast';

const SERVICE_ICONS: Record<string, string> = {
  OutboundHotel: '🏨',
  Flight: '✈️',
  Visa: '🛂',
  Transportation: '🚐',
  Reservation: '🏩',
};

interface ConsolidatedInvoiceBuilderProps {
  agents: Agent[];
  otherServices: OtherService[];
  reservations: Reservation[];
  consolidatedInvoices: ConsolidatedInvoice[];
  currentUser: User;
  onSave: (invoice: ConsolidatedInvoice) => void;
  onClose: () => void;
}

export default function ConsolidatedInvoiceBuilder({
  agents, otherServices, reservations, consolidatedInvoices, currentUser, onSave, onClose,
}: ConsolidatedInvoiceBuilderProps) {
  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState<'SAR' | 'EGP'>('SAR');
  const [exchangeRate, setExchangeRate] = useState(13.5);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [stampPosition, setStampPosition] = useState<StampPosition>(getStampSettings().position || 'bottom-right');
  const [showStamp, setShowStamp] = useState(getStampSettings().enabled);

  const clients = useMemo(() => agents.filter(a => a.type === 'Customer' || a.type === 'Both'), [agents]);

  // Available services for selected client
  const clientServices = useMemo(() => {
    if (!clientId) return [];
    return otherServices.filter(s => s.clientId === clientId && s.status !== 'Cancelled');
  }, [otherServices, clientId]);

  // Available reservations for selected client
  const clientReservations = useMemo(() => {
    if (!clientId) return [];
    return reservations.filter(r => r.clientId === clientId && r.status !== 'Cancelled');
  }, [reservations, clientId]);

  // Build invoice items from selections
  const items: ConsolidatedInvoiceItem[] = useMemo(() => {
    const result: ConsolidatedInvoiceItem[] = [];

    // Add selected other services
    clientServices.forEach(svc => {
      if (selectedServiceIds.has(svc.id)) {
        const total = svc.sellPrice * svc.quantity;
        result.push({
          type: 'OtherService',
          refId: svc.id,
          description: `${SERVICE_ICONS[svc.serviceType] || ''} ${svc.description}`,
          quantity: svc.quantity,
          unitPrice: svc.sellPrice,
          taxRate: svc.taxRate,
          total,
        });
      }
    });

    // Add selected reservations
    clientReservations.forEach(res => {
      if (selectedReservationIds.has(String(res.id))) {
        const totals = getReservationTotals(res);
        result.push({
          type: 'Reservation',
          refId: String(res.id),
          description: `🏩 RSV-${res.id} | ${res.guestName} | ${res.checkIn} to ${res.checkOut}`,
          quantity: 1,
          unitPrice: totals.totalSell,
          taxRate: totals.vat > 0 ? 15 : 0,
          total: totals.totalSell,
        });
      }
    });

    return result;
  }, [clientServices, clientReservations, selectedServiceIds, selectedReservationIds]);

  // Calculate totals
  const subtotal = items.reduce((sum, it) => sum + it.total, 0);
  const vatAmount = items.reduce((sum, it) => sum + (it.total * it.taxRate / 100), 0);
  const totalWithVat = subtotal + vatAmount;

  // Currency conversion
  const displayTotal = currency === 'EGP' ? totalWithVat * exchangeRate : totalWithVat;
  const displayVat = currency === 'EGP' ? vatAmount * exchangeRate : vatAmount;
  const displaySubtotal = currency === 'EGP' ? subtotal * exchangeRate : subtotal;

  const toggleService = (id: string) => {
    const next = new Set(selectedServiceIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedServiceIds(next);
  };

  const toggleReservation = (id: string) => {
    const next = new Set(selectedReservationIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedReservationIds(next);
  };

  const selectAllServices = () => {
    setSelectedServiceIds(new Set(clientServices.map(s => s.id)));
  };

  const selectAllReservations = () => {
    setSelectedReservationIds(new Set(clientReservations.map(r => String(r.id))));
  };

  const handleSave = () => {
    if (!clientId) { showToast('Please select a client', 'error'); return; }
    if (items.length === 0) { showToast('Please select at least one service or reservation', 'error'); return; }

    const invoice: ConsolidatedInvoice = {
      id: `cinv_${Date.now()}`,
      invoiceNo: `CINV-${String(consolidatedInvoices.length + 1).padStart(3, '0')}`,
      clientId,
      items,
      currency,
      exchangeRate,
      subtotal,
      vatAmount,
      totalWithVat,
      notes: notes || undefined,
      stampPosition,
      showStamp,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    onSave(invoice);
    showToast('Consolidated invoice created');
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Create Consolidated Invoice</h2>
            <p className="text-xs text-slate-500">Combine multiple services into one invoice</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Row 1: Client + Currency */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client *</label>
              <select value={clientId} onChange={e => { setClientId(e.target.value); setSelectedServiceIds(new Set()); setSelectedReservationIds(new Set()); }} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select client...</option>
                {clients.map(a => <option key={a.id} value={a.id}>{a.companyName || a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Currency</label>
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => setCurrency('SAR')} className={`flex-1 py-2 text-sm font-bold ${currency === 'SAR' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>SAR</button>
                <button onClick={() => setCurrency('EGP')} className={`flex-1 py-2 text-sm font-bold ${currency === 'EGP' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>EGP</button>
              </div>
            </div>
            {currency === 'EGP' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Exchange Rate (1 SAR = ? EGP)</label>
                <input type="number" step="0.01" min="0.01" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value) || 13.5)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            )}
          </div>

          {/* Stamp Controls */}
          <div className="bg-slate-50 border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">Company Stamp</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showStamp} onChange={e => setShowStamp(e.target.checked)} className="rounded" />
                <span className="text-sm text-slate-600">Show stamp</span>
              </label>
            </div>
            {showStamp && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['bottom-right', 'bottom-left', 'bottom-center', 'top-right'] as StampPosition[]).map(pos => (
                  <button
                    key={pos}
                    onClick={() => setStampPosition(pos)}
                    className={`relative h-16 border-2 rounded-lg text-[10px] font-bold uppercase transition ${stampPosition === pos ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                  >
                    <div className={`absolute w-4 h-4 rounded-full bg-emerald-300 ${pos === 'bottom-right' ? 'bottom-1 right-1' : pos === 'bottom-left' ? 'bottom-1 left-1' : pos === 'bottom-center' ? 'bottom-1 left-1/2 -translate-x-1/2' : 'top-1 right-1'}`} />
                    <span className="relative z-10">{pos.replace('-', ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Service Selection */}
          {clientId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Other Services */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-indigo-50 px-4 py-3 flex items-center justify-between border-b border-indigo-100">
                  <h3 className="text-sm font-bold text-indigo-800">Other Services ({clientServices.length})</h3>
                  {clientServices.length > 0 && (
                    <button onClick={selectAllServices} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Select All</button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {clientServices.length === 0 ? (
                    <p className="p-4 text-sm text-slate-400 text-center">No services for this client</p>
                  ) : (
                    clientServices.map(svc => (
                      <label key={svc.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${selectedServiceIds.has(svc.id) ? 'bg-indigo-50' : ''}`}>
                        <input type="checkbox" checked={selectedServiceIds.has(svc.id)} onChange={() => toggleService(svc.id)} className="rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">{SERVICE_ICONS[svc.serviceType]} {svc.description}</div>
                          <div className="text-[10px] text-slate-500">{svc.serviceType} | Qty: {svc.quantity} | {fmt(svc.sellPrice * svc.quantity)} SAR</div>
                        </div>
                        <span className="text-xs font-bold text-slate-700">{fmt(svc.sellPrice * svc.quantity)}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Reservations */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-4 py-3 flex items-center justify-between border-b border-amber-100">
                  <h3 className="text-sm font-bold text-amber-800">Hotel Reservations ({clientReservations.length})</h3>
                  {clientReservations.length > 0 && (
                    <button onClick={selectAllReservations} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Select All</button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {clientReservations.length === 0 ? (
                    <p className="p-4 text-sm text-slate-400 text-center">No reservations for this client</p>
                  ) : (
                    clientReservations.map(res => {
                      const totals = getReservationTotals(res);
                      return (
                        <label key={res.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${selectedReservationIds.has(String(res.id)) ? 'bg-amber-50' : ''}`}>
                          <input type="checkbox" checked={selectedReservationIds.has(String(res.id))} onChange={() => toggleReservation(String(res.id))} className="rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">RSV-{res.id} | {res.guestName}</div>
                            <div className="text-[10px] text-slate-500">{res.checkIn} to {res.checkOut} | {res.status}</div>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{fmt(totals.totalSell)}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional notes for this invoice..." className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
          </div>

          {/* Preview Totals */}
          {items.length > 0 && (
            <div className="bg-slate-800 text-white rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-slate-300">Invoice Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Items</p>
                  <p className="text-xl font-bold">{items.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Subtotal</p>
                  <p className="text-xl font-bold">{fmt(displaySubtotal)} {currency}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">VAT</p>
                  <p className="text-xl font-bold text-amber-400">{fmt(displayVat)} {currency}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Total</p>
                  <p className="text-xl font-bold text-emerald-400">{fmt(displayTotal)} {currency}</p>
                </div>
              </div>
              {currency === 'EGP' && (
                <p className="text-[10px] text-slate-400 mt-2">Original: {fmt(totalWithVat)} SAR | Rate: 1 SAR = {exchangeRate} EGP</p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300">Cancel</button>
          <button onClick={handleSave} disabled={items.length === 0} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
            Create Invoice & Open PDF
          </button>
        </div>
      </div>
    </div>
  );
}
