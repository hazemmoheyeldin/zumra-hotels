/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Reservation, Agent, Hotel, User, FollowUp } from '../types';
import { getReservationTotals, getEgyptTime } from '../lib/storage';
import { useCurrency } from '../lib/CurrencyContext';
import { useLang } from '../lib/LanguageContext';
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
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const { t } = useLang();

  // Filtered reservations based on dashboard filters
  const filteredReservations = useMemo(() => {
    let list = reservations;
    if (dateFrom) list = list.filter(r => r.createdAt.split(' ')[0] >= dateFrom);
    if (dateTo) list = list.filter(r => r.createdAt.split(' ')[0] <= dateTo);
    if (statusFilter !== 'All') list = list.filter(r => r.status === statusFilter);
    return list;
  }, [reservations, dateFrom, dateTo, statusFilter]);

  // Calculations
  const reservationsToday = filteredReservations.filter(res => res.createdAt.startsWith(todayStr));
  
  // Calculate stats from filtered data
  const totalBookings = filteredReservations.length;
  const tentativeBookings = filteredReservations.filter(res => res.status === 'Tentative').length;
  const confirmedBookings = filteredReservations.filter(res => res.status === 'Confirmed').length;
  const cancelledBookings = filteredReservations.filter(res => res.status === 'Cancelled').length;
  
  // Total financial metrics
  const totalRevenue = filteredReservations.reduce((acc, res) => { if (res.status === 'Cancelled') return acc; const { totalSell } = getReservationTotals(res); return acc + totalSell; }, 0);
  const totalCost = filteredReservations.reduce((acc, res) => { if (res.status === 'Cancelled') return acc; const { totalBuy } = getReservationTotals(res); return acc + totalBuy; }, 0);
  const totalProfit = totalRevenue - totalCost;
  
  // Checking in today count
  const checkInsToday = filteredReservations.filter(res => res.checkIn === todayStr && res.status !== 'Cancelled');
  
  // Expiring options count
  const expiringOptions = filteredReservations.filter(res => res.clientOptionDate === todayStr && res.status === 'Tentative');

  // In house
  const inHouseList = filteredReservations.filter(res => res.checkIn <= todayStr && res.checkOut > todayStr && res.status === 'Confirmed');

  // Upcoming check-ins (next 7 days)
  const upcomingCheckIns = useMemo(() => {
    const today = new Date(todayStr);
    const in7days = new Date(today); in7days.setDate(in7days.getDate() + 7);
    return filteredReservations
      .filter(res => {
        if (res.status === 'Cancelled') return false;
        const ci = new Date(res.checkIn);
        return ci >= today && ci <= in7days;
      })
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [filteredReservations, todayStr]);

  // Occupancy rate (simple: in-house rooms / total hotels rooms estimate)
  const occupancyRate = useMemo(() => {
    const totalInHouseRooms = inHouseList.reduce((sum, res) => sum + res.rooms.reduce((s, rm) => s + rm.qty, 0), 0);
    const totalHotelRooms = (hotels.length || 1) * 100;
    return Math.min(100, Math.round((totalInHouseRooms / totalHotelRooms) * 100));
  }, [inHouseList, hotels]);

  // Calculate high quality sales data for charts and portfolio lists
  const getSupplierStats = () => {
    const stats: { [id: string]: { id: string; name: string; sales: number; roomNights: number; bookings: number } } = {};
    filteredReservations.forEach(res => {
      if (res.status === 'Cancelled') return;
      const { totalBuy } = getReservationTotals(res);
      const host = agents.find(a => a.id === res.supplierId) || { name: 'Direct' };
      const nightsMultiplier = res.rooms.reduce((sum, rm) => sum + (rm.qty * res.nights), 0);
      if (!stats[res.supplierId]) stats[res.supplierId] = { id: res.supplierId, name: host.name, sales: 0, roomNights: 0, bookings: 0 };
      stats[res.supplierId].sales += totalBuy;
      stats[res.supplierId].roomNights += nightsMultiplier;
      stats[res.supplierId].bookings += 1;
    });
    return Object.values(stats).sort((a, b) => b.sales - a.sales).slice(0, 10);
  };

  const getClientStats = () => {
    const stats: { [id: string]: { id: string; name: string; sales: number; roomNights: number; bookings: number } } = {};
    filteredReservations.forEach(res => {
      if (res.status === 'Cancelled') return;
      const { totalSell } = getReservationTotals(res);
      const client = agents.find(a => a.id === res.clientId) || { name: 'Direct Client', companyName: '' };
      const nightsMultiplier = res.rooms.reduce((sum, rm) => sum + (rm.qty * res.nights), 0);
      if (!stats[res.clientId]) stats[res.clientId] = { id: res.clientId, name: client.companyName || client.name, sales: 0, roomNights: 0, bookings: 0 };
      stats[res.clientId].sales += totalSell;
      stats[res.clientId].roomNights += nightsMultiplier;
      stats[res.clientId].bookings += 1;
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

  // Confirmed bookings with unpaid client amounts, check-in within 14 days
  const unpaidUpcoming = reservations.filter(res => {
    if (res.status !== 'Confirmed') return false;
    const { totalSell } = getReservationTotals(res);
    const clientOwes = totalSell - (res.amountPaidByClient || 0);
    if (clientOwes <= 0) return false;
    const checkInDate = new Date(res.checkIn);
    const today = new Date(todayStr);
    const diffTime = checkInDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 14 && diffDays >= 0;
  }).sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  return (
    <div className="space-y-6">
      
      {/* Alert Block for same-day Expiring Options (Compact Notification Style) */}
      {expiringOptions.length > 0 && (
        <div className="bg-rose-50 border border-rose-150 text-rose-955 rounded-xl p-3 px-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-base animate-pulse">⏰</span>
            <div>
              <p className="font-semibold text-rose-850">
                <span>{t('dash.expiredOptions', { count: expiringOptions.length })}</span>
              </p>
              <p className="text-[10.5px] text-rose-700 font-medium">{t('dash.expiredOptionsDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-rose-500 font-bold uppercase mr-1 hidden md:inline">{t('dash.quickLinks')}</span>
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
              {t('dash.resolveList')} →
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
                <span>{t('dash.pendingFollowUps', { count: pendingFollowUps.length })}</span>
              </p>
              <p className="text-[10.5px] text-indigo-700 font-medium">{t('dash.pendingFollowUpsDesc')}</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('Sales')} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] px-3 py-1 rounded-lg shadow-xs transition-transform hover:scale-[1.02] cursor-pointer whitespace-nowrap"
          >
            {t('dash.openSalesCRM')} →
          </button>
        </div>
      )}

      {/* Alert Block for Unpaid Upcoming Bookings (within 14 days of check-in) */}
      {unpaidUpcoming.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-3 px-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-base animate-pulse">💰</span>
            <div>
              <p className="font-semibold text-amber-900">
                <span>{t('dash.unpaidBookings', { count: unpaidUpcoming.length })}</span>
              </p>
              <p className="text-[10.5px] text-amber-700 font-medium">{t('dash.unpaidBookingsDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {unpaidUpcoming.slice(0, 3).map(res => {
                const { totalSell } = getReservationTotals(res);
                const owes = totalSell - (res.amountPaidByClient || 0);
                return (
                  <button 
                    key={res.id}
                    onClick={() => onNavigate('Reservations', { viewReservationId: res.id })}
                    title={`RSV-${res.id} - Client owes ${owes.toLocaleString()} SAR`}
                    className="bg-white hover:bg-amber-100/50 text-amber-900 text-[10px] font-mono font-bold px-2 py-1 rounded-lg border border-amber-200/60 transition cursor-pointer flex items-center gap-1"
                  >
                    🔍 RSV-{res.id} ({owes.toLocaleString()} SAR)
                  </button>
                );
              })}
              {unpaidUpcoming.length > 3 && (
                <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-lg">
                  +{unpaidUpcoming.length - 3} more
                </span>
              )}
            </div>
            <button 
              onClick={() => onNavigate('Reservations')} 
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10.5px] px-3 py-1 rounded-lg shadow-xs transition-transform hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            >
              {t('dash.reviewPayments')} →
            </button>
          </div>
        </div>
      )}

      {/* Alert Block for Missing Rooming Lists */}
      {missingRoomingList.length > 0 && (
        <div className="bg-orange-50 border border-orange-150 text-orange-950 rounded-xl p-3 px-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-base animate-pulse">⚠️</span>
            <div>
              <p className="font-semibold text-orange-850">
                <span>{t('dash.missingRooming', { count: missingRoomingList.length })}</span>
              </p>
              <p className="text-[10.5px] text-orange-700 font-medium">{t('dash.missingRoomingDesc')}</p>
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

      {/* Dashboard Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-2 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">📅 {t('common.from')}:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full md:w-auto px-2 py-1.5 min-h-[40px] md:min-h-[36px] border border-slate-300 rounded-lg text-[12px] md:text-[11px] font-mono focus:border-indigo-400 focus:outline-none bg-white text-slate-800" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">📅 {t('common.to')}:</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full md:w-auto px-2 py-1.5 min-h-[40px] md:min-h-[36px] border border-slate-300 rounded-lg text-[12px] md:text-[11px] font-mono focus:border-indigo-400 focus:outline-none bg-white text-slate-800" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">📊 {t('common.status')}:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full md:w-auto px-2 py-1.5 min-h-[40px] md:min-h-[36px] border border-slate-300 rounded-lg text-[12px] md:text-[11px] font-semibold focus:border-indigo-400 focus:outline-none bg-white text-slate-800">
            <option value="All">{t('dash.allStatuses')}</option>
            <option value="Confirmed">{t('res.confirmed')}</option>
            <option value="Tentative">{t('res.tentative')}</option>
            <option value="Cancelled">{t('res.cancelled')}</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-2">
          {(dateFrom || dateTo || statusFilter !== 'All') && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('All'); }} className="text-[10px] text-rose-600 font-bold hover:text-rose-700">✕ {t('common.clearFilters')}</button>
          )}
          <div className="text-[10px] text-slate-400 font-mono ml-auto md:ml-0">{t('dash.ofBookings', { filtered: filteredReservations.length, total: reservations.length })}</div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-blue-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl border-b-4 border-blue-500 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-400/10 rounded-full"></div>
        <div className="flex flex-col sm:flex-row items-center gap-4 z-10 w-full md:w-auto">
          <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-sm shadow-inner flex items-center justify-center">
            <ZumraLogo size="xl" variant="light" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold uppercase tracking-tight text-amber-100">{t('dash.title')}</h2>
            <p className="text-xs text-emerald-250 mt-1 font-mono tracking-wide">{t('dash.systemNode')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto justify-center">
          {/* Fast Lookup Booking Number Search Field */}
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-[10px]">🔍</span>
            <input
              type="text"
              placeholder={t('dash.fastSearch')}
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
              className="pl-7 pr-2.5 py-2 min-h-[36px] bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-[11px] text-white placeholder-emerald-300/50 focus:outline-none focus:border-amber-400 w-full sm:w-38 font-mono"
            />
          </div>
          <button 
            onClick={() => onNavigate('Reservations', { showNewForm: true })}
            className="bg-blue-600 font-bold hover:bg-blue-700 text-white px-4 py-2 min-h-[36px] rounded-xl text-xs transition flex items-center gap-1 shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            {t('dash.newReservation')}
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        
        <button onClick={() => onNavigate('Reservations', { customFilter: 'bookings-today' })} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-emerald-200 hover:shadow transition-all text-left cursor-pointer">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('dash.bookingsToday')}</div>
          <div className="text-2xl font-extrabold text-slate-800 font-mono mt-1">{reservationsToday.length}</div>
        </button>

        <button onClick={() => onNavigate('Reservations', { customFilter: 'checkin-today' })} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-amber-400 hover:shadow transition-all text-left cursor-pointer">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('dash.checkInToday')}</div>
          <div className="text-2xl font-extrabold text-slate-800 font-mono mt-1">{checkInsToday.length}</div>
        </button>

        <button onClick={() => onNavigate('Reservations', { customFilter: 'inhouse' })} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-emerald-400 hover:shadow transition-all text-left cursor-pointer">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('dash.inHouse')}</div>
          <div className="text-2xl font-extrabold text-slate-800 font-mono mt-1">{inHouseList.length}</div>
        </button>

        <button onClick={() => onNavigate('Reservations', { customFilter: 'expiring-options' })} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-red-400 hover:shadow transition-all text-left cursor-pointer">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('dash.expiringOptions')}</div>
          <div className="text-2xl font-extrabold text-slate-800 font-mono mt-1">{expiringOptions.length}</div>
        </button>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm card-hover-lift">
          <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">{t('dash.revenue')}</div>
          <div className="text-lg font-extrabold text-emerald-800 font-mono mt-1">{totalRevenue.toLocaleString()}</div>
          <div className="text-[9px] text-emerald-500">SAR</div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm card-hover-lift">
          <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">{t('dash.cost')}</div>
          <div className="text-lg font-extrabold text-amber-800 font-mono mt-1">{totalCost.toLocaleString()}</div>
          <div className="text-[9px] text-amber-500">SAR</div>
        </div>

        <div className={`rounded-2xl p-4 shadow-sm border ${totalProfit >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className={`text-[9px] font-bold uppercase tracking-wide ${totalProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{t('dash.profit')}</div>
          <div className={`text-lg font-extrabold font-mono mt-1 ${totalProfit >= 0 ? 'text-indigo-800' : 'text-rose-800'}`}>{totalProfit.toLocaleString()}</div>
          <div className={`text-[9px] ${totalProfit >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>SAR</div>
        </div>
      </div>

      {/* Multi-Currency Summary */}
      <MultiCurrencyBar amount={totalRevenue} label={t('dash.revenue')} />

      {/* Upcoming Check-ins + Occupancy + Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Occupancy Rate */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">{t('dash.occupancy')}</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="35" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle cx="40" cy="40" r="35" fill="none" stroke={occupancyRate >= 80 ? '#10b981' : occupancyRate >= 50 ? '#f59e0b' : '#6366f1'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${occupancyRate * 2.2} 220`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-slate-800">{occupancyRate}%</span>
            </div>
            <div className="text-xs text-slate-500">
              <div className="font-bold text-slate-700">{t('dash.groupsInHouse', { count: inHouseList.length })}</div>
              <div className="mt-1">{t('dash.roomsOccupied', { count: inHouseList.reduce((s, r) => s + r.rooms.reduce((a, rm) => a + rm.qty, 0), 0) })}</div>
              <div className="mt-1 text-[10px] text-slate-400">{t('dash.basedOnHotels', { count: hotels.length })}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">{t('dash.quickActions')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onNavigate('Reservations', { showNewForm: true })} className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-3 py-2.5 text-[10px] font-bold text-emerald-800 transition flex items-center gap-1.5">
              <span>📅</span> {t('dash.newBooking')}
            </button>
            <button onClick={() => onNavigate('Transactions')} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-2.5 text-[10px] font-bold text-indigo-800 transition flex items-center gap-1.5">
              <span>💰</span> {t('dash.recordPayment')}
            </button>
            <button onClick={() => onNavigate('Reports')} className="bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-3 py-2.5 text-[10px] font-bold text-amber-800 transition flex items-center gap-1.5">
              <span>📋</span> {t('dash.generateReport')}
            </button>
            <button onClick={() => onNavigate('Production')} className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl px-3 py-2.5 text-[10px] font-bold text-blue-800 transition flex items-center gap-1.5">
              <span>📈</span> {t('dash.production')}
            </button>
          </div>
        </div>

        {/* Upcoming Check-ins (Next 7 days) */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t('dash.arrivalsNext7')}</h3>
            <span className="text-[10px] font-mono text-slate-400">{t('dash.checkIns', { count: upcomingCheckIns.length })}</span>
          </div>
          <div className="space-y-2 max-h-[120px] overflow-y-auto no-scrollbar">
            {upcomingCheckIns.slice(0, 5).map(res => {
              const hotel = hotels.find(h => h.id === res.hotelId);
              const daysUntil = Math.ceil((new Date(res.checkIn).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <button key={res.id} onClick={() => onNavigate('Reservations', { viewReservationId: res.id })} className="w-full flex items-center justify-between text-[10px] hover:bg-slate-50 rounded-lg px-2 py-1 transition cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800">{res.guestName}</span>
                    <span className="text-slate-400 ml-1.5">{hotel?.name}</span>
                  </div>
                  <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[9px] ${daysUntil === 0 ? 'bg-emerald-100 text-emerald-700' : daysUntil <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {daysUntil === 0 ? t('dash.today') : `${daysUntil}d`}
                  </span>
                </button>
              );
            })}
            {upcomingCheckIns.length === 0 && (
              <p className="text-slate-400 italic text-center text-[10px] py-3">{t('dash.noArrivals')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Today's Bookings and Who Made Them */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Reservation log flow */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm col-span-2">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">{t('dash.recentBookings')}</h3>
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
                          <span className="text-slate-500">{t('dash.sale')}:</span>
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
                    <span className="text-slate-400 block font-mono">{t('dash.recordedBy')}:</span>
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
              <p className="text-slate-400 italic text-center text-xs py-8">{t('dash.noBookingLogs')}</p>
            )}
          </div>
        </div>

        {/* Room portfolio status box */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">{t('dash.statusBreakdown')}</h3>
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>{t('dash.confirmed')}</span>
                <span className="font-mono">{t('dash.bookings', { count: confirmedBookings })}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${totalBookings ? (confirmedBookings / totalBookings) * 105 : 0}%` }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>{t('dash.tentative')}</span>
                <span className="font-mono">{t('dash.bookings', { count: tentativeBookings })}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${totalBookings ? (tentativeBookings / totalBookings) * 105 : 0}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>{t('dash.cancelled')}</span>
                <span className="font-mono">{t('dash.bookings', { count: cancelledBookings })}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full" style={{ width: `${totalBookings ? (cancelledBookings / totalBookings) * 105 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Pending Credits & Wallet Widget */}
      {(() => {
        const agentsWithCredit = agents.filter(a => (a.walletBalance || 0) > 0);
        const pendingRefunds = agents.flatMap(a => (a.pendingRefunds || []).filter(r => r.status === 'Pending'));
        if (agentsWithCredit.length === 0 && pendingRefunds.length === 0) return null;
        return (
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">💰 Pending Credits & Wallet</h3>
              <span className="font-mono text-[10px] text-slate-400">{agentsWithCredit.length} agent{agentsWithCredit.length !== 1 ? 's' : ''} with credit</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agents with Credit Balance */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-emerald-600 mb-2">Credit Balances</h4>
                {agentsWithCredit.length > 0 ? (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                    {agentsWithCredit.map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{a.companyName || a.name}</p>
                          <p className="text-[10px] text-slate-400">{a.type === 'Customer' ? 'Client' : a.type === 'Supplier' ? 'Supplier' : 'Both'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-700 font-mono">{(a.walletBalance || 0).toLocaleString()} SAR</p>
                          <button
                            onClick={() => onNavigate('Transactions', { agentId: a.id })}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                          >
                            Apply Credit →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[10px] py-2">No credit balances</p>
                )}
              </div>
              {/* Pending Refund Alerts */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-rose-600 mb-2">Pending Refunds</h4>
                {pendingRefunds.length > 0 ? (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                    {pendingRefunds.map(rf => {
                      const a = agents.find(ag => ag.id === rf.partyId);
                      return (
                        <div key={rf.id} className="flex items-center justify-between bg-rose-50 rounded-lg px-3 py-2 border border-rose-100">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{a?.companyName || a?.name || rf.partyId}</p>
                            <p className="text-[10px] text-slate-400">{rf.party} • RSV-{rf.bookingId}</p>
                          </div>
                          <p className="text-sm font-black text-rose-700 font-mono">{rf.amount.toLocaleString()} SAR</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[10px] py-2">No pending refunds</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Top Clients and Suppliers Portfolios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 10 Clients */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t('dash.topClients')}</h3>
            <span className="font-mono text-[10px] text-slate-400">{t('dash.orderedBySales')}</span>
          </div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto no-scrollbar">
            {topClients.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate('Reservations', { clientId: item.id })}
                title={`View all bookings for ${item.name}`}
                className="w-full flex justify-between items-center text-xs hover:bg-indigo-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-300 w-4 text-center">{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{item.name}</p>
                    <p className="text-[10px] text-slate-450">{item.roomNights} Room Nights · {item.bookings} bookings</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-right font-mono font-bold text-emerald-800">
                    {item.sales.toLocaleString()} SAR
                  </div>
                  <span className="text-slate-300 group-hover:text-indigo-500 text-sm transition-colors">→</span>
                </div>
              </button>
            ))}
            {topClients.length === 0 && (
              <p className="text-slate-400 italic text-center py-6">{t('dash.noSalesStats')}</p>
            )}
          </div>
        </div>

        {/* Top 10 Suppliers */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t('dash.topSuppliers')}</h3>
            <span className="font-mono text-[10px] text-slate-400">{t('dash.orderedByBuy')}</span>
          </div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto no-scrollbar">
            {topSuppliers.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate('Reservations', { supplierId: item.id })}
                title={`View all bookings from ${item.name}`}
                className="w-full flex justify-between items-center text-xs hover:bg-amber-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-300 w-4 text-center">{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">{item.name}</p>
                    <p className="text-[10px] text-slate-450">{item.roomNights} Room Nights · {item.bookings} bookings</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-right font-mono font-bold text-amber-900">
                    {item.sales.toLocaleString()} SAR
                  </div>
                  <span className="text-slate-300 group-hover:text-amber-500 text-sm transition-colors">→</span>
                </div>
              </button>
            ))}
            {topSuppliers.length === 0 && (
              <p className="text-slate-400 italic text-center py-6">{t('dash.noSupplierStats')}</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

function MultiCurrencyBar({ amount, label }: { amount: number; label: string }) {
  const { fxRates, isLiveRates, ratesTimestamp, refreshRates } = useCurrency();
  const { t } = useLang();
  const currencies = [
    { code: 'SAR', symbol: 'SAR', flag: '🇸🇦' },
    { code: 'USD', symbol: '$', flag: '🇺🇸' },
    { code: 'EGP', symbol: 'EGP', flag: '🇪🇬' },
    { code: 'EUR', symbol: '€', flag: '🇪🇺' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase">
          {t('currency.inMultiple', { label })} {isLiveRates && <span className="text-emerald-500">{t('currency.live')}</span>}
          {ratesTimestamp && <span className="text-slate-400 font-normal ml-1">({ratesTimestamp})</span>}
        </span>
        <button onClick={refreshRates} className="text-[9px] text-blue-600 hover:text-blue-800 font-medium">{t('currency.refreshRates')}</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {currencies.map(c => {
          const rate = fxRates[c.code as keyof typeof fxRates];
          const converted = amount * rate;
          return (
            <div key={c.code} className="bg-slate-50 rounded-lg p-2 text-center group relative cursor-default" title={`1 SAR = ${rate.toLocaleString('en-US', { minimumFractionDigits: 4 })} ${c.code}`}>
              <div className="text-[10px] text-slate-500">{c.flag} {c.code}</div>
              <div className="text-sm font-bold text-slate-800 font-mono">{converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 mb-1 transition-opacity">
                1 SAR = {rate.toLocaleString('en-US', { minimumFractionDigits: 4 })} {c.code}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
