/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Reservation, Agent, Hotel } from '../types';
import ZumraLogo from './ZumraLogo';
import { downloadPDF } from '../lib/pdfGenerator';
import { usePageBreaks } from '../lib/usePageBreaks';

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
    const dStr = fromDate && toDate ? `${fromDate} to ${toDate}` : 'All';
    downloadPDF('print-area', `Arrivals During ${dStr}.pdf`, { landscape: true });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:static print:inset-auto print:flex-none print:p-0">
      <div className="bg-white rounded-xl shadow-2xl max-w-[95%] w-full p-6 animate-in fade-in zoom-in-95 my-4 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none">
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4 font-sans no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-lg font-bold text-slate-800">
              Arrivals Report Print Preview
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

        {/* Printable Paper Area (Landscape) */}
        <div id="print-area" className="bg-white p-6 border border-slate-200 text-slate-800 font-sans shadow-inner max-h-[75vh] overflow-x-auto overflow-y-auto print:p-0 print:border-none print:shadow-none print:max-h-full">
          
          {/* Document Header: Company Name LEFT + Logo RIGHT */}
          <div className="flex justify-between items-center mb-1">
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
            <h1 className="text-xl font-extrabold text-[#0f172a] font-sans tracking-wide">Arrival During Period</h1>
            <h1 className="text-xl font-bold text-[#0f172a] font-serif">الوصول خلال فترة</h1>
          </div>

          {/* Period Details Bar */}
          <div className="grid grid-cols-4 gap-3 text-[10px] bg-slate-50 border border-slate-150 p-2 rounded-lg mb-3 text-slate-700 text-left font-sans print:bg-slate-50">
            <div><span className="font-bold text-slate-900">Arrival From:</span> {new Date(fromDate).toLocaleDateString('en-GB')}</div>
            <div><span className="font-bold text-slate-900">Arrival To:</span> {new Date(toDate).toLocaleDateString('en-GB')}</div>
            <div><span className="font-bold text-slate-900">In House:</span> False</div>
            <div className="text-right"><span className="font-bold text-slate-900">Record Count:</span> {reservations.length}</div>
          </div>

          {/* Arrivals Matrix Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left border-collapse text-[9px]">
              <thead>
                <tr className="bg-slate-100/85 text-slate-700 border-b border-slate-200 font-extrabold">
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center font-mono">SN</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center">Status</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center">Sent</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 font-mono"># Rsv</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">From</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">To</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 font-mono">Agent #</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">Agent</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">V.No</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">Hotel</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200"># Conf</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">Agreement</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">Guest</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200">Nat.</th>
                  <th className="py-1.5 px-1.5 border-r border-slate-200 text-center font-mono">Pax</th>
                  <th className="py-1.5 px-1.5">Room / MP</th>
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
                      No arrival records found in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Report Metadata signatures - screen only */}
          <div className="flex justify-between items-center border-t border-slate-200 mt-10 pt-4 text-[10px] text-slate-500 font-sans no-print">
            <div className="text-left leading-relaxed">
              <span className="font-semibold text-slate-700">Prepared by: Zumra Hotels</span> - {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB')}
            </div>
            <div className="text-right font-semibold font-mono uppercase text-slate-600">
              Page 1 of 1
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
