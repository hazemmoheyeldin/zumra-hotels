/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel, User, Account } from '../types';
import { getReservationTotals, getPaxForRoomType, abbreviateMealPlan } from '../lib/storage';
import ZumraLogo from './ZumraLogo';
import { downloadPDF } from '../lib/pdfGenerator';
import { usePageBreaks } from '../lib/usePageBreaks';
import { useLang } from '../lib/LanguageContext';

interface ConfirmationPDFProps {
  reservation: Reservation;
  client: Agent | undefined;
  hotel: Hotel | undefined;
  type: 'definite' | 'voucher';
  onClose: () => void;
  creatorName: string;
  users?: User[];
  accounts?: Account[];
}

export default function ConfirmationPDF({ reservation, client, hotel, type, onClose, creatorName, users = [], accounts = [] }: ConfirmationPDFProps) {
  const { PageBreakToggle } = usePageBreaks();
  const { t, lang } = useLang();
  const { totalSell, totalBuy, profit, vat, totalWithVat } = getReservationTotals(reservation);
  
  const creatorUser = users.find(u => u.username === reservation.createdBy || u.name === reservation.createdBy || u.name === creatorName);
  const creatorJobTitle = creatorUser?.jobTitle || 'Reservations Executive';
  
  // PDF layout calculations mirroring the exact VAT math of Saudi Arabia/Egypt
  const isDefinite = type === 'definite';
  
  // 15% VAT calculation: Total Sell is inclusive of VAT.
  // Net Accommodation = totalSell / 1.15
  // VAT = totalSell - Net Accommodation (15% of net)
  const calculatedVat = totalSell * (15 / 115); 
  const calculatedNet = totalSell - calculatedVat;

  const [isGenerating, setIsGenerating] = useState(false);
  const [printError, setPrintError] = useState(false);

  const handlePrint = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setPrintError(false);
    try {
      const status = reservation.status || 'Confirmation';
      const guestSafe = (reservation.guestName || 'Guest').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      const hotelName = (hotel?.name || 'Hotel').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      const dateRange = `${reservation.checkIn}_to_${reservation.checkOut}`;
      const today = new Date().toISOString().split('T')[0];
      const filename = type === 'voucher'
        ? `(v) RSV-${reservation.id} ${guestSafe}.pdf`
        : `RSV-${reservation.id} (${status}) ${today}.pdf`;
      const success = downloadPDF('print-area', filename, { landscape: false });
      if (!success) setPrintError(true);
    } catch (e) {
      console.error('PDF generation failed:', e);
      setPrintError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusLabel = () => {
    if (reservation.status === 'Tentative') return 'Tentative';
    if (reservation.status === 'Cancelled') return 'Cancelled';
    return 'Definite';
  };

  // Format Helper for dates as standard DD/MM/YYYY
  const formatStandardDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        // Assume YYYY-MM-DD
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

  const todayStr = new Date().toISOString().split('T')[0];

  // Construct whatsapp sharing text
  const getWhatsAppLink = () => {
    const statusText = getStatusLabel();
    const text = `*ZUMRA HOTELS - ${statusText} Confirmation*\n` +
      `*Res. No:* RSV-${reservation.id}\n` +
      `*Guest Name:* ${reservation.guestName}\n` +
      `*Hotel:* ${hotel?.name || 'Hotel'}\n` +
      `*Period:* ${formatStandardDate(reservation.checkIn)} to ${formatStandardDate(reservation.checkOut)} (${reservation.nights} Nights)\n` +
      `*Status:* ${reservation.status}\n` +
      `*Total Price:* ${totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR\n` +
      `*Confirmation No:* ${reservation.hotelConfirmationNo || 'Pending'}\n` +
      `Thank you for choosing Zumra Hotels!`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:static print:inset-auto print:flex-none print:p-0">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 my-8 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none print:bg-white">
        
        {/* Interactive action controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6 no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-lg font-bold text-slate-800">
              {isDefinite ? t('cpdf.clientConfirmDoc') : t('cpdf.clientRoomVoucher')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <PageBreakToggle />
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm cursor-pointer min-h-[44px]"
            >
              {isGenerating ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              )}
              {isGenerating ? 'Generating...' : t('cpdf.printSavePDF')}
            </button>
            {printError && (
              <button
                onClick={() => { setPrintError(false); setIsGenerating(false); }}
                className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium px-3 py-2 rounded-lg transition text-sm cursor-pointer min-h-[44px]"
              >
                Reset
              </button>
            )}
            <a
              href={getWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              {t('cpdf.shareWhatsApp')}
            </a>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition cursor-pointer"
            >
              {t('cpdf.closePreview')}
            </button>
          </div>
        </div>

        {/* PRINTABLE PAPER CONTAINER (A4 Layout) */}
        <div 
          id="print-area" 
          className="bg-white p-4 border border-slate-200 text-slate-900 font-sans shadow-inner max-h-[80vh] overflow-y-auto no-scrollbar print:p-3 print:border-none print:shadow-none print:max-h-full print:overflow-visible"
        >
          
          {/* Document Header: Company Name LEFT + Logo RIGHT */}
          <div className="flex justify-between items-center mb-0.5">
            <div className="flex flex-col text-left font-sans gap-0.5 flex-1">
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
                ZUMRA HOTELS
              </span>
              <span className="text-lg font-bold text-slate-800 tracking-wider font-serif" dir="rtl">
                زمرة للفنادق
              </span>
            </div>
            <div className="flex-shrink-0 flex justify-end">
              <ZumraLogo size="xxl" />
            </div>
          </div>

          {/* Golden Separator Line */}
          <div className="border-t-4 border-[#C1A168] w-full my-1.5"></div>

          {!isDefinite ? (
            /* Voucher Mode (Matches Screenshot Exactly) */
            <div className="space-y-3 pt-1 text-left">
              {/* Top metadata grid matching "Issue Date: 10/03/2026", "RSV#: 11" */}
              <div className="flex flex-col text-xs text-slate-800">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm"><span className="font-extrabold text-slate-900 inline-block w-24">{t('cpdf.issueDate')}</span> <span className="font-semibold">{formatStandardDate(reservation.createdAt ? reservation.createdAt.split(' ')[0] : todayStr)}</span></p>
                    <p className="text-sm"><span className="font-extrabold text-slate-900 inline-block w-24">{t('cpdf.guestName')}</span> <span className="uppercase text-slate-950 font-bold">{reservation.guestName}</span></p>
                    {reservation.nonRefundable && (
                      <p className="text-sm font-extrabold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 inline-block">
                        ⚠ NON-REFUNDABLE BOOKING
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-mono font-black text-slate-900"><span className="font-extrabold inline-block mr-3 text-sm text-slate-500 uppercase tracking-widest">RSV#:</span>{reservation.id}</p>
                  </div>
                </div>
                <div className="mt-2.5">
                  <p className="text-xs font-mono text-slate-500 font-bold"><span className="font-extrabold text-slate-900 inline-block w-24">RSV#:</span> {reservation.id}-1</p>
                </div>
              </div>

              {/* Central vertical attribute table matching the screenshot */}
              <div className="border border-slate-300 rounded-lg overflow-hidden mt-2">
                <table className="w-full text-left border-collapse text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-white">
                      <td className="w-1/4 py-2.5 px-3 font-black font-sans bg-slate-50 border-r border-slate-200 uppercase tracking-wider text-[10px] text-slate-700">{t('cpdf.hotelName')}</td>
                      <td className="py-2.5 px-3 font-extrabold text-[#111827] text-sm leading-tight">{hotel?.name || 'Hotel Name'}</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="w-1/4 py-2.5 px-3 font-black font-sans bg-slate-50 border-r border-slate-200 uppercase tracking-wider text-[10px] text-slate-700">{t('cpdf.typeOfRooms')}</td>
                      <td className="py-2.5 px-3 text-slate-900 font-semibold leading-relaxed space-y-1">
                        {reservation.rooms.map((room) => (
                          <div key={room.id} className="text-xs mb-1 last:mb-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-500 min-w-[12px]">{room.qty}</span>
                              <span className="font-bold">{room.roomType}</span>
                              <span className="text-slate-500 px-1">•</span>
                              <span className="text-slate-600">{abbreviateMealPlan(room.mealPlan)}</span>
                            </div>
                            <div className="pl-6 text-[10px] text-slate-500">
                              {t('cpdf.viewLabel')} {room.view || t('cpdf.standardView')}
                            </div>
                          </div>
                        ))}
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="w-1/4 py-2.5 px-3 font-black font-sans bg-slate-50 border-r border-slate-200 uppercase tracking-wider text-[10px] text-slate-700">{t('cpdf.confNo')}</td>
                      <td className="py-2.5 px-3 font-mono font-extrabold text-[#111827] text-sm">{reservation.hotelConfirmationNo || '-'}</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="w-1/4 py-2.5 px-3 font-black font-sans bg-slate-50 border-r border-slate-200 uppercase tracking-wider text-[10px] text-slate-700">{t('cpdf.checkIn')}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-xs">{formatStandardDate(reservation.checkIn)}</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="w-1/4 py-2.5 px-3 font-black font-sans bg-slate-50 border-r border-slate-200 uppercase tracking-wider text-[10px] text-slate-700">{t('cpdf.checkOut')}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-xs">{formatStandardDate(reservation.checkOut)}</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="w-1/4 py-2.5 px-3 font-black font-sans bg-slate-50 border-r border-slate-200 uppercase tracking-wider text-[10px] text-slate-700">{t('cpdf.clientRemarks')}</td>
                      <td className="py-2.5 px-3 text-slate-650 font-medium italic text-xs min-h-[30px]">
                        {reservation.termsAndConditions || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Staff block and signature matching bottom right */}
              <div className="flex justify-end pt-4 mt-2">
                <div className="w-64 text-left space-y-1 font-sans">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cpdf.staffName')}</p>
                  <p className="text-sm font-black text-slate-950 uppercase tracking-wide leading-tight">{creatorName || reservation.createdBy || 'Hazem Mohey El-Din'}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{creatorJobTitle}</p>
                  <p className="text-[11px] font-semibold text-slate-400 pt-4 border-t border-dashed border-slate-200 mt-4">{t('cpdf.stampSignature')}</p>
                </div>
              </div>

              {/* Page marker A4 footer - screen only */}
              <div className="flex justify-between items-center border-t border-slate-150 pt-3 mt-8 text-[10px] text-slate-400 no-print">
                <div>{t('cpdf.printed')} {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="font-mono text-right font-bold text-slate-505">{t('cpdf.pageOf')}</div>
              </div>
            </div>
          ) : (
            /* Classic Definite Confirmation Mode */
            <div className="text-left">
              {/* Date & Partner Metadata Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-1.5">
                <div className="space-y-1 text-slate-800 font-sans">
                  <p><span className="font-bold inline-block w-10 text-slate-705">{t('cpdf.dateLabel')}</span> {formatStandardDate(reservation.createdAt ? reservation.createdAt.split(' ')[0] : '2026-02-24')}</p>
                  <p className="font-medium"><span className="font-bold inline-block w-10 text-slate-705">{t('cpdf.toLabel')}</span> <span className="uppercase text-slate-900 font-semibold">{client?.name || client?.companyName || 'Marseilia Tours'}</span></p>
                </div>
                
                <div className="text-right flex flex-col items-end">
                  <h2 className="text-2xl font-bold text-[#b4babe] tracking-wider leading-tight uppercase font-sans">
                    {reservation.status === 'Cancelled' ? t('pdf.cancelled') : `${getStatusLabel()} ${t('cpdf.confirmation')}`}
                  </h2>
                  {reservation.nonRefundable && (
                    <span className="text-rose-700 font-extrabold text-[10px] uppercase font-mono tracking-wider bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1 inline-block">
                      NON-REFUNDABLE
                    </span>
                  )}
                  {reservation.status === 'Tentative' && reservation.clientOptionDate && (
                    <span className="text-rose-600 font-extrabold text-[10px] uppercase font-mono tracking-wider bg-rose-50 px-2 py-0.5 rounded border border-rose-100 mt-1 inline-block">
                      ⏰ {t('cpdf.optionDate')} {formatStandardDate(reservation.clientOptionDate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Letter intro statement */}
              <div className="text-xs text-slate-800 font-normal mb-2 leading-relaxed font-sans">
                {t('cpdf.letterIntro')}
              </div>

              {/* Summary Box Header */}
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-1.5 grid grid-cols-3 gap-2 text-xs mb-2 print:bg-slate-50 font-sans">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">{t('cpdf.resNo')}</span>
                  <span className="font-extrabold text-slate-900 font-mono text-xs">RSV-{reservation.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">{t('cpdf.guestName')}</span>
                  <span className="font-bold text-slate-900 uppercase text-xs truncate block">{reservation.guestName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">{t('cpdf.nationality')}</span>
                  <span className="font-semibold text-slate-800 text-xs block">{reservation.guestNationality || 'Egypt'}</span>
                </div>
              </div>

              {/* Rooms and rates details table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg mb-2 font-sans">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-[#d2d7df] border-b border-slate-300 text-slate-800 font-extrabold text-center">
                      <th className="py-1.5 px-1.5 text-[9px] uppercase font-mono text-left border-r border-slate-200">{t('cpdf.rsvCol')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase text-left border-r border-slate-200">{t('cpdf.hotelCol')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase border-r border-slate-200">{t('cpdf.confNo')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase border-r border-slate-200 font-bold">{t('cpdf.qtyCol')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase text-left border-r border-slate-200">{t('cpdf.roomTypeCol')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase text-left border-r border-slate-200">{t('cpdf.mpCol')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase border-r border-slate-200">{t('cpdf.checkIn')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase border-r border-slate-200 font-bold">{t('cpdf.ntsCol')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase border-r border-slate-200 font-bold">{t('cpdf.checkOut')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase text-right border-r border-slate-200 font-bold">{t('cpdf.roomRateCol')}</th>
                      <th className="py-1.5 px-1.5 text-[9px] uppercase text-right font-bold">{t('cpdf.totalPriceCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 text-[10px]">
                    {reservation.rooms.map((room, idx) => {
                      const pax = getPaxForRoomType(room.roomType);
                      const n = reservation.nights;

                      // Helper: get base rate for a specific night index
                      const getBaseRateForNight = (nightIdx: number): number => {
                        if (typeof room.nightlyRates === 'number') return room.nightlyRates;
                        const keys = Object.keys(room.nightlyRates);
                        return room.nightlyRates[keys[nightIdx]] || room.nightlyRates[keys[0]] || 0;
                      };

                      // Per-night add-ons (constant across all nights)
                      const extraBedPerNight = room.hasExtraBed ? (room.extraBedRate || 0) : 0;
                      const viewSuppPerNight = room.hasViewSupplement ? (room.viewSupplementRate || 0) : 0;
                      const mealPerNight = room.hasSeparateMealRate ? (room.mealRate || 0) * pax : 0;
                      const extraMeal1PerNight = room.hasExtraMeal1 ? (room.extraMeal1Rate || 0) * pax : 0;
                      const extraMeal2PerNight = room.hasExtraMeal2 ? (room.extraMeal2Rate || 0) * pax : 0;
                      const addOnsPerNight = extraBedPerNight + viewSuppPerNight + mealPerNight + extraMeal1PerNight + extraMeal2PerNight;

                      // Compute effective rate per night for each night
                      const nightlyEffectiveRates: number[] = [];
                      let lineTotal = 0;
                      for (let i = 0; i < n; i++) {
                        const effRate = getBaseRateForNight(i) + addOnsPerNight;
                        nightlyEffectiveRates.push(effRate);
                        lineTotal += effRate * room.qty;
                      }

                      // Determine unique rates for display (weekday/weekend)
                      const uniqueRates = Array.from(new Set(nightlyEffectiveRates.map(r => Math.round(r * 100) / 100)));
                      let rateStr: string;
                      if (uniqueRates.length === 0) {
                        rateStr = '0.00';
                      } else if (uniqueRates.length === 1) {
                        rateStr = uniqueRates[0].toFixed(2);
                      } else {
                        rateStr = uniqueRates.map(v => v.toFixed(2)).join(' / ');
                      }

                      // Build rate breakdown details for tooltip
                      const breakdownParts: string[] = [];
                      if (typeof room.nightlyRates === 'number') {
                        breakdownParts.push(`Room: ${room.nightlyRates}`);
                      } else {
                        const vals = Object.values(room.nightlyRates);
                        const uniq = Array.from(new Set(vals));
                        breakdownParts.push(`Room: ${uniq.map(v=>v.toFixed(0)).join('/')}`);
                      }
                      if (extraBedPerNight > 0) breakdownParts.push(`+Extra Bed: ${extraBedPerNight}`);
                      if (viewSuppPerNight > 0) breakdownParts.push(`+View: ${viewSuppPerNight}`);
                      if (mealPerNight > 0) breakdownParts.push(`+Meals: ${mealPerNight}`);
                      if (extraMeal1PerNight > 0) breakdownParts.push(`+${room.extraMeal1Label || 'Meal1'}: ${extraMeal1PerNight}`);
                      if (extraMeal2PerNight > 0) breakdownParts.push(`+${room.extraMeal2Label || 'Meal2'}: ${extraMeal2PerNight}`);

                      return (
                        <tr key={room.id} className="bg-white hover:bg-slate-50/50">
                          <td className="py-1.5 px-1.5 font-mono font-bold text-slate-900 border-r border-slate-200">{reservation.id}-{idx + 1}</td>
                          <td className="py-1.5 px-1.5 font-bold text-slate-800 border-r border-slate-200 leading-tight">{hotel?.name || 'Movenpick Hajar Makkah'}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-semibold text-emerald-800 border-r border-slate-200">
                            {reservation.hotelConfirmationNo || '-'}
                          </td>
                          <td className="py-1.5 px-1.5 text-center font-bold text-slate-800 border-r border-slate-200">{room.qty}</td>
                          <td className="py-1.5 px-1.5 text-slate-700 font-medium border-r border-slate-200">
                            {room.roomType}
                            <div className="text-[8px] text-slate-400 mt-0.5">{room.view || 'Standard'}</div>
                          </td>
                          <td className="py-1.5 px-1.5 text-slate-705 font-semibold border-r border-slate-200">{abbreviateMealPlan(room.mealPlan)}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono border-r border-slate-200">{formatStandardDate(reservation.checkIn)}</td>
                          <td className="py-1.5 px-1.5 text-center font-bold border-r border-slate-200">{reservation.nights}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono border-r border-slate-200">{formatStandardDate(reservation.checkOut)}</td>
                          <td className="py-1.5 px-1.5 text-right font-mono text-[9px] text-slate-605 border-r border-slate-205 whitespace-pre" title={breakdownParts.join('\n')}>
                            {rateStr}
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-bold text-slate-900 font-mono">
                            {lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="bg-slate-50 border-t border-slate-300 font-bold">
                      <td colSpan={10} className="py-1 px-2 text-right text-slate-705 font-sans border-r border-slate-200 uppercase text-[9px] tracking-wider">
                        {t('cpdf.netAccommodation')}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-slate-900 font-extrabold text-[10px]">
                        {totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* VAT Accounting summary block */}
              <div className="bg-white border-2 border-slate-200 rounded-xl p-2.5 max-w-sm ml-auto mr-0 my-2 text-xs font-semibold space-y-1 font-sans">
                <div className="flex justify-between text-slate-650">
                  <span>{t('cpdf.totalLabel')}</span>
                  <span className="font-mono font-bold text-slate-900">{calculatedNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-650">
                  <span>{t('cpdf.vat15')}</span>
                  <span className="font-mono font-bold text-slate-900">{calculatedVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                  <span>{t('cpdf.totalNetValue')}</span>
                  <span className="font-mono text-slate-955 font-extrabold">{totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Terms & Conditions Block */}
              <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-sans">
                <h3 className="font-bold text-slate-900 uppercase underline tracking-wide mb-1 text-[10px]">{t('pdf.termsConditions')}:</h3>
                <div className="text-[9px] text-slate-650 space-y-0 font-medium leading-snug max-w-2xl text-left">
                  <p>{t('cpdf.termsRateSAR')}</p>
                  <p>{t('cpdf.termsAvailability')}</p>
                  <p>{t('cpdf.termsCheckInOut')}</p>
                  <p>{t('cpdf.termsConfirmation')}</p>
                  <p>{t('cpdf.termsCancel30')}</p>
                  <p>{t('cpdf.termsCancel15')}</p>
                  <p>{t('cpdf.termsNoShow')}</p>
                  <p>{t('cpdf.termsAmend25')}</p>
                  <p>{t('cpdf.termsAmend15')}</p>
                  {reservation.termsAndConditions && (
                    <p className="text-slate-500 italic font-bold mt-2 leading-tight bg-slate-50 p-2 rounded border border-slate-150">{t('cpdf.customClause')} {reservation.termsAndConditions}</p>
                  )}
                </div>
              </div>

              {/* Bank Accounts Section */}
              <div className="mt-2 border-t border-slate-150 pt-2 text-[10px] font-sans">
                <h3 className="font-bold text-slate-900 uppercase underline tracking-wide mb-1 text-[10px]">{t('cpdf.ourBankAccount')}</h3>
                {reservation.bankAccountId ? (() => {
                  const acc = accounts.find(a => a.id === reservation.bankAccountId);
                  if (acc) {
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[11px] leading-relaxed max-w-2xl text-slate-650 font-medium">
                        <div>
                          <p><span className="font-extrabold text-slate-800 inline-block w-28">{t('cpdf.accountName')}</span> {acc.accountHolderName || 'زمرة للتسويق السياحي'}</p>
                          <p className="mt-0.5"><span className="font-extrabold text-slate-805 inline-block w-28">{t('cpdf.bankName')}</span> {acc.name}</p>
                          <p className="mt-0.5"><span className="font-extrabold text-slate-805 inline-block w-28">{t('cpdf.branch')}</span> -</p>
                        </div>
                        <div>
                          <p><span className="font-extrabold text-slate-800 inline-block w-24 font-sans">{t('cpdf.accountNo')}</span> {acc.code || '-'}</p>
                          <p className="mt-0.5"><span className="font-extrabold text-slate-800 inline-block w-24 font-sans">{t('cpdf.iban')}</span> {acc.accountNumber || '-'}</p>
                          <p className="mt-0.5"><span className="font-extrabold text-slate-800 inline-block w-24 font-sans">{t('cpdf.swiftCode')}</span> {acc.currency || 'SAR'}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })() : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[11px] leading-relaxed max-w-2xl text-slate-650 font-medium">
                    <div>
                      <p><span className="font-extrabold text-slate-800 inline-block w-28">{t('cpdf.accountName')}</span> زمرة للتسويق السياحي</p>
                      <p className="mt-0.5"><span className="font-extrabold text-slate-805 inline-block w-28">{t('cpdf.bankName')}</span> بنك مصر</p>
                      <p className="mt-0.5"><span className="font-extrabold text-slate-805 inline-block w-28">{t('cpdf.branch')}</span> -</p>
                    </div>
                    <div>
                      <p><span className="font-extrabold text-slate-800 inline-block w-24 font-sans">{t('cpdf.accountNo')}</span> 7810137000000095</p>
                      <p className="mt-0.5"><span className="font-extrabold text-slate-800 inline-block w-24 font-sans">{t('cpdf.iban')}</span> EG040002078107810137000000095</p>
                      <p className="mt-0.5"><span className="font-extrabold text-slate-805 inline-block w-24 font-sans">{t('cpdf.swiftCode')}</span> BMISEGCXXX</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Thanks & Regards Section */}
              <div className="flex justify-end items-end border-t border-slate-150 pt-2 mt-2 text-[10px] text-slate-500 font-sans">
                <div className="text-right">
                  <p className="font-bold text-slate-700 italic">{t('cpdf.thanksRegards')}</p>
                  <p className="text-sm font-bold text-slate-900 mt-1 block uppercase font-sans">{creatorName || reservation.createdBy || 'Hazem Mohey El-Din'}</p>
                  <p className="text-[10px] text-slate-450 font-medium">{creatorJobTitle}, Zumra Hotels</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
