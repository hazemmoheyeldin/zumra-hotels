/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Transaction, Hotel, StampPosition } from '../types';
import { getReservationTotals } from '../lib/storage';
import { round2, sumAmounts, safeAdd, safeSubtract, absAmount } from '../lib/finance';
// NOTE: All financial accumulations use safeAdd/safeSubtract/round2 from finance.ts
// to prevent IEEE 754 floating-point drift across large transaction sets.
import MasterPDFHeader from './MasterPDFHeader';
import StampOverlay, { getStampSettings, saveStampSettings } from './StampOverlay';
import { downloadPDF, compressImagesForPrint, exportPDF } from '../lib/pdfGenerator';
import { usePageBreaks } from '../lib/usePageBreaks';
import { useLang } from '../lib/LanguageContext';

interface StatementLine {
  date: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  docType: string;
  docNo: string;
  voucher: string;
  genNo: string;
  currency?: string;         // Original transaction currency (SAR, EGP, etc.)
  originalAmount?: number;   // Amount in original currency
}

interface StatementReportPDFProps {
  client: Agent;
  reservations: Reservation[];
  transactions: Transaction[];
  hotels?: Hotel[];
  fromDate: string;
  toDate: string;
  isSupplier?: boolean;
  onClose: () => void;
}

export default function StatementReportPDF({ client, reservations, transactions, hotels = [], fromDate, toDate, isSupplier, onClose }: StatementReportPDFProps) {
  const { renderInsertZone, PageBreakToggle } = usePageBreaks();
  const { t, lang } = useLang();
  const stampDefaults = getStampSettings();
  const [stampVisible, setStampVisible] = useState(false); // Always default to off
  const [stampPosition, setStampPosition] = useState<StampPosition>(stampDefaults.position);
  
  // Format Helper for dates as standard DD/MM/YYYY
  const formatStandardDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // ── Sign Convention (symmetric for Client and Supplier) ──────────
  // Client statement:
  //   Reservation = DEBIT  (client owes us)   → totalSell
  //   Payment     = CREDIT (client paid us)   → ClientPayment
  //   Refund      = DEBIT  (we returned money) → ClientRefund
  //
  // Supplier statement:
  //   Reservation = DEBIT  (we owe supplier)  → totalBuy
  //   Payment     = CREDIT (we paid supplier)  → SupplierPayment
  //   Refund      = DEBIT  (supplier returned)  → SupplierRefund
  //
  // Running balance: Previous Balance + Debits - Credits = New Balance
  // A positive running balance = they owe us (debit balance)
  // A negative running balance = they have credit (credit balance)
  // ─────────────────────────────────────────────────────────────────

  // Compile chronological list of entries for this client in date range
  const getStatementEntries = (): StatementLine[] => {
    const list: StatementLine[] = [];
    
    let allLifetimeCredits = 0;
    let allLifetimeLegacyCredits = 0; // Find what's baked into client.balance

    transactions.forEach(tr => {
      const isClientPayment = !isSupplier && tr.agentId === client.id && tr.type === 'ClientPayment';
      const isSupplierPayment = isSupplier && tr.agentId === client.id && tr.type === 'SupplierPayment';
      const isClientRefund = !isSupplier && tr.agentId === client.id && tr.type === 'ClientRefund';
      const isSupplierRefund = isSupplier && tr.agentId === client.id && tr.type === 'SupplierRefund';
      if (isClientPayment || isSupplierPayment) {
        allLifetimeLegacyCredits = safeAdd(allLifetimeLegacyCredits, tr.amount);
      }
      if (isClientRefund || isSupplierRefund) {
        allLifetimeLegacyCredits = safeSubtract(allLifetimeLegacyCredits, tr.amount); // Refunds reverse payment effect
      }
    });

    // Unpack original opening balance:
    // Because ClientPayment did ag.balance + amount, opening = agitated - sum(amount)
    // Because SupplierPayment did ag.balance - amount, opening = agitated + sum(amount)
    const originalOpeningBalance = isSupplier ? (client.balance + allLifetimeLegacyCredits) : (client.balance - allLifetimeLegacyCredits);

    let priorDebits = 0;
    let priorCredits = 0;

    reservations.forEach(res => {
      if (isSupplier && res.supplierId !== client.id) return;
      if (!isSupplier && res.clientId !== client.id) return;
      
      const rDate = res.createdAt ? res.createdAt.split(' ')[0] : '2026-02-24';
      const { totalSell, totalBuy } = getReservationTotals(res);
      const amount = isSupplier ? totalBuy : totalSell;
      const isCancelled = res.status === 'Cancelled';
      
      if (rDate < fromDate) {
        if (!isCancelled) {
          priorDebits = safeAdd(priorDebits, amount);
        }
        // If cancelled in prior period, don't count (net zero)
      } else if (rDate <= toDate) {
        // Always add the original debit entry
        list.push({
          date: rDate,
          debit: amount,
          credit: 0,
          balance: 0,
          description: `RSV-${res.id} / ${res.guestName} / ${res.nights} Nt${isCancelled ? ' (Cancelled)' : ''}`,
          docType: isSupplier ? 'SupplierReservation' : 'ClientReservation',
          docNo: res.id.toString(),
          voucher: isSupplier ? res.supplierVoucher || '' : res.hotelConfirmationNo || '',
          genNo: `TR${res.id}`,
          currency: 'SAR',
          originalAmount: amount
        });
        // If cancelled, add a reversal credit entry
        if (isCancelled) {
          list.push({
            date: rDate,
            debit: 0,
            credit: amount,
            balance: 0,
            description: `Cancelled - RSV-${res.id} / ${res.guestName}`,
            docType: isSupplier ? 'SupplierOperation' : 'ClientOperation',
            docNo: res.id.toString(),
            voucher: '',
            genNo: `TR${res.id}_C`,
            currency: 'SAR',
            originalAmount: amount
          });
        }
      }
    });

    transactions.forEach(tr => {
      const isClientPayment = !isSupplier && tr.agentId === client.id && tr.type === 'ClientPayment';
      const isSupplierPayment = isSupplier && tr.agentId === client.id && tr.type === 'SupplierPayment';
      const isClientRefund = !isSupplier && tr.agentId === client.id && tr.type === 'ClientRefund';
      const isSupplierRefund = isSupplier && tr.agentId === client.id && tr.type === 'SupplierRefund';
      if (!isClientPayment && !isSupplierPayment && !isClientRefund && !isSupplierRefund) return;

      // Payments are credits, Refunds are debits (reverse of payment)
      const isPaymentCredit = isClientPayment || isSupplierPayment;
      const isRefundDebit = isClientRefund || isSupplierRefund;

      if (tr.date < fromDate) {
        if (isPaymentCredit) priorCredits = safeAdd(priorCredits, tr.amount);
        if (isRefundDebit) priorDebits = safeAdd(priorDebits, tr.amount);
      } else if (tr.date <= toDate) {
        if (isPaymentCredit) {
          list.push({
            date: tr.date,
            debit: 0,
            credit: tr.amount,
            balance: 0,
            description: tr.description || `${client.companyName || client.name} - ${tr.docNo || '1'}`,
            docType: isSupplier ? 'SupplierOperation' : 'ClientOperation',
            docNo: tr.docNo || '1',
            voucher: tr.voucherNo || '',
            genNo: `TR${tr.id.slice(0, 4).toUpperCase()}`,
            currency: tr.originalCurrency || 'SAR',
            originalAmount: tr.originalAmount || tr.amount
          });
        }
        if (isRefundDebit) {
          list.push({
            date: tr.date,
            debit: tr.amount,
            credit: 0,
            balance: 0,
            description: `Refund - ${tr.description || `${client.companyName || client.name} - ${tr.docNo || '1'}`}`,
            docType: isSupplier ? 'SupplierRefund' : 'ClientRefund',
            docNo: tr.docNo || '1',
            voucher: tr.voucherNo || '',
            genNo: `TR${tr.id.slice(0, 4).toUpperCase()}`,
            currency: tr.originalCurrency || 'SAR',
            originalAmount: tr.originalAmount || tr.amount
          });
        }
      }
    });

    list.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = round2(originalOpeningBalance + priorDebits - priorCredits);

    const statementLines: StatementLine[] = list.map(item => {
      runningBalance = safeSubtract(safeAdd(runningBalance, item.debit), item.credit);
      return {
        ...item,
        balance: runningBalance
      };
    });

    // Remove balance forward - only show actual transactions
    return statementLines;
  };

  const lines = getStatementEntries();
  const totalDebit = sumAmounts(lines.map(l => l.debit));
  const totalCredit = sumAmounts(lines.map(l => l.credit));
  // Final balance: negative = they owe us, positive = they have credit/overpaid
  const rawFinalBalance = lines.length > 0 ? lines[lines.length - 1].balance : 0;
  const finalBalance = round2(-rawFinalBalance); // Invert: negative=owes, positive=credit

  // Pending Requests: ALL reservations with outstanding balance (Paid < Total), regardless of status
  const pendingRequests = React.useMemo(() => {
    return reservations
      .filter(res => {
        // Include ALL statuses (Definite, Tentative, Confirmed, Cancelled) as long as money is owed
        if (isSupplier && res.supplierId !== client.id) return false;
        if (!isSupplier && res.clientId !== client.id) return false;
        const { totalSell, totalBuy } = getReservationTotals(res);
        const total = isSupplier ? totalBuy : totalSell;
        const paid = isSupplier ? (res.amountPaidToSupplier || 0) : (res.amountPaidByClient || 0);
        return total > 0 && paid < total; // outstanding balance > 0
      })
      .map(res => {
        const { totalSell, totalBuy } = getReservationTotals(res);
        const total = isSupplier ? totalBuy : totalSell;
        const paid = isSupplier ? (res.amountPaidToSupplier || 0) : (res.amountPaidByClient || 0);
        const outstanding = safeSubtract(total, paid);
        const hotel = hotels.find(h => h.id === res.hotelId);
        return { res, total, paid, outstanding, hotel };
      })
      .sort((a, b) => {
        // Sort by reservation creation date (oldest first) for aging visibility
        const dateA = a.res.createdAt ? a.res.createdAt.split(' ')[0] : a.res.checkIn;
        const dateB = b.res.createdAt ? b.res.createdAt.split(' ')[0] : b.res.checkIn;
        return dateA.localeCompare(dateB);
      });
  }, [reservations, client.id, isSupplier, hotels]);

  // Calculate reconciliation: difference between overall outstanding and pending table sum
  // This accounts for opening balance, prior-period reservations, and unlinked payments
  const pendingTableOutstanding = sumAmounts(pendingRequests.map(p => p.outstanding));
  const overallOutstanding = finalBalance < 0 ? absAmount(finalBalance) : 0;
  const reconciliationDiff = safeSubtract(overallOutstanding, pendingTableOutstanding);

  const [isGenerating, setIsGenerating] = useState(false);
  const [printError, setPrintError] = useState(false);

  // Pre-compress images for smaller PDF file size (WhatsApp-friendly)
  React.useEffect(() => { compressImagesForPrint('print-area'); }, []);

  const handlePrint = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setPrintError(false);
    try {
      const safeClientName = (client.companyName || client.name || 'Client').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      const success = await exportPDF('print-area', `${safeClientName}'s Account Statement.pdf`, { landscape: true });
      if (success) {
        setTimeout(onClose, 400);
      } else {
        setPrintError(true);
      }
    } catch (e) {
      console.error('PDF generation failed:', e);
      setPrintError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:bg-white print:static print:inset-auto print:flex-none print:p-0" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[95dvh] overflow-hidden animate-in fade-in zoom-in-95 my-4 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none" onClick={(e) => e.stopPropagation()}>
        
        {/* Actions bar — flex-shrink-0 */}
        <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 pt-4 pb-4 mb-0 no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-slate-705 bg-amber-500 animate-pulse"></span>
            <h2 className="text-lg font-bold text-slate-800 font-sans">
              {t('srpdf.title')} ({isSupplier ? t('srpdf.supplierLabel') : t('srpdf.clientLabel')} PDF)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={stampVisible} onChange={e => setStampVisible(e.target.checked)} className="rounded" /> Stamp
            </label>
            {stampVisible && (
              <button
                onClick={() => { setStampPosition('bottom-right'); saveStampSettings({ enabled: stampVisible, position: 'bottom-right', opacity: 0.85 }); }}
                className="px-2 py-1 border rounded text-xs bg-white hover:bg-slate-50 text-slate-500 cursor-pointer"
                title="Reset stamp to default position"
              >Reset</button>
            )}
            <PageBreakToggle />
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm cursor-pointer min-h-[44px]"
            >
              {isGenerating ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              )}
              {isGenerating ? 'Generating...' : t('srpdf.printSavePDF')}
            </button>
            {printError && (
              <button onClick={() => { setPrintError(false); setIsGenerating(false); }} className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium px-3 py-2 rounded-lg transition text-sm cursor-pointer min-h-[44px]">Reset</button>
            )}
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition cursor-pointer"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
        {/* Printable Paper Area (A4) */}
        <div id="print-area" className="relative bg-white p-4 md:p-6 pb-8 border border-slate-200 text-slate-800 font-sans shadow-inner overflow-y-auto print:p-0 print:pb-0 print:border-none print:shadow-none print:overflow-visible">
          <StampOverlay
            visible={stampVisible}
            position={stampPosition}
            opacity={0.85}
            onPositionChange={(pos) => { setStampPosition(pos); saveStampSettings({ enabled: stampVisible, position: pos, opacity: 0.85 }); }}
          />
          
          {/* Document Header */}
          <MasterPDFHeader />

          {/* Title bar */}
          <div className="flex justify-between items-baseline mb-3 mt-1 border-b border-slate-200 pb-2 flex-nowrap gap-4">
            <h1 className="text-xl font-extrabold text-[#0f172a] font-sans tracking-wide whitespace-nowrap flex-shrink-0">{t('srpdf.clientStatementTitle')}</h1>
            <h1 className="text-xl font-bold text-[#0f172a] font-serif whitespace-nowrap flex-shrink-0">{isSupplier ? 'كشف حساب المورد' : 'كشف حساب العميل'}</h1>
          </div>

          {/* Statement metadata matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 text-[10px] border border-slate-200 rounded-lg p-3 mb-3 text-slate-700 bg-slate-50/50 text-left print:bg-slate-50 no-page-break">
            <div className="space-y-1">
              <p><span className="font-bold text-slate-900 min-w-[100px] inline-block">{isSupplier ? `${t('srpdf.supplierLabel')} :` : `${t('srpdf.clientLabel')} :`}</span> <span className="text-slate-950 font-semibold">{client.companyName || client.name}</span></p>
              <p><span className="font-bold text-slate-900 min-w-[100px] inline-block">{t('srpdf.viewInternals')}</span> {t('srpdf.excludeInternals')}</p>
              <p><span className="font-bold text-slate-900 min-w-[100px] inline-block">{t('srpdf.accountsLabel')}</span> {isSupplier ? `${t('srpdf.suppliers')}` : `${t('srpdf.customers')}`}</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">{t('srpdf.fromDateLabel')}</span> {formatStandardDate(fromDate)}</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">{t('srpdf.statusLabel')}</span> {t('srpdf.allStatuses')}</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">{t('srpdf.refCustomer')}</span></p>
            </div>
            <div className="space-y-1">
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">{t('srpdf.toDateLabel')}</span> {formatStandardDate(toDate)}</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">{t('srpdf.viewLabel')}</span> {t('srpdf.withoutOpposite')}</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">{t('srpdf.refVendor')}</span></p>
            </div>
          </div>

          {/* Show Pending label */}
          <div className="text-left font-semibold text-[10px] text-slate-800 mb-1.5">
            {t('srpdf.showPending')}
          </div>

          {/* Statement of Account Ledger */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto mb-4 print:overflow-visible print:border-none print:rounded-none arrival-report-table">
            <table className="w-full text-left border-collapse text-[9px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.entryDate')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-right overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.debitCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-right overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.creditCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-right overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.balanceCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.descriptionCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.docType')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.refCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.voucherCol')}</th>
                  <th className="py-1.5 px-1.5 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('srpdf.genNoCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {lines.length > 0 ? (
                  lines.map((line, idx) => {
                    // Inverted balance: negative = owes us, positive = has credit
                    const displayBal = -line.balance;
                    const balStr = Math.abs(displayBal).toLocaleString('en-US', { minimumFractionDigits: 2 });
                    return (
                      <React.Fragment key={idx}>
                        {renderInsertZone(idx)}
                        <tr className="bg-white hover:bg-slate-50/50 text-slate-800">
                          <td className="py-1.5 px-1.5 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap font-mono">{formatStandardDate(line.date)}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-semibold">
                          {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-semibold">
                          {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-extrabold ${displayBal < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {displayBal < 0 ? `(${balStr})` : balStr}
                        </td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap font-sans" title={line.description}>{line.description}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-600 font-sans overflow-hidden text-ellipsis whitespace-nowrap">
                          {line.docType.replace('ClientReservation', 'Reservation').replace('SupplierReservation', 'Reservation').replace('ClientOperation', 'Payment').replace('SupplierOperation', 'Payment').replace('ClientRefund', 'Refund').replace('SupplierRefund', 'Refund')}
                        </td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono font-semibold overflow-hidden text-ellipsis whitespace-nowrap">RSV-{line.docNo}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">{line.voucher || ''}</td>
                          <td className="py-1.5 px-1.5 font-mono font-black text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">{line.genNo}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-400 italic">{t('srpdf.noOperations')}</td>
                  </tr>
                )}

                {/* Period Row */}
                <tr className="bg-slate-50 font-bold border-t border-slate-300 keep-with-prev">
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-700">{t('srpdf.periodRow')}</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-bold ${totalDebit - totalCredit > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {totalDebit - totalCredit > 0 ? (totalDebit - totalCredit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : totalDebit - totalCredit < 0 ? `(${Math.abs(totalDebit - totalCredit).toLocaleString('en-US', { minimumFractionDigits: 2 })})` : '0.00'}
                  </td>
                  <td colSpan={5} className="py-1.5 px-1.5 border-slate-200 bg-slate-50"></td>
                </tr>

                {/* Total Row */}
                <tr className="bg-slate-100 font-extrabold border-t border-slate-300 keep-with-prev">
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-900">{t('srpdf.totalRow')}</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono text-slate-950 ${finalBalance < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {finalBalance < 0 ? `(${Math.abs(finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })})` : finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={5} className="py-1.5 px-1.5 border-slate-200 bg-slate-100/80"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total Balance Outstanding */}
          <div className={`border rounded-lg overflow-hidden grid grid-cols-2 text-[11px] font-black uppercase text-left mb-4 keep-with-prev no-page-break ${finalBalance < 0 ? 'border-rose-300 bg-rose-50/50' : finalBalance > 0 ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
            <span className="py-2.5 px-3 border-r border-slate-200 text-slate-700 flex items-center gap-2">
              <span className="text-sm">{finalBalance < 0 ? '💳' : finalBalance > 0 ? '✅' : '✅'}</span>
              {finalBalance < 0 ? t('srpdf.outstandingBalance') : finalBalance > 0 ? t('srpdf.creditBalance') : t('srpdf.balanceSettled')}
            </span>
            <span className={`py-2.5 px-3 font-mono text-right font-black text-base ${finalBalance < 0 ? 'text-rose-700' : finalBalance > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
              {finalBalance < 0 ? `-${Math.abs(finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
            </span>
          </div>

          {/* Dual-Currency Outstanding Summary */}
          {(() => {
            // Group outstanding by original currency
            const currencyTotals: Record<string, { owed: number; sarValue: number }> = {};
            lines.forEach(line => {
              const curr = line.currency || 'SAR';
              if (!currencyTotals[curr]) currencyTotals[curr] = { owed: 0, sarValue: 0 };
              // Net debit (what they owe) = debit - credit
              const netOwed = line.debit - line.credit;
              if (curr !== 'SAR') {
                // For foreign currency, track the original currency amount owed
                const origOwed = (line.originalAmount || 0) * (line.debit > 0 ? 1 : -1);
                currencyTotals[curr].owed = safeAdd(currencyTotals[curr].owed, origOwed);
              } else {
                currencyTotals[curr].owed = safeAdd(currencyTotals[curr].owed, netOwed);
              }
              // SAR value is always the normalized debit-credit
              currencyTotals[curr].sarValue = safeAdd(currencyTotals[curr].sarValue, netOwed);
            });
            const hasMultipleCurrencies = Object.keys(currencyTotals).length > 1;
            if (!hasMultipleCurrencies) return null;
            const totalSARValue = Object.values(currencyTotals).reduce((s, c) => safeAdd(s, c.sarValue), 0);
            return (
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4 keep-with-prev no-page-break">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                  <h3 className="text-[10px] font-extrabold text-slate-700 uppercase">Outstanding by Currency</h3>
                </div>
                <div className="p-3 space-y-1.5">
                  {Object.entries(currencyTotals).sort(([a], [b]) => a.localeCompare(b)).map(([curr, data]) => (
                    <div key={curr} className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-700">Total Owed in {curr}:</span>
                      <span className={`font-mono font-bold ${data.owed > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {data.owed > 0 ? data.owed.toLocaleString('en-US', { minimumFractionDigits: 2 }) : `(${Math.abs(data.owed).toLocaleString('en-US', { minimumFractionDigits: 2 })})`} {curr}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-300 pt-1.5 mt-1.5 flex justify-between items-center text-[11px]">
                    <span className="font-extrabold text-slate-900 uppercase">Total Account Value (in SAR):</span>
                    <span className={`font-mono font-extrabold text-sm ${totalSARValue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {totalSARValue > 0 ? totalSARValue.toLocaleString('en-US', { minimumFractionDigits: 2 }) : `(${Math.abs(totalSARValue).toLocaleString('en-US', { minimumFractionDigits: 2 })})`} SAR
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Pending Requests Table (Unpaid / Partially Paid) */}
          {(pendingRequests.length > 0 || Math.abs(reconciliationDiff) > 0.01) && (
            <div className="mb-4 no-page-break">
              {/* Section Header */}
              <div className="flex justify-between items-baseline mb-2 mt-2 border-b-2 border-amber-400 pb-1.5 flex-nowrap gap-4">
                <h2 className="text-sm font-extrabold text-[#0f172a] font-sans tracking-wide uppercase whitespace-nowrap flex-shrink-0">
                  {isSupplier ? 'Pending Supplier Requests' : 'Pending Client Requests'}
                </h2>
                <h2 className="text-sm font-bold text-[#0f172a] font-serif">
                  {isSupplier ? '\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0627\u062a \u0627\u0644\u0645\u0639\u0644\u0642\u0629' : '\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0627\u062a \u0627\u0644\u0645\u0639\u0644\u0642\u0629'}
                </h2>
              </div>
              <p className="text-[9px] text-slate-500 mb-2 italic">All reservations with outstanding balance (Paid &lt; Total), sorted oldest first</p>

              <div className="border border-slate-200 rounded-lg overflow-x-auto print:overflow-visible print:border-none print:rounded-none arrival-report-table">
                <table className="w-full text-left border-collapse text-[9px]" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-amber-50/80 text-slate-700 font-extrabold border-b border-slate-200">
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-left whitespace-nowrap">RSV#</th>
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-left whitespace-nowrap">Guest Name</th>
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-left whitespace-nowrap">Hotel</th>
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-center whitespace-nowrap">Check-in</th>
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-center whitespace-nowrap">Check-out</th>
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-right whitespace-nowrap">Total (SAR)</th>
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-right whitespace-nowrap">Paid (SAR)</th>
                      <th className="py-1.5 px-1.5 border-r border-slate-200 text-right whitespace-nowrap">Outstanding</th>
                      <th className="py-1.5 px-1.5 text-center whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {pendingRequests.map(({ res, total, paid, outstanding, hotel }) => (
                      <tr key={res.id} className="bg-white hover:bg-slate-50/50 text-slate-800">
                        <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono font-bold">{res.id}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">{res.guestName}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap" title={hotel?.name || ''}>{hotel?.name || 'N/A'}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-center font-mono">{formatStandardDate(res.checkIn)}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-center font-mono">{formatStandardDate(res.checkOut)}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-semibold">{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono text-emerald-700">{paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-extrabold ${outstanding > 0 ? 'text-rose-700' : 'text-slate-600'}`}>{outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-1.5 px-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                            res.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                            res.status === 'Tentative' ? 'bg-amber-100 text-amber-800' :
                            res.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>{res.status}</span>
                        </td>
                      </tr>
                    ))}
                    {/* Reconciliation row if opening balance or prior-period items create a difference */}
                    {Math.abs(reconciliationDiff) > 0.01 && (
                      <tr className="bg-slate-50 font-semibold border-t border-slate-200 italic text-slate-600" title="This adjustment accounts for opening balance carried forward, prior-period reservations, and payments not shown in the current date range.">
                        <td colSpan={5} className="py-1.5 px-1.5 border-r border-slate-200 text-right" title="Difference between ledger outstanding and pending table sum">Prior Period / Opening Balance Adj.:</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">—</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">—</td>
                        <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-bold ${reconciliationDiff > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {reconciliationDiff > 0 ? reconciliationDiff.toLocaleString('en-US', { minimumFractionDigits: 2 }) : `(${Math.abs(reconciliationDiff).toLocaleString('en-US', { minimumFractionDigits: 2 })})`}
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-mono text-[8px] text-slate-400">adj.</td>
                      </tr>
                    )}
                    {/* Pending Totals Row — matches Outstanding Balance from main statement */}
                    <tr className="bg-amber-50/80 font-extrabold border-t border-amber-300">
                      <td colSpan={5} className="py-1.5 px-1.5 border-r border-slate-200 text-slate-900 text-right">Outstanding Balance:</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">
                        {sumAmounts(pendingRequests.map(p => p.total)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono text-emerald-700">
                        {sumAmounts(pendingRequests.map(p => p.paid)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono text-rose-700">
                        {overallOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-1.5 text-center font-mono text-[8px] text-slate-500">{pendingRequests.length} item{pendingRequests.length !== 1 ? 's' : ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legal disclaimer */}
          <div className="text-[9px] text-slate-650 font-medium italic mt-6 border-t border-slate-200 pt-3 leading-relaxed text-left">
            {t('srpdf.legalDisclaimer')}
          </div>

          {/* Footer - screen only */}
          <div className="flex justify-between items-center text-[10.5px] text-slate-500 mt-10 select-none leading-none font-sans pt-4 no-print">
            <div className="text-left">
              <span className="font-semibold text-slate-700">{t('srpdf.preparedBy')}</span> - {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="font-mono text-right uppercase text-slate-600 font-extrabold">
              {t('cpdf.pageOf')}
            </div>
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}
