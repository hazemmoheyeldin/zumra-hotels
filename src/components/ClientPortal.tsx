/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Reservation, Agent, Hotel } from '../types';
import { getReservationTotals } from '../lib/storage';

interface ClientPortalProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  clientId: string;
}

export default function ClientPortal({ reservations, agents, hotels, clientId }: ClientPortalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const client = agents.find(a => a.id === clientId);
  const clientName = client?.companyName || client?.name || 'Client';

  const clientBookings = useMemo(() => {
    return reservations
      .filter(r => r.clientId === clientId && r.status !== 'Cancelled')
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  }, [reservations, clientId]);

  const filteredBookings = useMemo(() => {
    let list = clientBookings;
    if (statusFilter !== 'All') list = list.filter(r => r.status === statusFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.guestName.toLowerCase().includes(q) ||
        r.id.toString().includes(q) ||
        (hotels.find(h => h.id === r.hotelId)?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [clientBookings, statusFilter, searchTerm, hotels]);

  const stats = useMemo(() => {
    const total = filteredBookings.length;
    const confirmed = filteredBookings.filter(r => r.status === 'Confirmed').length;
    const tentative = filteredBookings.filter(r => r.status === 'Tentative').length;
    const totalRevenue = filteredBookings.reduce((s, r) => s + getReservationTotals(r).totalSell, 0);
    const totalPaid = filteredBookings.reduce((s, r) => s + (r.amountPaidByClient || 0), 0);
    const outstanding = totalRevenue - totalPaid;
    return { total, confirmed, tentative, totalRevenue, totalPaid, outstanding };
  }, [filteredBookings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{clientName}</h1>
              <p className="text-sm text-slate-500 mt-1">Booking Portal &bull; {stats.total} active bookings</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Powered by</div>
              <div className="text-lg font-bold text-amber-600">Zumra Hotels</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Total Bookings</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-emerald-700">{stats.confirmed}</div>
            <div className="text-xs text-slate-500 mt-1">Confirmed</div>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-amber-700">{stats.tentative}</div>
            <div className="text-xs text-slate-500 mt-1">Tentative</div>
          </div>
          <div className={`bg-white rounded-xl border p-4 text-center shadow-sm ${stats.outstanding > 0 ? 'border-rose-200' : 'border-emerald-200'}`}>
            <div className={`text-2xl font-bold ${stats.outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {stats.outstanding.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">Outstanding (SAR)</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Search by guest name, RSV#, or hotel..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
          >
            <option value="All">All Status</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Tentative">Tentative</option>
          </select>
        </div>

        {/* Bookings List */}
        <div className="space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p>No bookings found</p>
            </div>
          ) : (
            filteredBookings.map(res => {
              const hotel = hotels.find(h => h.id === res.hotelId);
              const totals = getReservationTotals(res);
              const isExpanded = expandedId === res.id;
              const outstanding = totals.totalSell - (res.amountPaidByClient || 0);
              return (
                <div
                  key={res.id}
                  className={`bg-white rounded-xl border transition-all cursor-pointer ${
                    isExpanded ? 'border-amber-300 shadow-md' : 'border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : res.id)}
                >
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs font-mono font-bold text-slate-400">RSV</div>
                        <div className="text-lg font-bold text-slate-800">{res.id}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{res.guestName}</div>
                        <div className="text-xs text-slate-500">{hotel?.name || 'Unknown Hotel'} &bull; {res.nights}N</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">{res.checkIn} → {res.checkOut}</div>
                        <div className="font-bold text-sm text-slate-800">{totals.totalSell.toLocaleString()} SAR</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        res.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {res.status}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold">Nationality</div>
                          <div className="font-medium text-slate-700">{res.guestNationality || '-'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold">Rooms</div>
                          <div className="font-medium text-slate-700">
                            {res.rooms.map((rm, i) => (
                              <div key={i}>{rm.qty}x {rm.roomType} ({rm.mealPlan})</div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold">Payment</div>
                          <div className="font-medium text-slate-700">
                            Paid: {totals.totalSell > 0 ? ((res.amountPaidByClient || 0) / totals.totalSell * 100).toFixed(0) : 0}%
                          </div>
                          <div className="text-[10px] text-slate-500">{(res.amountPaidByClient || 0).toLocaleString()} / {totals.totalSell.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold">Outstanding</div>
                          <div className={`font-bold ${outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {Math.max(outstanding, 0).toLocaleString()} SAR
                          </div>
                        </div>
                      </div>
                      {res.specialRequests && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                          <span className="font-bold">Special Requests:</span> {res.specialRequests}
                        </div>
                      )}
                      {(res.tags || []).length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {res.tags!.map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">{tag}</span>
                          ))}
                        </div>
                      )}
                      {res.hotelConfirmationNo && (
                        <div className="text-xs text-slate-600">
                          <span className="font-bold">Hotel Confirmation:</span> <span className="font-mono">{res.hotelConfirmationNo}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Zumra Hotels &bull; Reservation Management System
      </div>
    </div>
  );
}
