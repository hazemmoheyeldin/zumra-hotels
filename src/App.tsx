/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { ZumraDB, ZumraSync } from './lib/storage';
import { Hotel, Agent, Allotment, Reservation, Account, Transaction, User, FollowUp, ExternalTransfer, RefundAlert } from './types';
import { getEgyptTime, getReservationTotals, loadFromFirestore } from './lib/storage';
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
import InvoicePDF from './components/InvoicePDF';
import ErrorBoundary from './components/ErrorBoundary';
import ConfirmDialog from './components/ConfirmDialog';
import { ToastContainer, useToast } from './components/Toast';

const THEMES = [
  {
    id: 'corporate',
    name: 'Corporate Executive',
    emoji: '🏢',
    sidebarBg: 'bg-slate-800',
    sidebarBorder: 'border-slate-700',
    sidebarHover: 'hover:bg-slate-700/50',
    sidebarActive: 'bg-blue-700 text-white border-l-4 border-blue-300 shadow-md shadow-slate-900/40',
    sidebarBgSecondary: 'bg-slate-900',
    sidebarText: 'text-slate-100',
    brandBg: 'bg-blue-600',
    brandText: 'text-blue-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    badgeBg: 'bg-blue-100 text-blue-800',
    footerText: 'text-slate-700',
    topBarGradient: 'from-blue-600 via-slate-600 to-slate-800',
  },
  {
    id: 'emerald',
    name: 'Classic Emerald',
    emoji: '🌴',
    sidebarBg: 'bg-emerald-900',
    sidebarBorder: 'border-emerald-800',
    sidebarHover: 'hover:bg-emerald-800/60',
    sidebarActive: 'bg-emerald-800 text-white border-l-4 border-amber-400 shadow-md shadow-emerald-950/30',
    sidebarBgSecondary: 'bg-emerald-950/60',
    sidebarText: 'text-emerald-100',
    brandBg: 'bg-amber-400',
    brandText: 'text-amber-400',
    brandLetterColor: 'text-emerald-900',
    btnPrimary: 'bg-amber-400 hover:bg-amber-500 text-emerald-950',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    footerText: 'text-emerald-800',
    topBarGradient: 'from-amber-400 via-emerald-600 to-emerald-950',
  },
  {
    id: 'midnight',
    name: 'Cosmic Midnight',
    emoji: '🌌',
    sidebarBg: 'bg-slate-900',
    sidebarBorder: 'border-slate-800',
    sidebarHover: 'hover:bg-slate-800/60',
    sidebarActive: 'bg-indigo-950 text-white border-l-4 border-indigo-400 shadow-md shadow-slate-950/30',
    sidebarBgSecondary: 'bg-slate-950/60',
    sidebarText: 'text-slate-100',
    brandBg: 'bg-indigo-500',
    brandText: 'text-indigo-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    badgeBg: 'bg-indigo-100 text-indigo-800',
    footerText: 'text-indigo-950',
    topBarGradient: 'from-indigo-400 via-purple-600 to-slate-900',
  },
  {
    id: 'velvet',
    name: 'Royal Purple',
    emoji: '🔮',
    sidebarBg: 'bg-indigo-950',
    sidebarBorder: 'border-indigo-900',
    sidebarHover: 'hover:bg-indigo-900/60',
    sidebarActive: 'bg-purple-900 text-white border-l-4 border-pink-400 shadow-md shadow-indigo-950/30',
    sidebarBgSecondary: 'bg-slate-950/65',
    sidebarText: 'text-indigo-100',
    brandBg: 'bg-pink-500',
    brandText: 'text-pink-400',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-pink-500 hover:bg-pink-600 text-white',
    badgeBg: 'bg-pink-100 text-pink-800',
    footerText: 'text-purple-800',
    topBarGradient: 'from-pink-400 via-indigo-650 to-purple-950',
  },
  {
    id: 'desert',
    name: 'Desert Dunes',
    emoji: '🐪',
    sidebarBg: 'bg-amber-955',
    sidebarBorder: 'border-amber-900/80',
    sidebarHover: 'hover:bg-amber-900/60',
    sidebarActive: 'bg-amber-900 text-white border-l-4 border-yellow-400 shadow-md shadow-amber-950/30',
    sidebarBgSecondary: 'bg-yellow-950/65',
    sidebarText: 'text-amber-100',
    brandBg: 'bg-yellow-500',
    brandText: 'text-yellow-400',
    brandLetterColor: 'text-amber-950',
    btnPrimary: 'bg-yellow-500 hover:bg-yellow-600 text-amber-950',
    badgeBg: 'bg-amber-100 text-amber-900',
    footerText: 'text-amber-900',
    topBarGradient: 'from-yellow-400 via-amber-600 to-yellow-950',
  },
  {
    id: 'forest',
    name: 'Forest Glass',
    emoji: '🌲',
    sidebarBg: 'bg-emerald-950/80 backdrop-blur-md',
    sidebarBorder: 'border-emerald-800/50',
    sidebarHover: 'hover:bg-emerald-900/60',
    sidebarActive: 'bg-emerald-800/60 text-emerald-50 border-l-4 border-emerald-400 shadow-md shadow-emerald-950/30',
    sidebarBgSecondary: 'bg-emerald-950/40',
    sidebarText: 'text-emerald-100',
    brandBg: 'bg-emerald-500/80',
    brandText: 'text-emerald-300',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-emerald-600/90 hover:bg-emerald-500 text-white backdrop-blur-sm',
    badgeBg: 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50',
    footerText: 'text-emerald-900',
    topBarGradient: 'from-emerald-400/80 via-emerald-600/80 to-emerald-950/80',
  },
  {
    id: 'liquid-navy',
    name: 'Liquid Navy Glass',
    emoji: '🌊',
    mainBg: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 min-h-screen text-indigo-50 font-sans flex flex-col md:flex-row print:bg-white print:min-h-0 select-none',
    sidebarBg: 'bg-slate-900/40 backdrop-blur-xl border-r border-white/10',
    sidebarBorder: 'border-white/10',
    sidebarHover: 'hover:bg-indigo-900/50',
    sidebarActive: 'bg-indigo-900/40 text-cyan-50 border-l-4 border-cyan-400 shadow-[0_4px_15px_rgba(34,211,238,0.2)]',
    sidebarBgSecondary: 'bg-transparent',
    sidebarText: 'text-slate-100',
    brandBg: 'bg-cyan-500/80 backdrop-blur-md',
    brandText: 'text-cyan-300',
    brandLetterColor: 'text-white',
    btnPrimary: 'bg-blue-600/90 hover:bg-cyan-600 text-white backdrop-blur-md shadow-lg shadow-cyan-500/20 border border-cyan-400/30',
    badgeBg: 'bg-blue-900/50 text-cyan-300 border border-blue-700/50',
    footerText: 'text-slate-300',
    topBarGradient: 'from-cyan-400/80 via-blue-600/80 to-slate-900/80',
  },
  {
    id: 'charcoal',
    name: 'Obsidian Onyx',
    emoji: '🖤',
    sidebarBg: 'bg-neutral-900',
    sidebarBorder: 'border-neutral-800',
    sidebarHover: 'hover:bg-neutral-800/60',
    sidebarActive: 'bg-neutral-800 text-white border-l-4 border-emerald-400 shadow-md shadow-neutral-950/30',
    sidebarBgSecondary: 'bg-zinc-950/60',
    sidebarText: 'text-neutral-100',
    brandBg: 'bg-emerald-500',
    brandText: 'text-emerald-400',
    brandLetterColor: 'text-neutral-905',
    btnPrimary: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    badgeBg: 'bg-neutral-200 text-neutral-800',
    footerText: 'text-neutral-800',
    topBarGradient: 'from-emerald-400 via-zinc-600 to-neutral-950',
  }
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
  // Start as null to always require login
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Theme states
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    return localStorage.getItem('zumra_theme') || 'liquid-navy';
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
    setUsers(ZumraDB.getUsers());
    setFollowUps(ZumraDB.getFollowUps());
    // Do NOT auto-login - always show login screen

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
          ];

          for (const col of collections) {
            const firestoreData = await firestoreLoadAll(col.name);
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
      const unsubs = [
        firestoreSubscribe<Hotel>(COLLECTIONS.HOTELS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_hotels', JSON.stringify(data));
            setHotels(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Agent>(COLLECTIONS.AGENTS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_agents', JSON.stringify(data));
            setAgents(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Allotment>(COLLECTIONS.ALLOTMENTS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_allotments', JSON.stringify(data));
            setAllotments(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Reservation>(COLLECTIONS.RESERVATIONS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_reservations', JSON.stringify(data));
            setReservations(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Account>(COLLECTIONS.ACCOUNTS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_accounts', JSON.stringify(data));
            setAccounts(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<Transaction>(COLLECTIONS.TRANSACTIONS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_transactions', JSON.stringify(data));
            setTransactions(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<ExternalTransfer>(COLLECTIONS.EXTERNAL_TRANSFERS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_external_transfers', JSON.stringify(data));
            setExternalTransfers(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<User>(COLLECTIONS.USERS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_users', JSON.stringify(data));
            setUsers(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
        firestoreSubscribe<FollowUp>(COLLECTIONS.FOLLOW_UPS, (data) => {
          if (data.length > 0) {
            localStorage.setItem('zumra_follow_ups', JSON.stringify(data));
            setFollowUps(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
          }
        }),
      ];

      // Also listen for cross-tab localStorage changes (for theme etc.)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'zumra_theme') {
          setActiveThemeId(e.newValue || 'liquid-navy');
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

  // Sync savers (internal — called after confirmation)
  const doSaveHotel = (h: Hotel) => {
    const updated = hotels.map(item => item.id === h.id ? h : item);
    if (!hotels.some(item => item.id === h.id)) updated.push(h);
    setHotels(updated);
    ZumraDB.saveHotels(updated);
    ZumraSync.saveHotel(h);
    toast.success(`Hotel "${h.name}" saved successfully`);
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
            docNo: `CRED-C-${res.id}`,
            date: now.split('T')[0],
            type: 'CreditApplied',
            amount: clientPaid,
            agentId: res.clientId,
            reservationId: res.id.toString(),
            description: `Credit from cancellation of RSV-${res.id} (${res.guestName})`,
            paymentMethod: 'Bank Transfer',
            voucherNo: `CRED-${Date.now()}`,
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
            docNo: `CRED-S-${res.id}`,
            date: now.split('T')[0],
            type: 'CreditApplied',
            amount: supplierPaid,
            agentId: res.supplierId,
            reservationId: res.id.toString(),
            description: `Credit from cancellation of RSV-${res.id} (${res.guestName})`,
            paymentMethod: 'Bank Transfer',
            voucherNo: `CRED-${Date.now() + 1}`,
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
      voucherNo: `XFER-${Date.now()}`,
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
    const existing = users.find(u => u.id === user.id);
    let updated;
    if (existing) {
      updated = users.map(u => u.id === user.id ? user : u);
    } else {
      updated = [...users, user];
    }
    setUsers(updated);
    ZumraDB.saveUsers(updated);
    ZumraSync.saveUser(user);
    toast.success(`User "${user.name}" saved`);
  };
  const handleAddUser = (user: User) => {
    showConfirm('Save User', `Save user "${user.name}" (${user.role})?`, () => doAddUser(user));
  };

  const doDeleteUser = (userId: string) => {
    const u = users.find(i => i.id === userId);
    const updated = users.filter(u => u.id !== userId);
    setUsers(updated);
    ZumraDB.saveUsers(updated);
    ZumraSync.deleteUser(userId);
    toast.success(`User "${u?.name || userId}" deleted`);
  };
  const handleDeleteUser = (userId: string) => {
    const u = users.find(i => i.id === userId);
    showConfirm('Delete User', `Are you sure you want to delete user "${u?.name || userId}"? This cannot be undone.`, () => doDeleteUser(userId), 'destructive');
  };

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
    ZumraDB.setCurrentUser(user);
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
          />
          </ErrorBoundary>
        );
      default:
        return <div>Pane Not Found.</div>;
    }
  };

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

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
    { name: 'Transactions', icon: '💰', group: 'Finance', key: 'transactions' },
    { name: 'External Transfers', icon: '💸', group: 'Finance', key: 'externalTransfers' },
    { name: 'Banks & Safes', icon: '🏦', group: 'Finance', key: 'banksSafes' },
    { name: 'Reports', icon: '📋', group: 'Finance', key: 'reports' },
    { name: 'Users', icon: '🔑', group: 'Settings', key: 'users' },
  ];

  if (!currentUser) {
    return <LoginPage users={users} onLoginSuccess={handleSetCurrentUser} />;
  }

  // Get permitted nav items based on user's specific role
  const permittedNavItems = navItems.filter((item) => {
    if (currentUser.role === 'Reservationist' || currentUser.role === 'Sales') {
      return ['Dashboard', 'Calendar', 'Reservations', 'Sales', 'Production', 'Hotels', 'Agents', 'Allotments'].includes(item.name);
    }
    if (currentUser.role === 'Finance') {
      return ['Dashboard', 'Calendar', 'Analytics', 'Reservations', 'Hotels', 'Agents', 'Transactions', 'External Transfers', 'Banks & Safes', 'Reports'].includes(item.name);
    }
    return true; // Admin gets everything
  });

  // Group nav items by group
  const navGroups: { [group: string]: typeof navItems } = {};
  permittedNavItems.forEach(item => {
    if (!navGroups[item.group]) navGroups[item.group] = [];
    navGroups[item.group].push(item);
  });

  return (
    <div className={currentTheme.mainBg || 'bg-slate-50 min-h-screen font-sans flex flex-col md:flex-row print:bg-white print:min-h-0 select-none text-slate-800'}>
      
      {/* Decorative top vibrant bar for print space */}
      <div className={`h-1 bg-gradient-to-r ${currentTheme.topBarGradient} w-full no-print absolute top-0 left-0 right-0 md:hidden`}></div>

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

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed md:static z-50 md:z-auto h-screen md:h-auto top-0 left-0 ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'} w-64 flex-shrink-0 ${currentTheme.sidebarBg} text-white flex flex-col no-print border-b md:border-b-0 md:border-r ${currentTheme.sidebarBorder} transform transition-all duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className={`p-5 flex flex-row md:flex-col items-center justify-between md:justify-center border-b ${currentTheme.sidebarBorder} gap-3`}>
          <div className="flex items-center gap-3 md:flex-col">
            <div className={`flex items-center justify-center transition-transform hover:scale-105 bg-white p-2 rounded-xl`}>
              <ZumraLogo size="md" variant="dark" />
            </div>
            <div className="text-left md:text-center mt-1">
              <p className={`text-[11px] md:text-[12px] text-cyan-400 font-extrabold tracking-widest leading-none`}>RMS</p>
            </div>
          </div>

          {/* Current worker label display (shown in header row on mobile, bottom of sidebar on desktop) */}
          {currentUser && (
            <div className={`hidden md:flex items-center gap-2 ${currentTheme.sidebarBgSecondary} p-2 rounded-xl border ${currentTheme.sidebarBorder} mt-1 w-full ${sidebarCollapsed ? 'md:hidden' : ''}`}>

              <span className="text-xs">👤</span>
              <div className="min-w-0">
                <span className={`text-[9px] ${currentTheme.brandText} block leading-none`}>Operator ({currentUser.role}):</span>
                <span className="text-xs font-bold font-mono tracking-wider text-amber-250 uppercase truncate block">{currentUser.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 overflow-y-auto no-scrollbar space-y-4 px-3 flex flex-col gap-0 overflow-x-auto">
          {Object.entries(navGroups).map(([group, items]) => (
            <div key={group}>
              <div className={`px-3 mb-1.5 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
                <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-400/70">{t(`nav.${group.toLowerCase()}` as TranslationKey)}</span>
              </div>
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
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 whitespace-nowrap md:w-full relative group ${
                        isActive
                          ? `${currentTheme.sidebarActive}`
                          : `${currentTheme.sidebarText} ${currentTheme.sidebarHover} hover:text-white`
                      }`}
                    >
                      <span className="text-sm md:text-base w-5 text-center flex-shrink-0">{item.icon}</span>
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
            className="flex md:hidden items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 text-rose-300 hover:bg-rose-950/30"
          >
            <span>🚪</span>
            <span>{t('nav.exitPortal')}</span>
          </button>
          {/* Desktop collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 text-slate-400 hover:bg-white/10 hover:text-white mt-1"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-base">{sidebarCollapsed ? '▶' : '◀'}</span>
            <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>{sidebarCollapsed ? '' : 'Collapse'}</span>
          </button>
        </nav>

        {/* Sidebar Footer Worker */}
        {currentUser && (
          <div className={`p-4 ${currentTheme.sidebarBgSecondary} border-t ${currentTheme.sidebarBorder} ${sidebarCollapsed ? 'hidden md:flex md:justify-center md:items-center' : 'hidden md:block'}`}>
            {sidebarCollapsed ? (
              <button onClick={() => handleSetCurrentUser(null as any)} title="Sign Out" className="bg-black/20 hover:bg-rose-900 p-2 rounded-lg transition-all text-xs border border-white/10">
                🚪
              </button>
            ) : (
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className={`w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center font-bold text-xs ${currentTheme.brandText} border ${currentTheme.sidebarBorder} flex-shrink-0`}>
                  {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'OP'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-extrabold text-white truncate leading-tight">{currentUser.name}</p>
                  <p className={`text-[8px] ${currentTheme.brandText} tracking-wider truncate uppercase font-mono`}>{currentUser.role} Node</p>
                </div>
              </div>
              <button
                onClick={() => handleSetCurrentUser(null as any)}
                title="Secure Exit / Access Switch"
                className={`bg-black/20 hover:bg-rose-900 ${currentTheme.brandText} hover:text-rose-200 p-1.5 rounded-lg transition-all text-xs border ${currentTheme.sidebarBorder} flex-shrink-0`}
              >
                🚪
              </button>
            </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen md:min-h-0 bg-slate-50">
        
        {/* Top Header Row */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 flex-shrink-0 shadow-sm no-print">
          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition text-slate-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <h2 className="text-sm md:text-base font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              {t(`nav.${permittedNavItems.find(n => n.name === activeTab)?.key || activeTab.toLowerCase()}` as TranslationKey, { tab: activeTab })}
            </h2>
            <span className={`hidden sm:inline-block text-[9px] ${currentTheme.badgeBg} font-extrabold px-3 py-0.5 rounded-full uppercase tracking-tight`}>
              {t('dash.egyptTime')}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Inbox Icon for Mail/Messages */}
            <div 
              className="relative p-2 cursor-pointer group hover:bg-slate-100 rounded-full transition"
              onClick={() => setIsInboxOpen(true)}
            >
              <span className="text-lg text-slate-600">✉️</span>
              {(() => {
                const unreadMessages = ZumraDB.getMessages().filter((m: any) => m.receiverId === currentUser?.id && !m.read).length;
                if (unreadMessages > 0) {
                  return (
                    <span className="absolute top-1 right-1 bg-indigo-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  );
                }
                return null;
              })()}
            </div>

            {/* Bell Icon for Alerts */}
            <div className="relative" onMouseLeave={() => setIsAlertsOpen(false)}>
              <div 
                className="relative p-2 cursor-pointer group hover:bg-slate-100 rounded-full transition"
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              >
                <span className="text-lg text-slate-600">🔔</span>
                {alertCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white animate-pulse">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </div>
              
              {isAlertsOpen && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-[1000] overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {alertCount > 0 ? (
                      <div className="flex flex-col">
                        {currentAlerts.map(alert => (
                          <div 
                            key={alert.id}
                            className="p-3 text-xs font-medium text-slate-700 hover:bg-slate-100 border-b border-slate-100 cursor-pointer transition flex flex-col gap-0.5"
                            onClick={() => {
                              setActiveFilters({ viewReservationId: alert.resId });
                              setActiveTab('Reservations');
                              setIsAlertsOpen(false);
                            }}
                          >
                            <span className="font-bold text-amber-600">{alert.type}</span>
                            <span>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-xs text-slate-400 text-center italic">
                        No new notifications right now.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Icon & Dropdown Menu */}
            {currentUser && (
              <div className="relative" onMouseLeave={() => setIsUserMenuOpen(false)}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 hover:bg-slate-100 rounded-full transition p-1.5 cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-full ${currentTheme.btnPrimary} flex items-center justify-center font-bold text-xs text-white shadow-sm`}>
                    {currentUser.name ? currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-[10px] font-bold text-slate-800 leading-none">{currentUser.name}</p>
                    <p className="text-[9px] text-slate-500 leading-tight">{currentUser.role}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-[1000] overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-800">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-500">{currentUser.email}</p>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${currentTheme.badgeBg}`}>
                        {currentUser.role}
                      </span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('Users');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span>👤</span> {t('users.myProfile')}
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          const newPassword = prompt('Enter new password (min 6 chars):');
                          if (newPassword && newPassword.length >= 6) {
                            handleAddUser({ ...currentUser, password: newPassword });
                            toast.success('Password updated successfully.');
                          } else if (newPassword) {
                            toast.error('Password too short.');
                          }
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span>🔑</span> {t('users.changePassword')}
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('Users');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span>⚙️</span> {t('users.userSettings')}
                      </button>
                      <div className="border-t border-slate-100 my-1"></div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleSetCurrentUser(null as any);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span>🚪</span> {t('nav.signOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Language toggle */}
            <LangToggle />

            {/* Theme switcher (compact) */}
            <div className="flex items-center gap-0.5 bg-slate-100 hover:bg-slate-200/80 px-1.5 py-0.5 rounded-lg transition">
              <select
                value={activeThemeId}
                onChange={(e) => handleSetTheme(e.target.value)}
                className="bg-transparent text-slate-800 font-extrabold py-0.5 border-none text-[10px] focus:outline-none focus:ring-0 cursor-pointer max-w-[90px]"
                title="Change Theme"
              >
                {THEMES.map(t => (
                  <option key={t.id} value={t.id} className="font-sans text-xs">
                    {t.emoji} {t.name}
                  </option>
                ))}
              </select>
            </div>
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
                            docNo: `REF-${rf.party}-${rf.bookingId}`,
                            date: now.split('T')[0],
                            type: 'RefundProcessed',
                            amount: rf.amount,
                            agentId: rf.partyId,
                            reservationId: rf.bookingId.toString(),
                            description: `Refund processed for ${a?.name || rf.partyId} (RSV-${rf.bookingId})`,
                            paymentMethod: 'Bank Transfer',
                            voucherNo: `REF-${Date.now()}`,
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

        {/* Dynamic bottom status bar */}
        <footer className={`${currentTheme.mainBg ? 'bg-transparent border-t border-white/10' : 'bg-white border-t border-slate-200'} h-8 px-6 flex items-center justify-between text-[10px] text-zinc-400 font-medium flex-shrink-0 no-print select-none`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <FooterLabel field="systemLive" />
            </span>
            <span className="hidden sm:inline"><FooterLabel field="activeNodes" /></span>
          </div>
          <div className={`flex items-center gap-2 ${currentTheme.footerText} font-extrabold`}>
            <span><FooterLabel field="copyright" /></span>
          </div>
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
      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-lg transition text-[10px] font-extrabold text-slate-700"
      title={lang === 'en' ? 'Switch to Arabic' : 'التبديل للإنجليزية'}
    >
      <span>🌐</span>
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
