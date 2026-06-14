/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel } from '../types';
import MasterPDFHeader from './MasterPDFHeader';
import { exportPDF } from '../lib/pdfGenerator';
import { getReservationTotals } from '../lib/storage';

interface DailyOpsSheetPDFProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  todayStr: string;
  onClose: () => void;
}

export default function DailyOpsSheetPDF({ reservations, agents, hotels, todayStr, onClose }: DailyOpsSheetPDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const getAgentName = (id: string): string => agents.find(a => a.id === id)?.name || 'N/A';
  const getHotelName = (id: string): string => hotels.find(h => h.id === id)?.name || 'N/A';
  const getRoomsSummary = (res: Reservation): string => (res.rooms || []).map(rm => `${rm.qty}x ${rm.roomType} ${rm.mealPlan}`).join(', ');
  const getTotalRooms = (res: Reservation): number => (res.rooms || []).reduce((acc, rm) => acc + rm.qty, 0);
  const getTotalPax = (res: Reservation): number => (res.rooms || []).reduce((acc, rm) => acc + (rm.qty * (rm.pax || 2)), 0);

  // Arrivals: checkIn === today, status Confirmed
  const arrivals = reservations.filter(r =>
    r.status === 'Confirmed' && r.checkIn === todayStr
  );

  // Departures: checkOut === today, status Confirmed
  const departures = reservations.filter(r =>
    r.status === 'Confirmed' && r.checkOut === todayStr
  );

  // In-House: checkIn <= today && checkOut > today, status Confirmed
  const inHouse = reservations.filter(r =>
    r.status === 'Confirmed' && r.checkIn <= todayStr && r.checkOut > todayStr
  );

  // Pending Tasks: Tentative with upcoming option dates, or unpaid upcoming confirmed
  const pendingTasks = reservations.filter(r => {
    if (r.status === 'Cancelled') return false;
    // Tentative bookings
    if (r.status === 'Tentative' && r.checkIn >= todayStr) return true;
    // Confirmed with unpaid balance
    if (r.status === 'Confirmed') {
      const { totalSell } = getReservationTotals(r);
      const paid = r.amountPaidByClient || 0;
      if (paid < totalSell && r.checkIn >= todayStr) return true;
    }
    return false;
  }).slice(0, 15);

  const totalRoomsOccupied = inHouse.reduce((acc, r) => acc + getTotalRooms(r), 0);

  const handlePrint = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await exportPDF('daily-ops-sheet', `Daily_Ops_Sheet_${todayStr}`);
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full my-4 shadow-2xl">
        {/* Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800">📋 Daily Operations Sheet</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={isGenerating} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition">
              {isGenerating ? '⏳ Generating...' : '🖨️ Print PDF'}
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition">Close</button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          <div id="daily-ops-sheet" className="bg-white p-8 font-sans text-[11px] text-slate-800 max-w-[210mm] mx-auto">

            {/* Header */}
            <MasterPDFHeader
              leftSlot={
                <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight">Daily Operations Sheet</h1>
                  <p className="text-[10px] text-slate-500 font-mono">{todayStr}</p>
                </div>
              }
              rightSlot={
                <div className="text-right text-[9px] text-slate-400">
                  <div>Arrivals: <span className="font-bold text-emerald-700">{arrivals.length}</span></div>
                  <div>Departures: <span className="font-bold text-rose-700">{departures.length}</span></div>
                  <div>In-House: <span className="font-bold text-blue-700">{inHouse.length}</span></div>
                </div>
              }
            />

            {/* Section 1: Arrivals Today */}
            <div className="mb-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-emerald-800 border-b border-emerald-200 pb-1 mb-2 flex items-center gap-1">
                ✈️ Arrivals Today ({arrivals.length})
              </h2>
              {arrivals.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic py-2">No arrivals today</p>
              ) : (
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-emerald-50">
                      <th className="text-left p-1.5 font-bold text-emerald-800 border-b">RSV</th>
                      <th className="text-left p-1.5 font-bold text-emerald-800 border-b">Guest</th>
                      <th className="text-left p-1.5 font-bold text-emerald-800 border-b">Hotel</th>
                      <th className="text-left p-1.5 font-bold text-emerald-800 border-b">Rooms</th>
                      <th className="text-center p-1.5 font-bold text-emerald-800 border-b">Pax</th>
                      <th className="text-left p-1.5 font-bold text-emerald-800 border-b">Client</th>
                      <th className="text-left p-1.5 font-bold text-emerald-800 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrivals.map(r => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="p-1.5 font-mono font-bold">{r.id}</td>
                        <td className="p-1.5 font-bold uppercase">{r.guestName}</td>
                        <td className="p-1.5">{getHotelName(r.hotelId)}</td>
                        <td className="p-1.5">{getRoomsSummary(r)}</td>
                        <td className="p-1.5 text-center">{getTotalPax(r)}</td>
                        <td className="p-1.5">{getAgentName(r.clientId)}</td>
                        <td className="p-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            (r.checkInStatus || 'Expected') === 'Checked-In' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>{r.checkInStatus || 'Expected'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Section 2: Departures Today */}
            <div className="mb-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-rose-800 border-b border-rose-200 pb-1 mb-2 flex items-center gap-1">
                🚪 Departures Today ({departures.length})
              </h2>
              {departures.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic py-2">No departures today</p>
              ) : (
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-rose-50">
                      <th className="text-left p-1.5 font-bold text-rose-800 border-b">RSV</th>
                      <th className="text-left p-1.5 font-bold text-rose-800 border-b">Guest</th>
                      <th className="text-left p-1.5 font-bold text-rose-800 border-b">Hotel</th>
                      <th className="text-left p-1.5 font-bold text-rose-800 border-b">Rooms</th>
                      <th className="text-right p-1.5 font-bold text-rose-800 border-b">Total</th>
                      <th className="text-right p-1.5 font-bold text-rose-800 border-b">Paid</th>
                      <th className="text-right p-1.5 font-bold text-rose-800 border-b">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departures.map(r => {
                      const { totalSell } = getReservationTotals(r);
                      const paid = r.amountPaidByClient || 0;
                      const balance = Math.max(totalSell - paid, 0);
                      return (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="p-1.5 font-mono font-bold">{r.id}</td>
                          <td className="p-1.5 font-bold uppercase">{r.guestName}</td>
                          <td className="p-1.5">{getHotelName(r.hotelId)}</td>
                          <td className="p-1.5">{getRoomsSummary(r)}</td>
                          <td className="p-1.5 text-right font-mono">{totalSell.toLocaleString()}</td>
                          <td className="p-1.5 text-right font-mono">{paid.toLocaleString()}</td>
                          <td className={`p-1.5 text-right font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{balance.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Section 3: In-House Guests */}
            <div className="mb-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-blue-800 border-b border-blue-200 pb-1 mb-2 flex items-center gap-1">
                🏨 In-House Guests ({inHouse.length})
              </h2>
              {inHouse.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic py-2">No in-house guests</p>
              ) : (
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="text-left p-1.5 font-bold text-blue-800 border-b">RSV</th>
                      <th className="text-left p-1.5 font-bold text-blue-800 border-b">Guest</th>
                      <th className="text-left p-1.5 font-bold text-blue-800 border-b">Hotel</th>
                      <th className="text-left p-1.5 font-bold text-blue-800 border-b">Rooms</th>
                      <th className="text-center p-1.5 font-bold text-blue-800 border-b">CI</th>
                      <th className="text-center p-1.5 font-bold text-blue-800 border-b">CO</th>
                      <th className="text-center p-1.5 font-bold text-blue-800 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inHouse.map(r => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="p-1.5 font-mono font-bold">{r.id}</td>
                        <td className="p-1.5 font-bold uppercase">{r.guestName}</td>
                        <td className="p-1.5">{getHotelName(r.hotelId)}</td>
                        <td className="p-1.5">{getRoomsSummary(r)}</td>
                        <td className="p-1.5 text-center font-mono">{r.checkIn}</td>
                        <td className="p-1.5 text-center font-mono">{r.checkOut}</td>
                        <td className="p-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            (r.checkInStatus || 'Expected') === 'Checked-In' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>{r.checkInStatus || 'Expected'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Section 4: Pending Tasks */}
            <div className="mb-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-amber-800 border-b border-amber-200 pb-1 mb-2 flex items-center gap-1">
                ⚠️ Pending Tasks / Follow-ups ({pendingTasks.length})
              </h2>
              {pendingTasks.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic py-2">No pending tasks</p>
              ) : (
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-amber-50">
                      <th className="text-left p-1.5 font-bold text-amber-800 border-b">RSV</th>
                      <th className="text-left p-1.5 font-bold text-amber-800 border-b">Guest</th>
                      <th className="text-left p-1.5 font-bold text-amber-800 border-b">Hotel</th>
                      <th className="text-center p-1.5 font-bold text-amber-800 border-b">CI Date</th>
                      <th className="text-left p-1.5 font-bold text-amber-800 border-b">Status</th>
                      <th className="text-left p-1.5 font-bold text-amber-800 border-b">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTasks.map(r => {
                      const { totalSell } = getReservationTotals(r);
                      const paid = r.amountPaidByClient || 0;
                      const issue = r.status === 'Tentative' ? 'Awaiting confirmation' : paid < totalSell ? `Unpaid: ${(totalSell - paid).toLocaleString()} SAR` : 'Follow-up';
                      return (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="p-1.5 font-mono font-bold">{r.id}</td>
                          <td className="p-1.5 font-bold uppercase">{r.guestName}</td>
                          <td className="p-1.5">{getHotelName(r.hotelId)}</td>
                          <td className="p-1.5 text-center font-mono">{r.checkIn}</td>
                          <td className="p-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                              r.status === 'Tentative' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>{r.status}</span>
                          </td>
                          <td className="p-1.5 text-rose-600 font-semibold">{issue}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer Summary */}
            <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center text-[10px]">
              <div className="flex gap-6">
                <div><span className="text-slate-400 font-bold uppercase">Total Rooms Occupied:</span> <span className="font-black text-slate-800">{totalRoomsOccupied}</span></div>
                <div><span className="text-slate-400 font-bold uppercase">Total Guests:</span> <span className="font-black text-slate-800">{inHouse.reduce((acc, r) => acc + getTotalPax(r), 0)}</span></div>
              </div>
              <div className="text-slate-400 font-mono text-[8px]">
                Generated: {new Date().toLocaleString()}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
