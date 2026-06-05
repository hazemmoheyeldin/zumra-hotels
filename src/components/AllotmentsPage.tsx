/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Allotment, AllotmentDay, Hotel, Agent } from '../types';
import { useLang } from '../lib/LanguageContext';

interface AllotmentsPageProps {
  allotments: Allotment[];
  hotels: Hotel[];
  agents: Agent[];
  onSaveAllotment: (allotment: Allotment) => void;
  onDeleteAllotment: (id: string) => void;
}

// Helper: generate dates between two dates
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function dayName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
}

export default function AllotmentsPage({ allotments, hotels, agents, onSaveAllotment, onDeleteAllotment }: AllotmentsPageProps) {
  const { t, lang } = useLang();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form States
  const [hotelId, setHotelId] = useState(hotels[0]?.id || '');
  const [roomType, setRoomType] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalRooms, setTotalRooms] = useState(5);

  // Filters
  const [filterHotel, setFilterHotel] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const suppliers = agents.filter(a => a.type === 'Supplier' || a.type === 'Both');
  const selectedHotel = hotels.find(h => h.id === hotelId);

  React.useEffect(() => {
    if (selectedHotel && selectedHotel.roomTypes.length > 0 && !roomType) {
      setRoomType(selectedHotel.roomTypes[0]);
    }
  }, [hotelId, selectedHotel, roomType]);

  // Migrate flat allotments to daily availability
  const migrateAllotment = (a: Allotment): Allotment => {
    if (a.dailyAvailability) return a;
    const daily: { [date: string]: AllotmentDay } = {};
    dateRange(a.startDate, a.endDate).forEach(d => {
      daily[d] = { total: a.totalRooms, booked: 0 };
    });
    return { ...a, dailyAvailability: daily };
  };

  const migratedAllotments = useMemo(() => allotments.map(migrateAllotment), [allotments]);

  // Filtered allotments
  const filteredAllotments = useMemo(() => {
    return migratedAllotments.filter(a => {
      const hotelMatch = !filterHotel || a.hotelId === filterHotel;
      const supplierMatch = !filterSupplier || a.supplierId === filterSupplier;
      const dateMatch = (!filterDateFrom || a.endDate >= filterDateFrom) && (!filterDateTo || a.startDate <= filterDateTo);
      return hotelMatch && supplierMatch && dateMatch;
    });
  }, [migratedAllotments, filterHotel, filterSupplier, filterDateFrom, filterDateTo]);

  // Compute visible date columns
  const visibleDates = useMemo(() => {
    if (filteredAllotments.length === 0) return [];
    let minDate = filteredAllotments[0].startDate;
    let maxDate = filteredAllotments[0].endDate;
    filteredAllotments.forEach(a => {
      if (a.startDate < minDate) minDate = a.startDate;
      if (a.endDate > maxDate) maxDate = a.endDate;
    });
    // Clamp to filter range
    if (filterDateFrom && filterDateFrom > minDate) minDate = filterDateFrom;
    if (filterDateTo && filterDateTo < maxDate) maxDate = filterDateTo;
    return dateRange(minDate, maxDate);
  }, [filteredAllotments, filterDateFrom, filterDateTo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId || !roomType || !supplierId || !startDate || !endDate) {
      alert('Please fill out all allocation specifications.');
      return;
    }

    // Build daily availability
    const daily: { [date: string]: AllotmentDay } = {};
    dateRange(startDate, endDate).forEach(d => {
      daily[d] = { total: totalRooms, booked: 0 };
    });

    // If editing, preserve existing bookings
    if (editingId) {
      const existing = allotments.find(a => a.id === editingId);
      if (existing?.dailyAvailability) {
        Object.keys(existing.dailyAvailability).forEach(d => {
          if (daily[d]) {
            daily[d].booked = existing.dailyAvailability![d].booked;
          }
        });
      }
    }

    const newAllotment: Allotment = {
      id: editingId || `al_${Date.now()}`,
      hotelId,
      roomType,
      supplierId,
      startDate,
      endDate,
      totalRooms,
      bookedRooms: 0,
      dailyAvailability: daily,
    };

    onSaveAllotment(newAllotment);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setHotelId(hotels[0]?.id || '');
    setRoomType('');
    setSupplierId('');
    setStartDate('');
    setEndDate('');
    setTotalRooms(5);
    setShowForm(false);
  };

  const getCellColor = (day?: AllotmentDay) => {
    if (!day) return 'bg-slate-50 text-slate-300';
    const avail = day.total - day.booked;
    if (avail <= 0) return 'bg-rose-100 text-rose-800';
    if (day.booked > 0) return 'bg-amber-50 text-amber-800';
    return 'bg-emerald-50 text-emerald-800';
  };

  const clearFilters = () => {
    setFilterHotel(''); setFilterSupplier(''); setFilterDateFrom(''); setFilterDateTo('');
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('allot.activeBlocks')}</div>
          <div className="text-2xl font-black text-slate-900">{allotments.length}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">{t('allot.totalRoomDays')}</div>
          <div className="text-xl font-black text-emerald-800">
            {migratedAllotments.reduce((s, a) => s + Object.keys(a.dailyAvailability || {}).length * (a.dailyAvailability ? a.dailyAvailability[Object.keys(a.dailyAvailability)[0]]?.total || 0 : a.totalRooms), 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">{t('allot.hotelsCovered')}</div>
          <div className="text-2xl font-black text-amber-800">{new Set(allotments.map(a => a.hotelId)).size}</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1">{t('allot.suppliers')}</div>
          <div className="text-2xl font-black text-indigo-800">{new Set(allotments.map(a => a.supplierId)).size}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm text-xs">
        {/* Title block */}
        <div className="border-b border-slate-100 pb-4 mb-4 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{t('allot.gridTitle')}</h2>
            <p className="text-xs text-slate-500">{t('allot.gridSubtitle')}</p>
          </div>
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1"
          >
            {showForm ? t('allot.viewGrid') : t('allot.newBlock')}
          </button>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{t('allot.configureBlock')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hotel</label>
                <select value={hotelId} onChange={e => { setHotelId(e.target.value); setRoomType(''); }} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Room Type</label>
                <select value={roomType} onChange={e => setRoomType(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                  {selectedHotel?.roomTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Supplier</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                  <option value="">-- Choose --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Rooms Per Day</label>
                <input type="number" value={totalRooms} onChange={e => setTotalRooms(Number(e.target.value))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" min={1} required />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold" required />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold" required />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition">
                {editingId ? t('allot.updateBlock') : t('allot.saveBlock')}
              </button>
              <button type="button" onClick={resetForm} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-5 py-2 rounded-lg transition">{t('common.cancel')}</button>
            </div>
          </form>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <select value={filterHotel} onChange={e => setFilterHotel(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                <option value="">All Hotels</option>
                {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                <option value="">All Suppliers</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.companyName || s.name}</option>)}
              </select>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
              {(filterHotel || filterSupplier || filterDateFrom || filterDateTo) && (
                <button onClick={clearFilters} className="text-[10px] text-rose-600 font-bold hover:text-rose-700">✕ Clear</button>
              )}
              <div className="ml-auto text-[10px] text-slate-400 font-mono">{filteredAllotments.length} blocks</div>
            </div>

            {/* Legend */}
            <div className="flex gap-3 mb-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block"></span> {t('allot.available')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block"></span> {t('allot.partial')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block"></span> {t('allot.full')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 inline-block"></span> {t('allot.na')}</span>
            </div>

            {/* Excel-like Grid */}
            {filteredAllotments.length > 0 && visibleDates.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="text-left border-collapse text-[10px] whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100 sticky top-0 z-10">
                      <th className="py-2 px-2 border-r border-slate-200 font-bold text-slate-600 min-w-[180px]">Block</th>
                      {visibleDates.map(d => (
                        <th key={d} className={`py-1 px-1.5 border-r border-slate-200 text-center font-bold min-w-[48px] ${new Date(d).getDay() === 4 || new Date(d).getDay() === 5 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}>
                          <div className="leading-tight">{dayName(d)}<br />{shortDate(d)}</div>
                        </th>
                      ))}
                      <th className="py-2 px-2 font-bold text-slate-600 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAllotments.map(allot => {
                      const hotel = hotels.find(h => h.id === allot.hotelId);
                      const suppl = agents.find(s => s.id === allot.supplierId);
                      return (
                        <tr key={allot.id} className="hover:bg-slate-50/30">
                          <td className="py-2 px-2 border-r border-slate-200">
                            <div className="font-bold text-slate-800">{hotel?.name || 'Unknown'}</div>
                            <div className="text-[9px] text-slate-400">{allot.roomType} · {suppl?.companyName || suppl?.name || 'Direct'}</div>
                          </td>
                          {visibleDates.map(d => {
                            const day = allot.dailyAvailability?.[d];
                            const color = getCellColor(day);
                            return (
                              <td key={d} className={`py-1.5 px-1 border-r border-slate-100 text-center font-mono font-bold ${color}`}>
                                {day ? `${day.total - day.booked}/${day.total}` : '—'}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => {
                                setEditingId(allot.id);
                                setHotelId(allot.hotelId);
                                setRoomType(allot.roomType);
                                setSupplierId(allot.supplierId);
                                setStartDate(allot.startDate);
                                setEndDate(allot.endDate);
                                setTotalRooms(allot.totalRooms);
                                setShowForm(true);
                              }} className="text-blue-600 hover:text-blue-800 font-bold text-[10px]">Edit</button>
                              <button onClick={() => { if (confirm('Delete this allotment block?')) onDeleteAllotment(allot.id); }} className="text-red-500 hover:text-red-700 font-bold text-[10px]">Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-400 italic text-center py-12 bg-slate-50 rounded-2xl">{t('allot.noAllotments')}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
