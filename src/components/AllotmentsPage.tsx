/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Allotment, Hotel, Agent } from '../types';

interface AllotmentsPageProps {
  allotments: Allotment[];
  hotels: Hotel[];
  agents: Agent[];
  onSaveAllotment: (allotment: Allotment) => void;
  onDeleteAllotment: (id: string) => void;
}

export default function AllotmentsPage({ allotments, hotels, agents, onSaveAllotment, onDeleteAllotment }: AllotmentsPageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [hotelId, setHotelId] = useState(hotels[0]?.id || '');
  const [roomType, setRoomType] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalRooms, setTotalRooms] = useState(5);
  const [bookedRooms, setBookedRooms] = useState(0);

  const [showForm, setShowForm] = useState(false);

  // List of suppliers
  const suppliers = agents.filter(a => a.type === 'Supplier' || a.type === 'Both');
  const selectedHotel = hotels.find(h => h.id === hotelId);

  React.useEffect(() => {
    if (selectedHotel && selectedHotel.roomTypes.length > 0 && !roomType) {
      setRoomType(selectedHotel.roomTypes[0]);
    }
  }, [hotelId, selectedHotel, roomType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId || !roomType || !supplierId || !startDate || !endDate) {
      alert('Please fill out all allocation specifications.');
      return;
    }

    const newAllotment: Allotment = {
      id: editingId || `al_${Date.now()}`,
      hotelId,
      roomType,
      supplierId,
      startDate,
      endDate,
      totalRooms,
      bookedRooms
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
    setBookedRooms(0);
    setShowForm(false);
  };

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm text-xs">
      
      {/* Title block */}
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Allotment & Allocation Room Inventory</h2>
          <p className="text-xs text-slate-500">Coordinate guaranteed block allotments purchased from supplier vendors.</p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1"
        >
          {showForm ? 'View Allotments' : 'New Block Allotment'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Configure Supplier Block specifications</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Select Active Hotel</label>
              <select
                value={hotelId}
                onChange={(e) => {
                  setHotelId(e.target.value);
                  setRoomType('');
                }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
              >
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Room Category Type</label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
              >
                {selectedHotel?.roomTypes.map((t, idx) => (
                  <option key={idx} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Supplier Provider Channel</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 col-span-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Release Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Release End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Block Quantities</label>
              <input
                type="number"
                value={totalRooms}
                onChange={(e) => setTotalRooms(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Booked Units Count</label>
              <input
                type="number"
                value={bookedRooms}
                onChange={(e) => setBookedRooms(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition"
            >
              Save Block Allotment
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-5 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allotments.map((allot) => {
            const hotel = hotels.find(h => h.id === allot.hotelId);
            const suppl = agents.find(s => s.id === allot.supplierId);
            const remaining = allot.totalRooms - allot.bookedRooms;
            const progress = (allot.bookedRooms / allot.totalRooms) * 105;

            return (
              <div key={allot.id} className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm flex flex-col justify-between">
                <div>
                  <span className="bg-indigo-50 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    📦 Guaranteed Allocation
                  </span>
                  
                  <h3 className="font-bold text-slate-800 uppercase text-sm mt-2.5">
                    {hotel?.name || 'Hotel specifications error'}
                  </h3>
                  
                  <p className="text-[11px] font-bold text-amber-800 mt-1 uppercase font-serif">
                    Room: {allot.roomType}
                  </p>

                  <div className="mt-3.5 space-y-1.5 text-slate-500">
                    <p><span className="font-medium text-slate-400 uppercase text-[9px] block">Supplier Host:</span> {suppl?.name || 'Direct Procurement'}</p>
                    <p><span className="font-medium text-slate-400 uppercase text-[9px] block">Allocation Validity:</span> {allot.startDate} to {allot.endDate}</p>
                  </div>

                  {/* Quantitative meters */}
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex justify-between items-center font-semibold mb-1">
                      <span className="text-slate-500">Rooms Allocation Balance:</span>
                      <span className="font-mono text-emerald-700 font-bold">{remaining} left / {allot.totalRooms} total</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingId(allot.id);
                      setHotelId(allot.hotelId);
                      setRoomType(allot.roomType);
                      setSupplierId(allot.supplierId);
                      setStartDate(allot.startDate);
                      setEndDate(allot.endDate);
                      setTotalRooms(allot.totalRooms);
                      setBookedRooms(allot.bookedRooms);
                      setShowForm(true);
                    }}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-1 rounded transition font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this allotment tracking?')) onDeleteAllotment(allot.id);
                    }}
                    className="text-red-600 hover:bg-red-50 px-3 py-1 rounded transition font-semibold"
                  >
                    Delete Block
                  </button>
                </div>
              </div>
            );
          })}
          {allotments.length === 0 && (
            <p className="text-slate-400 italic text-center py-12 col-span-full bg-slate-50 rounded-2xl">No current allotment blocks mapped in workspace.</p>
          )}
        </div>
      )}

    </div>
  );
}
