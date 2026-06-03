/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction, Agent, Account, Reservation } from '../types';
import ReceiptVoucherPDF from './ReceiptVoucherPDF';

interface TransactionsPageProps {
  transactions: Transaction[];
  agents: Agent[];
  accounts: Account[];
  reservations: Reservation[];
  currentUser: string;
  onSaveTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

import { exportToCSV } from '../lib/storage';

export default function TransactionsPage({ transactions, agents, accounts, reservations, currentUser, onSaveTransaction, onDeleteTransaction }: TransactionsPageProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'' | 'ClientPayment' | 'SupplierPayment'>('');
  
  // Form type
  const [type, setType] = useState<'ClientPayment' | 'SupplierPayment'>('ClientPayment');
  const [agentId, setAgentId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [originalCurrency, setOriginalCurrency] = useState<'SAR' | 'EGP'>('SAR');
  const [originalAmount, setOriginalAmount] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer'>('Bank Transfer');
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || '');
  const [description, setDescription] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState('');

  const resetForm = () => {
    setType('ClientPayment');
    setAgentId('');
    setReservationId('');
    setAmount(0);
    setOriginalCurrency('SAR');
    setOriginalAmount(0);
    setExchangeRate(1);
    setPaymentMethod('Bank Transfer');
    setFromAccountId(accounts[0]?.id || '');
    setDescription('');
    setAttachmentDataUrl('');
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleEditTransaction = (tr: Transaction) => {
    setEditingId(tr.id);
    setType(tr.type);
    setAgentId(tr.agentId || '');
    setReservationId(tr.reservationId || '');
    setOriginalCurrency(tr.originalCurrency || 'SAR');
    if (tr.originalCurrency === 'EGP') {
      setOriginalAmount(tr.originalAmount || 0);
      setExchangeRate(tr.exchangeRate || 1);
      setAmount(tr.amount);
    } else {
      setAmount(tr.amount);
      setOriginalAmount(0);
      setExchangeRate(1);
    }
    setPaymentMethod(tr.paymentMethod);
    setFromAccountId(tr.fromAccountId || accounts[0]?.id || '');
    setDescription(tr.description || '');
    setAttachmentDataUrl(tr.attachmentDataUrl || '');
    setShowAddForm(true);
  };

  // Selected receipt for printing voucher layout
  const [printingVoucher, setPrintingVoucher] = useState<Transaction | null>(null);

  // Filter lists based on type selected
  const activeAgents = agents.filter(a => {
    if (type === 'ClientPayment') return a.type === 'Customer' || a.type === 'Both';
    return a.type === 'Supplier' || a.type === 'Both';
  });

  const activeReservations = reservations.filter(res => {
    if (type === 'ClientPayment') return res.clientId === agentId && res.status !== 'Cancelled';
    return res.supplierId === agentId && res.status !== 'Cancelled';
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || (originalCurrency === 'SAR' && amount <= 0)) {
      alert('Please fill out agent identity and financial sum.');
      return;
    }

    const timestampIdx = editingId ? editingId.replace('tr_', '') : Date.now();
    
    // Auto calculate vouchers and document sequential sequences block
    const docNo = editingId ? (transactions.find(t => t.id === editingId)?.docNo || `DOC-${timestampIdx}`) : `DOC-${timestampIdx}`;
    const voucherNo = editingId ? (transactions.find(t => t.id === editingId)?.voucherNo || (paymentMethod === 'Cash' ? `CASH-REC-${timestampIdx}` : `BANK-REC-${timestampIdx}`)) : (paymentMethod === 'Cash' ? `CASH-REC-${timestampIdx}` : `BANK-REC-${timestampIdx}`);

    let computedAmount = amount;
    if (originalCurrency === 'EGP') {
      computedAmount = originalAmount / exchangeRate;
      if (!computedAmount || computedAmount <= 0) {
        alert('Exchange rate and EGP amount must be valid.');
        return;
      }
    }

    const newTransaction: Transaction = {
      id: editingId || `tr_${timestampIdx}`,
      docNo: docNo,
      date: editingId ? (transactions.find(t => t.id === editingId)?.date || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      type,
      amount: computedAmount,
      fromAccountId,
      reservationId: reservationId || undefined,
      agentId,
      description,
      paymentMethod,
      voucherNo,
      originalCurrency,
      originalAmount: originalCurrency === 'EGP' ? originalAmount : undefined,
      exchangeRate: originalCurrency === 'EGP' ? exchangeRate : undefined,
      attachmentDataUrl,
      createdBy: editingId ? (transactions.find(t => t.id === editingId)?.createdBy || currentUser) : currentUser
    };

    onSaveTransaction(newTransaction);
    resetForm();
    
    // Auto-prompt to print the voucher directly if new
    if (!editingId) {
      setPrintingVoucher(newTransaction);
    } else {
      alert('Transaction updated successfully.');
    }
  };

  const getAgentLabel = (id: string) => {
    const a = agents.find(agent => agent.id === id);
    return a ? (a.companyName || a.name) : 'N/A';
  };

  const getAccountLabel = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : 'N/A';
  };

  const filteredTransactions = transactions.filter(tr => {
    const term = searchTerm.toLowerCase();
    const searchMatch = !searchTerm || tr.docNo?.toLowerCase().includes(term) || tr.voucherNo?.toLowerCase().includes(term) || tr.description?.toLowerCase().includes(term) || getAgentLabel(tr.agentId).toLowerCase().includes(term);
    const typeMatch = !filterType || tr.type === filterType;
    return searchMatch && typeMatch;
  });

  const handleExportCSV = () => {
    const reportData = filteredTransactions.map(tr => ({
      Date: tr.date,
      Type: tr.type === 'ClientPayment' ? 'Client Payment' : 'Supplier Payment',
      Agent: getAgentLabel(tr.agentId),
      Method: tr.paymentMethod,
      Description: tr.description,
      Amount: tr.amount,
      Voucher: tr.voucherNo || ''
    }));
    exportToCSV('transactions-report.csv', reportData);
  };

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm text-xs">
      
      {/* Header bar */}
      <div className="border-b border-slate-100 pb-4 mb-4 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Financial Ledger Operations & Client Payments</h2>
          <p className="text-xs text-slate-500 font-serif">إدارة المقبوضات والمدفوعات والمحاسبة - Choose between Cash and Bank Transfer to issue clean receipts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] px-3 py-2 rounded-lg transition"
          >
            ⬇️ Export CSV
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow"
          >
            {showAddForm ? 'View Receipts' : 'Record New Transaction Receipt'}
          </button>
        </div>
      </div>

      {!showAddForm && (
        <div className="mb-4 flex flex-col md:flex-row gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
          <input
            type="text"
            placeholder="Search voucher, doc, desc, agent..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs flex-1 w-full"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full md:w-48"
          >
            <option value="">All Transactions</option>
            <option value="ClientPayment">Client Payments Received</option>
            <option value="SupplierPayment">Supplier Payments Sent</option>
          </select>
        </div>
      )}

      {showAddForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-705">Record Payment Inflow / Outflow</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Transaction Category</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as any);
                  setAgentId('');
                  setReservationId('');
                }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
              >
                <option value="ClientPayment">Client Payment Received (Inflow)</option>
                <option value="SupplierPayment">Payment Paid to Supplier (Outflow)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Target Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                required
              >
                <option value="">-- Choose Agent --</option>
                {activeAgents.map(a => (
                  <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Link to Reservation (Optional)</label>
              <select
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- Standalone Transaction --</option>
                {activeReservations.map(res => (
                  <option key={res.id} value={res.id}>RSV-{res.id} - Guest: {res.guestName.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500"
              >
                <option value="Bank Transfer">Bank Transfer (تحويل بنكي / شيك)</option>
                <option value="Cash">Cash Receipt (سند نقدية)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Currency</label>
              <select
                value={originalCurrency}
                onChange={(e) => setOriginalCurrency(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
              >
                <option value="SAR">Saudi Riyal (SAR)</option>
                <option value="EGP">Egyptian Pound (EGP)</option>
              </select>
            </div>

            {originalCurrency === 'SAR' ? (
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Value Amount (SAR)</label>
                <input
                  type="number"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="SAR Currency Amount"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-indigo-700"
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Value Amount (EGP)</label>
                  <input
                    type="number"
                    value={originalAmount || ''}
                    onChange={(e) => setOriginalAmount(Number(e.target.value))}
                    placeholder="EGP Currency Amount"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-indigo-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Exchange Rate (SAR to EGP)</label>
                  <input
                    type="number"
                    value={exchangeRate || ''}
                    step="0.01"
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    placeholder="e.g. 13.5"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700"
                    required
                  />
                  {originalAmount > 0 && exchangeRate > 0 && (
                    <p className="text-[10px] mt-1 text-emerald-600 font-bold">
                      = {(originalAmount / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Corporate Bank Account</label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                required
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} (Bal: {acc.balance.toLocaleString()})</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Statement Memo Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Payment for hotel stay peak rooms booking reservation"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                required
              />
            </div>
            
            <div className="col-span-2 md:col-span-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Attachment / Image</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setAttachmentDataUrl(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
              />
              {attachmentDataUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-emerald-700 text-[10px] font-bold">✅ Attachment added</span>
                  <button type="button" onClick={() => setAttachmentDataUrl('')} className="text-red-500 hover:text-red-700 font-bold text-xs">✕</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition"
            >
              {editingId ? 'Update Transaction' : 'Record Payment Receipt'}
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Reservation / Doc No</th>
                <th className="py-3 px-3">Voucher No</th>
                <th className="py-3 px-3">Agent Target</th>
                <th className="py-3 px-3">Payment Method</th>
                <th className="py-3 px-3">Deposit Account</th>
                <th className="py-3 px-3">Statement Description</th>
                <th className="py-3 px-3 text-center">Attachment</th>
                <th className="py-3 px-3 text-right">Sum (SAR)</th>
                <th className="py-3 px-3 text-center">Voucher Layout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 select-none">
              {filteredTransactions.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-50/45 text-xs">
                  <td className="py-3 px-3 font-mono">{tr.date}</td>
                  <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                    {tr.docNo || '—'}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-700">
                    {tr.voucherNo || '—'}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 bg-amber-50/5">
                    {getAgentLabel(tr.agentId || '')}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                      tr.paymentMethod === 'Cash' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      {tr.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[10px] text-slate-600 font-medium">
                    {getAccountLabel(tr.fromAccountId || '')}
                  </td>
                  <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={tr.description}>
                    {tr.description}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {tr.attachmentDataUrl ? (
                      <a href={tr.attachmentDataUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold underline" onClick={(e) => e.stopPropagation()}>
                        View
                      </a>
                    ) : '—'}
                  </td>
                  <td className={`py-3 px-3 text-right font-mono font-bold ${
                    tr.type === 'ClientPayment' ? 'text-emerald-700' : 'text-red-650'
                  }`}>
                    {tr.type === 'ClientPayment' ? '+' : '-'} {tr.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setPrintingVoucher(tr)}
                        className="bg-slate-100 hover:bg-indigo-650 hover:text-white text-slate-700 font-semibold px-2 py-1 rounded transition text-[10px]"
                        title="Print Receipt"
                      >
                        🖨️
                      </button>
                      <button 
                        onClick={() => handleEditTransaction(tr)}
                        className="bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-500 font-semibold px-2 py-1 rounded transition text-[10px]"
                        title="Edit Transaction"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('Are you sure you want to completely remove this transaction from the ledger? This will reverse the account balance changes.')) {
                            onDeleteTransaction(tr.id);
                          }
                        }}
                        className="bg-slate-100 hover:bg-rose-600 hover:text-white text-rose-500 font-semibold px-2 py-1 rounded transition text-[10px]"
                        title="Delete Transaction"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">No ledger transactions registered.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Printable Cash Receipt Voucher render */}
      {printingVoucher && (
        <ReceiptVoucherPDF
          transaction={printingVoucher}
          client={agents.find(a => a.id === printingVoucher.agentId)}
          reservation={reservations.find(r => r.id.toString() === printingVoucher.reservationId)}
          onClose={() => setPrintingVoucher(null)}
        />
      )}

    </div>
  );
}
