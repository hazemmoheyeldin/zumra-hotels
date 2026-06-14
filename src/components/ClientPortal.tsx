/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Reservation, Agent, Hotel } from '../types';
import { getReservationTotals } from '../lib/storage';
import { loadPortalSettings, PortalVisibilitySettings } from './ClientPortalSettings';
import ZumraLogo from './ZumraLogo';

interface ClientPortalProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  clientId: string;
  onUpdateAgreementStatus?: (resId: number, status: 'Approved' | 'Declined') => void;
}

export default function ClientPortal({ reservations, agents, hotels, clientId, onUpdateAgreementStatus }: ClientPortalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const visibility: PortalVisibilitySettings = loadPortalSettings();

  // Timeout for loading state - if agents don't load in 10s, show error
  useEffect(() => {
    const timer = setTimeout(() => {
      if (agents.length === 0) {
        setLoadTimeout(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [agents.length]);

  const client = agents.find(a => a.id === clientId);
  const clientName = client?.companyName || client?.name || 'Client';

  const clientBookings = useMemo(() => {
    return reservations
      .filter(r => r.clientId === clientId && (visibility.allowCancelledBookings ? true : r.status !== 'Cancelled'))
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  }, [reservations, clientId, visibility.allowCancelledBookings]);

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
            <div className="text-right flex-shrink-0">
              <ZumraLogo size="xxl" variant="gold" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Loading Indicator */}
      {agents.length === 0 && !loadTimeout && (
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-slate-500">Loading your bookings...</p>
          <p className="text-xs text-slate-400 mt-2">If this takes too long, please refresh the page.</p>
        </div>
      )}

      {/* Loading Timeout Error */}
      {agents.length === 0 && loadTimeout && (
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Unable to Load Bookings</h2>
          <p className="text-sm text-slate-500 mb-4">We couldn't connect to the database. This might be due to a temporary service issue.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Invalid Client ID */}
      {agents.length > 0 && !client && (
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Invalid Portal Link</h2>
          <p className="text-sm text-slate-500">The client ID in the URL doesn't match any record. Please check the link provided by your agent.</p>
        </div>
      )}

      {/* Main Content - only show when data is loaded and client is valid */}
      {agents.length > 0 && client && (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        {visibility.showStats && (
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
          {visibility.showFinancialInfo && (
          <div className={`bg-white rounded-xl border p-4 text-center shadow-sm ${stats.outstanding > 0 ? 'border-rose-200' : 'border-emerald-200'}`}>
            <div className={`text-2xl font-bold ${stats.outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {stats.outstanding.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">Outstanding (SAR)</div>
          </div>
          )}
        </div>
        )}

        {/* Filters */}
        {visibility.showSearchAndFilter && (
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
            {visibility.allowCancelledBookings && <option value="Cancelled">Cancelled</option>}
          </select>
        </div>
        )}

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
                        {visibility.showGuestInfo && <div className="font-semibold text-slate-800">{res.guestName}</div>}
                        {visibility.showBookingDetails && <div className="text-xs text-slate-500">{hotel?.name || 'Unknown Hotel'} &bull; {res.nights}N</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {visibility.showBookingDetails && (
                      <div className="text-right">
                        <div className="text-xs text-slate-500">{res.checkIn} → {res.checkOut}</div>
                        {visibility.showFinancialInfo && <div className="font-bold text-sm text-slate-800">{totals.totalSell.toLocaleString()} SAR</div>}
                      </div>
                      )}
                      {/* Agreement Status Badge */}
                      <div className="text-center">
                        <div className="text-[8px] uppercase font-bold text-slate-400">Agreement</div>
                        {res.agreementNo ? (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            res.agreementStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            res.agreementStatus === 'Declined' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {res.agreementStatus || 'Pending'}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-mono">—</span>
                        )}
                      </div>
                      {visibility.showStatus && (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        res.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {res.status}
                      </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {visibility.showGuestInfo && (
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold">Nationality</div>
                          <div className="font-medium text-slate-700">{res.guestNationality || '-'}</div>
                        </div>
                        )}
                        {visibility.showBookingDetails && (
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold">Rooms</div>
                          <div className="font-medium text-slate-700">
                            {(res.rooms || []).map((rm, i) => (
                              <div key={i}>{rm.qty}x {rm.roomType} ({rm.mealPlan})</div>
                            ))}
                          </div>
                        </div>
                        )}
                        {visibility.showPaymentBreakdown && (
                        <>
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
                        </>
                        )}
                      </div>
                      {visibility.showSpecialRequests && res.specialRequests && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                          <span className="font-bold">Special Requests:</span> {res.specialRequests}
                        </div>
                      )}
                      {visibility.showTags && (res.tags || []).length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {res.tags!.map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">{tag}</span>
                          ))}
                        </div>
                      )}
                      {visibility.showHotelConfirmation && res.hotelConfirmationNo && (
                        <div className="text-xs text-slate-600">
                          <span className="font-bold">Hotel Confirmation:</span> <span className="font-mono">{res.hotelConfirmationNo}</span>
                        </div>
                      )}
                      {/* Agreement Section */}
                      <div className={`rounded-xl border p-4 ${
                        !res.agreementNo ? 'bg-slate-50 border-slate-200' :
                        res.agreementStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200' :
                        res.agreementStatus === 'Declined' ? 'bg-rose-50 border-rose-200' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500">Agreement Number</div>
                            <div className="font-mono font-bold text-slate-800 text-sm">{res.agreementNo || '—'}</div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            !res.agreementNo ? 'bg-slate-200 text-slate-600' :
                            res.agreementStatus === 'Approved' ? 'bg-emerald-200 text-emerald-900' :
                            res.agreementStatus === 'Declined' ? 'bg-rose-200 text-rose-900' :
                            'bg-amber-200 text-amber-900'
                          }`}>
                            {!res.agreementNo ? '— Not Assigned' :
                             res.agreementStatus === 'Approved' ? '✓ Approved' :
                             res.agreementStatus === 'Declined' ? '✗ Declined' : '⏳ Pending'}
                          </span>
                        </div>
                        {onUpdateAgreementStatus && res.agreementNo && res.status !== 'Cancelled' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => onUpdateAgreementStatus(res.id, 'Approved')}
                              disabled={res.agreementStatus === 'Approved'}
                              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${
                                res.agreementStatus === 'Approved'
                                  ? 'bg-emerald-200 text-emerald-700 cursor-not-allowed'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                              }`}
                            >
                              {res.agreementStatus === 'Approved' ? '✓ Already Approved' : '✓ Approve Agreement'}
                            </button>
                            <button
                              onClick={() => onUpdateAgreementStatus(res.id, 'Declined')}
                              disabled={res.agreementStatus === 'Declined'}
                              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${
                                res.agreementStatus === 'Declined'
                                  ? 'bg-rose-200 text-rose-700 cursor-not-allowed'
                                  : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50'
                              }`}
                            >
                              {res.agreementStatus === 'Declined' ? '✗ Already Declined' : '✗ Decline'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Zumra Hotels &bull; Reservation Management System
      </div>
    </div>
  );
}
