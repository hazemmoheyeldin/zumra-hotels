/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel } from '../types';
import ZumraLogo from './ZumraLogo';
import { downloadPDF } from '../lib/pdfGenerator';
import { usePageBreaks } from '../lib/usePageBreaks';
import { useLang } from '../lib/LanguageContext';

interface ArrivalReportPDFProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  fromDate: string;
  toDate: string;
  onClose: () => void;
}

export default function ArrivalReportPDF({ reservations, agents, hotels, fromDate, toDate, onClose }: ArrivalReportPDFProps) {
  const { renderInsertZone, PageBreakToggle } = usePageBreaks();
  const { t, lang } = useLang();
  const [isGenerating, setIsGenerating] = useState(false);
  const [printError, setPrintError] = useState(false);

  const getAgentName = (id: string): string => {
    const a = agents.find(agent => agent.id === id);
    return a ? a.name : 'N/A';
  };

  const getAgentNum = (id: string): number => {
    const a = agents.find(agent => agent.id === id);
    return a ? a.agentNumber : 0;
  };

  const getHotelName = (id: string): string => {
    const h = hotels.find(hotel => hotel.id === id);
    return h ? h.name : 'N/A';
  };

  const getPaxCount = (res: Reservation): number => {
    return res.rooms.reduce((acc, rm) => acc + (rm.qty * (rm.pax || 2)), 0);
  };

  const getRoomsSummary = (res: Reservation): string => {
    return res.rooms.map(rm => `${rm.qty} ${rm.roomType} ${rm.mealPlan}`).join(' & ');
  };

  const handlePrint = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setPrintError(false);
    try {
      const dStr = fromDate && toDate ? `${fromDate} to ${toDate}` : 'All';
      // Find primary client name from first reservation
      const primaryClient = reservations.length > 0 ? (agents.find(a => a.id === reservations[0].clientId)?.name || 'All Clients') : 'All Clients';
      const safeClientName = primaryClient.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      const success = downloadPDF('print-area', `Arrival during period - ${safeClientName}.pdf`, { landscape: true });
      if (!success) setPrintError(true);
    } catch {
      setPrintError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:static print:inset-auto print:flex-none print:p-0">
      <div className="bg-white rounded-xl shadow-2xl max-w-[95%] w-full p-6 animate-in fade-in zoom-in-95 my-4 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none">
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4 font-sans no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-lg font-bold text-slate-800">
              {t('arpdf.printPreview')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <PageBreakToggle />
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              )}
              {isGenerating ? 'Generating PDF...' : t('arpdf.printSavePDF')}
            </button>
            {printError && (
              <button onClick={() => { setPrintError(false); setIsGenerating(false); }} className="bg-red-100 hover:bg-red-200 text-red-700 font-medium px-3 py-2 rounded-lg transition text-sm cursor-pointer">Reset</button>
            )}
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition cursor-pointer"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        {/* Printable Paper Area (Landscape) */}
        <div id="print-area" className="bg-white p-4 md:p-6 border border-slate-200 text-slate-800 font-sans shadow-inner max-h-[75vh] overflow-x-auto overflow-y-auto print:p-0 print:border-none print:shadow-none print:max-h-full print:overflow-visible">
          
          {/* Document Header: Company Name LEFT + Logo RIGHT */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1 gap-2">
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

          {/* Report Title Section */}
          <div className="flex justify-between items-baseline mb-3 mt-1 border-b border-slate-200 pb-2">
            <h1 className="text-xl font-extrabold text-[#0f172a] font-sans tracking-wide">{t('arpdf.titleEn')}</h1>
            <h1 className="text-xl font-bold text-[#0f172a] font-serif">الوصول خلال فترة</h1>
          </div>

          {/* Period Details Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-[10px] bg-slate-50 border border-slate-150 p-2 rounded-lg mb-3 text-slate-700 text-left font-sans print:bg-slate-50">
            <div><span className="font-bold text-slate-900">{t('arpdf.arrivalFrom')}</span> {new Date(fromDate).toLocaleDateString('en-GB')}</div>
            <div><span className="font-bold text-slate-900">{t('arpdf.arrivalTo')}</span> {new Date(toDate).toLocaleDateString('en-GB')}</div>
            <div><span className="font-bold text-slate-900">{t('arpdf.inHouse')}</span> False</div>
            <div className="text-right"><span className="font-bold text-slate-900">{t('arpdf.recordCount')}</span> {reservations.length}</div>
          </div>

          {/* Arrivals Matrix Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto mb-6">
            <table className="w-full text-left border-collapse text-[9px] min-w-[900px]">
              <thead>
                <tr className="bg-slate-100/85 text-slate-700 border-b border-slate-200 font-extrabold">
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center font-mono">{t('arpdf.snCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center">{t('arpdf.statusCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center">{t('arpdf.sentCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 font-mono">{t('arpdf.nRsvCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.fromCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.toCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 font-mono">{t('arpdf.agentNumCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.agentCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.vNoCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.hotelCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.nConfCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.agreementCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.guestCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">{t('arpdf.natCol')}</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center font-mono">{t('arpdf.paxCol')}</th>
                  <th className="py-1.5 px-1.5">{t('arpdf.roomMpCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium font-sans">
                {reservations.length > 0 ? (
                  reservations.map((res, index) => (
                    <React.Fragment key={res.id}>
                      {renderInsertZone(index)}
                      <tr className="bg-white hover:bg-slate-50/50">
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-center font-mono">{index + 1}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-center">
                        <span className={`inline-block px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          res.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-705 border border-emerald-200' :
                          res.status === 'Cancelled' ? 'bg-rose-50 text-rose-705 border border-rose-200' :
                          'bg-amber-50 text-amber-705 border border-amber-200'
                        }`}>{res.status}</span>
                      </td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-center text-slate-400 font-mono text-[8px]">False</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 font-semibold font-mono text-slate-900">{res.id}-1</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono">{new Date(res.checkIn).toLocaleDateString('en-GB')}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono">{new Date(res.checkOut).toLocaleDateString('en-GB')}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono text-center">{getAgentNum(res.clientId)}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 font-bold text-slate-900 max-w-[120px] truncate">{getAgentName(res.clientId)}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-400 font-mono"></td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 font-bold text-slate-905 max-w-[120px] truncate">{getHotelName(res.hotelId)}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-900 font-mono font-extrabold">{res.hotelConfirmationNo || '-'}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-slate-500 font-mono">{res.agreementNo || '-'}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 uppercase text-slate-950 font-black tracking-wide max-w-[120px] truncate">{res.guestName}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-center">{res.guestNationality || 'Egypt'}</td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 text-center font-bold font-mono text-slate-900">{getPaxCount(res)}</td>
                      <td className="py-1.5 px-1.5 text-[9px] text-amber-900 font-bold font-sans max-w-[160px] truncate">{getRoomsSummary(res)}</td>
                    </tr>
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={16} className="py-8 text-center text-slate-400 italic">
                      {t('arpdf.noRecords')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Report Metadata signatures - screen only */}
          <div className="flex justify-between items-center border-t border-slate-200 mt-10 pt-4 text-[10px] text-slate-500 font-sans no-print">
            <div className="text-left leading-relaxed">
              <span className="font-semibold text-slate-700">{t('arpdf.preparedBy')}</span> - {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')} {new Date().toLocaleTimeString('en-GB')}
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
