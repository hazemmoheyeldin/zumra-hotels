/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { ZumraDB, ZumraSync, isRecentLocalWrite, getSyncStatus, onSyncStatusChange, flushSyncQueue, SyncStatus } from './lib/storage';
import { Hotel, Agent, Allotment, Reservation, Account, Transaction, User, FollowUp, ExternalTransfer, RefundAlert, GlobalAuditEntry, SalesPerson, CancellationReason, TermsAndConditions, OtherService, PaymentGateway, PayByLink, EditApprovalRequest, TaxSettings, Expense, ExpenseCategory, ConsolidatedInvoice } from './types';
import { getEgyptTime, getReservationTotals, loadFromFirestore, getNextVoucherNo, getNextDocNo } from './lib/storage';
import { isFirebaseConfigured, firestoreSubscribe, firestoreLoadAll, firestoreBulkSave, COLLECTIONS } from './lib/firebase';
import { useLang } from './lib/LanguageContext';
import { TranslationKey } from './lib/i18n';
import Dashboard from './components/Dashboard';
import ReservationsPage from './components/ReservationsPage';
import HotelsPage from './components/HotelsPage';
import AgentsPage from './components/AgentsPage';
import AllotmentsPage from './components/AllotmentsPage';
import TransactionsPage from './components/TransactionsPage';
import ExternalTransfersPage from './components/ExternalTransfersPage';
import AccountsPage from './components/AccountsPage';
import ReportsPage from './components/ReportsPage';
import UserManagementPage from './components/UserManagementPage';
import SalesPage from './components/SalesPage';
import ProductionPage from './components/ProductionPage';
import ZumraLogo from './components/ZumraLogo';
import LoginPage from './components/LoginPage';
import InboxModal from './components/InboxModal';
import CalendarView from './components/CalendarView';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AuditLogPage from './components/AuditLogPage';
import InvoicePDF from './components/InvoicePDF';
import ErrorBoundary from './components/ErrorBoundary';
import ConfirmDialog from './components/ConfirmDialog';
import GeneralDataPage from './components/GeneralDataPage';
import OtherServicesPage from './components/OtherServicesPage';
import PaymentGatewaysPage from './components/PaymentGatewaysPage';
import ExpensesPage from './components/ExpensesPage';
import EditApprovalModal from './components/EditApprovalModal';
import { SessionTimeout } from './lib/security';
import { ToastContainer, useToast } from './components/Toast';
import { seedHotelsIfEmpty } from './lib/hotelSeed';

const THEMES = [
  {
    id: 'zumra-signature',
    name: 'Zumra Signature',
    emoji: '✨',
    sidebarBg: 'bg-[#0f172a]',
    sidebarBorder: 'border-white/[0.06]',
    sidebarHover: 'hover:bg-white/[0.06]',
    sidebarActive: 'bg-white/[0.10] text-white',
    sidebarText: 'text-slate-300',
    brandBg: 'bg-amber-500',
    brandText: 'text-amber-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-sm',
    badgeBg: 'bg-slate-100 text-slate-700',
    footerText: 'text-slate-500',
    topBarGradient: 'from-[#0f172a] via-slate-700 to-slate-900',
  },
  {
    id: 'executive',
    name: 'Executive White',
    emoji: '🏛️',
    mainBg: 'bg-slate-100 min-h-screen font-sans flex flex-col md:flex-row print:bg-white print:min-h-0 select-none text-slate-800',
    sidebarBg: 'bg-white',
    sidebarBorder: 'border-slate-200',
    sidebarHover: 'hover:bg-slate-50',
    sidebarActive: 'bg-slate-100 text-slate-900',
    sidebarText: 'text-slate-500',
    brandBg: 'bg-slate-800',
    brandText: 'text-slate-800',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm',
    badgeBg: 'bg-slate-100 text-slate-700',
    footerText: 'text-slate-500',
    topBarGradient: 'from-slate-700 via-slate-500 to-slate-300',
  },
  {
    id: 'harbor',
    name: 'Harbor Teal',
    emoji: '⚓',
    sidebarBg: 'bg-[#0c1929]',
    sidebarBorder: 'border-white/[0.06]',
    sidebarHover: 'hover:bg-teal-500/[0.08]',
    sidebarActive: 'bg-teal-500/[0.12] text-teal-300',
    sidebarText: 'text-slate-400',
    brandBg: 'bg-teal-500',
    brandText: 'text-teal-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm',
    badgeBg: 'bg-teal-50 text-teal-700',
    footerText: 'text-slate-500',
    topBarGradient: 'from-teal-500 via-slate-600 to-[#0c1929]',
  },
  {
    id: 'graphite',
    name: 'Graphite Warm',
    emoji: '🪨',
    sidebarBg: 'bg-[#1a1a1a]',
    sidebarBorder: 'border-white/[0.06]',
    sidebarHover: 'hover:bg-white/[0.05]',
    sidebarActive: 'bg-amber-500/[0.12] text-amber-300',
    sidebarText: 'text-neutral-400',
    brandBg: 'bg-amber-600',
    brandText: 'text-amber-500',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm',
    badgeBg: 'bg-amber-50 text-amber-800',
    footerText: 'text-slate-500',
    topBarGradient: 'from-amber-500 via-neutral-600 to-[#1a1a1a]',
  },
];

export default function App() {
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<string>('Dashboard');
  const [activeFilters, setActiveFilters] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t, lang } = useLang();
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string;
    variant: 'standard' | 'destructive'; action: (() => void) | null;
  }>({ open: false, title: '', message: '', variant: 'standard', action: null });

  const showConfirm = (title: string, message: string, action: () => void, variant: 'standard' | 'destructive' = 'standard') => {
    setConfirmDialog({ open: true, title, message, variant, action });
  };
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false, action: null }));
  const executeConfirm = () => { confirmDialog.action?.(); closeConfirm(); };

  // App Master States
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [externalTransfers, setExternalTransfers] = useState<ExternalTransfer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [auditLog, setAuditLog] = useState<GlobalAuditEntry[]>([]);
  // New collection states
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [cancellationReasons, setCancellationReasons] = useState<CancellationReason[]>([]);
  const [termsAndConditions, setTermsAndConditions] = useState<TermsAndConditions[]>([]);
  const [otherServices, setOtherServices] = useState<OtherService[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [payByLinks, setPayByLinks] = useState<PayByLink[]>([]);
  const [editApprovals, setEditApprovals] = useState<EditApprovalRequest[]>([]);
  const [taxSettings, setTaxSettings] = useState<TaxSettings[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [consolidatedInvoices, setConsolidatedInvoices] = useState<ConsolidatedInvoice[]>([]);
  const [showEditApprovalModal, setShowEditApprovalModal] = useState(false);
  // Restore session from localStorage if user was previously logged in
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('zumra_current_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user && user.username && user.role) return user as User;
      }
    } catch {}
    return null;
  });

  // Theme states
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    return localStorage.getItem('zumra_theme') || 'zumra-signature';
  });

  const handleSetTheme = (themeId: string) => {
    setActiveThemeId(themeId);
    localStorage.setItem('zumra_theme', themeId);
  };

  const currentTheme = THEMES.find(t => t.id === activeThemeId) || THEMES[0];

  // Derive simple alerts for headers
  const getAlerts = () => {
    let alerts: {id: string, type: string, message: string, resId: string}[] = [];
    const nowStr = getEgyptTime().toISOString().split('T')[0];
    const nowDate = new Date(nowStr);
    reservations.forEach(res => {
      const { totalBuy, totalSell } = getReservationTotals(res);
      const isPastCheckIn = res.checkIn < nowStr;
      
      const clientOwes = totalSell - (res.amountPaidByClient || 0);
      const weOweSupplier = totalBuy - (res.amountPaidToSupplier || 0);
      
      if (isPastCheckIn && (clientOwes > 0 || weOweSupplier > 0)) {
        alerts.push({
          id: `late_${res.id}`,
          type: 'Late Payment',
          message: `Late payment for RSV-${res.id} (${res.guestName})`,
          resId: res.id.toString(),
        });
      }

      // 14-day pre-checkin unpaid notification for confirmed bookings
      if (res.status === 'Confirmed' && !isPastCheckIn) {
        const checkInDate = new Date(res.checkIn);
        const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilCheckIn <= 14 && daysUntilCheckIn >= 0 && clientOwes > 0) {
          alerts.push({
            id: `unpaid_14d_${res.id}`,
            type: 'Upcoming Unpaid',
            message: `RSV-${res.id} (${res.guestName}) check-in in ${daysUntilCheckIn} days - Client owes ${clientOwes.toLocaleString()} SAR`,
            resId: res.id.toString(),
          });
        }
      }
    });
    return alerts;
  };
  
  const currentAlerts = getAlerts();
  const alertCount = currentAlerts.length;

  // Initial DB loading, Firestore migration, and real-time sync
  useEffect(() => {
    // 1. Instant UI load from localStorage
    setHotels(ZumraDB.getHotels());
    setAgents(ZumraDB.getAgents());
    setAllotments(ZumraDB.getAllotments());
    setReservations(ZumraDB.getReservations());
    setAccounts(ZumraDB.getAccounts());
    setTransactions(ZumraDB.getTransactions());
    setExternalTransfers(ZumraDB.getExternalTransfers());
    const loadedUsers = ZumraDB.getUsers();
    // Ensure default admin user always exists
    const hasAdmin = loadedUsers.some(u => u.username === 'hazem');
    if (!hasAdmin) {
      const defaultAdmin: User = {
        id: 'admin-hazem',
        username: 'hazem',
        name: 'Hazem Mohey Eldin',
        role: 'Admin',
        email: 'hazem8383@gmail.com',
        password: 'hazem123',
        mustChangePassword: false,
      };
      const updatedUsers = [...loadedUsers, defaultAdmin];
      ZumraDB.saveUsers(updatedUsers);
      setUsers(updatedUsers);
      // Sync to Firestore if available
      if (isFirebaseConfigured) {
        ZumraSync.saveUser(defaultAdmin);
      }
    } else {
      setUsers(loadedUsers);
    }
    setFollowUps(ZumraDB.getFollowUps());
    setAuditLog(ZumraDB.getAuditLog());
    // Load new collections
    setSalesPersons(ZumraDB.getSalesPersons());
    setCancellationReasons(ZumraDB.getCancellationReasons());
    setTermsAndConditions(ZumraDB.getTermsAndConditions());
    setOtherServices(ZumraDB.getOtherServices());
    setPaymentGateways(ZumraDB.getPaymentGateways());
    setPayByLinks(ZumraDB.getPayByLinks());
    setEditApprovals(ZumraDB.getEditApprovals());
    setTaxSettings(ZumraDB.getTaxSettings());
    setExpenses(ZumraDB.getExpenses());
    setExpenseCategories(ZumraDB.getExpenseCategories());
    setConsolidatedInvoices(ZumraDB.getConsolidatedInvoices());
    // Seed hotels if empty (first run or force reset)
    const seededHotels = seedHotelsIfEmpty(false);
    if (seededHotels.length > 0 && ZumraDB.getHotels().length === 0) {
      setHotels(seededHotels);
    }
    // Session is restored from localStorage via useState initializer above

    if (isFirebaseConfigured) {
      console.log('[Firebase] Cloud sync enabled - attaching real-time listeners');

      // 2. Initial Firestore data migration (runs once)
      const migrateData = async () => {
        try {
          const collections: Array<{name: string; key: string; setter: (d: any[]) => void; loader: () => any[]}> = [
            { name: COLLECTIONS.HOTELS, key: 'zumra_hotels', setter: setHotels, loader: ZumraDB.getHotels },
            { name: COLLECTIONS.AGENTS, key: 'zumra_agents', setter: setAgents, loader: ZumraDB.getAgents },
            { name: COLLECTIONS.ALLOTMENTS, key: 'zumra_allotments', setter: setAllotments, loader: ZumraDB.getAllotments },
            { name: COLLECTIONS.RESERVATIONS, key: 'zumra_reservations', setter: setReservations, loader: ZumraDB.getReservations },
            { name: COLLECTIONS.ACCOUNTS, key: 'zumra_accounts', setter: setAccounts, loader: ZumraDB.getAccounts },
            { name: COLLECTIONS.TRANSACTIONS, key: 'zumra_transactions', setter: setTransactions, loader: ZumraDB.getTransactions },
            { name: COLLECTIONS.EXTERNAL_TRANSFERS, key: 'zumra_external_transfers', setter: setExternalTransfers, loader: ZumraDB.getExternalTransfers },
            { name: COLLECTIONS.USERS, key: 'zumra_users', setter: setUsers, loader: ZumraDB.getUsers },
            { name: COLLECTIONS.FOLLOW_UPS, key: 'zumra_follow_ups', setter: setFollowUps, loader: ZumraDB.getFollowUps },
            { name: COLLECTIONS.SALES_PERSONS, key: 'zumra_sales_persons', setter: setSalesPersons, loader: ZumraDB.getSalesPersons },
            { name: COLLECTIONS.CANCELLATION_REASONS, key: 'zumra_cancellation_reasons', setter: setCancellationReasons, loader: ZumraDB.getCancellationReasons },
            { name: COLLECTIONS.TERMS_CONDITIONS, key: 'zumra_terms_conditions', setter: setTermsAndConditions, loader: ZumraDB.getTermsAndConditions },
            { name: COLLECTIONS.OTHER_SERVICES, key: 'zumra_other_services', setter: setOtherServices, loader: ZumraDB.getOtherServices },
            { name: COLLECTIONS.PAYMENT_GATEWAYS, key: 'zumra_payment_gateways', setter: setPaymentGateways, loader: ZumraDB.getPaymentGateways },
            { name: COLLECTIONS.PAY_BY_LINKS, key: 'zumra_pay_by_links', setter: setPayByLinks, loader: ZumraDB.getPayByLinks },
            { name: COLLECTIONS.EDIT_APPROVALS, key: 'zumra_edit_approvals', setter: setEditApprovals, loader: ZumraDB.getEditApprovals },
            { name: COLLECTIONS.TAX_SETTINGS, key: 'zumra_tax_settings', setter: setTaxSettings, loader: ZumraDB.getTaxSettings },
            { name: COLLECTIONS.EXPENSES, key: 'zumra_expenses', setter: setExpenses, loader: ZumraDB.getExpenses },
            { name: COLLECTIONS.EXPENSE_CATEGORIES, key: 'zumra_expense_categories', setter: setExpenseCategories, loader: ZumraDB.getExpenseCategories },
            { name: COLLECTIONS.CONSOLIDATED_INVOICES, key: 'zumra_consolidated_invoices', setter: setConsolidatedInvoices, loader: ZumraDB.getConsolidatedInvoices },
          ];

          for (const col of collections) {
            const firestoreData = await firestoreLoadAll(col.name);
            // Special handling for hotels: if xlsx migration just happened, push new hotels to Firestore
            if (col.name === COLLECTIONS.HOTELS && localStorage.getItem('zumra_hotels_migrated') === 'true') {
              const freshHotels = ZumraDB.getHotels();
              if (freshHotels.length >= 1800) {
                console.log(`[Firebase] Pushing ${freshHotels.length} new xlsx hotels to Firestore`);
                await firestoreBulkSave(col.name, freshHotels);
                col.setter(freshHotels);
                localStorage.removeItem('zumra_hotels_migrated');
                continue;
              }
            }
            if (firestoreData.length > 0) {
              // Firestore has data -> use it, update localStorage cache
              localStorage.setItem(col.key, JSON.stringify(firestoreData));
              col.setter(firestoreData);
            } else {
              // Firestore empty -> upload localStorage data to seed it
              const localData = col.loader();
              if (localData.length > 0) {
                await firestoreBulkSave(col.name, localData);
                console.log(`[Firebase] Migrated ${localData.length} items from localStorage to ${col.name}`);
              }
            }
          }
          console.log('[Firebase] Initial data migration complete');
        } catch (err) {
          console.warn('[Firebase] Migration error, continuing with localStorage data:', err);
        }
      };
      migrateData();

      // 3. Attach real-time Firestore listeners for cross-device sync
      // Listeners suppress updates for 3s after local writes to prevent echo/race conditions
      const unsubs = [
        firestoreSubscribe<Hotel>(COLLECTIONS.HOTELS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite() && !localStorage.getItem('zumra_hotels_migrated')) {
            localStorage.setItem('zumra_hotels', JSON.stringify(data));
            setHotels(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Agent>(COLLECTIONS.AGENTS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_agents', JSON.stringify(data));
            setAgents(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Allotment>(COLLECTIONS.ALLOTMENTS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_allotments', JSON.stringify(data));
            setAllotments(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Reservation>(COLLECTIONS.RESERVATIONS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_reservations', JSON.stringify(data));
            setReservations(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Account>(COLLECTIONS.ACCOUNTS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_accounts', JSON.stringify(data));
            setAccounts(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Transaction>(COLLECTIONS.TRANSACTIONS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_transactions', JSON.stringify(data));
            setTransactions(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<ExternalTransfer>(COLLECTIONS.EXTERNAL_TRANSFERS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_external_transfers', JSON.stringify(data));
            setExternalTransfers(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<User>(COLLECTIONS.USERS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_users', JSON.stringify(data));
            setUsers(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<FollowUp>(COLLECTIONS.FOLLOW_UPS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_follow_ups', JSON.stringify(data));
            setFollowUps(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<SalesPerson>(COLLECTIONS.SALES_PERSONS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_sales_persons', JSON.stringify(data));
            setSalesPersons(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<CancellationReason>(COLLECTIONS.CANCELLATION_REASONS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_cancellation_reasons', JSON.stringify(data));
            setCancellationReasons(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<TermsAndConditions>(COLLECTIONS.TERMS_CONDITIONS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_terms_conditions', JSON.stringify(data));
            setTermsAndConditions(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<OtherService>(COLLECTIONS.OTHER_SERVICES, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_other_services', JSON.stringify(data));
            setOtherServices(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<PaymentGateway>(COLLECTIONS.PAYMENT_GATEWAYS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_payment_gateways', JSON.stringify(data));
            setPaymentGateways(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<PayByLink>(COLLECTIONS.PAY_BY_LINKS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_pay_by_links', JSON.stringify(data));
            setPayByLinks(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<EditApprovalRequest>(COLLECTIONS.EDIT_APPROVALS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_edit_approvals', JSON.stringify(data));
            setEditApprovals(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<TaxSettings>(COLLECTIONS.TAX_SETTINGS, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_tax_settings', JSON.stringify(data));
            setTaxSettings(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Expense>(COLLECTIONS.EXPENSES, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_expenses', JSON.stringify(data));
            setExpenses(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<ExpenseCategory>(COLLECTIONS.EXPENSE_CATEGORIES, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_expense_categories', JSON.stringify(data));
            setExpenseCategories(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<ConsolidatedInvoice>(COLLECTIONS.CONSOLIDATED_INVOICES, (data) => {
          if (data.length > 0 && !isRecentLocalWrite()) {
            localStorage.setItem('zumra_consolidated_invoices', JSON.stringify(data));
            setConsolidatedInvoices(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
      ];

      // Also listen for cross-tab localStorage changes (for theme etc.)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'zumra_theme') {
          setActiveThemeId(e.newValue || 'zumra-signature');
        }
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        unsubs.forEach(unsub => unsub());
        window.removeEventListener('storage', handleStorage);
      };
    } else {
      // Firebase not configured - fallback to localStorage polling
      console.log('[Firebase] Not configured - using localStorage only');
      const runSync = () => {
        try {
          setHotels(prev => {
            const fresh = ZumraDB.getHotels();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setAgents(prev => {
            const fresh = ZumraDB.getAgents();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setAllotments(prev => {
            const fresh = ZumraDB.getAllotments();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setReservations(prev => {
            const fresh = ZumraDB.getReservations();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setAccounts(prev => {
            const fresh = ZumraDB.getAccounts();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setTransactions(prev => {
            const fresh = ZumraDB.getTransactions();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setExternalTransfers(prev => {
            const fresh = ZumraDB.getExternalTransfers();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setUsers(prev => {
            const fresh = ZumraDB.getUsers();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
          setFollowUps(prev => {
            const fresh = ZumraDB.getFollowUps();
            return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
          });
        } catch (err) {
          console.warn('Silent back storage synchronization error:', err);
        }
      };
      const handleStorage = (e: StorageEvent) => {
        if (e.key && e.key.startsWith('zumra_')) runSync();
      };
      window.addEventListener('storage', handleStorage);
      const interval = setInterval(runSync, 1500);
      return () => {
        window.removeEventListener('storage', handleStorage);
        clearInterval(interval);
      };
    }
  }, []);

  // Session timeout - auto logout after 30 minutes of inactivity
  useEffect(() => {
    if (!currentUser) return;
    const session = new SessionTimeout(30 * 60 * 1000, () => {
      handleSetCurrentUser(null as any);
      toast.warning('Session expired due to inactivity. Please log in again.');
    });
    session.start();
    return () => session.stop();
  }, [currentUser]);

  // Edit Approval handlers
  const handleRequestEditApproval = (request: EditApprovalRequest) => {
    const updated = [...editApprovals, request];
    setEditApprovals(updated);
    ZumraDB.saveEditApprovals(updated);
    ZumraSync.saveEditApproval(request);
    toast.success('Edit request submitted for approval');
  };

  const handleApproveEdit = (id: string) => {
    const approval = editApprovals.find(a => a.id === id);
    if (!approval) return;
    // Apply the changes to the reservation
    const updatedReservations = reservations.map(r => {
      if (r.id === approval.reservationId) {
        return { ...r, ...approval.newSnapshot };
      }
      return r;
    });
    setReservations(updatedReservations);
    ZumraDB.saveReservations(updatedReservations);
    const updatedRes = updatedReservations.find(r => r.id === approval.reservationId);
    if (updatedRes) ZumraSync.saveReservation(updatedRes);
    // Update approval status
    const updatedApprovals = editApprovals.map(a =>
      a.id === id ? { ...a, status: 'Approved' as const, approvedBy: currentUser?.name, approvedAt: new Date().toISOString() } : a
    );
    setEditApprovals(updatedApprovals);
    ZumraDB.saveEditApprovals(updatedApprovals);
    ZumraSync.saveEditApproval(updatedApprovals.find(a => a.id === id)!);
    toast.success('Edit approved and applied');
  };

  const handleRejectEdit = (id: string, reason: string) => {
    const updatedApprovals = editApprovals.map(a =>
      a.id === id ? { ...a, status: 'Rejected' as const, approvedBy: currentUser?.name, approvedAt: new Date().toISOString() } : a
    );
    setEditApprovals(updatedApprovals);
    ZumraDB.saveEditApprovals(updatedApprovals);
    ZumraSync.saveEditApproval(updatedApprovals.find(a => a.id === id)!);
    toast.success(`Edit rejected${reason ? `: ${reason}` : ''}`);
  };

  // Wrapper for onLogAudit that matches the 4-param signature used by new components
  const handleLogAuditSimple = (action: string, entityType: string, entityId: string, detail: string) => {
    handleLogAudit({
      action,
      entityType: entityType as any,
      entityId,
      detail,
      user: currentUser?.name || 'unknown',
    });
  };

  // Sync savers (internal — called after confirmation)
  const doSaveHotel = (h: Hotel) => {
    const isNew = !hotels.some(item => item.id === h.id);
    // Auto-assign hotel number for new hotels
    if (isNew && !h.hotelNumber) {
      const highestNum = hotels.reduce((max, hotel) => (hotel.hotelNumber || 0) > max ? (hotel.hotelNumber || 0) : max, 0);
      h = { ...h, hotelNumber: highestNum + 1 };
    }
    const updated = hotels.map(item => item.id === h.id ? h : item);
    if (isNew) updated.push(h);
    setHotels(updated);
    ZumraDB.saveHotels(updated);
    ZumraSync.saveHotel(h);
    toast.success(`Hotel "${h.name}" (#${h.hotelNumber}) saved successfully`);
  };
  const handleSaveHotel = (h: Hotel) => {
    showConfirm('Save Hotel', `Save hotel "${h.name}"?`, () => doSaveHotel(h));
  };

  const doDeleteHotel = (id: string) => {
    const h = hotels.find(i => i.id === id);
    const updated = hotels.filter(item => item.id !== id);
    setHotels(updated);
    ZumraDB.saveHotels(updated);
    ZumraSync.deleteHotel(id);
    toast.success(`Hotel "${h?.name || id}" deleted`);
  };
  const handleDeleteHotel = (id: string) => {
    const h = hotels.find(i => i.id === id);
    showConfirm('Delete Hotel', `Are you sure you want to delete hotel "${h?.name || id}"? This cannot be undone.`, () => doDeleteHotel(id), 'destructive');
  };

  const doSaveAgent = (a: Agent) => {
    const updated = agents.map(item => item.id === a.id ? a : item);
    if (!agents.some(item => item.id === a.id)) updated.push(a);
    setAgents(updated);
    ZumraDB.saveAgents(updated);
    ZumraSync.saveAgent(a);
    toast.success(`Agent "${a.name}" saved successfully`);
  };
  const handleSaveAgent = (a: Agent) => {
    showConfirm('Save Agent', `Save agent "${a.name}"?`, () => doSaveAgent(a));
  };

  const doDeleteAgent = (id: string) => {
    const a = agents.find(i => i.id === id);
    const updated = agents.filter(item => item.id !== id);
    setAgents(updated);
    ZumraDB.saveAgents(updated);
    ZumraSync.deleteAgent(id);
    toast.success(`Agent "${a?.name || id}" deleted`);
  };
  const handleDeleteAgent = (id: string) => {
    const a = agents.find(i => i.id === id);
    showConfirm('Delete Agent', `Are you sure you want to delete agent "${a?.name || id}"? This cannot be undone.`, () => doDeleteAgent(id), 'destructive');
  };

  const doSaveAllotment = (al: Allotment) => {
    const updated = allotments.map(item => item.id === al.id ? al : item);
    if (!allotments.some(item => item.id === al.id)) updated.push(al);
    setAllotments(updated);
    ZumraDB.saveAllotments(updated);
    ZumraSync.saveAllotment(al);
    toast.success('Allotment saved successfully');
  };
  const handleSaveAllotment = (al: Allotment) => {
    showConfirm('Save Allotment', `Save allotment for ${al.hotelId}?`, () => doSaveAllotment(al));
  };

  const doDeleteAllotment = (id: string) => {
    const updated = allotments.filter(item => item.id !== id);
    setAllotments(updated);
    ZumraDB.saveAllotments(updated);
    ZumraSync.deleteAllotment(id);
    toast.success('Allotment deleted');
  };
  const handleDeleteAllotment = (id: string) => {
    showConfirm('Delete Allotment', 'Are you sure you want to delete this allotment? This cannot be undone.', () => doDeleteAllotment(id), 'destructive');
  };

  const doSaveReservation = (res: Reservation) => {
    const updated = reservations.map(item => item.id === res.id ? res : item);
    const isNew = !reservations.some(item => item.id === res.id);
    if (isNew) updated.push(res);
    setReservations(updated);
    ZumraDB.saveReservations(updated);
    ZumraSync.saveReservation(res);
    toast.success(`Reservation RSV-${res.id} ${isNew ? 'created' : 'updated'} for ${res.guestName}`);

    // Recalculate allotment booked counts from all non-cancelled reservations
    const recalcAllotments = () => {
      const activeReservations = updated.filter(r => r.status !== 'Cancelled');
      const newAllotments = allotments.map(al => {
        if (!al.dailyAvailability) return al;
        const newDaily = { ...al.dailyAvailability };
        // Reset all booked counts
        Object.keys(newDaily).forEach(d => { newDaily[d] = { ...newDaily[d], booked: 0 }; });
        // Accumulate bookings from matching reservations
        activeReservations.forEach(r => {
          if (r.hotelId !== al.hotelId) return;
          if (r.supplierId && r.supplierId !== al.supplierId) return;
          r.rooms.forEach(rm => {
            if (rm.roomType !== al.roomType) return;
            // Generate dates for this reservation
            const checkIn = new Date(r.checkIn);
            for (let i = 0; i < r.nights; i++) {
              const d = new Date(checkIn);
              d.setDate(d.getDate() + i);
              const dateStr = d.toISOString().split('T')[0];
              if (newDaily[dateStr]) {
                newDaily[dateStr].booked += rm.qty;
              }
            }
          });
        });
        return { ...al, dailyAvailability: newDaily };
      });
      setAllotments(newAllotments);
      ZumraDB.saveAllotments(newAllotments);
      // Sync each updated allotment to Firestore
      newAllotments.forEach(al => ZumraSync.saveAllotment(al));
    };
    recalcAllotments();

    // Process cancellation wallet updates and transactions
    if (res.status === 'Cancelled') {
      const oldRes = reservations.find(r => r.id === res.id);
      const wasAlreadyCancelled = oldRes?.status === 'Cancelled';
      if (!wasAlreadyCancelled) {
        const now = new Date().toISOString();
        const newTransactions: Transaction[] = [];
        const newAlerts: RefundAlert[] = [];
        let updatedAgents = [...agents];

        // Client disposition
        const clientPaid = res.amountPaidByClient || 0;
        if (res.clientCreditDisposition === 'Kept as Credit' && clientPaid > 0) {
          updatedAgents = updatedAgents.map(a => a.id === res.clientId ? { ...a, walletBalance: (a.walletBalance || 0) + clientPaid } : a);
          newTransactions.push({
            id: `tr_cancel_client_${res.id}_${Date.now()}`,
            docNo: getNextDocNo('CRED-C', [...transactions, ...newTransactions]),
            date: now.split('T')[0],
            type: 'CreditApplied',
            amount: clientPaid,
            agentId: res.clientId,
            reservationId: res.id.toString(),
            description: `Credit from cancellation of RSV-${res.id} (${res.guestName})`,
            paymentMethod: 'Bank Transfer',
            voucherNo: getNextVoucherNo('CRED', [...transactions, ...newTransactions]),
            createdBy: currentUser.name,
          });
        } else if (res.clientCreditDisposition === 'Refunded' && clientPaid > 0) {
          newAlerts.push({
            id: `refund_client_${res.id}_${Date.now()}`,
            bookingId: res.id,
            amount: clientPaid,
            party: 'Client',
            partyId: res.clientId,
            status: 'Pending',
            createdAt: now,
            note: res.clientCreditNote || undefined,
          });
        }

        // Supplier disposition
        const supplierPaid = res.amountPaidToSupplier || 0;
        if (res.supplierCreditDisposition === 'Kept as Credit' && supplierPaid > 0) {
          updatedAgents = updatedAgents.map(a => a.id === res.supplierId ? { ...a, walletBalance: (a.walletBalance || 0) + supplierPaid } : a);
          newTransactions.push({
            id: `tr_cancel_supp_${res.id}_${Date.now()}`,
            docNo: getNextDocNo('CRED-S', [...transactions, ...newTransactions]),
            date: now.split('T')[0],
            type: 'CreditApplied',
            amount: supplierPaid,
            agentId: res.supplierId,
            reservationId: res.id.toString(),
            description: `Credit from cancellation of RSV-${res.id} (${res.guestName})`,
            paymentMethod: 'Bank Transfer',
            voucherNo: getNextVoucherNo('CRED', [...transactions, ...newTransactions]),
            createdBy: currentUser.name,
          });
        } else if (res.supplierCreditDisposition === 'Refunded' && supplierPaid > 0) {
          newAlerts.push({
            id: `refund_supp_${res.id}_${Date.now()}`,
            bookingId: res.id,
            amount: supplierPaid,
            party: 'Supplier',
            partyId: res.supplierId,
            status: 'Pending',
            createdAt: now,
            note: res.supplierCreditNote || undefined,
          });
        }

        if (newTransactions.length > 0) {
          const allTx = [...transactions, ...newTransactions];
          setTransactions(allTx);
          ZumraDB.saveTransactions(allTx);
          newTransactions.forEach(t => ZumraSync.saveTransaction(t));
        }
        // Merge refund alerts into agents
        if (newAlerts.length > 0) {
          updatedAgents = updatedAgents.map(a => {
            const agentAlerts = newAlerts.filter(al => al.partyId === a.id);
            if (agentAlerts.length > 0) {
              return { ...a, pendingRefunds: [...(a.pendingRefunds || []), ...agentAlerts] };
            }
            return a;
          });
        }
        if (JSON.stringify(updatedAgents) !== JSON.stringify(agents)) {
          setAgents(updatedAgents);
          ZumraDB.saveAgents(updatedAgents);
          updatedAgents.forEach(a => ZumraSync.saveAgent(a));
        }
      }
    }
  };
  const handleSaveReservation = (res: Reservation) => {
    const { totalSell } = getReservationTotals(res);
    showConfirm(
      'Save Reservation',
      `Guest: ${res.guestName}\nHotel: ${hotels.find(h => h.id === res.hotelId)?.name || res.hotelId}\nCheck-in: ${res.checkIn}  |  Check-out: ${res.checkOut}\nStatus: ${res.status}\nTotal: ${totalSell.toLocaleString()} SAR\n\nSave this reservation?`,
      () => doSaveReservation(res)
    );
  };

  const doDeleteReservation = (id: string) => {
    const updated = reservations.filter(item => item.id.toString() !== id);
    setReservations(updated);
    ZumraDB.saveReservations(updated);
    ZumraSync.deleteReservation(id);
    toast.success(`Reservation RSV-${id} deleted`);
  };
  const handleDeleteReservation = (id: string) => {
    const res = reservations.find(r => r.id.toString() === id);
    showConfirm(
      'Delete Reservation',
      `Are you sure you want to delete reservation RSV-${id}${res ? ` (${res.guestName})` : ''}? This cannot be undone.`,
      () => doDeleteReservation(id),
      'destructive'
    );
  };

  const doSaveAccount = (acc: Account) => {
    const updated = accounts.map(item => item.id === acc.id ? acc : item);
    if (!accounts.some(item => item.id === acc.id)) updated.push(acc);
    setAccounts(updated);
    ZumraDB.saveAccounts(updated);
    ZumraSync.saveAccount(acc);
    toast.success(`Account "${acc.name}" saved`);
  };
  const handleSaveAccount = (acc: Account) => {
    showConfirm('Save Account', `Save account "${acc.name}"?`, () => doSaveAccount(acc));
  };

  const doDeleteAccount = (id: string) => {
    const acc = accounts.find(i => i.id === id);
    const updated = accounts.filter(item => item.id !== id);
    setAccounts(updated);
    ZumraDB.saveAccounts(updated);
    ZumraSync.deleteAccount(id);
    toast.success(`Account "${acc?.name || id}" deleted`);
  };
  const handleDeleteAccount = (id: string) => {
    const acc = accounts.find(i => i.id === id);
    showConfirm('Delete Account', `Are you sure you want to delete account "${acc?.name || id}"? This cannot be undone.`, () => doDeleteAccount(id), 'destructive');
  };

  const reverseTransactionEffect = (tr: Transaction, currentAgents: Agent[], currentAccounts: Account[]) => {
    let newAgents = [...currentAgents];
    let newAccounts = [...currentAccounts];

    if (tr.type === 'ClientPayment' && tr.agentId) {
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance - tr.amount } : ag);
    } else if (tr.type === 'SupplierPayment' && tr.agentId) {
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance + tr.amount } : ag);
    } else if (tr.type === 'ClientRefund' && tr.agentId) {
      // Reverse: undo refund means add back to client balance
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance + tr.amount } : ag);
    } else if (tr.type === 'SupplierRefund' && tr.agentId) {
      // Reverse: undo refund means subtract from supplier balance
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance - tr.amount } : ag);
    }

    if (tr.fromAccountId) {
      let modifier = 0;
      if (tr.type === 'ClientPayment') modifier = -tr.amount;
      else if (tr.type === 'SupplierPayment') modifier = tr.amount;
      else if (tr.type === 'ClientRefund') modifier = tr.amount; // Reverse: add back to account
      else if (tr.type === 'SupplierRefund') modifier = -tr.amount; // Reverse: remove from account
      newAccounts = newAccounts.map(acc => acc.id === tr.fromAccountId ? { ...acc, balance: acc.balance + modifier } : acc);
    }
    return { newAgents, newAccounts };
  };

  const applyTransactionEffect = (tr: Transaction, currentAgents: Agent[], currentAccounts: Account[]) => {
    let newAgents = [...currentAgents];
    let newAccounts = [...currentAccounts];

    if (tr.type === 'ClientPayment' && tr.agentId) {
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance + tr.amount } : ag);
    } else if (tr.type === 'SupplierPayment' && tr.agentId) {
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance - tr.amount } : ag);
    } else if (tr.type === 'ClientRefund' && tr.agentId) {
      // Refund to client: reduce their outstanding balance
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance - tr.amount } : ag);
    } else if (tr.type === 'SupplierRefund' && tr.agentId) {
      // Refund from supplier: increase their credit
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance + tr.amount } : ag);
    }

    if (tr.fromAccountId) {
      let modifier = 0;
      if (tr.type === 'ClientPayment') modifier = tr.amount;
      else if (tr.type === 'SupplierPayment') modifier = -tr.amount;
      else if (tr.type === 'ClientRefund') modifier = -tr.amount; // Money leaves account
      else if (tr.type === 'SupplierRefund') modifier = tr.amount; // Money enters account
      newAccounts = newAccounts.map(acc => acc.id === tr.fromAccountId ? { ...acc, balance: acc.balance + modifier } : acc);
    }
    return { newAgents, newAccounts };
  };

  const doSaveTransaction = (tr: Transaction) => {
    const existing = transactions.find(t => t.id === tr.id);
    let updated;
    let currentAgents = agents;
    let currentAccounts = accounts;

    if (existing) {
      updated = transactions.map(item => item.id === tr.id ? tr : item);
      const reversed = reverseTransactionEffect(existing, currentAgents, currentAccounts);
      currentAgents = reversed.newAgents;
      currentAccounts = reversed.newAccounts;
    } else {
      updated = [tr, ...transactions];
    }
    setTransactions(updated);
    ZumraDB.saveTransactions(updated);
    ZumraSync.saveTransaction(tr);

    const applied = applyTransactionEffect(tr, currentAgents, currentAccounts);
    setAgents(applied.newAgents);
    ZumraDB.saveAgents(applied.newAgents);
    applied.newAgents.forEach(a => ZumraSync.saveAgent(a));
    setAccounts(applied.newAccounts);
    ZumraDB.saveAccounts(applied.newAccounts);
    applied.newAccounts.forEach(a => ZumraSync.saveAccount(a));
    toast.success(`Transaction ${tr.voucherNo || tr.id} saved (${tr.amount.toLocaleString()} SAR)`);
  };
  const handleSaveTransaction = (tr: Transaction) => {
    showConfirm(
      'Save Transaction',
      `Type: ${tr.type}\nAmount: ${tr.amount.toLocaleString()} SAR\nMethod: ${tr.paymentMethod}\nDate: ${tr.date}\n${tr.description ? `Desc: ${tr.description}` : ''}\n\nSave this transaction?`,
      () => doSaveTransaction(tr)
    );
  };

  const doDeleteTransaction = (id: string) => {
    const existing = transactions.find(t => t.id === id);
    if (!existing) return;
    const updated = transactions.filter(item => item.id !== id);
    setTransactions(updated);
    ZumraDB.saveTransactions(updated);
    ZumraSync.deleteTransaction(id);

    const reversed = reverseTransactionEffect(existing, agents, accounts);
    setAgents(reversed.newAgents);
    ZumraDB.saveAgents(reversed.newAgents);
    reversed.newAgents.forEach(a => ZumraSync.saveAgent(a));
    setAccounts(reversed.newAccounts);
    ZumraDB.saveAccounts(reversed.newAccounts);
    reversed.newAccounts.forEach(a => ZumraSync.saveAccount(a));
    toast.success(`Transaction ${existing.voucherNo || id} deleted`);
  };
  const handleDeleteTransaction = (id: string) => {
    const tr = transactions.find(t => t.id === id);
    showConfirm(
      'Delete Transaction',
      `Are you sure you want to delete transaction ${tr?.voucherNo || id} (${tr?.amount.toLocaleString() || '0'} SAR)? This will reverse all balance changes.`,
      () => doDeleteTransaction(id),
      'destructive'
    );
  };

  const doSaveExternalTransfer = (et: ExternalTransfer) => {
    const updated = externalTransfers.map(item => item.id === et.id ? et : item);
    if (!externalTransfers.some(item => item.id === et.id)) updated.push(et);
    setExternalTransfers(updated);
    ZumraDB.saveExternalTransfers(updated);
    ZumraSync.saveExternalTransfer(et);
    toast.success('External transfer saved');
  };
  const handleSaveExternalTransfer = (et: ExternalTransfer) => {
    showConfirm('Save Transfer', `Save external transfer for ${et.amountSAR?.toLocaleString() || '0'} SAR?`, () => doSaveExternalTransfer(et));
  };

  const doDeleteExternalTransfer = (id: string) => {
    const updated = externalTransfers.filter(item => item.id !== id);
    setExternalTransfers(updated);
    ZumraDB.saveExternalTransfers(updated);
    ZumraSync.deleteExternalTransfer(id);
    toast.success('External transfer deleted');
  };
  const handleDeleteExternalTransfer = (id: string) => {
    showConfirm('Delete Transfer', 'Are you sure you want to delete this external transfer?', () => doDeleteExternalTransfer(id), 'destructive');
  };

  // ==================== Expenses ====================
  const handleSaveExpense = (exp: Expense) => {
    const existing = expenses.find(e => e.id === exp.id);
    let updatedList: Expense[];
    if (existing) {
      // If expense amount changed, reverse old deduction and apply new one
      const oldAmount = existing.amount;
      const newAmount = exp.amount;
      const amountDiff = newAmount - oldAmount;
      if (amountDiff !== 0) {
        const updatedAccounts = accounts.map(acc => {
          if (acc.id === exp.fromAccountId) return { ...acc, balance: acc.balance - amountDiff };
          return acc;
        });
        setAccounts(updatedAccounts);
        ZumraDB.saveAccounts(updatedAccounts);
        updatedAccounts.filter(a => a.id === exp.fromAccountId).forEach(a => ZumraSync.saveAccount(a));
      }
      updatedList = expenses.map(e => e.id === exp.id ? exp : e);
    } else {
      // New expense - deduct from account
      const updatedAccounts = accounts.map(acc => {
        if (acc.id === exp.fromAccountId) return { ...acc, balance: acc.balance - exp.amount };
        return acc;
      });
      setAccounts(updatedAccounts);
      ZumraDB.saveAccounts(updatedAccounts);
      updatedAccounts.filter(a => a.id === exp.fromAccountId).forEach(a => ZumraSync.saveAccount(a));
      updatedList = [...expenses, exp];
    }
    setExpenses(updatedList);
    ZumraDB.saveExpenses(updatedList);
    ZumraSync.saveExpense(exp);
    toast.success(`Expense "${exp.name}" saved (${exp.amount.toLocaleString()} SAR)`);
  };

  const handleDeleteExpense = (id: string) => {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;
    showConfirm('Delete Expense', `Delete expense "${exp.name}" (${exp.amount.toLocaleString()} SAR)?\nThe amount will be refunded to the account.`, () => {
      // Refund amount back to account
      const updatedAccounts = accounts.map(acc => {
        if (acc.id === exp.fromAccountId) return { ...acc, balance: acc.balance + exp.amount };
        return acc;
      });
      setAccounts(updatedAccounts);
      ZumraDB.saveAccounts(updatedAccounts);
      updatedAccounts.filter(a => a.id === exp.fromAccountId).forEach(a => ZumraSync.saveAccount(a));

      const updatedList = expenses.filter(e => e.id !== id);
      setExpenses(updatedList);
      ZumraDB.saveExpenses(updatedList);
      ZumraSync.deleteExpense(id);
      toast.success(`Expense "${exp.name}" deleted`);
    }, 'destructive');
  };

  const handleSaveExpenseCategory = (cat: ExpenseCategory) => {
    const existing = expenseCategories.find(c => c.id === cat.id);
    const updatedList = existing
      ? expenseCategories.map(c => c.id === cat.id ? cat : c)
      : [...expenseCategories, cat];
    setExpenseCategories(updatedList);
    ZumraDB.saveExpenseCategories(updatedList);
    ZumraSync.saveExpenseCategory(cat);
  };

  // ==================== Consolidated Invoices ====================
  const handleSaveConsolidatedInvoice = (ci: ConsolidatedInvoice) => {
    const updatedList = [...consolidatedInvoices, ci];
    setConsolidatedInvoices(updatedList);
    ZumraDB.saveConsolidatedInvoices(updatedList);
    ZumraSync.saveConsolidatedInvoice(ci);
    handleLogAuditSimple('Create', 'ConsolidatedInvoice', ci.id, `Created consolidated invoice ${ci.invoiceNo}`);
  };

  // Fund transfers between cash blocks
  const handleModifyBalances = (fromId: string, toId: string, amount: number) => {
    const updatedAccounts = accounts.map(acc => {
      if (acc.id === fromId) return { ...acc, balance: acc.balance - amount };
      if (acc.id === toId) return { ...acc, balance: acc.balance + amount };
      return acc;
    });
    setAccounts(updatedAccounts);
    ZumraDB.saveAccounts(updatedAccounts);
    updatedAccounts.forEach(a => ZumraSync.saveAccount(a));

    // Save formal transfer transaction doc
    const newTr: Transaction = {
      id: `tr_xfer_${Date.now()}`,
      docNo: (transactions.length + 1).toString(),
      date: new Date().toISOString().split('T')[0],
      type: 'Transfer',
      amount,
      fromAccountId: fromId,
      toAccountId: toId,
      description: `Internal balanced allocation transfer from ${accounts.find(a => a.id === fromId)?.name} to ${accounts.find(a => a.id === toId)?.name}`,
      paymentMethod: 'Bank Transfer',
      voucherNo: getNextVoucherNo('XFER', transactions),
      createdBy: currentUser?.name || 'Admin System'
    };

    const updatedTr = [newTr, ...transactions];
    setTransactions(updatedTr);
    ZumraDB.saveTransactions(updatedTr);
    ZumraSync.saveTransaction(newTr);
  };

  // Bulk distributed FIFO downpayments side effect saver
  const handleBulkPaymentDistributionSave = (updatedR: Reservation[], newT: Transaction[], updatedA: Account[]) => {
    setReservations(updatedR);
    ZumraDB.saveReservations(updatedR);
    updatedR.forEach(r => ZumraSync.saveReservation(r));

    // Concatenate new transactions
    const updatedTransactionsList = [...newT, ...transactions];
    setTransactions(updatedTransactionsList);
    ZumraDB.saveTransactions(updatedTransactionsList);
    newT.forEach(t => ZumraSync.saveTransaction(t));

    setAccounts(updatedA);
    ZumraDB.saveAccounts(updatedA);
    updatedA.forEach(a => ZumraSync.saveAccount(a));

    // Calculate sum total to credit the agent
    const sumAllocated = newT.reduce((a, t) => a + t.amount, 0);
    if (newT.length > 0 && newT[0].agentId) {
      const targetAgentId = newT[0].agentId;
      const updatedAgents = agents.map(ag => {
        if (ag.id === targetAgentId) {
          return { ...ag, balance: ag.balance + sumAllocated };
        }
        return ag;
      });
      setAgents(updatedAgents);
      ZumraDB.saveAgents(updatedAgents);
      updatedAgents.forEach(a => ZumraSync.saveAgent(a));
    }
  };

  const doAddUser = (user: User) => {
    // Use functional update to prevent stale closure race conditions
    setUsers(prev => {
      const existing = prev.find(u => u.id === user.id);
      const updated = existing
        ? prev.map(u => u.id === user.id ? user : u)
        : [...prev, user];
      ZumraDB.saveUsers(updated);
      ZumraSync.saveUser(user);
      return updated;
    });
    toast.success(`User "${user.name}" saved`);
  };
  const handleAddUser = (user: User) => {
    showConfirm('Save User', `Save user "${user.name}" (${user.role})?`, () => doAddUser(user));
  };

  const doDeleteUser = (userId: string) => {
    const targetUser = users.find(i => i.id === userId);
    // Guard: prevent deleting self
    if (currentUser && userId === currentUser.id) {
      toast.error('You cannot delete your own account.');
      return;
    }
    // Guard: prevent deleting last admin
    const adminCount = users.filter(u => u.role === 'Admin').length;
    if (targetUser?.role === 'Admin' && adminCount <= 1) {
      toast.error('Cannot delete the last admin. Promote another user to Admin first.');
      return;
    }
    const updated = users.filter(u => u.id !== userId);
    setUsers(updated);
    ZumraDB.saveUsers(updated);
    ZumraSync.deleteUser(userId);
    toast.success(`User "${targetUser?.name || userId}" deleted`);
  };
  const handleDeleteUser = (userId: string) => {
    const u = users.find(i => i.id === userId);
    showConfirm('Delete User', `Are you sure you want to delete user "${u?.name || userId}"? This cannot be undone.`, () => doDeleteUser(userId), 'destructive');
  };

  const handleLogAudit = (entry: Omit<GlobalAuditEntry, 'id' | 'timestamp'>): void => {
    const saved = ZumraDB.logAuditEntry(entry);
    setAuditLog(prev => [saved, ...prev]);
    ZumraSync.saveAuditEntry(saved);
  };

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
    if (user) {
      ZumraDB.setCurrentUser(user);
    } else {
      localStorage.removeItem('zumra_current_user');
    }
  };

  // Profile image upload
  const profileImageRef = useRef<HTMLInputElement>(null);
  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (file.size > 500 * 1024) { toast.error('Image too large. Max 500KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updatedUser = { ...currentUser, profileImage: base64 };
      setCurrentUser(updatedUser);
      ZumraDB.setCurrentUser(updatedUser);
      // Also update users list
      setUsers(prev => {
        const updated = prev.map(u => u.id === updatedUser.id ? updatedUser : u);
        ZumraDB.saveUsers(updated);
        ZumraSync.saveUser(updatedUser);
        return updated;
      });
      toast.success('Profile image updated');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveFollowUp = (fu: FollowUp) => {
    const updated = followUps.map(item => item.id === fu.id ? fu : item);
    if (!followUps.some(item => item.id === fu.id)) updated.push(fu);
    setFollowUps(updated);
    ZumraDB.saveFollowUps(updated);
    ZumraSync.saveFollowUp(fu);
  };

  const handleDeleteFollowUp = (id: string) => {
    const updated = followUps.filter(item => item.id !== id);
    setFollowUps(updated);
    ZumraDB.saveFollowUps(updated);
    ZumraSync.deleteFollowUp(id);
  };

  // Switch tab triggered from Dashboard widgets
  const handleNavigate = (tab: string, initialFilters?: any) => {
    setActiveFilters(initialFilters);
    setActiveTab(tab);
  };

  // Core visual tab panels
  const renderActivePage = () => {
    if (!currentUser) return <div className="text-center py-20 text-slate-400 animate-fade-in"><div className="inline-block w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-3"></div><p className="text-sm font-medium">Loading operator identities...</p></div>;

    switch (activeTab) {
      case 'Dashboard':
        return (
          <ErrorBoundary fallbackLabel="Dashboard failed to load.">
          <Dashboard
            reservations={reservations}
            agents={agents}
            hotels={hotels}
            users={users}
            followUps={followUps}
            allotments={allotments}
            transactions={transactions}
            onNavigate={handleNavigate}
            onQuickReservation={() => {
              setActiveFilters({ showNewForm: true });
              setActiveTab('Reservations');
            }}
          />
          </ErrorBoundary>
        );
      case 'Calendar':
        return (
          <ErrorBoundary fallbackLabel="Calendar failed to load.">
          <CalendarView
            reservations={reservations}
            transactions={transactions}
            followUps={followUps}
            agents={agents}
            hotels={hotels}
            onNavigate={handleNavigate}
          />
          </ErrorBoundary>
        );
      case 'Analytics':
        return (
          <ErrorBoundary fallbackLabel="Analytics failed to load.">
          <AnalyticsDashboard
            reservations={reservations}
            transactions={transactions}
            agents={agents}
            hotels={hotels}
          />
          </ErrorBoundary>
        );
      case 'Reservations':
        return (
          <ErrorBoundary fallbackLabel="Reservations page failed to load.">
          <ReservationsPage
            reservations={reservations}
            agents={agents}
            hotels={hotels}
            users={users}
            currentUser={currentUser.name}
            initialFilters={activeFilters}
            onSaveReservation={handleSaveReservation}
            onDeleteReservation={handleDeleteReservation}
            accounts={accounts}
            onSaveTransaction={handleSaveTransaction}
            transactions={transactions}
            allotments={allotments}
            onSaveAllotment={handleSaveAllotment}
            onLogAudit={handleLogAudit}
            currentUserRole={currentUser.role}
            onRequestEditApproval={handleRequestEditApproval}
            onNavigate={handleNavigate}
          />
          </ErrorBoundary>
        );
      case 'Hotels':
        return (
          <ErrorBoundary fallbackLabel="Hotels page failed to load.">
          <HotelsPage
            hotels={hotels}
            onSaveHotel={handleSaveHotel}
            onDeleteHotel={handleDeleteHotel}
          />
          </ErrorBoundary>
        );
      case 'Agents':
        return (
          <ErrorBoundary fallbackLabel="Agents page failed to load.">
          <AgentsPage
            agents={agents}
            reservations={reservations}
            accounts={accounts}
            transactions={transactions}
            currentUser={currentUser.name}
            onSaveAgent={handleSaveAgent}
            onDeleteAgent={handleDeleteAgent}
            onBulkPaymentSave={handleBulkPaymentDistributionSave}
          />
          </ErrorBoundary>
        );
      case 'Allotments':
        return (
          <ErrorBoundary fallbackLabel="Allotments page failed to load.">
          <AllotmentsPage
            allotments={allotments}
            hotels={hotels}
            agents={agents}
            onSaveAllotment={handleSaveAllotment}
            onDeleteAllotment={handleDeleteAllotment}
          />
          </ErrorBoundary>
        );
      case 'Transactions':
        return (
          <ErrorBoundary fallbackLabel="Transactions page failed to load.">
          <TransactionsPage
            transactions={transactions}
            agents={agents}
            accounts={accounts}
            reservations={reservations}
            currentUser={currentUser.name}
            onSaveTransaction={handleSaveTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
          </ErrorBoundary>
        );
      case 'External Transfers':
        return (
          <ErrorBoundary fallbackLabel="External Transfers page failed to load.">
          <ExternalTransfersPage
            externalTransfers={externalTransfers}
            onSaveTransfer={handleSaveExternalTransfer}
            onDeleteTransfer={handleDeleteExternalTransfer}
          />
          </ErrorBoundary>
        );
      case 'Banks & Safes':
        return (
          <ErrorBoundary fallbackLabel="Banks & Safes page failed to load.">
          <AccountsPage
            accounts={accounts}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={handleDeleteAccount}
            onModifyBalances={handleModifyBalances}
          />
          </ErrorBoundary>
        );
      case 'Reports':
        return (
          <ErrorBoundary fallbackLabel="Reports page failed to load.">
          <ReportsPage
            reservations={reservations}
            agents={agents}
            hotels={hotels}
            transactions={transactions}
            accounts={accounts}
            otherServices={otherServices}
            taxSettings={taxSettings}
            expenses={expenses}
            expenseCategories={expenseCategories}
            initialTab={activeFilters?.reportTab}
            onNavigate={handleNavigate}
          />
          </ErrorBoundary>
        );
      case 'Sales':
        return (
          <ErrorBoundary fallbackLabel="Sales page failed to load.">
          <SalesPage
            agents={agents}
            followUps={followUps}
            currentUser={currentUser.name}
            onSaveFollowUp={handleSaveFollowUp}
            onDeleteFollowUp={handleDeleteFollowUp}
          />
          </ErrorBoundary>
        );
      case 'Production':
        return (
          <ErrorBoundary fallbackLabel="Production page failed to load.">
          <ProductionPage
            reservations={reservations}
            agents={agents}
            hotels={hotels}
          />
          </ErrorBoundary>
        );
      case 'Users':
        return (
          <ErrorBoundary fallbackLabel="User Management page failed to load.">
          <UserManagementPage
            users={users}
            currentUser={currentUser}
            onSetCurrentUser={handleSetCurrentUser}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onToast={(type, msg) => { if (type === 'error') toast.error(msg); else if (type === 'warning') toast.warning(msg); else toast.success(msg); }}
          />
          </ErrorBoundary>
        );
      case 'Audit Log':
        return (
          <ErrorBoundary fallbackLabel="Audit Log page failed to load.">
          <AuditLogPage
            auditLog={auditLog}
            currentUser={currentUser}
          />
          </ErrorBoundary>
        );
      case 'General Data':
        return (
          <ErrorBoundary fallbackLabel="General Data page failed to load.">
          <GeneralDataPage
            salesPersons={salesPersons}
            setSalesPersons={setSalesPersons}
            cancellationReasons={cancellationReasons}
            setCancellationReasons={setCancellationReasons}
            termsAndConditions={termsAndConditions}
            setTermsAndConditions={setTermsAndConditions}
            onLogAudit={handleLogAuditSimple}
          />
          </ErrorBoundary>
        );
      case 'Other Services':
        return (
          <ErrorBoundary fallbackLabel="Other Services page failed to load.">
          <OtherServicesPage
            otherServices={otherServices}
            setOtherServices={setOtherServices}
            agents={agents}
            taxSettings={taxSettings}
            currentUser={currentUser}
            onLogAudit={handleLogAuditSimple}
            reservations={reservations}
            consolidatedInvoices={consolidatedInvoices}
            onSaveConsolidatedInvoice={handleSaveConsolidatedInvoice}
          />
          </ErrorBoundary>
        );
      case 'Payment Gateways':
        return (
          <ErrorBoundary fallbackLabel="Payment Gateways page failed to load.">
          <PaymentGatewaysPage
            gateways={paymentGateways}
            setGateways={setPaymentGateways}
            payByLinks={payByLinks}
            setPayByLinks={setPayByLinks}
            currentUser={currentUser}
            onLogAudit={handleLogAuditSimple}
          />
          </ErrorBoundary>
        );
      case 'Expenses':
        return (
          <ErrorBoundary fallbackLabel="Expenses page failed to load.">
          <ExpensesPage
            expenses={expenses}
            expenseCategories={expenseCategories}
            accounts={accounts}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            onSaveCategory={handleSaveExpenseCategory}
            currentUserId={currentUser.id}
          />
          </ErrorBoundary>
        );
      default:
        return <div>Pane Not Found.</div>;
    }
  };

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus());

  // Track sync status (online/offline + pending queue)
  useEffect(() => {
    const unsub = onSyncStatusChange(setSyncStatus);
    setSyncStatus(getSyncStatus());
    return unsub;
  }, []);

  const navItems = [
    { name: 'Dashboard', icon: '📊', group: 'Overview', key: 'dashboard' },
    { name: 'Calendar', icon: '🗓️', group: 'Overview', key: 'calendar' },
    { name: 'Analytics', icon: '📉', group: 'Overview', key: 'analytics' },
    { name: 'Reservations', icon: '📅', group: 'Operations', key: 'reservations' },
    { name: 'Sales', icon: '🚀', group: 'Operations', key: 'sales' },
    { name: 'Production', icon: '📈', group: 'Operations', key: 'production' },
    { name: 'Hotels', icon: '🏢', group: 'Operations', key: 'hotels' },
    { name: 'Agents', icon: '👥', group: 'Operations', key: 'agents' },
    { name: 'Allotments', icon: '📦', group: 'Operations', key: 'allotments' },
    { name: 'Other Services', icon: '🌐', group: 'Operations', key: 'otherServices' },
    { name: 'Transactions', icon: '💰', group: 'Finance', key: 'transactions' },
    { name: 'External Transfers', icon: '💸', group: 'Finance', key: 'externalTransfers' },
    { name: 'Banks & Safes', icon: '🏦', group: 'Finance', key: 'banksSafes' },
    { name: 'Reports', icon: '📋', group: 'Finance', key: 'reports' },
    { name: 'Expenses', icon: '📤', group: 'Finance', key: 'expenses' },
    { name: 'Payment Gateways', icon: '💳', group: 'Finance', key: 'paymentGateways' },
    { name: 'Audit Log', icon: '🔍', group: 'Settings', key: 'auditLog' },
    { name: 'Users', icon: '🔑', group: 'Settings', key: 'users' },
    { name: 'General Data', icon: '📝', group: 'Settings', key: 'generalData' },
  ];

  if (!currentUser) {
    return <LoginPage users={users} onLoginSuccess={handleSetCurrentUser} onUpdateUser={doAddUser} />;
  }

  // Get permitted nav items based on user's specific role
  const permittedNavItems = navItems.filter((item) => {
    if (currentUser.role === 'Reservationist') {
      return ['Dashboard', 'Calendar', 'Reservations', 'Hotels', 'Agents', 'Allotments', 'Other Services', 'General Data', 'Expenses'].includes(item.name);
    }
    if (currentUser.role === 'Sales') {
      return ['Dashboard', 'Calendar', 'Reservations', 'Sales', 'Production', 'Hotels', 'Agents', 'Allotments', 'Other Services'].includes(item.name);
    }
    if (currentUser.role === 'Finance') {
      return ['Dashboard', 'Calendar', 'Analytics', 'Reservations', 'Hotels', 'Agents', 'Transactions', 'External Transfers', 'Banks & Safes', 'Reports', 'Payment Gateways', 'Other Services', 'Expenses'].includes(item.name);
    }
    if (currentUser.role === 'ReservationsManager') {
      return ['Dashboard', 'Calendar', 'Reservations', 'Hotels', 'Agents', 'Allotments', 'Other Services', 'Reports', 'General Data', 'Expenses'].includes(item.name);
    }
    return true; // Admin gets everything
  });

  // Group nav items by group
  const navGroups: { [group: string]: typeof navItems } = {};
  permittedNavItems.forEach(item => {
    if (!navGroups[item.group]) navGroups[item.group] = [];
    navGroups[item.group].push(item);
  });

  // Determine if sidebar is dark (for text color adjustments)
  const isDarkSidebar = currentTheme.id !== 'executive';

  return (
    <div className={currentTheme.mainBg || 'bg-slate-50 min-h-screen font-sans flex flex-col md:flex-row print:bg-white print:min-h-0 select-none text-slate-800'}>
      
      {/* Decorative top accent bar (mobile only) */}
      <div className={`h-0.5 bg-gradient-to-r ${currentTheme.topBarGradient} w-full no-print absolute top-0 left-0 right-0 md:hidden z-[60]`}></div>

      {/* Global Datalists for Auto-Complete */}
      <datalist id="nationalities">
        <option value="Saudi"></option>
        <option value="Egyptian"></option>
        <option value="Emirati"></option>
        <option value="Qatari"></option>
        <option value="Kuwaiti"></option>
        <option value="Bahraini"></option>
        <option value="Omani"></option>
        <option value="Jordanian"></option>
        <option value="Pakistani"></option>
        <option value="Indian"></option>
        <option value="Indonesian"></option>
        <option value="Malaysian"></option>
        <option value="Turkish"></option>
        <option value="British"></option>
      </datalist>
      <datalist id="cities">
        <option value="Makkah"></option>
        <option value="Madinah"></option>
        <option value="Jeddah"></option>
        <option value="Riyadh"></option>
        <option value="Dammam"></option>
        <option value="Cairo"></option>
        <option value="Alexandria"></option>
        <option value="Dubai"></option>
        <option value="Abu Dhabi"></option>
      </datalist>
      <datalist id="countries">
        <option value="Saudi Arabia"></option>
        <option value="Egypt"></option>
        <option value="United Arab Emirates"></option>
        <option value="Qatar"></option>
        <option value="Kuwait"></option>
        <option value="Bahrain"></option>
        <option value="Oman"></option>
        <option value="Jordan"></option>
      </datalist>

      {/* Hidden file input for profile image upload */}
      <input ref={profileImageRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed md:static z-50 md:z-auto h-screen md:h-auto top-0 left-0 ${sidebarCollapsed ? 'md:w-[72px]' : 'md:w-60'} w-64 flex-shrink-0 ${currentTheme.sidebarBg} flex flex-col no-print border-b md:border-b-0 md:border-r ${currentTheme.sidebarBorder} transform transition-all duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Brand Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${currentTheme.sidebarBorder} flex-shrink-0`}>
          <button className={`flex items-center justify-center bg-white p-1.5 rounded-lg shadow-sm flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-300 transition`} onClick={() => { setActiveTab('Dashboard'); setSidebarOpen(false); }} title="Go to Dashboard">
            <ZumraLogo size="sm" variant="dark" />
          </button>
          {!sidebarCollapsed && (
            <button className="flex flex-col min-w-0 cursor-pointer text-left" onClick={() => { setActiveTab('Dashboard'); setSidebarOpen(false); }} title="Go to Dashboard">
              <p className={`text-[13px] font-bold tracking-wide leading-none ${isDarkSidebar ? 'text-white' : 'text-slate-900'}`}>Zumra Hotels</p>
              <p className={`text-[9px] font-semibold tracking-[0.2em] uppercase mt-0.5 ${currentTheme.brandText}`}>RMS Portal</p>
            </button>
          )}
          {/* Mobile close */}
          <button onClick={() => setSidebarOpen(false)} className={`ml-auto md:hidden p-1.5 rounded-lg ${isDarkSidebar ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Desktop collapse toggle */}
        <div className="hidden md:flex px-3 pt-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`flex items-center justify-center gap-2 w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-150 ${isDarkSidebar ? 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto no-scrollbar px-3 flex flex-col gap-4 overflow-x-auto">
          {Object.entries(navGroups).map(([group, items]) => (
            <div key={group}>
              {!sidebarCollapsed && (
                <div className="px-3 mb-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.18em] ${isDarkSidebar ? 'text-slate-500' : 'text-slate-400'}`}>{t(`nav.${group.toLowerCase()}` as TranslationKey)}</span>
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = activeTab === item.name;
                  return (
                    <button
                      key={item.name}
                      title={item.name}
                      onClick={() => {
                        setActiveFilters(null);
                        setActiveTab(item.name);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 whitespace-nowrap md:w-full relative group ${
                        isActive
                          ? `${currentTheme.sidebarActive} font-bold`
                          : `${currentTheme.sidebarText} ${currentTheme.sidebarHover} ${isDarkSidebar ? 'hover:text-white' : 'hover:text-slate-900'}`
                      }`}
                    >
                      {isActive && <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${currentTheme.brandBg}`}></span>}
                      <span className="text-sm w-5 text-center flex-shrink-0">{item.icon}</span>
                      <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>{t(`nav.${item.key}` as TranslationKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Mobile logout trigger */}
          <button
            onClick={() => { setSidebarOpen(false); handleSetCurrentUser(null as any); }}
            className={`flex md:hidden items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 ${isDarkSidebar ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-500 hover:bg-rose-50'}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>{t('nav.exitPortal')}</span>
          </button>
        </nav>

        {/* Sidebar Footer - User Info */}
        {currentUser && (
          <div className={`p-3 border-t ${currentTheme.sidebarBorder} flex-shrink-0 ${sidebarCollapsed ? 'hidden md:flex md:justify-center' : 'hidden md:block'}`}>
            {sidebarCollapsed ? (
              <button onClick={() => handleSetCurrentUser(null as any)} title="Sign Out" className={`p-2 rounded-lg transition-all text-xs ${isDarkSidebar ? 'bg-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400' : 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-500'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {currentUser.profileImage ? (
                  <img src={currentUser.profileImage} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer" onClick={() => profileImageRef.current?.click()} title="Change profile image" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 cursor-pointer relative group ${isDarkSidebar ? 'bg-white/[0.10] text-white' : 'bg-slate-200 text-slate-700'}`} onClick={() => profileImageRef.current?.click()} title="Upload profile image">
                    {currentUser.name ? currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                    </div>
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className={`text-[11px] font-semibold truncate leading-tight ${isDarkSidebar ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</p>
                  <p className={`text-[9px] truncate leading-tight ${isDarkSidebar ? 'text-slate-500' : 'text-slate-400'}`}>{currentUser.role}</p>
                </div>
              </div>
              <button
                onClick={() => handleSetCurrentUser(null as any)}
                title="Sign Out"
                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${isDarkSidebar ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen md:min-h-0 bg-slate-50">
        
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0 no-print">
          {/* Left: hamburger + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 transition text-slate-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              {t(`nav.${permittedNavItems.find(n => n.name === activeTab)?.key || activeTab.toLowerCase()}` as TranslationKey, { tab: activeTab })}
            </h2>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            {/* Edit Approvals - visible for Admin/ReservationsManager */}
            {(currentUser.role === 'Admin' || currentUser.role === 'ReservationsManager') && (
              <button
                className="relative p-2 hover:bg-slate-100 rounded-lg transition"
                onClick={() => setShowEditApprovalModal(true)}
                title="Edit Approvals"
              >
                <svg className="w-[18px] h-[18px] text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                {editApprovals.filter(a => a.status === 'Pending').length > 0 && (
                  <span className="absolute top-1 right-1 bg-amber-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                    {editApprovals.filter(a => a.status === 'Pending').length}
                  </span>
                )}
              </button>
            )}
            {/* Sync Status Indicator */}
            {isFirebaseConfigured && (
              <div className="flex items-center gap-1" title={
                syncStatus.pendingCount > 0
                  ? `${syncStatus.pendingCount} pending sync(s) - click to retry`
                  : syncStatus.online ? 'All data synced' : 'Offline - changes queued'
              }>
                {!syncStatus.online ? (
                  <button onClick={() => flushSyncQueue()} className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[9px] font-bold text-amber-700 hover:bg-amber-100 transition cursor-pointer animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    OFFLINE
                    {syncStatus.pendingCount > 0 && <span className="bg-amber-200 text-amber-800 px-1 rounded-full">{syncStatus.pendingCount}</span>}
                  </button>
                ) : syncStatus.pendingCount > 0 ? (
                  <button onClick={() => flushSyncQueue()} className="flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-200 rounded-lg text-[9px] font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer">
                    <span className={`w-1.5 h-1.5 rounded-full bg-orange-500 ${syncStatus.isSyncing ? 'animate-spin' : 'animate-pulse'}`}></span>
                    {syncStatus.isSyncing ? 'SYNCING' : 'PENDING'}
                    <span className="bg-orange-200 text-orange-800 px-1 rounded-full">{syncStatus.pendingCount}</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-1.5 py-1 text-[9px] font-bold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                )}
              </div>
            )}

            {/* Inbox */}
            <button
              className="relative p-2 hover:bg-slate-100 rounded-lg transition"
              onClick={() => setIsInboxOpen(true)}
              title="Messages"
            >
              <svg className="w-[18px] h-[18px] text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
              {(() => {
                const unread = ZumraDB.getMessages().filter((m: any) => m.receiverId === currentUser?.id && !m.read).length;
                return unread > 0 ? (
                  <span className="absolute top-1 right-1 bg-blue-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null;
              })()}
            </button>

            {/* Alerts */}
            <div className="relative" onMouseLeave={() => setIsAlertsOpen(false)}>
              <button
                className="relative p-2 hover:bg-slate-100 rounded-lg transition"
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                title="Notifications"
              >
                <svg className="w-[18px] h-[18px] text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                {alertCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </button>
              
              {isAlertsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-[1000] overflow-hidden animate-fade-in-up before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto thin-scrollbar">
                    {alertCount > 0 ? (
                      <div className="flex flex-col">
                        {currentAlerts.map(alert => (
                          <div 
                            key={alert.id}
                            className="p-3 text-xs hover:bg-slate-50 border-b border-slate-100 cursor-pointer transition flex flex-col gap-0.5"
                            onClick={() => {
                              setActiveFilters({ viewReservationId: alert.resId });
                              setActiveTab('Reservations');
                              setIsAlertsOpen(false);
                            }}
                          >
                            <span className="font-semibold text-amber-600">{alert.type}</span>
                            <span className="text-slate-600">{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-xs text-slate-400 text-center">
                        No new notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block"></div>

            {/* Language toggle */}
            <LangToggle />

            {/* Theme switcher */}
            <div className="flex items-center bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-lg transition cursor-pointer">
              <select
                value={activeThemeId}
                onChange={(e) => handleSetTheme(e.target.value)}
                className="bg-transparent text-slate-700 font-semibold py-0 border-none text-[10px] focus:outline-none focus:ring-0 cursor-pointer appearance-none max-w-[80px]"
                title="Change Theme"
              >
                {THEMES.map(th => (
                  <option key={th.id} value={th.id} className="font-sans text-xs">
                    {th.emoji} {th.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Dropdown */}
            {currentUser && (
              <div className="relative" onMouseLeave={() => setIsUserMenuOpen(false)}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 hover:bg-slate-100 rounded-lg transition p-1.5 cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-full ${currentTheme.btnPrimary} flex items-center justify-center font-bold text-[10px] overflow-hidden`}>
                    {currentUser.profileImage ? (
                      <img src={currentUser.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      currentUser.name ? currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-[11px] font-semibold text-slate-800 leading-none">{currentUser.name}</p>
                    <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{currentUser.role}</p>
                  </div>
                  <svg className="h-3 w-3 text-slate-400 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-[1000] overflow-hidden animate-fade-in-up before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                      {currentUser.profileImage ? (
                        <img src={currentUser.profileImage} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer" onClick={() => profileImageRef.current?.click()} title="Change profile image" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0 cursor-pointer relative group" onClick={() => profileImageRef.current?.click()} title="Upload profile image">
                          {currentUser.name ? currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-800">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{currentUser.email}</p>
                        <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${currentTheme.badgeBg}`}>
                          {currentUser.role}
                        </span>
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setIsUserMenuOpen(false); setActiveTab('Users'); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                        {t('users.myProfile')}
                      </button>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); setActiveTab('Users'); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                        {t('users.changePassword')}
                      </button>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); setActiveTab('Users'); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {t('users.userSettings')}
                      </button>
                      <div className="border-t border-slate-100 my-1"></div>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); handleSetCurrentUser(null as any); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                        {t('nav.signOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable central content area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 print:p-0 print:m-0 page-enter" key={activeTab}>
          {/* Pending Refund Alerts Banner */}
          {(() => {
            const pendingRefunds = agents.flatMap(a => (a.pendingRefunds || []).filter(r => r.status === 'Pending'));
            if (pendingRefunds.length === 0) return null;
            return (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3 no-print animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <span className="text-base animate-pulse">⚠️</span>
                  <div>
                    <p className="text-xs font-bold text-rose-800">{pendingRefunds.length} pending refund{pendingRefunds.length > 1 ? 's' : ''} need{pendingRefunds.length === 1 ? 's' : ''} your attention</p>
                    <p className="text-[10px] text-rose-600">Total: {pendingRefunds.reduce((s, r) => s + r.amount, 0).toLocaleString()} SAR</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pendingRefunds.slice(0, 3).map(rf => {
                    const a = agents.find(ag => ag.id === rf.partyId);
                    return (
                      <button
                        key={rf.id}
                        onClick={() => {
                          const updatedAgents = agents.map(ag => {
                            if (ag.id !== rf.partyId) return ag;
                            return {
                              ...ag,
                              pendingRefunds: (ag.pendingRefunds || []).map(pr => pr.id === rf.id ? { ...pr, status: 'Processed' as const } : pr),
                              walletBalance: (ag.walletBalance || 0) - rf.amount,
                            };
                          });
                          setAgents(updatedAgents);
                          ZumraDB.saveAgents(updatedAgents);
                          updatedAgents.forEach(ag => ZumraSync.saveAgent(ag));
                          // Create RefundProcessed transaction
                          const now = new Date().toISOString();
                          const newTr: Transaction = {
                            id: `tr_refund_${rf.id}_${Date.now()}`,
                            docNo: getNextDocNo('REF', transactions),
                            date: now.split('T')[0],
                            type: 'RefundProcessed',
                            amount: rf.amount,
                            agentId: rf.partyId,
                            reservationId: rf.bookingId.toString(),
                            description: `Refund processed for ${a?.name || rf.partyId} (RSV-${rf.bookingId})`,
                            paymentMethod: 'Bank Transfer',
                            voucherNo: getNextVoucherNo('REF', transactions),
                            createdBy: currentUser.name,
                          };
                          const allTx = [...transactions, newTr];
                          setTransactions(allTx);
                          ZumraDB.saveTransactions(allTx);
                          ZumraSync.saveTransaction(newTr);
                          toast.success(`Refund of ${rf.amount.toLocaleString()} SAR marked as processed for ${a?.name || 'agent'}`);
                        }}
                        className="bg-white hover:bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                      >
                        ✅ {rf.party}: {rf.amount.toLocaleString()} SAR (RSV-{rf.bookingId})
                      </button>
                    );
                  })}
                  {pendingRefunds.length > 3 && (
                    <span className="bg-rose-200 text-rose-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                      +{pendingRefunds.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {renderActivePage()}
        </div>

        {/* Status Bar */}
        <footer className={`${currentTheme.mainBg ? 'bg-transparent border-t border-white/10' : 'bg-white border-t border-slate-200'} h-8 px-6 flex items-center justify-between text-[10px] text-slate-400 font-medium flex-shrink-0 no-print select-none`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <FooterLabel field="systemLive" />
            </span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span className="hidden sm:inline"><FooterLabel field="activeNodes" /></span>
          </div>
          <span className="text-slate-400"><FooterLabel field="copyright" /></span>
        </footer>
      </main>

      {/* Inbox Modal */}
      {isInboxOpen && currentUser && (
        <InboxModal 
          currentUser={currentUser} 
          users={users} 
          onClose={() => setIsInboxOpen(false)} 
        />
      )}

      {/* Edit Approval Modal */}
      {showEditApprovalModal && currentUser && (
        <EditApprovalModal
          approvals={editApprovals}
          currentUser={currentUser}
          onApprove={handleApproveEdit}
          onReject={handleRejectEdit}
          onClose={() => setShowEditApprovalModal(false)}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={executeConfirm}
        onCancel={closeConfirm}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-2 py-1.5 rounded-lg transition text-[10px] font-semibold text-slate-600"
      title={lang === 'en' ? 'Switch to Arabic' : 'التبديل للإنجليزية'}
    >
      <span className="text-xs">🌐</span>
      <span>{lang === 'en' ? 'عربي' : 'EN'}</span>
    </button>
  );
}

function FooterLabel({ field }: { field: 'systemLive' | 'activeNodes' | 'copyright' }) {
  const { t } = useLang();
  if (field === 'systemLive') return <>{t('footer.systemLive')}</>;
  if (field === 'activeNodes') return <>{t('footer.activeNodes')}</>;
  return <>{t('footer.copyright', { year: new Date().getFullYear() })}</>;
}
