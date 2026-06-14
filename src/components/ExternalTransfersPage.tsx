import React, { useState, useMemo } from 'react';
import { ExternalTransfer, ExternalTransferPart, Transaction } from '../types';
import { useLang } from '../lib/LanguageContext';
import { showToast } from './Toast';

interface ExternalTransfersPageProps {
  externalTransfers: ExternalTransfer[];
  onSaveTransfer: (et: ExternalTransfer) => void;
  onDeleteTransfer: (id: string) => void;
  transactions?: Transaction[];
}

export default function ExternalTransfersPage({ externalTransfers, onSaveTransfer, onDeleteTransfer, transactions = [] }: ExternalTransfersPageProps) {
  const { t, lang } = useLang();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingRef, setBookingRef] = useState('');
  const [clientName, setClientName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [amountSAR, setAmountSAR] = useState<number>(0);
  const [parts, setParts] = useState<ExternalTransferPart[]>([]);
  const [totalAmountPaidEGP, setTotalAmountPaidEGP] = useState<number>(0);
  const [status, setStatus] = useState<'Pending' | 'Done'>('Pending');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'Pending' | 'Done'>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [viewingAttachment, setViewingAttachment] = useState<{url: string, label: string} | null>(null);
  const [linkingPart, setLinkingPart] = useState<{transferId: string, partIdx: number} | null>(null);

  // All already-linked transaction IDs across all transfers
  const linkedTxIds = useMemo(() => {
    const ids = new Set<string>();
    externalTransfers.forEach(et => et.parts.forEach(p => { if (p.linkedTransactionId) ids.add(p.linkedTransactionId); }));
    return ids;
  }, [externalTransfers]);

  // Find candidate transactions for linking
  const getMatchingTransactions = (part: ExternalTransferPart, etDate: string) => {
    return transactions
      .filter(tr => !linkedTxIds.has(tr.id) && tr.type === 'SupplierPayment' && Math.abs(tr.amount - part.amount) < 1)
      .sort((a, b) => {
        const da = Math.abs(new Date(a.date).getTime() - new Date(etDate).getTime());
        const db = Math.abs(new Date(b.date).getTime() - new Date(etDate).getTime());
        return da - db;
      })
      .slice(0, 10);
  };

  const handleLinkTransaction = (transferId: string, partIdx: number, txId: string) => {
    const et = externalTransfers.find(t => t.id === transferId);
    if (!et) return;
    const newParts = [...et.parts];
    newParts[partIdx] = { ...newParts[partIdx], linkedTransactionId: txId };
    onSaveTransfer({ ...et, parts: newParts });
    setLinkingPart(null);
    showToast('Payment linked successfully', 'success');
  };

  const handleUnlinkTransaction = (transferId: string, partIdx: number) => {
    const et = externalTransfers.find(t => t.id === transferId);
    if (!et) return;
    const newParts = [...et.parts];
    newParts[partIdx] = { ...newParts[partIdx], linkedTransactionId: undefined };
    onSaveTransfer({ ...et, parts: newParts });
    showToast('Payment unlinked', 'warning');
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setBookingRef('');
    setClientName('');
    setSupplierName('');
    setAmountSAR(0);
    setParts([]);
    setTotalAmountPaidEGP(0);
    setStatus('Pending');
    setEditingId(null);
    setShowForm(false);
  };

  const handleAddPart = () => {
    setParts([...parts, { amount: 0, fxRate: 0 }]);
  };

  const handleUpdatePart = (index: number, field: keyof ExternalTransferPart, value: any) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], [field]: value };
    setParts(newParts);
  };

  const handleRemovePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handleFileUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      handleUpdatePart(index, 'attachmentDataUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountSAR <= 0 || !bookingRef || !clientName || !supplierName) {
      showToast('Please fill out all required fields properly.', 'warning');
      return;
    }

    let calculatedEgp = 0;
    parts.forEach(p => {
      calculatedEgp += p.amount * (p.fxRate || 1);
    });
    
    // Fallback amount remaining EGP
    const amountRemainingEGP = calculatedEgp - totalAmountPaidEGP;

    const newTransfer: ExternalTransfer = {
      id: editingId || `et_${Date.now()}`,
      date,
      bookingRef,
      clientName,
      supplierName,
      amountSAR,
      parts,
      totalAmountPaidEGP,
      amountRemainingEGP,
      status
    };

    onSaveTransfer(newTransfer);
    resetForm();
  };

  const filteredTransfers = useMemo(() => {
    return externalTransfers.filter(et => {
      const term = searchTerm.toLowerCase();
      const searchMatch = !searchTerm || et.bookingRef.toLowerCase().includes(term) || et.clientName.toLowerCase().includes(term) || et.supplierName.toLowerCase().includes(term);
      const statusMatch = !filterStatus || et.status === filterStatus;
      const dateMatch = (!filterDateFrom || et.date >= filterDateFrom) && (!filterDateTo || et.date <= filterDateTo);
      const supplierMatch = !filterSupplier || et.supplierName.toLowerCase().includes(filterSupplier.toLowerCase());
      return searchMatch && statusMatch && dateMatch && supplierMatch;
    });
  }, [externalTransfers, searchTerm, filterStatus, filterDateFrom, filterDateTo, filterSupplier]);

  const uniqueSuppliers = useMemo(() => [...new Set(externalTransfers.map(et => et.supplierName).filter(Boolean))], [externalTransfers]);

  // Exchange rate stats
  const fxStats = useMemo(() => {
    const rates: number[] = [];
    externalTransfers.forEach(et => et.parts.forEach(p => { if (p.fxRate && p.fxRate > 0) rates.push(p.fxRate); }));
    if (rates.length === 0) return { min: 0, max: 0, avg: 0, count: 0, weightedAvg: 0 };
    let totalAmt = 0, totalEgp = 0;
    externalTransfers.forEach(et => et.parts.forEach(p => { totalAmt += (p.amount || 0); totalEgp += (p.amount || 0) * (p.fxRate || 0); }));
    const weightedAvg = totalAmt > 0 ? totalEgp / totalAmt : 0;
    return { min: Math.min(...rates), max: Math.max(...rates), avg: rates.reduce((a, b) => a + b, 0) / rates.length, count: rates.length, weightedAvg };
  }, [externalTransfers]);

  const clearFilters = () => { setSearchTerm(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterSupplier(''); };

  const handleEdit = (et: ExternalTransfer) => {
    setEditingId(et.id);
    setDate(et.date);
    setBookingRef(et.bookingRef);
    setClientName(et.clientName);
    setSupplierName(et.supplierName);
    setAmountSAR(et.amountSAR);
    setParts(et.parts || []);
    setTotalAmountPaidEGP(et.totalAmountPaidEGP || 0);
    setStatus(et.status || 'Pending');
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('extTrans.totalTransfers')}</div>
          <div className="text-2xl font-black text-slate-900">{externalTransfers.length}</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">{t('extTrans.pending')}</div>
          <div className="text-2xl font-black text-amber-800">{externalTransfers.filter(et => et.status === 'Pending').length}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">{t('extTrans.completed')}</div>
          <div className="text-2xl font-black text-emerald-800">{externalTransfers.filter(et => et.status === 'Done').length}</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1">{t('extTrans.totalSAR')}</div>
          <div className="text-xl font-black text-indigo-800">
            {externalTransfers.reduce((s, et) => s + et.amountSAR, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-blue-600 mb-1">{t('extTrans.avgFX')}</div>
          <div className="text-xl font-black text-blue-800">{fxStats.weightedAvg > 0 ? fxStats.weightedAvg.toFixed(4) : '—'}</div>
          <div className="text-[9px] text-blue-500 font-mono mt-0.5">{fxStats.count > 0 ? `W-Avg | Range: ${fxStats.min.toFixed(2)}–${fxStats.max.toFixed(2)}` : 'No data'}</div>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm card-hover-lift ${(() => { const officialEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + et.amountSAR, 0) * (fxStats.weightedAvg || 0); const actualEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + (et.totalAmountPaidEGP || 0), 0); return actualEgp >= officialEgp ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'; })()}`}>
          <div className={`text-[10px] uppercase font-bold mb-1 ${(() => { const officialEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + et.amountSAR, 0) * (fxStats.weightedAvg || 0); const actualEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + (et.totalAmountPaidEGP || 0), 0); return actualEgp >= officialEgp ? 'text-emerald-600' : 'text-rose-600'; })()}`}>Transfer P/L</div>
          <div className={`text-xl font-black ${(() => { const officialEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + et.amountSAR, 0) * (fxStats.weightedAvg || 0); const actualEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + (et.totalAmountPaidEGP || 0), 0); const diff = actualEgp - officialEgp; return diff >= 0 ? 'text-emerald-800' : 'text-rose-800'; })()}`}>
            {(() => { const officialEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + et.amountSAR, 0) * (fxStats.weightedAvg || 0); const actualEgp = externalTransfers.filter(et => et.status === 'Done').reduce((s, et) => s + (et.totalAmountPaidEGP || 0), 0); const diff = actualEgp - officialEgp; return `${diff >= 0 ? '+' : ''}${diff.toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP`; })()}
          </div>
          <div className="text-[9px] text-slate-500 font-mono mt-0.5">Actual vs Expected EGP</div>
        </div>
      </div>

      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm text-xs w-full max-w-[95vw] mx-auto overflow-x-hidden">
      <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t('extTrans.title')}</h2>
          <p className="text-xs text-slate-500 font-serif">{t('extTrans.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow"
        >
          {showForm ? t('common.cancel') : t('extTrans.newTransfer')}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg" required />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Booking #</label>
              <input type="text" value={bookingRef} onChange={e => setBookingRef(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg" placeholder="e.g. 660" required />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Client</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg" placeholder="Client Name" required />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Supplier</label>
              <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg" placeholder="Supplier Name" required />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Amount requested (SAR)</label>
              <input type="number" value={amountSAR || ''} onChange={e => setAmountSAR(Number(e.target.value))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-yellow-50 text-slate-900 font-bold" required />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Amount Paid (EGP)</label>
              <input type="number" value={totalAmountPaidEGP || ''} onChange={e => setTotalAmountPaidEGP(Number(e.target.value))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
                <option value="Pending">Pending</option>
                <option value="Done">Done</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-700">Transfer Parts</h3>
              <button type="button" onClick={handleAddPart} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded font-bold border border-indigo-200">
                + Add Part
              </button>
            </div>
            {parts.length === 0 ? (
              <p className="text-slate-400 italic">No parts added yet. Click "+ Add Part" to specify chunks.</p>
            ) : (
              <div className="space-y-3">
                {parts.map((p, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-700 text-xs">Transfer Part {idx + 1}</span>
                      <button type="button" onClick={() => handleRemovePart(idx)} className="text-red-500 text-lg hover:text-red-700 leading-none px-2 shrink-0">✕</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold">Amount (SAR)</label>
                        <input type="number" value={p.amount || ''} onChange={e => handleUpdatePart(idx, 'amount', Number(e.target.value))} className="w-full px-2 py-1 border rounded text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold">FX Rate</label>
                        <input type="number" step="0.01" value={p.fxRate || ''} onChange={e => handleUpdatePart(idx, 'fxRate', Number(e.target.value))} className="w-full px-2 py-1 border rounded text-xs" placeholder="Enter FX rate" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold">Date</label>
                        <input type="date" value={p.legDate || ''} onChange={e => handleUpdatePart(idx, 'legDate', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold">Bank Ref #</label>
                        <input type="text" value={p.bankRef || ''} onChange={e => handleUpdatePart(idx, 'bankRef', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" placeholder="Ref number" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold">Receiving Bank</label>
                        <input type="text" value={p.receivingBank || ''} onChange={e => handleUpdatePart(idx, 'receivingBank', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" placeholder="Bank name" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold">Notes</label>
                        <input type="text" value={p.notes || ''} onChange={e => handleUpdatePart(idx, 'notes', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" placeholder="Notes" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 font-bold">Attachment</label>
                        <input type="file" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && handleFileUpload(idx, e.target.files[0])} className="w-full px-2 py-1 border rounded text-xs" />
                        {p.attachmentDataUrl && <span className="text-[10px] text-emerald-600 font-bold mt-1 block">✅ Attached</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-lg">{t('extTrans.saveTransfer')}</button>
          </div>
        </form>
      ) : (
        <div className="overflow-x-auto pb-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <input type="text" placeholder="Search booking, client, supplier..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-48" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Done">Done</option>
            </select>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="From" />
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="To" />
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="">All Suppliers</option>
              {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(filterStatus || filterDateFrom || filterDateTo || filterSupplier || searchTerm) && (
              <button onClick={clearFilters} className="text-[10px] text-rose-600 font-bold hover:text-rose-700">✕ Clear</button>
            )}
            <span className="ml-auto text-[10px] text-slate-400 font-mono self-center">{filteredTransfers.length} transfers</span>
          </div>
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="py-2 px-2 font-bold text-slate-600">Date</th>
                <th className="py-2 px-2 font-bold text-slate-600">Booking #</th>
                <th className="py-2 px-2 font-bold text-slate-600">Client</th>
                <th className="py-2 px-2 font-bold text-slate-600">Supplier</th>
                <th className="py-2 px-2 font-bold text-slate-600 bg-yellow-50 text-center">Amount<br/>SAR</th>
                {[1,2,3,4,5].map(i => <th key={i} className="py-2 px-2 font-bold text-slate-500 text-center bg-blue-50/30">Trans {i}</th>)}
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Remaining<br/>Excess (SAR)</th>
                {[1,2,3,4,5].map(i => <th key={i} className="py-2 px-2 font-bold text-slate-500 text-center bg-amber-50/30">FX {i}</th>)}
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Total (EGP)</th>
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Amount Paid<br/>EGP</th>
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Remaining<br/>EGP</th>
                <th className="py-2 px-2 font-bold text-slate-600 text-center bg-emerald-50/30">P/L<br/>(EGP)</th>
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Status</th>
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers
                .map(et => {
                const totalTransferred = et.parts.reduce((sum, p) => sum + (p.amount || 0), 0);
                const remainingSAR = Math.abs(et.amountSAR - totalTransferred);
                const isExcess = totalTransferred > et.amountSAR;
                let totalEGP = 0;
                et.parts.forEach(p => totalEGP += (p.amount || 0) * (p.fxRate || 1));
                const remainingEGP = et.amountRemainingEGP ?? (totalEGP - (et.totalAmountPaidEGP || 0));

                return (
                  <tr key={et.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2">{et.date}</td>
                    <td className="py-2 px-2 font-bold">{et.bookingRef}</td>
                    <td className="py-2 px-2 text-indigo-700 font-semibold">{et.clientName}</td>
                    <td className="py-2 px-2 text-indigo-700 font-semibold">{et.supplierName}</td>
                    <td className="py-2 px-2 bg-yellow-50 text-slate-900 font-bold text-center">{et.amountSAR.toLocaleString()}</td>
                    
                    {/* Trans 1 to 5 */}
                    {[0,1,2,3,4].map(i => (
                      <td key={i} className={`py-2 px-2 text-center bg-blue-50/20 ${et.parts[i] ? 'bg-yellow-200 font-bold' : ''}`}>
                        {et.parts[i] ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{et.parts[i].amount.toLocaleString()}</span>
                            {et.parts[i].linkedTransactionId ? (
                              <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded cursor-pointer" title="Unlink payment" onClick={() => handleUnlinkTransaction(et.id, i)}>✓ Linked</span>
                            ) : (
                              <button
                                onClick={() => setLinkingPart(linkingPart?.partIdx === i && linkingPart?.transferId === et.id ? null : { transferId: et.id, partIdx: i })}
                                className="text-[8px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1 rounded"
                                title="Wire to payment"
                              >🔗 Link</button>
                            )}
                            {et.parts[i].attachmentDataUrl && (
                               <button onClick={() => setViewingAttachment({ url: et.parts[i].attachmentDataUrl!, label: `Transfer ${i + 1} - ${et.bookingRef}` })} className="text-[9px] text-blue-600 underline cursor-pointer">View</button>
                            )}
                            {/* Linking dropdown */}
                            {linkingPart?.transferId === et.id && linkingPart?.partIdx === i && (() => {
                              const matches = getMatchingTransactions(et.parts[i], et.date);
                              return matches.length > 0 ? (
                                <div className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-1 w-56 -mt-2 ml-12">
                                  <div className="text-[8px] font-bold text-slate-400 uppercase px-2 py-1">Match transactions</div>
                                  {matches.map(tr => (
                                    <button key={tr.id} onClick={() => handleLinkTransaction(et.id, i, tr.id)} className="w-full text-left px-2 py-1 text-[9px] hover:bg-indigo-50 rounded">
                                      {tr.docNo} · {tr.date} · {tr.amount.toLocaleString()} SAR
                                    </button>
                                  ))}
                                  <button onClick={() => setLinkingPart(null)} className="w-full text-center text-[8px] text-slate-400 hover:text-slate-600 py-1">Cancel</button>
                                </div>
                              ) : (
                                <div className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-2 w-48 -mt-2 ml-12 text-[9px] text-slate-500 text-center">
                                  No matching transactions found
                                  <button onClick={() => setLinkingPart(null)} className="block w-full text-center text-slate-400 mt-1">Close</button>
                                </div>
                              );
                            })()}
                          </div>
                        ) : ''}
                      </td>
                    ))}

                    <td className={`py-2 px-2 text-center font-bold ${remainingSAR === 0 ? 'text-slate-400' : (isExcess ? 'text-red-500' : 'text-slate-700')}`}>
                      {remainingSAR === 0 ? 0 : `SAR ${remainingSAR}`}
                    </td>

                    {/* FX 1 to 5 */}
                    {[0,1,2,3,4].map(i => (
                      <td key={i} className="py-2 px-2 text-center bg-amber-50/20 text-slate-500 font-mono">
                        {et.parts[i] ? et.parts[i].fxRate : ''}
                      </td>
                    ))}

                    <td className="py-2 px-2 text-center font-bold">EGP {totalEGP.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center text-emerald-700 font-bold">EGP {(et.totalAmountPaidEGP || 0).toLocaleString()}</td>
                    <td className={`py-2 px-2 text-center font-bold ${remainingEGP > 0 ? 'text-red-500' : 'text-slate-500'}`}>{remainingEGP > 0 ? `-EGP ${remainingEGP.toLocaleString()}` : `EGP 0`}</td>
                    <td className={`py-2 px-2 text-center font-bold text-[10px] ${(() => {
                      const wAvg = et.parts.length > 0 ? et.parts.reduce((s, p) => s + (p.amount || 0) * (p.fxRate || 0), 0) / Math.max(1, et.parts.reduce((s, p) => s + (p.amount || 0), 0)) : 0;
                      const expected = et.amountSAR * wAvg;
                      const actual = et.totalAmountPaidEGP || 0;
                      return actual >= expected ? 'text-emerald-700' : 'text-rose-600';
                    })()}`}>
                      {(() => {
                        const wAvg = et.parts.length > 0 ? et.parts.reduce((s, p) => s + (p.amount || 0) * (p.fxRate || 0), 0) / Math.max(1, et.parts.reduce((s, p) => s + (p.amount || 0), 0)) : 0;
                        const expected = et.amountSAR * wAvg;
                        const actual = et.totalAmountPaidEGP || 0;
                        const diff = actual - expected;
                        return et.status === 'Done' ? `${diff >= 0 ? '+' : ''}${diff.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';
                      })()}
                    </td>
                    <td className="py-2 px-2 text-center font-bold">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${et.status === 'Done' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {et.status === 'Done' ? '✓ ' : '⏳ '}{et.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => handleEdit(et)} className="text-blue-600 hover:text-blue-800 mr-2 font-bold">Edit</button>
                      <button onClick={() => confirm('Delete transfer request?') && onDeleteTransfer(et.id)} className="text-red-500 hover:text-red-700 font-bold">Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Attachment Viewer Modal */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-0 md:p-4" onClick={() => setViewingAttachment(null)}>
          <div className="bg-white rounded-none md:rounded-2xl shadow-2xl max-w-4xl max-h-[100dvh] md:max-h-[95dvh] w-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 truncate">{viewingAttachment.label}</h3>
              <div className="flex items-center gap-2">
                <a href={viewingAttachment.url} download className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg transition">⬇️ Download</a>
                <button onClick={() => setViewingAttachment(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold w-8 h-8 rounded-lg text-sm flex items-center justify-center transition">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100">
              {viewingAttachment.url.startsWith('data:image/') ? (
                <img src={viewingAttachment.url} alt={viewingAttachment.label} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow" />
              ) : viewingAttachment.url.startsWith('data:application/pdf') ? (
                <iframe src={viewingAttachment.url} className="w-full h-[80vh] border-0 rounded-lg" title={viewingAttachment.label} />
              ) : (
                <div className="text-center text-slate-500 py-10">
                  <p className="text-4xl mb-3">📎</p>
                  <p className="text-sm font-semibold">Preview not available for this file type.</p>
                  <a href={viewingAttachment.url} download className="mt-3 inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Download File</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
