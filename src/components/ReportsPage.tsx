/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Reservation, Agent, Hotel, Transaction, Account, OtherService, TaxSettings, Expense, ExpenseCategory, SalesPerson } from '../types';
import ArrivalReportPDF from './ArrivalReportPDF';
import CancellationReportPDF from './CancellationReportPDF';
import StatementReportPDF from './StatementReportPDF';
import { getReservationTotals, getAgentActualBalance, exportToCSV } from '../lib/storage';
import { useLang } from '../lib/LanguageContext';
import { showToast } from './Toast';

interface ReportsPageProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  transactions: Transaction[];
  accounts?: Account[];
  otherServices?: OtherService[];
  taxSettings?: TaxSettings[];
  expenses?: Expense[];
  expenseCategories?: ExpenseCategory[];
  salesPersons?: SalesPerson[];
  initialTab?: ReportTab;
  onNavigate?: (page: string) => void;
  onSaveReservation?: (res: Reservation) => void;
}

type ReportTab = 'arrival' | 'cancellation' | 'statement' | 'supplierStatement' | 'reminders' | 'balanceSheet' | 'incomeStatement' | 'collection' | 'tax' | 'reconciliation' | 'commission' | 'seasonAnalytics' | 'supplierPayments' | 'cancellationAnalysis' | 'supplierScorecard' | 'accountingExport' | 'clientLifetimeValue';

export default function ReportsPage({ reservations, agents, hotels, transactions, accounts = [], otherServices = [], taxSettings = [], expenses = [], expenseCategories = [], salesPersons = [], initialTab, onNavigate, onSaveReservation }: ReportsPageProps) {
  const { t, lang } = useLang();
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>(initialTab || 'arrival');

  // React to initialTab changes (when navigating from other pages)
  React.useEffect(() => {
    if (initialTab) setActiveReportTab(initialTab);
  }, [initialTab]);

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

  // Collection report filters
  const [collSearch, setCollSearch] = useState('');
  const [collMinAmount, setCollMinAmount] = useState(0);
  const [collClientFilter, setCollClientFilter] = useState('');

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
        
        <div className="flex border-b border-slate-100 mb-4 gap-1 overflow-x-auto">
          {/* Operational Reports */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200 mr-1">
            <span className="text-[8px] uppercase font-bold text-slate-400 -rotate-90 whitespace-nowrap mr-1 hidden md:block">Operations</span>
            <button
              onClick={() => setActiveReportTab('arrival')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'arrival' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              🛫 {t('reports.arrivalsTab')}
            </button>
            <button
              onClick={() => setActiveReportTab('cancellation')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'cancellation' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              ❌ {t('reports.cancellationsTab')}
            </button>
            <button
              onClick={() => setActiveReportTab('statement')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'statement' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📄 {t('reports.clientStatement')}
            </button>
            <button
              onClick={() => setActiveReportTab('supplierStatement')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'supplierStatement' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📝 {t('reports.supplierStatement')}
            </button>
            <button
              onClick={() => setActiveReportTab('reminders')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'reminders' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📢 {t('reports.supplierReminders')}
            </button>
          </div>
          {/* Financial Reports */}
          <div className="flex items-center gap-0.5">
            <span className="text-[8px] uppercase font-bold text-slate-400 -rotate-90 whitespace-nowrap mr-1 hidden md:block">Finance</span>
            <button
              onClick={() => setActiveReportTab('balanceSheet')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'balanceSheet' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📊 Balance Sheet
            </button>
            <button
              onClick={() => setActiveReportTab('incomeStatement')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'incomeStatement' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📈 Income Statement
            </button>
            <button
              onClick={() => setActiveReportTab('collection')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'collection' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              💰 Under Collection
            </button>
            <button
              onClick={() => setActiveReportTab('tax')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'tax' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              🧾 Tax Report
            </button>
            <button
              onClick={() => setActiveReportTab('reconciliation')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'reconciliation' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              🔄 Reconciliation
            </button>
          </div>
          {/* Analytics & Commission */}
          <div className="flex items-center gap-0.5 pl-2 border-l border-slate-200 ml-1">
            <span className="text-[8px] uppercase font-bold text-slate-400 -rotate-90 whitespace-nowrap mr-1 hidden md:block">Analytics</span>
            <button
              onClick={() => setActiveReportTab('commission')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'commission' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              💼 Commission
            </button>
            <button
              onClick={() => setActiveReportTab('seasonAnalytics')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'seasonAnalytics' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📆 Season Analytics
            </button>
            <button
              onClick={() => setActiveReportTab('supplierPayments')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'supplierPayments' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              🏛️ Supplier Payments
            </button>
          </div>
          {/* Analysis & Insights */}
          <div className="flex items-center gap-0.5 pl-2 border-l border-slate-200 ml-1">
            <span className="text-[8px] uppercase font-bold text-slate-400 -rotate-90 whitespace-nowrap mr-1 hidden md:block">Insights</span>
            <button
              onClick={() => setActiveReportTab('cancellationAnalysis')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'cancellationAnalysis' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📉 Cancellation Analysis
            </button>
            <button
              onClick={() => setActiveReportTab('supplierScorecard')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'supplierScorecard' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              🏆 Supplier Scorecard
            </button>
            <button
              onClick={() => setActiveReportTab('accountingExport')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'accountingExport' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              📤 Accounting Export
            </button>
            <button
              onClick={() => setActiveReportTab('clientLifetimeValue')}
              className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeReportTab === 'clientLifetimeValue' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              👑 Client Lifetime Value
            </button>
          </div>
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

        {/* ==================== BALANCE SHEET ==================== */}
        {activeReportTab === 'balanceSheet' && (() => {
          // Assets
          const bankBalances = accounts.filter(a => a.type === 'Bank').reduce((s, a) => s + a.balance, 0);
          const cashOnHand = accounts.filter(a => a.type === 'Cash').reduce((s, a) => s + a.balance, 0);
          const clients = agents.filter(a => a.type === 'Customer' || a.type === 'Both');
          const suppliers = agents.filter(a => a.type === 'Supplier' || a.type === 'Both');
          const accountsReceivable = clients.reduce((s, a) => s + Math.max(0, getAgentActualBalance(a, reservations, transactions)), 0);
          const totalAssets = bankBalances + cashOnHand + accountsReceivable;

          // Liabilities
          const accountsPayable = suppliers.reduce((s, a) => s + Math.max(0, getAgentActualBalance(a, reservations, transactions)), 0);
          const clientCredits = clients.reduce((s, a) => s + (a.walletBalance || 0), 0);
          const totalLiabilities = accountsPayable + clientCredits;

          // Equity
          let totalRevenue = 0, totalCost = 0;
          reservations.filter(r => r.status !== 'Cancelled').forEach(r => {
            const t = getReservationTotals(r);
            totalRevenue += t.totalSell;
            totalCost += t.totalBuy;
          });
          otherServices.filter(s => s.status !== 'Cancelled').forEach(s => {
            totalRevenue += s.sellPrice * s.quantity;
            totalCost += s.buyPrice * s.quantity;
          });
          const retainedEarnings = totalRevenue - totalCost;
          const totalExpensesAmount = expenses.reduce((s, e) => s + e.amount, 0);
          const totalEquity = retainedEarnings - totalExpensesAmount;

          return (
            <div className="space-y-6">
              <h3 className="font-bold text-slate-800 uppercase text-xs">Balance Sheet as of {toDate}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Assets */}
                <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/30">
                  <h4 className="font-bold text-emerald-800 text-sm mb-3 uppercase">Assets</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span>Bank Accounts</span><span className="font-mono font-bold">{bankBalances.toLocaleString('en-US', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between"><span>Cash on Hand</span><span className="font-mono font-bold">{cashOnHand.toLocaleString('en-US', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between"><span>Accounts Receivable</span><span className="font-mono font-bold">{accountsReceivable.toLocaleString('en-US', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between border-t border-emerald-300 pt-2 font-bold text-sm">
                      <span>Total Assets</span><span className="font-mono">{totalAssets.toLocaleString('en-US', {minimumFractionDigits:2})} SAR</span>
                    </div>
                  </div>
                </div>
                {/* Liabilities */}
                <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/30">
                  <h4 className="font-bold text-rose-800 text-sm mb-3 uppercase">Liabilities</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span>Accounts Payable</span><span className="font-mono font-bold">{accountsPayable.toLocaleString('en-US', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between"><span>Client Credits (Wallet)</span><span className="font-mono font-bold">{clientCredits.toLocaleString('en-US', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between border-t border-rose-300 pt-2 font-bold text-sm">
                      <span>Total Liabilities</span><span className="font-mono">{totalLiabilities.toLocaleString('en-US', {minimumFractionDigits:2})} SAR</span>
                    </div>
                  </div>
                </div>
                {/* Equity */}
                <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30">
                  <h4 className="font-bold text-indigo-800 text-sm mb-3 uppercase">Equity</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span>Retained Earnings</span><span className="font-mono font-bold">{retainedEarnings.toLocaleString('en-US', {minimumFractionDigits:2})}</span></div>
                    {totalExpensesAmount > 0 && (
                      <div className="flex justify-between text-rose-600"><span>Less: Expenses</span><span className="font-mono font-bold">({totalExpensesAmount.toLocaleString('en-US', {minimumFractionDigits:2})})</span></div>
                    )}
                    <div className="flex justify-between border-t border-indigo-300 pt-2 font-bold text-sm">
                      <span>Total Equity</span><span className="font-mono">{totalEquity.toLocaleString('en-US', {minimumFractionDigits:2})} SAR</span>
                    </div>
                    <div className="flex justify-between border-t border-indigo-300 pt-2 font-bold text-sm mt-4">
                      <span>L + E</span><span className="font-mono text-emerald-700">{(totalLiabilities + totalEquity).toLocaleString('en-US', {minimumFractionDigits:2})} SAR</span>
                    </div>
                  </div>
                </div>
              </div>
              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) > 0.01 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">Note: Balance sheet may not balance due to opening balances not tracked in transactions.</p>
              )}
            </div>
          );
        })()}

        {/* ==================== INCOME STATEMENT ==================== */}
        {activeReportTab === 'incomeStatement' && (() => {
          const periodReservations = reservations.filter(r => r.status !== 'Cancelled' && r.checkIn >= fromDate && r.checkIn <= toDate);
          const periodServices = otherServices.filter(s => s.status !== 'Cancelled' && s.date >= fromDate && s.date <= toDate);
          const cancelledRes = reservations.filter(r => r.status === 'Cancelled' && r.createdAt >= fromDate && r.createdAt <= toDate);

          let resSell = 0, resBuy = 0;
          periodReservations.forEach(r => { const t = getReservationTotals(r); resSell += t.totalSell; resBuy += t.totalBuy; });
          let svcSell = 0, svcBuy = 0;
          periodServices.forEach(s => { svcSell += s.sellPrice * s.quantity; svcBuy += s.buyPrice * s.quantity; });

          const totalRevenue = resSell + svcSell;
          const totalCOGS = resBuy + svcBuy;
          const grossProfit = totalRevenue - totalCOGS;
          const cancelImpact = cancelledRes.reduce((s, r) => s + (r.cancellationFee || 0), 0);
          const totalExpensesForPeriod = expenses.filter(e => e.date >= fromDate && e.date <= toDate).reduce((s, e) => s + e.amount, 0);
          const expensesByCategory: Record<string, number> = {};
          expenses.filter(e => e.date >= fromDate && e.date <= toDate).forEach(e => {
            expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
          });
          const netProfit = grossProfit + cancelImpact - totalExpensesForPeriod;

          return (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 uppercase text-xs">Income Statement ({fromDate} to {toDate})</h3>
              <div className="max-w-2xl mx-auto border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-emerald-50"><td className="px-4 py-3 font-bold text-emerald-800" colSpan={2}>Revenue</td></tr>
                    <tr className="border-b"><td className="px-4 py-2 pl-8 text-slate-600">Reservation Revenue</td><td className="px-4 py-2 text-right font-mono">{resSell.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>
                    <tr className="border-b"><td className="px-4 py-2 pl-8 text-slate-600">Other Services Revenue</td><td className="px-4 py-2 text-right font-mono">{svcSell.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>
                    <tr className="bg-emerald-50 font-bold"><td className="px-4 py-3 pl-8">Total Revenue</td><td className="px-4 py-3 text-right font-mono text-emerald-800">{totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>

                    <tr className="bg-rose-50"><td className="px-4 py-3 font-bold text-rose-800" colSpan={2}>Cost of Services</td></tr>
                    <tr className="border-b"><td className="px-4 py-2 pl-8 text-slate-600">Reservation Cost</td><td className="px-4 py-2 text-right font-mono">{resBuy.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>
                    <tr className="border-b"><td className="px-4 py-2 pl-8 text-slate-600">Other Services Cost</td><td className="px-4 py-2 text-right font-mono">{svcBuy.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>
                    <tr className="bg-rose-50 font-bold"><td className="px-4 py-3 pl-8">Total COGS</td><td className="px-4 py-3 text-right font-mono text-rose-800">{totalCOGS.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>

                    <tr className="bg-indigo-50 font-bold text-base"><td className="px-4 py-3">Gross Profit</td><td className={`px-4 py-3 text-right font-mono ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{grossProfit.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>

                    <tr className="border-b"><td className="px-4 py-2 text-slate-600">Cancellation Fees</td><td className="px-4 py-2 text-right font-mono text-amber-700">{cancelImpact.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>

                    {totalExpensesForPeriod > 0 && (
                      <>
                        <tr className="bg-orange-50"><td className="px-4 py-3 font-bold text-orange-800" colSpan={2}>Operating Expenses</td></tr>
                        {Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                          <tr key={cat} className="border-b"><td className="px-4 py-2 pl-8 text-slate-600">{cat}</td><td className="px-4 py-2 text-right font-mono text-orange-700">{total.toLocaleString('en-US', {minimumFractionDigits:2})}</td></tr>
                        ))}
                        <tr className="bg-orange-50 font-bold"><td className="px-4 py-3 pl-8">Total Operating Expenses</td><td className="px-4 py-3 text-right font-mono text-orange-800">({totalExpensesForPeriod.toLocaleString('en-US', {minimumFractionDigits:2})})</td></tr>
                      </>
                    )}

                    <tr className="bg-slate-800 text-white font-bold text-base"><td className="px-4 py-3">Net Profit</td><td className={`px-4 py-3 text-right font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netProfit.toLocaleString('en-US', {minimumFractionDigits:2})} SAR</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ==================== MONEY UNDER COLLECTION ==================== */}
        {activeReportTab === 'collection' && (() => {
          const collectionData = useMemo(() => {
            return reservations.filter(r => r.status !== 'Cancelled').map(r => {
              const { totalSell } = getReservationTotals(r);
              const outstanding = totalSell - (r.amountPaidByClient || 0);
              const client = agents.find(a => a.id === r.clientId);
              const hotel = hotels.find(h => h.id === r.hotelId);
              // Aging based on check-in date
              const checkInDate = new Date(r.checkIn);
              const today = new Date();
              const daysSinceCheckIn = Math.max(0, Math.ceil((today.getTime() - checkInDate.getTime()) / (1000*60*60*24)));
              let bucket = 'Current';
              if (daysSinceCheckIn > 60) bucket = '60d+';
              else if (daysSinceCheckIn > 30) bucket = '30d';
              else if (daysSinceCheckIn > 14) bucket = '14d';
              else if (daysSinceCheckIn > 7) bucket = '7d';
              return { res: r, outstanding, client, hotel, bucket, daysSinceCheckIn };
            }).filter(d => d.outstanding > 0);
          }, [reservations, agents, hotels]);

          const filteredColl = collectionData.filter(d => {
            if (collMinAmount > 0 && d.outstanding < collMinAmount) return false;
            if (collClientFilter && d.client?.id !== collClientFilter) return false;
            if (collSearch) {
              const q = collSearch.toLowerCase();
              return (
                String(d.res.id).includes(q) ||
                d.res.guestName.toLowerCase().includes(q) ||
                (d.client?.name.toLowerCase().includes(q)) ||
                (d.hotel?.name.toLowerCase().includes(q))
              );
            }
            return true;
          });

          const buckets: Record<string, number> = { 'Current': 0, '7d': 0, '14d': 0, '30d': 0, '60d+': 0 };
          collectionData.forEach(d => { buckets[d.bucket] = (buckets[d.bucket] || 0) + d.outstanding; });
          const totalOutstanding = collectionData.reduce((s, d) => s + d.outstanding, 0);

          const handleCollExport = () => {
            const rows = filteredColl.map(d => ({
              'Booking': `RSV-${d.res.id}`,
              'Guest': d.res.guestName,
              'Client': d.client?.name || '',
              'Hotel': d.hotel?.name || '',
              'Outstanding': d.outstanding.toFixed(2),
              'Aging': d.bucket,
              'Days': d.daysSinceCheckIn,
            }));
            exportToCSV('money_under_collection.csv', rows);
          };

          return (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 uppercase text-xs">Money Under Collection</h3>
                <button onClick={handleCollExport} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] px-3 py-1.5 rounded-lg transition border border-indigo-200">
                  Export CSV
                </button>
              </div>
              {/* Aging buckets */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <div className="bg-white border rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Total Outstanding</p>
                  <p className="text-lg font-bold text-slate-900">{totalOutstanding.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                </div>
                {Object.entries(buckets).map(([bucket, amount]) => (
                  <div key={bucket} className={`border rounded-lg p-3 text-center ${
                    bucket === 'Current' ? 'bg-green-50 border-green-200' :
                    bucket === '7d' ? 'bg-yellow-50 border-yellow-200' :
                    bucket === '14d' ? 'bg-orange-50 border-orange-200' :
                    bucket === '30d' ? 'bg-red-50 border-red-200' :
                    'bg-red-100 border-red-300'
                  }`}>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{bucket}</p>
                    <p className="text-sm font-bold font-mono">{amount.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                  </div>
                ))}
              </div>
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input type="text" placeholder="Search booking#, guest, client..." value={collSearch} onChange={e => setCollSearch(e.target.value)} className="px-3 py-2 border rounded-lg text-xs" />
                <select value={collClientFilter} onChange={e => setCollClientFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-xs bg-white">
                  <option value="">All Clients</option>
                  {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input type="number" placeholder="Min amount" value={collMinAmount || ''} onChange={e => setCollMinAmount(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-xs" />
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Booking</th>
                      <th className="py-2.5 px-3">Guest</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Hotel</th>
                      <th className="py-2.5 px-3">Check-in</th>
                      <th className="py-2.5 px-3 text-right">Outstanding</th>
                      <th className="py-2.5 px-3 text-center">Aging</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredColl.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 text-center text-slate-400 italic">No outstanding amounts</td></tr>
                    ) : (
                      filteredColl.map(d => (
                        <tr key={d.res.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">RSV-{d.res.id}</td>
                          <td className="py-2.5 px-3 uppercase font-medium">{d.res.guestName}</td>
                          <td className="py-2.5 px-3 font-medium">{d.client?.name || '-'}</td>
                          <td className="py-2.5 px-3">{d.hotel?.name || '-'}</td>
                          <td className="py-2.5 px-3 font-mono">{d.res.checkIn}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{d.outstanding.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.bucket === 'Current' ? 'bg-green-100 text-green-800' :
                              d.bucket === '7d' ? 'bg-yellow-100 text-yellow-800' :
                              d.bucket === '14d' ? 'bg-orange-100 text-orange-800' :
                              d.bucket === '30d' ? 'bg-red-100 text-red-800' :
                              'bg-red-200 text-red-900'
                            }`}>{d.bucket}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ==================== TAX REPORT ==================== */}
        {activeReportTab === 'tax' && (() => {
          const defaultRate = taxSettings.find(ts => ts.active)?.rate ?? 15;
          const periodRes = reservations.filter(r => r.status !== 'Cancelled' && r.checkIn >= fromDate && r.checkIn <= toDate);
          const periodSvc = otherServices.filter(s => s.status !== 'Cancelled' && s.date >= fromDate && s.date <= toDate);

          let outputVatRes = 0, inputVatRes = 0;
          periodRes.forEach(r => {
            const t = getReservationTotals(r);
            outputVatRes += t.totalSell * defaultRate / 100;
            inputVatRes += t.totalBuy * defaultRate / 100;
          });
          let outputVatSvc = 0, inputVatSvc = 0;
          periodSvc.forEach(s => {
            outputVatSvc += s.sellPrice * s.quantity * s.taxRate / 100;
            inputVatSvc += s.buyPrice * s.quantity * s.taxRate / 100;
          });

          const totalOutputVat = outputVatRes + outputVatSvc;
          const totalInputVat = inputVatRes + inputVatSvc;
          const netVatDue = totalOutputVat - totalInputVat;

          const handleTaxExport = () => {
            const rows = [
              ...periodRes.map(r => {
                const t = getReservationTotals(r);
                return {
                  Type: 'Reservation', Ref: `RSV-${r.id}`, Date: r.checkIn,
                  'Sell': t.totalSell.toFixed(2), 'Buy': t.totalBuy.toFixed(2),
                  'Output VAT': (t.totalSell * defaultRate / 100).toFixed(2),
                  'Input VAT': (t.totalBuy * defaultRate / 100).toFixed(2),
                };
              }),
              ...periodSvc.map(s => ({
                Type: 'Service', Ref: s.invoiceNo || s.id, Date: s.date,
                'Sell': (s.sellPrice * s.quantity).toFixed(2), 'Buy': (s.buyPrice * s.quantity).toFixed(2),
                'Output VAT': (s.sellPrice * s.quantity * s.taxRate / 100).toFixed(2),
                'Input VAT': (s.buyPrice * s.quantity * s.taxRate / 100).toFixed(2),
              })),
            ];
            exportToCSV('tax_report.csv', rows);
          };

          return (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 uppercase text-xs">Tax Report ({fromDate} to {toDate})</h3>
                <button onClick={handleTaxExport} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] px-3 py-1.5 rounded-lg transition border border-indigo-200">
                  Export CSV
                </button>
              </div>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase">Output VAT (on Sales)</p>
                  <p className="text-xl font-bold font-mono text-emerald-800">{totalOutputVat.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-rose-600 font-bold uppercase">Input VAT (on Purchases)</p>
                  <p className="text-xl font-bold font-mono text-rose-800">{totalInputVat.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                </div>
                <div className={`${netVatDue >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} border rounded-xl p-4 text-center`}>
                  <p className="text-[10px] font-bold uppercase">{netVatDue >= 0 ? 'Net VAT Payable' : 'Net VAT Refundable'}</p>
                  <p className={`text-xl font-bold font-mono ${netVatDue >= 0 ? 'text-amber-800' : 'text-green-800'}`}>{Math.abs(netVatDue).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                </div>
              </div>
              {/* Tax Settings Info */}
              <div className="bg-slate-50 border rounded-lg p-3">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Active Tax Settings</p>
                {taxSettings.filter(ts => ts.active).map(ts => (
                  <p key={ts.id} className="text-xs text-slate-700">{ts.name}: {ts.rate}% ({ts.appliesTo.join(', ')})</p>
                ))}
              </div>
              {/* Breakdown table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Ref</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Sell</th>
                      <th className="py-2.5 px-3">Buy</th>
                      <th className="py-2.5 px-3 text-right">Output VAT</th>
                      <th className="py-2.5 px-3 text-right">Input VAT</th>
                      <th className="py-2.5 px-3 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {periodRes.map(r => {
                      const t = getReservationTotals(r);
                      const oVat = t.totalSell * defaultRate / 100;
                      const iVat = t.totalBuy * defaultRate / 100;
                      return (
                        <tr key={`r-${r.id}`} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-bold">RSV-{r.id}</td>
                          <td className="py-2.5 px-3 font-mono">{r.checkIn}</td>
                          <td className="py-2.5 px-3 font-mono">{t.totalSell.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 font-mono">{t.totalBuy.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{oVat.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700">{iVat.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{(oVat - iVat).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                        </tr>
                      );
                    })}
                    {periodSvc.map(s => {
                      const sellTotal = s.sellPrice * s.quantity;
                      const buyTotal = s.buyPrice * s.quantity;
                      const oVat = sellTotal * s.taxRate / 100;
                      const iVat = buyTotal * s.taxRate / 100;
                      return (
                        <tr key={`s-${s.id}`} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-bold">{s.invoiceNo || s.id}</td>
                          <td className="py-2.5 px-3 font-mono">{s.date}</td>
                          <td className="py-2.5 px-3 font-mono">{sellTotal.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 font-mono">{buyTotal.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{oVat.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700">{iVat.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{(oVat - iVat).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                        </tr>
                      );
                    })}
                    {periodRes.length === 0 && periodSvc.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-slate-400 italic">No transactions in this period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

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
                    showToast(`Email notice dispatched to: ${suppObj?.email || 'supplier'}`, 'success');
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

      {/* ==================== RECONCILIATION REPORT ==================== */}
      {activeReportTab === 'reconciliation' && (() => {
        const customers = agents.filter(a => a.type === 'Customer' || a.type === 'Both');
        const clientRows = customers.map(client => {
          const clientRes = reservations.filter(r => r.clientId === client.id && r.status !== 'Cancelled');
          const totalSell = clientRes.reduce((s, r) => s + getReservationTotals(r).totalSell, 0);
          const clientPayments = transactions.filter(t => t.agentId === client.id && (t.type === 'ClientPayment' || t.type === 'CreditApplied')).reduce((s, t) => s + t.amount, 0);
          const bookedAmount = clientRes.reduce((s, r) => s + (r.amountPaidByClient || 0), 0);
          const outstanding = totalSell - bookedAmount;
          return { client, totalSell, bookedAmount, clientPayments, outstanding, bookings: clientRes.length };
        }).filter(r => r.bookings > 0).sort((a, b) => b.outstanding - a.outstanding);

        return (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 uppercase text-xs">Client Reconciliation Report</h3>
            <p className="text-xs text-slate-500">Compare system records against client accounts. Outstanding = Total Sell - Client Paid.</p>
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] uppercase font-bold text-slate-500">Client</th>
                    <th className="text-center px-3 py-2 text-[10px] uppercase font-bold text-slate-500">Bookings</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase font-bold text-slate-500">Total Sell</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase font-bold text-slate-500">Client Paid</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase font-bold text-slate-500">Payments</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase font-bold text-slate-500">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {clientRows.map(r => (
                    <tr key={r.client.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{r.client.companyName || r.client.name}</td>
                      <td className="px-3 py-2 text-center font-mono">{r.bookings}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.totalSell.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">{r.bookedAmount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-indigo-700">{r.clientPayments.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${r.outstanding > 0 ? 'text-rose-700' : r.outstanding < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{r.outstanding.toLocaleString()}</td>
                    </tr>
                  ))}
                  {clientRows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No client data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ==================== COMMISSION REPORT ==================== */}
      {activeReportTab === 'commission' && (() => {
        const activeReservations = reservations.filter(r => r.status !== 'Cancelled' && r.checkIn >= fromDate && r.checkIn <= toDate);
        const [expandedSP, setExpandedSP] = React.useState<string | null>(null);
        const commissionData = salesPersons.filter(sp => sp.active).map(sp => {
          const spBookings = activeReservations.filter(r => r.salesPersonId === sp.id);
          const totalRevenue = spBookings.reduce((sum, r) => sum + getReservationTotals(r).totalSell, 0);
          const totalCost = spBookings.reduce((sum, r) => sum + getReservationTotals(r).totalBuy, 0);
          const totalProfit = totalRevenue - totalCost;
          const totalCommission = spBookings.reduce((sum, r) => sum + (r.salesPersonCommissionAmount || 0), 0);
          const totalPaid = spBookings.filter(r => r.commissionPaidToSalesPerson).reduce((sum, r) => sum + (r.salesPersonCommissionAmount || 0), 0);
          const totalUnpaid = totalCommission - totalPaid;
          const totalNights = spBookings.reduce((sum, r) => sum + r.nights, 0);
          // KSA Collection tracking
          const ksaCollected = spBookings.filter(r => r.collectedBySalesPerson).reduce((sum, r) => sum + getReservationTotals(r).totalSell, 0);
          const ksaCommissionKept = spBookings.filter(r => r.collectedBySalesPerson).reduce((sum, r) => sum + (r.salesPersonCommissionAmount || 0), 0);
          const ksaRemitted = spBookings.filter(r => r.collectedBySalesPerson && r.remittedToCompany).reduce((sum, r) => sum + (getReservationTotals(r).totalSell - (r.salesPersonCommissionAmount || 0)), 0);
          const ksaPendingRemittance = spBookings.filter(r => r.collectedBySalesPerson && !r.remittedToCompany).reduce((sum, r) => sum + (getReservationTotals(r).totalSell - (r.salesPersonCommissionAmount || 0)), 0);
          return { sp, bookings: spBookings, count: spBookings.length, totalRevenue, totalCost, totalProfit, totalCommission, totalPaid, totalUnpaid, totalNights, ksaCollected, ksaCommissionKept, ksaRemitted, ksaPendingRemittance };
        });
        const grandTotalCommission = commissionData.reduce((s, d) => s + d.totalCommission, 0);
        const grandTotalUnpaid = commissionData.reduce((s, d) => s + d.totalUnpaid, 0);
        const grandTotalPaid = commissionData.reduce((s, d) => s + d.totalPaid, 0);
        const grandKsaCollected = commissionData.reduce((s, d) => s + d.ksaCollected, 0);
        const grandKsaPending = commissionData.reduce((s, d) => s + d.ksaPendingRemittance, 0);
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">💼 Commission & KSA Collection Tracker</h3>
              <button onClick={() => {
                const rows: any[] = [];
                commissionData.forEach(d => {
                  d.bookings.forEach(r => {
                    const totals = getReservationTotals(r);
                    rows.push({
                      'Sales Person': d.sp.name, 'RSV#': r.id, 'Guest': r.guestName, 'Hotel': hotels.find(h => h.id === r.hotelId)?.name || '',
                      'Check-In': r.checkIn, 'Check-Out': r.checkOut, 'Nights': r.nights,
                      'Sell Total': totals.totalSell, 'Commission %': d.sp.commission,
                      'Commission Amount': r.salesPersonCommissionAmount || 0,
                      'Commission Paid': r.commissionPaidToSalesPerson ? 'Yes' : 'No',
                      'Commission Paid Date': r.commissionPaidDate || '',
                      'Collected in KSA': r.collectedBySalesPerson ? 'Yes' : 'No',
                      'Collected Date': r.collectedDate || '',
                      'Remitted to Company': r.remittedToCompany ? 'Yes' : 'No',
                      'Remitted Date': r.remittedDate || '',
                      'Amount to Remit': r.collectedBySalesPerson ? (totals.totalSell - (r.salesPersonCommissionAmount || 0)) : 0
                    });
                  });
                });
                exportToCSV('commission-ksa-collection.csv', rows);
              }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">Export CSV</button>
            </div>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-indigo-800">{salesPersons.filter(sp => sp.active).length}</div>
                <div className="text-[10px] text-indigo-600">Active Sales Persons</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-emerald-800">{commissionData.reduce((s, d) => s + d.count, 0)}</div>
                <div className="text-[10px] text-emerald-600">Total Bookings</div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-amber-800">{grandTotalCommission.toLocaleString()}</div>
                <div className="text-[10px] text-amber-600">Total Commission</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-emerald-700">{grandTotalPaid.toLocaleString()}</div>
                <div className="text-[10px] text-emerald-600">✅ Commission Paid</div>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-rose-700">{grandTotalUnpaid.toLocaleString()}</div>
                <div className="text-[10px] text-rose-600">⚠️ Commission Owed</div>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-orange-800">{grandKsaCollected.toLocaleString()}</div>
                <div className="text-[10px] text-orange-600">🇸🇦 KSA Collected</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-red-700">{grandKsaPending.toLocaleString()}</div>
                <div className="text-[10px] text-red-600">🔄 Pending Remittance</div>
              </div>
            </div>

            {/* Summary Table */}
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-2 py-2 font-semibold text-slate-600"></th>
                    <th className="text-left px-2 py-2 font-semibold text-slate-600">Sales Person</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-600">%</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-600">Bookings</th>
                    <th className="text-right px-2 py-2 font-semibold text-slate-600">Commission</th>
                    <th className="text-right px-2 py-2 font-semibold text-slate-600">Paid</th>
                    <th className="text-right px-2 py-2 font-semibold text-slate-600">Owed</th>
                    <th className="text-right px-2 py-2 font-semibold text-orange-700 bg-orange-50">🇸🇦 KSA Collected</th>
                    <th className="text-right px-2 py-2 font-semibold text-orange-700 bg-orange-50">Kept as Comm</th>
                    <th className="text-right px-2 py-2 font-semibold text-emerald-700 bg-emerald-50">Remitted</th>
                    <th className="text-right px-2 py-2 font-semibold text-red-700 bg-red-50">⚠️ Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {commissionData.map(d => (
                    <React.Fragment key={d.sp.id}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedSP(expandedSP === d.sp.id ? null : d.sp.id)}>
                        <td className="px-2 py-2 text-slate-400">{expandedSP === d.sp.id ? '▼' : '▶'}</td>
                        <td className="px-2 py-2 font-medium">{d.sp.name}</td>
                        <td className="px-2 py-2 text-center font-mono">{d.sp.commission}%</td>
                        <td className="px-2 py-2 text-center">{d.count}</td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-amber-700">{d.totalCommission.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-600">{d.totalPaid.toLocaleString()}</td>
                        <td className={`px-2 py-2 text-right font-mono font-bold ${d.totalUnpaid > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{d.totalUnpaid.toLocaleString()}</td>
                        <td className={`px-2 py-2 text-right font-mono bg-orange-50/50 ${d.ksaCollected > 0 ? 'text-orange-700 font-bold' : 'text-slate-400'}`}>{d.ksaCollected.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right font-mono bg-orange-50/50 text-purple-700">{d.ksaCommissionKept.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right font-mono bg-emerald-50/50 text-emerald-700">{d.ksaRemitted.toLocaleString()}</td>
                        <td className={`px-2 py-2 text-right font-mono font-bold bg-red-50/50 ${d.ksaPendingRemittance > 0 ? 'text-red-700' : 'text-slate-400'}`}>{d.ksaPendingRemittance.toLocaleString()}</td>
                      </tr>
                      {/* Expanded booking details */}
                      {expandedSP === d.sp.id && d.bookings.map(r => {
                        const totals = getReservationTotals(r);
                        const commAmt = r.salesPersonCommissionAmount || 0;
                        const isPaid = r.commissionPaidToSalesPerson;
                        const isCollected = r.collectedBySalesPerson;
                        const isRemitted = r.remittedToCompany;
                        const netBookingProfit = (totals.totalSell - totals.totalBuy) - commAmt;
                        const amountToRemit = totals.totalSell - commAmt;
                        return (
                          <tr key={r.id} className={`bg-slate-50/50 hover:bg-purple-50/30 ${isCollected ? 'border-l-4 border-l-orange-400' : ''}`}>
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5" colSpan={2}>
                              <span className="font-mono text-[9px] bg-amber-50 px-1.5 py-0.5 rounded text-amber-700 font-bold">RSV-{r.id}</span>
                              <span className="ml-1 text-[10px] text-slate-600">{r.guestName} • {r.checkIn}→{r.checkOut}</span>
                              {isCollected && <span className="ml-1 text-[8px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full font-bold">🇸🇦 KSA</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center text-[10px]">{r.nights}N</td>
                            <td className="px-2 py-1.5 text-right font-mono text-[10px] font-bold text-purple-700">{commAmt.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-right">
                              {isPaid ? (
                                <span className="px-1 py-0.5 rounded-full text-[8px] font-bold bg-emerald-100 text-emerald-700">✅ {r.commissionPaidDate || ''}</span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSaveReservation) {
                                      onSaveReservation({ ...r, commissionPaidToSalesPerson: true, commissionPaidDate: new Date().toISOString().split('T')[0] });
                                      showToast(`Commission marked as paid for RSV-${r.id}`);
                                    }
                                  }}
                                  className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 cursor-pointer border border-rose-200"
                                >⚠️ Pay</button>
                              )}
                            </td>
                            <td className="px-2 py-1.5"></td>
                            {/* KSA Collection columns */}
                            <td className="px-2 py-1.5 text-right bg-orange-50/30">
                              {isCollected ? (
                                <span className="font-mono text-[10px] text-orange-700 font-bold">{totals.totalSell.toLocaleString()}</span>
                              ) : (
                                <span className="text-[8px] text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right bg-orange-50/30">
                              {isCollected && <span className="font-mono text-[10px] text-purple-700">{commAmt.toLocaleString()}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right bg-emerald-50/30">
                              {isCollected ? (
                                isRemitted ? (
                                  <span className="px-1 py-0.5 rounded-full text-[8px] font-bold bg-emerald-100 text-emerald-700">✅ {r.remittedDate || ''}</span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onSaveReservation) {
                                        onSaveReservation({ ...r, remittedToCompany: true, remittedDate: new Date().toISOString().split('T')[0] });
                                        showToast(`Remittance of ${amountToRemit.toLocaleString()} SAR marked as received for RSV-${r.id}`);
                                      }
                                    }}
                                    className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer border border-orange-200"
                                  >🔄 Mark Remitted</button>
                                )
                              ) : (
                                <span className="text-[8px] text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right bg-red-50/30">
                              {isCollected && !isRemitted ? (
                                <span className="font-mono text-[10px] text-red-700 font-bold">{amountToRemit.toLocaleString()}</span>
                              ) : (
                                <span className="text-[8px] text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                  {commissionData.length === 0 && <tr><td colSpan={11} className="text-center py-8 text-slate-400">No sales persons configured</td></tr>}
                </tbody>
              </table>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-[10px] text-slate-600 bg-slate-50 p-3 rounded-lg">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></span>🇸🇦 KSA Collected = Sales person collected full sell amount from client</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></span>Kept = Commission kept by sales person from collection</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span>⚠️ Pending = Amount sales person still owes to company</span>
            </div>
          </div>
        );
      })()}

      {/* ==================== SEASON ANALYTICS ==================== */}
      {activeReportTab === 'seasonAnalytics' && (() => {
        const activeRes = reservations.filter(r => r.status !== 'Cancelled');
        const months: Record<string, { label: string; revenue: number; cost: number; profit: number; bookings: number; nights: number }> = {};
        const hotelPerf: Record<string, { name: string; revenue: number; cost: number; bookings: number }> = {};
        const sourceStats: Record<string, { count: number; revenue: number }> = {};
        activeRes.forEach(r => {
          const month = r.checkIn.substring(0, 7);
          if (!months[month]) {
            const d = new Date(month + '-01');
            months[month] = { label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), revenue: 0, cost: 0, profit: 0, bookings: 0, nights: 0 };
          }
          const tot = getReservationTotals(r);
          months[month].revenue += tot.totalSell;
          months[month].cost += tot.totalBuy;
          months[month].profit += tot.profit;
          months[month].bookings++;
          months[month].nights += r.nights;
          const hotel = hotels.find(h => h.id === r.hotelId);
          const hName = hotel?.name || 'Unknown';
          if (!hotelPerf[hName]) hotelPerf[hName] = { name: hName, revenue: 0, cost: 0, bookings: 0 };
          hotelPerf[hName].revenue += tot.totalSell;
          hotelPerf[hName].cost += tot.totalBuy;
          hotelPerf[hName].bookings++;
          const src = r.bookingSource || 'Unknown';
          if (!sourceStats[src]) sourceStats[src] = { count: 0, revenue: 0 };
          sourceStats[src].count++;
          sourceStats[src].revenue += tot.totalSell;
        });
        const sortedMonths = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
        const sortedHotels = Object.values(hotelPerf).sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost));
        const sortedSources = Object.entries(sourceStats).sort(([, a], [, b]) => b.revenue - a.revenue);
        const maxRevenue = Math.max(...sortedMonths.map(([, m]) => m.revenue), 1);
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Season & Period Pricing Analytics</h3>
            <div className="bg-white border rounded-xl p-4">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">Monthly Revenue & Profit</h4>
              <div className="space-y-1">
                {sortedMonths.map(([key, m]) => (
                  <div key={key} className="flex items-center gap-2 text-[10px]">
                    <span className="w-14 text-slate-500 font-mono flex-shrink-0">{m.label}</span>
                    <div className="flex-1 flex gap-0.5">
                      <div className="h-4 bg-indigo-400 rounded-sm" style={{ width: `${(m.revenue / maxRevenue) * 100}%` }} title={`Revenue: ${m.revenue.toLocaleString()}`} />
                      <div className="h-4 bg-emerald-400 rounded-sm" style={{ width: `${(m.profit / maxRevenue) * 100}%` }} title={`Profit: ${m.profit.toLocaleString()}`} />
                    </div>
                    <span className="w-24 text-right font-mono text-slate-600 flex-shrink-0">{m.revenue.toLocaleString()}</span>
                    <span className="w-16 text-right font-mono text-emerald-600 flex-shrink-0">{m.profit.toLocaleString()}</span>
                    <span className="w-10 text-right text-slate-400 flex-shrink-0">{m.bookings}B</span>
                  </div>
                ))}
                {sortedMonths.length === 0 && <div className="text-center py-4 text-slate-400">No data</div>}
              </div>
              <div className="flex gap-4 mt-2 text-[9px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-400 rounded-sm inline-block" /> Revenue</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded-sm inline-block" /> Profit</span>
              </div>
            </div>
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50"><h4 className="font-semibold text-slate-700 text-sm">Top Hotels by Profit</h4></div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50/50"><tr><th className="text-left px-3 py-2">Hotel</th><th className="text-center px-3 py-2">Bookings</th><th className="text-right px-3 py-2">Revenue</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Margin %</th></tr></thead>
                <tbody className="divide-y">
                  {sortedHotels.slice(0, 10).map(h => (
                    <tr key={h.name} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{h.name}</td>
                      <td className="px-3 py-2 text-center">{h.bookings}</td>
                      <td className="px-3 py-2 text-right font-mono">{h.revenue.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{h.cost.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">{h.revenue > 0 ? (((h.revenue - h.cost) / h.revenue) * 100).toFixed(1) : '0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">Booking Source Distribution</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {sortedSources.map(([src, stats]) => (
                  <div key={src} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="font-semibold text-slate-700 text-sm">{src}</div>
                    <div className="text-[10px] text-slate-500">{stats.count} bookings &bull; {stats.revenue.toLocaleString()} SAR</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== SUPPLIER PAYMENT SCHEDULER ==================== */}
      {activeReportTab === 'supplierPayments' && (() => {
        const suppliers = agents.filter(a => a.type === 'Supplier' || a.type === 'Both');
        const todayStr = new Date().toISOString().split('T')[0];
        const activeRes = reservations.filter(r => r.status !== 'Cancelled');
        const supplierData = suppliers.map(sup => {
          const supBookings = activeRes.filter(r => r.supplierId === sup.id);
          const totalDue = supBookings.reduce((sum, r) => sum + getReservationTotals(r).totalBuy, 0);
          const totalPaid = supBookings.reduce((sum, r) => sum + (r.amountPaidToSupplier || 0), 0);
          const outstanding = totalDue - totalPaid;
          const dueSoon = supBookings.filter(r => r.supplierDueDate && r.supplierDueDate <= todayStr && getReservationTotals(r).totalBuy > (r.amountPaidToSupplier || 0));
          return { sup, totalDue, totalPaid, outstanding, dueSoon: dueSoon.length, bookings: supBookings.length };
        }).filter(d => d.bookings > 0);
        const grandOutstanding = supplierData.reduce((s, d) => s + d.outstanding, 0);
        const overdueCount = supplierData.reduce((s, d) => s + d.dueSoon, 0);
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Supplier Payment Scheduler</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-rose-800">{overdueCount}</div>
                <div className="text-[10px] text-rose-600">Overdue Payments</div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-amber-800">{grandOutstanding.toLocaleString()}</div>
                <div className="text-[10px] text-amber-600">Total Outstanding (SAR)</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-emerald-800">{supplierData.length}</div>
                <div className="text-[10px] text-emerald-600">Active Suppliers</div>
              </div>
            </div>
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Supplier</th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600">Bookings</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600">Total Due</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600">Paid</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600">Outstanding</th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {supplierData.sort((a, b) => b.outstanding - a.outstanding).map(d => (
                    <tr key={d.sup.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{d.sup.name}</td>
                      <td className="px-3 py-2 text-center">{d.bookings}</td>
                      <td className="px-3 py-2 text-right font-mono">{d.totalDue.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">{d.totalPaid.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${d.outstanding > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{d.outstanding.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">{d.dueSoon > 0 ? <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">{d.dueSoon}</span> : '-'}</td>
                    </tr>
                  ))}
                  {supplierData.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No supplier data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ==================== CANCELLATION ANALYSIS TAB ==================== */}
      {activeReportTab === 'cancellationAnalysis' && (() => {
        const cancelled = reservations.filter(r => r.status === 'Cancelled');
        const totalRes = reservations.length || 1;
        const cancelRate = ((cancelled.length / totalRes) * 100).toFixed(1);

        // Cancellation rate by agent
        const agentCancelMap: Record<string, { total: number; cancelled: number }> = {};
        reservations.forEach(r => {
          if (!agentCancelMap[r.clientId]) agentCancelMap[r.clientId] = { total: 0, cancelled: 0 };
          agentCancelMap[r.clientId].total++;
          if (r.status === 'Cancelled') agentCancelMap[r.clientId].cancelled++;
        });
        const agentCancelData = Object.entries(agentCancelMap)
          .map(([id, d]) => ({
            agent: agents.find(a => a.id === id)?.companyName || agents.find(a => a.id === id)?.name || 'Unknown',
            total: d.total,
            cancelled: d.cancelled,
            rate: d.total > 0 ? ((d.cancelled / d.total) * 100).toFixed(1) : '0',
          }))
          .sort((a, b) => b.cancelled - a.cancelled);

        // Reasons breakdown
        const reasonMap: Record<string, number> = {};
        cancelled.forEach(r => {
          const reason = r.cancellationReason || 'No reason given';
          reasonMap[reason] = (reasonMap[reason] || 0) + 1;
        });
        const reasonData = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);

        // Timing analysis (days before check-in)
        const timingBuckets: Record<string, number> = { '0-3 days': 0, '4-7 days': 0, '8-14 days': 0, '15-30 days': 0, '30+ days': 0 };
        cancelled.forEach(r => {
          const created = new Date(r.createdAt);
          const checkIn = new Date(r.checkIn);
          const daysBefore = Math.max(0, Math.round((checkIn.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
          if (daysBefore <= 3) timingBuckets['0-3 days']++;
          else if (daysBefore <= 7) timingBuckets['4-7 days']++;
          else if (daysBefore <= 14) timingBuckets['8-14 days']++;
          else if (daysBefore <= 30) timingBuckets['15-30 days']++;
          else timingBuckets['30+ days']++;
        });

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Cancellations</div>
                <div className="text-2xl font-black text-rose-700">{cancelled.length}</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Cancellation Rate</div>
                <div className="text-2xl font-black text-amber-700">{cancelRate}%</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Cancel Fees</div>
                <div className="text-2xl font-black text-emerald-700">{cancelled.reduce((s, r) => s + (r.cancellationFee || 0), 0).toLocaleString()} SAR</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Reasons Tracked</div>
                <div className="text-2xl font-black text-indigo-700">{reasonData.length}</div>
              </div>
            </div>

            {/* Cancellation by Agent */}
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b font-bold text-slate-700">Cancellation Rate by Agent</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Agent</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Total Bookings</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Cancelled</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {agentCancelData.slice(0, 15).map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{d.agent}</td>
                        <td className="px-3 py-2 text-center">{d.total}</td>
                        <td className="px-3 py-2 text-center text-rose-700 font-bold">{d.cancelled}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${Number(d.rate) > 30 ? 'bg-rose-100 text-rose-700' : Number(d.rate) > 15 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{d.rate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reasons Breakdown */}
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b font-bold text-slate-700">Cancellation Reasons</div>
                <div className="divide-y">
                  {reasonData.map(([reason, count], i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 flex-1 truncate mr-2">{reason}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${(count / cancelled.length) * 100}%` }} />
                        </div>
                        <span className="font-bold text-rose-700 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                  {reasonData.length === 0 && <div className="px-4 py-8 text-center text-slate-400">No cancellation data</div>}
                </div>
              </div>

              {/* Timing Analysis */}
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b font-bold text-slate-700">Timing Analysis (Days Before Check-In)</div>
                <div className="divide-y">
                  {Object.entries(timingBuckets).map(([bucket, count]) => (
                    <div key={bucket} className="px-4 py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{bucket}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${cancelled.length > 0 ? (count / cancelled.length) * 100 : 0}%` }} />
                        </div>
                        <span className="font-bold text-amber-700 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => {
              const data = cancelled.map(r => ({
                'RSV#': r.id, 'Guest': r.guestName, 'Agent': agents.find(a => a.id === r.clientId)?.companyName || '',
                'Check-In': r.checkIn, 'Cancelled At': r.createdAt, 'Reason': r.cancellationReason || '',
                'Fee': r.cancellationFee || 0
              }));
              exportToCSV('cancellation-analysis.csv', data);
              showToast('Cancellation analysis exported');
            }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              📥 Export Analysis CSV
            </button>
          </div>
        );
      })()}

      {/* ==================== SUPPLIER SCORECARD TAB ==================== */}
      {activeReportTab === 'supplierScorecard' && (() => {
        const suppliers = agents.filter(a => a.type === 'Supplier' || a.type === 'Both');
        const scorecardData = suppliers.map(sup => {
          const supRes = reservations.filter(r => r.supplierId === sup.id);
          const confirmed = supRes.filter(r => r.status === 'Confirmed').length;
          const cancelled = supRes.filter(r => r.status === 'Cancelled').length;
          const totalSell = supRes.reduce((s, r) => s + getReservationTotals(r).totalSell, 0);
          const totalBuy = supRes.reduce((s, r) => s + getReservationTotals(r).totalBuy, 0);
          const markup = totalBuy > 0 ? ((totalSell - totalBuy) / totalBuy * 100) : 0;
          const confirmRate = supRes.length > 0 ? (confirmed / supRes.length * 100) : 0;
          const cancelRate = supRes.length > 0 ? (cancelled / supRes.length * 100) : 0;
          const outstanding = totalBuy - (supRes.reduce((s, r) => s + (r.amountPaidToSupplier || 0), 0));
          const score = Math.round(
            (confirmRate * 0.3) +
            ((100 - cancelRate) * 0.2) +
            (markup > 0 ? Math.min(markup, 30) * 1.5 : 0) +
            (supRes.length > 0 ? Math.min(supRes.length, 20) * 1 : 0)
          );
          return {
            id: sup.id, name: sup.companyName || sup.name,
            bookings: supRes.length, confirmed, cancelled,
            markup: markup.toFixed(1), confirmRate: confirmRate.toFixed(1),
            cancelRate: cancelRate.toFixed(1), totalBuy, outstanding, score
          };
        }).sort((a, b) => b.score - a.score);

        return (
          <div className="space-y-4">
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-amber-100 border-b font-bold text-amber-800 flex items-center gap-2">
                🏆 Supplier Performance Scorecard
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">#</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Supplier</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Score</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Bookings</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Confirm %</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Cancel %</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Markup %</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Total Buy</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {scorecardData.map((d, i) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-bold text-amber-600">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{d.name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded-full font-black ${d.score >= 60 ? 'bg-emerald-100 text-emerald-800' : d.score >= 30 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                            {d.score}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{d.bookings}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${Number(d.confirmRate) >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>{d.confirmRate}%</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${Number(d.cancelRate) <= 10 ? 'text-emerald-700' : 'text-rose-700'}`}>{d.cancelRate}%</span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono">{d.markup}%</td>
                        <td className="px-3 py-2 text-right font-mono">{d.totalBuy.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${d.outstanding > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{d.outstanding.toLocaleString()}</td>
                      </tr>
                    ))}
                    {scorecardData.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No supplier data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <button onClick={() => {
              exportToCSV('supplier-scorecard.csv', scorecardData.map(d => ({
                'Rank': scorecardData.indexOf(d) + 1, 'Supplier': d.name, 'Score': d.score,
                'Bookings': d.bookings, 'Confirm Rate %': d.confirmRate, 'Cancel Rate %': d.cancelRate,
                'Markup %': d.markup, 'Total Buy': d.totalBuy, 'Outstanding': d.outstanding
              })));
              showToast('Supplier scorecard exported');
            }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              📥 Export Scorecard CSV
            </button>
          </div>
        );
      })()}

      {/* ==================== ACCOUNTING EXPORT TAB ==================== */}
      {activeReportTab === 'accountingExport' && (() => {
        const filteredTxns = transactions.filter(tx => tx.date >= fromDate && tx.date <= toDate);
        const exportRows = filteredTxns.map(tx => {
          const agent = agents.find(a => a.id === tx.agentId);
          let type = 'Journal';
          let account = 'General';
          if (tx.type === 'ClientPayment') { type = 'Receipt'; account = 'Accounts Receivable'; }
          else if (tx.type === 'SupplierPayment') { type = 'Bill Payment'; account = 'Accounts Payable'; }
          else if (tx.type === 'ClientRefund') { type = 'Refund'; account = 'Accounts Receivable'; }
          else if (tx.type === 'SupplierRefund') { type = 'Refund'; account = 'Accounts Payable'; }
          else if (tx.type === 'Transfer') { type = 'Transfer'; account = 'Bank'; }
          return {
            'Date': tx.date,
            'Type': type,
            'Description': tx.description || `${tx.type} - ${agent?.companyName || agent?.name || ''}`,
            'Amount': tx.amount,
            'Account': account,
            'Reference': tx.voucherNo || tx.docNo,
            'Currency': tx.originalCurrency || 'SAR',
            'Payment Method': tx.paymentMethod,
          };
        });
        const totalAmount = filteredTxns.reduce((s, tx) => s + tx.amount, 0);

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Transactions</div>
                <div className="text-2xl font-black text-slate-800">{filteredTxns.length}</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Amount</div>
                <div className="text-2xl font-black text-emerald-700">{totalAmount.toLocaleString()} SAR</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Period</div>
                <div className="text-xs font-mono text-slate-700 mt-1">{fromDate} to {toDate}</div>
              </div>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b font-bold text-slate-700 flex items-center justify-between">
                <span>Transaction Preview (QuickBooks/Xero Compatible)</span>
                <span className="text-[10px] text-slate-400">{exportRows.length} rows</span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Type</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Amount</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Account</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Reference</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Currency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {exportRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{row['Date']}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[9px]">{row['Type']}</span></td>
                        <td className="px-3 py-2 max-w-xs truncate">{row['Description']}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{Number(row['Amount']).toLocaleString()}</td>
                        <td className="px-3 py-2">{row['Account']}</td>
                        <td className="px-3 py-2 font-mono text-[10px]">{row['Reference']}</td>
                        <td className="px-3 py-2">{row['Currency']}</td>
                      </tr>
                    ))}
                    {exportRows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No transactions in this period</td></tr>}
                  </tbody>
                </table>
              </div>
              {exportRows.length > 50 && <div className="px-4 py-2 bg-amber-50 text-amber-700 text-[10px] font-bold">Showing first 50 of {exportRows.length} rows. Export to see all.</div>}
            </div>

            <button onClick={() => {
              exportToCSV(`accounting-export-${fromDate}-to-${toDate}.csv`, exportRows);
              showToast('Accounting export downloaded');
            }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
              📥 Export to QuickBooks/Xero CSV
            </button>
          </div>
        );
      })()}

      {/* ==================== CLIENT LIFETIME VALUE TAB ==================== */}
      {activeReportTab === 'clientLifetimeValue' && (() => {
        const clients = agents.filter(a => a.type === 'Customer' || a.type === 'Both');
        const clvData = clients.map(client => {
          const clientRes = reservations.filter(r => r.clientId === client.id);
          const confirmed = clientRes.filter(r => r.status === 'Confirmed').length;
          const cancelled = clientRes.filter(r => r.status === 'Cancelled').length;
          const totalRevenue = clientRes.reduce((s, r) => s + getReservationTotals(r).totalSell, 0);
          const totalProfit = clientRes.reduce((s, r) => { const t = getReservationTotals(r); return s + (t.totalSell - t.totalBuy); }, 0);
          const avgBookingValue = confirmed > 0 ? totalRevenue / confirmed : 0;
          const lastBooking = clientRes.length > 0 ? clientRes.reduce((latest, r) => r.createdAt > latest.createdAt ? r : latest, clientRes[0]).createdAt : '';
          const outstanding = getAgentActualBalance(client, reservations, transactions);
          return {
            id: client.id, name: client.companyName || client.name,
            totalBookings: clientRes.length, confirmed, cancelled,
            totalRevenue, totalProfit, avgBookingValue,
            lastBookingDate: lastBooking.split('T')[0],
            outstanding: Math.abs(outstanding),
            confirmRatio: clientRes.length > 0 ? (confirmed / clientRes.length * 100).toFixed(0) : '0',
          };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Clients</div>
                <div className="text-2xl font-black text-indigo-700">{clvData.length}</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">All-Time Revenue</div>
                <div className="text-2xl font-black text-emerald-700">{clvData.reduce((s, d) => s + d.totalRevenue, 0).toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">All-Time Profit</div>
                <div className="text-2xl font-black text-amber-700">{clvData.reduce((s, d) => s + d.totalProfit, 0).toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Outstanding</div>
                <div className="text-2xl font-black text-rose-700">{clvData.reduce((s, d) => s + d.outstanding, 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-indigo-100 border-b font-bold text-indigo-800 flex items-center gap-2">
                👑 Client Lifetime Value (Sorted by Revenue)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">#</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Client</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Bookings</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Confirmed</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">Cancelled</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Total Revenue</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Avg Booking</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Total Profit</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Last Booking</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clvData.map((d, i) => (
                      <tr key={d.id} className={`hover:bg-gray-50 ${i < 3 ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-3 py-2 font-bold text-amber-600">{i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</td>
                        <td className="px-3 py-2 font-medium">{d.name}</td>
                        <td className="px-3 py-2 text-center">{d.totalBookings}</td>
                        <td className="px-3 py-2 text-center text-emerald-700 font-bold">{d.confirmed}</td>
                        <td className="px-3 py-2 text-center text-rose-700">{d.cancelled}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{d.totalRevenue.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono">{Math.round(d.avgBookingValue).toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${d.totalProfit >= 0 ? 'text-amber-700' : 'text-rose-700'}`}>{d.totalProfit.toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-500">{d.lastBookingDate || '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${d.outstanding > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{d.outstanding.toLocaleString()}</td>
                      </tr>
                    ))}
                    {clvData.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-slate-400">No client data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={() => {
              exportToCSV('client-lifetime-value.csv', clvData.map((d, i) => ({
                'Rank': i + 1, 'Client': d.name, 'Total Bookings': d.totalBookings,
                'Confirmed': d.confirmed, 'Cancelled': d.cancelled,
                'Total Revenue': d.totalRevenue, 'Avg Booking Value': Math.round(d.avgBookingValue),
                'Total Profit': d.totalProfit, 'Last Booking': d.lastBookingDate, 'Outstanding': d.outstanding
              })));
              showToast('Client LTV report exported');
            }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              📥 Export Client LTV CSV
            </button>
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
          hotels={hotels}
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
          hotels={hotels}
          fromDate={fromDate}
          toDate={toDate}
          isSupplier={true}
          onClose={() => setPrintingStatementReport(false)}
        />
      )}

    </div>
  );
}
