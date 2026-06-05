import React, { useState, useMemo } from 'react';
import { Reservation, Transaction, FollowUp, Agent, Hotel } from '../types';

interface CalendarViewProps {
  reservations: Reservation[];
  transactions: Transaction[];
  followUps: FollowUp[];
  agents: Agent[];
  hotels: Hotel[];
  onNavigate?: (tab: string, filters?: any) => void;
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

export default function CalendarView({ reservations, transactions, followUps, agents, hotels, onNavigate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      events.push({
        id: `arr-${r.id}`,
        date: r.checkIn,
        type: 'arrival',
        title: `${guest}`,
        subtitle: `${hotel} (RSV-${r.id})${client ? ` - ${client}` : ''}`,
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-100 border-emerald-300',
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
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Booking Calendar</h1>
          <p className="text-sm text-slate-500">Arrivals, departures, payments and follow-ups at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrevMonth} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium">
            ← Prev
          </button>
          <span className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold min-w-[160px] text-center">{monthName}</span>
          <button onClick={goNextMonth} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium">
            Next →
          </button>
          <button onClick={goToday} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            Today
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{monthStats.arrivals}</div>
          <div className="text-xs text-emerald-600">Arrivals</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{monthStats.departures}</div>
          <div className="text-xs text-orange-600">Departures</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{monthStats.payments}</div>
          <div className="text-xs text-blue-600">Payments</div>
        </div>
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-pink-700">{monthStats.followUps}</div>
          <div className="text-xs text-pink-600">Follow-ups</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center col-span-2 md:col-span-1">
          <div className="text-2xl font-bold text-purple-700">{monthStats.options}</div>
          <div className="text-xs text-purple-600">Option Expiries</div>
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
                  className={`min-h-[70px] md:min-h-[90px] border-b border-r border-slate-100 p-1 text-left transition-all
                    ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'}
                    ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/50' : ''}
                    ${isToday ? 'bg-amber-50/50' : ''}
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
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className={`text-[9px] md:text-[10px] leading-tight truncate px-1 py-0.5 rounded border ${ev.bgColor} ${ev.color}`}>
                        {eventTypeIcon(ev.type)} {ev.title.substring(0, 18)}
                      </div>
                    ))}
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
              {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a day'}
            </h3>
            <p className="text-xs text-slate-500">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {selectedEvents.length === 0 && selectedDate && (
              <p className="text-sm text-slate-400 text-center py-8">No events on this day</p>
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
              <p className="text-sm text-slate-400 text-center py-8">Click on a day to see its events</p>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400" /> Arrivals</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400" /> Departures</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400" /> Payments</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-pink-400" /> Follow-ups</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-400" /> Option Expiry</span>
      </div>
    </div>
  );
}
