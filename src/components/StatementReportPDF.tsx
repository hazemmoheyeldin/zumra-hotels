/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Reservation, Agent, Transaction } from '../types';
import { getReservationTotals } from '../lib/storage';
import ZumraLogo from './ZumraLogo';
import { downloadPDF } from '../lib/pdfGenerator';
import { usePageBreaks } from '../lib/usePageBreaks';

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
}

interface StatementReportPDFProps {
  client: Agent;
  reservations: Reservation[];
  transactions: Transaction[];
  fromDate: string;
  toDate: string;
  isSupplier?: boolean;
  onClose: () => void;
}

export default function StatementReportPDF({ client, reservations, transactions, fromDate, toDate, isSupplier, onClose }: StatementReportPDFProps) {
  const { renderInsertZone, PageBreakToggle } = usePageBreaks();
  
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
        allLifetimeLegacyCredits += tr.amount;
      }
      if (isClientRefund || isSupplierRefund) {
        allLifetimeLegacyCredits -= tr.amount; // Refunds reverse payment effect
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
          priorDebits += amount;
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
          genNo: `TR${res.id}`
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
            genNo: `TR${res.id}_C`
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
        if (isPaymentCredit) priorCredits += tr.amount;
        if (isRefundDebit) priorDebits += tr.amount;
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
            genNo: `TR${tr.id.slice(0, 4).toUpperCase()}`
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
            genNo: `TR${tr.id.slice(0, 4).toUpperCase()}`
          });
        }
      }
    });

    list.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = originalOpeningBalance + priorDebits - priorCredits;

    const statementLines: StatementLine[] = list.map(item => {
      runningBalance = runningBalance + item.debit - item.credit;
      return {
        ...item,
        balance: runningBalance
      };
    });

    // Remove balance forward - only show actual transactions
    return statementLines;
  };

  const lines = getStatementEntries();
  const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
  const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
  // Final balance: negative = they owe us, positive = they have credit/overpaid
  const rawFinalBalance = lines.length > 0 ? lines[lines.length - 1].balance : 0;
  const finalBalance = -rawFinalBalance; // Invert: negative=owes, positive=credit

  const handlePrint = () => {
    const safeClientName = (client.companyName || client.name || 'Client').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    downloadPDF('print-area', `Statement of Account - ${safeClientName}.pdf`, { landscape: true });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:static print:inset-auto print:flex-none print:p-0">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full p-6 animate-in fade-in zoom-in-95 my-4 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none">
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4 no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-slate-705 bg-amber-500 animate-pulse"></span>
            <h2 className="text-lg font-bold text-slate-800 font-sans">
              Statement of Account ({isSupplier ? 'Supplier' : 'Client'} PDF)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <PageBreakToggle />
            <button
              onClick={handlePrint}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print / Save to PDF
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Paper Area (A4) */}
        <div id="print-area" className="bg-white p-6 border border-slate-200 text-slate-800 font-sans shadow-inner max-h-[75vh] overflow-y-auto print:p-0 print:border-none print:shadow-none print:max-h-full">
          
          {/* Document Header: Company Name LEFT + Logo RIGHT */}
          <div className="flex justify-between items-center pb-2">
            <div className="flex flex-col text-left font-sans gap-0.5 flex-1">
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
                ZUMRA HOTELS
              </span>
              <span className="text-xl font-bold text-slate-800 tracking-wider font-serif" dir="rtl">
                زمرة للفنادق
              </span>
            </div>
            <div className="flex-shrink-0 flex justify-end">
              <ZumraLogo size="xxl" />
            </div>
          </div>

          {/* Golden Separator Line */}
          <div className="border-t-4 border-[#C1A168] w-full my-2"></div>

          {/* Title bar */}
          <div className="flex justify-between items-baseline mb-3 mt-1 border-b border-slate-200 pb-2">
            <h1 className="text-xl font-extrabold text-[#0f172a] font-sans tracking-wide">Statement Of Account</h1>
            <h1 className="text-xl font-bold text-[#0f172a] font-serif">{isSupplier ? 'كشف حساب المورد' : 'كشف حساب العميل'}</h1>
          </div>

          {/* Statement metadata matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] border border-slate-200 rounded-lg p-3 mb-3 text-slate-700 bg-slate-50/50 text-left">
            <div className="space-y-1">
              <p><span className="font-bold text-slate-900 min-w-[100px] inline-block">{isSupplier ? 'Supplier :' : 'Client :'}</span> <span className="text-slate-950 font-semibold">{client.companyName || client.name}</span></p>
              <p><span className="font-bold text-slate-900 min-w-[100px] inline-block">View Internals :</span> Exclude Internals</p>
              <p><span className="font-bold text-slate-900 min-w-[100px] inline-block">Accounts :</span> {isSupplier ? 'Suppliers - الموردين' : 'Customers - العملاء'}</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">From Date :</span> {formatStandardDate(fromDate)}</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">Status :</span> All</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">Ref Customer :</span></p>
            </div>
            <div className="space-y-1">
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">To Date :</span> {formatStandardDate(toDate)}</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">View :</span> Without opposite transactions</p>
              <p><span className="font-bold text-slate-900 min-w-[80px] inline-block">Ref Vendor :</span></p>
            </div>
          </div>

          {/* Show Pending label */}
          <div className="text-left font-semibold text-[10px] text-slate-800 mb-1.5">
            Show Pending :
          </div>

          {/* Statement of Account Ledger */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-left border-collapse text-[9.5px]">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left">Entry Date</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-right">Debit</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-right">Credit</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-right">Balance</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left">Description</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left">Doc Type</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left">Doc No</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-left">Voucher</th>
                  <th className="py-1.5 px-1.5 text-left">Gen No</th>
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
                          <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono">{formatStandardDate(line.date)}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-semibold">
                          {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-semibold">
                          {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-extrabold ${displayBal < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {displayBal < 0 ? `-${balStr}` : balStr}
                        </td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 max-w-xs truncate font-sans">{line.description}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-600 font-sans">{line.docType}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono font-semibold">{line.docNo}</td>
                        <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono text-slate-500">{line.voucher || ''}</td>
                          <td className="py-1.5 px-1.5 font-mono font-black text-slate-900">{line.genNo}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-400 italic">No operations recorded for the client within this period.</td>
                  </tr>
                )}

                {/* Period Row */}
                <tr className="bg-slate-50 font-bold border-t border-slate-300 keep-with-prev">
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-700">Period:</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-bold ${finalBalance < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {finalBalance < 0 ? `-${Math.abs(totalDebit - totalCredit).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : (totalDebit - totalCredit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={5} className="py-1.5 px-1.5 border-slate-200 bg-slate-50"></td>
                </tr>

                {/* Total Row */}
                <tr className="bg-slate-100 font-extrabold border-t border-slate-300 keep-with-prev">
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-900">Total:</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono">{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-mono text-slate-950 ${finalBalance < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {finalBalance < 0 ? `-${Math.abs(finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={5} className="py-1.5 px-1.5 border-slate-200 bg-slate-100/80"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total Balance Outstanding */}
          <div className={`border rounded-lg overflow-hidden grid grid-cols-2 text-[10px] font-black uppercase text-left mb-4 keep-with-prev ${finalBalance < 0 ? 'border-rose-300' : 'border-emerald-300'}`}>
            <span className="py-2 px-3 bg-slate-50 border-r border-slate-200 text-slate-700">Total Balance:</span>
            <span className={`py-2 px-3 font-mono text-right font-black ${finalBalance < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {finalBalance < 0 ? `-${Math.abs(finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
            </span>
          </div>

          {/* Legal disclaimer */}
          <div className="text-[9px] text-slate-650 font-medium italic mt-6 border-t border-slate-200 pt-3 leading-relaxed text-left">
            Invoices and statement of accounts will be presumed to be accurate unless EST Zumra Hotels FOR HOTEL OPERATION receives a written notification of any errors within 10 days of receipt date.
          </div>

          {/* Footer - screen only */}
          <div className="flex justify-between items-center text-[10.5px] text-slate-500 mt-10 select-none leading-none font-sans pt-4 no-print">
            <div className="text-left">
              <span className="font-semibold text-slate-700">Prepared by: Zumra Hotels</span> - {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="font-mono text-right uppercase text-slate-600 font-extrabold">
              Page 1 of 1
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
