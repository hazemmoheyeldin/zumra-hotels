/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Reservation, Agent, Hotel } from '../types';
import { getReservationTotals } from '../lib/storage';
import ZumraLogo from './ZumraLogo';
import { downloadPDF, compressImagesForPrint, exportPDF } from '../lib/pdfGenerator';
import { usePageBreaks } from '../lib/usePageBreaks';
import { useLang } from '../lib/LanguageContext';

interface CancellationReportPDFProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  fromDate: string;
  toDate: string;
  onClose: () => void;
}

export default function CancellationReportPDF({ reservations, agents, hotels, fromDate, toDate, onClose }: CancellationReportPDFProps) {
  const { renderInsertZone, PageBreakToggle } = usePageBreaks();
  const { t, lang } = useLang();

  // Pre-compress images for smaller PDF file size (WhatsApp-friendly)
  React.useEffect(() => { compressImagesForPrint('print-area'); }, []);

  const getAgentName = (id: string): string => {
    const a = agents.find(agent => agent.id === id);
    return a ? (a.companyName || a.name) : 'N/A';
  };

  const getHotelName = (id: string): string => {
    const h = hotels.find(hotel => hotel.id === id);
    return h ? h.name : 'N/A';
  };

  const handlePrint = async () => {
    const dStr = fromDate && toDate ? `${fromDate} to ${toDate}` : 'All';
    const success = await exportPDF('print-area', `Cancellations Report - ${dStr}.pdf`, { landscape: true });
    if (success) setTimeout(onClose, 400);
  };

  const totalPenalty = reservations.reduce((acc, res) => acc + (res.cancellationFee || 0), 0);
  const totalOriginalSell = reservations.reduce((acc, res) => {
    const { totalSell } = getReservationTotals(res);
    return acc + totalSell;
  }, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:static print:inset-auto print:flex-none print:p-0" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-[95%] w-full p-6 animate-in fade-in zoom-in-95 my-4 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none" onClick={(e) => e.stopPropagation()}>
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4 font-sans no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-rose-500 animate-pulse"></span>
            <h2 className="text-lg font-bold text-slate-800">
              {t('crpdf.printPreview')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <PageBreakToggle />
            <button
              onClick={handlePrint}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              {t('crpdf.printSavePDF')}
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition cursor-pointer"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        {/* Printable Paper Area (Landscape) */}
        <div id="print-area" className="bg-white p-6 border border-slate-200 text-slate-800 font-sans shadow-inner max-h-[75vh] overflow-x-auto overflow-y-auto print:p-0 print:border-none print:shadow-none print:max-h-full">
          
          {/* Document Header: Company Name LEFT + Logo RIGHT */}
          <div className="flex justify-between items-center mb-1 gap-4">
            <div className="flex flex-col text-left font-sans gap-0.5 flex-1">
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
                ZUMRA HOTELS
              </span>
              <span className="text-xl font-bold text-slate-800 tracking-wider font-serif" dir="rtl">
                زمرة للفنادق
              </span>
            </div>
            <div className="flex-shrink-0">
              <ZumraLogo size="xxl" />
            </div>
          </div>

          {/* Golden Separator Line */}
          <div className="border-t-4 border-[#C1A168] w-full my-2"></div>

          {/* Report Title Section */}
          <div className="flex justify-between items-baseline mb-3 mt-1 border-b border-slate-200 pb-2">
            <h1 className="text-xl font-extrabold text-[#0f172a] font-sans tracking-wide">{t('crpdf.titleEn')}</h1>
            <h1 className="text-xl font-bold text-[#0f172a] font-serif">تقرير الإلغاءات</h1>
          </div>

          {/* Period Details Bar */}
          <div className="grid grid-cols-4 gap-3 text-[10px] bg-rose-50/50 border border-rose-200 p-2 rounded-lg mb-3 text-slate-700 text-left font-sans print:bg-rose-50">
            <div><span className="font-bold text-slate-900">{t('crpdf.fromLabel')}</span> {new Date(fromDate).toLocaleDateString('en-GB')}</div>
            <div><span className="font-bold text-slate-900">{t('crpdf.toLabel')}</span> {new Date(toDate).toLocaleDateString('en-GB')}</div>
            <div><span className="font-bold text-rose-700">{t('crpdf.totalCancelled')}</span> {reservations.length} {t('crpdf.bookings')}</div>
            <div className="text-right"><span className="font-bold text-rose-700">{t('crpdf.totalPenalty')}</span> {totalPenalty.toLocaleString()} SAR</div>
          </div>

          {/* Cancellations Matrix Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-rose-50/85 text-slate-700 border-b border-slate-200 font-extrabold">
                  <th className="py-2 px-2 border-r border-slate-200 text-center font-mono">{t('crpdf.snCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200 font-mono">{t('crpdf.bookingRefCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200">{t('crpdf.clientAgentCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200">{t('crpdf.hotelCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200">{t('crpdf.guestNameCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200 font-mono">{t('crpdf.checkInCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200 font-mono">{t('crpdf.checkOutCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-right font-mono">{t('crpdf.originalSellCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-right font-mono text-rose-700">{t('crpdf.penaltyCol')}</th>
                  <th className="py-2 px-2 border-r border-slate-200">{t('crpdf.reasonCol')}</th>
                  <th className="py-2 px-2 text-center">{t('crpdf.cancelledByCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium font-sans">
                {reservations.length > 0 ? (
                  reservations.map((res, index) => {
                    const { totalSell } = getReservationTotals(res);
                    return (
                      <React.Fragment key={res.id}>
                        {renderInsertZone(index)}
                        <tr className="bg-white hover:bg-rose-50/20">
                        <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">{index + 1}</td>
                        <td className="py-2 px-2 border-r border-slate-200 font-semibold font-mono text-slate-900">RSV-{res.id}</td>
                        <td className="py-2 px-2 border-r border-slate-200 font-bold text-slate-900 max-w-[140px] truncate">{getAgentName(res.clientId)}</td>
                        <td className="py-2 px-2 border-r border-slate-200 font-bold text-slate-905 max-w-[140px] truncate">{getHotelName(res.hotelId)}</td>
                        <td className="py-2 px-2 border-r border-slate-200 uppercase text-slate-950 font-black tracking-wide max-w-[140px] truncate">{res.guestName}</td>
                        <td className="py-2 px-2 border-r border-slate-200 font-mono">{new Date(res.checkIn).toLocaleDateString('en-GB')}</td>
                        <td className="py-2 px-2 border-r border-slate-200 font-mono">{new Date(res.checkOut).toLocaleDateString('en-GB')}</td>
                        <td className="py-2 px-2 border-r border-slate-200 text-right font-mono">{totalSell.toLocaleString()} SAR</td>
                        <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold text-rose-700">
                          {(res.cancellationFee || 0).toLocaleString()} SAR
                        </td>
                        <td className="py-2 px-2 border-r border-slate-200 text-slate-600 max-w-[200px] truncate">{res.cancellationReason || t('crpdf.notSpecified')}</td>
                        <td className="py-2 px-2 text-center font-semibold text-slate-500 font-mono">{res.createdBy || '-'}</td>
                      </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 italic">
                      {t('crpdf.noRecords')}
                    </td>
                  </tr>
                )}

                {/* Totals Row */}
                {reservations.length > 0 && (
                  <tr className="bg-rose-50 font-bold border-t-2 border-rose-300 keep-with-prev">
                    <td colSpan={7} className="py-2 px-2 border-r border-slate-200 text-right font-extrabold text-slate-800">{t('crpdf.totalsRow')}</td>
                    <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-extrabold text-slate-800">{totalOriginalSell.toLocaleString()} SAR</td>
                    <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-extrabold text-rose-700">{totalPenalty.toLocaleString()} SAR</td>
                    <td colSpan={2} className="py-2 px-2"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Report Metadata - screen only */}
          <div className="flex justify-between items-center border-t border-slate-200 mt-10 pt-4 text-[10px] text-slate-500 font-sans no-print">
            <div className="text-left leading-relaxed">
              <span className="font-semibold text-slate-700">{t('crpdf.preparedBy')}</span> - {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')} {new Date().toLocaleTimeString('en-GB')}
            </div>
            <div className="text-right font-semibold font-mono uppercase text-slate-600">
              {t('cpdf.pageOf')}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
