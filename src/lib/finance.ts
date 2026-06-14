/**
 * FinanceService — Single Source of Truth for all financial mutations.
 *
 * Every financial action (payment, cancellation, refund) flows through
 * this module to ensure data consistency, audit traceability, and
 * double-entry verification across the entire application.
 */
import { Reservation, Transaction, Agent, Account, OtherService } from '../types';
import { getReservationTotals, getNextVoucherNo, getNextDocNo } from './storage';

// ─── Base Currency ─────────────────────────────────────────────────
// All general ledger aggregations (Balance Sheet, Income Statement,
// Under Collection, account balances) are strictly normalized to this currency.
export const BASE_CURRENCY = 'SAR';

// ─── Utility Math Functions ──────────────────────────────────────────
export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const safeAdd = (a: number, b: number): number => round2(a + b);
export const safeSubtract = (a: number, b: number): number => round2(a - b);
export const sumAmounts = (amounts: number[]): number => amounts.reduce((s, v) => safeAdd(s, v || 0), 0);
export const absAmount = (n: number): number => Math.abs(round2(n || 0));
export const amountsEqual = (a: number, b: number): boolean => Math.abs(round2(a) - round2(b)) < 0.01;

// ─── Multi-Currency Normalization Utility ─────────────────────────
// Single function for all currency conversions across the app.
// Prevents inline math and ensures consistent rounding.
export function calculateBaseCurrency(
  amount: number,
  rate: number,
  currency: string
): { transactionAmount: number; transactionCurrency: string; exchangeRate: number; baseAmountSAR: number } {
  if (currency === BASE_CURRENCY || !rate || rate <= 0) {
    return { transactionAmount: round2(amount), transactionCurrency: BASE_CURRENCY, exchangeRate: 1, baseAmountSAR: round2(amount) };
  }
  // rate = units of foreign currency per 1 SAR (e.g. 14 EGP per 1 SAR)
  const baseAmountSAR = round2(amount / rate);
  return { transactionAmount: round2(amount), transactionCurrency: currency, exchangeRate: rate, baseAmountSAR };
}

// Compute original-currency balance for a specific account from transaction history.
// Returns a map of { currency: balance } for all currencies that flowed through this account.
export function computeAccountCurrencyBalances(
  accountId: string,
  transactions: Transaction[]
): Record<string, number> {
  const balances: Record<string, number> = {};
  transactions.forEach(tr => {
    if (tr.fromAccountId !== accountId) return;
    const curr = tr.originalCurrency || BASE_CURRENCY;
    const origAmt = tr.originalAmount || tr.amount;
    let modifier = 0;
    if (tr.type === 'ClientPayment') modifier = origAmt;        // money IN
    else if (tr.type === 'SupplierPayment') modifier = -origAmt; // money OUT
    else if (tr.type === 'ClientRefund') modifier = -origAmt;    // money OUT (refund to client)
    else if (tr.type === 'SupplierRefund') modifier = origAmt;   // money IN (supplier returned)
    else if (tr.type === 'CreditApplied') modifier = -origAmt;
    balances[curr] = safeAdd(balances[curr] || 0, modifier);
  });
  return balances;
}

// ─── Types ───────────────────────────────────────────────────────────
export interface FinanceResult {
  transactions: Transaction[];
  reservations: Reservation[];
  agents: Agent[];
  accounts: Account[];
  auditEntries: FinanceAuditEntry[];
}

export interface FinanceAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  reservationId?: string;
  transactionId?: string;
  agentId?: string;
  amount: number;
  detail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const today = () => now().split('T')[0];

// ─── Core Functions ──────────────────────────────────────────────────

/**
 * Record a payment (client or supplier) against a reservation.
 * Creates a Transaction, updates reservation paid amounts,
 * updates agent balance and account balance.
 */
export function recordPayment(params: {
  reservation: Reservation;
  amount: number;
  party: 'Client' | 'Supplier';
  accountId: string;
  paymentMethod: 'Cash' | 'Bank Transfer';
  currency?: 'SAR' | 'EGP';
  originalAmount?: number;
  exchangeRate?: number;
  createdBy: string;
  // Current state arrays (immutable — copies are returned)
  transactions: Transaction[];
  reservations: Reservation[];
  agents: Agent[];
  accounts: Account[];
}): FinanceResult {
  const { reservation, amount, party, accountId, paymentMethod, currency, originalAmount, exchangeRate, createdBy } = params;
  let transactions = [...params.transactions];
  let reservations = [...params.reservations];
  let agents = [...params.agents];
  let accounts = [...params.accounts];
  const auditEntries: FinanceAuditEntry[] = [];

  const trType = party === 'Client' ? 'ClientPayment' : 'SupplierPayment';
  const targetAgentId = party === 'Client' ? reservation.clientId : reservation.supplierId;
  const isClient = party === 'Client';

  // 1. Create Transaction record with reservationId linkage
  const newTr: Transaction = {
    id: `tr_${trType.toLowerCase()}_rsv_${reservation.id}_${Date.now()}`,
    docNo: getNextDocNo('DOC', transactions),
    date: today(),
    type: trType,
    amount,
    fromAccountId: accountId,
    agentId: targetAgentId,
    reservationId: reservation.id.toString(),
    description: `${party} Payment for RSV-${reservation.id}${isClient ? ` (Guest: ${reservation.guestName})` : ''}`,
    paymentMethod,
    voucherNo: getNextVoucherNo('PAY', transactions),
    originalCurrency: currency || 'SAR',
    originalAmount: currency === 'EGP' ? originalAmount : undefined,
    exchangeRate: currency === 'EGP' ? exchangeRate : undefined,
    baseAmountSAR: amount,
    createdBy,
  };
  transactions = [newTr, ...transactions];

  // 2. Update reservation paid amounts
  reservations = reservations.map(r => {
    if (r.id !== reservation.id) return r;
    return {
      ...r,
      amountPaidByClient: isClient ? safeAdd(r.amountPaidByClient || 0, amount) : r.amountPaidByClient,
      amountPaidToSupplier: !isClient ? safeAdd(r.amountPaidToSupplier || 0, amount) : r.amountPaidToSupplier,
    };
  });

  // 3. Update agent balance
  agents = agents.map(ag => {
    if (ag.id !== targetAgentId) return ag;
    return {
      ...ag,
      balance: isClient ? safeAdd(ag.balance, amount) : safeAdd(ag.balance, -amount),
    };
  });

  // 4. Update account balance
  accounts = accounts.map(acc => {
    if (acc.id !== accountId) return acc;
    return {
      ...acc,
      balance: isClient ? safeAdd(acc.balance, amount) : safeAdd(acc.balance, -amount),
    };
  });

  // 5. Audit entry
  auditEntries.push({
    id: `fa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now(),
    action: `Record ${party} Payment`,
    reservationId: reservation.id.toString(),
    transactionId: newTr.id,
    agentId: targetAgentId,
    amount,
    detail: `${party} payment of ${amount.toLocaleString()} SAR via ${paymentMethod} for RSV-${reservation.id}`,
  });

  return { transactions, reservations, agents, accounts, auditEntries };
}

/**
 * Process cancellation financial effects:
 * - Client credit/refund disposition
 * - Supplier credit/refund disposition
 * - Auto-create credit transactions or refund alerts
 */
export function recordCancellation(params: {
  reservation: Reservation;
  transactions: Transaction[];
  reservations: Reservation[];
  agents: Agent[];
  accounts: Account[];
  createdBy: string;
  refundAccountId?: string; // Optional: which bank/safe account to debit for refunds
}): FinanceResult & { refundAlerts: any[] } {
  const { reservation, createdBy, refundAccountId } = params;
  let transactions = [...params.transactions];
  let agents = [...params.agents];
  let accounts = [...params.accounts];
  const auditEntries: FinanceAuditEntry[] = [];
  const refundAlerts: any[] = [];

  // Client disposition
  const clientPaid = reservation.amountPaidByClient || 0;
  if (reservation.clientCreditDisposition === 'Kept as Credit' && clientPaid > 0) {
    agents = agents.map(a => a.id === reservation.clientId
      ? { ...a, walletBalance: safeAdd(a.walletBalance || 0, clientPaid) } : a);
    const creditTr: Transaction = {
      id: `tr_cancel_client_${reservation.id}_${Date.now()}`,
      docNo: getNextDocNo('CRED-C', transactions),
      date: today(),
      type: 'CreditApplied',
      amount: clientPaid,
      agentId: reservation.clientId,
      reservationId: reservation.id.toString(),
      description: `Credit from cancellation of RSV-${reservation.id} (${reservation.guestName})`,
      paymentMethod: 'Bank Transfer',
      voucherNo: getNextVoucherNo('CRED', transactions),
      createdBy,
    };
    transactions = [...transactions, creditTr];
    auditEntries.push({
      id: `fa_${Date.now()}_cc`,
      timestamp: now(),
      action: 'Cancellation Credit (Client)',
      reservationId: reservation.id.toString(),
      transactionId: creditTr.id,
      agentId: reservation.clientId,
      amount: clientPaid,
      detail: `Client credit of ${clientPaid.toLocaleString()} SAR from cancellation`,
    });
  } else if (reservation.clientCreditDisposition === 'Refunded' && clientPaid > 0) {
    // Create actual Bank/Safes outflow transaction for the refund
    const refundTr: Transaction = {
      id: `tr_refund_client_${reservation.id}_${Date.now()}`,
      docNo: getNextDocNo('REF-C', transactions),
      date: today(),
      type: 'ClientRefund',
      amount: clientPaid,
      fromAccountId: refundAccountId,
      agentId: reservation.clientId,
      reservationId: reservation.id.toString(),
      description: `Refund to client for cancelled RSV-${reservation.id} (${reservation.guestName})`,
      paymentMethod: 'Bank Transfer',
      voucherNo: getNextVoucherNo('REF', transactions),
      createdBy,
    };
    transactions = [...transactions, refundTr];
    // Reduce bank/safe balance
    if (refundAccountId) {
      accounts = accounts.map(acc => acc.id === refundAccountId
        ? { ...acc, balance: safeSubtract(acc.balance, clientPaid) } : acc);
    }
    // Reduce agent balance (reverse the payment)
    agents = agents.map(a => a.id === reservation.clientId
      ? { ...a, balance: safeSubtract(a.balance, clientPaid) } : a);
    auditEntries.push({
      id: `fa_${Date.now()}_rc`,
      timestamp: now(),
      action: 'Cancellation Refund (Client)',
      reservationId: reservation.id.toString(),
      transactionId: refundTr.id,
      agentId: reservation.clientId,
      amount: clientPaid,
      detail: `Client refund of ${clientPaid.toLocaleString()} SAR from cancellation — Bank outflow`,
    });
    refundAlerts.push({
      id: `refund_client_${reservation.id}_${Date.now()}`,
      bookingId: reservation.id,
      amount: clientPaid,
      party: 'Client',
      partyId: reservation.clientId,
      status: 'Processed',
      createdAt: now(),
      note: reservation.clientCreditNote || undefined,
    });
  }

  // Supplier disposition
  const supplierPaid = reservation.amountPaidToSupplier || 0;
  if (reservation.supplierCreditDisposition === 'Kept as Credit' && supplierPaid > 0) {
    agents = agents.map(a => a.id === reservation.supplierId
      ? { ...a, walletBalance: safeAdd(a.walletBalance || 0, supplierPaid) } : a);
    const creditTr: Transaction = {
      id: `tr_cancel_supp_${reservation.id}_${Date.now()}`,
      docNo: getNextDocNo('CRED-S', transactions),
      date: today(),
      type: 'CreditApplied',
      amount: supplierPaid,
      agentId: reservation.supplierId,
      reservationId: reservation.id.toString(),
      description: `Credit from cancellation of RSV-${reservation.id} (${reservation.guestName})`,
      paymentMethod: 'Bank Transfer',
      voucherNo: getNextVoucherNo('CRED', transactions),
      createdBy,
    };
    transactions = [...transactions, creditTr];
    auditEntries.push({
      id: `fa_${Date.now()}_cs`,
      timestamp: now(),
      action: 'Cancellation Credit (Supplier)',
      reservationId: reservation.id.toString(),
      transactionId: creditTr.id,
      agentId: reservation.supplierId,
      amount: supplierPaid,
      detail: `Supplier credit of ${supplierPaid.toLocaleString()} SAR from cancellation`,
    });
  } else if (reservation.supplierCreditDisposition === 'Refunded' && supplierPaid > 0) {
    // Create actual Bank/Safes outflow transaction for the refund
    const refundTr: Transaction = {
      id: `tr_refund_supp_${reservation.id}_${Date.now()}`,
      docNo: getNextDocNo('REF-S', transactions),
      date: today(),
      type: 'SupplierRefund',
      amount: supplierPaid,
      fromAccountId: refundAccountId,
      agentId: reservation.supplierId,
      reservationId: reservation.id.toString(),
      description: `Refund from supplier for cancelled RSV-${reservation.id} (${reservation.guestName})`,
      paymentMethod: 'Bank Transfer',
      voucherNo: getNextVoucherNo('REF', transactions),
      createdBy,
    };
    transactions = [...transactions, refundTr];
    // Reduce bank/safe balance (we get money back from supplier - inflow)
    if (refundAccountId) {
      accounts = accounts.map(acc => acc.id === refundAccountId
        ? { ...acc, balance: safeAdd(acc.balance, supplierPaid) } : acc);
    }
    // Reduce supplier agent balance (reverse the payment)
    agents = agents.map(a => a.id === reservation.supplierId
      ? { ...a, balance: safeSubtract(a.balance, supplierPaid) } : a);
    auditEntries.push({
      id: `fa_${Date.now()}_rs`,
      timestamp: now(),
      action: 'Cancellation Refund (Supplier)',
      reservationId: reservation.id.toString(),
      transactionId: refundTr.id,
      agentId: reservation.supplierId,
      amount: supplierPaid,
      detail: `Supplier refund of ${supplierPaid.toLocaleString()} SAR from cancellation — Bank inflow`,
    });
    refundAlerts.push({
      id: `refund_supp_${reservation.id}_${Date.now()}`,
      bookingId: reservation.id,
      amount: supplierPaid,
      party: 'Supplier',
      partyId: reservation.supplierId,
      status: 'Processed',
      createdAt: now(),
      note: reservation.supplierCreditNote || undefined,
    });
  }

  return {
    transactions,
    reservations: params.reservations,
    agents,
    accounts: params.accounts,
    auditEntries,
    refundAlerts,
  };
}

// ─── Query Functions ─────────────────────────────────────────────────

/**
 * Compute outstanding amount for a reservation.
 * For Client: totalSell - (amountPaidByClient + sum of linked ClientPayment transactions)
 * Uses the HIGHER of the two to catch discrepancies.
 */
export function getOutstanding(
  reservation: Reservation,
  transactions: Transaction[],
  party: 'Client' | 'Supplier'
): number {
  const { totalSell, totalBuy } = getReservationTotals(reservation);
  const totalOwed = party === 'Client' ? totalSell : totalBuy;
  const fieldPaid = party === 'Client' ? (reservation.amountPaidByClient || 0) : (reservation.amountPaidToSupplier || 0);

  // Sum all linked transactions for this reservation
  const linkedPaid = transactions
    .filter(tr =>
      tr.reservationId === reservation.id.toString() &&
      ((party === 'Client' && tr.type === 'ClientPayment') ||
       (party === 'Supplier' && tr.type === 'SupplierPayment'))
    )
    .reduce((sum, tr) => safeAdd(sum, tr.amount), 0);

  // Use the higher value to prevent under-reporting
  const paid = Math.max(fieldPaid, linkedPaid);
  return Math.max(0, safeAdd(totalOwed, -paid));
}

/**
 * Compute agent's actual balance from all linked transactions.
 * This is the authoritative source — independent of the stored balance field.
 */
export function getAgentBalanceFromLedger(
  agentId: string,
  transactions: Transaction[]
): number {
  let balance = 0;
  transactions.forEach(tr => {
    if (tr.agentId !== agentId) return;
    if (tr.type === 'ClientPayment') balance = safeAdd(balance, tr.amount);
    else if (tr.type === 'SupplierPayment') balance = safeAdd(balance, -tr.amount);
    else if (tr.type === 'ClientRefund') balance = safeAdd(balance, -tr.amount);
    else if (tr.type === 'SupplierRefund') balance = safeAdd(balance, tr.amount);
    else if (tr.type === 'CreditApplied') balance = safeAdd(balance, tr.amount);
  });
  return balance;
}

/**
 * Compute the real account balance from transactions only.
 * This is the actual cash position: opening balance + all inflows - all outflows.
 * Ignores the stored balance field which may drift over time.
 */
export function getAccountRealBalance(account: Account, transactions: Transaction[]): number {
  let balance = 0;
  transactions.forEach(tr => {
    if (tr.fromAccountId !== account.id) return;
    if (tr.type === 'ClientPayment' || tr.type === 'SupplierRefund' || tr.type === 'CreditApplied') {
      balance = safeAdd(balance, tr.amount);
    } else if (tr.type === 'SupplierPayment' || tr.type === 'ClientRefund') {
      balance = safeSubtract(balance, tr.amount);
    }
    // Transfers are handled separately via handleModifyBalances
  });
  return balance;
}

/**
 * Get all financial events (audit trail) for a specific reservation.
 * Links transactions, payments, and cancellations back to the reservation.
 */
export function getAuditTrail(
  reservationId: number | string,
  transactions: Transaction[]
): FinanceAuditEntry[] {
  const rid = reservationId.toString();
  const entries: FinanceAuditEntry[] = [];

  transactions
    .filter(tr => tr.reservationId === rid)
    .forEach(tr => {
      entries.push({
        id: `trail_${tr.id}`,
        timestamp: tr.date,
        action: tr.type,
        reservationId: rid,
        transactionId: tr.id,
        agentId: tr.agentId,
        amount: tr.amount,
        detail: `${tr.type}: ${tr.amount.toLocaleString()} SAR — ${tr.description}`,
      });
    });

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Double-Entry Verification ──────────────────────────────────────

export interface VerificationResult {
  passed: boolean;
  mismatches: {
    agentId: string;
    agentName: string;
    ledgerBalance: number;
    transactionSum: number;
    difference: number;
  }[];
  totalRevenueTransactions: number;
  totalRevenueReservations: number;
  revenueDifference: number;
}

/**
 * Verify that the sum of all individual transactions matches
 * the stored balances and reservation totals.
 *
 * 1. Per-agent: sum of transactions vs stored balance
 * 2. Global: sum of all ClientPayment transactions vs sum of all reservation totalSell
 */
export function verifyDoubleEntry(
  agents: Agent[],
  reservations: Reservation[],
  transactions: Transaction[]
): VerificationResult {
  const mismatches: VerificationResult['mismatches'] = [];

  // Per-agent verification
  agents.forEach(agent => {
    const ledgerBalance = getAgentBalanceFromLedger(agent.id, transactions);
    const storedBalance = agent.balance;
    const diff = Math.round((ledgerBalance - storedBalance) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      mismatches.push({
        agentId: agent.id,
        agentName: agent.name,
        ledgerBalance,
        transactionSum: storedBalance,
        difference: diff,
      });
    }
  });

  // Global revenue verification
  const totalRevenueTransactions = transactions
    .filter(tr => tr.type === 'ClientPayment')
    .reduce((sum, tr) => safeAdd(sum, tr.amount), 0);

  const activeReservations = reservations.filter(r => r.status !== 'Cancelled');
  const totalRevenueReservations = activeReservations
    .reduce((sum, r) => safeAdd(sum, r.amountPaidByClient || 0), 0);

  const revenueDifference = Math.round((totalRevenueTransactions - totalRevenueReservations) * 100) / 100;

  const passed = mismatches.length === 0 && Math.abs(revenueDifference) < 0.01;

  if (!passed) {
    console.error('[FinanceService] Double-Entry Verification FAILED:', {
      mismatches,
      revenueDifference,
      totalRevenueTransactions,
      totalRevenueReservations,
    });
  }

  return {
    passed,
    mismatches,
    totalRevenueTransactions,
    totalRevenueReservations,
    revenueDifference,
  };
}

// ─── Central Financial Engine: Accrual-Basis Queries ──────────────

/**
 * Get the SAR-equivalent sell total for an OtherService.
 */
export function getServiceSellTotal(svc: OtherService): number {
  const sellSAR = svc.sellPriceSAR || (svc.sellPrice * (svc.exchangeRate || 1));
  return round2(sellSAR * svc.quantity * (1 + (svc.taxRate || 0) / 100));
}

/**
 * Get the SAR-equivalent buy total for an OtherService.
 */
export function getServiceBuyTotal(svc: OtherService): number {
  const buySAR = svc.buyPriceSAR || (svc.buyPrice * (svc.exchangeRate || 1));
  return round2(buySAR * svc.quantity);
}

/**
 * Get outstanding amount for an OtherService (like getOutstanding for reservations).
 * For Client: totalSell - amountPaidByClient
 * For Supplier: totalBuy - amountPaidToSupplier
 */
export function getServiceOutstanding(
  service: OtherService,
  transactions: Transaction[],
  party: 'Client' | 'Supplier'
): number {
  const totalOwed = party === 'Client' ? getServiceSellTotal(service) : getServiceBuyTotal(service);
  const fieldPaid = party === 'Client' ? (service.amountPaidByClient || 0) : (service.amountPaidToSupplier || 0);

  // Sum all linked transactions for this service
  const linkedPaid = transactions
    .filter(tr =>
      tr.description?.includes(`Inv: ${service.invoiceNo}`) &&
      ((party === 'Client' && tr.type === 'ClientPayment') ||
       (party === 'Supplier' && tr.type === 'SupplierPayment'))
    )
    .reduce((sum, tr) => safeAdd(sum, tr.amount), 0);

  const paid = Math.max(fieldPaid, linkedPaid);
  return Math.max(0, safeSubtract(totalOwed, paid));
}

/**
 * Accrual-basis Accounts Receivable: sum of outstanding from all Confirmed
 * reservations + Confirmed/Completed Other Services.
 * Only includes what clients still owe (totalSell - amountPaidByClient).
 */
export function getTotalAccountsReceivable(
  reservations: Reservation[],
  otherServices: OtherService[],
  transactions: Transaction[]
): number {
  // Reservations: Confirmed only
  const resAR = reservations
    .filter(r => r.status === 'Confirmed')
    .reduce((s, r) => {
      const { totalSell } = getReservationTotals(r);
      const paid = r.amountPaidByClient || 0;
      return safeAdd(s, Math.max(0, safeSubtract(totalSell, paid)));
    }, 0);

  // Other Services: Confirmed + Completed
  const svcAR = otherServices
    .filter(s => s.status === 'Confirmed' || s.status === 'Completed')
    .reduce((s, svc) => {
      const totalSell = getServiceSellTotal(svc);
      const paid = svc.amountPaidByClient || 0;
      return safeAdd(s, Math.max(0, safeSubtract(totalSell, paid)));
    }, 0);

  return safeAdd(resAR, svcAR);
}

/**
 * Accrual-basis Accounts Payable: sum of outstanding owed to suppliers
 * from all Confirmed reservations + Confirmed/Completed Other Services.
 * Only includes what we still owe suppliers (totalBuy - amountPaidToSupplier).
 */
export function getTotalAccountsPayable(
  reservations: Reservation[],
  otherServices: OtherService[],
  transactions: Transaction[]
): number {
  // Reservations: Confirmed only
  const resAP = reservations
    .filter(r => r.status === 'Confirmed')
    .reduce((s, r) => {
      const { totalBuy } = getReservationTotals(r);
      const paid = r.amountPaidToSupplier || 0;
      return safeAdd(s, Math.max(0, safeSubtract(totalBuy, paid)));
    }, 0);

  // Other Services: Confirmed + Completed
  const svcAP = otherServices
    .filter(s => s.status === 'Confirmed' || s.status === 'Completed')
    .reduce((s, svc) => {
      const totalBuy = getServiceBuyTotal(svc);
      const paid = svc.amountPaidToSupplier || 0;
      return safeAdd(s, Math.max(0, safeSubtract(totalBuy, paid)));
    }, 0);

  return safeAdd(resAP, svcAP);
}

/**
 * Compute total confirmed revenue (sell) in SAR across reservations + services.
 * Used by Income Statement and Equity calculations.
 */
export function getTotalConfirmedRevenue(
  reservations: Reservation[],
  otherServices: OtherService[]
): { revenue: number; cost: number; commissions: number } {
  let revenue = 0, cost = 0, commissions = 0;

  // Confirmed reservations
  reservations.filter(r => r.status === 'Confirmed').forEach(r => {
    const t = getReservationTotals(r);
    revenue += t.totalSell;
    cost += t.totalBuy;
    commissions += t.totalCommission;
  });

  // Confirmed + Completed other services (NOT Tentative or Cancelled)
  otherServices.filter(s => s.status === 'Confirmed' || s.status === 'Completed').forEach(s => {
    revenue += getServiceSellTotal(s);
    cost += getServiceBuyTotal(s);
  });

  return { revenue: round2(revenue), cost: round2(cost), commissions: round2(commissions) };
}
