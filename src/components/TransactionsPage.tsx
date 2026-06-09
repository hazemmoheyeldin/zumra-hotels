/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, Agent, Account, Reservation } from '../types';
import ReceiptVoucherPDF from './ReceiptVoucherPDF';
import { useLang } from '../lib/LanguageContext';
import { showToast } from './Toast';
import { exportToExcel } from '../lib/storage';

interface TransactionsPageProps {
  transactions: Transaction[];
  agents: Agent[];
  accounts: Account[];
  reservations: Reservation[];
  currentUser: string;
  onSaveTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

import { exportToCSV, getReservationTotals } from '../lib/storage';
import { round2 } from '../lib/finance';

export default function TransactionsPage({ transactions, agents, accounts, reservations, currentUser, onSaveTransaction, onDeleteTransaction }: TransactionsPageProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { t, lang } = useLang();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'' | 'ClientPayment' | 'SupplierPayment' | 'ClientRefund' | 'SupplierRefund' | 'CreditApplied' | 'RefundProcessed'>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAgentId, setFilterAgentId] = useState('');
  const [filterMethod, setFilterMethod] = useState<'' | 'Cash' | 'Bank Transfer'>('');
  const [viewingAttachment, setViewingAttachment] = useState<{url: string, label: string} | null>(null);
  const [showAgentSummary, setShowAgentSummary] = useState(false);
  
  // Form type
  const [type, setType] = useState<'ClientPayment' | 'SupplierPayment' | 'ClientRefund' | 'SupplierRefund' | 'CreditApplied' | 'RefundProcessed'>('ClientPayment');
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
    setType(tr.type as typeof type);
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
    if (type === 'ClientPayment' || type === 'ClientRefund') return a.type === 'Customer' || a.type === 'Both';
    return a.type === 'Supplier' || a.type === 'Both';
  });

  const activeReservations = reservations.filter(res => {
    if (type === 'ClientPayment' || type === 'ClientRefund') return res.clientId === agentId;
    return res.supplierId === agentId;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || (originalCurrency === 'SAR' && amount <= 0)) {
      showToast('Please fill out agent identity and financial sum.', 'warning');
      return;
    }

    const timestampIdx = editingId ? editingId.replace('tr_', '') : Date.now();
    
    // Sequential numbering for doc and voucher references
    const docNo = editingId 
      ? (transactions.find(t => t.id === editingId)?.docNo || `DOC-${String(transactions.length + 1).padStart(3, '0')}`) 
      : `DOC-${String(transactions.filter(t => t.type === type).length + 1).padStart(3, '0')}`;
    const voucherPrefix = paymentMethod === 'Cash' ? 'CASH-REC' : 'BANK-REC';
    const voucherNo = editingId 
      ? (transactions.find(t => t.id === editingId)?.voucherNo || `${voucherPrefix}-${String(transactions.filter(t => t.paymentMethod === paymentMethod).length + 1).padStart(3, '0')}`)
      : `${voucherPrefix}-${String(transactions.filter(t => t.paymentMethod === paymentMethod).length + 1).padStart(3, '0')}`;

    let computedAmount = amount;
    if (originalCurrency === 'EGP') {
      computedAmount = originalAmount / exchangeRate;
      if (!computedAmount || computedAmount <= 0) {
        showToast('Exchange rate and EGP amount must be valid.', 'warning');
        return;
      }
    }

    // ── Transaction Validation ──
    // Prevent negative or zero amounts
    if (computedAmount <= 0) {
      showToast('Transaction amount must be greater than zero.', 'warning');
      return;
    }

    // Reservation-linked validation
    if (reservationId) {
      const linkedRes = reservations.find(r => r.id.toString() === reservationId);
      if (linkedRes) {
        const { totalSell, totalBuy } = getReservationTotals(linkedRes);
        const isPayment = type === 'ClientPayment' || type === 'SupplierPayment';
        const isRefund = type === 'ClientRefund' || type === 'SupplierRefund';
        const totalOwed = (type === 'ClientPayment' || type === 'ClientRefund') ? totalSell : totalBuy;
        const currentPaid = (type === 'ClientPayment' || type === 'ClientRefund')
          ? (linkedRes.amountPaidByClient || 0)
          : (linkedRes.amountPaidToSupplier || 0);

        if (isPayment && totalOwed > 0) {
          const remaining = round2(totalOwed - currentPaid);
          if (computedAmount > remaining) {
            showToast(`Payment (${round2(computedAmount)}) exceeds remaining balance (${remaining}). Consider using the reservation page for tracked payments.`, 'warning');
          }
        }

        if (isRefund && currentPaid >= 0) {
          if (computedAmount > currentPaid) {
            showToast(`Refund amount (${round2(computedAmount)}) exceeds total paid (${round2(currentPaid)}) on this reservation.`, 'error');
            return;
          }
        }
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
      showToast('Transaction updated successfully.', 'success');
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
    const searchMatch = !searchTerm || tr.docNo?.toLowerCase().includes(term) || tr.voucherNo?.toLowerCase().includes(term) || tr.description?.toLowerCase().includes(term) || getAgentLabel(tr.agentId).toLowerCase().includes(term) || tr.reservationId?.includes(term);
    const typeMatch = !filterType || tr.type === filterType;
    const dateFromMatch = !filterDateFrom || tr.date >= filterDateFrom;
    const dateToMatch = !filterDateTo || tr.date <= filterDateTo;
    const agentMatch = !filterAgentId || tr.agentId === filterAgentId;
    const methodMatch = !filterMethod || tr.paymentMethod === filterMethod;
    return searchMatch && typeMatch && dateFromMatch && dateToMatch && agentMatch && methodMatch;
  });

  // Running balance for filtered transactions
  const runningBalances = useMemo(() => {
    let bal = 0;
    return filteredTransactions.map(tr => {
      if (tr.type === 'ClientPayment' || tr.type === 'SupplierRefund' || tr.type === 'CreditApplied') bal += tr.amount;
      else bal -= tr.amount;
      return bal;
    });
  }, [filteredTransactions]);

  // Per-agent summary
  const agentSummary = useMemo(() => {
    const map: { [id: string]: { name: string; inflow: number; outflow: number; count: number } } = {};
    filteredTransactions.forEach(tr => {
      const id = tr.agentId || 'unknown';
      if (!map[id]) map[id] = { name: getAgentLabel(id), inflow: 0, outflow: 0, count: 0 };
      map[id].count++;
      if (tr.type === 'ClientPayment' || tr.type === 'SupplierRefund' || tr.type === 'CreditApplied') map[id].inflow += tr.amount;
      else map[id].outflow += tr.amount;
    });
    return Object.values(map).sort((a, b) => (b.inflow - b.outflow) - (a.inflow - a.outflow));
  }, [filteredTransactions]);

  // Quick filter helpers
  const setQuickFilter = (range: 'today' | 'week' | 'month') => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (range === 'today') { setFilterDateFrom(today); setFilterDateTo(today); }
    else if (range === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      setFilterDateFrom(weekAgo.toISOString().split('T')[0]); setFilterDateTo(today);
    } else {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      setFilterDateFrom(monthAgo.toISOString().split('T')[0]); setFilterDateTo(today);
    }
  };

  // Highlight search term in text
  const highlightText = (text: string, term: string) => {
    if (!term || !text) return text;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>{text.slice(idx + term.length)}</>;
  };

  const handleExportCSV = () => {
    const reportData = filteredTransactions.map(tr => ({
      Date: tr.date,
      Type: tr.type === 'ClientPayment' ? 'Client Payment' : tr.type === 'SupplierPayment' ? 'Supplier Payment' : tr.type === 'CreditApplied' ? 'Credit Applied' : tr.type === 'RefundProcessed' ? 'Refund Processed' : tr.type === 'ClientRefund' ? 'Client Refund' : 'Supplier Refund',
      Agent: getAgentLabel(tr.agentId),
      Method: tr.paymentMethod,
      Description: tr.description,
      Amount: tr.amount,
      Voucher: tr.voucherNo || ''
    }));
    exportToCSV('transactions-report.csv', reportData);
  };

  const handleExportExcel = () => {
    const reportData = filteredTransactions.map(tr => ({
      'Date': tr.date,
      'Doc #': tr.docNo || '',
      'Type': tr.type === 'ClientPayment' ? 'Client Payment' : tr.type === 'SupplierPayment' ? 'Supplier Payment' : tr.type === 'CreditApplied' ? 'Credit Applied' : tr.type === 'RefundProcessed' ? 'Refund Processed' : tr.type === 'ClientRefund' ? 'Client Refund' : 'Supplier Refund',
      'Agent': getAgentLabel(tr.agentId),
      'Method': tr.paymentMethod,
      'Description': tr.description,
      'Amount (SAR)': tr.amount,
      'Voucher': tr.voucherNo || '',
      'Created By': tr.createdBy || ''
    }));
    exportToExcel(`Transactions ${new Date().toISOString().split('T')[0]}.xlsx`, reportData, 'Transactions');
    showToast('Excel exported successfully', 'success');
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('trans.title')}</div>
          <div className="text-2xl font-black text-slate-900">{transactions.length}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">{t('trans.clientPaymentsIn')}</div>
          <div className="text-xl font-black text-emerald-800">
            {transactions.filter(t => t.type === 'ClientPayment').reduce((s, t) => s + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[9px] text-emerald-500 font-mono mt-0.5">{transactions.filter(t => t.type === 'ClientPayment').length} payments</div>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-rose-600 mb-1">{t('trans.supplierPaymentsOut')}</div>
          <div className="text-xl font-black text-rose-800">
            {transactions.filter(t => t.type === 'SupplierPayment').reduce((s, t) => s + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[9px] text-rose-500 font-mono mt-0.5">{transactions.filter(t => t.type === 'SupplierPayment').length} payments</div>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-orange-600 mb-1">{t('trans.refunds')}</div>
          <div className="text-xl font-black text-orange-800">
            {transactions.filter(t => t.type === 'ClientRefund').reduce((s, t) => s + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[9px] text-orange-500 font-mono mt-0.5">{transactions.filter(t => t.type === 'ClientRefund').length} client refunds</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">{t('trans.netCashFlow')}</div>
          <div className="text-xl font-black text-amber-800">
            {(() => {
              const inflow = transactions.filter(t => t.type === 'ClientPayment' || t.type === 'SupplierRefund').reduce((s, t) => s + t.amount, 0);
              const outflow = transactions.filter(t => t.type === 'SupplierPayment' || t.type === 'ClientRefund').reduce((s, t) => s + t.amount, 0);
              return (inflow - outflow).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            })()}
          </div>
          <div className="text-[9px] text-amber-500 font-mono mt-0.5">SAR</div>
        </div>
      </div>

      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm text-xs">
      
      {/* Header bar */}
      <div className="border-b border-slate-100 pb-4 mb-4 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t('trans.ledgerTitle')}</h2>
          <p className="text-xs text-slate-500 font-serif">{t('trans.ledgerSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[10px] px-3 py-2 rounded-lg transition border border-emerald-200"
            title="Export to Excel"
          >
            📊 Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] px-3 py-2 rounded-lg transition"
          >
            ⬇️ {t('trans.exportCSV')}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow"
          >
            {showAddForm ? t('trans.viewReceipts') : t('trans.recordNew')}
          </button>
        </div>
      </div>

      {!showAddForm && (
        <div className="mb-4 space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
          {/* Quick filters */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button onClick={() => setQuickFilter('today')} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition">{t('trans.today')}</button>
            <button onClick={() => setQuickFilter('week')} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition">{t('trans.thisWeek')}</button>
            <button onClick={() => setQuickFilter('month')} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition">{t('trans.thisMonth')}</button>
          </div>
          {/* Row 1: Search + Type */}
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <input
              type="text"
              placeholder={t('trans.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs flex-1 w-full"
            />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full md:w-48"
            >
              <option value="">{t('trans.allTransactions')}</option>
              <option value="ClientPayment">{t('trans.clientPayments')}</option>
              <option value="SupplierPayment">{t('trans.supplierPayments')}</option>
              <option value="ClientRefund">{t('trans.clientRefundsFilter')}</option>
              <option value="SupplierRefund">{t('trans.supplierRefundsFilter')}</option>
              <option value="CreditApplied">Credit Applied</option>
              <option value="RefundProcessed">Refund Processed</option>
            </select>
            <select
              value={filterMethod}
              onChange={e => setFilterMethod(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full md:w-40"
            >
              <option value="">{t('trans.allMethods')}</option>
              <option value="Cash">{t('res.cash')}</option>
              <option value="Bank Transfer">{t('res.bankTransfer')}</option>
            </select>
          </div>
          {/* Row 2: Date range + Agent */}
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{t('common.from')}:</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs flex-1 md:w-36"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{t('common.to')}:</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs flex-1 md:w-36"
              />
            </div>
            <select
              value={filterAgentId}
              onChange={e => setFilterAgentId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full md:w-52"
            >
              <option value="">{t('trans.allAgents')}</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
              ))}
            </select>
            {(filterType || filterDateFrom || filterDateTo || filterAgentId || filterMethod || searchTerm) && (
              <button
                onClick={() => { setSearchTerm(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterAgentId(''); setFilterMethod(''); }}
                className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 transition whitespace-nowrap"
              >
                ✕ {t('common.clearFilters')}
              </button>
            )}
          </div>
          {/* Results count */}
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-slate-400 font-medium">
              {t('trans.showing', { filtered: filteredTransactions.length, total: transactions.length })}
            </div>
            <button onClick={() => setShowAgentSummary(v => !v)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition">
              {showAgentSummary ? '▼' : '▶'} {t('trans.agentSummary')}
            </button>
          </div>
          {/* Agent Summary Collapsible */}
          {showAgentSummary && agentSummary.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase border-b border-slate-100">
                    <th className="py-1.5 px-2 text-left">{lang === 'ar' ? 'الوكيل' : 'Agent'}</th>
                    <th className="py-1.5 px-2 text-center">{lang === 'ar' ? 'المعاملات' : 'Txns'}</th>
                    <th className="py-1.5 px-2 text-right">{t('trans.inflow')}</th>
                    <th className="py-1.5 px-2 text-right">{t('trans.outflow')}</th>
                    <th className="py-1.5 px-2 text-right">{t('trans.net')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {agentSummary.map(a => (
                    <tr key={a.name} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 font-bold text-slate-800">{a.name}</td>
                      <td className="py-1.5 px-2 text-center font-mono">{a.count}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-700">{a.inflow.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-rose-600">{a.outflow.toLocaleString()}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-bold ${(a.inflow - a.outflow) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{(a.inflow - a.outflow).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-705">{t('trans.recordFormTitle')}</h3>

          {/* Wallet Credit Banner */}
          {agentId && (() => {
            const selectedAgent = agents.find(a => a.id === agentId);
            if (selectedAgent && (selectedAgent.walletBalance || 0) > 0) {
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-emerald-800">💰 This agent has {(selectedAgent.walletBalance || 0).toLocaleString()} SAR credit available</p>
                    <p className="text-[10px] text-emerald-600">You can apply this credit towards a new payment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAmount(selectedAgent.walletBalance || 0);
                      setType(type.startsWith('Client') ? 'ClientPayment' : 'SupplierPayment');
                      setDescription(`Applying wallet credit of ${(selectedAgent.walletBalance || 0).toLocaleString()} SAR`);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-2 rounded-lg transition whitespace-nowrap"
                  >
                    Apply Full Credit
                  </button>
                </div>
              );
            }
            return null;
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('trans.category')}</label>
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
                <option value="ClientRefund">Refund to Client (Outflow)</option>
                <option value="SupplierRefund">Refund from Supplier (Inflow)</option>
                <option value="CreditApplied">Apply Wallet Credit (Inflow)</option>
                <option value="RefundProcessed">Refund Processed (Outflow)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('trans.targetAgent')}</label>
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
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('trans.linkReservation')}</label>
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
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.paymentMethod')}</label>
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
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('common.currency')}</label>
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
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('trans.corporateBank')}</label>
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

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('trans.statementMemo')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Payment for hotel stay peak rooms booking reservation"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                required
              />
            </div>
            
            <div className="md:col-span-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('trans.attachment')}</label>
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
              {editingId ? t('trans.updateTransaction') : t('trans.recordReceipt')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-5 py-2 rounded-lg transition"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <>
        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-3">
          {filteredTransactions.map((tr, idx) => (
            <div key={tr.id} className="border border-slate-100 rounded-xl p-3 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-mono text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{tr.docNo || '—'}</span>
                  <p className="font-bold text-slate-900 text-xs mt-1">{getAgentLabel(tr.agentId || '')}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{tr.date}</p>
                </div>
                <span className={`font-mono font-bold text-sm ${
                  tr.type === 'ClientPayment' ? 'text-emerald-700' :
                  tr.type === 'SupplierRefund' ? 'text-emerald-700' :
                  tr.type === 'CreditApplied' ? 'text-emerald-700' :
                  tr.type === 'ClientRefund' ? 'text-orange-600' :
                  tr.type === 'RefundProcessed' ? 'text-rose-600' :
                  'text-red-600'
                }`}>
                  {tr.type === 'ClientPayment' || tr.type === 'SupplierRefund' || tr.type === 'CreditApplied' ? '+' : tr.type === 'ClientRefund' ? '↩ ' : tr.type === 'RefundProcessed' ? '↩ ' : '-'}{tr.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    tr.paymentMethod === 'Cash' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                  }`}>{tr.paymentMethod}</span>
                  <span>{getAccountLabel(tr.fromAccountId || '')}</span>
                </div>
                <span className={`font-mono font-bold ${runningBalances[idx] >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  Bal: {runningBalances[idx].toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {tr.description && <p className="text-[10px] text-slate-500 mb-2 truncate">{tr.description}</p>}
              <div className="flex justify-between items-center border-t border-slate-50 pt-2">
                <div className="flex items-center gap-1.5 text-[10px]">
                  {tr.voucherNo && <span className="font-mono text-slate-500">{tr.voucherNo}</span>}
                  {tr.attachmentDataUrl && (
                    <button onClick={() => setViewingAttachment({ url: tr.attachmentDataUrl!, label: `${tr.voucherNo || tr.docNo} - Attachment` })} className="text-indigo-600 font-bold underline">📎 View</button>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setPrintingVoucher(tr)} className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-slate-100 hover:bg-indigo-100 text-slate-700 rounded-lg text-sm" title="Print Receipt">🖨️</button>
                  <button onClick={() => handleEditTransaction(tr)} className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-slate-100 hover:bg-blue-100 text-slate-500 rounded-lg text-sm" title="Edit">✏️</button>
                  <button onClick={() => { if (confirm('Are you sure you want to completely remove this transaction?')) onDeleteTransaction(tr.id); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-rose-500 rounded-lg text-sm" title="Delete">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">{t('common.date')}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'رقم الحجز / المستند' : 'Reservation / Doc No'}</th>
                <th className="py-3 px-3 hidden lg:table-cell">{lang === 'ar' ? 'رقم القسيمة' : 'Voucher No'}</th>
                <th className="py-3 px-3">{t('trans.targetAgent')}</th>
                <th className="py-3 px-3">{t('res.paymentMethod')}</th>
                <th className="py-3 px-3">{t('trans.depositAccount')}</th>
                <th className="py-3 px-3 hidden lg:table-cell">{t('common.description')}</th>
                <th className="py-3 px-3 text-center hidden lg:table-cell">{t('trans.attachment')}</th>
                <th className="py-3 px-3 text-right">{t('trans.sumSAR')}</th>
                <th className="py-3 px-3 text-right">{t('trans.runningBal')}</th>
                <th className="py-3 px-3 text-center">{t('trans.voucherLayout')}</th>
                <th className="py-3 px-3 text-center hidden md:table-cell">{lang === 'ar' ? 'أضافه' : 'Added By'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 select-none">
              {filteredTransactions.map((tr, idx) => (
                <tr key={tr.id} className="hover:bg-slate-50/45 text-xs">
                  <td className="py-3 px-3 font-mono">{tr.date}</td>
                  <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                    {searchTerm ? highlightText(tr.docNo || '—', searchTerm) : (tr.docNo || '—')}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-700 hidden lg:table-cell">
                    {tr.voucherNo || '—'}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 bg-amber-50/5">
                    {searchTerm ? highlightText(getAgentLabel(tr.agentId || ''), searchTerm) : getAgentLabel(tr.agentId || '')}
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
                  <td className="py-3 px-3 text-slate-600 max-w-xs truncate hidden lg:table-cell" title={tr.description}>
                    {tr.description}
                  </td>
                  <td className="py-3 px-3 text-center hidden lg:table-cell">
                    {tr.attachmentDataUrl ? (
                      <button 
                        onClick={() => setViewingAttachment({ url: tr.attachmentDataUrl!, label: `${tr.voucherNo || tr.docNo} - Attachment` })}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold underline cursor-pointer"
                      >
                        View
                      </button>
                    ) : '—'}
                  </td>
                  <td className={`py-3 px-3 text-right font-mono font-bold ${
                    tr.type === 'ClientPayment' ? 'text-emerald-700' :
                    tr.type === 'SupplierRefund' ? 'text-emerald-700' :
                    tr.type === 'CreditApplied' ? 'text-emerald-700' :
                    tr.type === 'ClientRefund' ? 'text-orange-600' :
                    tr.type === 'RefundProcessed' ? 'text-rose-600' :
                    'text-red-650'
                  }`}>
                    {tr.type === 'ClientPayment' || tr.type === 'SupplierRefund' || tr.type === 'CreditApplied' ? '+' : tr.type === 'ClientRefund' ? '↩ ' : tr.type === 'RefundProcessed' ? '↩ ' : '-'} {tr.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-3 text-right font-mono font-bold text-[10px] ${runningBalances[idx] >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {runningBalances[idx].toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setPrintingVoucher(tr)}
                        className="bg-slate-100 hover:bg-indigo-650 hover:text-white text-slate-700 font-semibold px-2 py-1.5 rounded transition text-[10px] min-h-[28px]"
                        title="Print Receipt"
                      >
                        🖨️
                      </button>
                      <button 
                        onClick={() => handleEditTransaction(tr)}
                        className="bg-slate-100 hover:bg-blue-650 hover:text-white text-slate-500 font-semibold px-2 py-1.5 rounded transition text-[10px] min-h-[28px]"
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
                        className="bg-slate-100 hover:bg-rose-600 hover:text-white text-rose-500 font-semibold px-2 py-1.5 rounded transition text-[10px] min-h-[28px]"
                        title="Delete Transaction"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center hidden md:table-cell">
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{tr.createdBy || '—'}</span>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-16 text-center animate-fade-in">
                    <div className="text-5xl mb-4">💳</div>
                    <p className="text-sm font-bold text-slate-500">{t('trans.noTransactions')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('trans.createFirst')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
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

      {/* Attachment Viewer Modal */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-0 md:p-4" onClick={() => setViewingAttachment(null)}>
          <div className="bg-white rounded-none md:rounded-2xl shadow-2xl max-w-4xl max-h-[100dvh] md:max-h-[90vh] w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 truncate">{viewingAttachment.label}</h3>
              <div className="flex items-center gap-2">
                <a href={viewingAttachment.url} download className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg transition">⬇️ Download</a>
                <button onClick={() => setViewingAttachment(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold w-8 h-8 rounded-lg text-sm flex items-center justify-center transition">✕</button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-60px)] flex items-center justify-center bg-slate-100">
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
