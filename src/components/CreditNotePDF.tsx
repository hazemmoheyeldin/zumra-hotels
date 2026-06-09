/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel, CreditNoteEntry } from '../types';
import MasterPDFHeader from './MasterPDFHeader';
import { exportPDF } from '../lib/pdfGenerator';

interface CreditNotePDFProps {
  reservation: Reservation;
  agents: Agent[];
  hotels: Hotel[];
  entry: CreditNoteEntry;
  onClose: () => void;
}

export default function CreditNotePDF({ reservation, agents, hotels, entry, onClose }: CreditNotePDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const hotel = hotels.find(h => h.id === reservation.hotelId);
  const client = agents.find(a => a.id === reservation.clientId);
  const supplier = agents.find(a => a.id === reservation.supplierId);

  const isCredit = entry.type.includes('Credit');
  const isClientSide = entry.type.includes('Client');
  const recipient = isClientSide ? client : supplier;
  const docTitle = isCredit ? 'Credit Note' : 'Debit Note';
  const docColor = isCredit ? 'emerald' : 'rose';

  const handlePrint = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await exportPDF('credit-note-sheet', `${docTitle.replace(' ', '_')}_${entry.docNo}`);
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-4 shadow-2xl">
        {/* Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800">📄 {docTitle} - {entry.docNo}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={isGenerating} className={`px-4 py-2 bg-${docColor}-600 text-white rounded-lg text-xs font-bold hover:bg-${docColor}-700 disabled:bg-slate-300 transition`}>
              {isGenerating ? '⏳ Generating...' : '🖨️ Print PDF'}
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition">Close</button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          <div id="credit-note-sheet" className="bg-white p-10 font-sans text-[11px] text-slate-800 max-w-[210mm] mx-auto">

            {/* Header */}
            <MasterPDFHeader
              rightSlot={
                <div className={`border-2 border-${docColor}-500 rounded-xl px-5 py-3 text-center`}>
                  <h2 className={`text-xl font-black text-${docColor}-700 uppercase`}>{docTitle}</h2>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{entry.docNo}</p>
                </div>
              }
            />

            {/* Date and Reference */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Date Issued</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{entry.createdAt}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Issued By</span>
                  <span className="text-sm font-bold text-slate-800">{entry.createdBy}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Recipient</span>
                  <span className="text-sm font-bold text-slate-800">{recipient?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Reservation Reference</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">RSV-{reservation.id}</span>
                </div>
              </div>
            </div>

            {/* Booking Summary */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Booking Summary</h3>
              <div className="grid grid-cols-4 gap-4 text-[10px]">
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Guest</span>
                  <span className="font-bold text-slate-800">{reservation.guestName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Hotel</span>
                  <span className="font-bold text-slate-800">{hotel?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Check-In</span>
                  <span className="font-bold text-slate-800 font-mono">{reservation.checkIn}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Check-Out</span>
                  <span className="font-bold text-slate-800 font-mono">{reservation.checkOut}</span>
                </div>
              </div>
            </div>

            {/* Amount and Reason */}
            <div className={`border-2 border-${docColor}-200 rounded-xl p-6 mb-8`}>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Amount</span>
                  <span className={`text-2xl font-black text-${docColor}-700`}>{entry.amount.toLocaleString()} <span className="text-sm">SAR</span></span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Type</span>
                  <span className={`text-sm font-bold text-${docColor}-700 uppercase`}>
                    {isCredit ? '↩️ Credit (Refund / Adjustment)' : '↗️ Debit (Additional Charge)'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isClientSide ? 'Client Account' : 'Supplier Account'}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Reason</span>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">{entry.reason}</p>
              </div>
            </div>

            {/* Signature */}
            <div className="mt-12 flex justify-between items-end">
              <div className="text-[9px] text-slate-400">
                <p>This document was generated electronically by Zumra Hotels RMS.</p>
                <p>For questions, contact your account manager.</p>
              </div>
              <div className="text-center">
                <div className="border-b border-slate-400 w-48 mb-1"></div>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Authorized Signature</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
