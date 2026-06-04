/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Transaction, Agent, Reservation } from '../types';
import ZumraLogo from './ZumraLogo';
import { downloadPDF } from '../lib/pdfGenerator';

interface ReceiptVoucherPDFProps {
  transaction: Transaction;
  client: Agent | undefined;
  reservation?: Reservation;
  onClose: () => void;
}

export default function ReceiptVoucherPDF({ transaction, client, reservation, onClose }: ReceiptVoucherPDFProps) {
  
  // Helper to convert number to words briefly in English/Arabic
  const amountToWords = (num: number): string => {
    const formatNum = num.toLocaleString('en-US', { minimumFractionDigits: 2 });
    return `${formatNum} Saudi Riyals Only`;
  };

  const handlePrint = () => {
    downloadPDF('print-area', `Receipt-${transaction.id}.pdf`);
  };

  const getWhatsAppReceiptLink = () => {
    const text = `*ZUMRA HOTELS - Payment Receipt*\n` +
      `*Receipt No:* ${transaction.voucherNo}\n` +
      `*Received From:* ${client?.companyName || client?.name || 'Client'}\n` +
      `*Amount:* ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR\n` +
      `*Payment Method:* ${transaction.paymentMethod}\n` +
      `*Description:* ${transaction.description}\n` +
      `*Date:* ${transaction.date}\n` +
      `Thank you for your payment!`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:static print:inset-auto print:flex-none print:p-0">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 animate-in fade-in zoom-in-95 my-12 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none">
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6 font-sans no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-lg font-bold text-slate-800">
              Print Receipt Voucher ({transaction.voucherNo})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print / Save to PDF
            </button>
            <a
              href={getWhatsAppReceiptLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-705 hover:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              Share via WhatsApp
            </a>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div id="print-area" className="bg-white p-10 border border-emerald-150 text-slate-800 font-sans shadow-inner max-h-[65vh] overflow-y-auto no-scrollbar print:p-0 print:border-none print:shadow-none print:max-h-full">
          
          {/* Document Header: Company Name LEFT + Logo RIGHT */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex flex-col text-left font-sans gap-1 flex-1">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
                ZUMRA HOTELS
              </span>
              <span className="text-2xl font-bold text-slate-800 tracking-wider font-serif" dir="rtl">
                زمرة للفنادق
              </span>
            </div>
            <div className="flex-shrink-0 flex justify-end">
              <ZumraLogo size="xxl" />
            </div>
          </div>

          {/* Golden Separator Line */}
          <div className="border-t-4 border-[#C1A168] w-full my-4"></div>

          {/* Title bar banner */}
          <div className="bg-emerald-50 border border-emerald-205 text-center py-2.5 rounded-lg mb-6 flex justify-between px-6 items-center print:bg-emerald-50 font-sans">
            <span className="text-emerald-805 font-extrabold text-[#065f46] text-xs tracking-wider">
              {transaction.paymentMethod === 'Cash' ? 'CASH RECEIPT VOUCHER' : 'BANK TRANSFER RECEIPT'}
            </span>
            <span className="text-lg font-serif font-bold text-emerald-900">سند قبض {transaction.paymentMethod === 'Cash' ? 'نقدية' : 'تحويل بنكي'}</span>
            <span className="font-mono text-emerald-850 font-black bg-white px-2.5 py-0.5 rounded shadow-sm text-xs truncate max-w-[120px]">{transaction.voucherNo}</span>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-2 gap-y-4 text-xs border border-slate-200 rounded-xl p-4 mb-6 font-sans">
            <div>
              <span className="text-slate-500 block mb-0.5 text-[10px] uppercase font-bold tracking-wider">Date / التاريخ</span>
              <span className="font-bold text-slate-900">{new Date(transaction.date).toLocaleDateString('en-GB')}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block mb-0.5 text-[10px] uppercase font-bold tracking-wider">Receipt No. / رقم السند</span>
              <span className="font-extrabold text-slate-950 font-mono">{transaction.voucherNo}</span>
            </div>

            <div className="col-span-2 border-t border-slate-100 pt-2.5">
              <span className="text-slate-500 block mb-0.5 text-[10px] uppercase font-bold tracking-wider text-left">Received From / استلمنا من السيد</span>
              <span className="font-extrabold text-slate-950 uppercase text-sm text-left block">{client?.companyName || client?.name || 'N/A'}</span>
            </div>

            <div className="col-span-2 border-t border-slate-100 pt-2.5 flex justify-between items-center bg-slate-50 p-2.5 rounded-lg">
              <div>
                <span className="text-slate-505 block mb-0.5 text-[10px] uppercase font-bold tracking-wider text-left">Sum Of / مبلغ وقدره</span>
                <span className="font-bold text-slate-950 text-xs italic text-left block">{amountToWords(transaction.amount)}</span>
              </div>
              <div className="bg-emerald-800 text-white font-mono px-4 py-1.5 rounded-md text-sm font-black tracking-wider shadow">
                {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
              </div>
            </div>

            <div className="col-span-2 border-t border-slate-100 pt-2.5 text-left">
              <span className="text-slate-505 block mb-0.5 text-[10px] uppercase font-bold tracking-wider">Being / وذلك مقابل</span>
              <span className="font-bold text-slate-800">{transaction.description}</span>
            </div>

            {reservation && (
              <div className="col-span-2 border-t border-slate-100 pt-2.5 grid grid-cols-3 gap-2 bg-amber-50/40 p-2.5 rounded-lg text-[11px] border border-amber-100/50 text-left">
                <div>
                  <span className="text-amber-805 font-bold block">Booking ID:</span>
                  <span className="font-mono text-slate-900 font-bold">RSV-{reservation.id}</span>
                </div>
                <div>
                  <span className="text-amber-805 font-bold block">Guest Name:</span>
                  <span className="uppercase text-slate-900 font-bold">{reservation.guestName}</span>
                </div>
                <div>
                  <span className="text-amber-805 font-bold block">Period:</span>
                  <span className="text-slate-900 font-semibold">{reservation.checkIn} to {reservation.checkOut}</span>
                </div>
              </div>
            )}

            <div className="col-span-2 border-t border-slate-100 pt-2.5 grid grid-cols-2 gap-4">
              <div className="text-left">
                <span className="text-slate-500 block mb-0.5 text-[10px] uppercase font-bold tracking-wider">Payment Method / طريقة الدفع</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 text-emerald-805 px-2.5 py-0.5 rounded-full inline-block mt-0.5 text-[11px] border border-emerald-150">
                  {transaction.paymentMethod}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block mb-0.5 text-[10px] uppercase font-bold tracking-wider">Recorded By / تسجيل بواسطة</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">{transaction.createdBy}</span>
              </div>
            </div>
          </div>

          {/* Guidelines notes */}
          <div className="text-[10px] text-slate-500 italic leading-normal mb-8 border-l-2 border-emerald-505 pl-3 text-left font-sans">
            Important Notice: All client financial accounts must be settled within the designated period as per terms of the contract. No modifications are permitted without the Finance Department Manager's wet signature.
          </div>

          {/* Footer & Authorized Signatures */}
          <div className="grid grid-cols-3 gap-4 text-center border-t border-slate-150 pt-8 text-[11px] font-sans">
            <div>
              <p className="font-semibold text-slate-700">Accountant</p>
              <p className="text-slate-400 mt-1">المحاسب</p>
              <div className="h-10 mt-2 border-b border-dashed border-slate-300 w-3/4 mx-auto"></div>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Heir / Receiver</p>
              <p className="text-slate-400 mt-1">المستلم</p>
              <div className="h-10 mt-2 border-b border-dashed border-slate-300 w-3/4 mx-auto"></div>
            </div>
            <div>
              <p className="font-semibold text-slate-700">General Manager</p>
              <p className="text-slate-400 mt-1">المدير العام</p>
              <div className="h-10 mt-2 border-b border-dashed border-slate-300 w-3/4 mx-auto"></div>
            </div>
          </div>

          <div className="text-center font-mono text-[9px] text-slate-400 mt-10 no-print">
            Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB')}
          </div>

        </div>
      </div>
    </div>
  );
}
