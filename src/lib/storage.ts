/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Agent, Allotment, Reservation, Account, Transaction, User, FollowUp, ExternalTransfer, GlobalAuditEntry, SalesPerson, CancellationReason, TermsAndConditions, OtherService, PaymentGateway, PayByLink, EditApprovalRequest, TaxSettings, Expense, ExpenseCategory, ConsolidatedInvoice, BlackoutPeriod, WaitlistEntry, EmailTemplate, BookingTemplate, CreditNoteEntry, CommissionEntry } from '../types';
import { firestoreSave, firestoreDelete, firestoreBulkSave, firestoreLoadAll, isFirebaseConfigured, isFirebaseAuthSignedIn, COLLECTIONS, firestoreClearCollection } from './firebase';
import { CSV_HOTELS } from './csvHotels';
import { round2, safeAdd, safeSubtract } from './finance';

// Egypt Time helper: UTC + 3 hours
export function getEgyptTime(): Date {
  const utc = new Date();
  // Egypt is UTC+3. Adjust timezone offset
  const tzOffset = 3 * 60 * 60 * 1000; 
  return new Date(utc.getTime() + tzOffset);
}

export function formatEgyptDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function formatEgyptDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// Default Hotels (imported from CSV - 1877 hotels)
const DEFAULT_HOTELS: Hotel[] = CSV_HOTELS;

// Default Agents
const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'a1',
    agentNumber: 1,
    name: 'Orient Gate Tours',
    companyName: 'Orient Gate Tours LLC',
    country: 'Egypt',
    type: 'Customer',
    phone: '+20 100 123 4567',
    email: 'info@orientgate.com',
    address: 'Tahrir Square, Cairo, Egypt',
    balance: -85985.00, // Representing opening/statement balance
    auditLogs: [{ id: 'l1', timestamp: '2026-06-01 10:00:00', user: 'Hazem Mohey El-Din', action: 'Agent created with opening balance' }]
  },
  {
    id: 'a2',
    agentNumber: 5,
    name: 'Al Hussam Tourism',
    companyName: 'Al Hussam Holding',
    country: 'Saudi Arabia',
    type: 'Customer',
    phone: '+966 50 111 2222',
    email: 'makkah@alhussam.com',
    address: 'Makkah Al Mukarramah',
    balance: -42000.00,
    auditLogs: []
  },
  {
    id: 'a3',
    agentNumber: 8,
    name: 'Najd Tours',
    companyName: 'Najd Travel Services',
    country: 'Egypt',
    type: 'Customer',
    phone: '+20 111 555 4444',
    email: 'booking@najdtours.com',
    address: 'Dokki, Giza, Egypt',
    balance: -15000.00,
    auditLogs: []
  },
  {
    id: 'a4',
    agentNumber: 10,
    name: 'Ameely Events',
    companyName: 'Ameely LLC',
    country: 'Egypt',
    type: 'Customer',
    phone: '+20 102 999 8888',
    email: 'events@ameely.com',
    address: 'Maadi, Cairo, Egypt',
    balance: 0,
    auditLogs: []
  },
  {
    id: 'a5',
    agentNumber: 13,
    name: 'Areej Taba',
    companyName: 'Areej Taba Hotel Reservations',
    country: 'Indonesia',
    type: 'Customer',
    phone: '+62 21 888 777',
    email: 'res@areejtaba.com',
    address: 'Jakarta, Indonesia',
    balance: -30000.00,
    auditLogs: []
  },
  {
    id: 'a6',
    agentNumber: 18,
    name: 'Marseilia Tours',
    companyName: 'Marseilia Travel Group',
    country: 'Egypt',
    type: 'Customer',
    phone: '+20 3 555 6667',
    email: 'alex@marseilia.com',
    address: 'Alexandria, Egypt',
    balance: -17800.00,
    auditLogs: []
  },
  {
    id: 's1',
    agentNumber: 501,
    name: 'Makkah Towers Provider',
    companyName: 'Makkah Towers Operator',
    country: 'Saudi Arabia',
    type: 'Supplier',
    phone: '+966 12 555 1111',
    email: 'supplier@makkahtowers.com',
    address: 'Clock Tower Complex, Makkah',
    balance: 15478.26,
    auditLogs: []
  },
  {
    id: 's2',
    agentNumber: 502,
    name: 'Madinah Anwar Vendor',
    companyName: 'Madinah Hotels Supplier Co',
    country: 'Saudi Arabia',
    type: 'Supplier',
    phone: '+966 14 555 2222',
    email: 'booking@madinahres.com',
    address: 'Northern Central Area, Madinah',
    balance: 35000.00,
    auditLogs: []
  }
];

// Default Allotments
const DEFAULT_ALLOTMENTS: Allotment[] = [
  {
    id: 'al1',
    hotelId: 'h3',
    roomType: 'Double',
    supplierId: 's1',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    totalRooms: 10,
    bookedRooms: 2,
  },
  {
    id: 'al2',
    hotelId: 'h2',
    roomType: 'Quad',
    supplierId: 's1',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    totalRooms: 5,
    bookedRooms: 1,
  },
];

// Default Reservations
const DEFAULT_RESERVATIONS: Reservation[] = [
  {
    id: 21,
    checkIn: '2026-03-05',
    checkOut: '2026-03-09',
    nights: 4,
    clientId: 'a6', // Marseilia Tours
    hotelId: 'h3',  // Movenpick Hajar
    guestName: 'Samy Abdulrahim',
    guestNationality: 'Egypt',
    clientOptionDate: '2026-03-04',
    termsAndConditions: 'Rooms allocation is subject to hotel availability. Check In 16:00 hrs. Check Out 12:00 hrs. One Full Night charged if Guest check out after 16:00 hrs. Confirmation of Rooms will be made upon receipt 100 % of total ammount before option Date.',
    supplierId: 's1',
    supplierVoucher: 'SV-9921',
    supplierOptionDate: '2026-03-04',
    rooms: [
      {
        id: 'r1',
        roomType: 'Double',
        qty: 2,
        nightlyRates: 2225, // Average selling rate per night = 17800 total / 2 qty / 4 nights = 2225
        buyRate: 1950,      // Buying rate = 1950 per night
        mealPlan: 'Iftar Ramadan',
        hasSeparateMealRate: false,
        mealRate: 0,
        pax: 2
      }
    ],
    status: 'Confirmed',
    agreementNo: '13510799629761932',
    agreementConfirmed: true,
    hotelConfirmationNo: '12035220-21',
    amountPaidByClient: 17800.00,
    amountPaidToSupplier: 15600.00,
    createdBy: 'Hazem Mohey El-Din',
    createdAt: '2026-02-24 13:50:18',
  },
  {
    id: 5,
    checkIn: '2026-02-16',
    checkOut: '2026-02-21',
    nights: 5,
    clientId: 'a1', // Orient Gate Tours
    hotelId: 'h1',  // AL HARAM Hotel Madina
    guestName: 'Hassanain Helmy',
    guestNationality: 'Egypt',
    clientOptionDate: '2026-02-15',
    termsAndConditions: 'Regular booking conditions apply.',
    supplierId: 's2',
    supplierVoucher: 'SV-4401',
    supplierOptionDate: '2026-02-15',
    rooms: [
      {
        id: 'r2',
        roomType: 'Double',
        qty: 1,
        nightlyRates: 1400,
        buyRate: 1100,
        mealPlan: 'RO',
        hasSeparateMealRate: true,
        mealRate: 50, // Per person night
        pax: 2
      }
    ],
    status: 'Confirmed',
    agreementNo: '13510799629182543',
    agreementConfirmed: true,
    hotelConfirmationNo: '223715',
    amountPaidByClient: 0,
    amountPaidToSupplier: 0,
    createdBy: 'Zaki Makkawi',
    createdAt: '2026-02-10 16:30:11'
  },
  {
    id: 1,
    checkIn: '2026-02-21',
    checkOut: '2026-02-25',
    nights: 4,
    clientId: 'a1', // Orient Gate Tours
    hotelId: 'h2',  // VOCO Makkah
    guestName: 'Ehab Abdo Ali',
    guestNationality: 'Egypt',
    clientOptionDate: '2026-02-18',
    termsAndConditions: 'General terms and conditions apply.',
    supplierId: 's1',
    supplierVoucher: 'SV-1022',
    supplierOptionDate: '2026-02-18',
    rooms: [
      {
        id: 'r3',
        roomType: 'Double',
        qty: 1,
        nightlyRates: 1100,
        buyRate: 900,
        mealPlan: 'B.B',
        hasSeparateMealRate: false,
        mealRate: 0,
        pax: 2
      }
    ],
    status: 'Tentative',
    agreementNo: '2251800570220938',
    agreementConfirmed: false,
    hotelConfirmationNo: '',
    amountPaidByClient: 0,
    amountPaidToSupplier: 0,
    createdBy: 'Hazem Mohey El-Din',
    createdAt: '2026-02-15 09:12:00'
  }
];

// Default Accounts
const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'ac1', name: 'Primary Cash Drawer (SAR)', type: 'Cash', balance: 45000 },
  { id: 'ac2', name: 'Al Rajhi Bank (SAR)', type: 'Bank', balance: 350000 },
  { id: 'ac3', name: 'Banque Saudi Fransi (SAR)', type: 'Bank', balance: 180000 },
];

// Default Transactions
const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: 'tr1',
    docNo: '1',
    date: '2026-02-03',
    type: 'ClientPayment',
    amount: 1400,
    fromAccountId: 'ac1',
    reservationId: '5',
    agentId: 'a1',
    description: 'Payment for reservation Guest Hassanain Helmy',
    paymentMethod: 'Cash',
    voucherNo: 'REC-1001',
    createdBy: 'Yasmeen Madani'
  },
  {
    id: 'tr2',
    docNo: '2',
    date: '2026-02-24',
    type: 'ClientPayment',
    amount: 17800.00,
    fromAccountId: 'ac2',
    reservationId: '21',
    agentId: 'a6',
    description: 'Received bank transfer for reservation Guest Samy Abdulrahim',
    paymentMethod: 'Bank Transfer',
    voucherNo: 'REC-1002',
    createdBy: 'Yasmeen Madani'
  }
];

// Default Users
const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'hazem', name: 'Hazem Mohey El-Din', role: 'Admin', email: 'hazem8383@gmail.com' },
  { id: 'u2', username: 'zaki', name: 'Zaki Makkawi', role: 'Reservationist', email: 'zaki@zumrahotels.com' },
  { id: 'u3', username: 'yasmeen', name: 'Yasmeen Madani', role: 'Finance', email: 'yasmeen@zumrahotels.com' },
];

// LocalStorage helpers
export function getSavedData<T>(key: string, defaults: T): T {
  try {
    const item = localStorage.getItem(`zumra_${key}`);
    return item ? JSON.parse(item) : defaults;
  } catch (e) {
    return defaults;
  }
}

export function saveGlobalData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`zumra_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving ' + key, e);
  }
}

/** Generate next sequential voucher number for a given prefix (e.g. 'PAY', 'CRED', 'XFER', 'REF') */
export function getNextVoucherNo(prefix: string, transactions: Array<{ voucherNo?: string }>): string {
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  const maxNum = transactions.reduce((max, tr) => {
    const match = (tr.voucherNo || '').match(regex);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

/** Generate next sequential doc number */
export function getNextDocNo(prefix: string, transactions: Array<{ docNo?: string }>): string {
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  const maxNum = transactions.reduce((max, tr) => {
    const match = (tr.docNo || '').match(regex);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

// Global Core DB wrapper
export class ZumraDB {
  static getHotels(): Hotel[] {
    // One-time migration: replace old hotel data with xlsx import
    const HOTEL_DATA_VERSION = 3;
    const savedVersion = parseInt(localStorage.getItem('zumra_hotels_version') || '0');
    if (savedVersion < HOTEL_DATA_VERSION) {
      saveGlobalData('hotels', CSV_HOTELS);
      localStorage.setItem('zumra_hotels_migrated', 'true');
      localStorage.setItem('zumra_hotels_version', String(HOTEL_DATA_VERSION));
      return CSV_HOTELS;
    }
    const list = getSavedData('hotels', DEFAULT_HOTELS);
    saveGlobalData('hotels', list);
    return list;
  }

  static saveHotels(list: Hotel[]): void {
    saveGlobalData('hotels', list);
  }

  static getAgents(): Agent[] {
    const list = getSavedData('agents', DEFAULT_AGENTS);
    saveGlobalData('agents', list);
    return list;
  }

  static saveAgents(list: Agent[]): void {
    saveGlobalData('agents', list);
  }

  static getAllotments(): Allotment[] {
    const list = getSavedData('allotments', DEFAULT_ALLOTMENTS);
    saveGlobalData('allotments', list);
    return list;
  }

  static saveAllotments(list: Allotment[]): void {
    saveGlobalData('allotments', list);
  }

  static getReservations(): Reservation[] {
    const list = getSavedData('reservations', DEFAULT_RESERVATIONS);
    saveGlobalData('reservations', list);
    return list;
  }

  static saveReservations(list: Reservation[]): void {
    saveGlobalData('reservations', list);
  }

  static getAccounts(): Account[] {
    const list = getSavedData('accounts', DEFAULT_ACCOUNTS);
    saveGlobalData('accounts', list);
    return list;
  }

  static saveAccounts(list: Account[]): void {
    saveGlobalData('accounts', list);
  }

  static getTransactions(): Transaction[] {
    const list = getSavedData('transactions', DEFAULT_TRANSACTIONS);
    saveGlobalData('transactions', list);
    return list;
  }

  static saveTransactions(list: Transaction[]): void {
    saveGlobalData('transactions', list);
  }

  static getExternalTransfers(): ExternalTransfer[] {
    const list = getSavedData('external_transfers', []);
    saveGlobalData('external_transfers', list);
    return list;
  }

  static saveExternalTransfers(list: ExternalTransfer[]): void {
    saveGlobalData('external_transfers', list);
  }

  static getUsers(): User[] {
    const list = getSavedData('users', DEFAULT_USERS);
    // Ensure uniqueness by ID just in case data got corrupted
    const uniqueList = list.filter((user, index, self) =>
      index === self.findIndex((u) => u.id === user.id)
    );
    saveGlobalData('users', uniqueList);
    return uniqueList;
  }

  static saveUsers(list: User[]): void {
    saveGlobalData('users', list);
  }

  static getCurrentUser(): User {
    const defUser = DEFAULT_USERS[0];
    const user = getSavedData('current_user', defUser);
    saveGlobalData('current_user', user);
    return user;
  }

  static setCurrentUser(user: User): void {
    saveGlobalData('current_user', user);
  }

  static getFollowUps(): FollowUp[] {
    const list = getSavedData('followups', [] as FollowUp[]);
    saveGlobalData('followups', list);
    return list;
  }

  static saveFollowUps(list: FollowUp[]): void {
    saveGlobalData('followups', list);
  }

  static getMessages(): any[] {
    return getSavedData('messages', [] as any[]);
  }

  static saveMessages(list: any[]): void {
    saveGlobalData('messages', list);
  }

  static getAuditLog(): GlobalAuditEntry[] {
    return getSavedData('audit_log', [] as GlobalAuditEntry[]);
  }

  static saveAuditLog(log: GlobalAuditEntry[]): void {
    saveGlobalData('audit_log', log);
  }

  static logAuditEntry(entry: Omit<GlobalAuditEntry, 'id' | 'timestamp'>): GlobalAuditEntry {
    const full: GlobalAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const log = this.getAuditLog();
    log.unshift(full); // newest first
    if (log.length > 5000) log.length = 5000;
    this.saveAuditLog(log);
    return full;
  }

  // ==================== Sales Persons ====================
  static getSalesPersons(): SalesPerson[] {
    return getSavedData('sales_persons', [] as SalesPerson[]);
  }
  static saveSalesPersons(list: SalesPerson[]): void {
    saveGlobalData('sales_persons', list);
  }

  // ==================== Cancellation Reasons ====================
  static getCancellationReasons(): CancellationReason[] {
    return getSavedData('cancellation_reasons', [] as CancellationReason[]);
  }
  static saveCancellationReasons(list: CancellationReason[]): void {
    saveGlobalData('cancellation_reasons', list);
  }

  // ==================== Terms & Conditions ====================
  static getTermsAndConditions(): TermsAndConditions[] {
    return getSavedData('terms_conditions', [] as TermsAndConditions[]);
  }
  static saveTermsAndConditions(list: TermsAndConditions[]): void {
    saveGlobalData('terms_conditions', list);
  }

  // ==================== Other Services ====================
  static getOtherServices(): OtherService[] {
    return getSavedData('other_services', [] as OtherService[]);
  }
  static saveOtherServices(list: OtherService[]): void {
    saveGlobalData('other_services', list);
  }

  // ==================== Payment Gateways ====================
  static getPaymentGateways(): PaymentGateway[] {
    return getSavedData('payment_gateways', [] as PaymentGateway[]);
  }
  static savePaymentGateways(list: PaymentGateway[]): void {
    saveGlobalData('payment_gateways', list);
  }

  // ==================== Pay By Links ====================
  static getPayByLinks(): PayByLink[] {
    return getSavedData('pay_by_links', [] as PayByLink[]);
  }
  static savePayByLinks(list: PayByLink[]): void {
    saveGlobalData('pay_by_links', list);
  }

  // ==================== Edit Approvals ====================
  static getEditApprovals(): EditApprovalRequest[] {
    return getSavedData('edit_approvals', [] as EditApprovalRequest[]);
  }
  static saveEditApprovals(list: EditApprovalRequest[]): void {
    saveGlobalData('edit_approvals', list);
  }

  // ==================== Tax Settings ====================
  static getTaxSettings(): TaxSettings[] {
    return getSavedData('tax_settings', [{ id: 'default_vat', name: 'VAT', rate: 15, appliesTo: ['OutboundHotel', 'Flight', 'Visa', 'Transportation'], active: true }] as TaxSettings[]);
  }
  static saveTaxSettings(list: TaxSettings[]): void {
    saveGlobalData('tax_settings', list);
  }

  // ==================== Expenses ====================
  static getExpenses(): Expense[] {
    return getSavedData('expenses', []);
  }
  static saveExpenses(list: Expense[]): void {
    saveGlobalData('expenses', list);
  }
  static getExpenseCategories(): ExpenseCategory[] {
    return getSavedData('expense_categories', [
      { id: 'cat_utilities', name: 'Utilities', active: true },
      { id: 'cat_transportation', name: 'Transportation', active: true },
      { id: 'cat_communication', name: 'Communication', active: true },
      { id: 'cat_employee_loans', name: 'Employee Loans', active: true },
      { id: 'cat_office', name: 'Office Supplies', active: true },
      { id: 'cat_other', name: 'Other', active: true },
    ] as ExpenseCategory[]);
  }
  static saveExpenseCategories(list: ExpenseCategory[]): void {
    saveGlobalData('expense_categories', list);
  }

  // ==================== Consolidated Invoices ====================
  static getConsolidatedInvoices(): ConsolidatedInvoice[] {
    return getSavedData('consolidated_invoices', []);
  }
  static saveConsolidatedInvoices(list: ConsolidatedInvoice[]): void {
    saveGlobalData('consolidated_invoices', list);
  }
}

export function getAgentActualBalance(agent: Agent, reservations: Reservation[], transactions: Transaction[]): number {
  const isSupplier = agent.type === 'Supplier';
  
  let lifetimeTxSum = 0;
  transactions.forEach(tr => {
    if (tr.agentId === agent.id) {
      if (!isSupplier && tr.type === 'ClientPayment') {
        lifetimeTxSum = safeAdd(lifetimeTxSum, tr.amount);
      } else if (isSupplier && tr.type === 'SupplierPayment') {
        lifetimeTxSum = safeAdd(lifetimeTxSum, tr.amount);
      } else if (!isSupplier && tr.type === 'ClientRefund') {
        lifetimeTxSum = safeSubtract(lifetimeTxSum, tr.amount); // Refunds reverse payment effect
      } else if (isSupplier && tr.type === 'SupplierRefund') {
        lifetimeTxSum = safeSubtract(lifetimeTxSum, tr.amount);
      }
    }
  });

  const originalOpeningBalance = isSupplier 
    ? round2(agent.balance + lifetimeTxSum) 
    : round2(agent.balance - lifetimeTxSum);

  let actualBalance = originalOpeningBalance;

  reservations.forEach(res => {
    // Skip cancelled reservations — they net zero via reversal entries in statement.
    // Include only if they have non-zero payments (cancellation fees retained).
    const isCancelled = res.status === 'Cancelled';
    
    if (!isSupplier && res.clientId === agent.id) {
      if (!isCancelled) {
        const { totalSell } = getReservationTotals(res);
        actualBalance = safeAdd(actualBalance, totalSell);
      } else {
        // Cancelled: only include payments retained as cancellation fees
        const paid = res.amountPaidByClient || 0;
        if (paid > 0) {
          actualBalance = safeSubtract(actualBalance, paid); // They still owe what they paid (net: zero debit + keep payment)
        }
      }
    }
    if (isSupplier && res.supplierId === agent.id) {
      if (!isCancelled) {
        const { totalBuy } = getReservationTotals(res);
        actualBalance = safeAdd(actualBalance, totalBuy);
      } else {
        const paid = res.amountPaidToSupplier || 0;
        if (paid > 0) {
          actualBalance = safeSubtract(actualBalance, paid);
        }
      }
    }
  });

  transactions.forEach(tr => {
    if (tr.agentId === agent.id) {
      if (!isSupplier && tr.type === 'ClientPayment') {
        actualBalance = safeSubtract(actualBalance, tr.amount); 
      } else if (isSupplier && tr.type === 'SupplierPayment') {
        actualBalance = safeSubtract(actualBalance, tr.amount); 
      } else if (!isSupplier && tr.type === 'ClientRefund') {
        actualBalance = safeAdd(actualBalance, tr.amount); // Refund adds back to what they owe
      } else if (isSupplier && tr.type === 'SupplierRefund') {
        actualBalance = safeAdd(actualBalance, tr.amount); // Supplier refund adds back to what we owe
      }
    }
  });

  return round2(actualBalance);
}

// Helper to auto-calculate room pax from roomType name
export function getPaxForRoomType(type: string): number {
  const norm = type.toLowerCase();
  if (norm.includes('single')) return 1;
  if (norm.includes('double')) return 2;
  if (norm.includes('triple')) return 3;
  if (norm.includes('quad')) return 4;
  if (norm.includes('quint') || norm.includes('quintuple')) return 5;
  return 2; // Default to Double if unrecognized
}

// Calculate total selling rate and buying rate for a Reservation object
export function getReservationTotals(res: Reservation) {
  let totalSell = 0;
  let totalBuy = 0;

  res.rooms.forEach((room) => {
    // Multi-night rates support either flat number or dictionary
    let roomSellNights = 0;
    let roomBuyNights = 0;

    for (let index = 0; index < res.nights; index++) {
      // Selling Night Rate
      if (typeof room.nightlyRates === 'number') {
        roomSellNights += room.nightlyRates;
      } else {
        // Find by night index or grab first key
        const keys = Object.keys(room.nightlyRates);
        const rateVal = room.nightlyRates[keys[index]] || room.nightlyRates[keys[0]] || 0;
        roomSellNights += rateVal;
      }

      // Buying Night Rate
      if (typeof room.buyRate === 'number' || typeof room.buyRate === 'undefined') {
        roomBuyNights += (room.buyRate as number) || 0;
      } else {
        const keys = Object.keys(room.buyRate);
        const rateVal = room.buyRate[keys[index]] || room.buyRate[keys[0]] || 0;
        roomBuyNights += rateVal;
      }
    }

    // Room base price
    const baseRoomSell = roomSellNights * room.qty;
    const baseRoomBuy = roomBuyNights * room.qty;

    // Meal Plan Pricing
    let mealSell = 0;
    let mealBuy = 0;
    if (room.hasSeparateMealRate) {
      // Total meal cost = mealRate * room pax * nights * room qty
      const paxCount = getPaxForRoomType(room.roomType);
      mealSell = (room.mealRate || 0) * paxCount * res.nights * room.qty;
      mealBuy = (room.mealBuyRate || 0) * paxCount * res.nights * room.qty;
    }

    // Extra Bed: count = pax - 2 (base double occupancy)
    // For Triple: 1 extra bed, Quad: 2 extra beds, Quint: 3 extra beds
    let extraBedSell = 0;
    let extraBedBuy = 0;
    if (room.hasExtraBed) {
      const paxCount = getPaxForRoomType(room.roomType);
      const extraBedCount = Math.max(0, paxCount - 2);
      extraBedSell = (room.extraBedRate || 0) * extraBedCount * res.nights * room.qty;
      extraBedBuy = (room.extraBedBuyRate || 0) * extraBedCount * res.nights * room.qty;
    }

    // View Supplement (added per room per night)
    let viewSuppSell = 0;
    let viewSuppBuy = 0;
    if (room.hasViewSupplement) {
      viewSuppSell = (room.viewSupplementRate || 0) * res.nights * room.qty;
      viewSuppBuy = (room.viewSupplementBuyRate || 0) * res.nights * room.qty;
    }

    // Extra Meal 1 (per pax per night)
    let extraMeal1Sell = 0;
    let extraMeal1Buy = 0;
    if (room.hasExtraMeal1) {
      const paxCount = getPaxForRoomType(room.roomType);
      extraMeal1Sell = (room.extraMeal1Rate || 0) * paxCount * res.nights * room.qty;
      extraMeal1Buy = (room.extraMeal1BuyRate || 0) * paxCount * res.nights * room.qty;
    }

    // Extra Meal 2 (per pax per night)
    let extraMeal2Sell = 0;
    let extraMeal2Buy = 0;
    if (room.hasExtraMeal2) {
      const paxCount = getPaxForRoomType(room.roomType);
      extraMeal2Sell = (room.extraMeal2Rate || 0) * paxCount * res.nights * room.qty;
      extraMeal2Buy = (room.extraMeal2BuyRate || 0) * paxCount * res.nights * room.qty;
    }

    totalSell = safeAdd(totalSell, baseRoomSell + mealSell + extraBedSell + viewSuppSell + extraMeal1Sell + extraMeal2Sell);
    totalBuy = safeAdd(totalBuy, baseRoomBuy + mealBuy + extraBedBuy + viewSuppBuy + extraMeal1Buy + extraMeal2Buy);
  });

  const grossProfit = safeSubtract(totalSell, totalBuy);
  const totalCommission = res.salesPersonCommissionAmount || 0;
  const netProfit = safeSubtract(grossProfit, totalCommission);
  const profit = grossProfit; // Backward-compatible alias
  const markupPct = totalBuy > 0 ? round2((grossProfit / totalBuy) * 100) : 0;
  const vat = round2(totalSell * 0.15); // 15% VAT
  const totalWithVat = safeAdd(totalSell, vat);

  return {
    totalSell,
    totalBuy,
    profit,
    grossProfit,
    totalCommission,
    netProfit,
    markupPct,
    vat,
    totalWithVat
  };
}

// Help abbreviate selected meal plans to high-end standards
export function abbreviateMealPlan(mealPlan: string): string {
  if (!mealPlan) return '';
  const norm = mealPlan.trim().toLowerCase();
  if (norm === 'breakfast' || norm === 'b.b' || norm === 'bb') return 'B.B';
  if (norm === 'room only' || norm === 'r.o' || norm === 'ro') return 'R.O';
  if (norm === 'half board' || norm === 'h.b' || norm === 'hb') return 'H.B';
  if (norm === 'full board' || norm === 'f.b' || norm === 'fb') return 'F.B';
  if (norm === 'full board asian' || norm === 'f.b asian' || norm === 'fb asian') return 'F.B Asian';
  
  // Fuzzy substring matches or cleanups
  if (norm.includes('breakfast')) return 'B.B';
  if (norm.includes('room only')) return 'R.O';
  if (norm.includes('half board')) return 'H.B';
  if (norm.includes('full board')) {
    if (norm.includes('asian')) return 'F.B Asian';
    return 'F.B';
  }
  return mealPlan;
}

export function exportToCSV(filename: string, rows: object[]) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys.map(k => {
        let cell = row[k as keyof typeof row] === null || row[k as keyof typeof row] === undefined ? '' : row[k as keyof typeof row];
        cell = String(cell).replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator);
    }).join('\n');

  // Add BOM for proper UTF-8/Excel encoding
  const BOM = '\uFEFF';
  const fullContent = BOM + csvContent;

  // Try blob URL approach first, then fallback to data URI
  try {
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    // Delay cleanup to ensure download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 250);
  } catch {
    // Fallback: use data URI (works on browsers that block blob URLs)
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(fullContent);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 250);
  }
}

export function exportToExcel(filename: string, rows: object[], sheetName: string = 'Sheet1') {
  if (!rows || !rows.length) return;
  import('xlsx').then((XLSX) => {
    // Deep-clone rows so we don't mutate caller data
    const sanitized = rows.map(row => {
      const clean: Record<string, any> = {};
      Object.entries(row).forEach(([key, val]) => {
        if (val === null || val === undefined) {
          clean[key] = '';
        } else if (typeof val === 'number') {
          clean[key] = Math.round(val * 100) / 100; // 2dp precision
        } else {
          clean[key] = val;
        }
      });
      return clean;
    });

    const ws = XLSX.utils.json_to_sheet(sanitized);

    // Auto-size columns: measure max content length per column
    const colKeys = Object.keys(sanitized[0] || {});
    ws['!cols'] = colKeys.map(key => {
      const maxDataLen = sanitized.reduce((max, row) => {
        const cellVal = String(row[key] ?? '');
        return Math.max(max, cellVal.length);
      }, key.length);
      // Cap width between 8 and 40 characters
      return { wch: Math.min(40, Math.max(8, maxDataLen + 2)) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  });
}

// =====================================================
// FIRESTORE CLOUD SYNC LAYER with Offline Queue
// =====================================================

// --- Offline Sync Queue ---
interface SyncQueueItem {
  id: string;
  type: 'save' | 'delete';
  collection: string;
  docId: string;
  data?: any;
  timestamp: number;
  retries: number;
}

const SYNC_QUEUE_KEY = 'zumra_sync_queue';
const MAX_RETRIES = 5;

function loadSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function addToQueue(item: SyncQueueItem): void {
  const queue = loadSyncQueue();
  // Replace existing operations on same doc (keep latest)
  const filtered = queue.filter(q => !(q.collection === item.collection && q.docId === item.docId));
  filtered.push(item);
  saveSyncQueue(filtered);
  notifySyncListeners();
}

function removeFromQueue(id: string): void {
  const queue = loadSyncQueue().filter(q => q.id !== id);
  saveSyncQueue(queue);
  notifySyncListeners();
}

/** Clear all pending sync items — use when queue is stuck */
export function clearSyncQueue(): void {
  saveSyncQueue([]);
  console.log('[Sync] Queue cleared by user');
  notifySyncListeners();
}

// --- Sync Status ---
let isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
let syncListeners: Array<(status: SyncStatus) => void> = [];

export interface SyncStatus {
  online: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

let _isSyncing = false;

function notifySyncListeners(): void {
  const status: SyncStatus = {
    online: isOnline,
    pendingCount: loadSyncQueue().length,
    isSyncing: _isSyncing,
  };
  syncListeners.forEach(fn => fn(status));
}

export function getSyncStatus(): SyncStatus {
  return {
    online: isOnline,
    pendingCount: loadSyncQueue().length,
    isSyncing: _isSyncing,
  };
}

export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
  syncListeners.push(listener);
  return () => { syncListeners = syncListeners.filter(fn => fn !== listener); };
}

/** Flush the offline sync queue - push pending items to Firestore */
export async function flushSyncQueue(): Promise<{ success: number; failed: number }> {
  if (_isSyncing) return { success: 0, failed: 0 };
  _isSyncing = true;
  notifySyncListeners();

  const queue = loadSyncQueue();
  if (queue.length > 0) {
    console.log(`[Sync] Flushing queue: ${queue.length} item(s) pending`);
  }
  let success = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'save' && item.data) {
        await firestoreSave(item.collection, item.docId, item.data);
      } else if (item.type === 'delete') {
        await firestoreDelete(item.collection, item.docId);
      }
      removeFromQueue(item.id);
      success++;
    } catch (err: any) {
      item.retries++;
      console.warn(`[Sync] Failed to sync ${item.type} ${item.collection}/${item.docId} (attempt ${item.retries}/${MAX_RETRIES}):`, err?.code || err?.message || err);
      if (item.retries >= MAX_RETRIES) {
        console.error(`[Sync] DROPPED ${item.collection}/${item.docId} after ${MAX_RETRIES} failed attempts. Data may be out of sync.`);
        removeFromQueue(item.id);
      }
      failed++;
    }
  }

  _isSyncing = false;
  notifySyncListeners();
  if (success > 0) {
    console.log(`[Sync] Flushed ${success} item(s) successfully`);
  }
  if (failed > 0 && success === 0) {
    console.warn(`[Sync] All ${failed} item(s) failed. Check Firestore rules and indexes.`);
  }
  return { success, failed };
}

// --- Network status tracking ---
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    notifySyncListeners();
    flushSyncQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    notifySyncListeners();
  });
  // Flush pending sync queue when app regains focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOnline && loadSyncQueue().length > 0) {
      flushSyncQueue();
    }
  });
  // Retry queue every 60 seconds if items are pending
  setInterval(() => {
    if (isOnline && loadSyncQueue().length > 0) {
      flushSyncQueue();
    }
  }, 60000);
}

// --- Sync functions (queue-aware) ---
export async function syncItemToFirestore(collectionName: string, item: any): Promise<void> {
  if (!isFirebaseConfigured || !item?.id) {
    console.warn(`[Sync] Skipped ${collectionName}/${item?.id}: firebase=${isFirebaseConfigured}, id=${item?.id}`);
    return;
  }
  // Skip if not authenticated — writes would be rejected by Firestore rules
  if (!isFirebaseAuthSignedIn()) {
    console.warn(`[Sync] Skipped ${collectionName}/${item.id}: not authenticated`);
    return;
  }
  if (!isOnline) {
    console.log(`[Sync] Offline — queued ${collectionName}/${item.id}`);
    addToQueue({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'save', collection: collectionName, docId: item.id, data: item, timestamp: Date.now(), retries: 0 });
    return;
  }
  try {
    await firestoreSave(collectionName, item.id, item);
    console.log(`[Sync] Saved ${collectionName}/${item.id} to Firestore`);
  } catch (err: any) {
    // Don't queue permission-denied errors — they won't succeed on retry
    if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
      console.error(`[Sync] PERMISSION DENIED for ${collectionName}/${item.id}: ${err.message}. Check Firestore rules.`);
      return;
    }
    console.error(`[Sync] Failed to save ${collectionName}/${item.id}:`, err?.code || err?.message || err);
    addToQueue({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'save', collection: collectionName, docId: item.id, data: item, timestamp: Date.now(), retries: 0 });
  }
}

export async function syncDeleteToFirestore(collectionName: string, id: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  if (!isFirebaseAuthSignedIn()) {
    console.warn(`[Sync] Skipped delete ${collectionName}/${id}: not authenticated`);
    return;
  }
  if (!isOnline) {
    addToQueue({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'delete', collection: collectionName, docId: id, timestamp: Date.now(), retries: 0 });
    return;
  }
  try {
    await firestoreDelete(collectionName, id);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
      console.error(`[Sync] PERMISSION DENIED for delete ${collectionName}/${id}`);
      return;
    }
    addToQueue({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'delete', collection: collectionName, docId: id, timestamp: Date.now(), retries: 0 });
  }
}

export function syncCollectionToFirestore(collectionName: string, items: any[]): Promise<void> {
  if (!isFirebaseConfigured) return Promise.resolve();
  return firestoreBulkSave(collectionName, items);
}

// Timestamp tracking to suppress real-time listener echo after local writes
let lastWriteTimestamp = 0;
export function markLocalWrite(): void {
  lastWriteTimestamp = Date.now();
}
export function isRecentLocalWrite(windowMs: number = 3000): boolean {
  return Date.now() - lastWriteTimestamp < windowMs;
}

/**
 * Strategic Database Reset — clears ALL transactional data while preserving
 * core reference data (Hotels, Agents, config/settings).
 * 
 * Clears: Reservations, Transactions, Accounts, External Transfers,
 *         Follow-ups, Audit Log, Commissions, Consolidated Invoices,
 *         Edit Approvals, Pay-By-Links, Expenses.
 * Preserves: Hotels, Agents (balance reset to 0), Users, Settings,
 *            Tax Settings, Expense Categories, Terms & Conditions,
 *            Other Services, Payment Gateways, Sales Persons, Allotments.
 */
export async function strategicDatabaseReset(): Promise<{ cleared: number; preserved: string[] }> {
  // Collections to CLEAR (all transactional data + agent/guest profiles)
  const collectionsToClear = [
    COLLECTIONS.RESERVATIONS,
    COLLECTIONS.TRANSACTIONS,
    COLLECTIONS.ACCOUNTS,
    COLLECTIONS.EXTERNAL_TRANSFERS,
    COLLECTIONS.FOLLOW_UPS,
    COLLECTIONS.AUDIT_LOG,
    COLLECTIONS.COMMISSIONS,
    COLLECTIONS.CONSOLIDATED_INVOICES,
    COLLECTIONS.EDIT_APPROVALS,
    COLLECTIONS.PAY_BY_LINKS,
    COLLECTIONS.EXPENSES,
    COLLECTIONS.AGENTS,  // Clear all agent/guest profiles
  ];

  // Corresponding localStorage keys
  const localStorageKeysToClear = [
    'zumra_reservations',
    'zumra_transactions',
    'zumra_accounts',
    'zumra_external_transfers',
    'zumra_followups',
    'zumra_audit_log',
    'zumra_commissions',
    'zumra_consolidated_invoices',
    'zumra_edit_approvals',
    'zumra_pay_by_links',
    'zumra_expenses',
    'zumra_agents',  // Clear agent/guest profiles from localStorage too
  ];

  let totalCleared = 0;

  // 1. Clear Firestore collections
  if (isFirebaseConfigured) {
    for (const col of collectionsToClear) {
      const deleted = await firestoreClearCollection(col);
      totalCleared += deleted;
    }
  }

  // 2. Clear localStorage
  for (const key of localStorageKeysToClear) {
    localStorage.removeItem(key);
  }

  // 3. Agent profiles already cleared in step 1 — save empty array to localStorage
  ZumraDB.saveAgents([]);

  // 4. Filter users: keep only 'hazem', remove all others
  const allUsers = ZumraDB.getUsers();
  const keptUsers = allUsers.filter(u => u.username === 'hazem');
  const removedUserCount = allUsers.length - keptUsers.length;
  ZumraDB.saveUsers(keptUsers);
  if (isFirebaseConfigured) {
    await firestoreClearCollection(COLLECTIONS.USERS);
    await firestoreBulkSave(COLLECTIONS.USERS, keptUsers);
  }

  // 5. Clear allotment booked counts
  const allotments = ZumraDB.getAllotments();
  const resetAllotments = allotments.map(a => ({ ...a, bookedCount: 0 }));
  ZumraDB.saveAllotments(resetAllotments);
  if (isFirebaseConfigured) {
    await firestoreBulkSave(COLLECTIONS.ALLOTMENTS, resetAllotments);
  }

  const preserved = [
    'Hotels (' + ZumraDB.getHotels().length + ')',
    'Allotments (' + resetAllotments.length + ')',
    'Users: hazem only (removed ' + removedUserCount + ')',
    'Settings', 'Tax Settings', 'Expense Categories',
    'Terms & Conditions', 'Other Services', 'Payment Gateways',
    'Sales Persons', 'Cancellation Reasons',
  ];

  console.log(`[DB Reset] Cleared ${totalCleared} transactional records. Preserved:`, preserved);
  return { cleared: totalCleared, preserved };
}

export async function loadFromFirestore<T>(collectionName: string, localStorageKey: string): Promise<T[]> {
  if (!isFirebaseConfigured) {
    return JSON.parse(localStorage.getItem(localStorageKey) || '[]') as T[];
  }
  try {
    const firestoreData = await firestoreLoadAll<T>(collectionName);
    if (firestoreData.length > 0) {
      localStorage.setItem(localStorageKey, JSON.stringify(firestoreData));
      return firestoreData;
    }
    const localData = JSON.parse(localStorage.getItem(localStorageKey) || '[]') as T[];
    if (localData.length > 0) syncCollectionToFirestore(collectionName, localData);
    return localData;
  } catch {
    return JSON.parse(localStorage.getItem(localStorageKey) || '[]') as T[];
  }
}

export const ZumraSync = {
  saveHotel: (h: Hotel) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.HOTELS, h); },
  saveAgent: (a: Agent) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.AGENTS, a); },
  saveAllotment: (a: Allotment) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.ALLOTMENTS, a); },
  saveReservation: (r: Reservation) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.RESERVATIONS, r); },
  saveAccount: (a: Account) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.ACCOUNTS, a); },
  saveTransaction: (t: Transaction) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.TRANSACTIONS, t); },
  saveUser: (u: User) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.USERS, u); },
  saveFollowUp: (f: FollowUp) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.FOLLOW_UPS, f); },
  saveExternalTransfer: (t: ExternalTransfer) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.EXTERNAL_TRANSFERS, t); },
  saveAuditEntry: (e: GlobalAuditEntry) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.AUDIT_LOG, e); },
  saveSalesPerson: (s: SalesPerson) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.SALES_PERSONS, s); },
  saveCancellationReason: (c: CancellationReason) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.CANCELLATION_REASONS, c); },
  saveTermsAndConditions: (t: TermsAndConditions) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.TERMS_CONDITIONS, t); },
  saveOtherService: (s: OtherService) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.OTHER_SERVICES, s); },
  savePaymentGateway: (p: PaymentGateway) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.PAYMENT_GATEWAYS, p); },
  savePayByLink: (p: PayByLink) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.PAY_BY_LINKS, p); },
  saveEditApproval: (e: EditApprovalRequest) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.EDIT_APPROVALS, e); },
  saveTaxSettings: (t: TaxSettings) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.TAX_SETTINGS, t); },
  saveExpense: (e: Expense) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.EXPENSES, e); },
  saveExpenseCategory: (c: ExpenseCategory) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.EXPENSE_CATEGORIES, c); },
  saveConsolidatedInvoice: (ci: ConsolidatedInvoice) => { markLocalWrite(); return syncItemToFirestore(COLLECTIONS.CONSOLIDATED_INVOICES, ci); },
  deleteHotel: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.HOTELS, id); },
  deleteAgent: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.AGENTS, id); },
  deleteAllotment: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.ALLOTMENTS, id); },
  deleteReservation: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.RESERVATIONS, id); },
  deleteAccount: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.ACCOUNTS, id); },
  deleteTransaction: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.TRANSACTIONS, id); },
  deleteUser: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.USERS, id); },
  deleteFollowUp: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.FOLLOW_UPS, id); },
  deleteExternalTransfer: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.EXTERNAL_TRANSFERS, id); },
  deleteSalesPerson: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.SALES_PERSONS, id); },
  deleteCancellationReason: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.CANCELLATION_REASONS, id); },
  deleteTermsAndConditions: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.TERMS_CONDITIONS, id); },
  deleteOtherService: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.OTHER_SERVICES, id); },
  deletePaymentGateway: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.PAYMENT_GATEWAYS, id); },
  deletePayByLink: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.PAY_BY_LINKS, id); },
  deleteEditApproval: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.EDIT_APPROVALS, id); },
  deleteExpense: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.EXPENSES, id); },
  deleteExpenseCategory: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.EXPENSE_CATEGORIES, id); },
  deleteConsolidatedInvoice: (id: string) => { markLocalWrite(); return syncDeleteToFirestore(COLLECTIONS.CONSOLIDATED_INVOICES, id); },
  bulkSyncAll: () => {
    if (!isFirebaseConfigured) return;
    syncCollectionToFirestore(COLLECTIONS.HOTELS, JSON.parse(localStorage.getItem('zumra_hotels') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.AGENTS, JSON.parse(localStorage.getItem('zumra_agents') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.ALLOTMENTS, JSON.parse(localStorage.getItem('zumra_allotments') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.RESERVATIONS, JSON.parse(localStorage.getItem('zumra_reservations') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.ACCOUNTS, JSON.parse(localStorage.getItem('zumra_accounts') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.TRANSACTIONS, JSON.parse(localStorage.getItem('zumra_transactions') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.USERS, JSON.parse(localStorage.getItem('zumra_users') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.FOLLOW_UPS, JSON.parse(localStorage.getItem('zumra_follow_ups') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.EXTERNAL_TRANSFERS, JSON.parse(localStorage.getItem('zumra_external_transfers') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.AUDIT_LOG, JSON.parse(localStorage.getItem('zumra_audit_log') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.SALES_PERSONS, JSON.parse(localStorage.getItem('zumra_sales_persons') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.CANCELLATION_REASONS, JSON.parse(localStorage.getItem('zumra_cancellation_reasons') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.TERMS_CONDITIONS, JSON.parse(localStorage.getItem('zumra_terms_conditions') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.OTHER_SERVICES, JSON.parse(localStorage.getItem('zumra_other_services') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.PAYMENT_GATEWAYS, JSON.parse(localStorage.getItem('zumra_payment_gateways') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.PAY_BY_LINKS, JSON.parse(localStorage.getItem('zumra_pay_by_links') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.EDIT_APPROVALS, JSON.parse(localStorage.getItem('zumra_edit_approvals') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.TAX_SETTINGS, JSON.parse(localStorage.getItem('zumra_tax_settings') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.EXPENSES, JSON.parse(localStorage.getItem('zumra_expenses') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.EXPENSE_CATEGORIES, JSON.parse(localStorage.getItem('zumra_expense_categories') || '[]'));
    syncCollectionToFirestore(COLLECTIONS.CONSOLIDATED_INVOICES, JSON.parse(localStorage.getItem('zumra_consolidated_invoices') || '[]'));
  }
};

// Seed Data Generator for testing
export function generateSeedData(): {
  reservations: Reservation[];
  transactions: Transaction[];
  followUps: FollowUp[];
} {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  const sampleReservations: Reservation[] = [
    {
      id: 1001,
      clientId: 'a1',
      supplierId: 'a2',
      hotelId: '1',
      guestName: 'Ahmed Hassan',
      guestNationality: 'Egyptian',
      checkIn: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
      checkOut: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)),
      nights: 5,
      status: 'Confirmed',
      rooms: [
        { id: 'rm_1001_1', roomType: 'Double', view: 'City View', mealPlan: 'B.B', qty: 1, pax: 2, buyRate: 800, nightlyRates: 1200, hasSeparateMealRate: false, mealRate: 0 }
      ],
      clientOptionDate: '',
      supplierOptionDate: '',
      hotelConfirmationNo: 'HC-2026-1001',
      amountPaidByClient: 3000,
      amountPaidToSupplier: 2000,
      createdBy: 'System',
      createdAt: formatDate(today) + ' 10:00:00',
      cancellationReason: '',
      passportExpiry: '',
      visaExpiry: '',
      supplierVoucher: '',
      bookingSource: 'Direct',
      salesPersonId: '',
      tags: ['VIP', 'Repeat-Guest'],
      supplierDueDate: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
      specialRequests: 'Early check-in requested, extra pillows'
    },
    {
      id: 1002,
      clientId: 'a1',
      supplierId: 'a3',
      hotelId: '5',
      guestName: 'Sarah Johnson',
      guestNationality: 'American',
      checkIn: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
      checkOut: formatDate(new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000)),
      nights: 7,
      status: 'Tentative',
      rooms: [
        { id: 'rm_1002_1', roomType: 'Suite', view: 'Sea View', mealPlan: 'H.B', qty: 1, pax: 2, buyRate: 1500, nightlyRates: 2200, hasSeparateMealRate: false, mealRate: 0 }
      ],
      clientOptionDate: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
      supplierOptionDate: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
      hotelConfirmationNo: '',
      amountPaidByClient: 0,
      amountPaidToSupplier: 0,
      createdBy: 'System',
      createdAt: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)) + ' 14:30:00',
      cancellationReason: '',
      bookingSource: 'Booking.com',
      salesPersonId: '',
      tags: ['Honeymoon', 'Long-Stay'],
      supplierDueDate: formatDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)),
      specialRequests: 'Room decoration for honeymoon, champagne on arrival'
    },
    {
      id: 1003,
      clientId: 'a2',
      supplierId: 'a3',
      hotelId: '10',
      guestName: 'Mohammed Al-Rashid',
      guestNationality: 'Saudi',
      checkIn: formatDate(new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)),
      checkOut: formatDate(new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000)),
      nights: 3,
      status: 'Confirmed',
      rooms: [
        { id: 'rm_1003_1', roomType: 'Triple', view: 'Garden View', mealPlan: 'F.B', qty: 2, pax: 6, buyRate: 2000, nightlyRates: 2800, hasSeparateMealRate: false, mealRate: 0 }
      ],
      clientOptionDate: '',
      supplierOptionDate: '',
      hotelConfirmationNo: 'HC-2026-1003',
      amountPaidByClient: 8000,
      amountPaidToSupplier: 6000,
      createdBy: 'System',
      createdAt: formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)) + ' 09:15:00',
      cancellationReason: '',
      groupRef: 'GRP-2026-001',
      passportExpiry: '2028-05-15',
      visaExpiry: '2026-12-31',
      supplierVoucher: 'V-2026-1003',
      bookingSource: 'Agent',
      salesPersonId: '',
      tags: ['Family', 'Group-Tour'],
      supplierDueDate: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
      specialRequests: 'Connecting rooms, kids menu'
    }
  ];

  const sampleTransactions: Transaction[] = [
    {
      id: 't_seed_1',
      docNo: 'TRX-0001',
      date: formatDate(today),
      type: 'ClientPayment',
      amount: 3000,
      fromAccountId: 'acc_1',
      toAccountId: undefined,
      agentId: 'a1',
      reservationId: '1001',
      description: 'Client payment for RSV-1001',
      paymentMethod: 'Bank Transfer',
      voucherNo: 'RV-0001',
      createdBy: 'System'
    },
    {
      id: 't_seed_2',
      docNo: 'TRX-0002',
      date: formatDate(today),
      type: 'SupplierPayment',
      amount: 2000,
      fromAccountId: 'acc_1',
      toAccountId: undefined,
      agentId: 'a3',
      reservationId: '1001',
      description: 'Supplier payment for RSV-1001',
      paymentMethod: 'Bank Transfer',
      voucherNo: 'SV-0001',
      createdBy: 'System'
    },
    {
      id: 't_seed_3',
      docNo: 'TRX-0003',
      date: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
      type: 'ClientPayment',
      amount: 8000,
      fromAccountId: 'acc_1',
      toAccountId: undefined,
      agentId: 'a2',
      reservationId: '1003',
      description: 'Client payment for RSV-1003',
      paymentMethod: 'Bank Transfer',
      voucherNo: 'RV-0002',
      createdBy: 'System'
    }
  ];

  const sampleFollowUps: FollowUp[] = [
    {
      id: 'fu_seed_1',
      clientId: 'a1',
      date: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
      topic: 'Option Expiry - RSV-1002',
      notes: 'Follow up on tentative booking for Sarah Johnson - honeymoon couple',
      status: 'Pending',
      createdBy: 'System'
    },
    {
      id: 'fu_seed_2',
      clientId: 'a2',
      date: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
      topic: 'Supplier Payment Due - RSV-1003',
      notes: 'Payment due for Mohammed Al-Rashid booking',
      status: 'Pending',
      createdBy: 'System'
    }
  ];

  return {
    reservations: sampleReservations,
    transactions: sampleTransactions,
    followUps: sampleFollowUps
  };
}

// Blackout Periods
const BLACKOUT_KEY = 'zumra_blackout_periods';
export function loadBlackoutPeriods(): BlackoutPeriod[] {
  try { return JSON.parse(localStorage.getItem(BLACKOUT_KEY) || '[]'); } catch { return []; }
}
export function saveBlackoutPeriods(periods: BlackoutPeriod[]): void {
  localStorage.setItem(BLACKOUT_KEY, JSON.stringify(periods));
}

// Waitlist
const WAITLIST_KEY = 'zumra_waitlist';
export function loadWaitlist(): WaitlistEntry[] {
  try { return JSON.parse(localStorage.getItem(WAITLIST_KEY) || '[]'); } catch { return []; }
}
export function saveWaitlist(entries: WaitlistEntry[]): void {
  localStorage.setItem(WAITLIST_KEY, JSON.stringify(entries));
}

// Email Templates
const EMAIL_TEMPLATES_KEY = 'zumra_email_templates';
export function loadEmailTemplates(): EmailTemplate[] {
  try { return JSON.parse(localStorage.getItem(EMAIL_TEMPLATES_KEY) || '[]'); } catch { return []; }
}
export function saveEmailTemplates(templates: EmailTemplate[]): void {
  localStorage.setItem(EMAIL_TEMPLATES_KEY, JSON.stringify(templates));
}

// Margin Alert Threshold
const MARGIN_THRESHOLD_KEY = 'zumra_margin_threshold';
export function loadMarginThreshold(): number {
  try { return parseFloat(localStorage.getItem(MARGIN_THRESHOLD_KEY) || '15'); } catch { return 15; }
}
export function saveMarginThreshold(threshold: number): void {
  localStorage.setItem(MARGIN_THRESHOLD_KEY, threshold.toString());
}

// Pre-arrival reminder tracking
const REMINDERS_SENT_KEY = 'zumra_reminders_sent';
export function loadSentReminders(): string[] {
  try { return JSON.parse(localStorage.getItem(REMINDERS_SENT_KEY) || '[]'); } catch { return []; }
}
export function saveSentReminders(ids: string[]): void {
  localStorage.setItem(REMINDERS_SENT_KEY, JSON.stringify(ids));
}

// Booking Templates
const BOOKING_TEMPLATES_KEY = 'zumra_booking_templates';
export function loadBookingTemplates(): BookingTemplate[] {
  try { return JSON.parse(localStorage.getItem(BOOKING_TEMPLATES_KEY) || '[]'); } catch { return []; }
}
export function saveBookingTemplates(templates: BookingTemplate[]): void {
  localStorage.setItem(BOOKING_TEMPLATES_KEY, JSON.stringify(templates));
}

// Credit Note Entries
const CREDIT_NOTES_KEY = 'zumra_credit_notes';
export function loadCreditNotes(): CreditNoteEntry[] {
  try { return JSON.parse(localStorage.getItem(CREDIT_NOTES_KEY) || '[]'); } catch { return []; }
}
export function saveCreditNotes(entries: CreditNoteEntry[]): void {
  localStorage.setItem(CREDIT_NOTES_KEY, JSON.stringify(entries));
}

// Commission Ledger
const COMMISSIONS_KEY = 'zumra_commissions';
export function loadCommissions(): CommissionEntry[] {
  try { return JSON.parse(localStorage.getItem(COMMISSIONS_KEY) || '[]'); } catch { return []; }
}
export function saveCommissions(entries: CommissionEntry[]): void {
  localStorage.setItem(COMMISSIONS_KEY, JSON.stringify(entries));
}

// Commission calculation helpers
// SalesPerson commission = rate_per_room_per_night × total_rooms × nights
export function calculateSalesPersonCommission(ratePerRoomNight: number, totalRooms: number, nights: number): number {
  if (!ratePerRoomNight || ratePerRoomNight <= 0) return 0;
  return Math.round(ratePerRoomNight * totalRooms * nights);
}

export function calculateSupplierCommission(totalSell: number, totalBuy: number, markupRate: number): number {
  if (!markupRate || markupRate <= 0) return 0;
  // Margin-based: markup % applied to buy cost
  return Math.round((totalBuy * markupRate) / 100);
}

// Record commission entries for a reservation
export function recordCommissionEntries(
  reservation: Reservation,
  salesPersonRate: number | undefined,
  supplierMarkupRate: number | undefined,
  totalSell: number,
  totalBuy: number
): CommissionEntry[] {
  const entries: CommissionEntry[] = [];
  const now = new Date().toISOString();

  if (reservation.salesPersonId && salesPersonRate && salesPersonRate > 0) {
    const totalRooms = reservation.rooms.reduce((s, rm) => s + rm.qty, 0);
    const amount = calculateSalesPersonCommission(salesPersonRate, totalRooms, reservation.nights);
    entries.push({
      id: `comm_sp_${reservation.id}_${Date.now()}`,
      reservationId: reservation.id,
      type: 'SalesPerson',
      salesPersonId: reservation.salesPersonId,
      rate: salesPersonRate,
      amount,
      status: reservation.status === 'Cancelled' ? 'Reversed' : 'Pending',
      createdAt: now,
      reversedAt: reservation.status === 'Cancelled' ? now : undefined,
    });
  }

  if (reservation.supplierId && supplierMarkupRate && supplierMarkupRate > 0 && reservation.supplierId !== 'DIRECT') {
    const amount = calculateSupplierCommission(totalSell, totalBuy, supplierMarkupRate);
    entries.push({
      id: `comm_sup_${reservation.id}_${Date.now()}`,
      reservationId: reservation.id,
      type: 'Supplier',
      agentId: reservation.supplierId,
      rate: supplierMarkupRate,
      amount,
      status: reservation.status === 'Cancelled' ? 'Reversed' : 'Pending',
      createdAt: now,
      reversedAt: reservation.status === 'Cancelled' ? now : undefined,
    });
  }

  return entries;
}

// Reverse commission entries for a cancelled reservation
export function reverseCommissionEntries(reservationId: number): void {
  const commissions = loadCommissions();
  const now = new Date().toISOString();
  const updated = commissions.map(c =>
    c.reservationId === reservationId && c.status === 'Pending'
      ? { ...c, status: 'Reversed' as const, reversedAt: now }
      : c
  );
  saveCommissions(updated);
}

// Allotment capacity checker
export function checkAllotmentCapacity(
  hotelId: string,
  roomType: string,
  checkIn: string,
  checkOut: string,
  allotments: Allotment[],
  reservations: Reservation[],
  excludeResId?: number
): { available: boolean; remaining: number; total: number; booked: number; message: string } {
  const matchingAllotments = allotments.filter(a =>
    a.hotelId === hotelId && a.roomType === roomType &&
    a.startDate <= checkIn && a.endDate >= checkOut
  );
  
  if (matchingAllotments.length === 0) {
    return { available: true, remaining: -1, total: 0, booked: 0, message: 'No allotment found for this hotel/room type' };
  }
  
  const totalRooms = matchingAllotments.reduce((sum, a) => sum + a.totalRooms, 0);
  
  // Count booked rooms for the same hotel/roomType/date range (excluding current reservation)
  const bookedRooms = reservations
    .filter(r =>
      r.hotelId === hotelId &&
      r.status !== 'Cancelled' &&
      r.id !== excludeResId &&
      r.checkIn < checkOut && r.checkOut > checkIn
    )
    .reduce((sum, r) => {
      const matchingRooms = r.rooms.filter(rm => rm.roomType === roomType);
      return sum + matchingRooms.reduce((s, rm) => s + rm.qty, 0);
    }, 0);
  
  const remaining = totalRooms - bookedRooms;
  return {
    available: remaining > 0,
    remaining,
    total: totalRooms,
    booked: bookedRooms,
    message: remaining > 0
      ? `${remaining} room(s) remaining out of ${totalRooms} allotment`
      : `No rooms available! ${bookedRooms}/${totalRooms} rooms already booked`
  };
}

/**
 * Seed test data (clients, suppliers, sales persons, reservations, transactions,
 * accounts, follow-ups, expenses, cancellation reasons, other services) for testing.
 * Only runs if no agents exist yet. No beginning balances.
 */
export function seedTestDataIfEmpty(): void {
  const existingAgents = ZumraDB.getAgents();
  if (existingAgents.length > 0) return;
  
  const hotels = ZumraDB.getHotels();
  if (hotels.length === 0) return;
  
  const hotel1 = hotels[0];
  const hotel2 = hotels.length > 1 ? hotels[1] : hotels[0];
  const now = getEgyptTime().toISOString().replace('T', ' ').substring(0, 19);
  
  // ===== Bank/Cash Accounts =====
  const testAccounts: Account[] = [
    { id: 'acc_cash_1', name: 'Main Cash', accountHolderName: 'Zumra Hotels', type: 'Cash', balance: 0, code: 'CASH-001', currency: 'SAR' },
    { id: 'acc_bank_1', name: 'Al Rajhi Bank', accountHolderName: 'Zumra Hotels', accountNumber: 'SA0380000000608010163001', type: 'Bank', balance: 0, code: 'BANK-001', currency: 'SAR' },
    { id: 'acc_bank_2', name: 'SNB Account', accountHolderName: 'Zumra Hotels', accountNumber: 'SA4410000005208010123456', type: 'Bank', balance: 0, code: 'BANK-002', currency: 'SAR' },
  ];
  
  // ===== Test Clients =====
  const testClients: Agent[] = [
    { id: 'test_client_1', agentNumber: 1, name: 'Ahmed Hassan', companyName: 'Al-Noor Travel', country: 'Saudi Arabia', type: 'Customer', phone: '+966501234567', email: 'ahmed@alnoortravel.com', address: 'Riyadh', balance: 0, auditLogs: [] },
    { id: 'test_client_2', agentNumber: 2, name: 'Mohammed Ali', companyName: 'Golden Gate Tours', country: 'UAE', type: 'Customer', phone: '+971501234567', email: 'mohammed@goldengate.ae', address: 'Dubai', balance: 0, auditLogs: [] },
    { id: 'test_client_3', agentNumber: 3, name: 'Fatima Zahra', companyName: 'Atlas Voyages', country: 'Morocco', type: 'Customer', phone: '+212601234567', email: 'fatima@atlasvoyages.ma', address: 'Casablanca', balance: 0, auditLogs: [] },
    { id: 'test_client_4', agentNumber: 4, name: 'Omar Khalid', companyName: 'Desert Star Tourism', country: 'Egypt', type: 'Customer', phone: '+201012345678', email: 'omar@desertstar.eg', address: 'Cairo', balance: 0, auditLogs: [] },
    { id: 'test_client_5', agentNumber: 5, name: 'Layla Mansour', companyName: 'Nile Express Travel', country: 'Egypt', type: 'Customer', phone: '+201098765432', email: 'layla@nilexpress.eg', address: 'Alexandria', balance: 0, auditLogs: [] },
  ];
  
  // ===== Test Suppliers =====
  const testSuppliers: Agent[] = [
    { id: 'test_supplier_1', agentNumber: 6, name: 'Hassan Ibrahim', companyName: 'Makkah Hotels Group', country: 'Saudi Arabia', type: 'Supplier', phone: '+966509876543', email: 'hassan@makkahhotels.sa', address: 'Makkah', balance: 0, auditLogs: [] },
    { id: 'test_supplier_2', agentNumber: 7, name: 'Yusuf Ahmed', companyName: 'Madinah Hospitality', country: 'Saudi Arabia', type: 'Supplier', phone: '+966508765432', email: 'yusuf@madinahhospitality.sa', address: 'Madinah', balance: 0, auditLogs: [] },
    { id: 'test_supplier_3', agentNumber: 8, name: 'Ali Al-Qahtani', companyName: 'Jeddah Resorts LLC', country: 'Saudi Arabia', type: 'Supplier', phone: '+966507654321', email: 'ali@jeddahresorts.sa', address: 'Jeddah', balance: 0, auditLogs: [] },
  ];
  
  // ===== Test Sales Persons =====
  const testSalesPersons: SalesPerson[] = [
    { id: 'test_sp_1', name: 'Khaled Mostafa', phone: '+966551112222', email: 'khaled@zumra.com', commission: 5, active: true },
    { id: 'test_sp_2', name: 'Nour Eldin', phone: '+966553334444', email: 'nour@zumra.com', commission: 8, active: true },
    { id: 'test_sp_3', name: 'Rana Farouk', phone: '+201055512345', email: 'rana@zumra.com', commission: 6, active: true },
  ];
  
  // ===== Test Reservations =====
  const roomTypes = hotel1.roomTypes.length > 0 ? hotel1.roomTypes : ['Standard', 'Deluxe'];
  const testReservations: Reservation[] = [
    // 1: Confirmed, fully paid, commission paid
    { id: 1, checkIn: '2025-02-10', checkOut: '2025-02-14', nights: 4, clientId: 'test_client_1', hotelId: hotel1.id, guestName: 'Abdullah Al-Rashid', guestNationality: 'Saudi', supplierId: 'test_supplier_1', rooms: [{ id: 'r1', roomType: roomTypes[0], qty: 2, nightlyRates: { '2025-02-10': 800, '2025-02-11': 800, '2025-02-12': 800, '2025-02-13': 800 }, buyRate: { '2025-02-10': 550, '2025-02-11': 550, '2025-02-12': 550, '2025-02-13': 550 }, mealPlan: 'BB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'City' }], status: 'Confirmed', amountPaidByClient: 6400, amountPaidToSupplier: 4400, createdBy: 'Hazem', createdAt: '2025-01-15 10:00:00', salesPersonId: 'test_sp_1', salesPersonCommissionAmount: 320, commissionPaidToSalesPerson: true, commissionPaidDate: '2025-02-15', tags: ['VIP'] },
    // 2: Confirmed, partially paid
    { id: 2, checkIn: '2025-03-01', checkOut: '2025-03-05', nights: 4, clientId: 'test_client_2', hotelId: hotel1.id, guestName: 'Sara Williams', guestNationality: 'British', supplierId: 'test_supplier_1', rooms: [{ id: 'r2', roomType: roomTypes[0], qty: 1, nightlyRates: { '2025-03-01': 900, '2025-03-02': 900, '2025-03-03': 900, '2025-03-04': 900 }, buyRate: { '2025-03-01': 600, '2025-03-02': 600, '2025-03-03': 600, '2025-03-04': 600 }, mealPlan: 'HB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'Sea' }], status: 'Confirmed', amountPaidByClient: 3600, amountPaidToSupplier: 2400, createdBy: 'Hazem', createdAt: '2025-02-10 14:30:00', salesPersonId: 'test_sp_2', salesPersonCommissionAmount: 288, commissionPaidToSalesPerson: false },
    // 3: Confirmed, fully paid
    { id: 3, checkIn: '2025-03-15', checkOut: '2025-03-20', nights: 5, clientId: 'test_client_1', hotelId: hotel2.id, guestName: 'Ibrahim Noor', guestNationality: 'Saudi', supplierId: 'test_supplier_2', rooms: [{ id: 'r3', roomType: roomTypes.length > 1 ? roomTypes[1] : roomTypes[0], qty: 3, nightlyRates: { '2025-03-15': 1200, '2025-03-16': 1200, '2025-03-17': 1200, '2025-03-18': 1200, '2025-03-19': 1200 }, buyRate: { '2025-03-15': 800, '2025-03-16': 800, '2025-03-17': 800, '2025-03-18': 800, '2025-03-19': 800 }, mealPlan: 'FB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'Haram' }], status: 'Confirmed', amountPaidByClient: 18000, amountPaidToSupplier: 12000, createdBy: 'Hazem', createdAt: '2025-02-20 09:00:00', salesPersonId: 'test_sp_1', salesPersonCommissionAmount: 900, commissionPaidToSalesPerson: false },
    // 4: Tentative
    { id: 4, checkIn: '2025-04-01', checkOut: '2025-04-03', nights: 2, clientId: 'test_client_3', hotelId: hotel1.id, guestName: 'Youssef Bennani', guestNationality: 'Moroccan', supplierId: 'test_supplier_1', rooms: [{ id: 'r4', roomType: roomTypes[0], qty: 1, nightlyRates: { '2025-04-01': 750, '2025-04-02': 750 }, buyRate: { '2025-04-01': 500, '2025-04-02': 500 }, mealPlan: 'BB', hasSeparateMealRate: false, mealRate: 0, pax: 1, view: 'City' }], status: 'Tentative', amountPaidByClient: 0, amountPaidToSupplier: 0, createdBy: 'Hazem', createdAt: '2025-03-10 11:00:00', clientOptionDate: '2025-03-20', supplierOptionDate: '2025-03-18', salesPersonId: 'test_sp_2', salesPersonCommissionAmount: 120, commissionPaidToSalesPerson: false },
    // 5: Confirmed, fully paid, KSA collection
    { id: 5, checkIn: '2025-04-10', checkOut: '2025-04-17', nights: 7, clientId: 'test_client_4', hotelId: hotel2.id, guestName: 'Hana Mahmoud', guestNationality: 'Egyptian', supplierId: 'test_supplier_2', rooms: [{ id: 'r5', roomType: roomTypes[0], qty: 2, nightlyRates: { '2025-04-10': 650, '2025-04-11': 650, '2025-04-12': 650, '2025-04-13': 650, '2025-04-14': 650, '2025-04-15': 650, '2025-04-16': 650 }, buyRate: { '2025-04-10': 420, '2025-04-11': 420, '2025-04-12': 420, '2025-04-13': 420, '2025-04-14': 420, '2025-04-15': 420, '2025-04-16': 420 }, mealPlan: 'HB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'Garden' }], status: 'Confirmed', amountPaidByClient: 9100, amountPaidToSupplier: 5880, createdBy: 'Hazem', createdAt: '2025-03-15 16:00:00', salesPersonId: 'test_sp_1', salesPersonCommissionAmount: 455, commissionPaidToSalesPerson: true, commissionPaidDate: '2025-04-20', collectedBySalesPerson: true, collectedDate: '2025-04-10', remittedToCompany: true, remittedDate: '2025-04-25', tags: ['Honeymoon'] },
    // 6: Cancelled
    { id: 6, checkIn: '2025-03-20', checkOut: '2025-03-23', nights: 3, clientId: 'test_client_2', hotelId: hotel1.id, guestName: 'James Wilson', guestNationality: 'British', supplierId: 'test_supplier_1', rooms: [{ id: 'r6', roomType: roomTypes[0], qty: 1, nightlyRates: { '2025-03-20': 850, '2025-03-21': 850, '2025-03-22': 850 }, buyRate: { '2025-03-20': 580, '2025-03-21': 580, '2025-03-22': 580 }, mealPlan: 'BB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'City' }], status: 'Cancelled', amountPaidByClient: 500, amountPaidToSupplier: 0, createdBy: 'Hazem', createdAt: '2025-02-28 10:00:00', cancellationFee: 500, cancellationReason: 'Guest changed travel plans', salesPersonId: 'test_sp_2', salesPersonCommissionAmount: 0, commissionPaidToSalesPerson: false },
    // 7: Tentative
    { id: 7, checkIn: '2025-05-01', checkOut: '2025-05-04', nights: 3, clientId: 'test_client_3', hotelId: hotel2.id, guestName: 'Amina El Fassi', guestNationality: 'Moroccan', supplierId: 'test_supplier_2', rooms: [{ id: 'r7', roomType: roomTypes.length > 1 ? roomTypes[1] : roomTypes[0], qty: 2, nightlyRates: { '2025-05-01': 1100, '2025-05-02': 1100, '2025-05-03': 1100 }, buyRate: { '2025-05-01': 750, '2025-05-02': 750, '2025-05-03': 750 }, mealPlan: 'FB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'Haram' }], status: 'Tentative', amountPaidByClient: 0, amountPaidToSupplier: 0, createdBy: 'Hazem', createdAt: '2025-04-01 08:00:00', clientOptionDate: '2025-04-15', supplierOptionDate: '2025-04-12', salesPersonId: 'test_sp_1', salesPersonCommissionAmount: 330, commissionPaidToSalesPerson: false },
    // 8: Confirmed, partially paid
    { id: 8, checkIn: '2025-05-10', checkOut: '2025-05-13', nights: 3, clientId: 'test_client_4', hotelId: hotel1.id, guestName: 'Tarek Soliman', guestNationality: 'Egyptian', supplierId: 'test_supplier_1', rooms: [{ id: 'r8', roomType: roomTypes[0], qty: 1, nightlyRates: { '2025-05-10': 700, '2025-05-11': 700, '2025-05-12': 700 }, buyRate: { '2025-05-10': 450, '2025-05-11': 450, '2025-05-12': 450 }, mealPlan: 'BB', hasSeparateMealRate: false, mealRate: 0, pax: 1, view: 'City' }], status: 'Confirmed', amountPaidByClient: 2100, amountPaidToSupplier: 1350, createdBy: 'Hazem', createdAt: '2025-04-15 13:00:00', tags: ['Corporate'] },
    // 9: Confirmed, KSA collection not remitted
    { id: 9, checkIn: '2025-06-01', checkOut: '2025-06-05', nights: 4, clientId: 'test_client_5', hotelId: hotel1.id, guestName: 'Nadia Farouk', guestNationality: 'Egyptian', supplierId: 'test_supplier_3', rooms: [{ id: 'r9', roomType: roomTypes[0], qty: 1, nightlyRates: { '2025-06-01': 850, '2025-06-02': 850, '2025-06-03': 850, '2025-06-04': 850 }, buyRate: { '2025-06-01': 550, '2025-06-02': 550, '2025-06-03': 550, '2025-06-04': 550 }, mealPlan: 'BB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'City' }], status: 'Confirmed', amountPaidByClient: 3400, amountPaidToSupplier: 2200, createdBy: 'Hazem', createdAt: '2025-05-10 09:00:00', salesPersonId: 'test_sp_3', salesPersonCommissionAmount: 204, commissionPaidToSalesPerson: false, collectedBySalesPerson: true, collectedDate: '2025-06-01' },
    // 10: Confirmed, different supplier
    { id: 10, checkIn: '2025-06-15', checkOut: '2025-06-20', nights: 5, clientId: 'test_client_1', hotelId: hotel2.id, guestName: 'Khalid Al-Otaibi', guestNationality: 'Saudi', supplierId: 'test_supplier_3', rooms: [{ id: 'r10', roomType: roomTypes.length > 1 ? roomTypes[1] : roomTypes[0], qty: 2, nightlyRates: { '2025-06-15': 1000, '2025-06-16': 1000, '2025-06-17': 1000, '2025-06-18': 1000, '2025-06-19': 1000 }, buyRate: { '2025-06-15': 680, '2025-06-16': 680, '2025-06-17': 680, '2025-06-18': 680, '2025-06-19': 680 }, mealPlan: 'HB', hasSeparateMealRate: false, mealRate: 0, pax: 2, view: 'Haram' }], status: 'Confirmed', amountPaidByClient: 10000, amountPaidToSupplier: 6800, createdBy: 'Hazem', createdAt: '2025-05-20 14:00:00', salesPersonId: 'test_sp_1', salesPersonCommissionAmount: 500, commissionPaidToSalesPerson: false },
  ];

  // ===== Transactions (linked to reservations) =====
  const testTransactions: Transaction[] = [
    // RSV-1: Client paid 6400 (2 payments)
    { id: 'tr_1', docNo: 'DOC-001', date: '2025-01-20', type: 'ClientPayment', amount: 3200, fromAccountId: 'acc_bank_1', reservationId: '1', agentId: 'test_client_1', description: 'Down payment for RSV-1', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-001', createdBy: 'Hazem' },
    { id: 'tr_2', docNo: 'DOC-002', date: '2025-02-05', type: 'ClientPayment', amount: 3200, fromAccountId: 'acc_bank_1', reservationId: '1', agentId: 'test_client_1', description: 'Final payment for RSV-1', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-002', createdBy: 'Hazem' },
    // RSV-1: Supplier paid 4400
    { id: 'tr_3', docNo: 'DOC-003', date: '2025-02-08', type: 'SupplierPayment', amount: 4400, fromAccountId: 'acc_bank_1', reservationId: '1', agentId: 'test_supplier_1', description: 'Supplier payment for RSV-1', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-003', createdBy: 'Hazem' },
    // RSV-2: Client paid 3600 (1 payment)
    { id: 'tr_4', docNo: 'DOC-004', date: '2025-02-25', type: 'ClientPayment', amount: 3600, fromAccountId: 'acc_bank_2', reservationId: '2', agentId: 'test_client_2', description: 'Full payment for RSV-2', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-004', createdBy: 'Hazem' },
    // RSV-2: Supplier paid 2400
    { id: 'tr_5', docNo: 'DOC-005', date: '2025-02-28', type: 'SupplierPayment', amount: 2400, fromAccountId: 'acc_bank_2', reservationId: '2', agentId: 'test_supplier_1', description: 'Supplier payment for RSV-2', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-005', createdBy: 'Hazem' },
    // RSV-3: Client paid 18000 (2 payments)
    { id: 'tr_6', docNo: 'DOC-006', date: '2025-03-01', type: 'ClientPayment', amount: 9000, fromAccountId: 'acc_bank_1', reservationId: '3', agentId: 'test_client_1', description: 'First installment RSV-3', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-006', createdBy: 'Hazem' },
    { id: 'tr_7', docNo: 'DOC-007', date: '2025-03-10', type: 'ClientPayment', amount: 9000, fromAccountId: 'acc_bank_1', reservationId: '3', agentId: 'test_client_1', description: 'Second installment RSV-3', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-007', createdBy: 'Hazem' },
    // RSV-3: Supplier paid 12000
    { id: 'tr_8', docNo: 'DOC-008', date: '2025-03-12', type: 'SupplierPayment', amount: 12000, fromAccountId: 'acc_bank_1', reservationId: '3', agentId: 'test_supplier_2', description: 'Supplier payment for RSV-3', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-008', createdBy: 'Hazem' },
    // RSV-5: Client paid 9100 (cash)
    { id: 'tr_9', docNo: 'DOC-009', date: '2025-04-08', type: 'ClientPayment', amount: 9100, fromAccountId: 'acc_cash_1', reservationId: '5', agentId: 'test_client_4', description: 'Full cash payment RSV-5 (KSA collection)', paymentMethod: 'Cash', voucherNo: 'CASH-REC-001', createdBy: 'Hazem' },
    // RSV-5: Supplier paid 5880
    { id: 'tr_10', docNo: 'DOC-010', date: '2025-04-09', type: 'SupplierPayment', amount: 5880, fromAccountId: 'acc_bank_1', reservationId: '5', agentId: 'test_supplier_2', description: 'Supplier payment for RSV-5', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-009', createdBy: 'Hazem' },
    // RSV-6: Client refund 500 (cancelled)
    { id: 'tr_11', docNo: 'DOC-011', date: '2025-03-25', type: 'ClientRefund', amount: 500, fromAccountId: 'acc_cash_1', reservationId: '6', agentId: 'test_client_2', description: 'Partial refund for cancelled RSV-6 (kept 500 cancellation fee)', paymentMethod: 'Cash', voucherNo: 'CASH-REC-002', createdBy: 'Hazem' },
    // RSV-8: Client paid 2100
    { id: 'tr_12', docNo: 'DOC-012', date: '2025-04-20', type: 'ClientPayment', amount: 2100, fromAccountId: 'acc_bank_2', reservationId: '8', agentId: 'test_client_4', description: 'Full payment for RSV-8', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-010', createdBy: 'Hazem' },
    // RSV-8: Supplier paid 1350
    { id: 'tr_13', docNo: 'DOC-013', date: '2025-04-22', type: 'SupplierPayment', amount: 1350, fromAccountId: 'acc_bank_2', reservationId: '8', agentId: 'test_supplier_1', description: 'Supplier payment for RSV-8', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-011', createdBy: 'Hazem' },
    // RSV-9: Client paid 3400 (KSA cash)
    { id: 'tr_14', docNo: 'DOC-014', date: '2025-05-28', type: 'ClientPayment', amount: 3400, fromAccountId: 'acc_cash_1', reservationId: '9', agentId: 'test_client_5', description: 'Full cash payment RSV-9 (KSA collection)', paymentMethod: 'Cash', voucherNo: 'CASH-REC-003', createdBy: 'Hazem' },
    // RSV-9: Supplier paid 2200
    { id: 'tr_15', docNo: 'DOC-015', date: '2025-05-30', type: 'SupplierPayment', amount: 2200, fromAccountId: 'acc_bank_1', reservationId: '9', agentId: 'test_supplier_3', description: 'Supplier payment for RSV-9', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-012', createdBy: 'Hazem' },
    // RSV-10: Client paid 10000 (2 payments)
    { id: 'tr_16', docNo: 'DOC-016', date: '2025-05-25', type: 'ClientPayment', amount: 5000, fromAccountId: 'acc_bank_1', reservationId: '10', agentId: 'test_client_1', description: 'Down payment RSV-10', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-013', createdBy: 'Hazem' },
    { id: 'tr_17', docNo: 'DOC-017', date: '2025-06-10', type: 'ClientPayment', amount: 5000, fromAccountId: 'acc_bank_1', reservationId: '10', agentId: 'test_client_1', description: 'Final payment RSV-10', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-014', createdBy: 'Hazem' },
    // RSV-10: Supplier paid 6800
    { id: 'tr_18', docNo: 'DOC-018', date: '2025-06-12', type: 'SupplierPayment', amount: 6800, fromAccountId: 'acc_bank_1', reservationId: '10', agentId: 'test_supplier_3', description: 'Supplier payment for RSV-10', paymentMethod: 'Bank Transfer', voucherNo: 'BANK-REC-015', createdBy: 'Hazem' },
  ];

  // ===== Follow-Ups (Sales CRM) =====
  const testFollowUps: FollowUp[] = [
    { id: 'fu_1', clientId: 'test_client_1', date: '2025-06-10', topic: 'Ramadan package inquiry', notes: 'Client interested in 5-star Makkah packages for Ramadan group of 30 pax', status: 'Pending', createdBy: 'Hazem', activityLog: [{ id: 'al_1', timestamp: '2025-05-20 10:00:00', user: 'Hazem', action: 'Created follow-up', detail: 'Initial inquiry from client' }] },
    { id: 'fu_2', clientId: 'test_client_2', date: '2025-05-15', topic: 'Summer rates negotiation', notes: 'Discussing special rates for June-August bookings. Sent rate sheet.', status: 'Completed', createdBy: 'Hazem', activityLog: [{ id: 'al_2', timestamp: '2025-05-10 14:00:00', user: 'Hazem', action: 'Created follow-up', detail: 'Rate negotiation initiated' }, { id: 'al_3', timestamp: '2025-05-15 16:30:00', user: 'Hazem', action: 'Sent summer rate sheet via email', detail: 'Rate sheet PDF attached' }] },
    { id: 'fu_3', clientId: 'test_client_3', date: '2025-06-20', topic: 'Tentative booking confirmation', notes: 'Waiting for client decision on RSV-4 and RSV-7. Option date approaching.', status: 'Pending', createdBy: 'Hazem', activityLog: [{ id: 'al_4', timestamp: '2025-06-01 09:00:00', user: 'Hazem', action: 'Created follow-up', detail: 'Option dates approaching' }] },
    { id: 'fu_4', clientId: 'test_client_5', date: '2025-05-01', topic: 'New client onboarding', notes: 'Met at travel expo. Interested in regular Umrah group bookings.', status: 'Closed', createdBy: 'Hazem', activityLog: [{ id: 'al_5', timestamp: '2025-04-28 11:00:00', user: 'Hazem', action: 'Created follow-up', detail: 'Met at Jeddah travel expo' }, { id: 'al_6', timestamp: '2025-05-01 15:00:00', user: 'Hazem', action: 'Onboarded as client', detail: 'First booking RSV-9 created' }] },
  ];

  // ===== Cancellation Reasons =====
  const testCancellationReasons: CancellationReason[] = [
    { id: 'cr_1', reason: 'Guest changed travel plans', active: true },
    { id: 'cr_2', reason: 'Visa denied', active: true },
    { id: 'cr_3', reason: 'Medical emergency', active: true },
    { id: 'cr_4', reason: 'Flight cancelled by airline', active: true },
    { id: 'cr_5', reason: 'Client found cheaper rate', active: true },
    { id: 'cr_6', reason: 'Double booking error', active: true },
  ];

  // ===== Expense Categories =====
  const testExpenseCategories: ExpenseCategory[] = [
    { id: 'ec_1', name: 'Office Rent', active: true },
    { id: 'ec_2', name: 'Utilities', active: true },
    { id: 'ec_3', name: 'Marketing & Advertising', active: true },
    { id: 'ec_4', name: 'Transportation', active: true },
    { id: 'ec_5', name: 'Office Supplies', active: true },
    { id: 'ec_6', name: 'Staff Salaries', active: true },
  ];

  // ===== Expenses =====
  const testExpenses: Expense[] = [
    { id: 'exp_1', expenseNumber: 1, name: 'January Office Rent', category: 'Office Rent', amount: 5000, date: '2025-01-01', fromAccountId: 'acc_bank_1', description: 'Monthly office rent - January', createdBy: 'Hazem', createdAt: '2025-01-01 09:00:00' },
    { id: 'exp_2', expenseNumber: 2, name: 'Google Ads Campaign', category: 'Marketing & Advertising', amount: 1200, date: '2025-01-15', fromAccountId: 'acc_bank_1', description: 'Google Ads - Umrah packages campaign', createdBy: 'Hazem', createdAt: '2025-01-15 10:00:00' },
    { id: 'exp_3', expenseNumber: 3, name: 'Electricity Bill', category: 'Utilities', amount: 450, date: '2025-02-01', fromAccountId: 'acc_bank_1', description: 'SEC electricity bill - January', createdBy: 'Hazem', createdAt: '2025-02-01 11:00:00' },
    { id: 'exp_4', expenseNumber: 4, name: 'Airport Transfer Van', category: 'Transportation', amount: 800, date: '2025-02-10', fromAccountId: 'acc_cash_1', description: 'Van rental for guest airport transfers', createdBy: 'Hazem', createdAt: '2025-02-10 08:00:00' },
    { id: 'exp_5', expenseNumber: 5, name: 'Printer Cartridges', category: 'Office Supplies', amount: 350, date: '2025-03-01', fromAccountId: 'acc_cash_1', description: 'HP printer ink cartridges x4', createdBy: 'Hazem', createdAt: '2025-03-01 14:00:00' },
    { id: 'exp_6', expenseNumber: 6, name: 'February Office Rent', category: 'Office Rent', amount: 5000, date: '2025-02-01', fromAccountId: 'acc_bank_1', description: 'Monthly office rent - February', createdBy: 'Hazem', createdAt: '2025-02-01 09:00:00' },
    { id: 'exp_7', expenseNumber: 7, name: 'Social Media Manager', category: 'Marketing & Advertising', amount: 2000, date: '2025-03-05', fromAccountId: 'acc_bank_1', description: 'Freelance social media management - March', createdBy: 'Hazem', createdAt: '2025-03-05 10:00:00' },
    { id: 'exp_8', expenseNumber: 8, name: 'Internet Bill', category: 'Utilities', amount: 300, date: '2025-03-10', fromAccountId: 'acc_bank_1', description: 'STC fiber internet - March', createdBy: 'Hazem', createdAt: '2025-03-10 11:00:00' },
  ];

  // ===== Other Services =====
  const testOtherServices: OtherService[] = [
    { id: 'os_1', serviceType: 'Flight', clientId: 'test_client_1', description: 'SV Airlines - CAI to JED round trip', quantity: 2, sellPrice: 2400, buyPrice: 2000, taxRate: 15, date: '2025-01-20', status: 'Completed', invoiceNo: 'INV-SVC-001', notes: 'Economy class, 2 passengers', createdBy: 'Hazem', createdAt: '2025-01-20 10:00:00', details: { airline: 'Saudi Airlines', route: 'CAI-JED-CAI', departDate: '2025-02-10', returnDate: '2025-02-14' } },
    { id: 'os_2', serviceType: 'Visa', clientId: 'test_client_2', description: 'Umrah Visa Processing', quantity: 4, sellPrice: 800, buyPrice: 500, taxRate: 15, date: '2025-02-15', status: 'Completed', invoiceNo: 'INV-SVC-002', notes: 'Group visa processing - 4 passports', createdBy: 'Hazem', createdAt: '2025-02-15 14:00:00', details: { visaType: 'Umrah', processingDays: '5' } },
    { id: 'os_3', serviceType: 'Transportation', clientId: 'test_client_3', description: 'Airport to Hotel transfer - Makkah', quantity: 1, sellPrice: 500, buyPrice: 300, taxRate: 15, date: '2025-03-14', status: 'Confirmed', invoiceNo: 'INV-SVC-003', notes: 'Private SUV transfer for 3 pax', createdBy: 'Hazem', createdAt: '2025-03-14 09:00:00', details: { pickup: 'JED Airport', dropoff: 'Hotel Makkah', vehicleType: 'SUV' } },
    { id: 'os_4', serviceType: 'Flight', clientId: 'test_client_4', description: 'EgyptAir - CAI to JED', quantity: 3, sellPrice: 1800, buyPrice: 1500, taxRate: 15, date: '2025-04-05', status: 'Completed', invoiceNo: 'INV-SVC-004', createdBy: 'Hazem', createdAt: '2025-04-05 11:00:00', details: { airline: 'EgyptAir', route: 'CAI-JED', departDate: '2025-04-10' } },
    { id: 'os_5', serviceType: 'OutboundHotel', clientId: 'test_client_5', description: 'Cairo hotel booking - pre-departure', quantity: 1, sellPrice: 600, buyPrice: 400, taxRate: 15, date: '2025-05-25', status: 'Pending', invoiceNo: 'INV-SVC-005', notes: '1 night Cairo hotel before flight', createdBy: 'Hazem', createdAt: '2025-05-25 10:00:00', details: { hotelName: 'Steigenberger', city: 'Cairo', checkIn: '2025-05-31', checkOut: '2025-06-01' } },
  ];

  // ===== Agreement numbers and statuses for reservations =====
  testReservations[0].agreementNo = 'AGR-2025-001'; testReservations[0].agreementStatus = 'Approved'; testReservations[0].agreementConfirmed = true;
  testReservations[1].agreementNo = 'AGR-2025-002'; testReservations[1].agreementStatus = 'Approved'; testReservations[1].agreementConfirmed = true;
  testReservations[2].agreementNo = 'AGR-2025-003'; testReservations[2].agreementStatus = 'Pending'; testReservations[2].agreementConfirmed = false;
  testReservations[3].agreementNo = 'AGR-2025-004'; testReservations[3].agreementStatus = 'Pending'; testReservations[3].agreementConfirmed = false;
  testReservations[4].agreementNo = 'AGR-2025-005'; testReservations[4].agreementStatus = 'Approved'; testReservations[4].agreementConfirmed = true;
  testReservations[5].agreementNo = 'AGR-2025-006'; testReservations[5].agreementStatus = 'Declined'; testReservations[5].agreementConfirmed = false;
  testReservations[6].agreementNo = 'AGR-2025-007'; testReservations[6].agreementStatus = 'Pending'; testReservations[6].agreementConfirmed = false;
  testReservations[7].agreementNo = 'AGR-2025-008'; testReservations[7].agreementStatus = 'Approved'; testReservations[7].agreementConfirmed = true;
  testReservations[8].agreementNo = 'AGR-2025-009'; testReservations[8].agreementStatus = 'Pending'; testReservations[8].agreementConfirmed = false;
  testReservations[9].agreementNo = 'AGR-2025-010'; testReservations[9].agreementStatus = 'Approved'; testReservations[9].agreementConfirmed = true;

  // Add bank account IDs to some reservations
  testReservations[0].bankAccountId = 'acc_bank_1';
  testReservations[1].bankAccountId = 'acc_bank_2';
  testReservations[2].bankAccountId = 'acc_bank_1';
  testReservations[4].bankAccountId = 'acc_bank_1';
  testReservations[7].bankAccountId = 'acc_bank_2';
  testReservations[9].bankAccountId = 'acc_bank_1';

  // Add hotel confirmation numbers to confirmed reservations
  testReservations[0].hotelConfirmationNo = 'CONF-55901';
  testReservations[1].hotelConfirmationNo = 'CONF-55902';
  testReservations[2].hotelConfirmationNo = 'CONF-55903';
  testReservations[4].hotelConfirmationNo = 'CONF-55905';
  testReservations[7].hotelConfirmationNo = 'CONF-55908';
  testReservations[8].hotelConfirmationNo = 'CONF-55909';
  testReservations[9].hotelConfirmationNo = 'CONF-55910';

  // Add supplier voucher references
  testReservations[0].supplierVoucher = 'SUP-V-001';
  testReservations[1].supplierVoucher = 'SUP-V-002';
  testReservations[2].supplierVoucher = 'SUP-V-003';
  testReservations[4].supplierVoucher = 'SUP-V-005';
  testReservations[9].supplierVoucher = 'SUP-V-010';

  // ===== Terms & Conditions Templates =====
  const testTermsAndConditions: TermsAndConditions[] = [
    {
      id: 'tc_default',
      title: 'Standard Booking Terms & Conditions',
      content: `1. BOOKING CONFIRMATION: All bookings are subject to availability and confirmation by Zumra Hotels. A booking is only confirmed once a written confirmation with a confirmation number is issued.\n\n2. PAYMENT TERMS: Full payment is due 14 days before check-in unless otherwise agreed in writing. Late payments may result in cancellation without refund.\n\n3. CANCELLATION POLICY: Cancellations made more than 7 days before arrival are free of charge. Cancellations within 7 days incur a 50% fee. No-shows are charged in full.\n\n4. MODIFICATIONS: Changes to confirmed bookings (dates, room types, guest names) are subject to availability and current rates at the time of change.\n\n5. LIABILITY: Zumra Hotels acts solely as an agent between the guest and the hotel. We are not liable for acts, omissions, or defaults of any hotel.\n\n6. FORCE MAJEURE: Neither party shall be liable for failure to perform obligations due to circumstances beyond reasonable control (natural disasters, war, pandemics, government actions).\n\n7. DISPUTES: Any disputes shall be resolved through mutual negotiation first, then through arbitration in accordance with Saudi Arabian law.`,
      active: true,
      isDefault: true
    },
    {
      id: 'tc_group',
      title: 'Group Booking Terms & Conditions',
      content: `1. GROUP DEFINITION: A group booking is defined as 5 or more rooms booked under the same reference.\n\n2. DEPOSIT: A non-refundable deposit of 30% is required within 7 days of booking confirmation.\n\n3. FINAL PAYMENT: Full payment is due 21 days before group arrival.\n\n4. ROOM LIST: Final rooming list with guest names must be submitted 14 days before arrival.\n\n5. REDUCTIONS: Room count reductions of more than 10% after confirmation will incur a penalty equal to one night's stay per cancelled room.\n\n6. ATTRITION: If actual room usage falls below 80% of the blocked allocation, the client is liable for the shortfall at the contracted rate.\n\n7. SPECIAL REQUESTS: Group meal plans, transfers, and special arrangements must be confirmed at least 10 days before arrival.`,
      active: true,
      isDefault: false
    },
    {
      id: 'tc_ramadan',
      title: 'Ramadan & Hajj Season Terms',
      content: `1. SEASONAL RATES: All rates during Ramadan and Hajj season are subject to change based on hotel announcements.\n\n2. PAYMENT: 100% advance payment is required at the time of booking for peak season reservations.\n\n3. CANCELLATION: Peak season bookings are non-refundable. Credit may be offered at the discretion of the hotel for future stays.\n\n4. MODIFICATIONS: Date changes during peak season are treated as new bookings at prevailing rates.\n\n5. VISA REQUIREMENTS: Guests are responsible for obtaining valid visas. No refunds for visa denials during peak season.`,
      active: true,
      isDefault: false
    },
  ];

  // ===== Payment Gateways =====
  const testPaymentGateways: PaymentGateway[] = [
    { id: 'pg_1', name: 'Al Rajhi Bank Transfer', type: 'Bank', merchantId: 'RAJHI-MERCHANT-001', active: true },
    { id: 'pg_2', name: 'Moyasar - Visa/Mada', type: 'Visa', merchantId: 'MOY-001', apiKey: 'pk_test_moyasar_001', active: true },
    { id: 'pg_3', name: 'Apple Pay', type: 'ApplePay', merchantId: 'APPLE-ZUMRA-001', active: true },
    { id: 'pg_4', name: 'SNB Bank Transfer', type: 'Bank', merchantId: 'SNB-MERCHANT-001', active: true },
  ];

  // ===== Save everything =====
  const allAgents = [...testClients, ...testSuppliers];
  ZumraDB.saveAgents(allAgents);
  ZumraDB.saveReservations(testReservations);
  ZumraDB.saveSalesPersons(testSalesPersons);
  ZumraDB.saveAccounts(testAccounts);
  ZumraDB.saveTransactions(testTransactions);
  ZumraDB.saveFollowUps(testFollowUps);
  ZumraDB.saveCancellationReasons(testCancellationReasons);
  ZumraDB.saveExpenseCategories(testExpenseCategories);
  ZumraDB.saveExpenses(testExpenses);
  ZumraDB.saveOtherServices(testOtherServices);
  ZumraDB.saveTermsAndConditions(testTermsAndConditions);
  ZumraDB.savePaymentGateways(testPaymentGateways);
}

