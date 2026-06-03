/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Reservation, Agent, Hotel, User, FollowUp } from '../types';
import { getReservationTotals, getEgyptTime } from '../lib/storage';
import ZumraLogo from './ZumraLogo';

interface DashboardProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  users: User[];
  followUps: FollowUp[];
  onNavigate: (tab: string, initialFilters?: any) => void;
  onQuickReservation: () => void;
}

export default function Dashboard({ reservations, agents, hotels, users, followUps, onNavigate, onQuickReservation }: DashboardProps) {
  const todayStr = getEgyptTime().toISOString().split('T')[0];

  // Calculations
  const reservationsToday = reservations.filter(res => res.createdAt.startsWith(todayStr));
  
  // Calculate stats
  const totalBookings = reservations.length;
  const tentativeBookings = reservations.filter(res => res.status === 'Tentative').length;
  const confirmedBookings = reservations.filter(res => res.status === 'Confirmed').length;
  
  // Checking in today count
  const checkInsToday = reservations.filter(res => res.checkIn === todayStr && res.status !== 'Cancelled');
  
  // Expiring options count (Option date is today and status is Tentative)
  const expiringOptions = reservations.filter(res => res.clientOptionDate === todayStr && res.status === 'Tentative');

  // In house (checkIn <= today and checkOut > today)
  const inHouseList = reservations.filter(res => res.checkIn <= todayStr && res.checkOut > todayStr && res.status === 'Confirmed');

  // Calculate high quality sales data for charts and portfolio lists
  const getSupplierStats = () => {
    const stats: { [id: string]: { name: string; sales: number; roomNights: number } } = {};
    reservations.forEach(res => {
      if (res.status === 'Cancelled') return;
      const { totalBuy } = getReservationTotals(res);
      const host = agents.find(a => a.id === res.supplierId) || { name: 'Direct' };
      const nightsMultiplier = res.rooms.reduce((sum, rm) => sum + (rm.qty * res.nights), 0);

      if (!stats[res.supplierId]) {
        stats[res.supplierId] = { name: host.name, sales: 0, roomNights: 0 };
      }
      stats[res.supplierId].sales += totalBuy;
      stats[res.supplierId].roomNights += nightsMultiplier;
    });
    return Object.values(stats).sort((a, b) => b.sales - a.sales).slice(0, 10);
  };

  const getClientStats = () => {
    const stats: { [id: string]: { name: string; sales: number; roomNights: number } } = {};
    reservations.forEach(res => {
      if (res.status === 'Cancelled') return;
      const { totalSell } = getReservationTotals(res);
      const client = agents.find(a => a.id === res.clientId) || { name: 'Direct Client', companyName: '' };
      const nightsMultiplier = res.rooms.reduce((sum, rm) => sum + (rm.qty * res.nights), 0);

      if (!stats[res.clientId]) {
        stats[res.clientId] = { name: client.companyName || client.name, sales: 0, roomNights: 0 };
      }
      stats[res.clientId].sales += totalSell;
      stats[res.clientId].roomNights += nightsMultiplier;
    });
    return Object.values(stats).sort((a, b) => b.sales - a.sales).slice(0, 10);
  };

  const topSuppliers = getSupplierStats();
  const topClients = getClientStats();

  const pendingFollowUps = followUps.filter(f => f.status === 'Pending' && f.date <= todayStr);

  const missingRoomingList = reservations.filter(res => {
    if (res.status === 'Cancelled') return false;
    const totalRooms = res.rooms.reduce((sum, rm) => sum + rm.qty, 0);
    const isGroup = totalRooms > 3 || res.guestName.toLowerCase().includes('group');
    if (!isGroup) return false;
    if (res.roomingList && res.roomingList.length > 0) return false;

    const checkInDate = new Date(res.checkIn);
    const today = new Date(todayStr);
    const diffTime = checkInDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 5 && diffDays >= 0;
  });

  const tbaBookings = reservations.filter(res => {
    if (res.status === 'Cancelled') return false;
    const name = res.guestName.trim().toUpperCase();
    if (name === '' || name === 'TBA' || name === 'TO BE ADVISED') {
      const checkInDate = new Date(res.checkIn);
      const today = new Date(todayStr);
      const diffTime = checkInDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 5 && diffDays >= 0;
    }
    return false;
  });

  return (
    <div className="space-y-6">
      
      {/* Alert Block for same-day Expiring Options (Compact Notification Style) */}
      {expiringOptions.length > 0 && (
        <div className="bg-rose-50 border border-rose-150 text-rose-955 rounded-xl p-3 px-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-base animate-pulse">⏰</span>
            <div>
              <p className="font-semibold text-rose-850">
                <span>Expired Options Today ({expiringOptions.length}) / تنبيه الغرف المعلقة اليوم</span>
              </p>
              <p className="text-[10.5px] text-rose-700 font-medium">Please review tentative reserves pending option expiration deadlines today.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-rose-500 font-bold uppercase mr-1 hidden md:inline">Quick Links:</span>
            <div className="flex flex-wrap gap-1">
              {expiringOptions.slice(0, 3).map(res => (
                <button 
                  key={res.id}
                  onClick={() => onNavigate('Reservations', { viewReservationId: res.id })}
                  title={`View RSV-${res.id} - ${res.guestName}`}
                  className="bg-white hover:bg-rose-100/50 text-rose-850 text-[10px] font-mono font-bold px-2 py-1 rounded-lg border border-rose-200/60 transition cursor-pointer flex items-center gap-1"
                >
                  🔍 RSV-{res.id}
                </button>
              ))}
              {expiringOptions.length > 3 && (
                <span className="bg-rose-200 text-rose-850 text-[10px] font-bold px-2 py-1 rounded-lg">
                  +{expiringOptions.length - 3} more
                </span>
              )}
            </div>
            <button 
              onClick={() => onNavigate('Reservations', { status: 'Tentative', dateFilter: todayStr })} 
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] px-3 py-1 rounded-lg shadow-xs transition-transform hover:scale-[1.02] cursor-pointer"
            >
              Resolve List →
            </button>
          </div>
        </div>
      )}

      {/* Alert Block for Pending Follow Ups */}
      {pendingFollowUps.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-150 text-indigo-950 rounded-xl p-3 px-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-base animate-pulse">📋</span>
            <div>
              <p className="font-semibold text-indigo-850">
                <span>Pending Follow-ups ({pendingFollowUps.length}) / متابعات المبيعات</span>
              </p>
              <p className="text-[10.5px] text-indigo-700 font-medium">You have upcoming/pending sales tasks scheduled for today or earlier.</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('Sales')} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] px-3 py-1 rounded-lg shadow-xs transition-transform hover:scale-[1.02] cursor-pointer whitespace-nowrap"
          >
            Open Sales CRM →
          </button>
        </div>
      )}

      {/* Alert Block for Missing Rooming Lists */}
      {missingRoomingList.length > 0 && (
        <div className="bg-orange-50 border border-orange-150 text-orange-950 rounded-xl p-3 px-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-base animate-pulse">⚠️</span>
            <div>
              <p className="font-semibold text-orange-850">
                <span>Missing Rooming Lists ({missingRoomingList.length}) / قوائم أسماء الغرف مفقودة</span>
              </p>
              <p className="text-[10.5px] text-orange-700 font-medium">Group bookings arriving within 5 days require a rooming list.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {missingRoomingList.slice(0, 3).map(res => (
                <button 
                  key={res.id}
                  onClick={() => onNavigate('Reservations', { viewReservationId: res.id })}
                  title={`View RSV-${res.id}`}
                  className="bg-white hover:bg-orange-100/50 text-orange-850 text-[10px] font-mono font-bold px-2 py-1 rounded-lg border border-orange-200/60 transition cursor-pointer flex items-center gap-1"
                >
                  🔍 RSV-{res.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top compact design bar */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl border-b-4 border-blue-500 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-400/10 rounded-full"></div>
        <div className="flex flex-col sm:flex-row items-center gap-4 z-10 w-full md:w-auto">
          <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-sm shadow-inner flex items-center justify-center">
            <ZumraLogo size="lg" variant="light" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold uppercase tracking-tight text-amber-100">Zumra Hotels B2B Operations Panel</h2>
            <p className="text-xs text-emerald-250 mt-1 font-mono tracking-wide">SYSTEM NODE: Egypt Standard Time (Cairo Gateway Active)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto justify-center">
          {/* Fast Lookup Booking Number Search Field */}
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-[10px]">🔍</span>
            <input
              type="text"
              placeholder="Fast RSV # (e.g. 1001)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.currentTarget as HTMLInputElement).value.trim();
                  if (val) {
                    const matchedNum = val.replace(/\D/g, '');
                    if (matchedNum) {
                      onNavigate('Reservations', { viewReservationId: parseInt(matchedNum, 10) });
                    }
                  }
                }
              }}
              className="pl-7 pr-2.5 py-1.5 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-[11px] text-white placeholder-emerald-300/50 focus:outline-none focus:border-amber-400 w-38 font-mono"
            />
          </div>
          <button 
            onClick={onQuickReservation}
            className="bg-blue-600 font-bold hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Quick Reservation
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Bookings Today */}
        <button 
          onClick={() => onNavigate('Reservations', { customFilter: 'bookings-today' })}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:border-emerald-200 hover:shadow transition-all duration-200 text-left block w-full focus:outline-none cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">Bookings Today</span>
            <span className="bg-emerald-50 text-emerald-700 p-2 rounded-xl text-xs font-bold">📝</span>
          </div>
          <span className="text-3xl font-extrabold text-slate-800 focus:outline-none block mt-2 font-mono">
            {reservationsToday.length}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-1">Recorded on portal today</span>
        </button>

        {/* Clickable check-in trigger */}
        <button 
          onClick={() => onNavigate('Reservations', { customFilter: 'checkin-today' })}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow hover:border-amber-400 transition-all duration-200 text-left block w-full focus:outline-none cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">Check-In Today</span>
            <span className="bg-amber-100 text-amber-800 p-2 rounded-xl text-xs font-bold">🔔</span>
          </div>
          <span className="text-3xl font-extrabold text-slate-800 block mt-2 font-mono">
            {checkInsToday.length}
          </span>
          <span className="text-[10px] text-amber-600 block mt-1 font-bold hover:underline">Click to view check-ins →</span>
        </button>

        {/* Clickable in-house trigger */}
        <button 
          onClick={() => onNavigate('Reservations', { customFilter: 'inhouse' })}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow hover:border-emerald-400 transition-all duration-200 text-left block w-full focus:outline-none cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">In House (In-House)</span>
            <span className="bg-emerald-100 text-emerald-800 p-2 rounded-xl text-xs font-bold">🔑</span>
          </div>
          <span className="text-3xl font-extrabold text-slate-800 block mt-2 font-mono">
            {inHouseList.length}
          </span>
          <span className="text-[10px] text-emerald-700 block mt-1 font-bold hover:underline">Occupying rooms right now →</span>
        </button>

        {/* Expiring options trigger */}
        <button 
          onClick={() => onNavigate('Reservations', { customFilter: 'expiring-options' })}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow hover:border-red-400 transition-all duration-200 text-left block w-full focus:outline-none cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">Expiring Options</span>
            <span className="bg-red-100 text-red-800 p-2 rounded-xl text-xs font-bold">⏳</span>
          </div>
          <span className="text-3xl font-extrabold text-slate-800 block mt-2 font-mono">
            {expiringOptions.length}
          </span>
          <span className="text-[10px] text-red-650 block mt-1 font-bold hover:underline">Requires urgent attention →</span>
        </button>

      </div>

      {/* Today's Bookings and Who Made Them */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Reservation log flow */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm col-span-2">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Recent Bookings Timeline & System Actions</h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
            {[...reservations].sort((a, b) => b.id - a.id).slice(0, 5).map((res) => {
              const client = agents.find(a => a.id === res.clientId);
              const hotel = hotels.find(h => h.id === res.hotelId);
              return (
                <div key={res.id} className="flex justify-between items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">ID: RSV-{res.id} • CHECK-IN: {res.checkIn}</span>
                    <p className="text-xs font-bold text-slate-800 uppercase mt-0.5">{res.guestName}</p>
                    <p className="text-[10px] text-slate-500">{client?.name} for <span className="font-semibold">{hotel?.name}</span></p>
                    {/* Profit/Cost details line */}
                    {(() => {
                      const totals = getReservationTotals(res);
                      return (
                        <div className="text-[10px] font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500">Sale:</span>
                          <span className="text-emerald-700 font-bold">{totals.totalSell.toLocaleString()} SAR</span>
                          <span className="text-zinc-350">•</span>
                          <span className="text-slate-500">Cost:</span>
                          <span className="text-amber-800 font-bold">{totals.totalBuy.toLocaleString()} SAR</span>
                          <span className="text-zinc-350">•</span>
                          <span className="text-slate-500">Profit:</span>
                          <span className={`font-bold ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{totals.profit.toLocaleString()} SAR</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-right text-[10px]">
                    <span className="text-slate-400 block font-mono">Recorded by:</span>
                    <span className="font-bold text-amber-700 text-[11px] block">{res.createdBy}</span>
                    <span className={`inline-block border mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                      res.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      res.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {res.status}
                    </span>
                  </div>
                </div>
              );
            })}
            {reservations.length === 0 && (
              <p className="text-slate-400 italic text-center text-xs py-8">No booking logs in system.</p>
            )}
          </div>
        </div>

        {/* Room portfolio status box */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Status Breakdown</h3>
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Confirmed (Definite)</span>
                <span className="font-mono">{confirmedBookings} bookings</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${totalBookings ? (confirmedBookings / totalBookings) * 105 : 0}%` }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Tentative Reservations</span>
                <span className="font-mono">{tentativeBookings} bookings</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${totalBookings ? (tentativeBookings / totalBookings) * 105 : 0}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Cancelled / Penalties</span>
                <span className="font-mono">{reservations.filter(r => r.status === 'Cancelled').length} bookings</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full" style={{ width: `${totalBookings ? (reservations.filter(r => r.status === 'Cancelled').length / totalBookings) * 105 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Top Clients and Suppliers Portfolios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 10 Clients */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Top 10 Clients (Sales Volume & Nights)</h3>
            <span className="font-mono text-[10px] text-slate-400">Ordered by Gross Sales</span>
          </div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto no-scrollbar">
            {topClients.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-300 w-4 text-center">{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-450">{item.roomNights} Room Nights booked</p>
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-emerald-800">
                  {item.sales.toLocaleString()} SAR
                </div>
              </div>
            ))}
            {topClients.length === 0 && (
              <p className="text-slate-400 italic text-center py-6">No sales stats available.</p>
            )}
          </div>
        </div>

        {/* Top 10 Suppliers */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Top 10 Suppliers (Purchase Value & Nights)</h3>
            <span className="font-mono text-[10px] text-slate-400">Ordered by Gross Buy</span>
          </div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto no-scrollbar">
            {topSuppliers.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-300 w-4 text-center">{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-450">{item.roomNights} Room Nights obtained</p>
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-amber-900">
                  {item.sales.toLocaleString()} SAR
                </div>
              </div>
            ))}
            {topSuppliers.length === 0 && (
              <p className="text-slate-400 italic text-center py-6">No supplier stats available.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
