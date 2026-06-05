/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel, Transaction } from '../types';
import ArrivalReportPDF from './ArrivalReportPDF';
import CancellationReportPDF from './CancellationReportPDF';
import StatementReportPDF from './StatementReportPDF';
import { getReservationTotals, getAgentActualBalance, exportToCSV } from '../lib/storage';
import { useLang } from '../lib/LanguageContext';

interface ReportsPageProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  transactions: Transaction[];
}

export default function ReportsPage({ reservations, agents, hotels, transactions }: ReportsPageProps) {
  const { t, lang } = useLang();
  const [activeReportTab, setActiveReportTab] = useState<'arrival' | 'cancellation' | 'statement' | 'supplierStatement' | 'reminders'>('arrival');

  // Shared Filters
  const [fromDate, setFromDate] = useState('2024-01-01');
  const [toDate, setToDate] = useState('2026-12-31');
  
  // Statement specific filter
  const [selectedAgentId, setSelectedAgentId] = useState(agents.find(a => a.type === 'Customer' || a.type === 'Both')?.id || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState(agents.find(a => a.type === 'Supplier' || a.type === 'Both')?.id || '');

  // Supplier email reminders states
  const [reminderDays, setReminderDays] = useState(3);
  const [selectedReminderRes, setSelectedReminderRes] = useState<Reservation | null>(null);
  const [simulatedRemindersSent, setSimulatedRemindersSent] = useState<Record<string, string>>({});

  // Printing Overlay triggers
  const [printingArrivalReport, setPrintingArrivalReport] = useState(false);
  const [printingCancellationReport, setPrintingCancellationReport] = useState(false);
  const [printingStatementReport, setPrintingStatementReport] = useState(false);

  // Compute lists based on active tabs
  const getArrivalReservations = (): Reservation[] => {
    return reservations.filter(res => {
      if (res.status === 'Cancelled') return false;
      if (activeReportTab === 'arrival' && selectedAgentId && res.clientId !== selectedAgentId) return false;
      return res.checkIn >= fromDate && res.checkIn <= toDate;
    });
  };

  const getCancelledReservations = (): Reservation[] => {
    return reservations.filter(res => {
      if (res.status !== 'Cancelled') return false;
      return res.createdAt >= fromDate && res.createdAt <= toDate;
    });
  };

  const getSupplierRemindersList = (): Reservation[] => {
    return reservations.filter(res => {
      if (res.status === 'Cancelled') return false;
      const { totalBuy } = getReservationTotals(res);
      const unpaidSupp = totalBuy - (res.amountPaidToSupplier || 0);
      return unpaidSupp > 0 && res.checkIn >= fromDate && res.checkIn <= toDate;
    });
  };

  const arrivalList = getArrivalReservations();
  const cancellationList = getCancelledReservations();
  const reminderList = getSupplierRemindersList();
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedSupplier = agents.find(a => a.id === selectedSupplierId);

  // Quick summary stats
  const totalArrivalsSell = arrivalList.reduce((s, r) => { const t = getReservationTotals(r); return s + t.totalSell; }, 0);
  const totalCancelledFee = cancellationList.reduce((s, r) => s + (r.cancellationFee || 0), 0);

  const handleExportCSV = () => {
    if (activeReportTab === 'arrival') {
      const data = arrivalList.map(res => {
        const c = agents.find(ac => ac.id === res.clientId);
        const totals = getReservationTotals(res);
        return {
          'Booking Ref': `RSV-${res.id}`,
          'Client': c?.companyName || c?.name,
          'Guest Name': res.guestName,
          'Check In': res.checkIn,
          'Check Out': res.checkOut,
          'Total Sale': totals.totalSell,
        };
      });
      exportToCSV('arrivals.csv', data);
    } else if (activeReportTab === 'cancellation') {
      const data = cancellationList.map(res => {
        const c = agents.find(ac => ac.id === res.clientId);
        return {
          'Booking Ref': `RSV-${res.id}`,
          'Client': c?.companyName || c?.name,
          'Guest Name': res.guestName,
          'Cancel Fee': res.cancellationFee || 0,
        };
      });
      exportToCSV('cancellations.csv', data);
    } else if (activeReportTab === 'reminders') {
      const data = reminderList.map(res => {
        const totals = getReservationTotals(res);
        return {
          'Booking Ref': `RSV-${res.id}`,
          'Guest Name': res.guestName,
          'Check In': res.checkIn,
          'Unpaid': totals.totalBuy - (res.amountPaidToSupplier || 0),
        };
      });
      exportToCSV('reminders.csv', data);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      
      {/* Quick KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('reports.arrivals')}</div>
          <div className="text-2xl font-black text-slate-900">{arrivalList.length}</div>
          <div className="text-[9px] text-emerald-600 font-mono mt-0.5">{totalArrivalsSell.toLocaleString()} SAR</div>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-rose-600 mb-1">{t('reports.cancellations')}</div>
          <div className="text-2xl font-black text-rose-800">{cancellationList.length}</div>
          <div className="text-[9px] text-rose-500 font-mono mt-0.5">{totalCancelledFee.toLocaleString()} SAR fees</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">{t('reports.pendingReminders')}</div>
          <div className="text-2xl font-black text-amber-800">{reminderList.length}</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1">{t('reports.period')}</div>
          <div className="text-[10px] font-mono text-indigo-800 mt-1">{fromDate}<br/>{toDate}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">{t('reports.totalReservations')}</div>
          <div className="text-2xl font-black text-emerald-800">{reservations.length}</div>
        </div>
      </div>

      {/* Upper sub navigation bar for report selectors */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{t('reports.subtitle')}</h2>
            <p className="text-xs text-slate-500 font-serif">{t('reports.subtitleDesc')}</p>
          </div>
          {(activeReportTab === 'arrival' || activeReportTab === 'cancellation' || activeReportTab === 'reminders') && (
            <button
              onClick={handleExportCSV}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] px-3 py-1.5 rounded-lg transition border border-indigo-200"
            >
              ⬇️ {t('reports.exportCSV')}
            </button>
          )}
        </div>
        
        <div className="flex border-b border-slate-100 mb-4 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveReportTab('arrival')}
            className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeReportTab === 'arrival' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
            }`}
          >
            {t('reports.arrivalsTab')}
          </button>
          <button
            onClick={() => setActiveReportTab('cancellation')}
            className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeReportTab === 'cancellation' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
            }`}
          >
            {t('reports.cancellationsTab')}
          </button>
          <button
            onClick={() => setActiveReportTab('statement')}
            className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeReportTab === 'statement' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
            }`}
          >
            {t('reports.clientStatement')}
          </button>
          <button
            onClick={() => setActiveReportTab('supplierStatement')}
            className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeReportTab === 'supplierStatement' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
            }`}
          >
            {t('reports.supplierStatement')}
          </button>
          <button
            onClick={() => setActiveReportTab('reminders')}
            className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeReportTab === 'reminders' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
            }`}
          >
            📢 {t('reports.supplierReminders')}
          </button>
        </div>

        {/* Global configuration filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 border border-slate-100 p-4 rounded-xl items-end">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('reports.fromDate')}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-white px-2.5 py-1.5 border border-slate-200 rounded text-xs select-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('reports.toDate')}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-white px-2.5 py-1.5 border border-slate-200 rounded text-xs select-none"
            />
          </div>
          
          {(activeReportTab === 'statement' || activeReportTab === 'arrival') ? (
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'تصفية حسب العميل' : 'Filter by Customer / Client'}</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full bg-white px-2.5 py-1.5 border border-slate-200 rounded text-xs focus:outline-none"
              >
                <option value="">-- {t('reports.allCustomers')} --</option>
                {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => (
                  <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                ))}
              </select>
            </div>
          ) : activeReportTab === 'supplierStatement' ? (
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'تصفية حسب المورد' : 'Filter by Supplier'}</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-white px-2.5 py-1.5 border border-slate-200 rounded text-xs focus:outline-none"
              >
                <option value="">-- {t('reports.selectSupplier')} --</option>
                {agents.filter(a => a.type === 'Supplier' || a.type === 'Both').map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold mb-1">Available data count:</span>
              <span className="font-mono font-bold text-emerald-800 text-sm bg-white px-3 py-1.5 rounded border border-slate-100 shadow-sm inline-block">
                {activeReportTab === 'cancellation' ? cancellationList.length : reminderList.length} Rows
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Reports Display Portfolios */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-5 shadow-sm">
        
        {/* Arrivals Report Tab Content */}
        {activeReportTab === 'arrival' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 uppercase text-xs">{lang === 'ar' ? 'معاينة قائمة وصول الفترة' : 'Period Arrivals List Preview'}</h3>
              <button
                onClick={() => setPrintingArrivalReport(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
              >
                📥 {t('reports.savePDFPrint')} {t('reports.arrivals')}
              </button>
            </div>

            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 font-semibold text-slate-500">
                    <th className="py-2.5 px-2">Rsv ID</th>
                    <th className="py-2.5 px-2">Hotel</th>
                    <th className="py-2.5 px-2">Guest Name</th>
                    <th className="py-2.5 px-2 font-mono text-center">Nights</th>
                    <th className="py-2.5 px-2">Check-In</th>
                    <th className="py-2.5 px-2">Check-Out</th>
                    <th className="py-2.5 px-2">Room / Meals</th>
                    <th className="py-2.5 px-2 text-right">Selling Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-650">
                  {arrivalList.map(res => {
                    const h = hotels.find(hotel => hotel.id === res.hotelId);
                    const { totalSell } = getReservationTotals(res);
                    return (
                      <tr key={res.id} className="hover:bg-slate-50/20">
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-900">RSV-{res.id}</td>
                        <td className="py-2.5 px-2 font-semibold text-slate-900">{h?.name}</td>
                        <td className="py-2.5 px-2 uppercase font-medium">{res.guestName}</td>
                        <td className="py-2.5 px-2 font-mono text-center">{res.nights}</td>
                        <td className="py-2.5 px-2 font-mono">{res.checkIn}</td>
                        <td className="py-2.5 px-2 font-mono">{res.checkOut}</td>
                        <td className="py-2.5 px-2 max-w-xs truncate text-[10px] text-slate-500">
                          {res.rooms.map(rm => `${rm.qty} ${rm.roomType} (${rm.mealPlan})`).join(' + ')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-800">
                          {totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                        </td>
                      </tr>
                    );
                  })}
                  {arrivalList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">{t('reports.noArrivals')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cancellation Report Tab Content */}
        {activeReportTab === 'cancellation' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-rose-800 uppercase text-xs">{t('reports.cancelledBookings')}</h3>
              <button
                onClick={() => setPrintingCancellationReport(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
              >
                📥 {t('reports.printCancellation')}
              </button>
            </div>
            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 font-semibold text-slate-500 font-mono">
                    <th className="py-2.5 px-2">RSV ID</th>
                    <th className="py-2.5 px-2">Hotel Stay</th>
                    <th className="py-2.5 px-2 text-left">Guest Name</th>
                    <th className="py-2.5 px-2">Check-In</th>
                    <th className="py-2.5 px-2">Original Sell</th>
                    <th className="py-2.5 px-2 text-right text-rose-700">Cancellation Penalty</th>
                    <th className="py-2.5 px-2 text-center">Who Cancelled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-750">
                  {cancellationList.map(res => {
                    const h = hotels.find(hotel => hotel.id === res.hotelId);
                    const { totalSell } = getReservationTotals(res);
                    return (
                      <tr key={res.id} className="hover:bg-slate-50/20 text-rose-950">
                        <td className="py-2.5 px-2 font-bold font-mono">RSV-{res.id}</td>
                        <td className="py-2.5 px-2 font-medium">{h?.name}</td>
                        <td className="py-2.5 px-2 uppercase">{res.guestName}</td>
                        <td className="py-2.5 px-2 font-mono">{res.checkIn}</td>
                        <td className="py-2.5 px-2 font-mono">{totalSell.toLocaleString()} SAR</td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-750">
                          {(res.cancellationFee || 0).toLocaleString()} SAR
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold text-slate-500 font-mono">
                          {res.createdBy}
                        </td>
                      </tr>
                    );
                  })}
                  {cancellationList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">{t('reports.noCancellations')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Statement Report Tab Content */}
        {activeReportTab === 'statement' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 uppercase text-xs">{t('reports.customerLedger')}</h3>
                <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'فترة الكشف' : 'Statement period'}: {fromDate} {lang === 'ar' ? 'إلى' : 'To'} {toDate}</p>
              </div>
              <button
                disabled={!selectedAgentId}
                onClick={() => setPrintingStatementReport(true)}
                className="bg-amber-600 disabled:opacity-50 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
              >
                📥 {t('reports.savePDFPrint')} {t('reports.statementReport')}
              </button>
            </div>

            {selectedAgent ? (
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/30">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">{lang === 'ar' ? 'نظرة عامة على أرصدة العميل' : 'Client Active Balances Overview'}:</p>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-sm font-bold text-slate-800 uppercase">{selectedAgent.companyName || selectedAgent.name}</span>
                  <span className={`text-sm font-bold font-mono ${(() => { const b = -getAgentActualBalance(selectedAgent, reservations, transactions); return b < 0 ? 'text-rose-650' : 'text-emerald-700'; })()}`}>
                    Active Running Balance: {(() => { const b = -getAgentActualBalance(selectedAgent, reservations, transactions); return b < 0 ? `-${Math.abs(b).toLocaleString()}` : b.toLocaleString(); })()} SAR
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center py-10 text-slate-400 italic">{t('reports.selectCustomer')}</p>
            )}
          </div>
        )}

        {/* Supplier Statement Tab Content */}
        {activeReportTab === 'supplierStatement' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 uppercase text-xs">{t('reports.supplierDetails')}</h3>
                <p className="text-[10px] text-slate-450 mt-0.5">{lang === 'ar' ? 'تصفية جميع فواتير الموردين والمدفوعات' : 'Filter all incoming supplier bills and outgoing payments'}</p>
              </div>
              <button
                disabled={!selectedSupplier}
                onClick={() => setPrintingStatementReport(true)}
                className="bg-amber-600 disabled:opacity-50 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
              >
                📥 {t('reports.savePDFPrint')} {t('reports.statementReport')}
              </button>
            </div>

            {selectedSupplier ? (
              <div className="border border-slate-150 rounded-xl p-4 bg-amber-50/20">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">{lang === 'ar' ? 'نظرة عامة على رصيد المورد' : 'Supplier Current Balance Overview'}:</p>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-sm font-bold text-slate-800 uppercase">{selectedSupplier.name}</span>
                  <span className={`text-sm font-bold font-mono ${(() => { const b = -getAgentActualBalance(selectedSupplier, reservations, transactions); return b < 0 ? 'text-rose-650' : 'text-emerald-700'; })()}`}>
                    Active Running Balance: {(() => { const b = -getAgentActualBalance(selectedSupplier, reservations, transactions); return b < 0 ? `-${Math.abs(b).toLocaleString()}` : b.toLocaleString(); })()} SAR
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center py-10 text-slate-400 italic">{t('reports.selectSupplierMsg')}</p>
            )}
          </div>
        )}

        {/* Supplier Reminders Tab Content */}
        {activeReportTab === 'reminders' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="font-bold text-slate-800 uppercase text-xs">Supplier Dues & Option Reminders Automation</h3>
                <p className="text-[10px] text-slate-400">Track and trigger email re-confirmation drafts automatically beforehand</p>
              </div>

              {/* Configuration panel */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 p-2 rounded-xl">
                <span className="font-bold text-[10px] text-slate-650 uppercase">Tolerance Threshold:</span>
                <input
                  type="number"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(Math.max(1, Number(e.target.value)))}
                  className="w-12 bg-white text-center py-1 border border-slate-200 rounded font-mono font-bold text-xs"
                />
                <span className="text-[10px] text-slate-500 font-semibold">Days prior to Supplier Option Date</span>
              </div>
            </div>

            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 font-semibold text-slate-500">
                    <th className="py-2.5 px-3">RSV ID</th>
                    <th className="py-2.5 px-3">Supplier Agent</th>
                    <th className="py-2.5 px-3">Lead Guest</th>
                    <th className="py-2.5 px-3">Hotel</th>
                    <th className="py-2.5 px-3">Supplier Option Date</th>
                    <th className="py-2.5 px-3 text-right">Outstanding Cost (Buy)</th>
                    <th className="py-2.5 px-3 text-center">Trigger Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-650">
                  {reminderList.map(res => {
                    const supp = agents.find(a => a.id === res.supplierId);
                    const hotelObj = hotels.find(h => h.id === res.hotelId);
                    const { totalBuy } = getReservationTotals(res);
                    const unpaidSupp = totalBuy - (res.amountPaidToSupplier || 0);
                    const lastSent = simulatedRemindersSent[res.id];

                    // Calculate days left to supplier option date
                    let labelDaysLeft = 'N/A';
                    let isCritical = false;
                    if (res.supplierOptionDate) {
                      const optDate = new Date(res.supplierOptionDate);
                      const today = new Date();
                      const diffTime = optDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      labelDaysLeft = `${diffDays} days left`;
                      isCritical = diffDays <= reminderDays;
                    }

                    return (
                      <tr key={res.id} className={`hover:bg-slate-50/20 text-xs ${isCritical ? 'bg-amber-50/10' : ''}`}>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">RSV-{res.id}</td>
                        <td className="py-3 px-3 font-medium">
                          <div className="font-bold text-slate-800">{supp?.name || 'Hotel Direct'}</div>
                          <div className="text-[9px] text-slate-400 font-mono font-semibold">{supp?.email || 'reservations@zumrahotels.com'}</div>
                        </td>
                        <td className="py-3 px-3 uppercase font-medium">{res.guestName}</td>
                        <td className="py-3 px-3 font-semibold text-slate-850">{hotelObj?.name}</td>
                        <td className="py-3 px-3 font-mono">
                          <div>📅 {res.supplierOptionDate || 'Undefined'}</div>
                          {res.supplierOptionDate && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${isCritical ? 'bg-rose-50 text-rose-750' : 'bg-slate-100 text-slate-600'}`}>
                              {labelDaysLeft} {isCritical ? '(Urgent)' : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-mono font-bold text-amber-900">{unpaidSupp.toLocaleString()} SAR</div>
                          <div className="text-[9px] text-slate-400">Total: {totalBuy.toLocaleString()} SAR</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {lastSent ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                ✓ Sent ({lastSent})
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setSelectedReminderRes(res)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer"
                            >
                              📧 Sim Email Draft
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {reminderList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-450 italic">No pending supplier balances or approaching options are outstanding.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Simulation Email Reminder Popup overlay is placed right here */}
      {selectedReminderRes && (() => {
        const resObj = selectedReminderRes;
        const suppObj = agents.find(a => a.id === resObj.supplierId);
        const hotelObj = hotels.find(h => h.id === resObj.hotelId);
        const { totalBuy } = getReservationTotals(resObj);
        const unpaidSupp = totalBuy - (resObj.amountPaidToSupplier || 0);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-0 md:p-4" onClick={() => setSelectedReminderRes(null)}>
            <div className="bg-white rounded-none md:rounded-xl shadow-2xl max-w-lg w-full p-4 md:p-6 max-h-[100dvh] md:max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 text-xs text-slate-800" onClick={(e) => e.stopPropagation()}>
              
              <div className="border-b border-slate-150 pb-3 flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  ✉️ Outgoing Supplier Notification Draft
                </h4>
                <button onClick={() => setSelectedReminderRes(null)} className="text-slate-400 hover:text-slate-600 font-bold block">✕</button>
              </div>

              {/* Simulated Mail Header */}
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg font-mono text-[10px] space-y-1.5 text-slate-650">
                <p><strong>From:</strong> Zumra Hotels Reservations &lt;reservations@zumrahotels.com&gt;</p>
                <p><strong>To:</strong> {suppObj?.name || 'Direct Hotel Sponsor'} &lt;{suppObj?.email || 'partner@zumrahotels.com'}&gt;</p>
                <p><strong>Subject:</strong> ⚠️ RE-CONFIRMATION & PAYMENT DUE REMINDER - RSV-{resObj.id} ({resObj.guestName.toUpperCase()})</p>
                <p><strong>Option Due:</strong> 📅 {resObj.supplierOptionDate || 'Immediate'}</p>
              </div>

              {/* Simulated Mail Body Workspace */}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl font-serif leading-relaxed text-xs">
                <p className="mb-2">Dear Supplier Partner,</p>
                <p className="mb-3">Please note that the option deadline for booking <strong>RSV-{resObj.id}</strong> under lead guest name <strong>{resObj.guestName.toUpperCase()}</strong> staying at <strong>{hotelObj?.name}</strong> is approaching next on <strong>{resObj.supplierOptionDate || 'Immediate'}</strong>.</p>
                <p className="mb-3">To secure our guaranteed allotment, please review the pricing totals and prepare the official voucher invoices:</p>
                <ul className="list-disc pl-5 mb-3 space-y-1">
                  <li>Total Cost Allocated: <strong>{totalBuy.toLocaleString()} SAR</strong></li>
                  <li>Outstanding Amount Owed: <strong className="text-amber-800">{unpaidSupp.toLocaleString()} SAR</strong></li>
                  <li>Arrival Check-In: <strong>{resObj.checkIn}</strong></li>
                  <li>Voucher Supplier Reference: <strong>{resObj.supplierVoucher || 'Direct'}</strong></li>
                </ul>
                <p className="mb-3">Please acknowledge this order re-confirmation as soon as possible.</p>
                <p className="mb-0">Warm regards,<br /><strong>Zumra Hotels Reserves</strong></p>
              </div>

              <div className="flex gap-2 justify-end mt-5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedReminderRes(null)}
                  className="bg-slate-150 hover:bg-slate-250 text-slate-705 font-bold px-4 py-2 rounded-xl transition text-xs"
                >
                  Discard Draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sentStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setSimulatedRemindersSent(prev => ({ ...prev, [resObj.id]: sentStr }));
                    alert(`Simulated email notice dispatched to: ${suppObj?.email || 'supplier'}`);
                    setSelectedReminderRes(null);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl transition shadow text-xs cursor-pointer"
                >
                  🚀 Dispatch Email Simulated Notice
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Printing arrival overlays standard */}
      {printingArrivalReport && (
        <ArrivalReportPDF
          reservations={arrivalList}
          agents={agents}
          hotels={hotels}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setPrintingArrivalReport(false)}
        />
      )}

      {/* Printing cancellation overlay */}
      {printingCancellationReport && (
        <CancellationReportPDF
          reservations={cancellationList}
          agents={agents}
          hotels={hotels}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setPrintingCancellationReport(false)}
        />
      )}

      {/* Printing account statement ledger standard */}
      {printingStatementReport && activeReportTab === 'statement' && selectedAgent && (
        <StatementReportPDF
          client={selectedAgent}
          reservations={reservations}
          transactions={transactions}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setPrintingStatementReport(false)}
        />
      )}

      {printingStatementReport && activeReportTab === 'supplierStatement' && selectedSupplier && (
        <StatementReportPDF
          client={selectedSupplier}
          reservations={reservations}
          transactions={transactions}
          fromDate={fromDate}
          toDate={toDate}
          isSupplier={true}
          onClose={() => setPrintingStatementReport(false)}
        />
      )}

    </div>
  );
}
