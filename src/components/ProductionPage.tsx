/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Reservation, Agent, Hotel } from '../types';
import { getReservationTotals, exportToCSV, exportToExcel } from '../lib/storage';
import { useLang } from '../lib/LanguageContext';

interface ProductionPageProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
}

type SortField = 'name' | 'roomNights' | 'revenue' | 'cost' | 'profit' | 'bookings';
type SortDir = 'asc' | 'desc';
type ViewMode = 'clients' | 'suppliers';

interface AgentStats {
  id: string;
  name: string;
  companyName: string;
  bookings: number;
  roomNights: number;
  revenue: number;
  cost: number;
  profit: number;
}

export default function ProductionPage({ reservations, agents, hotels }: ProductionPageProps) {
  const { t, lang } = useLang();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('clients');
  const [filterHotel, setFilterHotel] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReservations = useMemo(() => {
    let list = reservations.filter(r => r.status !== 'Cancelled');
    if (dateFrom) list = list.filter(r => r.createdAt.split(' ')[0] >= dateFrom);
    if (dateTo) list = list.filter(r => r.createdAt.split(' ')[0] <= dateTo);
    if (filterHotel) list = list.filter(r => r.hotelId === filterHotel);
    return list;
  }, [reservations, dateFrom, dateTo, filterHotel]);

  const computeStats = (mode: ViewMode): AgentStats[] => {
    const stats: { [id: string]: AgentStats } = {};

    filteredReservations.forEach(res => {
      const agentId = mode === 'clients' ? res.clientId : res.supplierId;
      if (filterAgent && agentId !== filterAgent) return;
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      if (!stats[agentId]) {
        stats[agentId] = {
          id: agentId,
          name: agent.name,
          companyName: agent.companyName || agent.name,
          bookings: 0,
          roomNights: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }

      const { totalSell, totalBuy } = getReservationTotals(res);
      const nights = (res.rooms || []).reduce((sum, rm) => sum + (rm.qty * res.nights), 0);

      stats[agentId].bookings += 1;
      stats[agentId].roomNights += nights;
      stats[agentId].revenue += totalSell;
      stats[agentId].cost += totalBuy;
      stats[agentId].profit += totalSell - totalBuy;
    });

    return Object.values(stats)
      .filter(s => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'name') return dir * a.companyName.localeCompare(b.companyName);
        return dir * ((a[sortField] as number) - (b[sortField] as number));
      });
  };

  const clientStats = computeStats('clients');
  const supplierStats = computeStats('suppliers');
  const activeStats = viewMode === 'clients' ? clientStats : supplierStats;

  const totals = useMemo(() => ({
    bookings: activeStats.reduce((s, a) => s + a.bookings, 0),
    roomNights: activeStats.reduce((s, a) => s + a.roomNights, 0),
    revenue: activeStats.reduce((s, a) => s + a.revenue, 0),
    cost: activeStats.reduce((s, a) => s + a.cost, 0),
    profit: activeStats.reduce((s, a) => s + a.profit, 0),
  }), [activeStats]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const handleExport = () => {
    const data = activeStats.map(s => ({
      Name: s.companyName,
      Bookings: s.bookings,
      'Room Nights': s.roomNights,
      Revenue: s.revenue,
      Cost: s.cost,
      Profit: s.profit,
    }));
    exportToCSV(`production-${viewMode}-${dateFrom || 'all'}.csv`, data);
  };

  const handleExportExcel = () => {
    const data = activeStats.map(s => ({
      'Name': s.companyName,
      'Bookings': s.bookings,
      'Room Nights': s.roomNights,
      'Revenue (SAR)': s.revenue,
      'Cost (SAR)': s.cost,
      'Profit (SAR)': s.profit,
      'Margin': s.revenue > 0 ? `${((s.profit / s.revenue) * 100).toFixed(1)}%` : '0.0%',
    }));
    exportToExcel(`Production ${viewMode} ${dateFrom || 'all'}.xlsx`, data, 'Production');
  };

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setFilterHotel(''); setFilterAgent(''); setSearchTerm('');
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('prod.activePartners')}</div>
          <div className="text-2xl font-black text-slate-900">{activeStats.length}</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1">{t('prod.totalBookings')}</div>
          <div className="text-xl font-black text-indigo-800">{totals.bookings}</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-blue-600 mb-1">{t('prod.roomNights')}</div>
          <div className="text-xl font-black text-blue-800">{totals.roomNights.toLocaleString()}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm card-hover-lift">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">{viewMode === 'clients' ? t('prod.revenue') : t('prod.purchase')}</div>
          <div className="text-xl font-black text-emerald-800">{(viewMode === 'clients' ? totals.revenue : totals.cost).toLocaleString()}</div>
          <div className="text-[9px] text-emerald-500 font-mono">SAR</div>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${totals.profit >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className={`text-[10px] uppercase font-bold mb-1 ${totals.profit >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>{t('prod.profit')}</div>
          <div className={`text-xl font-black ${totals.profit >= 0 ? 'text-amber-800' : 'text-rose-800'}`}>{totals.profit.toLocaleString()}</div>
          <div className={`text-[9px] font-mono ${totals.profit >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>SAR</div>
        </div>
      </div>

      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm text-xs">
        {/* Header */}
        <div className="border-b border-slate-100 pb-4 mb-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{t('prod.title')}</h2>
            <p className="text-xs text-slate-500">{t('prod.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[10px] px-3 py-2 rounded-lg transition border border-emerald-200">
              ⬇️ Excel
            </button>
            <button onClick={handleExport} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] px-3 py-2 rounded-lg transition">
              ⬇️ {t('prod.exportCSV')}
            </button>
          </div>
        </div>

        {/* View Mode Toggle + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <button onClick={() => setViewMode('clients')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'clients' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              👥 {t('prod.clients')}
            </button>
            <button onClick={() => setViewMode('suppliers')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'suppliers' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              🏭 {t('prod.suppliers')}
            </button>
          </div>

          <input type="text" placeholder="Search name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full sm:w-40" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">From:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">To:</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono" />
          </div>

          <select value={filterHotel} onChange={e => setFilterHotel(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="">All Hotels</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>

          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="">All {viewMode === 'clients' ? 'Clients' : 'Suppliers'}</option>
            {agents.filter(a => viewMode === 'clients' ? (a.type === 'Customer' || a.type === 'Both') : (a.type === 'Supplier' || a.type === 'Both')).map(a => (
              <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
            ))}
          </select>

          {(dateFrom || dateTo || filterHotel || filterAgent || searchTerm) && (
            <button onClick={clearFilters} className="text-[10px] text-rose-600 font-bold hover:text-rose-700">✕ Clear</button>
          )}

          <div className="ml-auto text-[10px] text-slate-400 font-mono w-full sm:w-auto text-right">{filteredReservations.length} bookings analyzed</div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3 cursor-pointer hover:text-slate-600" onClick={() => toggleSort('name')}>
                  {viewMode === 'clients' ? 'Client' : 'Supplier'}{sortIcon('name')}
                </th>
                <th className="py-3 px-3 text-center cursor-pointer hover:text-slate-600" onClick={() => toggleSort('bookings')}>
                  Bookings{sortIcon('bookings')}
                </th>
                <th className="py-3 px-3 text-center cursor-pointer hover:text-slate-600" onClick={() => toggleSort('roomNights')}>
                  Room Nights{sortIcon('roomNights')}
                </th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-slate-600" onClick={() => toggleSort('revenue')}>
                  Revenue (Sell){sortIcon('revenue')}
                </th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-slate-600" onClick={() => toggleSort('cost')}>
                  Cost (Buy){sortIcon('cost')}
                </th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-slate-600" onClick={() => toggleSort('profit')}>
                  Profit{sortIcon('profit')}
                </th>
                <th className="py-3 px-3 text-right">{t('prod.margin')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {activeStats.map((stat, idx) => {
                const margin = stat.revenue > 0 ? ((stat.profit / stat.revenue) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={stat.id} className="hover:bg-slate-50/45">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800">{stat.companyName}</div>
                      <div className="text-[10px] text-slate-400">{stat.name !== stat.companyName ? stat.name : ''}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">{stat.bookings}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">{stat.roomNights.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{stat.revenue.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{stat.cost.toLocaleString()}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-extrabold ${stat.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {stat.profit.toLocaleString()}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${Number(margin) >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                      {margin}%
                    </td>
                  </tr>
                );
              })}
              {activeStats.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center animate-fade-in">
                  <div className="text-5xl mb-4">📈</div>
                  <p className="text-sm font-bold text-slate-500">{t('prod.noData')}</p>
                  <p className="text-xs text-slate-400 mt-1">Adjust date range or filters to see production data.</p>
                </td></tr>
              )}
            </tbody>
            {activeStats.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-extrabold border-t border-slate-300 text-slate-800">
                  <td className="py-2.5 px-3" colSpan={2}>Total ({activeStats.length} partners)</td>
                  <td className="py-2.5 px-3 text-center font-mono">{totals.bookings}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-blue-700">{totals.roomNights.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{totals.revenue.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-800">{totals.cost.toLocaleString()}</td>
                  <td className={`py-2.5 px-3 text-right font-mono ${totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{totals.profit.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-indigo-700">{totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
