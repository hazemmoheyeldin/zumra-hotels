import React, { useState, useMemo } from 'react';
import { Reservation, Transaction, FollowUp, Agent, Hotel } from '../types';
import { useLang } from '../lib/LanguageContext';
import ZumraLogo from './ZumraLogo';

interface CalendarViewProps {
  reservations: Reservation[];
  transactions: Transaction[];
  followUps: FollowUp[];
  agents: Agent[];
  hotels: Hotel[];
  onNavigate?: (tab: string, filters?: any) => void;
  onSaveReservation?: (res: Reservation) => void;
}

interface CalendarEvent {
  id: string;
  date: string;
  type: 'arrival' | 'departure' | 'payment' | 'followup' | 'option_expiry';
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  reservationId?: number;
}

export default function CalendarView({ reservations, transactions, followUps, agents, hotels, onNavigate, onSaveReservation }: CalendarViewProps) {
  const { t, lang } = useLang();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragConfirm, setDragConfirm] = useState<{ res: Reservation; newCheckIn: string; newCheckOut: string; oldCheckIn: string; oldCheckOut: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    const days: { date: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLast - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Build events
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const agentMap = new Map(agents.map(a => [a.id, a.name]));
    const hotelMap = new Map(hotels.map(h => [h.id, h.name]));

    // Reservation arrivals & departures
    reservations.filter(r => r.status !== 'Cancelled').forEach(r => {
      const guest = r.guestName || 'Guest';
      const hotel = hotelMap.get(r.hotelId) || 'Hotel';
      const client = agentMap.get(r.clientId) || '';
      const statusColor = r.status === 'Confirmed'
        ? { color: 'text-emerald-700', bgColor: 'bg-emerald-100 border-emerald-300' }
        : { color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300' };
      events.push({
        id: `arr-${r.id}`,
        date: r.checkIn,
        type: 'arrival',
        title: `${guest}`,
        subtitle: `${hotel} (RSV-${r.id})${client ? ` - ${client}` : ''}`,
        color: statusColor.color,
        bgColor: statusColor.bgColor,
        reservationId: r.id,
      });
      if (r.checkOut) {
        events.push({
          id: `dep-${r.id}`,
          date: r.checkOut,
          type: 'departure',
          title: `${guest}`,
          subtitle: `Checkout (RSV-${r.id})`,
          color: 'text-orange-700',
          bgColor: 'bg-orange-100 border-orange-300',
          reservationId: r.id,
        });
      }
      // Option date expiry
      if (r.clientOptionDate) {
        events.push({
          id: `opt-${r.id}`,
          date: r.clientOptionDate,
          type: 'option_expiry',
          title: `Option: ${guest}`,
          subtitle: `RSV-${r.id} expires`,
          color: 'text-purple-700',
          bgColor: 'bg-purple-100 border-purple-300',
          reservationId: r.id,
        });
      }
    });

    // Transactions
    transactions.forEach(t => {
      const typeLabel = t.type === 'ClientPayment' ? 'Payment' : t.type === 'SupplierPayment' ? 'Supplier Pay' : t.type === 'ClientRefund' ? 'Refund' : t.type;
      events.push({
        id: `txn-${t.id}`,
        date: t.date,
        type: 'payment',
        title: `${typeLabel}: ${t.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR`,
        subtitle: t.description || t.voucherNo || '',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100 border-blue-300',
      });
    });

    // Follow-ups
    followUps.forEach(f => {
      const client = agentMap.get(f.clientId) || 'Client';
      events.push({
        id: `fu-${f.id}`,
        date: f.date,
        type: 'followup',
        title: `Follow-up: ${client}`,
        subtitle: f.topic || f.notes?.substring(0, 40) || '',
        color: 'text-pink-700',
        bgColor: 'bg-pink-100 border-pink-300',
      });
    });

    return events;
  }, [reservations, transactions, followUps, agents, hotels]);

  // Events grouped by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    allEvents.forEach(e => {
      const arr = map.get(e.date) || [];
      arr.push(e);
      map.set(e.date, arr);
    });
    return map;
  }, [allEvents]);

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  // Stats
  const monthStats = useMemo(() => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthEvents = allEvents.filter(e => e.date.startsWith(monthStr));
    return {
      arrivals: monthEvents.filter(e => e.type === 'arrival').length,
      departures: monthEvents.filter(e => e.type === 'departure').length,
      payments: monthEvents.filter(e => e.type === 'payment').length,
      followUps: monthEvents.filter(e => e.type === 'followup').length,
      options: monthEvents.filter(e => e.type === 'option_expiry').length,
    };
  }, [allEvents, year, month]);

  const today = new Date().toISOString().split('T')[0];

  const goPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(today); };

  const eventTypeIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'arrival': return '🟢';
      case 'departure': return '🟠';
      case 'payment': return '🔵';
      case 'followup': return '🩷';
      case 'option_expiry': return '🟣';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <ZumraLogo size="xxl" variant="gold" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('cal.title')}</h1>
            <p className="text-sm text-slate-500">{t('cal.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrevMonth} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium">
            {t('cal.prev')}
          </button>
          <span className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold min-w-[160px] text-center">{monthName}</span>
          <button onClick={goNextMonth} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium">
            {t('cal.next')}
          </button>
          <button onClick={goToday} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            {t('cal.today')}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{monthStats.arrivals}</div>
          <div className="text-xs text-emerald-600">{t('cal.arrivals')}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{monthStats.departures}</div>
          <div className="text-xs text-orange-600">{t('cal.departures')}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{monthStats.payments}</div>
          <div className="text-xs text-blue-600">{t('cal.payments')}</div>
        </div>
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-pink-700">{monthStats.followUps}</div>
          <div className="text-xs text-pink-600">{t('cal.followUps')}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center col-span-2 md:col-span-1">
          <div className="text-2xl font-bold text-purple-700">{monthStats.options}</div>
          <div className="text-xs text-purple-600">{t('cal.optionExpiries')}</div>
        </div>
      </div>

      {/* Calendar + Sidebar layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar grid */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-bold text-slate-600 uppercase">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayEvents = eventsByDate.get(day.date) || [];
              const isSelected = selectedDate === day.date;
              const isToday = day.date === today;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day.date)}
                  onDragOver={(e) => {
                    if (!draggedEvent || !draggedEvent.reservationId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverDate(day.date);
                  }}
                  onDragLeave={() => { if (dragOverDate === day.date) setDragOverDate(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDate(null);
                    if (!draggedEvent || !draggedEvent.reservationId || !onSaveReservation) return;
                    const res = reservations.find(r => r.id === draggedEvent.reservationId);
                    if (!res || res.status === 'Cancelled') return;
                    const targetDate = day.date;
                    // Calculate new dates based on which event was dragged
                    let newCheckIn = res.checkIn;
                    let newCheckOut = res.checkOut;
                    if (draggedEvent.type === 'arrival') {
                      const shiftDays = Math.round((new Date(targetDate).getTime() - new Date(res.checkIn).getTime()) / (1000 * 60 * 60 * 24));
                      newCheckIn = targetDate;
                      const co = new Date(res.checkOut);
                      co.setDate(co.getDate() + shiftDays);
                      newCheckOut = co.toISOString().split('T')[0];
                    } else if (draggedEvent.type === 'departure') {
                      if (targetDate <= res.checkIn) return; // Can't checkout before checkin
                      newCheckOut = targetDate;
                    }
                    if (newCheckIn === res.checkIn && newCheckOut === res.checkOut) return;
                    setDragConfirm({ res, newCheckIn, newCheckOut, oldCheckIn: res.checkIn, oldCheckOut: res.checkOut });
                    setDraggedEvent(null);
                  }}
                  className={`min-h-[70px] md:min-h-[90px] border-b border-r border-slate-100 p-1 text-left transition-all
                    ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'}
                    ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/50' : ''}
                    ${isToday ? 'bg-amber-50/50' : ''}
                    ${dragOverDate === day.date ? 'ring-2 ring-indigo-400 ring-inset bg-indigo-50/50' : ''}
                    hover:bg-slate-50`}
                >
                  <div className={`text-xs font-semibold mb-0.5 flex items-center gap-1
                    ${isToday ? 'text-amber-600' : day.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px]
                      ${isToday ? 'bg-amber-500 text-white' : ''}`}>
                      {day.dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="ml-auto bg-slate-200 text-slate-600 rounded-full px-1.5 text-[9px] font-bold leading-3">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 overflow-hidden max-h-[50px] md:max-h-[65px]">
                    {dayEvents.slice(0, 3).map(ev => {
                      const evRes = ev.reservationId ? reservations.find(r => r.id === ev.reservationId) : null;
                      const isDraggable = ev.reservationId && evRes && evRes.status !== 'Cancelled' && onSaveReservation && (ev.type === 'arrival' || ev.type === 'departure');
                      return (
                        <div
                          key={ev.id}
                          draggable={!!isDraggable}
                          onDragStart={(e) => {
                            if (!isDraggable) { e.preventDefault(); return; }
                            setDraggedEvent(ev);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', ev.id);
                          }}
                          onDragEnd={() => { setDraggedEvent(null); setDragOverDate(null); }}
                          className={`text-[9px] md:text-[10px] leading-tight truncate px-1 py-0.5 rounded border ${ev.bgColor} ${ev.color}
                            ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:shadow-sm' : ''}`}
                          title={isDraggable ? 'Drag to move dates' : ev.title}
                        >
                          {eventTypeIcon(ev.type)} {ev.title.substring(0, 18)}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-slate-400 pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event detail sidebar */}
        <div className="w-full lg:w-80 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
            <h3 className="font-bold text-sm text-slate-700">
              {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : t('cal.selectDay')}
            </h3>
            <p className="text-xs text-slate-500">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {selectedEvents.length === 0 && selectedDate && (
              <p className="text-sm text-slate-400 text-center py-8">{t('cal.noEvents')}</p>
            )}
            {selectedEvents.map(ev => (
              <div
                key={ev.id}
                className={`p-3 rounded-lg border ${ev.bgColor} cursor-pointer hover:shadow-sm transition-shadow`}
                onClick={() => {
                  if (ev.reservationId && onNavigate) {
                    onNavigate('Reservations', { viewReservationId: ev.reservationId });
                  }
                }}
              >
                <div className={`text-xs font-bold ${ev.color}`}>
                  {eventTypeIcon(ev.type)} {ev.title}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">{ev.subtitle}</div>
              </div>
            ))}
            {!selectedDate && (
              <p className="text-sm text-slate-400 text-center py-8">{t('cal.clickDay')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400" /> {t('cal.arrivals')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400" /> {t('cal.departures')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400" /> {t('cal.payments')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-pink-400" /> {t('cal.followUps')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-400" /> {t('cal.optionExpiries')}</span>
        {onSaveReservation && <span className="flex items-center gap-1 text-slate-400 ml-auto">↔ Drag events to move dates</span>}
      </div>

      {/* Drag-and-Drop Confirmation Dialog */}
      {dragConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDragConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base text-slate-800 mb-3">↔ Move Reservation Dates</h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">
              <p className="text-sm font-bold text-slate-700">RSV-{dragConfirm.res.id} — {dragConfirm.res.guestName}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Old Dates</p>
                  <p className="text-slate-600 font-mono">{dragConfirm.oldCheckIn}</p>
                  <p className="text-slate-600 font-mono">{dragConfirm.oldCheckOut}</p>
                </div>
                <div>
                  <p className="text-indigo-600 font-bold uppercase text-[9px] mb-1">New Dates</p>
                  <p className="text-indigo-700 font-mono font-bold">{dragConfirm.newCheckIn}</p>
                  <p className="text-indigo-700 font-mono font-bold">{dragConfirm.newCheckOut}</p>
                </div>
              </div>
              {(() => {
                const oldNights = Math.round((new Date(dragConfirm.oldCheckOut).getTime() - new Date(dragConfirm.oldCheckIn).getTime()) / (1000 * 60 * 60 * 24));
                const newNights = Math.round((new Date(dragConfirm.newCheckOut).getTime() - new Date(dragConfirm.newCheckIn).getTime()) / (1000 * 60 * 60 * 24));
                return newNights !== oldNights ? (
                  <p className="text-[10px] text-amber-600 font-bold mt-2">⚠ Nights changed: {oldNights} → {newNights}</p>
                ) : null;
              })()}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDragConfirm(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-200 transition">Cancel</button>
              <button
                onClick={() => {
                  const updated = { ...dragConfirm.res, checkIn: dragConfirm.newCheckIn, checkOut: dragConfirm.newCheckOut, nights: Math.round((new Date(dragConfirm.newCheckOut).getTime() - new Date(dragConfirm.newCheckIn).getTime()) / (1000 * 60 * 60 * 24)) };
                  onSaveReservation!(updated);
                  setDragConfirm(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition"
              >Confirm Move</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
