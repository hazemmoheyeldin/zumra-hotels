/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { ZumraDB } from './lib/storage';
import { Hotel, Agent, Allotment, Reservation, Account, Transaction, User, FollowUp, ExternalTransfer } from './types';
import { getEgyptTime, getReservationTotals } from './lib/storage';
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
import ZumraLogo from './components/ZumraLogo';
import LoginPage from './components/LoginPage';
import InboxModal from './components/InboxModal';

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
    });
    return alerts;
  };
  
  const currentAlerts = getAlerts();
  const alertCount = currentAlerts.length;

  // Initial DB loading and automatic real-time background synchronization!
  useEffect(() => {
    // Initial fetch in background
    setHotels(ZumraDB.getHotels());
    setAgents(ZumraDB.getAgents());
    setAllotments(ZumraDB.getAllotments());
    setReservations(ZumraDB.getReservations());
    setAccounts(ZumraDB.getAccounts());
    setTransactions(ZumraDB.getTransactions());
    setExternalTransfers(ZumraDB.getExternalTransfers());
    setUsers(ZumraDB.getUsers());
    setCurrentUser(ZumraDB.getCurrentUser());
    setFollowUps(ZumraDB.getFollowUps());

    // Helper to safely fetch and sync state if changed structurally
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
        setCurrentUser(prev => {
          const fresh = ZumraDB.getCurrentUser();
          return JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev;
        });
        setActiveThemeId(prev => {
          const fresh = localStorage.getItem('zumra_theme') || 'liquid-navy';
          return fresh !== prev ? fresh : prev;
        });
      } catch (err) {
        console.warn('Silent back storage synchronization error:', err);
      }
    };

    // Listen to changes from other tabs immediately
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('zumra_')) {
        runSync();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Dynamic background poller every 1500ms to auto-sync silently in background
    const interval = setInterval(runSync, 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Sync savers
  const handleSaveHotel = (h: Hotel) => {
    const updated = hotels.map(item => item.id === h.id ? h : item);
    if (!hotels.some(item => item.id === h.id)) updated.push(h);
    setHotels(updated);
    ZumraDB.saveHotels(updated);
  };

  const handleDeleteHotel = (id: string) => {
    const updated = hotels.filter(item => item.id !== id);
    setHotels(updated);
    ZumraDB.saveHotels(updated);
  };

  const handleSaveAgent = (a: Agent) => {
    const updated = agents.map(item => item.id === a.id ? a : item);
    if (!agents.some(item => item.id === a.id)) updated.push(a);
    setAgents(updated);
    ZumraDB.saveAgents(updated);
  };

  const handleDeleteAgent = (id: string) => {
    const updated = agents.filter(item => item.id !== id);
    setAgents(updated);
    ZumraDB.saveAgents(updated);
  };

  const handleSaveAllotment = (al: Allotment) => {
    const updated = allotments.map(item => item.id === al.id ? al : item);
    if (!allotments.some(item => item.id === al.id)) updated.push(al);
    setAllotments(updated);
    ZumraDB.saveAllotments(updated);
  };

  const handleDeleteAllotment = (id: string) => {
    const updated = allotments.filter(item => item.id !== id);
    setAllotments(updated);
    ZumraDB.saveAllotments(updated);
  };

  const handleSaveReservation = (res: Reservation) => {
    const updated = reservations.map(item => item.id === res.id ? res : item);
    if (!reservations.some(item => item.id === res.id)) updated.push(res);
    setReservations(updated);
    ZumraDB.saveReservations(updated);
  };

  const handleDeleteReservation = (id: string) => {
    const updated = reservations.filter(item => item.id.toString() !== id);
    setReservations(updated);
    ZumraDB.saveReservations(updated);
  };

  const handleSaveAccount = (acc: Account) => {
    const updated = accounts.map(item => item.id === acc.id ? acc : item);
    if (!accounts.some(item => item.id === acc.id)) updated.push(acc);
    setAccounts(updated);
    ZumraDB.saveAccounts(updated);
  };

  const handleDeleteAccount = (id: string) => {
    const updated = accounts.filter(item => item.id !== id);
    setAccounts(updated);
    ZumraDB.saveAccounts(updated);
  };

  const reverseTransactionEffect = (tr: Transaction, currentAgents: Agent[], currentAccounts: Account[]) => {
    let newAgents = [...currentAgents];
    let newAccounts = [...currentAccounts];

    if (tr.type === 'ClientPayment' && tr.agentId) {
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance - tr.amount } : ag);
    } else if (tr.type === 'SupplierPayment' && tr.agentId) {
      newAgents = newAgents.map(ag => ag.id === tr.agentId ? { ...ag, balance: ag.balance + tr.amount } : ag);
    }

    if (tr.fromAccountId) {
      const modifier = tr.type === 'ClientPayment' ? -tr.amount : tr.amount;
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
    }

    if (tr.fromAccountId) {
      const modifier = tr.type === 'ClientPayment' ? tr.amount : -tr.amount;
      newAccounts = newAccounts.map(acc => acc.id === tr.fromAccountId ? { ...acc, balance: acc.balance + modifier } : acc);
    }
    return { newAgents, newAccounts };
  };

  const handleSaveTransaction = (tr: Transaction) => {
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

    const applied = applyTransactionEffect(tr, currentAgents, currentAccounts);
    setAgents(applied.newAgents);
    ZumraDB.saveAgents(applied.newAgents);
    setAccounts(applied.newAccounts);
    ZumraDB.saveAccounts(applied.newAccounts);
  };

  const handleDeleteTransaction = (id: string) => {
    const existing = transactions.find(t => t.id === id);
    if (!existing) return;
    const updated = transactions.filter(item => item.id !== id);
    setTransactions(updated);
    ZumraDB.saveTransactions(updated);

    const reversed = reverseTransactionEffect(existing, agents, accounts);
    setAgents(reversed.newAgents);
    ZumraDB.saveAgents(reversed.newAgents);
    setAccounts(reversed.newAccounts);
    ZumraDB.saveAccounts(reversed.newAccounts);
  };

  const handleSaveExternalTransfer = (et: ExternalTransfer) => {
    const updated = externalTransfers.map(item => item.id === et.id ? et : item);
    if (!externalTransfers.some(item => item.id === et.id)) updated.push(et);
    setExternalTransfers(updated);
    ZumraDB.saveExternalTransfers(updated);
  };

  const handleDeleteExternalTransfer = (id: string) => {
    const updated = externalTransfers.filter(item => item.id !== id);
    setExternalTransfers(updated);
    ZumraDB.saveExternalTransfers(updated);
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
  };

  // Bulk distributed FIFO downpayments side effect saver
  const handleBulkPaymentDistributionSave = (updatedR: Reservation[], newT: Transaction[], updatedA: Account[]) => {
    setReservations(updatedR);
    ZumraDB.saveReservations(updatedR);

    // Concatenate new transactions
    const updatedTransactionsList = [...newT, ...transactions];
    setTransactions(updatedTransactionsList);
    ZumraDB.saveTransactions(updatedTransactionsList);

    setAccounts(updatedA);
    ZumraDB.saveAccounts(updatedA);

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
    }
  };

  const handleAddUser = (user: User) => {
    const existing = users.find(u => u.id === user.id);
    let updated;
    if (existing) {
      updated = users.map(u => u.id === user.id ? user : u);
    } else {
      updated = [...users, user];
    }
    setUsers(updated);
    ZumraDB.saveUsers(updated);
  };

  const handleDeleteUser = (userId: string) => {
    const updated = users.filter(u => u.id !== userId);
    setUsers(updated);
    ZumraDB.saveUsers(updated);
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
  };

  const handleDeleteFollowUp = (id: string) => {
    const updated = followUps.filter(item => item.id !== id);
    setFollowUps(updated);
    ZumraDB.saveFollowUps(updated);
  };

  // Switch tab triggered from Dashboard widgets
  const handleNavigate = (tab: string, initialFilters?: any) => {
    setActiveFilters(initialFilters);
    setActiveTab(tab);
  };

  // Core visual tab panels
  const renderActivePage = () => {
    if (!currentUser) return <div className="text-center py-20 text-slate-400">Loading operator identities...</div>;

    switch (activeTab) {
      case 'Dashboard':
        return (
          <Dashboard
            reservations={reservations}
            agents={agents}
            hotels={hotels}
            users={users}
            followUps={followUps}
            onNavigate={handleNavigate}
            onQuickReservation={() => setActiveTab('Reservations')}
          />
        );
      case 'Reservations':
        return (
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
          />
        );
      case 'Hotels':
        return (
          <HotelsPage
            hotels={hotels}
            onSaveHotel={handleSaveHotel}
            onDeleteHotel={handleDeleteHotel}
          />
        );
      case 'Agents':
        return (
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
        );
      case 'Allotments':
        return (
          <AllotmentsPage
            allotments={allotments}
            hotels={hotels}
            agents={agents}
            onSaveAllotment={handleSaveAllotment}
            onDeleteAllotment={handleDeleteAllotment}
          />
        );
      case 'Transactions':
        return (
          <TransactionsPage
            transactions={transactions}
            agents={agents}
            accounts={accounts}
            reservations={reservations}
            currentUser={currentUser.name}
            onSaveTransaction={handleSaveTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        );
      case 'External Transfers':
        return (
          <ExternalTransfersPage
            externalTransfers={externalTransfers}
            onSaveTransfer={handleSaveExternalTransfer}
            onDeleteTransfer={handleDeleteExternalTransfer}
          />
        );
      case 'Banks & Safes':
        return (
          <AccountsPage
            accounts={accounts}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={handleDeleteAccount}
            onModifyBalances={handleModifyBalances}
          />
        );
      case 'Reports':
        return (
          <ReportsPage
            reservations={reservations}
            agents={agents}
            hotels={hotels}
            transactions={transactions}
          />
        );
      case 'Sales':
        return (
          <SalesPage
            agents={agents}
            followUps={followUps}
            currentUser={currentUser.name}
            onSaveFollowUp={handleSaveFollowUp}
            onDeleteFollowUp={handleDeleteFollowUp}
          />
        );
      case 'Users':
        return (
          <UserManagementPage
            users={users}
            currentUser={currentUser}
            onSetCurrentUser={handleSetCurrentUser}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
          />
        );
      default:
        return <div>Pane Not Found.</div>;
    }
  };

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: '📊' },
    { name: 'Reservations', icon: '📅' },
    { name: 'Sales', icon: '🚀' },
    { name: 'Hotels', icon: '🏢' },
    { name: 'Agents', icon: '👥' },
    { name: 'Allotments', icon: '📦' },
    { name: 'Transactions', icon: '💰' },
    { name: 'External Transfers', icon: '💸' },
    { name: 'Banks & Safes', icon: '🏦' },
    { name: 'Reports', icon: '📋' },
    { name: 'Users', icon: '🔑' },
  ];

  if (!currentUser) {
    return <LoginPage users={users} onLoginSuccess={handleSetCurrentUser} />;
  }

  // Get permitted nav items based on user's specific role
  const permittedNavItems = navItems.filter((item) => {
    if (currentUser.role === 'Reservationist' || currentUser.role === 'Sales') {
      return ['Dashboard', 'Reservations', 'Sales', 'Hotels', 'Agents', 'Allotments'].includes(item.name);
    }
    if (currentUser.role === 'Finance') {
      return ['Dashboard', 'Reservations', 'Hotels', 'Agents', 'Transactions', 'External Transfers', 'Banks & Safes', 'Reports'].includes(item.name);
    }
    return true; // Admin gets everything
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

      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-64 flex-shrink-0 ${currentTheme.sidebarBg} text-white flex flex-col no-print border-b md:border-b-0 md:border-r ${currentTheme.sidebarBorder}`}>
        <div className={`p-5 flex flex-row md:flex-col items-center justify-between md:justify-center border-b ${currentTheme.sidebarBorder} gap-3`}>
          <div className="flex items-center gap-3 md:flex-col">
            <div className={`flex items-center justify-center transition-transform hover:scale-105 bg-white p-2 rounded-xl`}>
              <ZumraLogo size="sm" variant="dark" />
            </div>
            <div className="text-left md:text-center mt-1">
              <p className={`text-[11px] md:text-[12px] text-amber-400 font-extrabold tracking-widest leading-none`}>B2B RMS</p>
            </div>
          </div>

          {/* Current worker label display (shown in header row on mobile, bottom of sidebar on desktop) */}
          {currentUser && (
            <div className={`hidden md:flex items-center gap-2 ${currentTheme.sidebarBgSecondary} p-2 rounded-xl border ${currentTheme.sidebarBorder} mt-1 w-full`}>
              <span className="text-xs">👤</span>
              <div className="min-w-0">
                <span className={`text-[9px] ${currentTheme.brandText} block leading-none`}>Operator ({currentUser.role}):</span>
                <span className="text-xs font-bold font-mono tracking-wider text-amber-250 uppercase truncate block">{currentUser.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 overflow-y-auto no-scrollbar space-y-1.5 px-3 flex flex-row md:flex-col gap-1 md:gap-0 overflow-x-auto">
          {permittedNavItems.map((item) => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveFilters(null);
                  setActiveTab(item.name);
                }}
                className={`flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-xl text-xs font-extrabold transition-all duration-150 whitespace-nowrap md:w-full ${
                  isActive
                    ? `${currentTheme.sidebarActive}`
                    : `${currentTheme.sidebarText} ${currentTheme.sidebarHover} hover:text-white`
                }`}
              >
                <span className="text-xs md:text-sm">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            );
          })}
          {/* Mobile logout trigger */}
          <button
            onClick={() => handleSetCurrentUser(null as any)}
            className="flex md:hidden items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 text-rose-300 hover:bg-rose-950/30"
          >
            <span>🚪</span>
            <span>Exit Portal</span>
          </button>
        </nav>

        {/* Sidebar Footer Worker */}
        {currentUser && (
          <div className={`p-4 ${currentTheme.sidebarBgSecondary} border-t ${currentTheme.sidebarBorder} hidden md:block`}>
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
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen md:min-h-0 bg-slate-50">
        
        {/* Top Header Row */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 flex-shrink-0 shadow-sm no-print">
          <div className="flex items-center gap-2">
            <h2 className="text-sm md:text-base font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              {activeTab} Management
            </h2>
            <span className={`hidden sm:inline-block text-[9px] ${currentTheme.badgeBg} font-extrabold px-3 py-0.5 rounded-full uppercase tracking-tight`}>
              Egypt Standard Time (Cairo)
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
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-[1000] overflow-hidden">
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

            {currentUser && (
              <div className={`md:hidden flex items-center gap-1.5 ${currentTheme.badgeBg} px-2.5 py-1 rounded-lg border ${currentTheme.sidebarBorder}`}>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span className="text-[10px] font-bold font-mono uppercase text-slate-800">{currentUser.name}</span>
              </div>
            )}
            
            {/* Theme switcher */}
            <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-xl transition">
              <span className="text-[9px] font-bold text-slate-500 uppercase px-1 hidden md:inline">Theme:</span>
              <select
                value={activeThemeId}
                onChange={(e) => handleSetTheme(e.target.value)}
                className="bg-transparent text-slate-800 font-extrabold py-1 border-none text-[11px] focus:outline-none focus:ring-0 cursor-pointer text-xs"
              >
                {THEMES.map(t => (
                  <option key={t.id} value={t.id} className="font-sans text-xs">
                    {t.emoji} {t.name}
                  </option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => {
                setActiveFilters(null);
                setActiveTab('Reservations');
              }}
              className={`${currentTheme.btnPrimary} font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
            >
              <span className="text-sm">📅</span>
              <span>New Reservation</span>
            </button>
          </div>
        </header>

        {/* Scrollable central content area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 print:p-0 print:m-0">
          {renderActivePage()}
        </div>

        {/* Dynamic bottom status bar */}
        <footer className={`${currentTheme.mainBg ? 'bg-transparent border-t border-white/10' : 'bg-white border-t border-slate-200'} h-8 px-6 flex items-center justify-between text-[10px] text-zinc-400 font-medium flex-shrink-0 no-print select-none`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              System Live
            </span>
            <span className="hidden sm:inline">Active Nodes: Cairo-Central</span>
          </div>
          <div className={`flex items-center gap-2 ${currentTheme.footerText} font-extrabold`}>
            <span>© {new Date().getFullYear()} ZUMRA HOTELS SOLUTIONS</span>
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
    </div>
  );
}
