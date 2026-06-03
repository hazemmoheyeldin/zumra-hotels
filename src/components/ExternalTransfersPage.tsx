import React, { useState } from 'react';
import { ExternalTransfer, ExternalTransferPart } from '../types';

interface ExternalTransfersPageProps {
  externalTransfers: ExternalTransfer[];
  onSaveTransfer: (et: ExternalTransfer) => void;
  onDeleteTransfer: (id: string) => void;
}

export default function ExternalTransfersPage({ externalTransfers, onSaveTransfer, onDeleteTransfer }: ExternalTransfersPageProps) {
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
    setParts([...parts, { amount: 0, fxRate: 12.75 }]);
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
      alert('Please fill out all required fields properly.');
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
    <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm text-xs w-full max-w-[95vw] mx-auto overflow-x-hidden">
      <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">External Transfers Operations</h2>
          <p className="text-xs text-slate-500 font-serif">Track third-party transfer progress to suppliers abroad.</p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow"
        >
          {showForm ? 'Cancel' : '+ New Transfer Request'}
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
                  <div key={idx} className="flex flex-wrap items-end gap-3 p-3 bg-white border border-slate-200 rounded-lg relative">
                    <div className="w-24">
                      <label className="text-[10px] text-slate-500 font-bold">Trans {idx + 1}</label>
                      <input type="number" value={p.amount || ''} onChange={e => handleUpdatePart(idx, 'amount', Number(e.target.value))} className="w-full px-2 py-1 border rounded text-xs" />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] text-slate-500 font-bold">FX {idx + 1}</label>
                      <input type="number" step="0.01" value={p.fxRate || ''} onChange={e => handleUpdatePart(idx, 'fxRate', Number(e.target.value))} className="w-full px-2 py-1 border rounded text-xs" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[10px] text-slate-500 font-bold">Attachment Trace</label>
                      <input type="file" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && handleFileUpload(idx, e.target.files[0])} className="w-full px-2 py-1 border rounded text-xs" />
                      {p.attachmentDataUrl && <span className="text-[10px] text-emerald-600 font-bold mt-1 block">✅ Attached</span>}
                    </div>
                    <button type="button" onClick={() => handleRemovePart(idx)} className="text-red-500 text-lg hover:text-red-700 self-center leading-none px-2 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-lg">Save Transfer</button>
          </div>
        </form>
      ) : (
        <div className="overflow-x-auto pb-4">
          <input
            type="text"
            placeholder="Search booking, client, supplier..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-64 mb-4"
          />
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
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Status</th>
                <th className="py-2 px-2 font-bold text-slate-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {externalTransfers
                .filter(et => !searchTerm || et.bookingRef.includes(searchTerm) || et.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || et.supplierName.toLowerCase().includes(searchTerm.toLowerCase()))
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
                          <div className="flex flex-col items-center">
                            <span>{et.parts[i].amount.toLocaleString()}</span>
                            {et.parts[i].attachmentDataUrl && (
                               <a href={et.parts[i].attachmentDataUrl} target="_blank" rel="noreferrer" className="text-[9px] text-blue-600 underline">File</a>
                            )}
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
                    <td className="py-2 px-2 text-center font-bold">{et.status}</td>
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
    </div>
  );
}
