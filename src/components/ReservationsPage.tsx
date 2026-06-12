/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel, RoomLine, Transaction, Account, User, Allotment, AmendmentEntry, GlobalAuditEntry, TermsAndConditions, SalesPerson, FollowUp, BlackoutPeriod, WaitlistEntry, BookingTemplate } from '../types';
import ZumraLogo from './ZumraLogo';
import Tooltip from './Tooltip';
import { getReservationTotals, getEgyptTime, exportToCSV, exportToExcel, getNextVoucherNo, getNextDocNo, checkAllotmentCapacity, loadMarginThreshold, loadBookingTemplates, saveBookingTemplates, loadCommissions, saveCommissions, recordCommissionEntries, reverseCommissionEntries, calculateSalesPersonCommission, calculateSupplierCommission } from '../lib/storage';
import { isEmailConfigured, sendBookingConfirmation, sendPaymentReminder, sendSupplierRateConfirmation } from '../lib/email';
import { useLang } from '../lib/LanguageContext';
import ConfirmationPDF from './ConfirmationPDF';
import InvoicePDF from './InvoicePDF';
import ConfirmDialog from './ConfirmDialog';
import VirtualTable from './VirtualTable';
import { useToast, ToastContainer } from './Toast';
import { hasDraft, loadDraft, clearDraft } from '../hooks/useDraft';
import CancellationWizard, { CancellationResult } from './CancellationWizard';
import SmartSelect, { SmartSelectOption } from './SmartSelect';
import BookingTemplatesModal from './BookingTemplatesModal';
import CreditNotePDF from './CreditNotePDF';
import { loadCreditNotes, saveCreditNotes } from '../lib/storage';
import { CreditNoteEntry } from '../types';

interface RoomSelection {
  roomType: string;
  view: string;
  mealPlan: string;
  qty: number;
  pax: number;
  buyPriceNum: number;
  sellPriceNum: number;
  hasWeekend?: boolean;
  weekendBuyPriceNum?: number;
  weekendSellPriceNum?: number;
  hasExtraBed?: boolean;
  extraBedBuyPriceNum?: number;
  extraBedSellPriceNum?: number;
  hasSeparateMealRate?: boolean;
  mealRateBuyNum?: number;
  mealRateSellNum?: number;
  hasViewSupplement?: boolean;
  viewSuppBuyPriceNum?: number;
  viewSuppSellPriceNum?: number;
  hasExtraMeal1?: boolean;
  extraMeal1Label?: string;
  extraMeal1BuyNum?: number;
  extraMeal1SellNum?: number;
  hasExtraMeal2?: boolean;
  extraMeal2Label?: string;
  extraMeal2BuyNum?: number;
  extraMeal2SellNum?: number;
  nightlyRates?: number | { [date: string]: number };
  buyRate?: number | { [date: string]: number };
}

interface ReservationsPageProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  users: User[];
  currentUser: string;
  initialFilters?: any;
  onSaveReservation: (reservation: Reservation) => void;
  onDeleteReservation: (id: string) => void;
  onBulkAction?: (action: 'confirm' | 'cancel' | 'delete', ids: number[]) => void;
  accounts?: Account[];
  onSaveTransaction?: (tr: Transaction) => void;
  transactions?: Transaction[];
  allotments?: Allotment[];
  onSaveAllotment?: (allotment: Allotment) => void;
  onLogAudit?: (entry: Omit<GlobalAuditEntry, 'id' | 'timestamp'>) => void;
  currentUserRole?: string;
  onRequestEditApproval?: (request: import('../types').EditApprovalRequest) => void;
  onNavigate?: (page: string, filters?: any) => void;
  termsAndConditions?: TermsAndConditions[];
  salesPersons?: SalesPerson[];
  onSaveFollowUp?: (fu: FollowUp) => void;
  followUps?: FollowUp[];
  blackoutPeriods?: BlackoutPeriod[];
  onSaveWaitlist?: (entry: WaitlistEntry) => void;
  hasMoreReservations?: boolean;
  onLoadMoreReservations?: () => void;
  auditLog?: GlobalAuditEntry[];
}

const BOOKING_SOURCES = ['Direct', 'Booking.com', 'Expedia', 'Agoda', 'Agent', 'Walk-in', 'Phone', 'Email', 'Social Media', 'Partner', 'Other'];
const TAG_OPTIONS = ['VIP', 'Honeymoon', 'Corporate', 'Family', 'Group-Tour', 'Long-Stay', 'Urgent', 'Repeat-Guest'];

export default function ReservationsPage({
  reservations,
  agents,
  hotels,
  users,
  currentUser,
  initialFilters,
  onSaveReservation,
  onDeleteReservation,
  onBulkAction,
  accounts = [],
  onSaveTransaction,
  transactions = [],
  allotments = [],
  onSaveAllotment,
  onLogAudit,
  currentUserRole,
  onRequestEditApproval,
  onNavigate,
  termsAndConditions = [],
  salesPersons = [],
  onSaveFollowUp,
  followUps = [],
  blackoutPeriods = [],
  onSaveWaitlist,
  hasMoreReservations = false,
  onLoadMoreReservations,
  auditLog = [],
}: ReservationsPageProps) {
  
  // View states
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [bookingTemplates, setBookingTemplates] = useState<BookingTemplate[]>(() => loadBookingTemplates());
  const [expandedNightlyGrid, setExpandedNightlyGrid] = useState<Set<number>>(new Set());
  const [creditNoteEntry, setCreditNoteEntry] = useState<CreditNoteEntry | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNoteEntry[]>(() => loadCreditNotes());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [printingDoc, setPrintingDoc] = useState<{ res: Reservation; isVoucher: boolean } | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Reservation | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  // Local editing states for detailed modal view
  const [localHotelConf, setLocalHotelConf] = useState('');
  const [localAgreementNo, setLocalAgreementNo] = useState('');
  const [localAgreementStatus, setLocalAgreementStatus] = useState<'Approved' | 'Pending' | 'Declined'>('Pending');
  const [localRoomDetails, setLocalRoomDetails] = useState<{name: string, confNo: string}[]>([]);

  // Recording reservation payments states
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payCurrency, setPayCurrency] = useState<'SAR' | 'EGP'>('SAR');
  const [payOriginalAmount, setPayOriginalAmount] = useState<number>(0);
  const [payExchangeRate, setPayExchangeRate] = useState<number>(1);
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank Transfer'>('Bank Transfer');
  const [payVoucher, setPayVoucher] = useState<string>('');
  const [payDirection, setPayDirection] = useState<'client' | 'supplier'>('client');
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'payment' | 'agreements' | 'documents' | 'history'>('overview');
  const { t, lang } = useLang();
  const toast = useToast();
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; title: string; message: string; variant: 'standard' | 'destructive'; action: (() => void) | null }>({ open: false, title: '', message: '', variant: 'standard', action: null });
  const openConfirm = (title: string, message: string, action: () => void, variant: 'standard' | 'destructive' = 'standard') => {
    setConfirmDlg({ open: true, title, message, variant, action });
  };
  const closeConfirmDlg = () => setConfirmDlg(prev => ({ ...prev, open: false, action: null }));
  const execConfirm = () => { confirmDlg.action?.(); closeConfirmDlg(); };

  // Cancellation Wizard state - holds the reservation being cancelled, or null
  const [cancelWizardRes, setCancelWizardRes] = useState<Reservation | null>(null);

  const handleCancellationConfirm = (result: CancellationResult) => {
    if (cancelWizardRes && cancelWizardRes.id > 0 && cancelWizardRes.id.toString() !== editingId) {
      // List view quick cancel - save directly
      onSaveReservation({
        ...cancelWizardRes,
        status: 'Cancelled',
        cancellationReason: result.cancellationReason,
        cancellationFee: result.cancellationFee,
        clientCreditDisposition: result.clientDisposition,
        supplierCreditDisposition: result.supplierDisposition,
        clientCreditNote: result.clientNote,
        supplierCreditNote: result.supplierNote,
      });
    } else {
      // Form view - set fields for later save
      setStatus('Cancelled');
      setCancellationReason(result.cancellationReason);
      setCancellationFee(result.cancellationFee);
      setClientCreditDisposition(result.clientDisposition);
      setSupplierCreditDisposition(result.supplierDisposition);
      setClientCreditNote(result.clientNote);
      setSupplierCreditNote(result.supplierNote);
      toast.info('Cancellation details set. Click Save to apply.');
    }
    setCancelWizardRes(null);
  };

  // Draft recovery
  const [showDraftBanner, setShowDraftBanner] = useState(() => hasDraft('reservation_form'));
  const resumeDraft = () => {
    const d = loadDraft<any>('reservation_form');
    if (d) {
      if (d.guestName) setGuestName(d.guestName);
      if (d.clientId) setClientId(d.clientId);
      if (d.supplierId) setSupplierId(d.supplierId);
      if (d.hotelId) setHotelId(d.hotelId);
      if (d.checkIn) setCheckIn(d.checkIn);
      if (d.checkOut) setCheckOut(d.checkOut);
      if (d.status) setStatus(d.status);
      if (d.guestNationality) setGuestNationality(d.guestNationality);
      if (d.rooms?.length) setRooms(d.rooms);
      setShowForm(true);
    }
    setShowDraftBanner(false);
  };

  // Trigger loading active reservation specifics
  React.useEffect(() => {
    if (viewingId) {
      const activeRes = reservations.find(r => r.id.toString() === viewingId);
      if (activeRes) {
        setLocalHotelConf(activeRes.hotelConfirmationNo || '');
        setLocalAgreementNo(activeRes.agreementNo || '');
        setLocalAgreementStatus(activeRes.agreementStatus || 'Pending');
        
        let parsedRoomDetails: {name: string, confNo: string}[] = [];
        try {
          if (activeRes.roomingList && activeRes.roomingList.startsWith('[')) {
            parsedRoomDetails = JSON.parse(activeRes.roomingList);
          }
        } catch(e) {}

        const initialRoomDetails: {name: string, confNo: string}[] = [];
        let roomIndex = 0;
        activeRes.rooms.forEach((rm) => {
          for (let i = 0; i < rm.qty; i++) {
            const existing = parsedRoomDetails[roomIndex] || { name: '', confNo: '' };
            initialRoomDetails.push({
              name: existing.name || '',
              confNo: existing.confNo || ''
            });
            roomIndex++;
          }
        });
        setLocalRoomDetails(initialRoomDetails);

        // Pre-fill payment outstanding calculations
        const totals = getReservationTotals(activeRes);
        const outstanding = totals.totalSell - (activeRes.amountPaidByClient || 0);
        setPayAmount(outstanding > 0 ? outstanding : 0);
        if (accounts && accounts.length > 0) {
          setPayAccountId(accounts[0].id);
        }
        setPayVoucher(getNextVoucherNo('REC', transactions || []));
      }
    }
  }, [viewingId, reservations, accounts]);

  React.useEffect(() => {
    if (initialFilters?.viewReservationId) {
      setViewingId(String(initialFilters.viewReservationId));
      setSearchTerm(String(initialFilters.viewReservationId));
    }
    if (initialFilters?.reservationId) {
      setEditingId(String(initialFilters.reservationId));
      setShowForm(true);
      setViewingId(null);
    }
    if (initialFilters?.showNewForm) {
      setShowForm(true);
      setEditingId(null);
      setViewingId(null);
      // Start with blank client/supplier — user must select explicitly
    }
  }, [initialFilters]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgentId, setFilterAgentId] = useState(initialFilters?.clientId || '');
  const [filterSupplierId, setFilterSupplierId] = useState(initialFilters?.supplierId || '');
  const [filterStatus, setFilterStatus] = useState(initialFilters?.status || '');
  const [filterDate, setFilterDate] = useState(initialFilters?.dateFilter || '');
  const [filterCustom, setFilterCustom] = useState(initialFilters?.customFilter || '');
  const [filterSort, setFilterSort] = useState('Newest');

  React.useEffect(() => {
    if (initialFilters?.customFilter) {
      setFilterCustom(initialFilters.customFilter);
    } else {
      setFilterCustom('');
    }
    if (initialFilters?.status) setFilterStatus(initialFilters.status);
    if (initialFilters?.dateFilter) setFilterDate(initialFilters.dateFilter);
    if (initialFilters?.supplierId) setFilterSupplierId(initialFilters.supplierId);
    if (initialFilters?.clientId) setFilterAgentId(initialFilters.clientId);
  }, [initialFilters]);

  // Master Form states
  const [clientId, setClientId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [hotelId, setHotelId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestNationality, setGuestNationality] = useState('Egyptian');
  const [status, setStatus] = useState<'Tentative' | 'Confirmed' | 'Cancelled'>('Tentative');
  
  // Track Option Date: hidden if status is Confirmed
  const [clientOptionDate, setClientOptionDate] = useState('');
  const [supplierOptionDate, setSupplierOptionDate] = useState('');
  
  const [hotelConfirmationNo, setHotelConfirmationNo] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [agreementNo, setAgreementNo] = useState('');
  const [supplierVoucher, setSupplierVoucher] = useState('');
  const [cancellationFee, setCancellationFee] = useState<number>(0);
  const [cancellationReason, setCancellationReason] = useState('');
  const [clientCreditDisposition, setClientCreditDisposition] = useState<'Refunded' | 'Kept as Credit' | 'N/A'>('N/A');
  const [supplierCreditDisposition, setSupplierCreditDisposition] = useState<'Refunded' | 'Kept as Credit' | 'N/A'>('N/A');
  const [clientCreditNote, setClientCreditNote] = useState('');
  const [supplierCreditNote, setSupplierCreditNote] = useState('');
  
  const [amountPaidByClient, setAmountPaidByClient] = useState<number>(0);
  const [amountPaidToSupplier, setAmountPaidToSupplier] = useState<number>(0);
  const [nonRefundable, setNonRefundable] = useState<boolean>(false);
  const [groupRef, setGroupRef] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [visaExpiry, setVisaExpiry] = useState('');
  const [selectedTcId, setSelectedTcId] = useState('');
  const [bookingSource, setBookingSource] = useState('Direct');
  const [salesPersonId, setSalesPersonId] = useState('');
  const [spCommissionRate, setSpCommissionRate] = useState<number>(0); // Manual SAR/room/night for this booking
  const [collectedBySalesPerson, setCollectedBySalesPerson] = useState(false);
  const [bookingTags, setBookingTags] = useState<string[]>([]);
  const [supplierDueDate, setSupplierDueDate] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [checkInStatus, setCheckInStatus] = useState<'Expected' | 'Checked-In' | 'Checked-Out'>('Expected');
  const [assignedTo, setAssignedTo] = useState('');
  const [showRateCompare, setShowRateCompare] = useState(false);
  const [rateCompareIdx, setRateCompareIdx] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  // Pagination state
  

  // Allotment booking state
  const [selectedAllotmentId, setSelectedAllotmentId] = useState<string>('');
  const [isSupplierLocked, setIsSupplierLocked] = useState<boolean>(false); // Locked when allotment is Direct inventory

  // Rooms breakdown block
  const [rooms, setRooms] = useState<RoomSelection[]>([
    { roomType: 'Double', view: 'City View', mealPlan: 'B.B', qty: 1, pax: 2, buyPriceNum: 0, sellPriceNum: 0 }
  ]);

  // Auto-save draft when form is open
  const [draftSavedAt, setDraftSavedAt] = useState<string>('');
  React.useEffect(() => {
    if (!showForm) return;
    const timer = setTimeout(() => {
      const draftData = { guestName, clientId, supplierId, hotelId, checkIn, checkOut, status, guestNationality, rooms, savedAt: Date.now() };
      try {
        localStorage.setItem('zumra_draft_reservation_form', JSON.stringify(draftData));
        setDraftSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [showForm, guestName, clientId, supplierId, hotelId, checkIn, checkOut, status, guestNationality, rooms]);

  const selectedHotelObj = hotels.find(h => h.id === hotelId);

  // Allotment helpers
  const selectedAllotment = allotments.find(a => a.id === selectedAllotmentId) || null;
  const getAllotmentAvailability = (allotment: Allotment | null): { available: number; message: string } => {
    if (!allotment || !checkIn || !checkOut) return { available: 0, message: '' };
    if (!allotment.dailyAvailability) {
      const avail = allotment.totalRooms - allotment.bookedRooms;
      return { available: avail, message: `${avail} rooms available (flat)` };
    }
    const [y, m, d] = checkIn.split('-');
    const start = new Date(Number(y), Number(m) - 1, Number(d));
    const [ey, em, ed] = checkOut.split('-');
    const end = new Date(Number(ey), Number(em) - 1, Number(ed));
    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    let minAvail = Infinity;
    for (let i = 0; i < nights; i++) {
      const curr = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = curr.toISOString().split('T')[0];
      const day = allotment.dailyAvailability[dateStr];
      if (!day) { minAvail = 0; break; }
      const avail = day.total - day.booked;
      if (avail < minAvail) minAvail = avail;
    }
    return { available: minAvail, message: `Min ${minAvail} rooms available across dates` };
  };

  const handleSelectAllotment = (allotmentId: string) => {
    setSelectedAllotmentId(allotmentId);
    if (!allotmentId) {
      setIsSupplierLocked(false);
      return;
    }
    const a = allotments.find(al => al.id === allotmentId);
    if (a) {
      setHotelId(a.hotelId);
      // If allotment is Direct inventory, lock supplier to DIRECT
      if (a.inventorySource === 'Direct') {
        setSupplierId('DIRECT');
        setIsSupplierLocked(true);
      } else {
        setSupplierId(a.supplierId);
        setIsSupplierLocked(false);
      }
      const hotel = hotels.find(h => h.id === a.hotelId);
      if (hotel) {
        // Find applicable rate period
        let buyRate = 100;
        let sellRate = 150;
        let extraBedBuy = 0;
        let extraBedSell = 0;
        let mealBuy = 0;
        let mealSell = 0;
        const hasRates = a.ratePeriods && a.ratePeriods.length > 0;

        if (hasRates) {
          // Try to match a rate period to the current check-in date
          let matchedPeriod = a.ratePeriods![0]; // default to first period
          if (checkIn) {
            const match = a.ratePeriods!.find(rp => checkIn >= rp.startDate && checkIn <= rp.endDate);
            if (match) matchedPeriod = match;
          }
          buyRate = matchedPeriod.costPerNight || 100;
          sellRate = matchedPeriod.sellRatePerNight || 150;
          extraBedBuy = matchedPeriod.extraBedBuyRate || 0;
          extraBedSell = matchedPeriod.extraBedRate || 0;
          mealBuy = matchedPeriod.mealBuyRate || 0;
          mealSell = matchedPeriod.mealRate || 0;
        }

        setRooms([{
          roomType: a.roomType || hotel.roomTypes[0] || 'Double',
          view: hotel.views[0] || 'City View',
          mealPlan: hotel.mealPlans[0] || 'B.B',
          qty: 1,
          pax: getPaxForRoomType(a.roomType || hotel.roomTypes[0] || 'Double'),
          buyPriceNum: buyRate,
          sellPriceNum: sellRate,
          hasExtraBed: (extraBedBuy > 0 || extraBedSell > 0) ? true : undefined,
          extraBedBuyPriceNum: extraBedBuy || undefined,
          extraBedSellPriceNum: extraBedSell || undefined,
          hasSeparateMealRate: (mealBuy > 0 || mealSell > 0) ? true : undefined,
          mealRateBuyNum: mealBuy || undefined,
          mealRateSellNum: mealSell || undefined,
        }]);
      }
    }
  };

  // Auto calculate nights
  const calculateNightsCount = (): number => {
    if (!checkIn || !checkOut) return 1;
    const s = new Date(checkIn);
    const e = new Date(checkOut);
    const diff = e.getTime() - s.getTime();
    const result = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return result > 0 ? result : 1;
  };

  // Auto resolve pax count based on roomType
  // "the room types to be calculated in meals auto single = 1 pax, double 2 pax, triple 3 pax, quad 4 pax and quint 5 pax"
  const getPaxForRoomType = (type: string): number => {
    const t = type.toLowerCase();
    if (t.includes('single')) return 1;
    if (t.includes('double')) return 2;
    if (t.includes('triple')) return 3;
    if (t.includes('quad')) return 4;
    if (t.includes('quint')) return 5;
    return 2; // default fallback solver
  };

  // Calculate the actual total rate across all nights (accounting for weekend rates)
  // Check if booking date range contains weekend days (Thu=4, Fri=5)
  const hasWeekendDays = (ci: string, co: string): boolean => {
    if (!ci || !co) return false;
    const [y, m, d] = ci.split('-');
    const start = new Date(Number(y), Number(m) - 1, Number(d));
    const [ey, em, ed] = co.split('-');
    const end = new Date(Number(ey), Number(em) - 1, Number(ed));
    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    for (let i = 0; i < nights; i++) {
      const curr = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      if (curr.getDay() === 4 || curr.getDay() === 5) return true;
    }
    return false;
  };

  const calcNightlyTotal = (baseRate: number, hasWeekend?: boolean, weekendRate?: number): number => {
    const n = calculateNightsCount();
    if (!hasWeekend || weekendRate === undefined || !checkIn) return baseRate * n;
    let total = 0;
    const [y, m, d] = checkIn.split('-');
    const start = new Date(Number(y), Number(m) - 1, Number(d));
    for (let i = 0; i < n; i++) {
      const curr = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const day = curr.getDay();
      total += (day === 4 || day === 5) ? weekendRate : baseRate;
    }
    return total;
  };

  // Full room total including all supplements (buy or sell)
  const roomFullTotal = (rm: RoomSelection, side: 'buy' | 'sell'): number => {
    const n = calculateNightsCount();
    const p = rm.pax || 2;
    const base = side === 'buy'
      ? calcNightlyTotal(rm.buyPriceNum, rm.hasWeekend, rm.weekendBuyPriceNum) * rm.qty
      : calcNightlyTotal(rm.sellPriceNum, rm.hasWeekend, rm.weekendSellPriceNum) * rm.qty;
    const eb = rm.hasExtraBed ? ((side === 'buy' ? rm.extraBedBuyPriceNum : rm.extraBedSellPriceNum) || 0) * Math.max(0, p - 2) * n * rm.qty : 0;
    const vs = rm.hasViewSupplement ? ((side === 'buy' ? rm.viewSuppBuyPriceNum : rm.viewSuppSellPriceNum) || 0) * n * rm.qty : 0;
    const ml = rm.hasSeparateMealRate ? ((side === 'buy' ? rm.mealRateBuyNum : rm.mealRateSellNum) || 0) * p * n * rm.qty : 0;
    const em1 = rm.hasExtraMeal1 ? ((side === 'buy' ? rm.extraMeal1BuyNum : rm.extraMeal1SellNum) || 0) * p * n * rm.qty : 0;
    const em2 = rm.hasExtraMeal2 ? ((side === 'buy' ? rm.extraMeal2BuyNum : rm.extraMeal2SellNum) || 0) * p * n * rm.qty : 0;
    return base + eb + vs + ml + em1 + em2;
  };

  const handleAddRoomRow = () => {
    if (!selectedHotelObj) return;
    setRooms([
      ...rooms,
      {
        roomType: selectedHotelObj.roomTypes[0] || 'Double',
        view: selectedHotelObj.views[0] || 'City View',
        mealPlan: selectedHotelObj.mealPlans[0] || 'B.B',
        qty: 1,
        pax: getPaxForRoomType(selectedHotelObj.roomTypes[0] || 'Double'),
        buyPriceNum: 100,
        sellPriceNum: 150
      }
    ]);
  };

  const handleUpdateRoomRow = (index: number, fields: Partial<RoomSelection>) => {
    const updated = [...rooms];
    const item = { ...updated[index], ...fields };
    if (fields.roomType && !fields.roomType.toLowerCase().includes('suite')) {
      item.pax = getPaxForRoomType(fields.roomType);
    } else if (fields.roomType && fields.roomType.toLowerCase().includes('suite')) {
      // Keep existing pax if set manually, or default to 2
      item.pax = item.pax || 2;
    }
    updated[index] = item;
    setRooms(updated);
  };

  const handleRemoveRoomRow = (index: number) => {
    if (rooms.length <= 1) return;
    setRooms(rooms.filter((_, i) => i !== index));
  };

  const handleCopyRoomRow = (index: number) => {
    setRooms([...rooms, { ...rooms[index] }]);
  };

  const handleEdit = (res: Reservation) => {
    setEditingId(res.id.toString());
    setClientId(res.clientId);
    setSupplierId(res.supplierId);
    setIsSupplierLocked(false); // Always unlock when editing directly
    setHotelId(res.hotelId);
    setCheckIn(res.checkIn);
    setCheckOut(res.checkOut);
    setGuestName(res.guestName);
    setGuestNationality(res.guestNationality);
    setStatus(res.status);
    setClientOptionDate(res.clientOptionDate || '');
    setSupplierOptionDate(res.supplierOptionDate || '');
    setHotelConfirmationNo(res.hotelConfirmationNo || '');
    setBankAccountId(res.bankAccountId || '');
    setAgreementNo(res.agreementNo || '');
    setSelectedTcId(res.tcId || '');
    setBookingSource(res.bookingSource || 'Direct');
    setSalesPersonId(res.salesPersonId || '');
    setSpCommissionRate(res.salesPersonCommissionRate || 0);
    setCollectedBySalesPerson(res.collectedBySalesPerson || false);
    setBookingTags(res.tags || []);
    setSupplierDueDate(res.supplierDueDate || '');
    setSpecialRequests(res.specialRequests || '');
    setInternalNotes(res.internalNotes || '');
    setCheckInStatus(res.checkInStatus || 'Expected');
    setAssignedTo(res.assignedTo || '');
    setSupplierVoucher(res.supplierVoucher || '');
    setCancellationFee(res.cancellationFee || 0);
    setCancellationReason(res.cancellationReason || '');
    setClientCreditDisposition(res.clientCreditDisposition || 'N/A');
    setSupplierCreditDisposition(res.supplierCreditDisposition || 'N/A');
    setClientCreditNote(res.clientCreditNote || '');
    setSupplierCreditNote(res.supplierCreditNote || '');
    setAmountPaidByClient(res.amountPaidByClient || 0);
    setAmountPaidToSupplier(res.amountPaidToSupplier || 0);
    setNonRefundable(res.nonRefundable || false);
    
    // Copy and map room objects
    setRooms(res.rooms.map(rm => {
      let isWk = false;
      let wkBuy = undefined;
      let wkSell = undefined;
      let stdBuy = 100;
      let stdSell = 150;

      if (typeof rm.buyRate === 'number') {
        stdBuy = rm.buyRate;
      } else if (rm.buyRate) {
        const values = Array.from(new Set(Object.values(rm.buyRate)));
        stdBuy = values[0] || 100;
        if (values.length > 1) {
          isWk = true;
          wkBuy = values[1];
        }
      }

      if (typeof rm.nightlyRates === 'number') {
        stdSell = rm.nightlyRates;
      } else if (rm.nightlyRates) {
        const values = Array.from(new Set(Object.values(rm.nightlyRates)));
        stdSell = values[0] || 150;
        if (values.length > 1) {
          isWk = true;
          wkSell = values[1];
        }
      }

      return {
        roomType: rm.roomType,
        view: rm.view || 'City View',
        mealPlan: rm.mealPlan || 'B.B',
        qty: rm.qty,
        pax: rm.pax,
        buyPriceNum: stdBuy,
        sellPriceNum: stdSell,
        hasWeekend: isWk,
        weekendBuyPriceNum: wkBuy,
        weekendSellPriceNum: wkSell,
        hasExtraBed: rm.hasExtraBed || false,
        extraBedBuyPriceNum: rm.extraBedBuyRate || 0,
        extraBedSellPriceNum: rm.extraBedRate || 0,
        hasSeparateMealRate: rm.hasSeparateMealRate || false,
        mealRateBuyNum: rm.mealBuyRate || 0,
        mealRateSellNum: rm.mealRate || 0,
        hasViewSupplement: rm.hasViewSupplement || false,
        viewSuppBuyPriceNum: rm.viewSupplementBuyRate || 0,
        viewSuppSellPriceNum: rm.viewSupplementRate || 0,
        hasExtraMeal1: rm.hasExtraMeal1 || false,
        extraMeal1Label: rm.extraMeal1Label || '',
        extraMeal1BuyNum: rm.extraMeal1BuyRate || 0,
        extraMeal1SellNum: rm.extraMeal1Rate || 0,
        hasExtraMeal2: rm.hasExtraMeal2 || false,
        extraMeal2Label: rm.extraMeal2Label || '',
        extraMeal2BuyNum: rm.extraMeal2BuyRate || 0,
        extraMeal2SellNum: rm.extraMeal2Rate || 0
      };
    }));
    setShowForm(true);
  };

  const doSaveReservation = () => {
    // Direct auto incremental RSV ID counting
    let nextId = 1;
    if (!editingId) {
      nextId = reservations.reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
    } else {
      nextId = parseInt(editingId);
    }

    const calculatedNights = calculateNightsCount();

    // Duplicate booking detection: same guest + hotel + overlapping dates
    if (!editingId && guestName && hotelId && checkIn && checkOut) {
      const dupes = reservations.filter(r =>
        r.id !== nextId &&
        r.hotelId === hotelId &&
        r.guestName.toLowerCase() === guestName.toLowerCase() &&
        r.status !== 'Cancelled' &&
        r.checkIn < checkOut && r.checkOut > checkIn
      );
      if (dupes.length > 0) {
        const dupeList = dupes.map(d => `RSV-${d.id} (${d.checkIn} to ${d.checkOut})`).join(', ');
        if (!confirm(`⚠️ Possible duplicate detected!\n\nGuest "${guestName}" already has booking(s) at this hotel with overlapping dates:\n${dupeList}\n\nSave anyway?`)) return;
      }
    }

    // Auto-generate hotel confirmation number when confirming without one
    let autoConfNo = hotelConfirmationNo;
    if (status === 'Confirmed' && !autoConfNo) {
      const year = new Date().getFullYear();
      const existingConfNos = reservations
        .map(r => r.hotelConfirmationNo || '')
        .filter(n => n.startsWith(`ZUM-${year}-`));
      const maxSeq = existingConfNos.reduce((max, n) => {
        const parts = n.split('-');
        const seq = parseInt(parts[2] || '0');
        return seq > max ? seq : max;
      }, 0);
      autoConfNo = `ZUM-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
    }

    const buildNightlyRates = (baseDateStr: string, rate: number, hasWeekend?: boolean, wkRate?: number) => {
      if (!hasWeekend || wkRate === undefined) return rate;
      const map: Record<string, number> = {};
      const [y, m, d] = baseDateStr.split('-');
      const start = new Date(Number(y), Number(m) - 1, Number(d));
      for (let i = 0; i < calculatedNights; i++) {
        const curr = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const day = curr.getDay(); // 4 = Thu, 5 = Fri
        if (day === 4 || day === 5) {
          map[`night_${i}`] = wkRate;
        } else {
          map[`night_${i}`] = rate;
        }
      }
      return map;
    };

    const reservationToSave: Reservation = {
      id: nextId,
      clientId,
      supplierId,
      hotelId,
      checkIn,
      checkOut,
      nights: calculatedNights,
      guestName,
      guestNationality,
      status,
      rooms: rooms.map((rm, rIdx) => ({
        id: `rm_${Date.now()}_${rIdx}`,
        roomType: rm.roomType,
        qty: rm.qty,
        nightlyRates: buildNightlyRates(checkIn, rm.sellPriceNum, rm.hasWeekend, rm.weekendSellPriceNum),
        buyRate: buildNightlyRates(checkIn, rm.buyPriceNum, rm.hasWeekend, rm.weekendBuyPriceNum),
        mealPlan: rm.mealPlan,
        hasSeparateMealRate: !!rm.hasSeparateMealRate,
        mealRate: rm.mealRateSellNum || 0,
        mealBuyRate: rm.mealRateBuyNum || 0,
        hasExtraBed: !!rm.hasExtraBed,
        extraBedRate: rm.extraBedSellPriceNum || 0,
        extraBedBuyRate: rm.extraBedBuyPriceNum || 0,
        hasViewSupplement: !!rm.hasViewSupplement,
        viewSupplementRate: rm.viewSuppSellPriceNum || 0,
        viewSupplementBuyRate: rm.viewSuppBuyPriceNum || 0,
        hasExtraMeal1: !!rm.hasExtraMeal1,
        extraMeal1Label: rm.extraMeal1Label || '',
        extraMeal1Rate: rm.extraMeal1SellNum || 0,
        extraMeal1BuyRate: rm.extraMeal1BuyNum || 0,
        hasExtraMeal2: !!rm.hasExtraMeal2,
        extraMeal2Label: rm.extraMeal2Label || '',
        extraMeal2Rate: rm.extraMeal2SellNum || 0,
        extraMeal2BuyRate: rm.extraMeal2BuyNum || 0,
        pax: rm.pax,
        view: rm.view
      })),
      cancellationFee,
      cancellationReason: status === 'Cancelled' ? cancellationReason : undefined,
      clientCreditDisposition: status === 'Cancelled' ? clientCreditDisposition : undefined,
      supplierCreditDisposition: status === 'Cancelled' ? supplierCreditDisposition : undefined,
      clientCreditNote: status === 'Cancelled' ? clientCreditNote : undefined,
      supplierCreditNote: status === 'Cancelled' ? supplierCreditNote : undefined,
      amountPaidByClient,
      amountPaidToSupplier,
      clientOptionDate: status === 'Tentative' ? clientOptionDate : undefined,
      supplierOptionDate: status === 'Tentative' ? supplierOptionDate : undefined,
      hotelConfirmationNo: status === 'Confirmed' ? autoConfNo : undefined,
      bankAccountId: bankAccountId || undefined,
      agreementNo,
      tcId: selectedTcId || undefined,
      bookingSource: bookingSource || undefined,
      salesPersonId: salesPersonId || undefined,
      salesPersonCommissionRate: salesPersonId ? (spCommissionRate || 0) : undefined,
      salesPersonCommissionAmount: salesPersonId && spCommissionRate > 0 ? (() => {
        const totalRooms = rooms.reduce((s, rm) => s + rm.qty, 0);
        const totalNights = calculateNightsCount();
        return Math.round(spCommissionRate * totalRooms * totalNights);
      })() : undefined,
      supplierCommissionRate: (() => {
        if (!supplierId || supplierId === 'DIRECT') return undefined;
        const sup = agents.find(a => a.id === supplierId);
        return sup?.supplierMarkupRate || undefined;
      })(),
      supplierCommissionAmount: (() => {
        if (!supplierId || supplierId === 'DIRECT') return undefined;
        const sup = agents.find(a => a.id === supplierId);
        if (!sup?.supplierMarkupRate) return undefined;
        const totalBuyCalc = rooms.reduce((s, rm) => s + roomFullTotal(rm, 'buy'), 0);
        return Math.round((totalBuyCalc * sup.supplierMarkupRate!) / 100);
      })(),
      commissionPaidToSalesPerson: editingId ? (reservations.find(r => r.id.toString() === editingId)?.commissionPaidToSalesPerson || false) : false,
      commissionPaidDate: editingId ? (reservations.find(r => r.id.toString() === editingId)?.commissionPaidDate) : undefined,
      collectedBySalesPerson: collectedBySalesPerson || undefined,
      collectedDate: collectedBySalesPerson ? new Date().toISOString().split('T')[0] : undefined,
      remittedToCompany: editingId ? (reservations.find(r => r.id.toString() === editingId)?.remittedToCompany || false) : false,
      remittedDate: editingId ? (reservations.find(r => r.id.toString() === editingId)?.remittedDate) : undefined,
      tags: bookingTags.length > 0 ? bookingTags : undefined,
      supplierDueDate: supplierDueDate || undefined,
      specialRequests: specialRequests || undefined,
      internalNotes: internalNotes || undefined,
      checkInStatus: checkInStatus || 'Expected',
      assignedTo: assignedTo || undefined,
      supplierVoucher,
      allotmentId: selectedAllotmentId || undefined,
      nonRefundable: nonRefundable || undefined,
      groupRef: groupRef || undefined,
      passportExpiry: passportExpiry || undefined,
      visaExpiry: visaExpiry || undefined,
      createdAt: editingId ? (reservations.find(r => r.id.toString() === editingId)?.createdAt || getEgyptTime().toISOString().replace('T', ' ').substring(0, 19)) : getEgyptTime().toISOString().replace('T', ' ').substring(0, 19),
      createdBy: currentUser
    };

    // Amendment history: track changes when editing
    if (editingId) {
      const oldRes = reservations.find(r => r.id.toString() === editingId);
      if (oldRes) {
        const amendments: AmendmentEntry[] = [];
        const ts = new Date().toISOString();
        const mkEntry = (field: string, oldVal: string, newVal: string): AmendmentEntry => ({
          id: `amd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: ts, user: currentUser, field, oldValue: oldVal, newValue: newVal
        });
        if (oldRes.status !== status) amendments.push(mkEntry('Status', oldRes.status, status));
        if (oldRes.checkIn !== checkIn) amendments.push(mkEntry('Check-In', oldRes.checkIn, checkIn));
        if (oldRes.checkOut !== checkOut) amendments.push(mkEntry('Check-Out', oldRes.checkOut, checkOut));
        if (oldRes.guestName !== guestName) amendments.push(mkEntry('Guest Name', oldRes.guestName, guestName));
        if (oldRes.clientId !== clientId) amendments.push(mkEntry('Client', agents.find(a => a.id === oldRes.clientId)?.name || oldRes.clientId, agents.find(a => a.id === clientId)?.name || clientId));
        if (oldRes.supplierId !== supplierId) amendments.push(mkEntry('Supplier', agents.find(a => a.id === oldRes.supplierId)?.name || oldRes.supplierId, agents.find(a => a.id === supplierId)?.name || supplierId));
        if (oldRes.hotelId !== hotelId) amendments.push(mkEntry('Hotel', hotels.find(h => h.id === oldRes.hotelId)?.name || oldRes.hotelId, hotels.find(h => h.id === hotelId)?.name || hotelId));
        if (oldRes.amountPaidByClient !== amountPaidByClient) amendments.push(mkEntry('Client Paid', String(oldRes.amountPaidByClient), String(amountPaidByClient)));
        if (oldRes.amountPaidToSupplier !== amountPaidToSupplier) amendments.push(mkEntry('Supplier Paid', String(oldRes.amountPaidToSupplier), String(amountPaidToSupplier)));
        const oldTotalRooms = oldRes.rooms.reduce((s, r) => s + r.qty, 0);
        const newTotalRooms = rooms.reduce((s, r) => s + r.qty, 0);
        if (oldTotalRooms !== newTotalRooms) amendments.push(mkEntry('Total Rooms', String(oldTotalRooms), String(newTotalRooms)));
        if (amendments.length > 0) {
          reservationToSave.amendmentHistory = [...(oldRes.amendmentHistory || []), ...amendments];
        } else {
          reservationToSave.amendmentHistory = oldRes.amendmentHistory;
        }
      }
    }

    // Audit log
    if (onLogAudit) {
      onLogAudit({
        user: currentUser,
        action: editingId ? 'Update Reservation' : 'Create Reservation',
        entityType: 'Reservation',
        entityId: String(nextId),
        detail: `${reservationToSave.guestName} @ ${hotels.find(h => h.id === reservationToSave.hotelId)?.name || ''} | ${checkIn} to ${checkOut} | ${status}`
      });
    }

    // Approval workflow: non-admin/reservation manager edits require approval
    if (editingId && onRequestEditApproval && currentUserRole !== 'Admin' && currentUserRole !== 'ReservationsManager') {
      const oldRes = reservations.find(r => r.id.toString() === editingId);
      if (oldRes) {
        const changes: { field: string; oldValue: string; newValue: string }[] = [];
        if (oldRes.status !== status) changes.push({ field: 'Status', oldValue: oldRes.status, newValue: status });
        if (oldRes.checkIn !== checkIn) changes.push({ field: 'Check-In', oldValue: oldRes.checkIn, newValue: checkIn });
        if (oldRes.checkOut !== checkOut) changes.push({ field: 'Check-Out', oldValue: oldRes.checkOut, newValue: checkOut });
        if (oldRes.guestName !== guestName) changes.push({ field: 'Guest Name', oldValue: oldRes.guestName, newValue: guestName });
        if (oldRes.clientId !== clientId) changes.push({ field: 'Client', oldValue: agents.find(a => a.id === oldRes.clientId)?.name || oldRes.clientId, newValue: agents.find(a => a.id === clientId)?.name || clientId });
        if (oldRes.hotelId !== hotelId) changes.push({ field: 'Hotel', oldValue: hotels.find(h => h.id === oldRes.hotelId)?.name || oldRes.hotelId, newValue: hotels.find(h => h.id === hotelId)?.name || hotelId });
        if (oldRes.amountPaidByClient !== amountPaidByClient) changes.push({ field: 'Client Paid', oldValue: String(oldRes.amountPaidByClient), newValue: String(amountPaidByClient) });
        if (oldRes.amountPaidToSupplier !== amountPaidToSupplier) changes.push({ field: 'Supplier Paid', oldValue: String(oldRes.amountPaidToSupplier), newValue: String(amountPaidToSupplier) });

        if (changes.length > 0) {
          const approvalReq: import('../types').EditApprovalRequest = {
            id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            reservationId: oldRes.id,
            requestedBy: currentUser,
            requestedAt: new Date().toISOString(),
            status: 'Pending',
            changes,
            originalSnapshot: oldRes,
            newSnapshot: reservationToSave,
          };
          onRequestEditApproval(approvalReq);
          if (onLogAudit) {
            onLogAudit({
              user: currentUser,
              action: 'Edit Approval Requested',
              entityType: 'EditApproval',
              entityId: approvalReq.id,
              detail: `RSV-${oldRes.id} edit by ${currentUser}`,
            });
          }
          toast.info('Your changes have been submitted for admin approval.');
          resetForm();
          return;
        }
      }
    }

    onSaveReservation(reservationToSave);
    clearDraft('reservation_form');

    // Record commission ledger entries
    const totalSellForComm = rooms.reduce((s, rm) => s + roomFullTotal(rm, 'sell'), 0);
    const totalBuyForComm = rooms.reduce((s, rm) => s + roomFullTotal(rm, 'buy'), 0);
    const spRate = reservationToSave.salesPersonCommissionRate;
    const supRate = reservationToSave.supplierCommissionRate;
    if ((spRate && spRate > 0) || (supRate && supRate > 0)) {
      const newEntries = recordCommissionEntries(reservationToSave, spRate, supRate, totalSellForComm, totalBuyForComm);
      if (newEntries.length > 0) {
        const existing = loadCommissions();
        // Remove previous entries for this reservation (in case of edit)
        const filtered = existing.filter(c => c.reservationId !== reservationToSave.id);
        saveCommissions([...filtered, ...newEntries]);
      }
    }
    // Reverse commission entries if cancelled
    if (reservationToSave.status === 'Cancelled') {
      reverseCommissionEntries(reservationToSave.id);
    }

    // Auto-create follow-up for option dates
    if (onSaveFollowUp && reservationToSave.status === 'Tentative') {
      const followUpDate = reservationToSave.clientOptionDate || reservationToSave.supplierOptionDate;
      if (followUpDate) {
        const existingFollowUp = followUps.find(f => f.topic.includes(`RSV-${reservationToSave.id}`) && f.status === 'Pending');
        if (!existingFollowUp) {
          const newFollowUp: FollowUp = {
            id: `fu_auto_${Date.now()}`,
            clientId: reservationToSave.clientId,
            date: followUpDate,
            topic: `Option Expiry - RSV-${reservationToSave.id}`,
            notes: `Auto-created: ${reservationToSave.guestName} at ${hotels.find(h => h.id === reservationToSave.hotelId)?.name || ''}. Client option: ${reservationToSave.clientOptionDate || 'N/A'}, Supplier option: ${reservationToSave.supplierOptionDate || 'N/A'}`,
            status: 'Pending',
            createdBy: currentUser
          };
          onSaveFollowUp(newFollowUp);
        }
      }
    }

    resetForm();
    toast.success(`Booking Reservation RSV-${nextId} saved successfully!`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !supplierId || !hotelId || !checkIn || !checkOut) {
      toast.warning('Please fill out all mandatory booking specs.');
      return;
    }

    // Blank guest name warning (non-blocking)
    if (!guestName) {
      toast.warning('Guest name is blank — this booking will be flagged for review.');
    }

    // Duplicate booking detection: check for same guest + overlapping dates + same hotel
    if (!editingId) {
      const newCheckIn = new Date(checkIn);
      const newCheckOut = new Date(checkOut);
      const duplicate = reservations.find(r => {
        if (r.status === 'Cancelled') return false;
        if (r.hotelId !== hotelId) return false;
        if (r.guestName.trim().toLowerCase() !== guestName.trim().toLowerCase()) return false;
        const existCheckIn = new Date(r.checkIn);
        const existCheckOut = new Date(r.checkOut);
        // Overlapping date ranges
        return newCheckIn < existCheckOut && newCheckOut > existCheckIn;
      });
      if (duplicate) {
        openConfirm(
          'Possible Duplicate Booking',
          `A similar booking already exists:\n\nRSV-${duplicate.id} | ${duplicate.guestName}\n${hotels.find(h => h.id === duplicate.hotelId)?.name || ''} | ${duplicate.checkIn} to ${duplicate.checkOut} (${duplicate.status})\n\nDo you still want to create this booking?`,
          () => doSaveReservation()
        );
        return;
      }
    }

    // Credit limit warning (non-blocking)
    const selectedClient = agents.find(a => a.id === clientId);
    if (selectedClient?.creditLimit) {
      const totalOutstanding = reservations
        .filter(r => r.clientId === clientId && r.status !== 'Cancelled')
        .reduce((sum, r) => {
          const { totalSell } = getReservationTotals(r);
          return sum + Math.max(totalSell - (r.amountPaidByClient || 0), 0);
        }, 0);
      if (totalOutstanding > selectedClient.creditLimit) {
        toast.warning(`Client "${selectedClient.companyName || selectedClient.name}" has exceeded credit limit: ${totalOutstanding.toLocaleString()} SAR outstanding vs ${selectedClient.creditLimit.toLocaleString()} SAR limit.`);
      }
    }

    // Weekend rate reminder: warn if booking spans weekend days but ANY room line is missing weekend rate
    if (hasWeekendDays(checkIn, checkOut)) {
      const roomsMissingWeekend = rooms
        .map((rm, idx) => ({ idx: idx + 1, rm }))
        .filter(({ rm }) => !rm.hasWeekend);
      if (roomsMissingWeekend.length > 0) {
        const linesList = roomsMissingWeekend.map(({ idx, rm }) =>
          `  • Line ${idx}: ${rm.roomType}${rm.view ? ' (' + rm.view + ')' : ''}`
        ).join('\n');
        openConfirm(
          'Weekend Rate Reminder',
          `This booking contains weekend days (Thu/Fri) but the following room line(s) have no weekend rate set:\n\n${linesList}\n\nHotels sometimes charge different rates on weekends.\n\nDo you want to proceed without weekend rates, or go back and add them?`,
          () => doSaveReservation()
        );
        return;
      }
    }

    // View supplement reminder: warn if a room has a premium view but no view supplement rate
    const STANDARD_VIEWS = ['non view', 'city view', 'no view', 'standard', 'n/a'];
    const roomsMissingViewSupp = rooms
      .map((rm, idx) => ({ idx: idx + 1, rm }))
      .filter(({ rm }) => {
        if (!rm.view) return false;
        const viewLower = rm.view.toLowerCase().trim();
        const isStandard = STANDARD_VIEWS.some(sv => viewLower === sv || viewLower.includes(sv));
        return !isStandard && !rm.hasViewSupplement;
      });
    if (roomsMissingViewSupp.length > 0) {
      const linesList = roomsMissingViewSupp.map(({ idx, rm }) =>
        `  • Line ${idx}: ${rm.roomType} — ${rm.view}`
      ).join('\n');
      openConfirm(
        'View Supplement Reminder',
        `The following room line(s) have a premium view but no view supplement rate is set:\n\n${linesList}\n\nIf this view carries an extra charge, go back and enable the view supplement.\n\nOr proceed if the view rate is included in the base rate?`,
        () => doSaveReservation()
      );
      return;
    }

    doSaveReservation();
  };

  const resetForm = () => {
    setEditingId(null);
    setClientId('');
    setSupplierId('');
    setHotelId('');
    setCheckIn('');
    setCheckOut('');
    setGuestName('');
    setGuestNationality('Egyptian');
    setStatus('Tentative');
    setClientOptionDate('');
    setSupplierOptionDate('');
    setHotelConfirmationNo('');
    setAgreementNo('');
    setSupplierVoucher('');
    setCancellationFee(0);
    setSelectedAllotmentId('');
    setIsSupplierLocked(false);
    setCancellationReason('');
    setClientCreditDisposition('N/A');
    setSupplierCreditDisposition('N/A');
    setClientCreditNote('');
    setSupplierCreditNote('');
    setAmountPaidByClient(0);
    setAmountPaidToSupplier(0);
    setNonRefundable(false);
    setGroupRef('');
    setPassportExpiry('');
    setVisaExpiry('');
    setSelectedTcId('');
    setBookingSource('Direct');
    setSalesPersonId('');
    setSpCommissionRate(0);
    setCollectedBySalesPerson(false);
    setBookingTags([]);
    setSupplierDueDate('');
    setSpecialRequests('');
    setInternalNotes('');
    setCheckInStatus('Expected');
    setAssignedTo('');
    setCompareIds([]);
    setRooms([{ roomType: 'Double', view: 'City View', mealPlan: 'B.B', qty: 1, pax: 2, buyPriceNum: 0, sellPriceNum: 0 }]);
    setShowForm(false);
  };

  const cloneReservation = (res: Reservation) => {
    resetForm();
    // Populate from source reservation
    setHotelId(res.hotelId);
    setClientId(res.clientId);
    setSupplierId(res.supplierId);
    setGuestNationality(res.guestNationality || 'Egyptian');
    setStatus('Tentative');
    setNonRefundable(res.nonRefundable || false);
    setBookingSource(res.bookingSource || 'Direct');
    setSalesPersonId(res.salesPersonId || '');
    setSpCommissionRate(res.salesPersonCommissionRate || 0);
    setBookingTags(res.tags || []);
    setSelectedTcId(res.tcId || '');
    setSpecialRequests(res.specialRequests || '');
    setInternalNotes(res.internalNotes || '');
    setAssignedTo(res.assignedTo || '');
    // Clone rooms with rates
    if (res.rooms && res.rooms.length > 0) {
      setRooms(res.rooms.map(r => ({
        roomType: r.roomType,
        view: r.view || 'City View',
        mealPlan: r.mealPlan,
        qty: r.qty,
        pax: r.pax,
        buyPriceNum: typeof r.buyRate === 'number' ? r.buyRate : 0,
        sellPriceNum: typeof r.nightlyRates === 'number' ? r.nightlyRates : 0,
        hasSeparateMealRate: r.hasSeparateMealRate || false,
        mealRate: r.mealRate || 0,
        mealBuyRate: r.mealBuyRate,
        hasExtraBed: r.hasExtraBed,
        extraBedRate: r.extraBedRate,
        extraBedBuyRate: r.extraBedBuyRate,
      })));
    }
    // Clear: guest name, dates, confirmation numbers (user must fill these)
    setGuestName('');
    setCheckIn('');
    setCheckOut('');
    setHotelConfirmationNo('');
    setAgreementNo('');
    setSupplierVoucher('');
    setShowForm(true);
    toast.success(`Cloned from RSV-${res.id} — modify details and save`);
  };

  // Booking Templates handlers
  const handleSaveTemplate = (name: string) => {
    if (!hotelId) { toast.warning('Select a hotel first'); return; }
    const templateRooms: RoomLine[] = rooms.map((rm, rIdx) => ({
      id: `rm_${Date.now()}_${rIdx}`,
      roomType: rm.roomType,
      qty: rm.qty,
      nightlyRates: rm.sellPriceNum,
      buyRate: rm.buyPriceNum,
      mealPlan: rm.mealPlan,
      hasSeparateMealRate: !!rm.hasSeparateMealRate,
      mealRate: rm.mealRateSellNum || 0,
      mealBuyRate: rm.mealRateBuyNum,
      hasExtraBed: !!rm.hasExtraBed,
      extraBedRate: rm.extraBedSellPriceNum || 0,
      extraBedBuyRate: rm.extraBedBuyPriceNum,
      pax: rm.pax,
      view: rm.view,
      hasViewSupplement: !!rm.hasViewSupplement,
      viewSupplementRate: rm.viewSuppSellPriceNum || 0,
      viewSupplementBuyRate: rm.viewSuppBuyPriceNum,
    }));
    const newTemplate: BookingTemplate = {
      id: `tmpl_${Date.now()}`,
      name,
      hotelId,
      clientId,
      supplierId,
      rooms: templateRooms,
      tags: bookingTags.length > 0 ? [...bookingTags] : undefined,
      bookingSource: bookingSource || undefined,
      specialRequests: specialRequests || undefined,
      guestNationality: guestNationality || undefined,
      createdAt: getEgyptTime().toISOString().replace('T', ' ').substring(0, 19),
    };
    const updated = [...bookingTemplates, newTemplate];
    setBookingTemplates(updated);
    saveBookingTemplates(updated);
    toast.success(`Template "${name}" saved`);
  };

  const handleLoadTemplate = (tmpl: BookingTemplate) => {
    resetForm();
    setHotelId(tmpl.hotelId);
    setClientId(tmpl.clientId);
    setSupplierId(tmpl.supplierId);
    if (tmpl.bookingSource) setBookingSource(tmpl.bookingSource);
    if (tmpl.specialRequests) setSpecialRequests(tmpl.specialRequests);
    if (tmpl.guestNationality) setGuestNationality(tmpl.guestNationality);
    if (tmpl.tags) setBookingTags(tmpl.tags);
    if (tmpl.rooms && tmpl.rooms.length > 0) {
      setRooms(tmpl.rooms.map(r => ({
        roomType: r.roomType,
        view: r.view || '',
        mealPlan: r.mealPlan,
        qty: r.qty,
        pax: r.pax,
        buyPriceNum: typeof r.buyRate === 'number' ? r.buyRate : 0,
        sellPriceNum: typeof r.nightlyRates === 'number' ? r.nightlyRates : 0,
        hasSeparateMealRate: r.hasSeparateMealRate,
        mealRateSellNum: r.mealRate || 0,
        mealRateBuyNum: r.mealBuyRate || 0,
        hasExtraBed: r.hasExtraBed,
        extraBedSellPriceNum: r.extraBedRate || 0,
        extraBedBuyPriceNum: r.extraBedBuyRate || 0,
        hasViewSupplement: r.hasViewSupplement,
        viewSuppSellPriceNum: r.viewSupplementRate || 0,
        viewSuppBuyPriceNum: r.viewSupplementBuyRate || 0,
      })));
    }
    setShowForm(true);
    toast.success(`Template "${tmpl.name}" loaded — fill guest name and dates`);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = bookingTemplates.filter(t => t.id !== id);
    setBookingTemplates(updated);
    saveBookingTemplates(updated);
    toast.success('Template deleted');
  };

  const handleUpdateConfirmationSpecs = () => {
    const resObj = reservations.find(r => r.id.toString() === viewingId);
    if (resObj) {
      onSaveReservation({
        ...resObj,
        hotelConfirmationNo: localHotelConf,
        agreementNo: localAgreementNo,
        agreementStatus: localAgreementStatus,
        roomingList: JSON.stringify(localRoomDetails)
      });
      toast.success('Agreement specifications and confirmation reference updated in ledger!');
    }
  };

  const handlePostBookingPayment = (isClientPayment: boolean) => {
    const resObj = reservations.find(r => r.id.toString() === viewingId);
    if (!resObj) return;

    let computedAmount = payAmount;
    if (payCurrency === 'EGP') {
      computedAmount = payOriginalAmount / payExchangeRate;
      if (!computedAmount || computedAmount <= 0) {
        toast.error('Exchange rate and EGP amount must be valid.');
        return;
      }
    }

    if (!computedAmount || computedAmount <= 0) {
      toast.error('Please specify a positive valid payment amount.');
      return;
    }
    if (!payAccountId) {
      toast.error('Please choose an active treasury account / bank account safe.');
      return;
    }

    const trType = isClientPayment ? 'ClientPayment' : 'SupplierPayment';
    const targetAgentId = isClientPayment ? resObj.clientId : resObj.supplierId;
    const agentObj = agents.find(a => a.id === targetAgentId);
    if (!agentObj && !targetAgentId?.startsWith('DIRECT_')) {
      toast.error('Associated agent account not located!');
      return;
    }

    // Overpayment detection
    const { totalSell, totalBuy } = getReservationTotals(resObj);
    const currentPaid = isClientPayment ? (resObj.amountPaidByClient || 0) : (resObj.amountPaidToSupplier || 0);
    const totalOwed = isClientPayment ? totalSell : totalBuy;
    const willBePaid = currentPaid + computedAmount;
    let isOverpayment = false;
    let overpaymentAmount = 0;
    if (willBePaid > totalOwed && totalOwed > 0) {
      overpaymentAmount = willBePaid - totalOwed;
      isOverpayment = true;
    }

    const executePayment = () => {
      const trDate = new Date().toISOString().split('T')[0];
      const newTr: Transaction = {
        id: `tr_${trType.toLowerCase()}_rsv_${resObj.id}_${Date.now()}`,
        docNo: getNextDocNo('DOC', transactions || []),
        date: trDate,
        type: trType,
        amount: computedAmount,
        fromAccountId: payAccountId,
        agentId: targetAgentId,
        reservationId: resObj.id.toString(),
        description: isClientPayment 
          ? `Automatic Reservation Client Payment for RSV-${resObj.id} (Guest: ${resObj.guestName})${isOverpayment ? ` [OVERPAYMENT: ${overpaymentAmount.toLocaleString()} SAR]` : ''}`
          : `Automatic Reservation Supplier Payment for RSV-${resObj.id} (Hotel: ${hotels.find(h => h.id === resObj.hotelId)?.name})${isOverpayment ? ` [OVERPAYMENT: ${overpaymentAmount.toLocaleString()} SAR]` : ''}`,
        paymentMethod: payMethod,
        voucherNo: payVoucher || getNextVoucherNo(payDirection === 'client' ? 'REC' : 'PAY', transactions || []),
        originalCurrency: payCurrency,
        originalAmount: payCurrency === 'EGP' ? payOriginalAmount : undefined,
        exchangeRate: payCurrency === 'EGP' ? payExchangeRate : undefined,
        createdBy: currentUser || 'Hazem'
      };

      const updatedRes: Reservation = {
        ...resObj,
        amountPaidByClient: isClientPayment 
          ? (resObj.amountPaidByClient || 0) + computedAmount
          : (resObj.amountPaidByClient || 0),
        amountPaidToSupplier: !isClientPayment
          ? (resObj.amountPaidToSupplier || 0) + computedAmount
          : (resObj.amountPaidToSupplier || 0)
      };

      if (onSaveTransaction) { onSaveTransaction(newTr); }
      onSaveReservation(updatedRes);
      if (onLogAudit) {
        onLogAudit({
          user: currentUser,
          action: isClientPayment ? 'Client Payment' : 'Supplier Payment',
          entityType: 'Reservation',
          entityId: resObj.id.toString(),
          detail: `${isClientPayment ? 'Client receipt' : 'Supplier payment'} of ${computedAmount.toLocaleString()} SAR via ${payMethod} (Voucher: ${newTr.voucherNo})`,
        });
      }
      toast.success(`${isClientPayment ? 'Client Receipt' : 'Supplier Payment'} of ${computedAmount.toLocaleString()} SAR registered & transaction #${newTr.voucherNo} saved!`);
      setPayVoucher(getNextVoucherNo(isClientPayment ? 'REC' : 'PAY', transactions || []));
    };

    if (isOverpayment) {
      openConfirm('Overpayment Warning', `This payment of ${computedAmount.toLocaleString()} SAR exceeds what ${isClientPayment ? 'the client owes' : 'the supplier is owed'} by ${overpaymentAmount.toLocaleString()} SAR.\n\nTotal owed: ${totalOwed.toLocaleString()} SAR\nAlready paid: ${currentPaid.toLocaleString()} SAR\nOverpayment: ${overpaymentAmount.toLocaleString()} SAR\n\nThe overpayment will be tracked as credit. Continue?`, executePayment);
      return;
    }
    executePayment();
  };

  // Filter application blocks
  const filteredReservations = reservations.filter(res => {
    const client = agents.find(a => a.id === res.clientId);
    const supplier = agents.find(a => a.id === res.supplierId);
    const hotel = hotels.find(h => h.id === res.hotelId);
    
    // Smart search: if search is a pure number or RSV-XXXX, show ONLY that exact reservation
    const cleanSearch = searchTerm.trim();
    const isExactIdSearch = /^\d+$/.test(cleanSearch) || /^RSV-?\d+$/i.test(cleanSearch);
    
    let matchesSearch = true;
    if (cleanSearch) {
      if (isExactIdSearch) {
        const idNum = cleanSearch.replace(/[^0-9]/g, '');
        matchesSearch = res.id.toString() === idNum;
      } else {
        matchesSearch = res.guestName.toLowerCase().includes(cleanSearch.toLowerCase()) || 
                        (client && (client.name.toLowerCase().includes(cleanSearch.toLowerCase()) || (client.companyName || '').toLowerCase().includes(cleanSearch.toLowerCase()))) ||
                        (supplier && supplier.name.toLowerCase().includes(cleanSearch.toLowerCase())) ||
                        (hotel && hotel.name.toLowerCase().includes(cleanSearch.toLowerCase())) ||
                        res.id.toString().includes(cleanSearch) ||
                        res.checkIn.includes(cleanSearch) ||
                        res.checkOut.includes(cleanSearch) ||
                        (res.hotelConfirmationNo || '').toLowerCase().includes(cleanSearch.toLowerCase());
      }
    }
    
    let matchesCustom = true;
    const todayStr = getEgyptTime().toISOString().split('T')[0];
    if (filterCustom === 'bookings-today') {
      matchesCustom = res.createdAt.startsWith(todayStr);
    } else if (filterCustom === 'checkin-today') {
      matchesCustom = res.checkIn === todayStr;
    } else if (filterCustom === 'inhouse') {
      matchesCustom = res.status === 'Confirmed' && res.checkIn <= todayStr && res.checkOut > todayStr;
    } else if (filterCustom === 'expiring-options') {
      matchesCustom = res.status === 'Tentative' && 
                      (res.clientOptionDate === todayStr || res.supplierOptionDate === todayStr);
    }

    const matchesAgent = !filterAgentId || res.clientId === filterAgentId;
    const matchesSupplier = !filterSupplierId || res.supplierId === filterSupplierId;
    const matchesStatus = !filterStatus || res.status === filterStatus;
    const matchesDate = !filterDate || res.checkIn === filterDate || res.checkOut === filterDate || res.clientOptionDate === filterDate;

    return matchesSearch && matchesAgent && matchesSupplier && matchesStatus && matchesDate && matchesCustom;
  });

  const sortedReservations = [...filteredReservations].sort((a, b) => {
    if (filterSort === 'Newest') return b.id - a.id;
    if (filterSort === 'Oldest') return a.id - b.id;
    if (filterSort === 'Check-In (Up)') return new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
    if (filterSort === 'Check-In (Down)') return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
    return 0;
  });

  // sortedReservations is the full paginated window (filtered + sorted)
  // No client-side pagination — uses Firestore cursor-based "Load More" instead

  const handleExportCSV = () => {
    const spMap = new Map(salesPersons.map(sp => [sp.id, sp.name]));
    const reportData = filteredReservations.map(res => {
      const h = hotels.find(ht => ht.id === res.hotelId);
      const c = agents.find(ac => ac.id === res.clientId);
      const s = agents.find(as => as.id === res.supplierId);
      const totals = getReservationTotals(res);
      return {
        'RSV ID': `RSV-${res.id}`,
        'Check In': res.checkIn,
        'Check Out': res.checkOut,
        'Nights': res.nights,
        'Hotel': h?.name || '',
        'Client': c?.name || '',
        'Supplier': s?.name || '',
        'Guest Name': res.guestName,
        'Status': res.status,
        'Booking Date': res.createdAt?.split(' ')[0] || '',
        'Total Buy': totals.totalBuy,
        'Total Sell': totals.totalSell,
        'Profit': totals.profit,
        'Markup %': `${totals.markupPct.toFixed(1)}%`,
        'Client Paid': res.amountPaidByClient || 0,
        'Outstanding': Math.max(totals.totalSell - (res.amountPaidByClient || 0), 0)
      };
    });
    exportToCSV('reservations-export.csv', reportData);
  };

  const handleExportFullReport = () => {
    const spMap = new Map(salesPersons.map(sp => [sp.id, sp.name]));
    const rows: object[] = [];
    filteredReservations.forEach(res => {
      const h = hotels.find(ht => ht.id === res.hotelId);
      const c = agents.find(ac => ac.id === res.clientId);
      const s = agents.find(as => as.id === res.supplierId);
      const totals = getReservationTotals(res);
      // One row per room line with full booking context
      res.rooms.forEach((rm, rmIdx) => {
        const buyRate = typeof rm.buyRate === 'number' ? rm.buyRate : 0;
        const sellRate = typeof rm.nightlyRates === 'number' ? rm.nightlyRates : 0;
        rows.push({
          'RSV ID': `RSV-${res.id}`,
          'Guest Name': res.guestName,
          'Nationality': res.guestNationality,
          'Status': res.status,
          'Check In': res.checkIn,
          'Check Out': res.checkOut,
          'Nights': res.nights,
          'Hotel': h?.name || '',
          'City': h?.city || '',
          'Client': c?.name || c?.companyName || '',
          'Supplier': s?.name || '',
          'Room #': rmIdx + 1,
          'Room Type': rm.roomType,
          'View': rm.view || '',
          'Meal Plan': rm.mealPlan,
          'Qty': rm.qty,
          'Pax': rm.pax,
          'Buy Rate/Night': buyRate,
          'Sell Rate/Night': sellRate,
          'Has Weekend Rate': rm.nightlyRates && typeof rm.nightlyRates !== 'number' ? 'Yes' : 'No',
          'Has Extra Bed': rm.hasExtraBed ? 'Yes' : 'No',
          'Total Buy': totals.totalBuy,
          'Total Sell': totals.totalSell,
          'Profit': totals.profit,
          'Paid by Client': res.amountPaidByClient || 0,
          'Paid to Supplier': res.amountPaidToSupplier || 0,
          'Client Outstanding': Math.max(0, totals.totalSell - (res.amountPaidByClient || 0)),
          'Supplier Outstanding': Math.max(0, totals.totalBuy - (res.amountPaidToSupplier || 0)),
          'Cancel Reason': res.cancellationReason || '',
          'Cancel Fee': res.cancellationFee || 0,
          'Hotel Conf#': res.hotelConfirmationNo || '',
          'Booking Date': res.createdAt?.split(' ')[0] || '',
          'Created By': res.createdBy || '',
          'Booking Source': res.bookingSource || '',
          'Sales Person': spMap.get(res.salesPersonId || '') || '',
          'Tags': (res.tags || []).join(', '),
          'Supplier Due Date': res.supplierDueDate || '',
          'Special Requests': res.specialRequests || ''
        });
      });
    });
    exportToCSV('reservations-full-report.csv', rows);
  };

  const handleExportExcel = () => {
    const spMap = new Map(salesPersons.map(sp => [sp.id, sp.name]));
    const reportData = filteredReservations.map(res => {
      const h = hotels.find(ht => ht.id === res.hotelId);
      const c = agents.find(ac => ac.id === res.clientId);
      const s = agents.find(as => as.id === res.supplierId);
      const totals = getReservationTotals(res);
      return {
        'RSV #': res.id,
        'Status': res.status,
        'Guest Name': res.guestName,
        'Nationality': res.guestNationality || '',
        'Hotel': h?.name || '',
        'Client': c?.companyName || c?.name || '',
        'Supplier': s?.companyName || s?.name || '',
        'Check In': res.checkIn,
        'Check Out': res.checkOut,
        'Nights': res.nights,
        'Rooms': res.rooms.map(r => `${r.qty}x ${r.roomType} ${r.mealPlan}`).join(', '),
        'Confirmation #': res.hotelConfirmationNo || '',
        'Agreement #': res.agreementNo || '',
        'Total Sell (SAR)': totals.totalSell,
        'Total Buy (SAR)': totals.totalBuy,
        'Profit (SAR)': totals.profit,
        'Client Paid': res.amountPaidByClient || 0,
        'Outstanding': Math.max(totals.totalSell - (res.amountPaidByClient || 0), 0),
        'Non-Refundable': res.nonRefundable ? 'Yes' : 'No',
        'Sales Person': spMap.get(res.salesPersonId || '') || '',
        'Created By': res.createdBy || '',
        'Booking Date': res.createdAt?.split(' ')[0] || '',
        'Tags': (res.tags || []).join(', '),
      };
    });
    exportToExcel(`Reservations ${new Date().toISOString().split('T')[0]}.xlsx`, reportData, 'Reservations');
    toast.success('Excel exported successfully');
  };

  const [printingRoomingList, setPrintingRoomingList] = useState<Reservation | null>(null);

  return (
    <div className="space-y-6 text-xs">
      
      {/* Draft recovery banner */}
      {showDraftBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span className="text-sm font-semibold text-amber-800">You have an unsaved reservation draft. Resume where you left off?</span>
          </div>
          <div className="flex gap-2">
            <button onClick={resumeDraft} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition cursor-pointer min-h-[44px]">Resume Draft</button>
            <button onClick={() => { clearDraft('reservation_form'); setShowDraftBanner(false); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer min-h-[44px]">Discard</button>
          </div>
        </div>
      )}

      {/* Upper hidden area for printing rooming list */}
      {printingRoomingList && (
        <div className="fixed inset-0 bg-white z-[9999] overflow-y-auto block print:block pb-16">
          <div className="flex justify-between items-center p-4 bg-slate-100 border-b border-slate-200 print:hidden text-xs">
            <h2 className="font-bold text-slate-800">{t('res.printRoomingList')}</h2>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="bg-indigo-650 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded shadow transition">{t('res.printList')}</button>
              <button onClick={() => setPrintingRoomingList(null)} className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded transition">{t('res.closeEsc')}</button>
            </div>
          </div>
          
          <div id="rooming-list-pdf" className="bg-white p-8 max-w-4xl mx-auto my-8 print:my-0 shadow-sm print:shadow-none text-slate-900 font-sans border border-slate-200 print:border-none">
            <div className="flex justify-between items-center mb-2 border-b-[3px] border-slate-300 pb-2 gap-4">
              <div className="flex flex-col text-left font-sans gap-1 flex-1">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
                  ZUMRA HOTELS
                </span>
                <span className="text-2xl font-bold text-slate-800 tracking-wider font-serif" dir="rtl">
                  زمرة للفنادق
                </span>
              </div>
              <div className="flex-shrink-0">
                <ZumraLogo size="xxl" />
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-4 border-b border-slate-900 pb-1">
              <h2 className="text-[20px] font-extrabold tracking-tight">{t('res.roomingListTitle')}</h2>
              <h2 className="text-[22px] font-extrabold" dir="rtl">تسكين الغرفة</h2>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-[13px] font-medium mb-6">
              <div className="flex">
                <span className="w-32 font-bold">{t('res.id')} :</span>
                <span>{printingRoomingList.id}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">{t('res.hotel')} :</span>
                <span>{hotels.find(h => h.id === printingRoomingList.hotelId)?.name}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">{t('res.arrivalDate')} :</span>
                <span>{new Date(printingRoomingList.checkIn).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">{t('res.departureDate')} :</span>
                <span>{new Date(printingRoomingList.checkOut).toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            <table className="w-full text-left text-[12px] border-collapse" style={{ border: '1px solid #1e293b' }}>
              <thead>
                <tr className="bg-slate-100/50">
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>{t('res.roomType')}</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>{t('res.mealPlan')}</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>{t('res.guestName')}</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>{t('res.confNo')}</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>{t('res.roomNo')}</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>{t('res.remarks')}</th>
                </tr>
              </thead>
              <tbody>
                {printingRoomingList.rooms && printingRoomingList.rooms.length > 0 ? (
                  (() => {
                    let parsedRoomDetails: {name: string, confNo: string}[] = [];
                    try {
                      if (printingRoomingList.roomingList && printingRoomingList.roomingList.startsWith('[')) {
                        parsedRoomDetails = JSON.parse(printingRoomingList.roomingList);
                      }
                    } catch(e) {}
                    
                    let roomCounter = 0;
                    return printingRoomingList.rooms.flatMap((rm, idx) => {
                      const rows = [];
                      for (let i = 0; i < rm.qty; i++) {
                        const rDetails = parsedRoomDetails[roomCounter] || { name: i === 0 ? printingRoomingList.guestName : '', confNo: printingRoomingList.hotelConfirmationNo || '' };
                        roomCounter++;
                        rows.push(
                          <tr key={`${idx}-${i}`}>
                            <td className="p-1.5" style={{ border: '1px solid #1e293b' }}>{rm.roomType} {rm.view ? `- ${rm.view}` : ''}</td>
                            <td className="p-1.5" style={{ border: '1px solid #1e293b' }}>{rm.mealPlan}</td>
                            <td className="p-1.5 font-semibold" style={{ border: '1px solid #1e293b' }}>{rDetails.name || (i === 0 ? printingRoomingList.guestName : '')}</td>
                            <td className="p-1.5" style={{ border: '1px solid #1e293b' }}>{rDetails.confNo || printingRoomingList.hotelConfirmationNo || ''}</td>
                            <td className="p-1.5" style={{ border: '1px solid #1e293b' }}></td>
                            <td className="p-1.5 text-[11px]" style={{ border: '1px solid #1e293b' }}>{rm.hasExtraBed ? t('res.extraBedLabel') : ''}</td>
                          </tr>
                        );
                      }
                      return rows;
                    });
                  })()
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center" style={{ border: '1px solid #1e293b' }}>
                      {t('res.noRoomsAllocated')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            <div className="mt-8 text-[11px] text-slate-500">
              {printingRoomingList.guestName} - {getEgyptTime().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">{t('res.title')}</h2>
              <p className="text-[10px] text-slate-450 mt-0.5">{t('res.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Tooltip label="Export all reservation data with full details" position="bottom">
              <button
                onClick={handleExportFullReport}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-emerald-200"
              >
                📊 Export Full Report
              </button>
              </Tooltip>
              {onNavigate && (
                <>
                  <Tooltip label="View arrival report for upcoming check-ins" position="bottom">
                  <button
                    onClick={() => onNavigate('Reports', { reportTab: 'arrival' })}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-blue-200"
                  >
                    🛫 Arrivals
                  </button>
                  </Tooltip>
                  <Tooltip label="View cancellation report for cancelled bookings" position="bottom">
                  <button
                    onClick={() => onNavigate('Reports', { reportTab: 'cancellation' })}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-rose-200"
                  >
                    ❌ Cancellations
                  </button>
                  </Tooltip>
                </>
              )}
              <Tooltip label="Export data in Excel (.xlsx) format" position="bottom">
              <button
                onClick={handleExportExcel}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-emerald-200"
              >
                📊 Excel
              </button>
              </Tooltip>
              <Tooltip label="Export filtered data as CSV file" position="bottom">
              <button
                onClick={handleExportCSV}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-indigo-200"
              >
                 ⬇️ {t('res.exportCSV')}
              </button>
              </Tooltip>
              <Tooltip label="Create a new reservation" position="bottom">
              <button
                onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5"
            >
               ➕ {t('res.newReservation')}
            </button>
            </Tooltip>
            <Tooltip label="Manage booking templates for quick creation" position="bottom">
            <button
              onClick={() => setShowTemplates(true)}
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-purple-200"
            >
              📋 Templates
            </button>
            </Tooltip>
          </div>
        </div>

          {/* Filtering row */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('common.search')}</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('res.searchPlaceholder')}
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.checkIn')}</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-white px-2 py-1.5 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.client')}</label>
              <select
                value={filterAgentId}
                onChange={(e) => setFilterAgentId(e.target.value)}
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs"
              >
                <option value="">{t('res.allClients')}</option>
                {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => (
                  <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('common.status')}</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs"
              >
                <option value="">-- {t('dash.allStatuses')} --</option>
                <option value="Tentative">{t('res.tentative')}</option>
                <option value="Confirmed">{t('res.confirmed')}</option>
                <option value="Cancelled">{t('res.cancelled')}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.sortBy')}</label>
              <select
                value={filterSort}
                onChange={(e) => setFilterSort(e.target.value)}
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs font-bold"
              >
                <option value="Newest">{t('res.sortNewest')}</option>
                <option value="Oldest">{t('res.sortOldest')}</option>
                <option value="Check-In (Up)">{t('res.sortCheckInUp')}</option>
                <option value="Check-In (Down)">{t('res.sortCheckInDown')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Form content or Table list view */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-[24px] p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 leading-relaxed text-xs max-w-6xl mx-auto">
          
          {/* Form Header */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">🏨</span>
              {editingId ? `${t('res.editBooking')} RSV-${editingId}` : t('res.newReservation')}
              {/* Draft saved indicator */}
              {showForm && !editingId && draftSavedAt && (
                <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 ml-2">
                  Draft saved {draftSavedAt}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {/* Payment Status Indicator (only in edit mode) */}
              {editingId && (() => {
                const totalSell = rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'sell'), 0);
                const paid = amountPaidByClient || 0;
                const pct = totalSell > 0 ? Math.round((paid / totalSell) * 100) : 0;
                let statusLabel = 'Not Paid';
                let statusColor = 'bg-rose-100 text-rose-700 border-rose-200';
                if (pct >= 100) {
                  statusLabel = 'Paid';
                  statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                } else if (pct > 0) {
                  statusLabel = `Partially Paid (${pct}%)`;
                  statusColor = 'bg-amber-100 text-amber-700 border-amber-200';
                }
                return (
                  <span className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-xl border ${statusColor}`}>
                    {statusLabel}
                  </span>
                );
              })()}
              {/* Live Pricing Summary Badge */}
              {selectedHotelObj && checkIn && checkOut && (
                <div className="flex items-center gap-4 text-[10px] bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500">{t('res.nights')}: <strong className="text-slate-800">{calculateNightsCount()}</strong></span>
                                  <span className="text-red-600">{t('res.cost')}: <strong className="font-mono">{rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'buy'), 0).toLocaleString()}</strong></span>
                                  <span className="text-emerald-700">{t('res.sell')}: <strong className="font-mono">{rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'sell'), 0).toLocaleString()}</strong></span>
                                  <span className="text-amber-700">{t('res.profit')}: <strong className="font-mono">{rooms.reduce((acc, rm) => acc + (roomFullTotal(rm, 'sell') - roomFullTotal(rm, 'buy')), 0).toLocaleString()}</strong></span>
                </div>
              )}
              {/* Print Action Menu (only in edit mode) */}
              {editingId && (
                <div className="relative">
                  <Tooltip label="Generate confirmation PDF documents" position="bottom">
                  <button
                    type="button"
                    onClick={() => setPrintMenuOpen(!printMenuOpen)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-2 rounded-xl transition border border-indigo-200 flex items-center gap-1"
                  >
                    🖨️ Confirmation <span className="text-[8px]">▼</span>
                  </button>
                  </Tooltip>
                  {printMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[160px] py-1 animate-fade-in">
                      <button
                        type="button"
                        onClick={() => {
                          const editingRes = reservations.find(r => r.id.toString() === editingId);
                          if (editingRes) setPrintingDoc({ res: editingRes, isVoucher: false });
                          setPrintMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                      >
                        📄 Print Confirmation
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const editingRes = reservations.find(r => r.id.toString() === editingId);
                          if (editingRes) setPrintingDoc({ res: editingRes, isVoucher: true });
                          setPrintMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                      >
                        🎟️ Print Voucher
                      </button>
                      <div className="border-t border-slate-100 my-1"></div>
                      <button
                        type="button"
                        onClick={async () => {
                          const editingRes = reservations.find(r => r.id.toString() === editingId);
                          if (!editingRes) return;
                          setPrintMenuOpen(false);
                          // Print Confirmation first
                          setPrintingDoc({ res: editingRes, isVoucher: false });
                          await new Promise(r => setTimeout(r, 2000));
                          // Then Voucher
                          setPrintingDoc({ res: editingRes, isVoucher: true });
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 transition"
                      >
                        📦 Print All (Conf + Voucher)
                      </button>
                      <div className="border-t border-slate-100 my-1"></div>
                      {(['ClientCredit', 'ClientDebit', 'SupplierCredit', 'SupplierDebit'] as const).map(type => {
                        const isCredit = type.includes('Credit');
                        const isClient = type.includes('Client');
                        const label = `${isCredit ? '↩️' : '↗️'} ${isClient ? 'Client' : 'Supplier'} ${isCredit ? 'Credit' : 'Debit'} Note`;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const editingRes = reservations.find(r => r.id.toString() === editingId);
                              if (!editingRes) return;
                              const amountStr = prompt(`${label}\nEnter amount (SAR):`);
                              if (!amountStr) return;
                              const amount = parseFloat(amountStr);
                              if (isNaN(amount) || amount <= 0) { toast.warning('Invalid amount'); return; }
                              const reason = prompt('Enter reason:') || '';
                              const docNo = `CN-${new Date().getFullYear()}-${String(creditNotes.length + 1).padStart(4, '0')}`;
                              const entry: CreditNoteEntry = {
                                id: `cn_${Date.now()}`,
                                reservationId: editingRes.id,
                                type,
                                amount,
                                reason,
                                docNo,
                                createdBy: currentUser,
                                createdAt: getEgyptTime().toISOString().replace('T', ' ').substring(0, 19),
                              };
                              const updated = [...creditNotes, entry];
                              setCreditNotes(updated);
                              saveCreditNotes(updated);
                              setCreditNoteEntry(entry);
                              setPrintMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-[10px] font-medium ${isCredit ? 'text-emerald-700 hover:bg-emerald-50' : 'text-rose-700 hover:bg-rose-50'} transition`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <button type="button" onClick={resetForm} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-xl transition shadow-sm">{t('common.close')}</button>
            </div>
          </div>

          {/* Section 1: Booking Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="text-amber-600">●</span> {t('res.bookingAssignment')}
            </h4>

            {/* Allotment Selection */}
            {allotments.length > 0 && (
              <div className="mb-4 bg-indigo-50/50 border border-indigo-200 rounded-xl p-3">
                <label className="text-[10px] uppercase font-bold text-indigo-700 block mb-1">Book from Allotment (optional)</label>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <select value={selectedAllotmentId} onChange={(e) => handleSelectAllotment(e.target.value)} className="w-full px-3 py-2.5 border border-indigo-200 rounded-xl text-sm font-medium bg-white focus:border-indigo-500 transition-colors">
                      <option value="">-- No allotment (manual entry) --</option>
                      {allotments.map(a => {
                        const hotel = hotels.find(h => h.id === a.hotelId);
                        const supplier = agents.find(ag => ag.id === a.supplierId);
                        return <option key={a.id} value={a.id}>{hotel?.name} | {a.roomType} | {supplier?.name || 'N/A'} | {a.startDate} to {a.endDate}{a.ratePeriods?.length ? ` | ${a.ratePeriods.length} rate${a.ratePeriods.length > 1 ? 's' : ''}` : ''}</option>;
                      })}
                    </select>
                  </div>
                  {selectedAllotment && checkIn && checkOut && (() => {
                    const avail = getAllotmentAvailability(selectedAllotment);
                    return (
                      <div className={`text-[10px] font-bold px-3 py-2 rounded-lg ${avail.available > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {avail.available > 0 ? `✓ ${avail.message}` : `✗ No availability for selected dates`}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.customerAgent')}</label>
                <SmartSelect
                  options={agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => ({
                    id: a.id,
                    label: a.companyName || a.name,
                    number: a.agentNumber,
                    badge: a.type === 'Both' ? 'Customer + Supplier' : undefined,
                    warning: a.clientStatus === 'Suspended' ? '⚠️ Suspended' : a.clientStatus === 'Blacklisted' ? '⛔ Blacklisted' : undefined,
                  }))}
                  value={clientId || null}
                  onChange={(id) => setClientId(id || '')}
                  placeholder="Enter Agent Name"
                  required
                  clearable
                />
                {clientId && (() => {
                  const selectedClient = agents.find(a => a.id === clientId);
                  if (selectedClient?.clientStatus === 'Suspended') {
                    return <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded mt-1">⚠️ This client is Suspended - proceed with caution</p>;
                  }
                  if (selectedClient?.clientStatus === 'Blacklisted') {
                    return <p className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded mt-1">⛔ This client is Blacklisted - booking not recommended</p>;
                  }
                  return null;
                })()}
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.supplier')}</label>
                <SmartSelect
                  options={agents.filter(a => a.type === 'Supplier' || a.type === 'Both').map(a => ({
                    id: a.id,
                    label: a.name,
                    number: a.agentNumber,
                  }))}
                  topOptions={[{ id: 'DIRECT', label: '🏨 Direct from Hotel (no supplier)', badge: 'DIRECT' }]}
                  value={supplierId || null}
                  onChange={(id) => { if (!isSupplierLocked) setSupplierId(id || ''); }}
                  placeholder={isSupplierLocked ? 'Locked: Direct inventory' : 'Enter Suppliers name'}
                  required
                  clearable={!isSupplierLocked}
                  disabled={isSupplierLocked}
                />
                {isSupplierLocked && (
                  <p className="text-[9px] text-indigo-700 font-bold mt-1 bg-indigo-50 px-2 py-1 rounded">🔒 Supplier locked: Direct inventory from allotment</p>
                )}
                {supplierId === 'DIRECT' && !isSupplierLocked && hotelId && (
                  <p className="text-[9px] text-amber-700 font-bold mt-1 bg-amber-50 px-2 py-1 rounded">🏨 Booking directly from: {hotels.find(h => h.id === hotelId)?.name}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.destinationHotel')}</label>
                <SmartSelect
                  options={hotels.map(h => ({
                    id: h.id,
                    label: h.name,
                    sublabel: h.nameAr,
                    number: h.hotelNumber,
                    badge: `${h.city === 'Makkah' ? '🕋' : h.city === 'Madinah' ? '🕌' : '📍'} ${h.city} ${'★'.repeat(h.stars)}`,
                  }))}
                  value={hotelId || null}
                  onChange={(id) => {
                    const eid = id || '';
                    setHotelId(eid);
                    const matchedH = hotels.find(h => h.id === eid);
                    if (matchedH) {
                      setRooms([{ roomType: matchedH.roomTypes[0] || 'Double', view: matchedH.views[0] || 'City View', mealPlan: matchedH.mealPlans[0] || 'B.B', qty: 1, pax: getPaxForRoomType(matchedH.roomTypes[0] || 'Double'), buyPriceNum: 100, sellPriceNum: 150 }]);
                    }
                  }}
                  placeholder="Enter Hotel Name"
                  required
                  clearable
                  maxResults={30}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">📅 Check-In</label>
                <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full bg-slate-50 font-mono px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" required />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">📅 Check-Out {checkIn && checkOut && <span className="text-emerald-600 font-extrabold ml-1">({calculateNightsCount()} nights)</span>}</label>
                <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full bg-slate-50 font-mono px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" required />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.leadGuest')}</label>
                <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Enter Guest Name" className="w-full bg-slate-50 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:bg-white transition-colors" required />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.nationality')}</label>
                <input type="text" list="nationalities" value={guestNationality} onChange={(e) => setGuestNationality(e.target.value)} placeholder="Saudi" className="w-full bg-slate-50 px-3 py-2.5 border border-slate-200 rounded-xl text-sm uppercase focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.statusLabel')}</label>
                <div className="inline-flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                  {(['Tentative', 'Confirmed', 'Cancelled'] as const).map(s => {
                    const abbr = s === 'Tentative' ? 'Tent' : s === 'Confirmed' ? 'Def' : 'Cncl';
                    return (
                    <button key={s} type="button" onClick={() => {
                      const applyStatus = () => {
                        setStatus(s);
                        if (s !== 'Cancelled') { setCancellationFee(0); setCancellationReason(''); }
                        else { setCancellationReason('Customer requested cancellation'); }
                        if (s === 'Confirmed') { setClientOptionDate(''); setSupplierOptionDate(''); }
                      };
                      if (s === 'Cancelled' && status !== 'Cancelled') {
                        setCancelWizardRes({
                          id: editingId ? parseInt(editingId) : 0, checkIn, checkOut, nights: calculateNightsCount(),
                          clientId, hotelId, guestName, guestNationality, supplierId,
                          rooms: rooms.map((rm, idx) => ({ id: `room_${idx}`, roomType: rm.roomType, qty: rm.qty, nightlyRates: rm.sellPriceNum, buyRate: rm.buyPriceNum, mealPlan: rm.mealPlan, hasSeparateMealRate: false, mealRate: 0, pax: rm.pax, view: rm.view })),
                          status: 'Tentative', amountPaidByClient, amountPaidToSupplier, createdBy: currentUser, createdAt: '',
                        });
                        return;
                      }
                      if (s === 'Confirmed' && status !== 'Confirmed') {
                        const formTotalSell = rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'sell'), 0);
                        if (amountPaidByClient < formTotalSell && formTotalSell > 0) {
                          const owed = formTotalSell - amountPaidByClient;
                          openConfirm('Unpaid Balance', `Client has not fully paid yet.\n\nPaid: ${amountPaidByClient.toLocaleString()} SAR\nTotal: ${formTotalSell.toLocaleString()} SAR\nOutstanding: ${owed.toLocaleString()} SAR\n\nConfirm this booking anyway?`, applyStatus);
                          return;
                        }
                      }
                      applyStatus();
                    }} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center gap-0.5 whitespace-nowrap ${status === s ? s === 'Confirmed' ? 'bg-emerald-600 text-white shadow-sm' : s === 'Cancelled' ? 'bg-rose-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}>
                      <span className="text-[9px] leading-none">{s === 'Tentative' ? '⏳' : s === 'Confirmed' ? '✅' : '❌'}</span>
                      <span>{abbr}</span>
                    </button>
                  );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Room Configuration */}
          {selectedHotelObj && (
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
              {/* Header + Summary Bar */}
              <div className="flex flex-wrap justify-between items-center mb-3 border-b border-slate-100 pb-3 gap-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2">
                  <span className="text-amber-600">●</span> {t('res.roomConfig')}
                </h4>
                <button type="button" onClick={handleAddRoomRow} className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1">+ {t('res.addRoomLine')}</button>
              </div>

              {/* Room Summary Bar */}
              {(() => {
                const totalRooms = rooms.reduce((s, rm) => s + rm.qty, 0);
                const totalBuy = rooms.reduce((s, rm) => s + roomFullTotal(rm, 'buy'), 0);
                const totalSell = rooms.reduce((s, rm) => s + roomFullTotal(rm, 'sell'), 0);
                const commissionAmount = salesPersonId && spCommissionRate > 0 ? Math.round(spCommissionRate * totalRooms * calculateNightsCount()) : 0;
                // Supplier commission: markup % on buy price (only for third-party suppliers)
                const supplierCommission = (() => {
                  if (!supplierId || supplierId === 'DIRECT') return 0;
                  const sup = agents.find(a => a.id === supplierId);
                  return sup?.supplierMarkupRate ? Math.round((totalBuy * sup.supplierMarkupRate!) / 100) : 0;
                })();
                const totalProfit = totalSell - totalBuy;
                const netProfit = totalProfit - commissionAmount - supplierCommission;
                const marginPercent = totalSell > 0 ? ((netProfit) / totalSell * 100) : 0;
                const marginThreshold = loadMarginThreshold();
                const marginColor = marginPercent >= marginThreshold ? 'text-emerald-600' : marginPercent >= 5 ? 'text-amber-600' : 'text-rose-600';
                
                // Check for blackout periods
                const activeBlackout = blackoutPeriods.find(bp => 
                  checkIn && checkOut && bp.startDate <= checkOut && bp.endDate >= checkIn &&
                  (!bp.affectedHotels || bp.affectedHotels.length === 0 || bp.affectedHotels.includes(hotelId))
                );
                
                // Check overbooking
                const roomTypes = [...new Set(rooms.map(rm => rm.roomType))];
                const overbookingWarnings = roomTypes.map(rt => {
                  if (!hotelId || !checkIn || !checkOut) return null;
                  return checkAllotmentCapacity(hotelId, rt, checkIn, checkOut, allotments, reservations, editingId ? parseInt(editingId) : undefined);
                }).filter(w => w && !w.available && w.remaining !== -1);
                
                // Check credit limit
                const selectedAgent = agents.find(a => a.id === clientId);
                const creditWarning = selectedAgent?.creditLimit && selectedAgent.creditLimit > 0
                  ? { balance: Math.abs(selectedAgent.balance) + totalSell, limit: selectedAgent.creditLimit }
                  : null;
                
                return (
                  <>
                    <div className="flex flex-wrap gap-3 mb-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200 text-[10px] font-bold">
                      <span className="text-slate-600">Rooms: <span className="text-slate-900">{totalRooms}</span></span>
                      <span className="text-red-500">Buy: <span className="font-mono">{totalBuy.toLocaleString()}</span></span>
                      <span className="text-emerald-600">Sell: <span className="font-mono">{totalSell.toLocaleString()}</span></span>
                      <span className={totalProfit >= 0 ? 'text-amber-700' : 'text-rose-600'}>Gross: <span className="font-mono font-extrabold">{totalProfit.toLocaleString()}</span></span>
                      {commissionAmount > 0 && (
                        <span className="text-purple-600">SP Commission ({spCommissionRate} SAR/rm/nt): <span className="font-mono font-bold">-{commissionAmount.toLocaleString()}</span></span>
                      )}
                      {supplierCommission > 0 && (
                        <span className="text-orange-600">Supplier Commission: <span className="font-mono font-bold">-{supplierCommission.toLocaleString()}</span></span>
                      )}
                      {(commissionAmount > 0 || supplierCommission > 0) && (
                        <span className={netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>Net Profit: <span className="font-mono font-black">{netProfit.toLocaleString()}</span></span>
                      )}
                      <span className={marginColor}>Margin: <span className="font-mono font-extrabold">{marginPercent.toFixed(1)}%</span></span>
                    </div>
                    
                    {/* Profit Margin Warning */}
                    {totalSell > 0 && marginPercent < marginThreshold && (
                      <div className={`mb-3 p-3 rounded-xl border text-xs font-bold ${marginPercent < 5 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                        {marginPercent < 5 ? `\u26A0\uFE0F Critical margin: ${marginPercent.toFixed(1)}% - Review pricing` : `\u26A0\uFE0F Low profit margin: ${marginPercent.toFixed(1)}% (threshold: ${marginThreshold}%)`}
                      </div>
                    )}
                    
                    {/* Blackout Period Warning */}
                    {activeBlackout && (
                      <div className={`mb-3 p-3 rounded-xl border text-xs font-bold ${activeBlackout.blockBookings ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-purple-50 border-purple-200 text-purple-800'}`}>
                        {activeBlackout.blockBookings
                          ? `\uD83D\uDEAB Bookings are BLOCKED: ${activeBlackout.name} (${activeBlackout.startDate} to ${activeBlackout.endDate})`
                          : `\u26A0\uFE0F Blackout period: ${activeBlackout.name} - Rate multiplier: ${activeBlackout.rateMultiplier}x`
                        }
                      </div>
                    )}
                    
                    {/* Overbooking Warning */}
                    {overbookingWarnings.length > 0 && (
                      <div className="mb-3 p-3 rounded-xl border bg-orange-50 border-orange-200 text-orange-800 text-xs font-bold">
                        \u26A0\uFE0F Overbooking risk: {overbookingWarnings.map(w => w!.message).join('. ')}
                        {onSaveWaitlist && (
                          <button type="button" onClick={() => {
                            const entry: WaitlistEntry = {
                              id: `wl_${Date.now()}`,
                              hotelId, roomType: rooms[0]?.roomType || '',
                              checkIn, checkOut, guestName, clientId,
                              status: 'Waiting',
                              createdAt: getEgyptTime().toISOString().replace('T', ' ').substring(0, 19),
                              createdBy: currentUser
                            };
                            onSaveWaitlist(entry);
                            toast.success('Added to waitlist');
                          }} className="ml-2 px-2 py-0.5 bg-orange-200 hover:bg-orange-300 rounded text-[10px] font-bold text-orange-900">Add to Waitlist</button>
                        )}
                      </div>
                    )}
                    
                    {/* Credit Limit Warning */}
                    {creditWarning && creditWarning.balance > creditWarning.limit * 0.8 && (
                      <div className={`mb-3 p-3 rounded-xl border text-xs font-bold ${creditWarning.balance > creditWarning.limit ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                        {creditWarning.balance > creditWarning.limit
                          ? `\uD83D\uDEA8 Client credit limit EXCEEDED: ${creditWarning.balance.toLocaleString()} / ${creditWarning.limit.toLocaleString()} SAR`
                          : `\u26A0\uFE0F Client approaching credit limit: ${creditWarning.balance.toLocaleString()} / ${creditWarning.limit.toLocaleString()} SAR`
                        }
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="space-y-4">
                {rooms.map((rm, idx) => {
                  const roomBuyTotal = roomFullTotal(rm, 'buy');
                  const roomSellTotal = roomFullTotal(rm, 'sell');
                  const roomProfit = roomSellTotal - roomBuyTotal;
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* Room Header Bar */}
                      <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Room Line #{idx + 1}</span>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => { setRateCompareIdx(idx); setShowRateCompare(true); }} className="text-[9px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg transition" title="Compare supplier rates" disabled={!hotelId || !checkIn || !checkOut}>💰 Compare Rates</button>
                                                    <button type="button" onClick={() => handleCopyRoomRow(idx)} className="text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition" title="Copy this room line">📋 Copy</button>
                          <button type="button" onClick={() => handleRemoveRoomRow(idx)} className="text-[9px] font-bold text-red-500 hover:bg-rose-50 px-2 py-1 rounded-lg transition" title="Delete room line">🗑️ Delete</button>
                        </div>
                      </div>

                      <div className="p-4">
                        {/* Room Info Row */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.roomType')}</label>
                            <select value={rm.roomType} onChange={(e) => handleUpdateRoomRow(idx, { roomType: e.target.value })} className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold">
                              {selectedHotelObj.roomTypes.map((rt, i) => (<option key={i} value={rt}>{rt}</option>))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.view')}</label>
                            <select value={rm.view} onChange={(e) => handleUpdateRoomRow(idx, { view: e.target.value })} className="w-full px-2 py-2.5 border border-slate-200 bg-white rounded-lg text-xs">
                              {selectedHotelObj.views.map((v, i) => (<option key={i} value={v}>{v}</option>))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.mealPlan')}</label>
                            <select value={rm.mealPlan} onChange={(e) => handleUpdateRoomRow(idx, { mealPlan: e.target.value })} className="w-full px-2 py-2.5 border border-slate-200 bg-white rounded-lg text-xs">
                              {selectedHotelObj.mealPlans.map((mp, i) => (<option key={i} value={mp}>{mp}</option>))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.qty')} / {t('res.pax')}</label>
                            <div className="flex gap-1.5">
                              <input type="number" min={1} value={rm.qty} onChange={(e) => handleUpdateRoomRow(idx, { qty: Number(e.target.value) })} className="w-full px-2 py-2.5 border border-slate-200 rounded-lg font-bold font-mono text-xs text-center" />
                              {rm.roomType.toLowerCase().includes('suite') ? (
                                <select value={rm.pax || 2} onChange={(e) => handleUpdateRoomRow(idx, { pax: Number(e.target.value) })} className="w-full bg-white px-1 py-2.5 border border-slate-200 rounded-lg text-[11px] font-mono font-bold text-center">
                                  {[2,3,4,5,6].map(n => (<option key={n} value={n}>{n} Pax</option>))}
                                </select>
                              ) : (
                                <span className="w-full bg-slate-100 font-mono text-[11px] font-bold block text-center py-2.5 border border-slate-200 rounded-lg select-none">{rm.pax} Pax</span>
                              )}
                            </div>
                          </div>
                          {/* Quick Totals */}
                          <div className="col-span-2 md:col-span-1 bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex flex-col justify-center">
                            <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{t('res.roomTotals')} ({calculateNightsCount()}N × {rm.qty})</div>
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-red-600 font-bold">-{roomBuyTotal.toLocaleString()}</span>
                              <span className="text-emerald-700 font-bold">+{roomSellTotal.toLocaleString()}</span>
                              <span className={`font-extrabold ${roomProfit >= 0 ? 'text-amber-700' : 'text-rose-600'}`}>{roomProfit.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Pricing Row */}
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-slate-200">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-red-500 block mb-1">{t('res.buyRateNight')}</label>
                            <input type="number" value={rm.buyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { buyPriceNum: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-red-200 rounded-lg text-red-700 font-bold font-mono text-xs bg-red-50/30" />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-emerald-600 block mb-1">{t('res.sellRateNight')}</label>
                            <input type="number" value={rm.sellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { sellPriceNum: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-emerald-200 rounded-lg text-emerald-800 font-bold font-mono text-xs bg-emerald-50/30" />
                          </div>
                        </div>

                        {/* Supplements Toggle Bar */}
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                          <div className="text-[9px] uppercase font-bold text-slate-400 mb-2">Supplements</div>
                          <div className="flex flex-wrap gap-2">
                            {([
                              { key: 'hasWeekend', label: t('res.weekendRate'), activeClass: 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm' },
                              { key: 'hasExtraBed', label: t('res.extraBed'), activeClass: 'bg-indigo-100 border-indigo-300 text-indigo-800 shadow-sm' },
                              { key: 'hasSeparateMealRate', label: t('res.separateMealRate'), activeClass: 'bg-rose-100 border-rose-300 text-rose-800 shadow-sm' },
                              { key: 'hasViewSupplement', label: t('res.viewSupplement'), activeClass: 'bg-sky-100 border-sky-300 text-sky-800 shadow-sm' },
                              { key: 'hasExtraMeal1', label: `${t('res.extraMeal')} 1`, activeClass: 'bg-orange-100 border-orange-300 text-orange-800 shadow-sm' },
                              { key: 'hasExtraMeal2', label: `${t('res.extraMeal')} 2`, activeClass: 'bg-teal-100 border-teal-300 text-teal-800 shadow-sm' },
                            ] as const).map(supp => (
                              <button
                                key={supp.key}
                                type="button"
                                onClick={() => handleUpdateRoomRow(idx, { [supp.key]: !rm[supp.key] } as any)}
                                className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase transition-all border ${
                                  rm[supp.key]
                                    ? supp.activeClass
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                {rm[supp.key] ? '✓ ' : '+ '}{supp.label}
                              </button>
                            ))}
                          </div>
                        </div>

                      {/* Expandable supplement fields */}
                      {rm.hasWeekend && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-amber-300 bg-amber-50/50 py-2 mt-3 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-amber-700 block mb-0.5">{t('res.weekendBuyNight')}</label><input type="number" value={rm.weekendBuyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { weekendBuyPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-amber-200 bg-amber-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-amber-700 block mb-0.5">{t('res.weekendSellNight')}</label><input type="number" value={rm.weekendSellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { weekendSellPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-amber-200 bg-amber-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasExtraBed && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-indigo-300 bg-indigo-50/50 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-indigo-700 block mb-0.5">{t('res.extraBedBuyNight')}</label><input type="number" value={rm.extraBedBuyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraBedBuyPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-indigo-200 bg-indigo-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-indigo-700 block mb-0.5">{t('res.extraBedSellNight')}</label><input type="number" value={rm.extraBedSellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraBedSellPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-indigo-200 bg-indigo-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasSeparateMealRate && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-rose-300 bg-rose-50/50 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-rose-700 block mb-0.5">{t('res.mealBuyPaxNight')}</label><input type="number" value={rm.mealRateBuyNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { mealRateBuyNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-rose-200 bg-rose-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-rose-700 block mb-0.5">{t('res.mealSellPaxNight')}</label><input type="number" value={rm.mealRateSellNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { mealRateSellNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-rose-200 bg-rose-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasViewSupplement && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-sky-300 bg-sky-50/50 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-sky-700 block mb-0.5">{t('res.viewSuppBuyRoomNight')}</label><input type="number" value={rm.viewSuppBuyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { viewSuppBuyPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-sky-200 bg-sky-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-sky-700 block mb-0.5">{t('res.viewSuppSellRoomNight')}</label><input type="number" value={rm.viewSuppSellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { viewSuppSellPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-sky-200 bg-sky-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasExtraMeal1 && (
                        <div className="grid grid-cols-3 gap-3 pl-4 border-l-2 border-orange-300 bg-orange-50/50 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-orange-700 block mb-0.5">{t('res.mealLabel')}</label><input type="text" value={rm.extraMeal1Label || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal1Label: e.target.value })} placeholder="Dinner / Lunch" className="w-full px-2.5 py-1.5 border border-orange-200 bg-orange-50 rounded text-slate-800 font-bold text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-orange-700 block mb-0.5">{t('res.buyPaxNight')}</label><input type="number" value={rm.extraMeal1BuyNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal1BuyNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-orange-200 bg-orange-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-orange-700 block mb-0.5">{t('res.sellPaxNight')}</label><input type="number" value={rm.extraMeal1SellNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal1SellNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-orange-200 bg-orange-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasExtraMeal2 && (
                        <div className="grid grid-cols-3 gap-3 pl-4 border-l-2 border-teal-300 bg-teal-50/50 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-teal-700 block mb-0.5">{t('res.mealLabel')}</label><input type="text" value={rm.extraMeal2Label || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal2Label: e.target.value })} placeholder="Dinner / Lunch" className="w-full px-2.5 py-1.5 border border-teal-200 bg-teal-50 rounded text-slate-800 font-bold text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-teal-700 block mb-0.5">{t('res.buyPaxNight')}</label><input type="number" value={rm.extraMeal2BuyNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal2BuyNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-teal-200 bg-teal-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-teal-700 block mb-0.5">{t('res.sellPaxNight')}</label><input type="number" value={rm.extraMeal2SellNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal2SellNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-teal-200 bg-teal-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}

                      {/* Nightly Rate Grid Toggle */}
                      {checkIn && checkOut && calculateNightsCount() > 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(expandedNightlyGrid);
                              next.has(idx) ? next.delete(idx) : next.add(idx);
                              setExpandedNightlyGrid(next);
                            }}
                            className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition"
                          >
                            {expandedNightlyGrid.has(idx) ? '▼' : '▶'} 📅 Nightly Rate Breakdown ({calculateNightsCount()} nights)
                          </button>
                          {expandedNightlyGrid.has(idx) && (() => {
                            const nights = calculateNightsCount();
                            const [y, m, d] = checkIn.split('-').map(Number);
                            const startDate = new Date(y, m - 1, d);
                            return (
                              <div className="mt-2 overflow-x-auto">
                                <div className="flex gap-1 min-w-max pb-2">
                                  {Array.from({ length: nights }, (_, i) => {
                                    const curr = new Date(startDate.getTime() + i * 86400000);
                                    const dayOfWeek = curr.getDay();
                                    const isWeekend = dayOfWeek === 4 || dayOfWeek === 5;
                                    const dayLabel = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek];
                                    return (
                                      <div key={i} className={`flex flex-col items-center rounded-lg border p-1.5 min-w-[68px] ${isWeekend ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <span className={`text-[8px] font-bold uppercase ${isWeekend ? 'text-amber-700' : 'text-slate-400'}`}>{dayLabel}</span>
                                        <span className={`text-[9px] font-mono ${isWeekend ? 'text-amber-800 font-bold' : 'text-slate-600'}`}>{String(curr.getDate()).padStart(2,'0')}/{String(curr.getMonth()+1).padStart(2,'0')}</span>
                                        <input
                                          type="number"
                                          defaultValue={rm.buyPriceNum || 0}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const currentMap = typeof rm.buyRate === 'object' ? { ...rm.buyRate } : {};
                                            currentMap[`night_${i}`] = val;
                                            handleUpdateRoomRow(idx, { buyRate: currentMap } as any);
                                          }}
                                          className="w-full mt-1 px-1 py-0.5 border border-red-200 rounded text-[9px] font-mono text-red-600 text-center bg-red-50/30"
                                          title={`Buy rate night ${i+1}`}
                                        />
                                        <input
                                          type="number"
                                          defaultValue={rm.sellPriceNum || 0}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const currentMap = typeof rm.nightlyRates === 'object' ? { ...rm.nightlyRates } : {};
                                            currentMap[`night_${i}`] = val;
                                            handleUpdateRoomRow(idx, { nightlyRates: currentMap } as any);
                                          }}
                                          className="w-full mt-0.5 px-1 py-0.5 border border-emerald-200 rounded text-[9px] font-mono text-emerald-700 text-center bg-emerald-50/30"
                                          title={`Sell rate night ${i+1}`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-3 text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                                  <span>🔴 Buy</span>
                                  <span>🟢 Sell</span>
                                  <span className="text-amber-600">★ Thu/Fri = Weekend</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Section 3: Status-Specific Fields & References */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="text-amber-600">●</span> {t('res.referencesStatus')}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Option Dates - visible for Tentative */}
              {status === 'Tentative' && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-rose-800 block mb-1 font-serif">{t('res.clientOptionExpire')}</label>
                    <input type="date" value={clientOptionDate} onChange={(e) => setClientOptionDate(e.target.value)} className="w-full px-3 py-2.5 border border-rose-200 rounded-xl text-xs bg-rose-50/50 font-semibold text-rose-900 focus:bg-white" required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-red-800 block mb-1 font-serif">{t('res.supplierOptionExpire')}</label>
                    <input type="date" value={supplierOptionDate} onChange={(e) => setSupplierOptionDate(e.target.value)} className="w-full px-3 py-2.5 border border-red-200 rounded-xl text-xs bg-red-50/50 font-semibold text-red-900 focus:bg-white" required />
                  </div>
                </>
              )}

              {/* Confirmed fields */}
              {status === 'Confirmed' && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-emerald-800 block mb-1">{t('res.hotelConfNo')}</label>
                    <input type="text" value={hotelConfirmationNo} onChange={(e) => setHotelConfirmationNo(e.target.value)} placeholder="CONF-559021" className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm font-bold focus:bg-white font-mono bg-emerald-50/30 text-emerald-900" />
                  </div>
                </>
              )}

              {/* Cancelled fields */}
              {status === 'Cancelled' && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">{t('res.cancellationPenalty')}</label>
                    <input type="number" value={cancellationFee || ''} onChange={(e) => setCancellationFee(Number(e.target.value))} className="w-full px-3 py-2.5 border border-rose-200 bg-rose-50/30 rounded-xl text-sm font-mono font-bold text-rose-700" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">{t('res.reason')}</label>
                    <select value={cancellationReason.startsWith('Other') ? 'Other' : cancellationReason} onChange={(e) => { const sel = e.target.value; if (sel === 'Other') { setCancellationReason('Other: '); } else { setCancellationReason(sel); } }} className="w-full px-3 py-2.5 border border-rose-200 bg-rose-50/30 rounded-xl text-xs font-medium focus:bg-white">
                      <option value="Customer requested cancellation">{t('res.cancellationReasons')}</option>
                      <option value="Supplier unable to confirm allotment">{t('res.supplierUnableConfirm')}</option>
                      <option value="Expiry of Option Date without deposit">{t('res.expiryOptionDate')}</option>
                      <option value="Duplicate booking reservation">{t('res.duplicateBooking')}</option>
                      <option value="Pricing discrepancy / agreement dispute">{t('res.pricingDiscrepancy')}</option>
                      <option value="Other">{t('res.otherReason')}</option>
                    </select>
                    {cancellationReason.startsWith('Other') && (
                      <input type="text" value={cancellationReason.replace('Other: ', '')} onChange={(e) => setCancellationReason('Other: ' + e.target.value)} placeholder={t('res.describeReason')} className="w-full mt-2 px-3 py-2 border border-rose-200 bg-white rounded-xl text-xs font-semibold focus:border-rose-400" required />
                    )}
                  </div>

                  {/* Client Credit Disposition */}
                  {amountPaidByClient > 0 && (
                    <div>
                      <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">{t('res.clientPaidWhat', { amount: amountPaidByClient.toLocaleString() })}</label>
                      <div className="flex gap-1">
                        {(['Refunded', 'Kept as Credit', 'N/A'] as const).map(opt => (
                          <button key={opt} type="button" onClick={() => setClientCreditDisposition(opt)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${clientCreditDisposition === opt ? opt === 'Refunded' ? 'bg-emerald-600 text-white border-emerald-600' : opt === 'Kept as Credit' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300'}`}>
                            {opt === 'Refunded' ? '💸 ' + t('res.refunded') : opt === 'Kept as Credit' ? '🏦 ' + t('res.keptAsCredit') : '— ' + t('res.na')}
                          </button>
                        ))}
                      </div>
                      {clientCreditDisposition !== 'N/A' && (
                        <input type="text" value={clientCreditNote} onChange={(e) => setClientCreditNote(e.target.value)} placeholder={clientCreditDisposition === 'Refunded' ? t('res.refundDetails') : t('res.creditFutureBooking')} className="w-full mt-1.5 px-3 py-2 border border-rose-200 bg-white rounded-xl text-[10px] font-semibold focus:border-rose-400" />
                      )}
                    </div>
                  )}

                  {/* Supplier Credit Disposition */}
                  {amountPaidToSupplier > 0 && (
                    <div>
                      <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">{t('res.supplierPaidWhat', { amount: amountPaidToSupplier.toLocaleString() })}</label>
                      <div className="flex gap-1">
                        {(['Refunded', 'Kept as Credit', 'N/A'] as const).map(opt => (
                          <button key={opt} type="button" onClick={() => setSupplierCreditDisposition(opt)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${supplierCreditDisposition === opt ? opt === 'Refunded' ? 'bg-emerald-600 text-white border-emerald-600' : opt === 'Kept as Credit' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300'}`}>
                            {opt === 'Refunded' ? '💸 ' + t('res.refunded') : opt === 'Kept as Credit' ? '🏦 ' + t('res.keptAsCredit') : '— ' + t('res.na')}
                          </button>
                        ))}
                      </div>
                      {supplierCreditDisposition !== 'N/A' && (
                        <input type="text" value={supplierCreditNote} onChange={(e) => setSupplierCreditNote(e.target.value)} placeholder={supplierCreditDisposition === 'Refunded' ? t('res.refundDetails') : t('res.creditFutureBooking')} className="w-full mt-1.5 px-3 py-2 border border-rose-200 bg-white rounded-xl text-[10px] font-semibold focus:border-rose-400" />
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Common reference fields */}
              <div>
                <label className="text-[10px] uppercase font-bold text-indigo-800 block mb-1">{t('res.bankAccount')}</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="w-full px-3 py-2.5 border border-indigo-200 bg-indigo-50/30 rounded-xl text-xs font-semibold focus:bg-white text-indigo-900">
                  <option value="">{t('res.defaultBankInfo')}</option>
                  {accounts?.filter(a => a.type === 'Bank').map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.currency || 'SAR'})</option>))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.agreementNo')}</label>
                <input type="text" value={agreementNo} onChange={(e) => setAgreementNo(e.target.value)} placeholder="Contract No" className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Terms & Conditions</label>
                <select value={selectedTcId} onChange={(e) => setSelectedTcId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:bg-white">
                  <option value="">Default (Standard Terms)</option>
                  {termsAndConditions.filter(tc => tc.active).map(tc => (
                    <option key={tc.id} value={tc.id}>{tc.isDefault ? '★ ' : ''}{tc.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Booking Source</label>
                <select value={bookingSource} onChange={(e) => setBookingSource(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:bg-white">
                  {BOOKING_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Sales Person</label>
                <select value={salesPersonId} onChange={(e) => {
                  const newId = e.target.value;
                  setSalesPersonId(newId);
                  // Pre-fill commission rate from salesperson default
                  if (newId) {
                    const sp = salesPersons.find(s => s.id === newId);
                    setSpCommissionRate(sp?.commission || 0);
                  } else {
                    setSpCommissionRate(0);
                  }
                }} className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:bg-white">
                  <option value="">— None —</option>
                  {salesPersons.filter(sp => sp.active).map(sp => <option key={sp.id} value={sp.id}>{sp.name} (default: {sp.commission} SAR/room/night)</option>)}
                </select>
                {salesPersonId && (
                  <div className="mt-1.5">
                    <label className="text-[9px] uppercase font-bold text-purple-500 block mb-0.5">Commission Rate (SAR / room / night)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={spCommissionRate || ''}
                      onChange={(e) => setSpCommissionRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-purple-200 bg-purple-50 rounded-lg text-sm font-mono font-bold text-purple-800 focus:bg-white focus:border-purple-400"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Assigned To</label>
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:bg-white">
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
                {salesPersonId && spCommissionRate > 0 && (() => {
                  const spRooms = rooms.reduce((s, rm) => s + rm.qty, 0);
                  const spNights = calculateNightsCount();
                  const spCommission = Math.round(spCommissionRate * spRooms * spNights);
                  const amountToRemit = rooms.reduce((s, rm) => s + roomFullTotal(rm, 'sell'), 0) - spCommission;
                  return (
                    <div className="mt-1 space-y-1">
                      <div className="px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg text-[9px] font-bold text-purple-800">
                        💼 Commission: <span className="font-mono">{spCommission.toLocaleString()} SAR</span> ({spCommissionRate} SAR × {spRooms} rooms × {spNights} nights)
                      </div>
                      <label className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={collectedBySalesPerson}
                          onChange={(e) => setCollectedBySalesPerson(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-[9px] font-bold text-amber-800">
                          🇸🇦 Collected by Sales Person in KSA
                        </span>
                      </label>
                      {collectedBySalesPerson && (
                        <div className="px-2 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-[9px]">
                          <div className="flex justify-between text-orange-800">
                            <span>Sales Person Keeps (Commission):</span>
                            <span className="font-mono font-bold">{spCommission.toLocaleString()} SAR</span>
                          </div>
                          <div className="flex justify-between text-orange-900 border-t border-orange-200 pt-1 mt-1">
                            <span>⚠️ Must Remit to Company:</span>
                            <span className="font-mono font-bold">{amountToRemit.toLocaleString()} SAR</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{t('res.supplierVoucher')}</label>
                <input type="text" value={supplierVoucher} onChange={(e) => setSupplierVoucher(e.target.value)} placeholder="Supplier Ref" className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white" />
              </div>
              {/* Non-Refundable Toggle */}
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Tags / Labels</label>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_OPTIONS.map(tag => (
                    <button key={tag} type="button" onClick={() => setBookingTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                        bookingTags.includes(tag) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                      }`}>{tag}</button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Special Requests / Guest Preferences</label>
                <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Early check-in, extra pillows, dietary requirements..." rows={2} className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:bg-white resize-none" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-orange-600 block mb-1">🔒 Internal Notes (Staff Only — not visible to client)</label>
                <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal communication, shift handoff notes, issues to track..." rows={2} className="w-full px-3 py-2.5 border-2 border-orange-200 bg-orange-50/50 rounded-xl text-sm focus:bg-white focus:border-orange-300 resize-none" />
              </div>
              <div className="col-span-2 flex items-center gap-3 bg-rose-50/50 border border-rose-200 rounded-xl px-4 py-3">
                <button
                  type="button"
                  onClick={() => setNonRefundable(!nonRefundable)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                    nonRefundable ? 'bg-rose-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    nonRefundable ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <div>
                  <span className={`text-xs font-bold ${nonRefundable ? 'text-rose-800' : 'text-slate-600'}`}>
                    Non-Refundable Booking
                  </span>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {nonRefundable ? 'This booking will be marked as non-refundable on the confirmation PDF' : 'Standard cancellation policy applies'}
                  </p>
                </div>
              </div>
              {/* Group Booking Reference */}
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Group Reference</label>
                <input type="text" value={groupRef} onChange={(e) => setGroupRef(e.target.value)} placeholder="e.g. GRP-2026-001 (links multiple rooms)" className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white" />
              </div>
              {/* Down payment fields removed - shown in Financial Summary below */}
            </div>
          </div>

          {/* Section 4: Financial Summary */}
          {selectedHotelObj && checkIn && checkOut && (
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
              <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                <span className="text-amber-600">●</span> {t('res.financialSummary')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                {(() => {
                  const totalBuy = rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'buy'), 0);
                  const totalSell = rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'sell'), 0);
                  const totalPax = rooms.reduce((acc, rm) => acc + (rm.qty * rm.pax), 0);
                  const totalRooms = rooms.reduce((acc, rm) => acc + rm.qty, 0);
                  const profit = totalSell - totalBuy;
                  const clientOutstanding = totalSell - amountPaidByClient;
                  return (
                    <>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{t('res.totalCost')}</div>
                        <div className="text-sm font-extrabold font-mono text-red-600">{totalBuy.toLocaleString()} SAR</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{t('res.totalSell')}</div>
                        <div className="text-sm font-extrabold font-mono text-emerald-700">{totalSell.toLocaleString()} SAR</div>
                      </div>
                      <div className={`rounded-xl p-3 border ${profit >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{t('res.profit')}</div>
                        <div className={`text-sm font-extrabold font-mono ${profit >= 0 ? 'text-amber-700' : 'text-rose-600'}`}>{profit.toLocaleString()} SAR</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{t('res.roomsPax')}</div>
                        <div className="text-sm font-extrabold font-mono text-slate-800">{totalRooms} / {totalPax}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{t('res.clientPaid')}</div>
                        <div className="text-sm font-extrabold font-mono text-indigo-700">{amountPaidByClient.toLocaleString()} SAR</div>
                        {clientOutstanding > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">{t('res.due')}: {clientOutstanding.toLocaleString()}</div>}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{t('res.supplierPaid')}</div>
                        <div className="text-sm font-extrabold font-mono text-indigo-700">{amountPaidToSupplier.toLocaleString()} SAR</div>
                        {(totalBuy - amountPaidToSupplier) > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">{t('res.due')}: {(totalBuy - amountPaidToSupplier).toLocaleString()}</div>}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}



          <div className="flex gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm"
            >
              {t('res.saveBooking')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-6 py-2.5 rounded-xl transition"
            >
              {t('common.cancel')}
            </button>
          </div>

        </form>
      ) : (
        /* Dynamic table listing of filter output */
        <>
        {/* Mobile Card Layout (virtualized + paginated) */}
        <div className="md:hidden">
          {sortedReservations.length === 0 ? (
            <div className="py-16 text-center animate-fade-in">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-sm font-bold text-slate-500">{t('res.noReservations')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('res.tryAdjustFilters')}</p>
            </div>
          ) : (
            <VirtualTable
              items={sortedReservations}
              estimateSize={180}
              containerHeight={500}
              itemLabel="reservations"
              keyExtractor={(res) => res.id}
              renderRow={(res) => {
            const client = agents.find(a => a.id === res.clientId);
            const hotel = hotels.find(h => h.id === res.hotelId);
            const { totalSell, totalBuy, netProfit } = getReservationTotals(res);
            const marginPct = totalSell > 0 ? Math.round((netProfit / totalSell) * 100) : 0;
            const marginColor = marginPct >= 15 ? 'text-emerald-700 bg-emerald-50' : marginPct >= 8 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';
            const clientPaid = res.amountPaidByClient || 0;
            const paidPercent = totalSell > 0 ? Math.round((clientPaid / totalSell) * 100) : 0;
            return (
              <div key={res.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold font-mono text-slate-900 bg-amber-50 px-2 py-0.5 rounded text-[10px]">RSV-{res.id}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold ${res.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-800' : res.status === 'Cancelled' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>{res.status === 'Confirmed' ? t('res.confirmed') : res.status === 'Cancelled' ? t('res.cancelled') : t('res.tentative')}</span>
                    {res.nonRefundable && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-100 text-rose-700 border border-rose-200">NON-REF</span>}
                  </div>
                  <span className={`font-mono font-bold text-[11px] ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{netProfit.toLocaleString()} SAR</span>
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${marginColor}`}>{marginPct}%</span>
                </div>
                <div className="font-semibold uppercase text-slate-900 text-sm mb-1">{res.guestName}</div>
                <div className="text-[10px] text-slate-600 mb-2">{hotel?.name}  {client?.companyName || client?.name}</div>
                <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-2">
                  <span>{res.checkIn} → {res.checkOut} ({res.nights}N)</span>
                </div>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 text-center bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <div className="text-[8px] uppercase font-bold text-slate-400">{t('res.clientPaid')}</div>
                    <div className="font-mono font-bold text-emerald-700 text-[11px]">{clientPaid.toLocaleString()}</div>
                    <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${paidPercent >= 100 ? 'bg-emerald-500' : paidPercent > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${Math.min(paidPercent, 100)}%` }}></div></div>
                  </div>
                  <div className="flex-1 text-center bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <div className="text-[8px] uppercase font-bold text-slate-400">{t('res.supplierPaid')}</div>
                    <div className="font-mono font-bold text-indigo-700 text-[11px]">{(res.amountPaidToSupplier || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setViewingId(res.id.toString())} className="flex-1 min-w-[100px] bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-3 py-2.5 rounded-lg border border-slate-200 text-[10px]">{t('res.detailsPay')}</button>
                  <button onClick={() => setPrintingDoc({ res, isVoucher: false })} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-2.5 rounded-lg border border-indigo-200 text-[10px]">{t('res.confirmation')}</button>
                  <button onClick={() => setPrintingDoc({ res, isVoucher: true })} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-2.5 rounded-lg border border-emerald-200 text-[10px]">{t('res.voucher')}</button>
                  <button onClick={() => handleEdit(res)} className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-2.5 rounded-lg border border-amber-200 text-[10px]">{t('common.edit')}</button>
                  <button onClick={() => cloneReservation(res)} className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold px-3 py-2.5 rounded-lg border border-cyan-200 text-[10px]">📋 Clone</button>
                  <button onClick={() => { onDeleteReservation(res.id.toString()); }} className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-2.5 rounded-lg border border-rose-200 text-[10px]">{t('common.delete')}</button>
                </div>
              </div>
            );
          }}
            />
          )}
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm">
            <span className="font-bold text-indigo-700">{selectedIds.size} selected</span>
            <button
              onClick={() => {
                if (!onBulkAction) return;
                const ids = Array.from(selectedIds);
                onBulkAction('confirm', ids);
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-200 transition border border-emerald-200"
            >Confirm</button>
            <button
              onClick={() => {
                if (!onBulkAction) return;
                const ids = Array.from(selectedIds);
                onBulkAction('cancel', ids);
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg font-bold text-xs hover:bg-rose-200 transition border border-rose-200"
            >Cancel</button>
            <select
              onChange={e => {
                const newStatus = e.target.value;
                if (!newStatus) return;
                if (!confirm(`Change status of ${selectedIds.size} reservation(s) to ${newStatus}?`)) return;
                const toChange = reservations.filter(r => selectedIds.has(r.id));
                toChange.forEach(r => onSaveReservation({ ...r, status: newStatus as any }));
                setSelectedIds(new Set());
                toast.success(`${toChange.length} reservation(s) changed to ${newStatus}`);
                e.target.value = '';
              }}
              className="px-2 py-1.5 border border-indigo-200 rounded-lg text-xs font-bold bg-white text-indigo-700"
              defaultValue=""
            >
              <option value="" disabled>Change Status...</option>
              <option value="Tentative">Tentative</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <select
              onChange={e => {
                const tag = e.target.value;
                if (!tag) return;
                const toTag = reservations.filter(r => selectedIds.has(r.id));
                toTag.forEach(r => {
                  const existingTags = r.tags || [];
                  if (!existingTags.includes(tag)) {
                    onSaveReservation({ ...r, tags: [...existingTags, tag] });
                  }
                });
                setSelectedIds(new Set());
                toast.success(`Tag "${tag}" added to ${toTag.length} reservation(s)`);
                e.target.value = '';
              }}
              className="px-2 py-1.5 border border-indigo-200 rounded-lg text-xs font-bold bg-white text-indigo-700"
              defaultValue=""
            >
              <option value="" disabled>Add Tag...</option>
              {TAG_OPTIONS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <button
              onClick={() => {
                const selected = reservations.filter(r => selectedIds.has(r.id));
                const csvRows = selected.map(r => {
                  const totals = getReservationTotals(r);
                  return {
                    'RSV#': r.id,
                    'Guest': r.guestName,
                    'Hotel': hotels.find(h => h.id === r.hotelId)?.name || '',
                    'Check-In': r.checkIn,
                    'Check-Out': r.checkOut,
                    'Nights': r.nights,
                    'Status': r.status,
                    'Source': r.bookingSource || '',
                    'Tags': (r.tags || []).join(', '),
                    'Sell Total': totals.totalSell,
                    'Buy Total': totals.totalBuy,
                    'Profit': totals.totalSell - totals.totalBuy
                  };
                });
                exportToCSV(`selected_reservations_${new Date().toISOString().split('T')[0]}.csv`, csvRows);
                toast.success(`${selected.length} reservation(s) exported`);
              }}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-bold text-xs hover:bg-blue-200 transition border border-blue-200"
            >Export CSV</button>
            <button
              onClick={() => {
                if (!onBulkAction) return;
                const count = selectedIds.size;
                const ids = Array.from(selectedIds);
                onBulkAction('delete', ids);
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold text-xs hover:bg-red-200 transition border border-red-200"
            >Delete</button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 font-medium">Clear Selection</button>
          </div>
        )}

        {/* Desktop Table Layout */}
        <div className="hidden md:block bg-white border border-slate-150 rounded-2xl p-4 shadow-sm overflow-x-auto text-[11px] -webkit-overflow-scrolling: touch">
          <table className="w-full text-left border-collapse min-w-[900px] md:min-w-0">
            <thead>
              <tr className="border-b border-light text-slate-400 font-semibold bg-slate-50/50 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 font-mono">
                  <input type="checkbox" checked={sortedReservations.length > 0 && sortedReservations.every(r => selectedIds.has(r.id))}
                    onChange={e => {
                      const pageIds = sortedReservations.map(r => r.id);
                      if (e.target.checked) {
                        setSelectedIds(new Set([...selectedIds, ...pageIds]));
                      } else {
                        const s = new Set(selectedIds);
                        pageIds.forEach(id => s.delete(id));
                        setSelectedIds(s);
                      }
                    }}
                    className="rounded" title="Select page" />
                </th>
                <th className="py-2.5 px-3 font-mono">{t('res.id')}</th>
                <th className="py-2.5 px-3">{t('res.guestName')}</th>
                <th className="py-2.5 px-3 text-left">{t('res.client')}</th>
                <th className="py-2.5 px-3 text-left">{t('res.hotel')}</th>
                <th className="py-2.5 px-3 font-mono">{t('res.checkIn')} / {t('res.checkOut')}</th>
                <th className="py-2.5 px-3 text-center">{t('common.status')}</th>
                <th className="py-2.5 px-3 text-right">{t('res.paymentsByClient')}</th>
                <th className="py-2.5 px-3 text-right hidden xl:table-cell">{t('res.paymentsToSupplier')}</th>
                <th className="py-2.5 px-3 text-right text-indigo-950 hidden xl:table-cell">Net Profit</th>
                <th className="py-2.5 px-3 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {sortedReservations.map((res) => {
                const client = agents.find(a => a.id === res.clientId);
                const hotel = hotels.find(h => h.id === res.hotelId);
                const { totalSell, totalBuy, netProfit } = getReservationTotals(res);
                const clientPaid = res.amountPaidByClient || 0;
                const paidPercent = totalSell > 0 ? Math.round((clientPaid / totalSell) * 100) : 0;

                return (
                  <tr key={res.id} className={`hover:bg-slate-50/40 text-xs ${selectedIds.has(res.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="py-3 px-3">
                      <input type="checkbox" checked={selectedIds.has(res.id)}
                        onChange={e => { const s = new Set(selectedIds); e.target.checked ? s.add(res.id) : s.delete(res.id); setSelectedIds(s); }}
                        className="rounded" />
                    </td>
                    <td className="py-3 px-3 font-bold font-mono text-slate-900 bg-amber-50/5">
                      RSV-{res.id}
                    </td>
                    <td className="py-3 px-3 font-semibold uppercase text-slate-900">
                      {res.guestName}
                      {res.nonRefundable && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-100 text-rose-700 border border-rose-200 align-middle">NON-REF</span>}
                    </td>
                    <td className="py-3 px-1.5 font-medium">{client?.companyName || client?.name}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{hotel?.name}</td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-650">
                      <div>{res.checkIn}</div>
                      <div className="text-[9px] text-slate-400 font-bold">{t('res.to')}: {res.checkOut}</div>
                      <div className="text-[10px] text-indigo-700 font-bold mt-0.5">{res.nights} {t('res.nightsLabel')}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <select 
                        value={res.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as any;
                          const applyStatusChange = () => {
                            if (newStatus === 'Cancelled') {
                              setCancelWizardRes(res);
                              return;
                            } else {
                              onSaveReservation({...res, status: newStatus});
                            }
                          };
                          if (newStatus === 'Confirmed' && !(res.amountPaidByClient && res.amountPaidByClient > 0)) {
                            openConfirm('Confirm Without Payment', `WARNING: No client payment recorded for RSV-${res.id} (${res.guestName}).\n\nAre you sure you want to confirm this booking without receiving any payment?`, applyStatusChange);
                            return;
                          }
                          applyStatusChange();
                        }}
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold outline-none cursor-pointer border ${
                          res.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                          res.status === 'Cancelled' ? 'bg-rose-50 text-rose-800 border-rose-100' :
                          'bg-amber-50 text-amber-800 border-amber-100'
                        }`}
                      >
                        <option value="Tentative">Tentative</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="font-mono font-bold text-emerald-700">{clientPaid.toLocaleString()} <span className="text-[8px] text-slate-400">SAR</span></div>
                      <div className="text-[9px] text-slate-400 font-bold">{t('res.of')} {totalSell.toLocaleString()} ({paidPercent}%)</div>
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-1 ml-auto overflow-hidden">
                        <div className={`h-full rounded-full ${paidPercent >= 100 ? 'bg-emerald-500' : paidPercent > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${Math.min(paidPercent, 100)}%` }}></div>
                      </div>
                      {paidPercent < 100 && totalSell > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">{t('res.due')}: {(totalSell - clientPaid).toLocaleString()}</div>}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap hidden xl:table-cell">
                      {(() => {
                        const suppPaid = res.amountPaidToSupplier || 0;
                        const suppPercent = totalBuy > 0 ? Math.round((suppPaid / totalBuy) * 100) : 0;
                        return (
                          <>
                            <div className="font-mono font-bold text-indigo-700">{suppPaid.toLocaleString()} <span className="text-[8px] text-slate-400">SAR</span></div>
                            <div className="text-[9px] text-slate-400 font-bold">{t('res.of')} {totalBuy.toLocaleString()} ({suppPercent}%)</div>
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-1 ml-auto overflow-hidden">
                              <div className={`h-full rounded-full ${suppPercent >= 100 ? 'bg-emerald-500' : suppPercent > 0 ? 'bg-blue-400' : 'bg-slate-200'}`} style={{ width: `${Math.min(suppPercent, 100)}%` }}></div>
                            </div>
                            {suppPercent < 100 && totalBuy > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">{t('res.due')}: {(totalBuy - suppPaid).toLocaleString()}</div>}
                          </>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap hidden xl:table-cell">
                      <div className={`font-mono font-bold text-[11px] ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{netProfit.toLocaleString()} SAR</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setViewingId(res.id.toString())}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded border border-slate-200 text-[10px] whitespace-nowrap"
                          title={t('res.viewReservation')}
                        >
                          {t('res.detailsPay')}
                        </button>
                        <button
                          onClick={() => {
                            const outstanding = totalSell - (res.amountPaidByClient || 0);
                            if (outstanding <= 0) { toast.info('Client has fully paid this booking.'); return; }
                            openConfirm('Record Client Payment', `Quick-record full client payment of ${outstanding.toLocaleString()} SAR for RSV-${res.id}?\n\nYou will need to select a treasury account in the Details pane.`, () => {
                              setViewingId(res.id.toString());
                              setActiveDetailTab('payment');
                              setPayAmount(outstanding);
                            });
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-1.5 py-1 rounded border border-emerald-200 text-[9px] whitespace-nowrap"
                          title={t('res.recordPayment')}
                        >
                          {t('res.clientPay')}
                        </button>
                        <button
                          onClick={() => {
                            const outstanding = totalBuy - (res.amountPaidToSupplier || 0);
                            if (outstanding <= 0) { toast.info('Supplier has been fully paid.'); return; }
                            openConfirm('Record Supplier Payment', `Quick-record full supplier payment of ${outstanding.toLocaleString()} SAR for RSV-${res.id}?\n\nYou will need to select a treasury account in the Details pane.`, () => {
                              setViewingId(res.id.toString());
                              setActiveDetailTab('payment');
                              setPayAmount(outstanding);
                            });
                          }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-1.5 py-1 rounded border border-blue-200 text-[9px] whitespace-nowrap"
                          title={t('res.recordPayment')}
                        >
                          {t('res.supplierPay')}
                        </button>
                        <button
                          onClick={() => setPrintingDoc({ res: res, isVoucher: false })}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded border border-indigo-200 text-[10px] whitespace-nowrap hidden lg:block"
                          title={t('res.confirmation')}
                        >
                          {t('res.confirmation')}
                        </button>
                        <button
                          onClick={() => setPrintingDoc({ res: res, isVoucher: true })}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded border border-emerald-200 text-[10px] whitespace-nowrap hidden lg:block"
                          title={t('res.printVoucher')}
                        >
                          {t('res.voucher')}
                        </button>
                        <button
                          onClick={() => setPrintingInvoice(res)}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded border border-purple-200 text-[10px] whitespace-nowrap hidden lg:block"
                          title={t('res.printInvoice')}
                        >
                          {t('res.invoice')}
                        </button>
                        <button
                          onClick={() => {
                            const c = agents.find(a => a.id === res.clientId);
                            const phone = (c?.phone || '').replace(/[^0-9]/g, '');
                            if (!phone) { toast.warning('Client has no phone number'); return; }
                            const h = hotels.find(ht => ht.id === res.hotelId);
                            const { totalSell } = getReservationTotals(res);
                            const roomSummary = res.rooms.map(rm => `${rm.qty}x ${rm.roomType}`).join(', ');
                            const msg = encodeURIComponent(
                              `*Zumra Hotels - Booking RSV-${res.id}*\n` +
                              `Guest: ${res.guestName}\n` +
                              `Hotel: ${h?.name || ''}\n` +
                              `Check-in: ${res.checkIn} | Check-out: ${res.checkOut} (${res.nights}N)\n` +
                              `Rooms: ${roomSummary}\n` +
                              `Total: ${totalSell.toLocaleString()} SAR\n` +
                              `Status: ${res.status}`
                            );
                            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                          }}
                          className="bg-green-50 hover:bg-green-100 text-green-700 font-bold px-1.5 py-1 rounded border border-green-200 text-[9px] whitespace-nowrap hidden lg:block"
                          title="Send via WhatsApp"
                        >
                          WhatsApp
                        </button>
                        <button
                          onClick={() => cloneReservation(res)}
                          className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold px-1.5 py-1 rounded border border-cyan-200 text-[9px] whitespace-nowrap hidden lg:block"
                          title="Clone this reservation"
                        >
                          📋 Clone
                        </button>
                        <button
                          onClick={() => handleEdit(res)}
                          className="p-1 hover:bg-amber-55/35 text-amber-800 rounded"
                          title="Edit booking"
                        >
                           ✍️
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete reservation RSV-' + res.id + '?')) onDeleteReservation(res.id.toString());
                          }}
                          className="p-1 hover:bg-rose-50 text-red-650 rounded"
                          title="Remove booking"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReservations.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-16 text-center animate-fade-in">
                    <div className="text-5xl mb-4">📋</div>
                    <p className="text-sm font-bold text-slate-500">{t('res.noReservations')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('res.tryAdjustFilters')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Load More footer */}
          <div className="flex items-center justify-center gap-3 px-2 py-3 border-t border-slate-150 text-xs mt-2">
            <span className="text-slate-500">Showing <span className="font-bold text-slate-800">{sortedReservations.length}</span> reservations</span>
            {hasMoreReservations ? (
              <button onClick={onLoadMoreReservations} className="px-4 py-1.5 bg-indigo-50 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-100 transition border border-indigo-200">
                Load 50 more ▾
              </button>
            ) : (
              <span className="text-slate-400 italic">All reservations loaded</span>
            )}
          </div>
        </div>
        </>
      )}

      {/* Detailed Reservation overlay card - Redesigned with tabs */}
      {viewingId && (() => {
        const resObj = reservations.find(r => r.id.toString() === viewingId);
        if (!resObj) return null;
        const hotelObj = hotels.find(h => h.id === resObj.hotelId);
        const { totalSell, totalBuy, netProfit } = getReservationTotals(resObj);
        const nightsLocal = resObj.nights;
        const clientPaid = resObj.amountPaidByClient || 0;
        const supplierPaid = resObj.amountPaidToSupplier || 0;
        const clientRemaining = Math.max(totalSell - clientPaid, 0);
        const supplierRemaining = Math.max(totalBuy - supplierPaid, 0);
        const clientPct = totalSell > 0 ? Math.min(Math.round((clientPaid / totalSell) * 100), 100) : 0;
        const supplierPct = totalBuy > 0 ? Math.min(Math.round((supplierPaid / totalBuy) * 100), 100) : 0;
        const relatedTrs = transactions.filter(t => t.reservationId === resObj.id.toString());

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 overflow-y-auto" onClick={() => setViewingId(null)}>
            <div className="bg-white md:rounded-2xl shadow-2xl max-w-5xl w-full my-0 md:my-6 animate-in fade-in zoom-in-95 text-xs overflow-hidden max-h-[100vh] md:max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

              {/* Header Bar */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded-lg text-[10px] font-black">RSV-{resObj.id}</span>
                    {resObj.guestName}
                  </h3>
                  <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                    {hotelObj?.name}  {resObj.checkIn}    •   {resObj.checkOut} ({nightsLocal}N)  By <span className="text-amber-400 font-bold">{resObj.createdBy || 'Hazem'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${
                    resObj.status === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                    resObj.status === 'Cancelled' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                    'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>{resObj.status}</span>
                  {/* Check-In/Check-Out Status Toggle */}
                  {resObj.status !== 'Cancelled' && (
                    <div className="flex rounded-lg overflow-hidden border border-white/20 text-[9px] font-bold">
                      {(['Expected', 'Checked-In', 'Checked-Out'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => {
                            const updated = { ...resObj, checkInStatus: st };
                            onSaveReservation(updated);
                            toast.success(`Status → ${st}`);
                          }}
                          className={`px-2 py-1 transition whitespace-nowrap ${
                            (resObj.checkInStatus || 'Expected') === st
                              ? st === 'Checked-In' ? 'bg-blue-500 text-white' : st === 'Checked-Out' ? 'bg-purple-500 text-white' : 'bg-amber-500 text-white'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {st === 'Expected' ? '⏳' : st === 'Checked-In' ? '🔑' : '✅'} {st}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setViewingId(null); handleEdit(resObj); }} className="bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition">{t('common.edit')}</button>
                  <button onClick={() => { setViewingId(null); cloneReservation(resObj); }} className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold py-1.5 px-3 rounded-lg text-[10px] transition border border-cyan-500/30">📋 Clone</button>
                  <button onClick={() => setViewingId(null)} className="text-slate-400 hover:text-white text-lg transition"> ✕</button>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 bg-slate-50/50 px-2 md:px-4 overflow-x-auto">
                {([
                  { key: 'overview' as const, label: t('res.overview'), icon: '📋' },
                  { key: 'payment' as const, label: t('res.recordPaymentTitle'), icon: '💳' },
                  { key: 'agreements' as const, label: t('res.agreementsRooms'), icon: '⚙️' },
                  { key: 'documents' as const, label: t('res.documents'), icon: '📄' },
                  { key: 'history' as const, label: 'Timeline', icon: '🕐' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDetailTab(tab.key)}
                    className={`px-3 md:px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                      activeDetailTab === tab.key
                        ? 'border-amber-500 text-amber-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto thin-scrollbar">

                {/* ===== OVERVIEW TAB ===== */}
                {activeDetailTab === 'overview' && (
                  <div className="space-y-5">
                    {/* Guest & Booking Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-2">{t('res.guestInformation')}</h5>
                        <div className="grid grid-cols-2 gap-y-1.5">
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.leadGuest')}</span>
                          <span className="font-bold text-slate-900 text-sm uppercase">{resObj.guestName}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.nationality')}</span>
                          <span className="font-semibold text-slate-700">{resObj.guestNationality}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.stayPeriod')}</span>
                          <span className="font-mono text-slate-700 text-[10px]">{resObj.checkIn}    →   {resObj.checkOut}</span>
                        </div>
                        {resObj.status === 'Tentative' && (
                          <div className="mt-2 bg-rose-50 rounded-lg p-2.5 border border-rose-200 space-y-1">
                            <div className="text-[9px] uppercase font-bold text-rose-400 mb-1">{t('res.optionDeadlines')}</div>
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-rose-700">{t('res.client')}: {resObj.clientOptionDate || t('res.notSet')}</span>
                              <span className="text-rose-700">{t('res.supplier')}: {resObj.supplierOptionDate || t('res.notSet')}</span>
                            </div>
                          </div>
                        )}
                        {resObj.status === 'Confirmed' && (
                          <div className="mt-2 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                            <div className="text-[9px] uppercase font-bold text-emerald-400">{t('res.hotelConfirmation')}</div>
                            <div className="font-mono font-bold text-emerald-800 text-sm">{resObj.hotelConfirmationNo || 'Pending'}</div>
                          </div>
                        )}
                        {resObj.status === 'Cancelled' && (
                          <div className="mt-2 bg-rose-50 rounded-lg p-2.5 border border-rose-200">
                            <div className="text-[9px] uppercase font-bold text-rose-400">{t('res.cancellation')}</div>
                            <div className="text-[10px] text-rose-700">{resObj.cancellationReason || t('res.na')}</div>
                            {resObj.cancellationFee ? <div className="text-[10px] font-bold text-rose-800 mt-1">{t('res.penalty')}: {resObj.cancellationFee.toLocaleString()} SAR</div> : null}
                            {(resObj.clientCreditDisposition && resObj.clientCreditDisposition !== 'N/A') && (
                              <div className={`mt-1.5 text-[9px] font-bold px-2 py-1 rounded ${resObj.clientCreditDisposition === 'Refunded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                💵 Client: {resObj.clientCreditDisposition} {resObj.clientCreditNote ? ` — ${resObj.clientCreditNote}` : ''}
                              </div>
                            )}
                            {(resObj.supplierCreditDisposition && resObj.supplierCreditDisposition !== 'N/A') && (
                              <div className={`mt-1 text-[9px] font-bold px-2 py-1 rounded ${resObj.supplierCreditDisposition === 'Refunded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                💸 Supplier: {resObj.supplierCreditDisposition} {resObj.supplierCreditNote ? ` — ${resObj.supplierCreditNote}` : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-2">{t('res.bookingDetails')}</h5>
                        <div className="grid grid-cols-2 gap-y-1.5">
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.client')}</span>
                          <span className="font-semibold text-slate-800">{agents.find(a => a.id === resObj.clientId)?.companyName || t('res.na')}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.supplier')}</span>
                          <span className="font-semibold text-slate-800">{resObj.supplierId === 'DIRECT' ? `🏨 ${hotelObj?.name || 'Direct from Hotel'}` : (agents.find(a => a.id === resObj.supplierId)?.name || t('res.direct'))}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.hotel')}</span>
                          <span className="font-semibold text-slate-800">{hotelObj?.name}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.agreements')}</span>
                          <span className="font-mono text-slate-700">{resObj.agreementNo || t('res.direct')}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">{t('res.agreementStatus')}</span>
                          <span className="font-bold uppercase font-mono text-indigo-700">{resObj.agreementStatus || t('res.pending')}</span>
                        </div>
                        <div className="mt-2 bg-indigo-50 rounded-lg p-2.5 border border-indigo-200">
                          <div className="text-[9px] uppercase font-bold text-indigo-400 mb-1">{t('res.rooms')}</div>
                          {resObj.rooms.map((rm, i) => (
                            <div key={i} className="text-[10px] font-medium text-indigo-800">{rm.qty}x {rm.roomType} ({rm.view} / {rm.mealPlan})</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                      <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-3">{t('res.financialSummary')}</h5>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center mb-4">
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">{t('res.totalSale')}</span>
                          <span className="font-mono font-extrabold text-emerald-700 text-sm">{totalSell.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">{t('res.supplierCost')}</span>
                          <span className="font-mono font-extrabold text-amber-800 text-sm">{totalBuy.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className={`rounded-lg p-2.5 border ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">{t('res.netProfit')}</span>
                          <span className={`font-mono font-extrabold text-sm ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{netProfit.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">{t('res.clientDue')}</span>
                          <span className={`font-mono font-extrabold text-sm ${clientRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{clientRemaining.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">{t('res.supplierDue')}</span>
                          <span className={`font-mono font-extrabold text-sm ${supplierRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{supplierRemaining.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                      </div>

                      {/* Payment Progress Bars */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-slate-600">{t('res.clientPaid')}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${clientPct >= 100 ? 'bg-emerald-100 text-emerald-800' : clientPct > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
                              {clientPct >= 100 ? t('res.paid') : clientPct > 0 ? t('res.partial') : t('res.unpaid')} {clientPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                            <div className={`h-full rounded-full transition-all ${clientPct >= 100 ? 'bg-emerald-500' : clientPct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${clientPct}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-emerald-700 font-bold">{clientPaid.toLocaleString()} SAR</span>
                            <span className="text-slate-400">{t('res.of')} {totalSell.toLocaleString()} SAR</span>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-slate-600">{t('res.supplierPaid')}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${supplierPct >= 100 ? 'bg-emerald-100 text-emerald-800' : supplierPct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-700'}`}>
                              {supplierPct >= 100 ? t('res.paid') : supplierPct > 0 ? t('res.partial') : t('res.unpaid')} {supplierPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                            <div className={`h-full rounded-full transition-all ${supplierPct >= 100 ? 'bg-emerald-500' : supplierPct > 0 ? 'bg-blue-400' : 'bg-slate-200'}`} style={{ width: `${supplierPct}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-indigo-700 font-bold">{supplierPaid.toLocaleString()} SAR</span>
                            <span className="text-slate-400">{t('res.of')} {totalBuy.toLocaleString()} SAR</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Commission Summary */}
                    {(resObj.salesPersonCommissionAmount || resObj.supplierCommissionAmount) && (() => {
                      const spName = resObj.salesPersonId ? (salesPersons.find(sp => sp.id === resObj.salesPersonId)?.name || 'Unknown') : null;
                      const supName = resObj.supplierId && resObj.supplierId !== 'DIRECT' ? (agents.find(a => a.id === resObj.supplierId)?.name || 'Unknown') : null;
                      return (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                          <h5 className="font-bold text-[10px] uppercase text-purple-500 tracking-widest border-b border-purple-200 pb-1.5 mb-3">Commission Summary</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {spName && resObj.salesPersonCommissionAmount != null && (
                              <div className="bg-white rounded-lg p-3 border border-purple-100">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold text-purple-700">Sales Person</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${resObj.commissionPaidToSalesPerson ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {resObj.commissionPaidToSalesPerson ? 'PAID' : 'PENDING'}
                                  </span>
                                </div>
                                <div className="text-[10px] font-semibold text-slate-700">{spName}</div>
                                <div className="flex justify-between items-end mt-1">
                                  <span className="text-[9px] font-mono text-slate-500">{resObj.salesPersonCommissionRate || 0} SAR/room/night</span>
                                  <span className="font-mono font-bold text-purple-800 text-sm">{resObj.salesPersonCommissionAmount?.toLocaleString()} SAR</span>
                                </div>
                              </div>
                            )}
                            {supName && resObj.supplierCommissionAmount != null && (
                              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold text-indigo-700">Supplier Markup</span>
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{resObj.status === 'Cancelled' ? 'REVERSED' : 'ACTIVE'}</span>
                                </div>
                                <div className="text-[10px] font-semibold text-slate-700">{supName}</div>
                                <div className="flex justify-between items-end mt-1">
                                  <span className="text-[9px] font-mono text-slate-500">{resObj.supplierCommissionRate || 0}% of Buy</span>
                                  <span className="font-mono font-bold text-indigo-800 text-sm">{resObj.supplierCommissionAmount?.toLocaleString()} SAR</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Payment History */}
                    {relatedTrs.length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest mb-2">{t('res.paymentHistory')} ({relatedTrs.length} {t('res.transactions')})</h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {relatedTrs.map(tr => (
                            <div key={tr.id} className="flex justify-between items-center text-[10px] bg-slate-50 px-3 py-1.5 rounded-lg">
                              <span className="font-mono text-slate-500 w-20">{tr.date}</span>
                              <span className={`font-bold px-2 py-0.5 rounded-full text-[9px] ${tr.type === 'ClientPayment' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                {tr.type === 'ClientPayment' ? 'Client' : 'Supplier'}
                              </span>
                              <span className={`font-bold font-mono ${tr.type === 'ClientPayment' ? 'text-emerald-700' : 'text-indigo-700'}`}>
                                +{tr.amount.toLocaleString()} SAR
                              </span>
                              <span className="text-slate-400 font-mono w-24 text-right">{tr.voucherNo}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== PAYMENT TAB ===== */}
                {activeDetailTab === 'payment' && (
                  <div className="space-y-5">
                    {/* Direction Tabs */}
                    <div className="flex rounded-xl overflow-hidden border-2 border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setPayDirection('client');
                          setPayAmount(clientRemaining);
                          setPayAccountId('');
                          setPayVoucher(getNextVoucherNo('REC', transactions || []));
                        }}
                        className={`flex-1 py-3 px-4 text-center font-bold text-xs uppercase tracking-wider transition-all ${
                          payDirection === 'client'
                            ? 'bg-emerald-600 text-white shadow-inner'
                            : 'bg-white text-slate-500 hover:bg-emerald-50'
                        }`}
                      >
                        <span className="text-lg mr-1.5">📥</span> Money IN (Client)
                        <div className={`text-[10px] mt-0.5 font-mono ${payDirection === 'client' ? 'text-emerald-100' : 'text-slate-400'}`}>
                          Outstanding: {clientRemaining.toLocaleString()} SAR
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPayDirection('supplier');
                          setPayAmount(supplierRemaining);
                          setPayAccountId('');
                          setPayVoucher(getNextVoucherNo('PAY', transactions || []));
                        }}
                        className={`flex-1 py-3 px-4 text-center font-bold text-xs uppercase tracking-wider transition-all ${
                          payDirection === 'supplier'
                            ? 'bg-blue-600 text-white shadow-inner'
                            : 'bg-white text-slate-500 hover:bg-blue-50'
                        }`}
                      >
                        <span className="text-lg mr-1.5">📤</span> Money OUT (Supplier)
                        <div className={`text-[10px] mt-0.5 font-mono ${payDirection === 'supplier' ? 'text-blue-100' : 'text-slate-400'}`}>
                          Outstanding: {supplierRemaining.toLocaleString()} SAR
                        </div>
                      </button>
                    </div>

                    {/* Direction Banner */}
                    <div className={`rounded-lg px-4 py-2.5 flex items-center justify-between ${
                      payDirection === 'client' ? 'bg-emerald-50 border border-emerald-200' : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{payDirection === 'client' ? '📥' : '📤'}</span>
                        <div>
                          <div className={`text-[10px] font-bold uppercase ${payDirection === 'client' ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {payDirection === 'client' ? 'Receiving FROM Client' : 'Paying TO Supplier'}
                          </div>
                          <div className={`text-xs font-semibold ${payDirection === 'client' ? 'text-emerald-900' : 'text-blue-900'}`}>
                            {payDirection === 'client'
                              ? (agents.find(a => a.id === resObj.clientId)?.companyName || agents.find(a => a.id === resObj.clientId)?.name || 'Client')
                              : (agents.find(a => a.id === resObj.supplierId)?.name || 'Supplier')}
                          </div>
                        </div>
                      </div>
                      <div className={`font-mono font-extrabold text-lg ${payDirection === 'client' ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {(payDirection === 'client' ? clientRemaining : supplierRemaining).toLocaleString()} SAR
                      </div>
                    </div>

                    {/* Payment Form */}
                    <div className={`bg-white rounded-xl p-5 border-2 shadow-sm ${
                      payDirection === 'client' ? 'border-emerald-300' : 'border-blue-300'
                    }`}>
                      <h5 className={`font-bold text-xs uppercase pb-2 mb-4 border-b flex items-center gap-2 ${
                        payDirection === 'client' ? 'text-emerald-700 border-emerald-200' : 'text-blue-700 border-blue-200'
                      }`}>
                        <span>{payDirection === 'client' ? '📥' : '📤'}</span>
                        {payDirection === 'client' ? 'Client Receipt Details' : 'Supplier Payment Details'}
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Amount Section */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.paymentAmount')}</label>
                            <input
                              type="number"
                              value={payAmount || ''}
                              onChange={(e) => setPayAmount(Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 px-4 rounded-xl py-2.5 text-lg font-mono font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-amber-500"
                              placeholder="0.00"
                              required
                            />
                          </div>

                          {/* Currency Toggle */}
                          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                            <button type="button" onClick={() => setPayCurrency('SAR')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition ${payCurrency === 'SAR' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>SAR</button>
                            <button type="button" onClick={() => setPayCurrency('EGP')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition ${payCurrency === 'EGP' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>EGP</button>
                          </div>

                          {payCurrency === 'EGP' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.egpAmount')}</label>
                                <input type="number" value={payOriginalAmount || ''} onChange={(e) => setPayOriginalAmount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-bold" required />
                              </div>
                              <div>
                                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.exchangeRate')}</label>
                                <input type="number" value={payExchangeRate || ''} step="0.01" onChange={(e) => setPayExchangeRate(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-bold" required />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Method & Account Section */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.paymentMethod')}</label>
                            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                              <button type="button" onClick={() => setPayMethod('Bank Transfer')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition ${payMethod === 'Bank Transfer' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>🏦 Bank Transfer</button>
                              <button type="button" onClick={() => setPayMethod('Cash')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition ${payMethod === 'Cash' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>💵 Cash</button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.treasuryAccount')}</label>
                            <select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 rounded-xl py-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500" required>
                              <option value="">{t('res.selectAccount')}</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} SAR)</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.voucherReference')}</label>
                            <input type="text" value={payVoucher} onChange={(e) => setPayVoucher(e.target.value)} placeholder="REC-5509" className="w-full bg-slate-50 border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-semibold" />
                          </div>
                        </div>
                      </div>

                      {/* Action Button - Single, clear, colored */}
                      <div className="mt-5 pt-4 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => handlePostBookingPayment(payDirection === 'client')}
                          className={`w-full font-bold py-3.5 rounded-xl transition text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 ${
                            payDirection === 'client'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {payDirection === 'client' ? '📥 POST CLIENT RECEIPT' : '📤 POST SUPPLIER PAYMENT'}
                        </button>
                      </div>
                    </div>

                    {/* Recent Payment Transactions */}
                    {relatedTrs.length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest mb-2">{t('res.recentTransactions')}</h5>
                        <div className="space-y-1">
                          {relatedTrs.slice().reverse().map(tr => (
                            <div key={tr.id} className="flex justify-between items-center text-[10px] bg-slate-50 px-3 py-2 rounded-lg">
                              <span className="font-mono text-slate-500 w-20">{tr.date}</span>
                              <span className={`font-bold px-2 py-0.5 rounded-full text-[9px] ${tr.type === 'ClientPayment' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                {tr.type === 'ClientPayment' ? '📥 Client' : '📤 Supplier'}
                              </span>
                              <span className={`font-bold font-mono ${tr.type === 'ClientPayment' ? 'text-emerald-700' : 'text-indigo-700'}`}>
                                +{tr.amount.toLocaleString()} SAR
                              </span>
                              <span className="text-slate-400 font-mono w-24 text-right">{tr.voucherNo}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== AGREEMENTS & ROOMS TAB ===== */}
                {activeDetailTab === 'agreements' && (
                  <div className="space-y-5">
                    {/* Confirmation Details */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <h5 className="font-bold text-xs uppercase text-slate-700 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                        <span className="text-amber-500">●</span> {t('res.confAgreementDetails')}
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.hotelConfNumber')}</label>
                          <input type="text" value={localHotelConf} onChange={(e) => setLocalHotelConf(e.target.value)} placeholder="e.g. CONF-99201" className="w-full bg-slate-50 border border-slate-200 px-3 rounded-xl py-2 text-xs font-mono font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">{t('res.agreementContractId')}</label>
                          <input type="text" value={localAgreementNo} onChange={(e) => setLocalAgreementNo(e.target.value)} placeholder="e.g. CONTRACT-ZM502" className="w-full bg-slate-50 border border-slate-200 px-3 rounded-xl py-2 text-xs font-mono font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[9px] uppercase font-bold text-slate-500 block mb-2">{t('res.agreementStatus')}</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(['Approved', 'Pending', 'Declined'] as const).map((statusVal) => (
                              <button
                                key={statusVal}
                                type="button"
                                onClick={() => setLocalAgreementStatus(statusVal)}
                                className={`py-2.5 px-3 text-[10px] font-bold rounded-xl border-2 transition-all text-center ${
                                  localAgreementStatus === statusVal
                                    ? statusVal === 'Approved' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' :
                                      statusVal === 'Declined' ? 'bg-rose-600 border-rose-600 text-white shadow-md' :
                                      'bg-amber-500 border-amber-500 text-white shadow-md'
                                    : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'
                                }`}
                              >
                                {statusVal === 'Approved' ? ' ✅' : statusVal === 'Declined' ? ' ❌' : ' ⏳'} {statusVal}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rooming List */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <h5 className="font-bold text-xs uppercase text-slate-700 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                        <span className="text-amber-500">●</span> {t('res.roomingListGuests')}
                      </h5>
                      <div className="space-y-2 max-h-60 overflow-y-auto thin-scrollbar">
                        {localRoomDetails.map((rm, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <div className="flex bg-slate-100 rounded-lg px-2.5 items-center justify-center font-bold text-slate-400 text-xs w-8 h-8 shrink-0">
                              {idx + 1}
                            </div>
                            <input
                              type="text"
                              value={rm.name}
                              onChange={(e) => { const d = [...localRoomDetails]; d[idx].name = e.target.value; setLocalRoomDetails(d); }}
                              placeholder="Guest Name"
                              className="flex-1 bg-slate-50 border border-slate-200 px-3 rounded-lg py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                            />
                            <input
                              type="text"
                              value={rm.confNo}
                              onChange={(e) => { const d = [...localRoomDetails]; d[idx].confNo = e.target.value; setLocalRoomDetails(d); }}
                              placeholder="Conf #"
                              className="w-28 bg-slate-50 border border-slate-200 px-3 rounded-lg py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button type="button" onClick={handleUpdateConfirmationSpecs} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition text-[10px] uppercase tracking-wider shadow-md flex items-center justify-center gap-2">
                        {t('res.saveConfDetails')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { const r = reservations.find(r => r.id.toString() === viewingId); if (r) setPrintingRoomingList(r); }}
                        className="flex-1 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-[10px] uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        {t('res.printRoomingList')}
                      </button>
                    </div>
                  </div>
                )}

                {/* ===== DOCUMENTS TAB ===== */}
                {activeDetailTab === 'documents' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200 text-center hover:shadow-lg transition-shadow">
                        <div className="text-4xl mb-3">📄</div>
                        <h5 className="font-bold text-sm text-slate-800 mb-1">{t('res.agentConfirmation')}</h5>
                        <p className="text-[10px] text-slate-500 mb-4">{t('res.agentConfDesc')}</p>
                        <button
                          onClick={() => setPrintingDoc({ res: resObj, isVoucher: false })}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl transition shadow text-xs w-full"
                        >
                          {t('res.printConfirmationPDF')}
                        </button>
                      </div>
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200 text-center hover:shadow-lg transition-shadow">
                        <div className="text-4xl mb-3">🎫</div>
                        <h5 className="font-bold text-sm text-slate-800 mb-1">{t('res.guestCardVoucher')}</h5>
                        <p className="text-[10px] text-slate-500 mb-4">{t('res.guestCardDesc')}</p>
                        <button
                          onClick={() => setPrintingDoc({ res: resObj, isVoucher: true })}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition shadow text-xs w-full"
                        >
                          {t('res.printVoucherPDF')}
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest mb-3">{t('res.quickActions')}</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <button
                          onClick={() => { setViewingId(null); handleEdit(resObj); }}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-[10px] uppercase flex items-center justify-center gap-1.5"
                        >
                          {t('res.editBooking')}
                        </button>
                        <button
                          onClick={() => { const r = reservations.find(r => r.id.toString() === viewingId); if (r) setPrintingRoomingList(r); }}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-[10px] uppercase flex items-center justify-center gap-1.5"
                        >
                          {t('res.roomingList')}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete reservation RSV-' + resObj.id + '? This cannot be undone.')) {
                              onDeleteReservation(resObj.id.toString());
                              setViewingId(null);
                            }
                          }}
                          className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-bold py-2.5 rounded-xl transition text-[10px] uppercase flex items-center justify-center gap-1.5"
                        >
                          {t('res.deleteBooking')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== HISTORY TAB ===== */}
                {activeDetailTab === 'history' && (
                  <div className="space-y-3">
                    <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest">Activity Timeline</h5>
                    <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-4">
                      {/* Creation event */}
                      <div className="relative">
                        <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow"></div>
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-emerald-800 text-[11px]">Reservation Created</span>
                            <span className="text-[9px] text-slate-400 font-mono">{resObj.createdAt}</span>
                          </div>
                          <div className="text-[10px] text-slate-600">by {resObj.createdBy || 'System'}</div>
                        </div>
                      </div>
                      {/* Status event */}
                      {resObj.status !== 'Tentative' && (
                        <div className="relative">
                          <div className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-white shadow ${resObj.status === 'Confirmed' ? 'bg-blue-500' : 'bg-rose-500'}`}></div>
                          <div className={`rounded-lg p-3 border ${resObj.status === 'Confirmed' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`font-bold text-[11px] ${resObj.status === 'Confirmed' ? 'text-blue-800' : 'text-rose-800'}`}>Status: {resObj.status}</span>
                              {resObj.hotelConfirmationNo && <span className="text-[9px] text-slate-400 font-mono">Hotel Conf#: {resObj.hotelConfirmationNo}</span>}
                            </div>
                            {resObj.cancellationReason && <div className="text-[10px] text-slate-600">Reason: {resObj.cancellationReason}</div>}
                          </div>
                        </div>
                      )}
                      {/* Amendment entries */}
                      {resObj.amendmentHistory && resObj.amendmentHistory.map((entry) => (
                        <div key={entry.id} className="relative">
                          <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow"></div>
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-800 text-[11px]">{entry.field}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{new Date(entry.timestamp).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-rose-600 line-through">{entry.oldValue}</span>
                              <span className="text-slate-400">→</span>
                              <span className="text-emerald-700 font-semibold">{entry.newValue}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 mt-1">by {entry.user}</div>
                          </div>
                        </div>
                      ))}
                      {/* Audit log entries for this reservation */}
                      {auditLog.filter(e => e.entityType === 'Reservation' && e.entityId === resObj.id.toString()).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map(entry => (
                        <div key={entry.id} className="relative">
                          <div className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-white shadow ${entry.action.includes('Payment') || entry.action.includes('Client') ? 'bg-emerald-400' : entry.action.includes('Supplier') ? 'bg-blue-400' : entry.action.includes('Cancel') ? 'bg-rose-400' : 'bg-indigo-400'}`}></div>
                          <div className={`rounded-lg p-3 border ${entry.action.includes('Payment') || entry.action.includes('Client') ? 'bg-emerald-50 border-emerald-100' : entry.action.includes('Supplier') ? 'bg-blue-50 border-blue-100' : entry.action.includes('Cancel') ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`font-bold text-[11px] ${entry.action.includes('Payment') || entry.action.includes('Client') ? 'text-emerald-800' : entry.action.includes('Supplier') ? 'text-blue-800' : entry.action.includes('Cancel') ? 'text-rose-800' : 'text-indigo-800'}`}>{entry.action}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{new Date(entry.timestamp).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <div className="text-[10px] text-slate-600">{entry.detail}</div>
                            <div className="text-[9px] text-slate-400 mt-1">by {entry.user}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-6 py-3 bg-slate-50/50 flex justify-between items-center">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setPrintingDoc({ res: resObj, isVoucher: false })} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]">{t('res.confirmation')}</button>
                  <button onClick={() => setPrintingDoc({ res: resObj, isVoucher: true })} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]">{t('res.voucher')}</button>
                  <button onClick={() => setPrintingInvoice(resObj)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]">{t('res.invoice')}</button>
                  {isEmailConfigured && (() => {
                    const client = agents.find(a => a.id === resObj.clientId);
                    const hotel = hotels.find(h => h.id === resObj.hotelId);
                    const totals = getReservationTotals(resObj);
                    return (
                      <>
                        {client?.email && (
                          <button onClick={async () => {
                            const { totalSell } = totals;
                            const result = await sendBookingConfirmation(client.email, resObj.guestName, resObj.id, hotel?.name || '', resObj.checkIn, resObj.checkOut, totalSell);
                            if (result.success) toast.success('Confirmation email sent'); else toast.error(result.error || 'Email failed');
                          }} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]" title={`Send to ${client.email}`}>📧 Confirm</button>
                        )}
                        {client?.email && resObj.status !== 'Cancelled' && totals.totalSell > (resObj.amountPaidByClient || 0) && (
                          <button onClick={async () => {
                            const due = totals.totalSell - (resObj.amountPaidByClient || 0);
                            const result = await sendPaymentReminder(client.email, client.companyName || client.name, resObj.id, resObj.guestName, due, resObj.checkIn);
                            if (result.success) toast.success('Reminder email sent'); else toast.error(result.error || 'Email failed');
                          }} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]" title={`Send reminder to ${client.email}`}>📧 Remind</button>
                        )}
                      </>
                    );
                  })()}
                  {/* WhatsApp Confirmation */}
                  {(() => {
                    const client = agents.find(a => a.id === resObj.clientId);
                    const hotel = hotels.find(h => h.id === resObj.hotelId);
                    const totals = getReservationTotals(resObj);
                    const phone = (client?.phone || '').replace(/[^0-9+]/g, '');
                    if (!phone) return null;
                    const msg = encodeURIComponent(
                      `Zumra Hotels - Booking Confirmation\n\n` +
                      `RSV: ${resObj.id}\nGuest: ${resObj.guestName}\n` +
                      `Hotel: ${hotel?.name || ''}\n` +
                      `Check-in: ${resObj.checkIn}\nCheck-out: ${resObj.checkOut}\n` +
                      `Nights: ${resObj.nights}\nTotal: ${totals.totalSell.toLocaleString()} SAR\n` +
                      `Status: ${resObj.status}`
                    );
                    return (
                      <a href={`https://wa.me/${phone.startsWith('+') ? phone.slice(1) : phone}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px] inline-flex items-center gap-1 no-underline">
                        <span>💬</span> WhatsApp
                      </a>
                    );
                  })()}
                  {/* Supplier Rate Confirmation */}
                  {resObj.status === 'Confirmed' && (() => {
                    const supplier = agents.find(a => a.id === resObj.supplierId);
                    const hotel = hotels.find(h => h.id === resObj.hotelId);
                    const totals = getReservationTotals(resObj);
                    if (!supplier?.email) return null;
                    return (
                      <button onClick={async () => {
                        const result = await sendSupplierRateConfirmation(supplier.email, supplier.name || supplier.companyName || '', resObj.id, resObj.guestName, hotel?.name || '', resObj.checkIn, resObj.checkOut, resObj.nights, totals.totalBuy, resObj.supplierVoucher);
                        if (result.success) toast.success('Rate confirmation sent to supplier'); else toast.error(result.error || 'Email failed');
                      }} className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]" title={`Send rate confirmation to ${supplier.email}`}>📧 Supplier</button>
                    );
                  })()}
                  <button onClick={() => {
                    setCompareIds(prev => prev.includes(resObj.id) ? prev.filter(id => id !== resObj.id) : prev.length < 2 ? [...prev, resObj.id] : prev);
                  }} className={`font-bold px-3 py-1.5 rounded-lg transition text-[10px] ${
                    compareIds.includes(resObj.id) ? 'bg-cyan-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                  }`}>{compareIds.includes(resObj.id) ? '✓ Comparing' : '⇔ Compare'}</button>
                </div>
                <button onClick={() => setViewingId(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-1.5 rounded-lg transition text-[10px]">{t('common.close')}</button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Confirmation Letter and Voucher print layout overlays */}
      {printingDoc && (
        <ConfirmationPDF
          reservation={printingDoc.res}
          client={agents.find(a => a.id === printingDoc.res.clientId)}
          hotel={hotels.find(h => h.id === printingDoc.res.hotelId)}
          type={printingDoc.isVoucher ? 'voucher' : 'definite'}
          onClose={() => setPrintingDoc(null)}
          creatorName={printingDoc.res.createdBy || currentUser}
          users={users}
          accounts={accounts}
          termsAndConditionsList={termsAndConditions}
        />
      )}

      {/* Invoice PDF overlay */}
      {printingInvoice && (
        <InvoicePDF
          reservation={printingInvoice}
          client={agents.find(a => a.id === printingInvoice.clientId)}
          hotel={hotels.find(h => h.id === printingInvoice.hotelId)}
          transactions={transactions}
          onClose={() => setPrintingInvoice(null)}
        />
      )}

      {/* Cancellation Wizard */}
      {cancelWizardRes && (
        <CancellationWizard
          reservation={cancelWizardRes}
          agents={agents}
          currentUser={currentUser}
          onConfirm={handleCancellationConfirm}
          onClose={() => setCancelWizardRes(null)}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDlg.open}
        title={confirmDlg.title}
        message={confirmDlg.message}
        variant={confirmDlg.variant}
        onConfirm={execConfirm}
        onCancel={closeConfirmDlg}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />

      {/* Booking Comparison Modal */}
      {compareIds.length === 2 && (() => {
        const r1 = reservations.find(r => r.id === compareIds[0]);
        const r2 = reservations.find(r => r.id === compareIds[1]);
        if (!r1 || !r2) return null;
        const h1 = hotels.find(h => h.id === r1.hotelId);
        const h2 = hotels.find(h => h.id === r2.hotelId);
        const t1 = getReservationTotals(r1);
        const t2 = getReservationTotals(r2);
        const fields: { label: string; v1: string | number; v2: string | number }[] = [
          { label: 'RSV', v1: `RSV-${r1.id}`, v2: `RSV-${r2.id}` },
          { label: 'Guest', v1: r1.guestName, v2: r2.guestName },
          { label: 'Hotel', v1: h1?.name || '', v2: h2?.name || '' },
          { label: 'Check-in', v1: r1.checkIn, v2: r2.checkIn },
          { label: 'Check-out', v1: r1.checkOut, v2: r2.checkOut },
          { label: 'Nights', v1: r1.nights, v2: r2.nights },
          { label: 'Status', v1: r1.status, v2: r2.status },
          { label: 'Total Buy', v1: t1.totalBuy, v2: t2.totalBuy },
          { label: 'Total Sell', v1: t1.totalSell, v2: t2.totalSell },
          { label: 'Profit', v1: t1.profit, v2: t2.profit },
          { label: 'Client Paid', v1: r1.amountPaidByClient || 0, v2: r2.amountPaidByClient || 0 },
          { label: 'Source', v1: r1.bookingSource || '-', v2: r2.bookingSource || '-' },
        ];
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setCompareIds([])}>
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">⇔ Booking Comparison</h2>
                <button onClick={() => setCompareIds([])} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-2 font-semibold text-slate-600 border-b">Field</th>
                    <th className="text-left p-2 font-semibold text-indigo-700 border-b">RSV-{r1.id}</th>
                    <th className="text-left p-2 font-semibold text-emerald-700 border-b">RSV-{r2.id}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(f => (
                    <tr key={f.label} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 font-medium text-slate-600">{f.label}</td>
                      <td className={`p-2 font-mono ${String(f.v1) !== String(f.v2) ? 'text-indigo-700 font-bold bg-indigo-50/50' : 'text-slate-700'}`}>{typeof f.v1 === 'number' ? f.v1.toLocaleString() : f.v1}</td>
                      <td className={`p-2 font-mono ${String(f.v1) !== String(f.v2) ? 'text-emerald-700 font-bold bg-emerald-50/50' : 'text-slate-700'}`}>{typeof f.v2 === 'number' ? f.v2.toLocaleString() : f.v2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Booking Templates Modal */}
      {showTemplates && (
        <BookingTemplatesModal
          templates={bookingTemplates}
          hotels={hotels}
          agents={agents}
          onSave={handleSaveTemplate}
          onLoad={handleLoadTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Credit Note PDF Modal */}
      {creditNoteEntry && (() => {
        const resForCN = reservations.find(r => r.id === creditNoteEntry.reservationId);
        if (!resForCN) return null;
        return (
          <CreditNotePDF
            reservation={resForCN}
            agents={agents}
            hotels={hotels}
            entry={creditNoteEntry}
            onClose={() => setCreditNoteEntry(null)}
          />
        );
      })()}

      {/* Supplier Rate Comparison Modal */}
      {showRateCompare && rateCompareIdx !== null && (() => {
        const rm = rooms[rateCompareIdx];
        if (!rm) return null;
        const matchingAllotments = allotments.filter(a => {
          if (a.hotelId !== hotelId) return false;
          if (a.roomType !== rm.roomType) return false;
          if (!checkIn || !checkOut) return false;
          return a.startDate < checkOut && a.endDate > checkIn;
        });
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowRateCompare(false); setRateCompareIdx(null); }}>
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">💰 Supplier Rate Comparison</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{rm.roomType} • {checkIn} → {checkOut} ({calculateNightsCount()}N)</p>
                </div>
                <button onClick={() => { setShowRateCompare(false); setRateCompareIdx(null); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              {matchingAllotments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="font-bold">No matching allotments found</p>
                  <p className="text-xs mt-1">Try different dates or room type</p>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-50">
                      <th className="text-left p-2.5 font-bold text-emerald-800 border-b border-emerald-200">Supplier</th>
                      <th className="text-left p-2.5 font-bold text-emerald-800 border-b border-emerald-200">Room Type</th>
                      <th className="text-left p-2.5 font-bold text-emerald-800 border-b border-emerald-200">Period</th>
                      <th className="text-right p-2.5 font-bold text-emerald-800 border-b border-emerald-200">Cost/Night</th>
                      <th className="text-right p-2.5 font-bold text-emerald-800 border-b border-emerald-200">Sell/Night</th>
                      <th className="text-right p-2.5 font-bold text-emerald-800 border-b border-emerald-200">Available</th>
                      <th className="text-center p-2.5 font-bold text-emerald-800 border-b border-emerald-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingAllotments.map(a => {
                      const supplier = agents.find(ag => ag.id === a.supplierId);
                      const applicablePeriod = a.ratePeriods?.find(rp => rp.startDate < checkOut && rp.endDate > checkIn);
                      const avail = a.totalRooms - a.bookedRooms;
                      return (
                        <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{supplier?.name || a.supplierId}</td>
                          <td className="p-2.5 text-slate-600">{a.roomType}</td>
                          <td className="p-2.5 text-slate-500 font-mono text-[10px]">{applicablePeriod ? `${applicablePeriod.startDate} → ${applicablePeriod.endDate}` : `${a.startDate} → ${a.endDate}`}</td>
                          <td className="p-2.5 text-right font-bold text-red-600">{applicablePeriod ? applicablePeriod.costPerNight.toLocaleString() : '-'}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">{applicablePeriod ? applicablePeriod.sellRatePerNight.toLocaleString() : '-'}</td>
                          <td className={`p-2.5 text-right font-bold ${avail > 3 ? 'text-green-600' : avail > 0 ? 'text-amber-600' : 'text-red-500'}`}>{avail} / {a.totalRooms}</td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => {
                                if (applicablePeriod) {
                                  const updated = [...rooms];
                                  updated[rateCompareIdx] = {
                                    ...updated[rateCompareIdx],
                                    buyPriceNum: applicablePeriod.costPerNight,
                                    sellPriceNum: applicablePeriod.sellRatePerNight,
                                  };
                                  setRooms(updated);
                                  setShowRateCompare(false);
                                  setRateCompareIdx(null);
                                  toast.success('Rates applied from allotment');
                                }
                              }}
                              disabled={!applicablePeriod}
                              className="px-2 py-1 bg-emerald-500 text-white rounded text-[9px] font-bold hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                            >
                              Apply Rates
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
