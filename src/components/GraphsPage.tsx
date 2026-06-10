/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Reservation, Agent, Hotel, Transaction } from '../types';
import { getReservationTotals } from '../lib/storage';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface GraphsPageProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  transactions: Transaction[];
}

const COLORS = ['#c1a274', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS_SHORT[parseInt(month) - 1]} ${year}`;
}

export default function GraphsPage({ reservations, agents, hotels, transactions }: GraphsPageProps) {
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    reservations.forEach(r => {
      const y = new Date(r.checkIn).getFullYear();
      if (!isNaN(y)) years.add(String(y));
    });
    transactions.forEach(t => {
      const y = new Date(t.date).getFullYear();
      if (!isNaN(y)) years.add(String(y));
    });
    return Array.from(years).sort().reverse();
  }, [reservations, transactions]);

  // Filter reservations by year
  const filteredReservations = useMemo(() => {
    if (yearFilter === 'all') return reservations;
    return reservations.filter(r => new Date(r.checkIn).getFullYear().toString() === yearFilter);
  }, [reservations, yearFilter]);

  const filteredTransactions = useMemo(() => {
    if (yearFilter === 'all') return transactions;
    return transactions.filter(t => new Date(t.date).getFullYear().toString() === yearFilter);
  }, [transactions, yearFilter]);

  // === 1. CASH FLOW CHART ===
  const cashFlowData = useMemo(() => {
    const monthly: Record<string, { inflow: number; outflow: number }> = {};
    filteredTransactions.forEach(t => {
      const key = getMonthKey(t.date);
      if (!monthly[key]) monthly[key] = { inflow: 0, outflow: 0 };
      if (t.type === 'ClientPayment') monthly[key].inflow += t.amount;
      else if (t.type === 'SupplierPayment' || t.type === 'ClientRefund') monthly[key].outflow += t.amount;
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, val]) => ({
        month: getMonthLabel(key),
        Inflow: Math.round(val.inflow),
        Outflow: Math.round(val.outflow),
        'Net Cash': Math.round(val.inflow - val.outflow),
      }));
  }, [filteredTransactions]);

  // === 2. REVENUE TREND ===
  const revenueData = useMemo(() => {
    const monthly: Record<string, { gross: number; cost: number; profit: number }> = {};
    filteredReservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const key = getMonthKey(r.checkIn);
      const { totalSell, totalBuy, profit } = getReservationTotals(r);
      if (!monthly[key]) monthly[key] = { gross: 0, cost: 0, profit: 0 };
      monthly[key].gross += totalSell;
      monthly[key].cost += totalBuy;
      monthly[key].profit += profit;
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, val]) => ({
        month: getMonthLabel(key),
        Revenue: Math.round(val.gross),
        Cost: Math.round(val.cost),
        Profit: Math.round(val.profit),
      }));
  }, [filteredReservations]);

  // === 3. BOOKING STATUS DISTRIBUTION ===
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReservations.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredReservations]);

  const STATUS_COLORS: Record<string, string> = {
    Confirmed: '#10b981',
    Tentative: '#f59e0b',
    Cancelled: '#ef4444',
  };

  // === 4. TOP CLIENTS BY REVENUE ===
  const topClientsData = useMemo(() => {
    const clientRevenue: Record<string, number> = {};
    filteredReservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const { totalSell } = getReservationTotals(r);
      clientRevenue[r.clientId] = (clientRevenue[r.clientId] || 0) + totalSell;
    });
    return Object.entries(clientRevenue)
      .map(([id, revenue]) => {
        const agent = agents.find(a => a.id === id);
        return { name: agent?.name || 'Unknown', revenue: Math.round(revenue) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredReservations, agents]);

  // === 5. REVENUE BY HOTEL ===
  const hotelRevenueData = useMemo(() => {
    const hotelRev: Record<string, number> = {};
    filteredReservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const { totalSell } = getReservationTotals(r);
      hotelRev[r.hotelId] = (hotelRev[r.hotelId] || 0) + totalSell;
    });
    return Object.entries(hotelRev)
      .map(([id, revenue]) => {
        const hotel = hotels.find(h => h.id === id);
        return { name: hotel?.name || 'Unknown', revenue: Math.round(revenue) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredReservations, hotels]);

  // === 6. MONTHLY BOOKING VOLUME ===
  const bookingsVolumeData = useMemo(() => {
    const monthly: Record<string, { confirmed: number; tentative: number; cancelled: number }> = {};
    filteredReservations.forEach(r => {
      const key = getMonthKey(r.checkIn);
      if (!monthly[key]) monthly[key] = { confirmed: 0, tentative: 0, cancelled: 0 };
      if (r.status === 'Confirmed') monthly[key].confirmed++;
      else if (r.status === 'Tentative') monthly[key].tentative++;
      else if (r.status === 'Cancelled') monthly[key].cancelled++;
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, val]) => ({
        month: getMonthLabel(key),
        Confirmed: val.confirmed,
        Tentative: val.tentative,
        Cancelled: val.cancelled,
        Total: val.confirmed + val.tentative + val.cancelled,
      }));
  }, [filteredReservations]);

  // === 7. BOOKING SOURCE ANALYSIS ===
  const sourceData = useMemo(() => {
    const sources: Record<string, number> = {};
    filteredReservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const src = r.bookingSource || 'Direct';
      sources[src] = (sources[src] || 0) + 1;
    });
    return Object.entries(sources)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredReservations]);

  // === KPI Summary Cards ===
  const kpis = useMemo(() => {
    const active = filteredReservations.filter(r => r.status !== 'Cancelled');
    let totalRevenue = 0, totalCost = 0;
    active.forEach(r => {
      const { totalSell, totalBuy } = getReservationTotals(r);
      totalRevenue += totalSell;
      totalCost += totalBuy;
    });
    const totalInflow = filteredTransactions.filter(t => t.type === 'ClientPayment').reduce((s, t) => s + t.amount, 0);
    const totalOutflow = filteredTransactions.filter(t => t.type === 'SupplierPayment' || t.type === 'ClientRefund').reduce((s, t) => s + t.amount, 0);
    const cancelledCount = filteredReservations.filter(r => r.status === 'Cancelled').length;
    const cancelRate = filteredReservations.length > 0 ? (cancelledCount / filteredReservations.length) * 100 : 0;
    return {
      totalRevenue: Math.round(totalRevenue),
      totalProfit: Math.round(totalRevenue - totalCost),
      margin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1) : '0',
      totalBookings: filteredReservations.length,
      activeBookings: active.length,
      cancelRate: cancelRate.toFixed(1),
      cashCollected: Math.round(totalInflow),
      cashPaid: Math.round(totalOutflow),
      netCash: Math.round(totalInflow - totalOutflow),
    };
  }, [filteredReservations, filteredTransactions]);

  const formatSAR = (val: number) => `${(val / 1000).toFixed(0)}K`;

  return (
    <div className="space-y-6 overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📊 Graphs & Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">Visual insights into revenue, cash flow, and booking trends</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-semibold">Year:</label>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-amber-200"
          >
            <option value="all">All Time</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Revenue', value: `${kpis.totalRevenue.toLocaleString()} SAR`, color: 'from-blue-500 to-blue-600' },
          { label: 'Net Profit', value: `${kpis.totalProfit.toLocaleString()} SAR`, color: 'from-emerald-500 to-emerald-600' },
          { label: 'Profit Margin', value: `${kpis.margin}%`, color: 'from-amber-500 to-amber-600' },
          { label: 'Active Bookings', value: kpis.activeBookings.toString(), color: 'from-indigo-500 to-indigo-600' },
          { label: 'Net Cash Flow', value: `${kpis.netCash.toLocaleString()} SAR`, color: kpis.netCash >= 0 ? 'from-teal-500 to-teal-600' : 'from-red-500 to-red-600' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-gradient-to-br ${kpi.color} rounded-xl p-4 text-white shadow-lg`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{kpi.label}</p>
            <p className="text-lg font-bold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Cash Flow + Revenue Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-slate-800 mb-4">💰 Cash Flow (Monthly)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={cashFlowData}>
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={formatSAR} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()} SAR`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Inflow" stroke="#10b981" fill="url(#inflowGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="Outflow" stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} />
              <Line type="monotone" dataKey="Net Cash" stroke="#c1a274" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-slate-800 mb-4">📈 Revenue & Profit Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={formatSAR} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()} SAR`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Booking Volume + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-slate-800 mb-4">📅 Monthly Bookings Volume</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bookingsVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Confirmed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Tentative" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Cancelled" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-slate-800 mb-4">📊 Booking Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {statusData.map((entry, idx) => (
                  <Cell key={idx} fill={STATUS_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Top Clients + Revenue by Hotel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-slate-800 mb-4">👥 Top 10 Clients by Revenue</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topClientsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={formatSAR} tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()} SAR`} />
              <Bar dataKey="revenue" fill="#c1a274" radius={[0, 4, 4, 0]}>
                {topClientsData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-slate-800 mb-4">🏢 Revenue by Hotel</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={hotelRevenueData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={formatSAR} tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()} SAR`} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {hotelRevenueData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4: Booking Sources */}
      {sourceData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-slate-800 mb-4">🌐 Booking Sources</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sourceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                {sourceData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">Total Bookings</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{kpis.totalBookings}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">Cancellation Rate</p>
          <p className="text-xl font-bold text-rose-600 mt-1">{kpis.cancelRate}%</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">Cash Collected</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{kpis.cashCollected.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">Cash Paid Out</p>
          <p className="text-xl font-bold text-red-600 mt-1">{kpis.cashPaid.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
