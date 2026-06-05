/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent, Reservation, Account, Transaction } from '../types';
import { getReservationTotals } from '../lib/storage';

interface BulkPaymentDialogProps {
  client: Agent;
  reservations: Reservation[];
  accounts: Account[];
  currentUser: string;
  onClose: () => void;
  onSave: (updatedReservations: Reservation[], updatedTransactions: Transaction[], updatedAccounts: Account[]) => void;
}

export default function BulkPaymentDialog({ client, reservations, accounts, currentUser, onClose, onSave }: BulkPaymentDialogProps) {
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer'>('Bank Transfer');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [distributionResult, setDistributionResult] = useState<any[]>([]);

  // Find all reservations of this client that have a balance due (totalSell > amountPaidByClient)
  const getPendingReservations = (): any[] => {
    return reservations
      .filter(res => res.clientId === client.id && res.status !== 'Cancelled')
      .map(res => {
        const { totalSell } = getReservationTotals(res);
        const BalanceDue = totalSell - res.amountPaidByClient;
        return {
          reservation: res,
          totalSell,
          BalanceDue,
        };
      })
      .filter(item => item.BalanceDue > 0)
      .sort((a, b) => a.reservation.checkIn.localeCompare(b.reservation.checkIn)); // FIFO order by checkin
  };

  const pendingList = getPendingReservations();

  // Try calculating where the distribution will go on input change
  const handleCalculate = (totalAmount: number) => {
    let budget = totalAmount;
    const finalDistribution: any[] = [];

    pendingList.forEach(item => {
      if (budget <= 0) {
        finalDistribution.push({
          ...item,
          allocated: 0,
          newPaid: item.reservation.amountPaidByClient,
          remaining: item.BalanceDue
        });
        return;
      }

      const allocation = Math.min(budget, item.BalanceDue);
      budget -= allocation;

      finalDistribution.push({
        ...item,
        allocated: allocation,
        newPaid: item.reservation.amountPaidByClient + allocation,
        remaining: item.BalanceDue - allocation
      });
    });

    setDistributionResult(finalDistribution);
  };

  const onAmountChange = (val: number) => {
    setAmount(val);
    handleCalculate(val);
  };

  const handleSaveDistribution = () => {
    if (amount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }
    if (!selectedAccountId) {
      alert('Please select an account.');
      return;
    }

    const updatedReservations = [...reservations];
    const newTransactions: Transaction[] = [];
    const updatedAccounts = accounts.map(acc => {
      if (acc.id === selectedAccountId) {
        return { ...acc, balance: acc.balance + amount };
      }
      return acc;
    });

    // We will generate sequential transaction docs
    let timestampIdx = Date.now();
    let rIdx = 1;

    distributionResult.forEach(item => {
      if (item.allocated <= 0) return;

      // Update reservation in original list
      const resIndex = updatedReservations.findIndex(r => r.id === item.reservation.id);
      if (resIndex !== -1) {
        updatedReservations[resIndex] = {
          ...updatedReservations[resIndex],
          amountPaidByClient: updatedReservations[resIndex].amountPaidByClient + item.allocated
        };
      }

      // Add a client transaction
      const transDocNo = `DOC-${timestampIdx + rIdx}`;
      const transVoucherNo = `REC-${timestampIdx + rIdx}`;
      
      newTransactions.push({
        id: `tr_${timestampIdx}_${rIdx}`,
        docNo: (updatedReservations.length + rIdx).toString(),
        date: new Date().toISOString().split('T')[0],
        type: 'ClientPayment',
        amount: item.allocated,
        fromAccountId: selectedAccountId,
        reservationId: item.reservation.id.toString(),
        agentId: client.id,
        description: `Distributed Bulk Payment of ${amount.toLocaleString()} SAR. Allocated ${item.allocated.toLocaleString()} SAR to RSV-${item.reservation.id} (Guest ${item.reservation.guestName})`,
        paymentMethod,
        voucherNo: transVoucherNo,
        createdBy: currentUser
      });

      rIdx++;
    });

    onSave(updatedReservations, newTransactions, updatedAccounts);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-none md:rounded-xl shadow-2xl max-w-2xl w-full p-4 md:p-6 animate-in fade-in zoom-in-95 max-h-[100dvh] md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Bulk Client Down-Payment & Redistribution</h3>
            <p className="text-xs text-slate-500">Distributes money across pending bookings of: <span className="font-semibold text-slate-700">{client.name}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
        </div>

        {pendingList.length === 0 ? (
          <div className="py-8 text-center text-slate-450 italic">
            There are no unpaid reservations for this client!
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Input fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Down Payment (SAR)</label>
                <input
                  type="number"
                  value={amount || ''}
                  onChange={(e) => onAmountChange(Number(e.target.value))}
                  placeholder="e.g. 25000"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Destination Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (Bal: {acc.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Allocation Simulation */}
            <div className="border border-amber-100 rounded-xl bg-amber-50/20 p-3">
              <h4 className="text-[11px] uppercase font-bold text-amber-900 mb-2">Automated FIFO Distribution Preview</h4>
              
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 no-scrollbar text-[11px]">
                {distributionResult.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 rounded p-2 text-[11px]">
                    <div className="text-left">
                      <p className="font-semibold text-slate-800">RSV-{item.reservation.id} (Check-In: {item.reservation.checkIn})</p>
                      <p className="text-slate-500">Guest: <span className="uppercase">{item.reservation.guestName}</span> | Total Sell: {item.totalSell.toLocaleString()} SAR</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Owed / paid</span>
                        <span className="font-mono font-medium">{item.BalanceDue.toLocaleString()} / {item.reservation.amountPaidByClient.toLocaleString()} SAR</span>
                      </div>
                      <div className="bg-emerald-50 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded border border-emerald-150">
                        + {item.allocated.toLocaleString()} SAR
                      </div>
                    </div>
                  </div>
                ))}
                {distributionResult.length === 0 && (
                  <p className="text-slate-400 italic text-center text-xs py-2">Enter an amount above to preview distribute simulation.</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-xs transition animate-none"
              >
                Cancel
              </button>
              <button
                disabled={amount <= 0}
                onClick={handleSaveDistribution}
                className="bg-amber-600 font-bold hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs transition animate-none"
              >
                Distribute & Save Payment
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
