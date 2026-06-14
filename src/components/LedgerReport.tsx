/**
 * Financial Ledger Report — Source of truth for all revenue and commissions.
 * Shows chronological list of every financial entry with debit/credit/balance.
 */
import React, { useState, useMemo } from 'react';
import { Reservation, Transaction, Agent, Expense, Hotel } from '../types';
import { getReservationTotals, exportToExcel } from '../lib/storage';
import { exportPDF, compressImagesForPrint } from '../lib/pdfGenerator';
import { useLang } from '../lib/LanguageContext';

interface LedgerReportProps {
  reservations: Reservation[];
  transactions: Transaction[];
  agents: Agent[];
  hotels: Hotel[];
  expenses: Expense[];
  onNavigate?: (page: string, filters?: any) => void;
}

interface LedgerEntry {
  date: string;
  refId: string;
  refType: 'reservation' | 'expense' | 'transaction';
  description: string;
  debit: number;
  credit: number;
  netProfitImpact: number;
  reservationId?: string;
  hotelId?: string;
  clientId?: string;
}

export default function LedgerReport({ reservations, transactions, agents, hotels, expenses, onNavigate }: LedgerReportProps) {
  const { lang } = useLang();
  const [dateFrom, setDateFrom] = useState('2024-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [filterHotel, setFilterHotel] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Build chronological ledger entries
  const entries = useMemo(() => {
    const ledger: LedgerEntry[] = [];
    // STRICT: Only Confirmed bookings enter the Financial Ledger (Tentative & Cancelled excluded)
    const activeReservations = reservations.filter(r => r.status === 'Confirmed');

    // 1. Reservation Gross Revenue entries (credit = totalSell)
    activeReservations.forEach(r => {
      if (r.checkIn < dateFrom || r.checkIn > dateTo) return;
      if (filterHotel && r.hotelId !== filterHotel) return;
      if (filterClient && r.clientId !== filterClient) return;
      const totals = getReservationTotals(r);
      const guest = r.guestName || 'Guest';
      const hotelName = hotels.find(h => h.id === r.hotelId)?.name || '';
      ledger.push({
        date: r.createdAt.split(' ')[0],
        refId: `RSV-${r.id}`,
        refType: 'reservation',
        description: `Reservation Gross — ${guest} @ ${hotelName} (${r.checkIn} → ${r.checkOut})`,
        debit: 0,
        credit: totals.totalSell,
        netProfitImpact: totals.netProfit,
        reservationId: r.id.toString(),
        hotelId: r.hotelId,
        clientId: r.clientId,
      });

      // Supplier Cost entry (debit = totalBuy)
      ledger.push({
        date: r.createdAt.split(' ')[0],
        refId: `RSV-${r.id}`,
        refType: 'reservation',
        description: `Supplier Cost — ${guest} @ ${hotelName}`,
        debit: totals.totalBuy,
        credit: 0,
        netProfitImpact: -totals.totalBuy,
        reservationId: r.id.toString(),
        hotelId: r.hotelId,
        clientId: r.clientId,
      });

      // Commission entry if applicable
      if (totals.totalCommission > 0) {
        const sp = agents.find(a => a.id === r.salesPersonId);
        const spName = sp?.name || 'Sales Person';
        ledger.push({
          date: r.createdAt.split(' ')[0],
          refId: `RSV-${r.id}`,
          refType: 'reservation',
          description: `Sales Commission — ${spName} (${(r.rooms || []).reduce((s, rm) => s + rm.qty, 0)} rooms × ${r.nights} nights)`,
          debit: totals.totalCommission,
          credit: 0,
          netProfitImpact: -totals.totalCommission,
          reservationId: r.id.toString(),
          hotelId: r.hotelId,
          clientId: r.clientId,
        });
      }
    });

    // 2. Cancelled reservation reversals
    reservations.filter(r => r.status === 'Cancelled').forEach(r => {
      if (r.checkIn < dateFrom || r.checkIn > dateTo) return;
      if (filterHotel && r.hotelId !== filterHotel) return;
      if (filterClient && r.clientId !== filterClient) return;
      const clientPaid = r.amountPaidByClient || 0;
      const supplierPaid = r.amountPaidToSupplier || 0;
      if (clientPaid > 0 || supplierPaid > 0) {
        ledger.push({
          date: r.createdAt.split(' ')[0],
          refId: `RSV-${r.id}`,
          refType: 'reservation',
          description: `Cancellation Reversal — ${r.guestName || 'Guest'} (Client paid: ${clientPaid}, Supplier paid: ${supplierPaid})`,
          debit: clientPaid,
          credit: supplierPaid > 0 ? supplierPaid : 0,
          netProfitImpact: -(clientPaid - supplierPaid),
          reservationId: r.id.toString(),
          hotelId: r.hotelId,
          clientId: r.clientId,
        });
      }
    });

    // 3. Expense entries (debit)
    expenses.forEach(exp => {
      if (exp.date < dateFrom || exp.date > dateTo) return;
      ledger.push({
        date: exp.date,
        refId: `EXP-${exp.expenseNumber}`,
        refType: 'expense',
        description: `Expense — ${exp.name} (${exp.category})`,
        debit: exp.amount,
        credit: 0,
        netProfitImpact: -exp.amount,
      });
    });

    // Sort chronologically (oldest first for running balance)
    ledger.sort((a, b) => a.date.localeCompare(b.date) || a.refId.localeCompare(b.refId));

    // Compute running balance
    let runningBalance = 0;
    return ledger.map(e => {
      runningBalance += (e.credit - e.debit);
      return { ...e, runningBalance: Math.round(runningBalance * 100) / 100 };
    });
  }, [reservations, expenses, dateFrom, dateTo, filterHotel, filterClient, agents, hotels]);

  // Summary totals
  const summary = useMemo(() => {
    const totalCredits = entries.reduce((s, e) => s + e.credit, 0);
    const totalDebits = entries.reduce((s, e) => s + e.debit, 0);
    const totalCommissions = entries.filter(e => e.description.includes('Sales Commission')).reduce((s, e) => s + e.debit, 0);
    const grossRevenue = entries.filter(e => e.description.includes('Reservation Gross')).reduce((s, e) => s + e.credit, 0);
    const supplierCost = entries.filter(e => e.description.includes('Supplier Cost')).reduce((s, e) => s + e.debit, 0);
    const totalExpenses = expenses.filter(e => e.date >= dateFrom && e.date <= dateTo).reduce((s, e) => s + e.amount, 0);
    const netProfit = grossRevenue - supplierCost - totalCommissions - totalExpenses;
    return { totalCredits, totalDebits, totalCommissions, grossRevenue, supplierCost, netProfit, totalExpenses };
  }, [entries, expenses, dateFrom, dateTo]);

  const formatMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const handleExportExcel = () => {
    const rows = entries.map(e => ({
      'Date': e.date,
      'Reference ID': e.refId,
      'Description': e.description,
      'Debit (SAR)': e.debit,
      'Credit (SAR)': e.credit,
      'Margin to Date (SAR)': e.runningBalance,
      'Net Profit Impact (SAR)': e.netProfitImpact,
    }));
    exportToExcel(`Ledger_Report_${dateFrom}_to_${dateTo}`, rows, 'Ledger');
  };

  const handleExportPDF = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      compressImagesForPrint('ledger-print-area');
      const success = await exportPDF('ledger-print-area', `Ledger_Report_${dateFrom}_to_${dateTo}.pdf`, { landscape: true });
      if (!success) alert('PDF generation failed. Please try again.');
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleRefClick = (entry: LedgerEntry) => {
    if (entry.refType === 'reservation' && entry.reservationId && onNavigate) {
      onNavigate('Reservations', { searchId: entry.reservationId });
    }
  };

  const clients = useMemo(() =>
    agents.filter(a => a.type === 'Customer' || a.type === 'Both').sort((a, b) => a.name.localeCompare(b.name)),
    [agents]
  );

  return (
    <div className="page-container space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">📒 Financial Ledger Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">Chronological source of truth for all revenue, costs, and commissions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition">
            📊 Export Excel
          </button>
          <button onClick={handleExportPDF} disabled={isPrinting} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-50">
            {isPrinting ? '⏳ Generating...' : '📄 Export PDF'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="block text-xs border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="block text-xs border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Hotel</label>
          <select value={filterHotel} onChange={e => setFilterHotel(e.target.value)} className="block text-xs border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5 min-w-[160px]">
            <option value="">All Hotels</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Client</label>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="block text-xs border border-slate-200 rounded-lg px-2 py-1.5 mt-0.5 min-w-[160px]">
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => { setDateFrom('2024-01-01'); setDateTo('2026-12-31'); setFilterHotel(''); setFilterClient(''); }}
            className="text-xs text-slate-500 hover:text-slate-700 font-bold px-2 py-1.5 border border-slate-200 rounded-lg transition">
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-blue-600 uppercase">Gross Revenue</div>
          <div className="text-lg font-bold text-blue-800">{formatMoney(summary.grossRevenue)}</div>
          <div className="text-[10px] text-blue-500">SAR</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-orange-600 uppercase">Supplier Cost</div>
          <div className="text-lg font-bold text-orange-800">{formatMoney(summary.supplierCost)}</div>
          <div className="text-[10px] text-orange-500">SAR</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-amber-600 uppercase">Commissions</div>
          <div className="text-lg font-bold text-amber-800">{formatMoney(summary.totalCommissions)}</div>
          <div className="text-[10px] text-amber-500">SAR</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-rose-600 uppercase">Expenses</div>
          <div className="text-lg font-bold text-rose-800">{formatMoney(summary.totalExpenses)}</div>
          <div className="text-[10px] text-rose-500">SAR</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-emerald-600 uppercase">Net Profit</div>
          <div className="text-lg font-bold text-emerald-800">{formatMoney(summary.netProfit)}</div>
          <div className="text-[10px] text-emerald-500">Rev - Cost - Comm - Exp</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-600 uppercase">Total Entries</div>
          <div className="text-lg font-bold text-slate-800">{entries.length}</div>
          <div className="text-[10px] text-slate-500">ledger lines</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-purple-600 uppercase">Net Margin</div>
          <div className="text-lg font-bold text-purple-800">
            {summary.grossRevenue > 0 ? ((summary.netProfit / summary.grossRevenue) * 100).toFixed(1) : '0.0'}%
          </div>
          <div className="text-[10px] text-purple-500">after all deductions</div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div id="ledger-print-area">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference ID</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                  <th className="py-2.5 px-3 text-right">Margin to Date</th>
                  <th className="py-2.5 px-3 text-right">Net Profit Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e, idx) => (
                  <tr key={`${e.refId}-${idx}`} className="hover:bg-slate-50/50 text-xs">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{e.date}</td>
                    <td className="py-2.5 px-3">
                      {e.refType === 'reservation' ? (
                        <button
                          onClick={() => handleRefClick(e)}
                          className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          {e.refId}
                        </button>
                      ) : (
                        <span className="font-mono font-bold text-slate-700">{e.refId}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">{e.description}</td>
                    <td className={`py-2.5 px-3 text-right font-mono ${e.debit > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {e.debit > 0 ? e.debit.toLocaleString() : '—'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono ${e.credit > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {e.credit > 0 ? e.credit.toLocaleString() : '—'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold text-[10px] ${e.runningBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {e.runningBalance.toLocaleString()}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold text-[10px] ${e.netProfitImpact > 0 ? 'text-emerald-700' : e.netProfitImpact < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {e.netProfitImpact > 0 ? '+' : ''}{e.netProfitImpact.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="py-3 px-3 text-slate-700" colSpan={3}>TOTALS</td>
                  <td className="py-3 px-3 text-right font-mono text-red-700">{summary.totalDebits.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700">{summary.totalCredits.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-800">
                    {(summary.totalCredits - summary.totalDebits).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-800">{summary.netProfit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        {entries.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-3xl mb-2">📒</div>
            <p className="text-sm font-medium">No ledger entries found for the selected filters</p>
            <p className="text-xs mt-1">Adjust the date range or clear filters to see data</p>
          </div>
        )}
      </div>

      {/* Integrity Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500">
        <strong>Financial Integrity:</strong> Net Profit = Gross Revenue ({formatMoney(summary.grossRevenue)}) − Supplier Cost ({formatMoney(summary.supplierCost)}) − Commission ({formatMoney(summary.totalCommissions)}) − Expenses ({formatMoney(summary.totalExpenses)}) = <strong className="text-emerald-700">{formatMoney(summary.netProfit)} SAR</strong>
        <br />
        <strong>Note:</strong> Only <strong>Confirmed</strong> bookings appear in the ledger. Tentative and Cancelled bookings are excluded from financial statements.
        <br />
        Click any <span className="text-indigo-600 font-bold">RSV-#</span> reference to navigate directly to that reservation.
      </div>
    </div>
  );
}
