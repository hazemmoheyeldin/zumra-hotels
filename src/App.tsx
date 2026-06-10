/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import lazyWithRetry from './lib/lazyWithRetry';
import { ZumraDB, ZumraSync, isRecentLocalWrite, getSyncStatus, onSyncStatusChange, flushSyncQueue, clearSyncQueue, SyncStatus, DEFAULT_USERS } from './lib/storage';
import { Hotel, Agent, Allotment, Reservation, Account, Transaction, User, FollowUp, ExternalTransfer, RefundAlert, GlobalAuditEntry, SalesPerson, CancellationReason, TermsAndConditions, OtherService, PaymentGateway, PayByLink, EditApprovalRequest, TaxSettings, Expense, ExpenseCategory, ConsolidatedInvoice, BlackoutPeriod, WaitlistEntry, Message } from './types';
import { getEgyptTime, getReservationTotals, loadFromFirestore, getNextVoucherNo, getNextDocNo, loadBlackoutPeriods, saveBlackoutPeriods, loadWaitlist, saveWaitlist, loadSentReminders, saveSentReminders, seedTestDataIfEmpty, strategicDatabaseReset } from './lib/storage';
import { isFirebaseConfigured, firestoreSubscribe, firestoreLoadAll, firestoreBulkSave, firestoreSave, COLLECTIONS, firebaseCreateUser, firebaseSignIn, firebaseSignOut as fbSignOut, onFirebaseAuthStateChanged, auth, addToStaffWhitelist } from './lib/firebase';
import { useLang } from './lib/LanguageContext';
import { TranslationKey } from './lib/i18n';

// Lazy-loaded page components with auto-retry on stale chunk failure
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'));
const ReservationsPage = lazyWithRetry(() => import('./components/ReservationsPage'));
const HotelsPage = lazyWithRetry(() => import('./components/HotelsPage'));
const AgentsPage = lazyWithRetry(() => import('./components/AgentsPage'));
const GuestsPage = lazyWithRetry(() => import('./components/GuestsPage'));
const AllotmentsPage = lazyWithRetry(() => import('./components/AllotmentsPage'));
const TransactionsPage = lazyWithRetry(() => import('./components/TransactionsPage'));
const ExternalTransfersPage = lazyWithRetry(() => import('./components/ExternalTransfersPage'));
const AccountsPage = lazyWithRetry(() => import('./components/AccountsPage'));
const ReportsPage = lazyWithRetry(() => import('./components/ReportsPage'));
const LedgerReport = lazyWithRetry(() => import('./components/LedgerReport'));
const UserManagementPage = lazyWithRetry(() => import('./components/UserManagementPage'));
const SalesPage = lazyWithRetry(() => import('./components/SalesPage'));
const ProductionPage = lazyWithRetry(() => import('./components/ProductionPage'));
const ClientPortal = lazyWithRetry(() => import('./components/ClientPortal'));
const ClientPortalSettings = lazyWithRetry(() => import('./components/ClientPortalSettings'));
const CalendarView = lazyWithRetry(() => import('./components/CalendarView'));
const AnalyticsDashboard = lazyWithRetry(() => import('./components/AnalyticsDashboard'));
const AuditLogPage = lazyWithRetry(() => import('./components/AuditLogPage'));
const GeneralDataPage = lazyWithRetry(() => import('./components/GeneralDataPage'));
const OtherServicesPage = lazyWithRetry(() => import('./components/OtherServicesPage'));
const PaymentGatewaysPage = lazyWithRetry(() => import('./components/PaymentGatewaysPage'));
const ExpensesPage = lazyWithRetry(() => import('./components/ExpensesPage'));
const GraphsPage = lazyWithRetry(() => import('./components/GraphsPage'));

// Eagerly loaded (needed for login/auth flow — kept lightweight)
import ZumraLogo from './components/ZumraLogo';
import LoginPage from './components/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer, useToast } from './components/Toast';
import { SessionTimeout } from './lib/security';

// Lazy-loaded (only needed AFTER login — reduces initial bundle size)
const Tooltip = lazyWithRetry(() => import('./components/Tooltip'));
const InboxModal = lazyWithRetry(() => import('./components/InboxModal'));
const InvoicePDF = lazyWithRetry(() => import('./components/InvoicePDF'));
const ConfirmDialog = lazyWithRetry(() => import('./components/ConfirmDialog'));
const EditApprovalModal = lazyWithRetry(() => import('./components/EditApprovalModal'));
const GlobalSearchModal = lazyWithRetry(() => import('./components/GlobalSearchModal'));
const ApiWarningBanner = lazyWithRetry(() => import('./components/ApiWarningBanner'));

// Page loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-3 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
  </div>
);

// Efficient shallow comparison to avoid JSON.stringify on large arrays
function arraysEqual(a: any[], b: any[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  // Quick check: compare first and last items by reference or key
  if (a.length === 0) return true;
  if (a[0] !== b[0]) return false;
  if (a.length > 1 && a[a.length - 1] !== b[b.length - 1]) return false;
  return true;
}

// Theme type — all themes must satisfy this shape
interface AppTheme {
  id: string; name: string; emoji: string;
  // Sidebar
  sidebarBg: string; sidebarBorder: string; sidebarHover: string;
  sidebarActive: string; sidebarText: string;
  // Brand
  brandBg: string; brandText: string; brandLetterColor: string;
  // Buttons / badges
  btnPrimary: string; badgeBg: string;
  // Footer
  footerText: string;
  // Top bar gradient
  topBarGradient: string;
  // Full-app surface colors (main content, header, cards, dropdowns)
  mainBg: string;       // Main content area background
  headerBg: string;     // Top header bar background
  headerBorder: string; // Top header bar bottom border
  headerText: string;   // Header text color (page title)
  headerIcon: string;   // Header icon/button text color
  headerHover: string;  // Header button hover background
  cardBg: string;       // Card/panel/dropdown background
  cardBorder: string;   // Card/panel/dropdown border
  cardText: string;     // Card/panel text
  inputBg: string;      // Theme selector / input backgrounds
  inputText: string;    // Theme selector / input text
  footerBg: string;     // Status bar background
  footerBorder: string; // Status bar border
  isDark: boolean;      // True = dark surfaces (white text), False = light surfaces
}

const THEMES: AppTheme[] = [
  {
    id: 'zumra-signature',
    name: 'Zumra Signature',
    emoji: '✨',
    sidebarBg: 'bg-[#0f172a]',
    sidebarBorder: 'border-white/[0.06]',
    sidebarHover: 'hover:bg-white/[0.20]',
    sidebarActive: 'bg-white/[0.25] text-white',
    sidebarText: 'text-slate-200',
    brandBg: 'bg-amber-500',
    brandText: 'text-amber-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-sm',
    badgeBg: 'bg-slate-100 text-slate-700',
    footerText: 'text-slate-500',
    topBarGradient: 'from-[#0f172a] via-slate-700 to-slate-900',
    mainBg: 'bg-slate-50', headerBg: 'bg-white', headerBorder: 'border-slate-200',
    headerText: 'text-slate-900', headerIcon: 'text-slate-500', headerHover: 'hover:bg-slate-100',
    cardBg: 'bg-white', cardBorder: 'border-slate-200', cardText: 'text-slate-700',
    inputBg: 'bg-slate-100 hover:bg-slate-200/80', inputText: 'text-slate-700',
    footerBg: 'bg-white', footerBorder: 'border-slate-200', isDark: false,
  },
  {
    id: 'executive',
    name: 'Executive White',
    emoji: '🏛️',
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
    mainBg: 'bg-slate-100', headerBg: 'bg-white', headerBorder: 'border-slate-200',
    headerText: 'text-slate-900', headerIcon: 'text-slate-500', headerHover: 'hover:bg-slate-100',
    cardBg: 'bg-white', cardBorder: 'border-slate-200', cardText: 'text-slate-700',
    inputBg: 'bg-slate-100 hover:bg-slate-200/80', inputText: 'text-slate-700',
    footerBg: 'bg-white', footerBorder: 'border-slate-200', isDark: false,
  },
  {
    id: 'harbor',
    name: 'Harbor Teal',
    emoji: '⚓',
    sidebarBg: 'bg-[#0c1929]',
    sidebarBorder: 'border-white/[0.06]',
    sidebarHover: 'hover:bg-teal-500/[0.25]',
    sidebarActive: 'bg-teal-500/[0.30] text-white',
    sidebarText: 'text-slate-300',
    brandBg: 'bg-teal-500',
    brandText: 'text-teal-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm',
    badgeBg: 'bg-teal-50 text-teal-700',
    footerText: 'text-slate-500',
    topBarGradient: 'from-teal-500 via-slate-600 to-[#0c1929]',
    mainBg: 'bg-[#0a1628]', headerBg: 'bg-[#0e1d35]', headerBorder: 'border-white/[0.08]',
    headerText: 'text-slate-100', headerIcon: 'text-slate-400', headerHover: 'hover:bg-white/[0.08]',
    cardBg: 'bg-[#111f36]', cardBorder: 'border-white/[0.08]', cardText: 'text-slate-300',
    inputBg: 'bg-[#111f36] hover:bg-[#162742]', inputText: 'text-slate-200',
    footerBg: 'bg-[#0e1d35]', footerBorder: 'border-white/[0.08]', isDark: true,
  },
  {
    id: 'graphite',
    name: 'Graphite Warm',
    emoji: '🪨',
    sidebarBg: 'bg-[#1a1a1a]',
    sidebarBorder: 'border-white/[0.06]',
    sidebarHover: 'hover:bg-white/[0.20]',
    sidebarActive: 'bg-amber-500/[0.25] text-white',
    sidebarText: 'text-neutral-300',
    brandBg: 'bg-amber-600',
    brandText: 'text-amber-500',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm',
    badgeBg: 'bg-amber-50 text-amber-800',
    footerText: 'text-slate-500',
    topBarGradient: 'from-amber-500 via-neutral-600 to-[#1a1a1a]',
    mainBg: 'bg-[#1f1f1f]', headerBg: 'bg-[#262626]', headerBorder: 'border-white/[0.08]',
    headerText: 'text-slate-100', headerIcon: 'text-neutral-400', headerHover: 'hover:bg-white/[0.08]',
    cardBg: 'bg-[#2a2a2a]', cardBorder: 'border-white/[0.08]', cardText: 'text-neutral-300',
    inputBg: 'bg-[#2a2a2a] hover:bg-[#333]', inputText: 'text-neutral-200',
    footerBg: 'bg-[#262626]', footerBorder: 'border-white/[0.08]', isDark: true,
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    emoji: '🌙',
    sidebarBg: 'bg-gray-950',
    sidebarBorder: 'border-gray-800',
    sidebarHover: 'hover:bg-white/[0.18]',
    sidebarActive: 'bg-white/[0.22] text-white',
    sidebarText: 'text-gray-300',
    brandBg: 'bg-amber-500',
    brandText: 'text-amber-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-amber-500 hover:bg-amber-600 text-gray-900 shadow-sm',
    badgeBg: 'bg-gray-800 text-gray-200',
    footerText: 'text-gray-500',
    topBarGradient: 'from-gray-800 via-gray-700 to-gray-900',
    mainBg: 'bg-gray-900', headerBg: 'bg-gray-950', headerBorder: 'border-gray-800',
    headerText: 'text-gray-100', headerIcon: 'text-gray-400', headerHover: 'hover:bg-gray-800',
    cardBg: 'bg-gray-800', cardBorder: 'border-gray-700', cardText: 'text-gray-300',
    inputBg: 'bg-gray-800 hover:bg-gray-700', inputText: 'text-gray-200',
    footerBg: 'bg-gray-950', footerBorder: 'border-gray-800', isDark: true,
  },
  {
    id: 'royal-navy',
    name: 'Royal Navy',
    emoji: '👑',
    sidebarBg: 'bg-[#0F0F1A]',
    sidebarBorder: 'border-white/[0.06]',
    sidebarHover: 'hover:bg-[#1a3a6e]',
    sidebarActive: 'bg-[#1a3a6e] text-white',
    sidebarText: 'text-slate-300',
    brandBg: 'bg-amber-400',
    brandText: 'text-amber-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-amber-500 hover:bg-amber-600 text-[#0F0F1A] shadow-sm',
    badgeBg: 'bg-[#0F3460] text-amber-200',
    footerText: 'text-slate-500',
    topBarGradient: 'from-[#0F3460] via-[#16213E] to-[#0F0F1A]',
    mainBg: 'bg-[#16213E]', headerBg: 'bg-[#0F0F1A]', headerBorder: 'border-white/[0.08]',
    headerText: 'text-white', headerIcon: 'text-slate-400', headerHover: 'hover:bg-white/[0.08]',
    cardBg: 'bg-[#1a2744]', cardBorder: 'border-white/[0.08]', cardText: 'text-slate-300',
    inputBg: 'bg-[#1a2744] hover:bg-[#1e2f52]', inputText: 'text-slate-200',
    footerBg: 'bg-[#0F0F1A]', footerBorder: 'border-white/[0.08]', isDark: true,
  },
];

export default function App() {
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<string>('Dashboard');
  const [activeFilters, setActiveFilters] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Monotonic key that increments on every navigation — forces remount even on same-tab re-click
  const [tabKey, setTabKey] = useState(0);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = React.useRef<HTMLElement>(null);
  const sidebarCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Desktop hover-reveal: open sidebar when mouse enters
  const handleSidebarMouseEnter = () => {
    // Skip on touch devices (mobile) — only desktop uses hover-reveal
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
    if (sidebarCloseTimer.current) { clearTimeout(sidebarCloseTimer.current); sidebarCloseTimer.current = null; }
    if (!sidebarOpen) setSidebarOpen(true);
  };
  // Desktop hover-reveal: close sidebar after short delay when mouse leaves
  const handleSidebarMouseLeave = () => {
    // Skip on touch devices — mobile sidebar must stay open until explicitly closed
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
    if (sidebarCloseTimer.current) clearTimeout(sidebarCloseTimer.current);
    sidebarCloseTimer.current = setTimeout(() => setSidebarOpen(false), 400);
  };
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
  // New feature states
  const [blackoutPeriods, setBlackoutPeriods] = useState<BlackoutPeriod[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  // Messages & Global Search
  const [messages, setMessages] = useState<Message[]>(() => ZumraDB.getMessages());
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const globalSearchRef = useRef<HTMLDivElement>(null);
  // Restore session from localStorage if user was previously logged in
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured); // Block UI until Firebase Auth initializes
  const firestoreListenerUnsubs = useRef<(() => void)[]>([]);
  const dataLoadedRef = useRef(false); // Prevents Phase 2 re-run on profile updates
  const listenersAttachedRef = useRef(false); // Prevents Firestore listener teardown on user switch
  const migrationDoneRef = useRef(false); // Migration only runs once per app session
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

      // Document expiry alerts (passport & visa)
      if (res.status !== 'Cancelled') {
        if (res.passportExpiry) {
          const pExp = new Date(res.passportExpiry);
          const daysToExpiry = Math.ceil((pExp.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysToExpiry <= 90 && daysToExpiry >= 0) {
            alerts.push({
              id: `passport_${res.id}`,
              type: 'Passport Expiring',
              message: `RSV-${res.id} (${res.guestName}) passport expires in ${daysToExpiry} days (${res.passportExpiry})`,
              resId: res.id.toString(),
            });
          } else if (daysToExpiry < 0) {
            alerts.push({
              id: `passport_exp_${res.id}`,
              type: 'Passport Expired',
              message: `RSV-${res.id} (${res.guestName}) passport EXPIRED on ${res.passportExpiry}`,
              resId: res.id.toString(),
            });
          }
        }
        if (res.visaExpiry) {
          const vExp = new Date(res.visaExpiry);
          const daysToExpiry = Math.ceil((vExp.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysToExpiry <= 60 && daysToExpiry >= 0) {
            alerts.push({
              id: `visa_${res.id}`,
              type: 'Visa Expiring',
              message: `RSV-${res.id} (${res.guestName}) visa expires in ${daysToExpiry} days (${res.visaExpiry})`,
              resId: res.id.toString(),
            });
          } else if (daysToExpiry < 0) {
            alerts.push({
              id: `visa_exp_${res.id}`,
              type: 'Visa Expired',
              message: `RSV-${res.id} (${res.guestName}) visa EXPIRED on ${res.visaExpiry}`,
              resId: res.id.toString(),
            });
          }
        }
      }
    });
    return alerts;
  };
  
  const currentAlerts = getAlerts();
  const alertCount = currentAlerts.length;

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: Auth initialization + users loading (runs on mount)
  // Loads users for login screen AND waits for Firebase Auth state
  // before unblocking the UI. Prevents race conditions where the
  // dashboard renders before Firebase Auth has finished initializing.
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // Load users for login form
    const loadedUsers = ZumraDB.getUsers();
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
    } else {
      setUsers(loadedUsers);
    }

    if (!isFirebaseConfigured) {
      // No Firebase — unblock immediately
      setAuthLoading(false);
      return;
    }

    // Wait for Firebase Auth to report its initial state before unblocking UI
    let settled = false;
    const unsub = onFirebaseAuthStateChanged((fbUser) => {
      if (settled) return;
      settled = true;
      unsub();
      console.log('[Firebase Auth] onAuthStateChanged:', fbUser ? `signed in as ${fbUser.email || fbUser.uid}` : 'not signed in (null)');

      // If Firebase has a signed-in user, try to restore their app session
      if (fbUser) {
        const savedUser = localStorage.getItem('zumra_current_user');
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser);
            if (user && user.username && user.role) {
              setCurrentUser(user as User);
              console.log('[Firebase Auth] Session restored for:', user.username);
            }
          } catch {}
        }
      }

      setAuthLoading(false);
    });

    // Safety timeout: unblock after 8s even if onAuthStateChanged never fires
    // (persistence may take longer on slow connections or custom domains)
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        unsub();
        console.warn('[Firebase Auth] onAuthStateChanged timeout after 8s — unblocking UI');
        setAuthLoading(false);
      }
    }, 8000);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: Heavy data loading (runs ONLY after user authenticates)
  // Loads all collections, seeds data, attaches Firestore listeners.
  // This does NOT block the login page — it runs after login success.
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser) return; // ← GATE: skip until user is authenticated
    if (dataLoadedRef.current) return; // ← GATE: already loaded, skip re-run
    dataLoadedRef.current = true;
    const user = currentUser; // capture for closures

    // 1. Load all collections from localStorage into state
    setHotels(ZumraDB.getHotels());
    setAgents(ZumraDB.getAgents());
    setAllotments(ZumraDB.getAllotments());
    setReservations(ZumraDB.getReservations());
    setAccounts(ZumraDB.getAccounts());
    setTransactions(ZumraDB.getTransactions());
    setExternalTransfers(ZumraDB.getExternalTransfers());
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
    // Load new feature data
    setBlackoutPeriods(loadBlackoutPeriods());
    setWaitlist(loadWaitlist());
    // Seed hotels if empty (first run or force reset) — dynamic import to keep login bundle small
    import('./lib/hotelSeed').then(({ seedHotelsIfEmpty }) => {
      const seededHotels = seedHotelsIfEmpty(false);
      if (seededHotels.length > 0 && ZumraDB.getHotels().length === 0) {
        setHotels(seededHotels);
      }
    });
    // Seed test data (clients, suppliers, reservations) ONLY for first admin
    // New staff members should see data from Firestore, not get their own seeded copies
    const allUsers = ZumraDB.getUsers();
    const isFirstAdmin = allUsers.length <= 1 && allUsers.some(u => u.username === 'hazem' || u.role === 'Admin');
    if (isFirstAdmin && !localStorage.getItem('zumra_test_data_seeded')) {
      seedTestDataIfEmpty();
      localStorage.setItem('zumra_test_data_seeded', 'true');
    }
    // Reload agents/reservations in case test data was seeded
    const loadedAgents = ZumraDB.getAgents();
    // Backfill portal tokens for existing agents that don't have one
    const agentsNeedToken = loadedAgents.some((a: Agent) => !a.portalToken && a.type !== 'Supplier');
    if (agentsNeedToken) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const withTokens = loadedAgents.map((a: Agent) => {
        if (a.portalToken || a.type === 'Supplier') return a;
        const rv = new Uint8Array(32);
        crypto.getRandomValues(rv);
        let token = '';
        for (let i = 0; i < 32; i++) token += chars[rv[i] % chars.length];
        return { ...a, portalToken: token };
      });
      ZumraDB.saveAgents(withTokens);
      setAgents(withTokens);
    } else {
      setAgents(loadedAgents);
    }
    setReservations(ZumraDB.getReservations());
    setSalesPersons(ZumraDB.getSalesPersons());

    // Restore Firebase Auth session and run migration
    if (isFirebaseConfigured) {
      // One-time strategic database reset (clears transactional data, preserves hotels/config)
      const runResetIfNeeded = async () => {
        if (!localStorage.getItem('zumra_db_reset_v4_done')) {
          try {
            const result = await strategicDatabaseReset();
            localStorage.setItem('zumra_db_reset_v4_done', 'true');
            console.log(`[Migration] DB reset v4 complete: cleared ${result.cleared} records. Preserved:`, result.preserved);
            // Reload fresh empty states
            setReservations([]);
            setTransactions([]);
            setAccounts([]);
            setExternalTransfers([]);
            setFollowUps([]);
            setExpenses([]);
            setConsolidatedInvoices([]);
            setAgents([]);  // Agents cleared in v3
            setAllotments(ZumraDB.getAllotments());
            setUsers(ZumraDB.getUsers());
          } catch (e) {
            console.error('[Migration] DB reset failed:', e);
          }
        }
      };
      runResetIfNeeded();

      // Initial Firestore data migration (runs once, AFTER auth is confirmed)
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
                await firestoreBulkSave(col.name, freshHotels);
                col.setter(freshHotels);
                localStorage.removeItem('zumra_hotels_migrated');
                continue;
              }
            }
            if (firestoreData.length > 0) {
              // Firestore has data -> merge for users, use directly for others
              if (col.name === COLLECTIONS.USERS) {
                // Merge: deduplicate by email AND username (not just ID)
                // DEFAULT_USERS are always preserved; Firestore version takes priority
                const localData = col.loader();
                const mergedMap = new Map<string, any>();
                // Start with DEFAULT_USERS as baseline (always present)
                DEFAULT_USERS.forEach(u => mergedMap.set(u.id, u));
                // Index local users by email and username for dedup
                const localByEmail = new Map<string, any>();
                const localByUsername = new Map<string, any>();
                localData.forEach((u: any) => {
                  if (u.email) localByEmail.set(u.email.toLowerCase(), u);
                  localByUsername.set(u.username.toLowerCase(), u);
                });
                // Add Firestore users first (source of truth)
                firestoreData.forEach((u: any) => {
                  mergedMap.set(u.id, u);
                  // Remove matching local user so it's not added again
                  if (u.email) localByEmail.delete(u.email.toLowerCase());
                  localByUsername.delete(u.username.toLowerCase());
                });
                // Add remaining local users (not in Firestore by email or username)
                localData.forEach((u: any) => {
                  const matchedByEmail = u.email && !localByEmail.has(u.email.toLowerCase());
                  const matchedByUsername = !localByUsername.has(u.username.toLowerCase());
                  if (matchedByEmail || matchedByUsername) return; // Already merged via Firestore
                  mergedMap.set(u.id, u); // Unique local user, keep it
                });
                const merged = Array.from(mergedMap.values());
                localStorage.setItem(col.key, JSON.stringify(merged));
                col.setter(merged);
              } else {
                localStorage.setItem(col.key, JSON.stringify(firestoreData));
                col.setter(firestoreData);
              }
            } else {
              // Firestore empty -> upload localStorage data to seed it
              const localData = col.loader();
              if (localData.length > 0) {
                await firestoreBulkSave(col.name, localData);
              }
            }
          }
          // Ensure users are always in Firestore (critical for multi-device login)
          const currentUsers = ZumraDB.getUsers();
          if (currentUsers.length > 0) {
            await firestoreBulkSave(COLLECTIONS.USERS, currentUsers);
          }
          // Initial data sync complete
        } catch (err) {
          console.warn('[Firebase] Migration error:', err);
          throw err; // Re-throw so retry logic can catch it
        }
      };

      // Wait for Firebase Auth to be ready, then migrate
      const waitForAuthAndMigrate = async () => {
        try {
          // Wait for onAuthStateChanged to fire (Firebase Auth initialization)
          // onFirebaseAuthStateChanged now awaits persistence internally
          await new Promise<void>((resolve) => {
            const unsub = onFirebaseAuthStateChanged((fbUser) => {
              unsub();
              resolve();
            });
            // Safety timeout: 6 seconds max (persistence may take time on custom domains)
            setTimeout(() => {
              unsub();
              console.warn('[Firebase Auth] Auth state timeout after 6s — proceeding without Firebase Auth');
              resolve();
            }, 6000);
          });

          // Check if already authenticated (from browserLocalPersistence)
          let isAuthed = !!auth?.currentUser;

          // If not authenticated, try to sign in with stored user credentials
          if (!isAuthed && user?.email) {
            const fbPwd = user.password || `${user.username}123`;
            isAuthed = await firebaseSignIn(user.email, fbPwd);
            if (!isAuthed) {
              // Firebase Auth user doesn't exist yet — create it
              await firebaseCreateUser(user.email, fbPwd);
              isAuthed = await firebaseSignIn(user.email, fbPwd);
            }
            if (isAuthed) {
              // Session restored
            } else {
              console.warn(`[Firebase Auth] Could not authenticate ${user.email} — continuing with localStorage data`);
            }
          }

          // Fallback: if no user (shouldn't happen due to gate), try default admin
          if (!isAuthed && !user) {
            const defaultAdmins = ZumraDB.getUsers().filter(u => u.role === 'Admin');
            for (const admin of defaultAdmins) {
              if (admin.email) {
                const fbPwd = admin.password || `${admin.username}123`;
                isAuthed = await firebaseSignIn(admin.email, fbPwd);
                if (!isAuthed) {
                  await firebaseCreateUser(admin.email, fbPwd);
                  isAuthed = await firebaseSignIn(admin.email, fbPwd);
                }
                if (isAuthed) {
                  break;
                }
              }
            }
          }

          // Retry migration up to 2 times if auth is confirmed but first read fails
          let migrateRetries = 0;
          const maxRetries = isAuthed ? 2 : 0;
          while (migrateRetries <= maxRetries) {
            try {
              await migrateData();
              break;
            } catch (err) {
              migrateRetries++;
              if (migrateRetries <= maxRetries) {
                console.warn(`[Firebase] Migration attempt ${migrateRetries} failed, retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
              } else {
                console.warn('[Firebase] Migration failed after retries, using localStorage data');
              }
            }
          }

          // Background: ensure other users have Firebase Auth accounts (non-blocking)
          // This runs AFTER the UI is unblocked so it doesn't cause "Verifying Session" hang
          const allUsers = ZumraDB.getUsers();
          if (allUsers.length > 1 && isAuthed) {
            // Use a small delay to let the UI render first
            setTimeout(async () => {
              for (const u of allUsers) {
                if (u.email && u.email !== user?.email) {
                  const pwd = u.password || `${u.username}123`;
                  try {
                    await firebaseCreateUser(u.email, pwd);
                  } catch { /* ignore - user might already exist */ }
                }
              }
              // Re-authenticate as current user after bulk creation
              if (user?.email) {
                const fbPwd = user.password || `${user.username}123`;
                await firebaseSignIn(user.email, fbPwd).catch(() => {});
              }
            }, 3000);
          }
        } catch (err) {
          console.error(`[Firebase Auth] Migration error:`, err);
        } finally {
          // ALWAYS unblock the UI, even if something failed
          setAuthLoading(false);
        }
      };

      // Function to attach real-time Firestore listeners (called AFTER auth is confirmed)
      const attachFirestoreListeners = () => {
        console.log('[Firestore] Attaching real-time listeners for all collections...');
        // Listeners suppress updates for 3s after local writes to prevent echo/race conditions
        const unsubs = [
        firestoreSubscribe<Hotel>(COLLECTIONS.HOTELS, (data) => {
          if (!isRecentLocalWrite() && !localStorage.getItem('zumra_hotels_migrated')) {
            localStorage.setItem('zumra_hotels', JSON.stringify(data));
            setHotels(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<Agent>(COLLECTIONS.AGENTS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_agents', JSON.stringify(data));
            setAgents(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<Allotment>(COLLECTIONS.ALLOTMENTS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_allotments', JSON.stringify(data));
            setAllotments(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<Reservation>(COLLECTIONS.RESERVATIONS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_reservations', JSON.stringify(data));
            setReservations(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<Account>(COLLECTIONS.ACCOUNTS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_accounts', JSON.stringify(data));
            setAccounts(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<Transaction>(COLLECTIONS.TRANSACTIONS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_transactions', JSON.stringify(data));
            setTransactions(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<ExternalTransfer>(COLLECTIONS.EXTERNAL_TRANSFERS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_external_transfers', JSON.stringify(data));
            setExternalTransfers(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<User>(COLLECTIONS.USERS, (data) => {
          if (!isRecentLocalWrite()) {
            // Merge Firestore data with DEFAULT_USERS to prevent user loss
            // DEFAULT_USERS are always preserved; Firestore data updates/overrides by ID
            const mergedMap = new Map<string, User>();
            DEFAULT_USERS.forEach(u => mergedMap.set(u.id, u));
            data.forEach(u => mergedMap.set(u.id, u));
            const merged = Array.from(mergedMap.values());
            localStorage.setItem('zumra_users', JSON.stringify(merged));
            setUsers(prev => arraysEqual(prev, merged) ? prev : merged);
          }
        }),
        firestoreSubscribe<FollowUp>(COLLECTIONS.FOLLOW_UPS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_follow_ups', JSON.stringify(data));
            setFollowUps(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<SalesPerson>(COLLECTIONS.SALES_PERSONS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_sales_persons', JSON.stringify(data));
            setSalesPersons(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<CancellationReason>(COLLECTIONS.CANCELLATION_REASONS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_cancellation_reasons', JSON.stringify(data));
            setCancellationReasons(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<TermsAndConditions>(COLLECTIONS.TERMS_CONDITIONS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_terms_conditions', JSON.stringify(data));
            setTermsAndConditions(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<OtherService>(COLLECTIONS.OTHER_SERVICES, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_other_services', JSON.stringify(data));
            setOtherServices(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<PaymentGateway>(COLLECTIONS.PAYMENT_GATEWAYS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_payment_gateways', JSON.stringify(data));
            setPaymentGateways(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<PayByLink>(COLLECTIONS.PAY_BY_LINKS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_pay_by_links', JSON.stringify(data));
            setPayByLinks(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<EditApprovalRequest>(COLLECTIONS.EDIT_APPROVALS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_edit_approvals', JSON.stringify(data));
            setEditApprovals(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<TaxSettings>(COLLECTIONS.TAX_SETTINGS, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_tax_settings', JSON.stringify(data));
            setTaxSettings(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<Expense>(COLLECTIONS.EXPENSES, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_expenses', JSON.stringify(data));
            setExpenses(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<ExpenseCategory>(COLLECTIONS.EXPENSE_CATEGORIES, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_expense_categories', JSON.stringify(data));
            setExpenseCategories(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<ConsolidatedInvoice>(COLLECTIONS.CONSOLIDATED_INVOICES, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_consolidated_invoices', JSON.stringify(data));
            setConsolidatedInvoices(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
        firestoreSubscribe<Message>(COLLECTIONS.MESSAGES, (data) => {
          if (!isRecentLocalWrite()) {
            localStorage.setItem('zumra_messages', JSON.stringify(data));
            setMessages(prev => arraysEqual(prev, data) ? prev : data);
          }
        }),
      ];
        // Store unsubs in ref for cleanup
        firestoreListenerUnsubs.current = unsubs;
        console.log('[Firestore] All', unsubs.length, 'real-time listeners attached successfully');
      };

      // Call attachFirestoreListeners after auth is confirmed, then run migration in background
      const wrappedWaitForAuth = async () => {
        try {
          if (migrationDoneRef.current) {
            // Migration already done — just re-authenticate as the new user for Firestore rules
            if (user?.email) {
              const fbPwd = user.password || `${user.username}123`;
              const isAuthed = await firebaseSignIn(user.email, fbPwd).catch(() => false);
              if (!isAuthed) {
                console.warn(`[Firebase Auth] Re-auth failed for ${user.email} — creating account`);
                await firebaseCreateUser(user.email, fbPwd).catch(() => {});
                await firebaseSignIn(user.email, fbPwd).catch(() => {});
              }
            }
          } else {
            await waitForAuthAndMigrate();
            migrationDoneRef.current = true;
          }
        } catch (err) {
          console.error('[Firebase] Auth/Migration failed, proceeding with listeners anyway:', err);
        } finally {
          // ALWAYS attach listeners — but only once per session
          if (!listenersAttachedRef.current) {
            attachFirestoreListeners();
            listenersAttachedRef.current = true;
          } else {
            console.log('[Firestore] Listeners already attached — skipping re-attachment');
          }
        }
      };
      wrappedWaitForAuth();

      // Also listen for cross-tab localStorage changes (for theme etc.)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'zumra_theme') {
          setActiveThemeId(e.newValue || 'zumra-signature');
        }
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        // DO NOT tear down Firestore listeners on user switch — they persist for the session
        // Only clean up on component unmount (listenersAttachedRef will be garbage collected)
        window.removeEventListener('storage', handleStorage);
      };
    } else {
      // Firebase not configured - localStorage only
      const runSync = () => {
        try {
          setHotels(prev => { const f = ZumraDB.getHotels(); return f.length !== prev.length ? f : prev; });
          setAgents(prev => { const f = ZumraDB.getAgents(); return f.length !== prev.length ? f : prev; });
          setAllotments(prev => { const f = ZumraDB.getAllotments(); return f.length !== prev.length ? f : prev; });
          setReservations(prev => { const f = ZumraDB.getReservations(); return f.length !== prev.length ? f : prev; });
          setAccounts(prev => { const f = ZumraDB.getAccounts(); return f.length !== prev.length ? f : prev; });
          setTransactions(prev => { const f = ZumraDB.getTransactions(); return f.length !== prev.length ? f : prev; });
          setExternalTransfers(prev => { const f = ZumraDB.getExternalTransfers(); return f.length !== prev.length ? f : prev; });
          setUsers(prev => { const f = ZumraDB.getUsers(); return f.length !== prev.length ? f : prev; });
          setFollowUps(prev => { const f = ZumraDB.getFollowUps(); return f.length !== prev.length ? f : prev; });
        } catch {
          // Silent sync error - continue polling
        }
      };
      const handleStorage = (e: StorageEvent) => {
        if (e.key && e.key.startsWith('zumra_')) runSync();
      };
      window.addEventListener('storage', handleStorage);
      const interval = setInterval(runSync, 5000);
      return () => {
        window.removeEventListener('storage', handleStorage);
        clearInterval(interval);
      };
    }
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Auto-cleanup orphaned follow-ups (agent/client no longer exists)
  const orphanCleanupDoneRef = useRef(false);
  useEffect(() => {
    if (!currentUser || orphanCleanupDoneRef.current) return;
    if (followUps.length === 0 || agents.length === 0) return;
    orphanCleanupDoneRef.current = true;
    const agentIds = new Set(agents.map(a => a.id));
    const orphans = followUps.filter(f => f.clientId && !agentIds.has(f.clientId));
    if (orphans.length > 0) {
      const cleaned = followUps.filter(f => !(f.clientId && !agentIds.has(f.clientId)));
      setFollowUps(cleaned);
      ZumraDB.saveFollowUps(cleaned);
      orphans.forEach(f => ZumraSync.deleteFollowUp(f.id));
      console.log(`[Cleanup] Purged ${orphans.length} orphaned follow-up(s) from database`);
    }
  }, [currentUser, followUps, agents]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global Search: click-outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (globalSearchRef.current && !globalSearchRef.current.contains(e.target as Node)) {
        setGlobalSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Search: computed results
  const searchResults = React.useMemo(() => {
    if (!globalSearchQuery.trim()) return [];
    const q = globalSearchQuery.trim().toLowerCase();
    return reservations.filter(r => {
      const rsvId = `RSV-${r.id}`.toLowerCase();
      const guest = r.guestName?.toLowerCase() || '';
      const hotel = hotels.find(h => h.id === r.hotelId)?.name?.toLowerCase() || '';
      const agent = agents.find(a => a.id === r.clientId)?.name?.toLowerCase() || '';
      const status = r.status?.toLowerCase() || '';
      return rsvId.includes(q) || guest.includes(q) || hotel.includes(q) || agent.includes(q) || status.includes(q) || r.checkIn?.includes(q) || r.checkOut?.includes(q);
    }).slice(0, 8);
  }, [globalSearchQuery, reservations, hotels, agents]);

  // Helper: save message to both localStorage and Firestore
  const handleSaveMessages = (updatedMessages: Message[]) => {
    setMessages(updatedMessages);
    ZumraDB.saveMessages(updatedMessages);
    // Sync each new message to Firestore
    if (isFirebaseConfigured) {
      const existing = new Set(messages.map(m => m.id));
      updatedMessages.filter(m => !existing.has(m.id)).forEach(m => {
        firestoreSave(COLLECTIONS.MESSAGES, m.id, m).catch(() => {});
      });
      // Also sync read-status changes
      updatedMessages.forEach(m => {
        firestoreSave(COLLECTIONS.MESSAGES, m.id, m).catch(() => {});
      });
    }
  };

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
  const handleSaveAgent = (a: Agent, onSuccess?: () => void) => {
    showConfirm('Save Agent', `Save agent "${a.name}"?`, () => { doSaveAgent(a); onSuccess?.(); });
  };

  const doDeleteAgent = (id: string) => {
    const a = agents.find(i => i.id === id);
    const updated = agents.filter(item => item.id !== id);
    setAgents(updated);
    ZumraDB.saveAgents(updated);
    ZumraSync.deleteAgent(id);
    // Cascade: remove follow-ups that reference this agent (prevents orphaned dashboard alerts)
    const orphanedFollowUps = followUps.filter(f => f.clientId === id);
    if (orphanedFollowUps.length > 0) {
      const cleanedFollowUps = followUps.filter(f => f.clientId !== id);
      setFollowUps(cleanedFollowUps);
      ZumraDB.saveFollowUps(cleanedFollowUps);
      // Sync each removed follow-up to Firestore
      orphanedFollowUps.forEach(f => ZumraSync.deleteFollowUp(f.id));
      console.log(`[Cascade] Removed ${orphanedFollowUps.length} orphaned follow-up(s) for agent "${a?.name || id}"`);
    }
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
  const handleBulkAction = (action: 'confirm' | 'cancel' | 'delete', ids: number[]) => {
    const count = ids.length;
    if (count === 0) return;

    if (action === 'delete') {
      showConfirm(
        `Delete ${count} Reservation(s)`,
        `Are you sure you want to permanently delete ${count} reservation(s)? This cannot be undone.`,
        () => {
          const idSet = new Set(ids.map(id => id.toString()));
          const updated = reservations.filter(r => !idSet.has(r.id.toString()));
          setReservations(updated);
          ZumraDB.saveReservations(updated);
          ids.forEach(id => ZumraSync.deleteReservation(id.toString()));
          toast.success(`${count} reservation(s) deleted`);
        },
        'destructive'
      );
    } else if (action === 'confirm') {
      showConfirm(
        `Confirm ${count} Reservation(s)`,
        `Set status to Confirmed for ${count} reservation(s)?`,
        () => {
          const idSet = new Set(ids);
          const updated = reservations.map(r =>
            idSet.has(r.id) && r.status !== 'Confirmed'
              ? { ...r, status: 'Confirmed' as const }
              : r
          );
          setReservations(updated);
          ZumraDB.saveReservations(updated);
          updated.filter(r => idSet.has(r.id)).forEach(r => ZumraSync.saveReservation(r));
          toast.success(`${count} reservation(s) confirmed`);
        }
      );
    } else if (action === 'cancel') {
      showConfirm(
        `Cancel ${count} Reservation(s)`,
        `Cancel ${count} reservation(s)? This action cannot be undone.`,
        () => {
          const idSet = new Set(ids);
          const updated = reservations.map(r =>
            idSet.has(r.id) && r.status !== 'Cancelled'
              ? { ...r, status: 'Cancelled' as const, cancellationReason: 'Bulk cancellation' }
              : r
          );
          setReservations(updated);
          ZumraDB.saveReservations(updated);
          updated.filter(r => idSet.has(r.id)).forEach(r => ZumraSync.saveReservation(r));
          toast.success(`${count} reservation(s) cancelled`);
        },
        'destructive'
      );
    }
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

  // Client Portal: Update agreement status
  const handleUpdateAgreementStatus = (resId: number, newStatus: 'Approved' | 'Declined') => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    const updated = reservations.map(r => r.id === resId ? { ...r, agreementStatus: newStatus, agreementConfirmed: newStatus === 'Approved' } : r);
    setReservations(updated);
    ZumraDB.saveReservations(updated);
    const updatedRes = updated.find(r => r.id === resId);
    if (updatedRes) ZumraSync.saveReservation(updatedRes);
    toast.success(`RSV-${resId} agreement ${newStatus === 'Approved' ? 'approved' : 'declined'}`);
  };

  // Waitlist save handler
  const handleSaveWaitlist = (entry: WaitlistEntry) => {
    const updated = [...waitlist.filter(w => w.id !== entry.id), entry];
    setWaitlist(updated);
    saveWaitlist(updated);
  };

  // Auto pre-arrival reminder effect (3 days before check-in)
  useEffect(() => {
    if (!reservations.length || !hotels.length) return;
    const sentReminders = loadSentReminders();
    const today = new Date();
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);
    const targetDate = threeDaysLater.toISOString().split('T')[0];
    
    const upcomingReservations = reservations.filter(r => {
      if (r.status !== 'Confirmed') return false;
      if (r.checkIn !== targetDate) return false;
      const reminderKey = `reminder_${r.id}_${r.checkIn}`;
      if (sentReminders.includes(reminderKey)) return false;
      return true;
    });
    
    upcomingReservations.forEach(async (r) => {
      const hotel = hotels.find(h => h.id === r.hotelId);
      const client = agents.find(a => a.id === r.clientId);
      if (!client?.email || !hotel) return;
      
      const roomTypes = r.rooms.map(rm => rm.roomType).join(', ');
      const { sendPreArrivalReminder } = await import('./lib/email');
      const result = await sendPreArrivalReminder(
        client.email,
        r.guestName,
        hotel.name,
        r.checkIn,
        r.checkOut,
        r.nights,
        roomTypes,
        r.specialRequests || '',
        r.id
      );
      
      if (result.success) {
        const reminderKey = `reminder_${r.id}_${r.checkIn}`;
        const updatedReminders = [...loadSentReminders(), reminderKey];
        saveSentReminders(updatedReminders);
        // Pre-arrival reminder sent
      }
    });
  }, [reservations, hotels]);

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

  const doAddUser = async (user: User) => {
    const existing = users.find(u => u.id === user.id);

    // ===== Admin Protection Guard =====
    // Prevent demoting the last Admin to a non-Admin role
    if (existing && existing.role === 'Admin' && user.role !== 'Admin') {
      const adminCount = users.filter(u => u.role === 'Admin').length;
      if (adminCount <= 1) {
        toast.error('Cannot demote the last Admin. Promote another user to Admin first.');
        return;
      }
    }
    // Prevent changing the primary admin's email (hazem8383@gmail.com)
    if (existing && existing.email === 'hazem8383@gmail.com' && user.email !== 'hazem8383@gmail.com') {
      toast.error('The primary admin email cannot be changed.');
      return;
    }

    const updated = existing
      ? users.map(u => u.id === user.id ? user : u)
      : [...users, user];
    setUsers(updated);
    ZumraDB.saveUsers(updated);
    // Save user to Firestore IMMEDIATELY (while admin is still authenticated)
    ZumraSync.saveUser(user).then(() => {
      console.log(`[doAddUser] Firestore sync completed for ${user.username}`);
    }).catch(err => {
      console.error(`[doAddUser] Firestore sync failed for ${user.username}:`, err);
    });
    // Also bulk-save all users to Firestore to ensure consistency
    if (isFirebaseConfigured) {
      firestoreBulkSave(COLLECTIONS.USERS, updated).catch(() => {});
    }
    // Create Firebase Auth user (required for Firestore security rules)
    if (isFirebaseConfigured && user.email) {
      addToStaffWhitelist(user.email); // Ensure new user can access via Google Sign-In too
      const fbPwd = user.password || `${user.username}123`;
      await firebaseCreateUser(user.email, fbPwd);
      // Re-authenticate as current admin (firebaseCreateUser signs in as the new user)
      if (currentUser?.email && currentUser.email !== user.email) {
        const adminPwd = currentUser.password || `${currentUser.username}123`;
        await firebaseSignIn(currentUser.email, adminPwd);
      }
    }
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
    // Guard: prevent deleting the primary admin account
    if (targetUser?.email === 'hazem8383@gmail.com') {
      toast.error('The primary admin account cannot be deleted.');
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
      dataLoadedRef.current = false; // Reset so next login triggers Phase 2 again
      // Sign out from Firebase Auth (required to clear request.auth for security rules)
      if (isFirebaseConfigured) {
        fbSignOut().catch(() => {});
      }
    }
  };

  // Profile image upload
  const profileImageRef = useRef<HTMLInputElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // ===== Centralized Navigation with Browser History =====
  // Pushes state to browser history so back/forward buttons work.
  // Always increments tabKey to force remount even on same-tab re-click.
  const navigateTo = (tab: string, filters?: any) => {
    setActiveFilters(filters ?? null);
    setActiveTab(tab);
    setTabKey(k => k + 1);
    window.history.pushState({ tab, filters: filters ?? null }, '', `#${encodeURIComponent(tab)}`);
    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Restore tab from URL hash on initial load
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const decoded = decodeURIComponent(hash);
      setActiveTab(decoded);
    }
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.tab) {
        setActiveFilters(e.state.filters ?? null);
        setActiveTab(e.state.tab);
        setTabKey(k => k + 1);
      } else {
        // Fallback: read from hash
        const hash = window.location.hash.replace('#', '');
        if (hash) {
          setActiveTab(decodeURIComponent(hash));
          setTabKey(k => k + 1);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Scroll content area to top whenever active tab changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has remounted (key={tabKey})
    requestAnimationFrame(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = 0;
      }
    });
  }, [activeTab]);

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
      const updatedUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
      setUsers(updatedUsers);
      ZumraDB.saveUsers(updatedUsers);
      ZumraSync.saveUser(updatedUser);
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
    navigateTo(tab, initialFilters);
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
              navigateTo('Reservations', { showNewForm: true });
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
            onSaveReservation={handleSaveReservation}
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
      case 'Graphs':
        return (
          <ErrorBoundary fallbackLabel="Graphs failed to load.">
          <GraphsPage
            reservations={reservations}
            agents={agents}
            hotels={hotels}
            transactions={transactions}
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
            onBulkAction={handleBulkAction}
            accounts={accounts}
            onSaveTransaction={handleSaveTransaction}
            transactions={transactions}
            allotments={allotments}
            onSaveAllotment={handleSaveAllotment}
            onLogAudit={handleLogAudit}
            currentUserRole={currentUser.role}
            onRequestEditApproval={handleRequestEditApproval}
            onNavigate={handleNavigate}
            termsAndConditions={termsAndConditions}
            salesPersons={salesPersons}
            followUps={followUps}
            onSaveFollowUp={handleSaveFollowUp}
            blackoutPeriods={blackoutPeriods}
            onSaveWaitlist={handleSaveWaitlist}
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
      case 'Guests':
        return (
          <ErrorBoundary fallbackLabel="Guests page failed to load.">
          <GuestsPage
            reservations={reservations}
            agents={agents}
            hotels={hotels}
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
            salesPersons={salesPersons}
            initialTab={activeFilters?.reportTab}
            onNavigate={handleNavigate}
            onSaveReservation={doSaveReservation}
          />
          </ErrorBoundary>
        );
      case 'Ledger':
        return (
          <ErrorBoundary fallbackLabel="Ledger report failed to load.">
          <LedgerReport
            reservations={reservations}
            transactions={transactions}
            agents={agents}
            hotels={hotels}
            expenses={expenses}
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
            hotels={hotels}
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
      case 'Client Portal':
        return (
          <ErrorBoundary fallbackLabel="Client Portal settings failed to load.">
          <ClientPortalSettings
            onLogAudit={handleLogAuditSimple}
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

  // Keyboard shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);
    const [showCalc, setShowCalc] = useState(false);
    const [calcBuy, setCalcBuy] = useState<number>(0);
    const [calcSell, setCalcSell] = useState<number>(0);
    const [calcTab, setCalcTab] = useState<'markup' | 'calc'>('markup');
    // Real calculator state
    const [calcDisplay, setCalcDisplay] = useState('0');
    const [calcExpr, setCalcExpr] = useState('');
    const [calcNewNum, setCalcNewNum] = useState(true);

  // Keyboard input for the calculator
  useEffect(() => {
    if (!showCalc || calcTab !== 'calc') return;
    const handleKey = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        if (calcNewNum) { setCalcDisplay(key); setCalcNewNum(false); }
        else { setCalcDisplay(d => d === '0' ? key : d + key); }
      } else if (key === '.') {
        e.preventDefault();
        if (calcNewNum) { setCalcDisplay('0.'); setCalcNewNum(false); }
        else { setCalcDisplay(d => d.includes('.') ? d : d + '.'); }
      } else if (key === '+') {
        e.preventDefault(); setCalcExpr(calcExpr + calcDisplay + ' + '); setCalcNewNum(true);
      } else if (key === '-') {
        e.preventDefault(); setCalcExpr(calcExpr + calcDisplay + ' \u2212 '); setCalcNewNum(true);
      } else if (key === '*') {
        e.preventDefault(); setCalcExpr(calcExpr + calcDisplay + ' \u00d7 '); setCalcNewNum(true);
      } else if (key === '/') {
        e.preventDefault(); setCalcExpr(calcExpr + calcDisplay + ' \u00f7 '); setCalcNewNum(true);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        try {
          const fullExpr = calcExpr + calcDisplay;
          const evalExpr = fullExpr.replace(/\u00d7/g, '*').replace(/\u00f7/g, '/').replace(/\u2212/g, '-');
          const result = Function('"use strict"; return (' + evalExpr + ')')();
          setCalcExpr(fullExpr + ' =');
          setCalcDisplay(String(Number.isFinite(result) ? parseFloat(Number(result).toFixed(8)) : 'Error'));
          setCalcNewNum(true);
        } catch { setCalcDisplay('Error'); setCalcNewNum(true); }
      } else if (key === 'Escape' || key === 'c' || key === 'C') {
        e.preventDefault(); setCalcDisplay('0'); setCalcExpr(''); setCalcNewNum(true);
      } else if (key === 'Backspace') {
        e.preventDefault(); setCalcDisplay(d => d.length > 1 ? d.slice(0, -1) : '0');
      } else if (key === '%') {
        e.preventDefault(); setCalcDisplay(d => String(Number(d) / 100));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showCalc, calcTab, calcExpr, calcDisplay, calcNewNum]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentUser) return;
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      // Global Search: Ctrl+K / Cmd+K (works even in inputs)
      if (mod && e.key.toLowerCase() === 'k') { setShowGlobalSearch(true); e.preventDefault(); return; }

      // Shortcuts that work even in inputs
      if (e.key === 'Escape') { setShowShortcuts(false); setIsAlertsOpen(false); setShowGlobalSearch(false); return; }
      if (e.shiftKey && e.key === '?') { setShowShortcuts(s => !s); e.preventDefault(); return; }

      // Skip remaining shortcuts when user is typing in an input
      if (isInput) return;

      if (!mod) {
        // Non-modifier shortcuts
        if (e.key === 'n' || e.key === 'N') { navigateTo('Reservations', { showNewForm: true }); e.preventDefault(); return; }
        if (e.key === 'c' || e.key === 'C') { setShowCalc(s => !s); e.preventDefault(); return; }
        return;
      }

      // Ctrl/Cmd + key shortcuts
      switch (e.key.toLowerCase()) {
        case '1': navigateTo('Dashboard'); e.preventDefault(); break;
        case '2': navigateTo('Reservations'); e.preventDefault(); break;
        case '3': navigateTo('Hotels'); e.preventDefault(); break;
        case '4': navigateTo('Agents'); e.preventDefault(); break;
        case '5': navigateTo('Transactions'); e.preventDefault(); break;
        case 'k': setShowGlobalSearch(true); e.preventDefault(); break;
        case 'b': navigateTo('Reports'); e.preventDefault(); break;
        case 'j': navigateTo('Sales'); e.preventDefault(); break;
        case '.': setSidebarOpen(s => !s); e.preventDefault(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentUser]);

  const navItems = [
    { name: 'Dashboard', icon: '📊', group: 'Overview', key: 'dashboard', tip: 'Overview of bookings, revenue & occupancy' },
    { name: 'Calendar', icon: '🗓️', group: 'Overview', key: 'calendar', tip: 'Visual calendar of all reservations' },
    { name: 'Analytics', icon: '📉', group: 'Overview', key: 'analytics', tip: 'Performance charts & trends' },
        { name: 'Graphs', icon: '📊', group: 'Overview', key: 'graphs', tip: 'Cash flow, revenue & booking graphs' },
    { name: 'Reservations', icon: '📅', group: 'Operations', key: 'reservations', tip: 'Manage all bookings & reservations' },
    { name: 'Sales', icon: '🚀', group: 'Operations', key: 'sales', tip: 'Sales pipeline & tracking' },
    { name: 'Production', icon: '📈', group: 'Operations', key: 'production', tip: 'Room production & availability' },
    { name: 'Hotels', icon: '🏢', group: 'Operations', key: 'hotels', tip: 'Hotel properties & room types' },
    { name: 'Agents', icon: '👥', group: 'Operations', key: 'agents', tip: 'Clients, suppliers & salespersons' },
    { name: 'Guests', icon: '🧳', group: 'Operations', key: 'guests', tip: 'Guest directory & history' },
    { name: 'Allotments', icon: '📦', group: 'Operations', key: 'allotments', tip: 'Room allotments & block bookings' },
    { name: 'Other Services', icon: '🌐', group: 'Operations', key: 'otherServices', tip: 'Extra services & add-ons' },
    { name: 'Transactions', icon: '💰', group: 'Finance', key: 'transactions', tip: 'All financial transactions & payments' },
    { name: 'External Transfers', icon: '💸', group: 'Finance', key: 'externalTransfers', tip: 'External bank transfers & wires' },
    { name: 'Banks & Safes', icon: '🏦', group: 'Finance', key: 'banksSafes', tip: 'Bank accounts & safe boxes' },
    { name: 'Reports', icon: '📋', group: 'Finance', key: 'reports', tip: 'Generate financial & operational reports' },
    { name: 'Ledger', icon: '📒', group: 'Finance', key: 'ledger', tip: 'Financial ledger — source of truth for revenue & commissions' },
    { name: 'Expenses', icon: '📤', group: 'Finance', key: 'expenses', tip: 'Track & manage expenses' },
    { name: 'Payment Gateways', icon: '💳', group: 'Finance', key: 'paymentGateways', tip: 'Online payment gateway settings' },
    { name: 'Audit Log', icon: '🔍', group: 'Settings', key: 'auditLog', tip: 'System activity & change log' },
    { name: 'Users', icon: '🔑', group: 'Settings', key: 'users', tip: 'Manage user accounts & permissions' },
    { name: 'General Data', icon: '📝', group: 'Settings', key: 'generalData', tip: 'System settings & configuration' },
    { name: 'Client Portal', icon: '🚪', group: 'Settings', key: 'clientPortal', tip: 'Client-facing portal settings' },
  ];

  // Auth loading screen - prevents flash of login page during session verification
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-slate-600">Verifying session...</p>
        <p className="text-[10px] text-slate-400 mt-1">Zumra Hotels RMS</p>
      </div>
    );
  }

  if (!currentUser) {
    // Check for client portal URL
    const portalTokenParam = new URLSearchParams(window.location.search).get('portal');
    if (portalTokenParam) {
      // Look up client by secure portal token, not by ID
      const matchedAgent = agents.find(a => a.portalToken === portalTokenParam);
      const clientId = matchedAgent?.id || '';
      return <ClientPortal reservations={reservations} agents={agents} hotels={hotels} clientId={clientId} onUpdateAgreementStatus={matchedAgent ? handleUpdateAgreementStatus : undefined} />;
    }
    return <LoginPage users={users} onLoginSuccess={handleSetCurrentUser} onUpdateUser={doAddUser} />;
  }

  // Get permitted nav items based on user's specific role
  const permittedNavItems = navItems.filter((item) => {
    if (currentUser.role === 'Reservationist') {
      return ['Dashboard', 'Calendar', 'Reservations', 'Hotels', 'Agents', 'Guests', 'Allotments', 'Other Services', 'General Data', 'Expenses'].includes(item.name);
    }
    if (currentUser.role === 'Sales') {
      return ['Dashboard', 'Calendar', 'Reservations', 'Sales', 'Production', 'Hotels', 'Agents', 'Guests', 'Allotments', 'Other Services'].includes(item.name);
    }
    if (currentUser.role === 'Finance') {
      return ['Dashboard', 'Calendar', 'Analytics', 'Graphs', 'Reservations', 'Hotels', 'Agents', 'Transactions', 'External Transfers', 'Banks & Safes', 'Reports', 'Payment Gateways', 'Other Services', 'Expenses'].includes(item.name);
    }
    if (currentUser.role === 'ReservationsManager') {
      return ['Dashboard', 'Calendar', 'Graphs', 'Reservations', 'Hotels', 'Agents', 'Allotments', 'Other Services', 'Reports', 'General Data', 'Expenses'].includes(item.name);
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
  const isDarkSidebar = currentTheme.isDark;

  return (
    <div style={{ minHeight: '100dvh' }} className={`w-full font-sans flex flex-col print:bg-white print:min-h-0 select-none overflow-x-hidden ${currentTheme.mainBg}`}>
      
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

      {/* Mobile sidebar backdrop — tap to close */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Desktop hover-reveal strip — invisible zone on left edge that opens sidebar on hover */}
      {!sidebarOpen && (
        <div
          className="hidden md:block fixed top-0 left-0 w-4 h-full z-50"
          onMouseEnter={handleSidebarMouseEnter}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        ref={sidebarRef}
        style={{ height: '100dvh' }}
        className={`fixed z-[60] top-0 left-0 ${sidebarCollapsed ? 'w-[72px]' : 'w-56'} flex-shrink-0 ${currentTheme.sidebarBg} flex flex-col no-print border-r ${currentTheme.sidebarBorder} transition-[width,box-shadow] duration-300 ease-in-out shadow-2xl ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Sidebar Top Bar — minimal, no branding */}
        <div className={`flex items-center justify-between ${sidebarCollapsed ? 'px-2' : 'px-4'} py-2 border-b ${currentTheme.sidebarBorder} flex-shrink-0`}>
          {/* Collapse toggle (desktop only) */}
          <Tooltip label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden md:flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all duration-150 ${isDarkSidebar ? 'text-slate-500 hover:bg-white/[0.08] hover:text-slate-300' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
          >
            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          </Tooltip>
          {/* Close sidebar (mobile only — desktop uses mouse-leave) */}
          <button onClick={() => setSidebarOpen(false)} className={`md:hidden p-1.5 rounded-lg ${isDarkSidebar ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto no-scrollbar px-2 flex flex-col">
          {/* Categorized groups with subtle headers */}
          {Object.entries(navGroups).map(([group, items], groupIdx) => (
            <div key={group} className={groupIdx > 0 ? 'mt-4' : ''}>
              {!sidebarCollapsed && (
                <div className={`px-3 mb-2 flex items-center gap-2`}>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isDarkSidebar ? 'text-slate-600' : 'text-slate-400'}`}>{t(`nav.${group.toLowerCase()}` as TranslationKey)}</span>
                  <div className={`flex-1 h-px ${isDarkSidebar ? 'bg-white/[0.06]' : 'bg-slate-200'}`}></div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                {items.map((item) => {
                  const isActive = activeTab === item.name;
                  return (
                    <Tooltip key={item.name} label={item.tip} position="right">
                    <button
                      onClick={() => {
                        navigateTo(item.name);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center w-full ${sidebarCollapsed ? 'justify-center px-0' : 'gap-2 px-2'} py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 relative group ${
                        isActive
                          ? `${currentTheme.sidebarActive} font-bold`
                          : `${currentTheme.sidebarText} ${currentTheme.sidebarHover} ${isDarkSidebar ? 'hover:text-white' : 'hover:text-slate-900'}`
                      }`}
                    >
                      {isActive && <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full ${currentTheme.brandBg}`}></span>}
                      <span className="text-base w-6 text-center flex-shrink-0 leading-none">{item.icon}</span>
                      {!sidebarCollapsed && <span className="truncate">{t(`nav.${item.key}` as TranslationKey)}</span>}
                    </button>
                    </Tooltip>
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
              <Tooltip label="Sign out of your session" position="right">
              <button onClick={() => handleSetCurrentUser(null as any)} className={`p-2 rounded-lg transition-all text-xs ${isDarkSidebar ? 'bg-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400' : 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-500'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
              </Tooltip>
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
              <Tooltip label="Sign out of your session" position="top">
              <button
                onClick={() => handleSetCurrentUser(null as any)}
                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${isDarkSidebar ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
              </Tooltip>
            </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main style={{ minHeight: '100dvh' }} className={`flex-1 flex flex-col min-w-0 w-full ${currentTheme.mainBg}`}>
        
        {/* Top Header Bar */}
        <header className={`${currentTheme.headerBg} border-b ${currentTheme.headerBorder} min-h-14 flex items-center justify-between px-3 md:px-6 flex-shrink-0 no-print relative z-30`}>
          {/* Left: hamburger + page title */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 transition text-slate-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className={`text-[13px] md:text-[15px] font-bold ${currentTheme.headerText} flex items-center gap-2 truncate`}>
              {t(`nav.${permittedNavItems.find(n => n.name === activeTab)?.key || activeTab.toLowerCase()}` as TranslationKey, { tab: activeTab })}
            </h2>
          </div>

          {/* Center: Global Booking Search */}
          <div ref={globalSearchRef} className="relative hidden md:block mx-4 flex-1 max-w-xs">
            <div className="relative">
              <svg className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${currentTheme.headerIcon} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => { setGlobalSearchQuery(e.target.value); setGlobalSearchOpen(true); }}
                onFocus={() => globalSearchQuery.trim() && setGlobalSearchOpen(true)}
                placeholder="Search bookings..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border ${currentTheme.headerBorder} ${currentTheme.headerBg} ${currentTheme.headerText} placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition`}
              />
              {globalSearchQuery && (
                <button onClick={() => { setGlobalSearchQuery(''); setGlobalSearchOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {/* Search Results Dropdown */}
            {globalSearchOpen && globalSearchQuery.trim() && (
              <div className={`absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto`}>
                {searchResults.length > 0 ? (
                  searchResults.map(r => {
                    const hotel = hotels.find(h => h.id === r.hotelId);
                    const agent = agents.find(a => a.id === r.clientId);
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setGlobalSearchOpen(false);
                          setGlobalSearchQuery('');
                          setActiveTab('Reservations');
                          setTabKey(k => k + 1);
                          setActiveFilters({ viewReservationId: r.id });
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition flex items-center gap-3"
                      >
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate">RSV-{r.id} — {r.guestName}</div>
                          <div className="text-[10px] text-slate-500 truncate">{hotel?.name || 'N/A'} · {agent?.name || 'N/A'} · {r.checkIn} → {r.checkOut}</div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">No bookings found for "{globalSearchQuery}"</div>
                )}
              </div>
            )}
          </div>

          {/* Right: actions — responsive flex with wrap on mobile */}
          <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
            {/* Edit Approvals - visible for Admin/ReservationsManager */}
            {(currentUser.role === 'Admin' || currentUser.role === 'ReservationsManager') && (
              <button
                className={`relative p-2 ${currentTheme.headerHover} rounded-lg transition`}
                onClick={() => setShowEditApprovalModal(true)}
                title="Edit Approvals"
              >
                <svg className={`w-[18px] h-[18px] ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
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
                  ? `${syncStatus.pendingCount} pending sync(s) — click to retry, double-click to clear`
                  : syncStatus.online ? 'All data synced' : 'Offline - changes queued'
              }>
                {!syncStatus.online ? (
                  <button onClick={() => flushSyncQueue()} className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[9px] font-bold text-amber-700 hover:bg-amber-100 transition cursor-pointer animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    OFFLINE
                    {syncStatus.pendingCount > 0 && <span className="bg-amber-200 text-amber-800 px-1 rounded-full">{syncStatus.pendingCount}</span>}
                  </button>
                ) : syncStatus.pendingCount > 0 ? (
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => flushSyncQueue()} onDoubleClick={() => clearSyncQueue()} className="flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-200 rounded-lg text-[9px] font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer">
                      <span className={`w-1.5 h-1.5 rounded-full bg-orange-500 ${syncStatus.isSyncing ? 'animate-spin' : 'animate-pulse'}`}></span>
                      {syncStatus.isSyncing ? 'SYNCING' : 'PENDING'}
                      <span className="bg-orange-200 text-orange-800 px-1 rounded-full">{syncStatus.pendingCount}</span>
                    </button>
                    <button onClick={() => clearSyncQueue()} title="Clear stuck sync queue" className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1 px-1.5 py-1 text-[9px] font-bold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                )}
              </div>
            )}

            {/* Inbox */}
            <button
              className={`relative p-2 ${currentTheme.headerHover} rounded-lg transition`}
              onClick={() => setIsInboxOpen(true)}
              title="Messages"
            >
              <svg className={`w-[18px] h-[18px] ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
              {(() => {
                const unread = messages.filter((m: any) => m.receiverId === currentUser?.id && !m.read).length;
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
                className={`relative p-2 ${currentTheme.headerHover} rounded-lg transition`}
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                title="Notifications"
              >
                <svg className={`w-[18px] h-[18px] ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                {alertCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </button>
              
              {isAlertsOpen && (
                <div className="absolute right-0 pt-2 w-80 max-w-[calc(100vw-2rem)] z-[1000] animate-fade-in-up">
                  <div className={`${currentTheme.cardBg} rounded-xl shadow-xl border ${currentTheme.cardBorder} overflow-hidden`}>
                  <div className={`px-4 py-3 border-b ${currentTheme.cardBorder}`}>
                    <h3 className={`text-xs font-bold ${currentTheme.headerText} uppercase tracking-wider`}>Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto thin-scrollbar">
                    {alertCount > 0 ? (
                      <div className="flex flex-col">
                        {currentAlerts.map(alert => (
                          <div 
                            key={alert.id}
                            className={`p-3 text-xs ${currentTheme.headerHover} border-b ${currentTheme.cardBorder} cursor-pointer transition flex flex-col gap-0.5`}
                            onClick={() => {
                              navigateTo('Reservations', { viewReservationId: alert.resId });
                              setIsAlertsOpen(false);
                            }}
                          >
                            <span className="font-semibold text-amber-600">{alert.type}</span>
                            <span className={`${currentTheme.cardText} opacity-80`}>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-xs text-center opacity-50">
                        No new notifications
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className={`w-px h-6 ${isDarkSidebar ? 'bg-white/10' : 'bg-slate-200'} mx-1 hidden md:block`}></div>

            {/* Language toggle — hidden on very small screens */}
            <div className="hidden sm:block"><LangToggle /></div>

            {/* Theme switcher — hidden on mobile to save space */}
            <div className={`hidden sm:flex items-center ${currentTheme.inputBg} px-2 py-1 rounded-lg transition cursor-pointer`}>
              <select
                value={activeThemeId}
                onChange={(e) => handleSetTheme(e.target.value)}
                className={`bg-transparent ${currentTheme.inputText} font-semibold py-0 border-none text-[10px] focus:outline-none focus:ring-0 cursor-pointer appearance-none max-w-[100px]`}
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
                  className={`flex items-center gap-2 ${currentTheme.headerHover} rounded-lg transition p-1.5 cursor-pointer`}
                >
                  <div className={`w-8 h-8 rounded-full ${currentTheme.btnPrimary} flex items-center justify-center font-bold text-[10px] overflow-hidden`}>
                    {currentUser.profileImage ? (
                      <img src={currentUser.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      currentUser.name ? currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className={`text-[11px] font-semibold ${currentTheme.headerText} leading-none`}>{currentUser.name}</p>
                    <p className={`text-[9px] ${currentTheme.headerIcon} leading-tight mt-0.5`}>{currentUser.role}</p>
                  </div>
                  <svg className={`h-3 w-3 ${currentTheme.headerIcon} hidden md:block`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 pt-2 w-64 z-[1000] animate-fade-in-up">
                    <div className={`${currentTheme.cardBg} rounded-xl shadow-2xl border ${currentTheme.cardBorder} overflow-hidden`}>
                    <div className={`px-4 py-3 border-b ${currentTheme.cardBorder} flex items-center gap-3`}>
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
                        <p className={`text-xs font-bold ${currentTheme.headerText}`}>{currentUser.name}</p>
                        <p className={`text-[10px] ${currentTheme.headerIcon} mt-0.5`}>{currentUser.email}</p>
                        <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${currentTheme.badgeBg}`}>
                          {currentUser.role}
                        </span>
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setIsUserMenuOpen(false); navigateTo('Users'); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium ${currentTheme.cardText} ${currentTheme.headerHover} flex items-center gap-2.5 transition cursor-pointer`}
                      >
                        <svg className={`w-4 h-4 ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                        {t('users.myProfile')}
                      </button>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); navigateTo('Users'); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium ${currentTheme.cardText} ${currentTheme.headerHover} flex items-center gap-2.5 transition cursor-pointer`}
                      >
                        <svg className={`w-4 h-4 ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                        {t('users.changePassword')}
                      </button>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); navigateTo('Users'); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium ${currentTheme.cardText} ${currentTheme.headerHover} flex items-center gap-2.5 transition cursor-pointer`}
                      >
                        <svg className={`w-4 h-4 ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {t('users.userSettings')}
                      </button>
                      <button
                        onClick={async () => { setIsUserMenuOpen(false); const { downloadBackup } = await import('./lib/dataBackup'); downloadBackup(); toast.success('Backup downloaded successfully'); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium ${currentTheme.cardText} ${currentTheme.headerHover} flex items-center gap-2.5 transition cursor-pointer`}
                      >
                        <svg className={`w-4 h-4 ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        Download Data Backup
                      </button>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); navigateTo('Dashboard'); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium ${currentTheme.cardText} ${currentTheme.headerHover} flex items-center gap-2.5 transition cursor-pointer`}
                      >
                        <svg className={`w-4 h-4 ${currentTheme.headerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                        Dashboard
                      </button>
                      <div className={`border-t ${currentTheme.cardBorder} my-1`}></div>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); handleSetCurrentUser(null as any); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                        {t('nav.signOut')}
                      </button>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable central content area */}
        <div ref={contentAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 md:p-6 print:p-0 print:m-0 page-enter page-container" key={tabKey}>
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

          <Suspense fallback={<PageLoader />}>
            {renderActivePage()}
          </Suspense>
        </div>

        {/* Status Bar */}
        <footer className={`${currentTheme.footerBg} border-t ${currentTheme.footerBorder} h-8 px-6 flex items-center justify-between text-[10px] font-medium flex-shrink-0 no-print select-none ${currentTheme.isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`}></span>
              {syncStatus.online ? <FooterLabel field="systemLive" /> : <span className="text-rose-400">Reconnecting...</span>}
            </span>
            {syncStatus.pendingCount > 0 && (
              <span className="text-amber-400">· {syncStatus.pendingCount} pending</span>
            )}
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
          messages={messages}
          onSaveMessages={handleSaveMessages}
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

      {/* Global Search Modal (Ctrl+K) */}
      {showGlobalSearch && (
        <GlobalSearchModal
          reservations={reservations}
          agents={agents}
          hotels={hotels}
          onClose={() => setShowGlobalSearch(false)}
          onNavigate={navigateTo}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">⌨️ Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Ctrl + K', 'Global Search'],
                  ['N', 'New Reservation'],
                  ['Shift + ?', 'Show shortcuts'],
                  ['Esc', 'Close modals'],
                  ['Ctrl + 1', 'Dashboard'],
                  ['Ctrl + 2', 'Reservations'],
                  ['Ctrl + 3', 'Hotels'],
                  ['Ctrl + 4', 'Agents'],
                  ['Ctrl + 5', 'Transactions'],
                  ['Ctrl + B', 'Reports'],
                  ['Ctrl + J', 'Sales'],
                  ['Ctrl + .', 'Toggle sidebar'],
                ].map(([key, desc]) => (
                  <React.Fragment key={key}>
                    <kbd className="px-2 py-1 bg-gray-100 border rounded text-xs font-mono text-gray-700 text-right">{key}</kbd>
                    <span className="text-gray-600 flex items-center">{desc}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
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

      {/* API Warning Banner - non-intrusive alerts when external services are down */}
      <ApiWarningBanner />

      {/* Quick Revenue Calculator Widget */}
      {!showCalc && (
        <button
          onClick={() => setShowCalc(true)}
          className="fixed bottom-4 right-4 z-40 bg-slate-800 hover:bg-slate-700 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-sm font-bold transition hover:scale-110"
          title="Quick Calculator (C)"
        >
          🧮
        </button>
      )}
      {showCalc && (
        <div className="fixed bottom-4 right-4 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 w-72 animate-in slide-in-from-bottom-4">
          <div className="bg-slate-800 text-white px-4 py-2.5 rounded-t-2xl flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">🧮 Quick Calculator</span>
            <button onClick={() => setShowCalc(false)} className="text-slate-400 hover:text-white text-sm transition">&times;</button>
          </div>
          {/* Tab Toggle: Markup / Calculator */}
          <div className="flex border-b border-slate-200">
            <button onClick={() => setCalcTab('markup')} className={`flex-1 py-2 text-[10px] font-bold transition ${calcTab === 'markup' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>💰 Markup</button>
            <button onClick={() => setCalcTab('calc')} className={`flex-1 py-2 text-[10px] font-bold transition ${calcTab === 'calc' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>🔢 Calculator</button>
          </div>
          <div className="p-4">
            {calcTab === 'markup' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-red-500 block mb-1">Buy Rate (SAR)</label>
                  <input type="number" value={calcBuy || ''} onChange={e => setCalcBuy(Number(e.target.value))} className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm font-mono font-bold text-red-700 bg-red-50/30" placeholder="0" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-emerald-600 block mb-1">Sell Rate (SAR)</label>
                  <input type="number" value={calcSell || ''} onChange={e => setCalcSell(Number(e.target.value))} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm font-mono font-bold text-emerald-700 bg-emerald-50/30" placeholder="0" />
                </div>
                {/* Results */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Profit</span>
                    <span className="text-sm font-black font-mono text-emerald-600">{calcBuy > 0 && calcSell > 0 ? (calcSell - calcBuy).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} <span className="text-[10px]">SAR</span></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Markup %</span>
                    <span className="text-sm font-black font-mono text-indigo-600">{calcBuy > 0 && calcSell > 0 ? ((calcSell - calcBuy) / calcBuy * 100).toFixed(2) : '0'}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Margin %</span>
                    <span className="text-sm font-black font-mono text-amber-600">{calcSell > 0 && calcBuy > 0 ? ((calcSell - calcBuy) / calcSell * 100).toFixed(2) : '0'}%</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Real Calculator */
              <div className="space-y-2">
                <div className="bg-slate-900 rounded-xl p-3 text-right min-h-[56px] flex flex-col justify-end relative">
                  {calcExpr && <div className="text-[10px] text-slate-400 font-mono truncate">{calcExpr}</div>}
                  <div className="text-2xl font-black text-white font-mono truncate">{calcDisplay}</div>
                  <div className="absolute top-1 left-2 text-[7px] text-slate-600 font-medium">⌨️ keyboard enabled</div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','⌫','='].map(btn => {
                    const isOp = ['÷','×','−','+','='].includes(btn);
                    const isFunc = ['C','±','%','⌫'].includes(btn);
                    return (
                      <button
                        key={btn}
                        onClick={() => {
                          if (btn === 'C') { setCalcDisplay('0'); setCalcExpr(''); setCalcNewNum(true); }
                          else if (btn === '⌫') { setCalcDisplay(d => d.length > 1 ? d.slice(0, -1) : '0'); }
                          else if (btn === '±') { setCalcDisplay(d => d.startsWith('-') ? d.slice(1) : d === '0' ? '0' : '-' + d); }
                          else if (btn === '%') { setCalcDisplay(d => String(Number(d) / 100)); }
                          else if (isOp) {
                            const opMap: Record<string, string> = { '÷': '/', '×': '*', '−': '-', '+': '+', '=': '' };
                            if (btn === '=') {
                              try {
                                const fullExpr = calcExpr + calcDisplay;
                                const evalExpr = fullExpr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
                                const result = Function('"use strict"; return (' + evalExpr + ')')();
                                setCalcExpr(fullExpr + ' =');
                                setCalcDisplay(String(Number.isFinite(result) ? parseFloat(Number(result).toFixed(8)) : 'Error'));
                                setCalcNewNum(true);
                              } catch { setCalcDisplay('Error'); setCalcNewNum(true); }
                            } else {
                              setCalcExpr(calcExpr + calcDisplay + ' ' + btn + ' ');
                              setCalcNewNum(true);
                            }
                          }
                          else {
                            if (calcNewNum) { setCalcDisplay(btn === '.' ? '0.' : btn); setCalcNewNum(false); }
                            else { setCalcDisplay(d => d === '0' && btn !== '.' ? btn : d + btn); }
                          }
                        }}
                        className={`py-2.5 rounded-lg text-sm font-bold transition active:scale-95 ${
                          btn === '=' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' :
                          btn === '0' ? 'col-span-1 bg-slate-100 hover:bg-slate-200 text-slate-800' :
                          isOp ? 'bg-amber-100 hover:bg-amber-200 text-amber-700' :
                          isFunc ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' :
                          'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        {btn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
