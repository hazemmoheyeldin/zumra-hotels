/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Agent, Allotment, Reservation, Account, Transaction, User, FollowUp, ExternalTransfer, GlobalAuditEntry, SalesPerson, CancellationReason, TermsAndConditions, OtherService, PaymentGateway, PayByLink, EditApprovalRequest, TaxSettings, Expense, ExpenseCategory, ConsolidatedInvoice } from '../types';
import { firestoreSave, firestoreDelete, firestoreBulkSave, firestoreLoadAll, isFirebaseConfigured, COLLECTIONS } from './firebase';
import { CSV_HOTELS } from './csvHotels';

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
      console.log(`[Hotels] Migrating hotel data from v${savedVersion} to v${HOTEL_DATA_VERSION} (${CSV_HOTELS.length} hotels from xlsx)`);
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
        lifetimeTxSum += tr.amount;
      } else if (isSupplier && tr.type === 'SupplierPayment') {
        lifetimeTxSum += tr.amount;
      } else if (!isSupplier && tr.type === 'ClientRefund') {
        lifetimeTxSum -= tr.amount; // Refunds reverse payment effect
      } else if (isSupplier && tr.type === 'SupplierRefund') {
        lifetimeTxSum -= tr.amount;
      }
    }
  });

  const originalOpeningBalance = isSupplier 
    ? (agent.balance + lifetimeTxSum) 
    : (agent.balance - lifetimeTxSum);

  let actualBalance = originalOpeningBalance;

  reservations.forEach(res => {
    if (!isSupplier && res.clientId === agent.id) {
      const { totalSell } = getReservationTotals(res);
      actualBalance += totalSell; 
    }
    if (isSupplier && res.supplierId === agent.id) {
      const { totalBuy } = getReservationTotals(res);
      actualBalance += totalBuy; 
    }
  });

  transactions.forEach(tr => {
    if (tr.agentId === agent.id) {
      if (!isSupplier && tr.type === 'ClientPayment') {
        actualBalance -= tr.amount; 
      } else if (isSupplier && tr.type === 'SupplierPayment') {
        actualBalance -= tr.amount; 
      } else if (!isSupplier && tr.type === 'ClientRefund') {
        actualBalance += tr.amount; // Refund adds back to what they owe
      } else if (isSupplier && tr.type === 'SupplierRefund') {
        actualBalance += tr.amount; // Supplier refund adds back to what we owe
      }
    }
  });

  return actualBalance;
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

    totalSell += baseRoomSell + mealSell + extraBedSell + viewSuppSell + extraMeal1Sell + extraMeal2Sell;
    totalBuy += baseRoomBuy + mealBuy + extraBedBuy + viewSuppBuy + extraMeal1Buy + extraMeal2Buy;
  });

  const profit = totalSell - totalBuy;
  const markupPct = totalBuy > 0 ? ((profit / totalBuy) * 100) : 0;
  const vat = totalSell * 0.15; // 15% VAT
  const totalWithVat = totalSell + vat;

  return {
    totalSell,
    totalBuy,
    profit,
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
    const ws = XLSX.utils.json_to_sheet(rows);
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
    } catch (err) {
      item.retries++;
      if (item.retries >= MAX_RETRIES) {
        console.error(`[SyncQueue] Dropping item after ${MAX_RETRIES} retries:`, item);
        removeFromQueue(item.id);
      }
      failed++;
    }
  }

  _isSyncing = false;
  notifySyncListeners();
  if (success > 0) {
    console.log(`[SyncQueue] Flushed ${success} items to Firestore (${failed} failed)`);
  }
  return { success, failed };
}

// --- Network status tracking ---
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('[Sync] Network online - flushing queue');
    notifySyncListeners();
    flushSyncQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    console.warn('[Sync] Network offline - queueing writes');
    notifySyncListeners();
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
  if (!isFirebaseConfigured || !item?.id) return;
  if (!isOnline) {
    addToQueue({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'save', collection: collectionName, docId: item.id, data: item, timestamp: Date.now(), retries: 0 });
    return;
  }
  try {
    await firestoreSave(collectionName, item.id, item);
  } catch {
    addToQueue({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'save', collection: collectionName, docId: item.id, data: item, timestamp: Date.now(), retries: 0 });
  }
}

export async function syncDeleteToFirestore(collectionName: string, id: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  if (!isOnline) {
    addToQueue({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'delete', collection: collectionName, docId: id, timestamp: Date.now(), retries: 0 });
    return;
  }
  try {
    await firestoreDelete(collectionName, id);
  } catch {
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

