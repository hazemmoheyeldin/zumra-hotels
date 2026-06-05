/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Transaction, RefundAlert } from '../types';
import { getReservationTotals } from '../lib/storage';

interface CancellationWizardProps {
  reservation: Reservation;
  agents: Agent[];
  currentUser: string;
  onConfirm: (result: CancellationResult) => void;
  onClose: () => void;
}

export interface CancellationResult {
  clientDisposition: 'Refunded' | 'Kept as Credit' | 'N/A';
  supplierDisposition: 'Refunded' | 'Kept as Credit' | 'N/A';
  clientNote: string;
  supplierNote: string;
  cancellationReason: string;
  cancellationFee: number;
  transactions: Transaction[];
  refundAlerts: RefundAlert[];
  walletUpdates: { agentId: string; delta: number }[];
}

type FundOption = 'Refunded' | 'Kept as Credit' | 'N/A';

export default function CancellationWizard({ reservation, agents, currentUser, onConfirm, onClose }: CancellationWizardProps) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState('');
  const [fee, setFee] = useState(0);
  const [clientDisp, setClientDisp] = useState<FundOption>('N/A');
  const [supplierDisp, setSupplierDisp] = useState<FundOption>('N/A');
  const [clientNote, setClientNote] = useState('');
  const [supplierNote, setSupplierNote] = useState('');

  const totals = getReservationTotals(reservation);
  const client = agents.find(a => a.id === reservation.clientId);
  const supplier = agents.find(a => a.id === reservation.supplierId);
  const clientPaid = reservation.amountPaidByClient || 0;
  const supplierPaid = reservation.amountPaidToSupplier || 0;

  const buildResult = (): CancellationResult => {
    const transactions: Transaction[] = [];
    const refundAlerts: RefundAlert[] = [];
    const walletUpdates: { agentId: string; delta: number }[] = [];
    const now = new Date().toISOString();

    // Client side
    if (clientDisp === 'Kept as Credit' && clientPaid > 0) {
      walletUpdates.push({ agentId: reservation.clientId, delta: clientPaid });
      transactions.push({
        id: `tr_cancel_client_${Date.now()}`,
        docNo: `CRED-C-${reservation.id}`,
        date: now.split('T')[0],
        type: 'CreditApplied',
        amount: clientPaid,
        agentId: reservation.clientId,
        reservationId: reservation.id.toString(),
        description: `Credit from cancellation of RSV-${reservation.id} (${reservation.guestName})`,
        paymentMethod: 'Bank Transfer',
        voucherNo: `CRED-${Date.now()}`,
        createdBy: currentUser,
      });
    } else if (clientDisp === 'Refunded' && clientPaid > 0) {
      refundAlerts.push({
        id: `refund_client_${Date.now()}`,
        bookingId: reservation.id,
        amount: clientPaid,
        party: 'Client',
        partyId: reservation.clientId,
        status: 'Pending',
        createdAt: now,
        note: clientNote || undefined,
      });
    }

    // Supplier side
    if (supplierDisp === 'Kept as Credit' && supplierPaid > 0) {
      walletUpdates.push({ agentId: reservation.supplierId, delta: supplierPaid });
      transactions.push({
        id: `tr_cancel_supp_${Date.now()}`,
        docNo: `CRED-S-${reservation.id}`,
        date: now.split('T')[0],
        type: 'CreditApplied',
        amount: supplierPaid,
        agentId: reservation.supplierId,
        reservationId: reservation.id.toString(),
        description: `Credit from cancellation of RSV-${reservation.id} (${reservation.guestName})`,
        paymentMethod: 'Bank Transfer',
        voucherNo: `CRED-${Date.now() + 1}`,
        createdBy: currentUser,
      });
    } else if (supplierDisp === 'Refunded' && supplierPaid > 0) {
      refundAlerts.push({
        id: `refund_supp_${Date.now()}`,
        bookingId: reservation.id,
        amount: supplierPaid,
        party: 'Supplier',
        partyId: reservation.supplierId,
        status: 'Pending',
        createdAt: now,
        note: supplierNote || undefined,
      });
    }

    return {
      clientDisposition: clientDisp,
      supplierDisposition: supplierDisp,
      clientNote,
      supplierNote,
      cancellationReason: reason,
      cancellationFee: fee,
      transactions,
      refundAlerts,
      walletUpdates,
    };
  };

  const handleConfirm = () => {
    onConfirm(buildResult());
  };

  const steps = [
    // Step 0: Booking Summary
    () => (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Booking Summary</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="text-slate-500">RSV #:</span> <span className="font-bold text-slate-800">{reservation.id}</span></div>
          <div><span className="text-slate-500">Guest:</span> <span className="font-bold text-slate-800">{reservation.guestName}</span></div>
          <div><span className="text-slate-500">Check-In:</span> <span className="font-bold">{reservation.checkIn}</span></div>
          <div><span className="text-slate-500">Check-Out:</span> <span className="font-bold">{reservation.checkOut}</span></div>
          <div><span className="text-slate-500">Client:</span> <span className="font-bold">{client?.name || 'N/A'}</span></div>
          <div><span className="text-slate-500">Supplier:</span> <span className="font-bold">{supplier?.name || 'N/A'}</span></div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-3 text-xs border border-slate-100">
          <div className="text-center">
            <div className="text-[9px] uppercase font-bold text-slate-400">Total Sell</div>
            <div className="text-lg font-black text-emerald-700 font-mono">{totals.totalSell.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase font-bold text-slate-400">Total Buy</div>
            <div className="text-lg font-black text-amber-700 font-mono">{totals.totalBuy.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase font-bold text-slate-400">Profit</div>
            <div className={`text-lg font-black font-mono ${totals.profit >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{totals.profit.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-xs border border-amber-100">
          <div className="text-center">
            <div className="text-[9px] uppercase font-bold text-amber-600">Client Paid</div>
            <div className="text-base font-black text-amber-800 font-mono">{clientPaid.toLocaleString()} SAR</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase font-bold text-amber-600">Supplier Paid</div>
            <div className="text-base font-black text-amber-800 font-mono">{supplierPaid.toLocaleString()} SAR</div>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Cancellation Reason</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer requested cancellation" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Cancellation Fee (SAR)</label>
          <input type="number" value={fee || ''} onChange={e => setFee(Number(e.target.value))} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono" />
        </div>
      </div>
    ),
    // Step 1: Client Funds
    () => (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">How to handle CLIENT funds?</h3>
        <p className="text-xs text-slate-500">Client: <span className="font-bold text-slate-800">{client?.name || 'N/A'}</span> — Paid: <span className="font-bold text-emerald-700">{clientPaid.toLocaleString()} SAR</span></p>
        {clientPaid === 0 && <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-2 rounded-lg">No payment was recorded for this client.</p>}
        <div className="space-y-2">
          {(['Refunded', 'Kept as Credit', 'N/A'] as FundOption[]).map(opt => (
            <button key={opt} onClick={() => setClientDisp(opt)} className={`w-full text-left p-3 rounded-xl border-2 transition text-xs font-bold ${clientDisp === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'}`}>
              {opt === 'Refunded' ? '💸 Refund to Bank' : opt === 'Kept as Credit' ? '🏦 Keep as Credit (Wallet)' : '⊘ N/A — No payment was made'}
              <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                {opt === 'Refunded' ? 'Creates a pending refund alert to process later' : opt === 'Kept as Credit' ? `Adds ${clientPaid.toLocaleString()} SAR to client wallet balance` : 'No financial action needed'}
              </span>
            </button>
          ))}
        </div>
        {clientDisp === 'Refunded' && (
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Refund Note</label>
            <input type="text" value={clientNote} onChange={e => setClientNote(e.target.value)} placeholder="Optional note about the refund" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" />
          </div>
        )}
      </div>
    ),
    // Step 2: Supplier Funds
    () => (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">How to handle SUPPLIER funds?</h3>
        <p className="text-xs text-slate-500">Supplier: <span className="font-bold text-slate-800">{supplier?.name || 'N/A'}</span> — Paid: <span className="font-bold text-amber-700">{supplierPaid.toLocaleString()} SAR</span></p>
        {supplierPaid === 0 && <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-2 rounded-lg">No payment was recorded for this supplier.</p>}
        <div className="space-y-2">
          {(['Refunded', 'Kept as Credit', 'N/A'] as FundOption[]).map(opt => (
            <button key={opt} onClick={() => setSupplierDisp(opt)} className={`w-full text-left p-3 rounded-xl border-2 transition text-xs font-bold ${supplierDisp === opt ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'}`}>
              {opt === 'Refunded' ? '💸 Refund from Supplier' : opt === 'Kept as Credit' ? '🏦 Keep as Credit (Wallet)' : '⊘ N/A — No payment was made'}
              <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                {opt === 'Refunded' ? 'Creates a pending refund alert to recover from supplier' : opt === 'Kept as Credit' ? `Adds ${supplierPaid.toLocaleString()} SAR to supplier wallet balance` : 'No financial action needed'}
              </span>
            </button>
          ))}
        </div>
        {supplierDisp === 'Refunded' && (
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Refund Note</label>
            <input type="text" value={supplierNote} onChange={e => setSupplierNote(e.target.value)} placeholder="Optional note about the refund" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" />
          </div>
        )}
      </div>
    ),
    // Step 3: Review & Confirm
    () => (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Review & Confirm Cancellation</h3>
        <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">RSV-{reservation.id}:</span> <span className="font-bold">{reservation.guestName}</span></div>
            <div><span className="text-slate-500">Reason:</span> <span className="font-bold">{reason || 'Not specified'}</span></div>
            <div><span className="text-slate-500">Fee:</span> <span className="font-bold font-mono">{fee.toLocaleString()} SAR</span></div>
            <div><span className="text-slate-500">Profit Lost:</span> <span className="font-bold font-mono text-rose-600">{totals.profit.toLocaleString()} SAR</span></div>
          </div>
          <hr className="border-rose-200" />
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-2 border border-rose-100">
              <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Client ({client?.name})</div>
              <div className="font-bold text-slate-800">{clientDisp}</div>
              {clientDisp !== 'N/A' && <div className="font-mono text-emerald-700 text-[10px]">{clientPaid.toLocaleString()} SAR</div>}
              {clientNote && <div className="text-[10px] text-slate-400 mt-0.5">{clientNote}</div>}
            </div>
            <div className="bg-white rounded-lg p-2 border border-rose-100">
              <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Supplier ({supplier?.name})</div>
              <div className="font-bold text-slate-800">{supplierDisp}</div>
              {supplierDisp !== 'N/A' && <div className="font-mono text-amber-700 text-[10px]">{supplierPaid.toLocaleString()} SAR</div>}
              {supplierNote && <div className="text-[10px] text-slate-400 mt-0.5">{supplierNote}</div>}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-rose-600 font-semibold">This action will cancel the booking and process the financial dispositions as shown above.</p>
      </div>
    ),
  ];

  const canNext = () => {
    if (step === 0) return reason.trim().length > 0;
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-sm font-bold text-rose-700">Cancellation Wizard</h2>
            <p className="text-[10px] text-slate-400">Step {step + 1} of 4</p>
          </div>
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 font-bold transition">✕</button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-rose-500' : 'bg-slate-100'}`} />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-5 py-4">
          {steps[step]()}
        </div>

        {/* Footer buttons */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex justify-between items-center rounded-b-2xl">
          <button
            onClick={step === 0 ? onClose : () => setStep(step - 1)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg transition"
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow"
            >
              Confirm Cancellation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
