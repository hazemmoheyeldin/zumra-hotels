/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Reservation, Agent, Hotel } from '../types';
import { getReservationTotals, exportToCSV } from '../lib/storage';

interface GuestRecord {
  name: string;
  nameLower: string;
  nationality: string;
  bookings: Reservation[];
  totalNights: number;
  totalSpent: number;
  firstStay: string;
  lastStay: string;
  isRepeat: boolean;
}

interface GuestsPageProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
}

export default function GuestsPage({ reservations, agents, hotels }: GuestsPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'repeat' | 'once'>('all');
  const [selectedGuest, setSelectedGuest] = useState<GuestRecord | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'bookings' | 'spent' | 'lastStay'>('bookings');

  // Build guest database from reservations
  const guests = useMemo<GuestRecord[]>(() => {
    const map = new Map<string, GuestRecord>();
    reservations.forEach(res => {
      if (!res.guestName?.trim()) return;
      const key = res.guestName.trim().toLowerCase();
      const totals = getReservationTotals(res);
      const existing = map.get(key);
      if (existing) {
        existing.bookings.push(res);
        existing.totalNights += res.nights;
        existing.totalSpent += totals.totalSell;
        if (!existing.nationality && res.guestNationality) existing.nationality = res.guestNationality;
        if (res.checkIn < existing.firstStay) existing.firstStay = res.checkIn;
        if (res.checkIn > existing.lastStay) existing.lastStay = res.checkIn;
        existing.isRepeat = true;
      } else {
        map.set(key, {
          name: res.guestName.trim(),
          nameLower: key,
          nationality: res.guestNationality || '',
          bookings: [res],
          totalNights: res.nights,
          totalSpent: totals.totalSell,
          firstStay: res.checkIn,
          lastStay: res.checkIn,
          isRepeat: false,
        });
      }
    });
    return Array.from(map.values());
  }, [reservations]);

  // Filtered & sorted
  const filteredGuests = useMemo(() => {
    let list = guests;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(g => g.nameLower.includes(q) || g.nationality.toLowerCase().includes(q));
    }
    if (filterType === 'repeat') list = list.filter(g => g.isRepeat);
    if (filterType === 'once') list = list.filter(g => !g.isRepeat);
    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'bookings') return b.bookings.length - a.bookings.length;
      if (sortBy === 'spent') return b.totalSpent - a.totalSpent;
      if (sortBy === 'lastStay') return b.lastStay.localeCompare(a.lastStay);
      return 0;
    });
    return list;
  }, [guests, searchTerm, filterType, sortBy]);

  const stats = useMemo(() => ({
    total: guests.length,
    repeat: guests.filter(g => g.isRepeat).length,
    totalBookings: reservations.length,
    totalRevenue: guests.reduce((s, g) => s + g.totalSpent, 0),
  }), [guests, reservations]);

  const handleExport = () => {
    const rows = filteredGuests.map(g => ({
      'Guest Name': g.name,
      'Nationality': g.nationality,
      'Total Bookings': g.bookings.length,
      'Total Nights': g.totalNights,
      'Total Revenue (SAR)': g.totalSpent,
      'First Stay': g.firstStay,
      'Last Stay': g.lastStay,
      'Repeat Guest': g.isRepeat ? 'Yes' : 'No',
    }));
    exportToCSV('guests-database.csv', rows);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest Database</h1>
          <p className="text-sm text-gray-500">Central guest repository extracted from all reservations</p>
        </div>
        <button onClick={handleExport} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl transition border border-indigo-200">
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-700">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Unique Guests</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{stats.repeat.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Repeat Guests</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{stats.totalBookings.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total Bookings</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{stats.totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total Revenue (SAR)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search guest name or nationality..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 max-w-sm px-4 py-2 border rounded-lg text-sm"
        />
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'repeat', 'once'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${filterType === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'all' ? 'All' : f === 'repeat' ? 'Repeat' : 'One-time'}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="bookings">Sort: Most Bookings</option>
          <option value="spent">Sort: Most Revenue</option>
          <option value="lastStay">Sort: Recent Stay</option>
          <option value="name">Sort: Name A-Z</option>
        </select>
      </div>

      {/* Guest List */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Guest Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nationality</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Bookings</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Nights</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredGuests.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No guests found</td></tr>
            ) : (
              filteredGuests.slice(0, 200).map(g => (
                <tr key={g.nameLower} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.nationality || '-'}</td>
                  <td className="px-4 py-3 text-center font-mono">{g.bookings.length}</td>
                  <td className="px-4 py-3 text-center font-mono">{g.totalNights}</td>
                  <td className="px-4 py-3 text-right font-mono">{g.totalSpent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.isRepeat ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                      {g.isRepeat ? 'Repeat' : 'New'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setSelectedGuest(g)} className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">View History</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredGuests.length > 200 && (
          <div className="text-center py-2 text-xs text-gray-400 border-t">Showing 200 of {filteredGuests.length} guests</div>
        )}
      </div>

      {/* Guest Detail Modal */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedGuest(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedGuest.name}</h2>
                <p className="text-sm text-gray-500">{selectedGuest.nationality || 'No nationality'} | {selectedGuest.isRepeat ? `${selectedGuest.bookings.length} bookings` : 'First-time guest'}</p>
              </div>
              <button onClick={() => setSelectedGuest(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="text-lg font-bold text-indigo-700">{selectedGuest.totalNights}</div>
                <div className="text-xs text-gray-500">Total Nights</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-lg font-bold text-emerald-700">{selectedGuest.totalSpent.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Total Revenue</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-lg font-bold text-amber-700">{selectedGuest.firstStay === selectedGuest.lastStay ? 'Single Stay' : `${selectedGuest.firstStay} — ${selectedGuest.lastStay}`}</div>
                <div className="text-xs text-gray-500">Stay Period</div>
              </div>
            </div>

            <h3 className="font-semibold text-gray-800 text-sm">Booking History</h3>
            <div className="space-y-2">
              {selectedGuest.bookings.sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map(res => {
                const hotel = hotels.find(h => h.id === res.hotelId);
                const client = agents.find(a => a.id === res.clientId);
                const totals = getReservationTotals(res);
                return (
                  <div key={res.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold font-mono text-indigo-700">RSV-{res.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${res.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : res.status === 'Cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{res.status}</span>
                    </div>
                    <div className="text-gray-600 mt-1">{hotel?.name || 'Unknown Hotel'} | {res.checkIn} → {res.checkOut} ({res.nights}N)</div>
                    <div className="text-gray-500 mt-0.5">Client: {client?.companyName || client?.name || '-'} | Revenue: {totals.totalSell.toLocaleString()} SAR</div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setSelectedGuest(null)} className="w-full px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
