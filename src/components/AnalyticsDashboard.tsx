import React, { useState, useMemo } from 'react';
import { Reservation, Transaction, Agent, Hotel } from '../types';
import { getReservationTotals } from '../lib/storage';
import { useLang } from '../lib/LanguageContext';

interface AnalyticsProps {
  reservations: Reservation[];
  transactions: Transaction[];
  agents: Agent[];
  hotels: Hotel[];
}

type TimeRange = '3M' | '6M' | '12M' | 'ALL';

export default function AnalyticsDashboard({ reservations, transactions, agents, hotels }: AnalyticsProps) {
  const { t } = useLang();
  const [timeRange, setTimeRange] = useState<TimeRange>('12M');

  const agentMap = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);
  const hotelMap = useMemo(() => new Map(hotels.map(h => [h.id, h])), [hotels]);

  // Filter data by time range
  const filteredData = useMemo(() => {
    const now = new Date();
    const months = timeRange === '3M' ? 3 : timeRange === '6M' ? 6 : timeRange === '12M' ? 12 : 999;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return {
      reservations: reservations.filter(r => r.checkIn >= cutoffStr),
      transactions: transactions.filter(t => t.date >= cutoffStr),
    };
  }, [reservations, transactions, timeRange]);

  // Monthly Revenue Chart
  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; cost: number; profit: number }>();
    const now = new Date();
    const months = timeRange === 'ALL' ? 24 : timeRange === '3M' ? 3 : timeRange === '6M' ? 6 : 12;

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      map.set(key, { month: label, revenue: 0, cost: 0, profit: 0 });
    }

    filteredData.reservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const key = r.checkIn.substring(0, 7);
      const entry = map.get(key);
      if (entry) {
        const totals = getReservationTotals(r);
        entry.revenue += totals.totalSell;
        entry.cost += totals.totalBuy;
        entry.profit += (totals.totalSell - totals.totalBuy);
      }
    });

    return Array.from(map.values());
  }, [filteredData, timeRange]);

  const maxRevenue = useMemo(() => Math.max(...monthlyRevenue.map(m => m.revenue), 1), [monthlyRevenue]);

  // Seasonal Heatmap (booking count by month)
  const seasonalData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' }),
      count: 0,
      revenue: 0,
    }));

    reservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const m = parseInt(r.checkIn.substring(5, 7)) - 1;
      if (m >= 0 && m < 12) {
        months[m].count++;
        const totals = getReservationTotals(r);
        months[m].revenue += totals.totalSell;
      }
    });

    return months;
  }, [reservations]);

  const maxSeasonal = useMemo(() => Math.max(...seasonalData.map(s => s.count), 1), [seasonalData]);

  // Top clients by revenue
  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; bookings: number; profit: number }>();

    filteredData.reservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const client = agentMap.get(r.clientId);
      const name = client?.companyName || client?.name || 'Unknown';
      const entry = map.get(r.clientId) || { name, revenue: 0, bookings: 0, profit: 0 };
      const totals = getReservationTotals(r);
      entry.revenue += totals.totalSell;
      entry.profit += (totals.totalSell - totals.totalBuy);
      entry.bookings++;
      map.set(r.clientId, entry);
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredData, agentMap]);

  const maxClientRevenue = useMemo(() => Math.max(...topClients.map(c => c.revenue), 1), [topClients]);

  // Top hotels by booking volume
  const topHotels = useMemo(() => {
    const map = new Map<string, { name: string; bookings: number; revenue: number; nights: number }>();

    filteredData.reservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const hotel = hotelMap.get(r.hotelId);
      const name = hotel?.name || 'Unknown';
      const entry = map.get(r.hotelId) || { name, bookings: 0, revenue: 0, nights: 0 };
      const totals = getReservationTotals(r);
      entry.bookings++;
      entry.revenue += totals.totalSell;
      entry.nights += r.nights;
      map.set(r.hotelId, entry);
    });

    return Array.from(map.values()).sort((a, b) => b.bookings - a.bookings).slice(0, 10);
  }, [filteredData, hotelMap]);

  const maxHotelBookings = useMemo(() => Math.max(...topHotels.map(h => h.bookings), 1), [topHotels]);

  // Profit margin by hotel
  const profitByHotel = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; cost: number; margin: number }>();

    filteredData.reservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const hotel = hotelMap.get(r.hotelId);
      const name = hotel?.name || 'Unknown';
      const entry = map.get(r.hotelId) || { name, revenue: 0, cost: 0, margin: 0 };
      const totals = getReservationTotals(r);
      entry.revenue += totals.totalSell;
      entry.cost += totals.totalBuy;
      map.set(r.hotelId, entry);
    });

    const results = Array.from(map.values());
    results.forEach(r => { r.margin = r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0; });
    return results.sort((a, b) => b.margin - a.margin).slice(0, 10);
  }, [filteredData, hotelMap]);

  // Cancellation rate
  const cancellationStats = useMemo(() => {
    const total = reservations.length;
    const cancelled = reservations.filter(r => r.status === 'Cancelled').length;
    const confirmed = reservations.filter(r => r.status === 'Confirmed').length;
    const tentative = reservations.filter(r => r.status === 'Tentative').length;
    return {
      total,
      cancelled,
      confirmed,
      tentative,
      cancellationRate: total > 0 ? (cancelled / total * 100) : 0,
    };
  }, [reservations]);

  // Average booking lead time
  const avgLeadTime = useMemo(() => {
    const leadTimes: number[] = [];
    reservations.filter(r => r.status !== 'Cancelled' && r.createdAt && r.checkIn).forEach(r => {
      const created = new Date(r.createdAt);
      const checkIn = new Date(r.checkIn);
      const diff = Math.max(0, Math.floor((checkIn.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
      leadTimes.push(diff);
    });
    return leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : 0;
  }, [reservations]);

  // KPI summary
  const kpis = useMemo(() => {
    const activeRes = filteredData.reservations.filter(r => r.status !== 'Cancelled');
    let totalRevenue = 0, totalCost = 0, totalNights = 0, totalRooms = 0;
    activeRes.forEach(r => {
      const totals = getReservationTotals(r);
      totalRevenue += totals.totalSell;
      totalCost += totals.totalBuy;
      totalNights += r.nights;
      totalRooms += r.rooms.reduce((sum, rm) => sum + rm.qty, 0);
    });
    const totalPayments = filteredData.transactions
      .filter(t => t.type === 'ClientPayment')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0,
      totalBookings: activeRes.length,
      totalNights,
      totalRooms,
      avgBookingValue: activeRes.length > 0 ? totalRevenue / activeRes.length : 0,
      totalPayments,
      avgLeadTime,
    };
  }, [filteredData, avgLeadTime]);

  const formatMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('analytics.title')}</h1>
          <p className="text-sm text-slate-500">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(['3M', '6M', '12M', 'ALL'] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${timeRange === r ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard label={t('analytics.totalRevenue')} value={`${formatMoney(kpis.totalRevenue)}`} sub="SAR" color="blue" />
        <KPICard label={t('analytics.totalProfit')} value={`${formatMoney(kpis.totalProfit)}`} sub="SAR" color="emerald" />
        <KPICard label={t('analytics.profitMargin')} value={`${kpis.profitMargin.toFixed(1)}%`} sub="" color="green" />
        <KPICard label={t('analytics.bookings')} value={`${kpis.totalBookings}`} sub={`${kpis.totalRooms} ${t('analytics.rooms')}`} color="purple" />
        <KPICard label={t('analytics.avgLeadTime')} value={`${kpis.avgLeadTime}`} sub={t('analytics.days')} color="amber" />
        <KPICard label={t('analytics.cancellationRate')} value={`${cancellationStats.cancellationRate.toFixed(1)}%`} sub={`${cancellationStats.cancelled} ${t('analytics.cancelled')}`} color="red" />
      </div>

      {/* Revenue Chart + Seasonal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Revenue Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('analytics.monthlyRevenue')}</h3>
          <div className="flex items-end gap-1 h-48">
            {monthlyRevenue.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="w-full flex flex-col justify-end h-40">
                  {/* Revenue bar */}
                  <div
                    className="w-full bg-blue-400 rounded-t-sm transition-all hover:bg-blue-500 cursor-pointer"
                    style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: m.revenue > 0 ? '2px' : '0' }}
                  />
                  {/* Profit overlay */}
                  <div
                    className="w-full bg-emerald-500 rounded-t-sm -mt-[2px] opacity-70"
                    style={{ height: m.profit > 0 ? `${(m.profit / maxRevenue) * 30}%` : '0', minHeight: m.profit > 0 ? '1px' : '0' }}
                  />
                </div>
                <div className="text-[8px] text-slate-400 -rotate-45 origin-left whitespace-nowrap">{m.month}</div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 mb-1">
                  Rev: {formatMoney(m.revenue)} | Profit: {formatMoney(m.profit)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-400 rounded-sm" /> Revenue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 rounded-sm" /> Profit</span>
          </div>
        </div>

        {/* Seasonal Heatmap */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('analytics.seasonal')}</h3>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
            {seasonalData.map((s, i) => {
              const intensity = s.count / maxSeasonal;
              const bg = intensity > 0.8 ? 'bg-emerald-600' : intensity > 0.6 ? 'bg-emerald-500' : intensity > 0.4 ? 'bg-emerald-400' : intensity > 0.2 ? 'bg-emerald-300' : intensity > 0 ? 'bg-emerald-200' : 'bg-slate-100';
              return (
                <div key={i} className={`${bg} rounded-lg p-2 text-center cursor-pointer hover:ring-2 hover:ring-emerald-400 transition`}>
                  <div className="text-[10px] font-bold text-slate-700">{s.name}</div>
                  <div className={`text-lg font-bold ${intensity > 0.4 ? 'text-white' : 'text-slate-700'}`}>{s.count}</div>
                  <div className={`text-[8px] ${intensity > 0.4 ? 'text-emerald-100' : 'text-slate-400'}`}>{formatMoney(s.revenue)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Clients + Top Hotels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Clients */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('analytics.topClients')}</h3>
          <div className="space-y-2">
            {topClients.map((c, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-slate-700 truncate">{c.name}</span>
                    <span className="text-slate-500 ml-2">{formatMoney(c.revenue)} SAR</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(c.revenue / maxClientRevenue) * 100}%` }} />
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{c.bookings} bookings | Profit: {formatMoney(c.profit)} SAR</div>
                </div>
              </div>
            ))}
            {topClients.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No data available for the selected period</p>}
          </div>
        </div>

        {/* Top Hotels */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('analytics.topHotels')}</h3>
          <div className="space-y-2">
            {topHotels.map((h, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-slate-700 truncate">{h.name}</span>
                    <span className="text-slate-500 ml-2">{h.bookings} bookings</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${(h.bookings / maxHotelBookings) * 100}%` }} />
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{h.nights} nights | Rev: {formatMoney(h.revenue)} SAR</div>
                </div>
              </div>
            ))}
            {topHotels.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No data available for the selected period</p>}
          </div>
        </div>
      </div>

      {/* Profit Margin + Cancellation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profit Margin by Hotel */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('analytics.profitByHotel')}</h3>
          <div className="space-y-2">
            {profitByHotel.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-slate-700 truncate">{h.name}</span>
                    <span className={`font-bold ${h.margin >= 15 ? 'text-emerald-600' : h.margin >= 8 ? 'text-amber-600' : 'text-red-600'}`}>
                      {h.margin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${h.margin >= 15 ? 'bg-emerald-500' : h.margin >= 8 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(h.margin, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {profitByHotel.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No data available for the selected period</p>}
          </div>
        </div>

        {/* Booking Status Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('analytics.statusDistribution')}</h3>
          <div className="flex items-center justify-center gap-8 py-4">
            <DonutSegment label={t('analytics.confirmed')} value={cancellationStats.confirmed} total={cancellationStats.total} color="bg-emerald-500" />
            <DonutSegment label={t('analytics.tentative')} value={cancellationStats.tentative} total={cancellationStats.total} color="bg-amber-500" />
            <DonutSegment label={t('dash.cancelled')} value={cancellationStats.cancelled} total={cancellationStats.total} color="bg-red-500" />
          </div>
          <div className="text-center mt-2">
            <div className="text-3xl font-bold text-slate-700">{cancellationStats.total}</div>
            <div className="text-xs text-slate-500">{t('analytics.totalBookings')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI Card
function KPICard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
  };
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color] || colorClasses.blue} rounded-xl p-3 text-white shadow-sm`}>
      <div className="text-[10px] font-medium opacity-80">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] opacity-70">{sub}</div>
    </div>
  );
}

// Donut Segment (simple)
function DonutSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total * 100).toFixed(1) : '0';
  return (
    <div className="text-center">
      <div className={`w-16 h-16 rounded-full ${color} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
        {value}
      </div>
      <div className="text-xs font-medium text-slate-700 mt-1">{label}</div>
      <div className="text-[10px] text-slate-500">{pct}%</div>
    </div>
  );
}
