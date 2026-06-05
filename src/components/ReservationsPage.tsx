/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel, RoomLine, Transaction, Account, User } from '../types';
import ZumraLogo from './ZumraLogo';
import { getReservationTotals, getEgyptTime, exportToCSV } from '../lib/storage';
import ConfirmationPDF from './ConfirmationPDF';
import InvoicePDF from './InvoicePDF';

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
  accounts?: Account[];
  onSaveTransaction?: (tr: Transaction) => void;
  transactions?: Transaction[];
}

export default function ReservationsPage({
  reservations,
  agents,
  hotels,
  users,
  currentUser,
  initialFilters,
  onSaveReservation,
  onDeleteReservation,
  accounts = [],
  onSaveTransaction,
  transactions = []
}: ReservationsPageProps) {
  
  // View states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [printingDoc, setPrintingDoc] = useState<{ res: Reservation; isVoucher: boolean } | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Reservation | null>(null);

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
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'payment' | 'agreements' | 'documents'>('overview');

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
        setPayVoucher(`PAY-${Date.now().toString().slice(-5)}`);
      }
    }
  }, [viewingId, reservations, accounts]);

  React.useEffect(() => {
    if (initialFilters?.viewReservationId) {
      setViewingId(String(initialFilters.viewReservationId));
      setSearchTerm(String(initialFilters.viewReservationId));
    }
    if (initialFilters?.showNewForm) {
      setShowForm(true);
      setEditingId(null);
      setViewingId(null);
      // Pre-populate default form values when coming from Dashboard
      if (hotels.length > 0 && !hotelId) {
        setHotelId(hotels[0].id);
      }
      const defaultClient = agents.find(a => a.type === 'Customer' || a.type === 'Both');
      const defaultSupplier = agents.find(a => a.type === 'Supplier' || a.type === 'Both');
      if (defaultClient && !clientId) setClientId(defaultClient.id);
      if (defaultSupplier && !supplierId) setSupplierId(defaultSupplier.id);
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
  
  const [amountPaidByClient, setAmountPaidByClient] = useState<number>(0);
  const [amountPaidToSupplier, setAmountPaidToSupplier] = useState<number>(0);

  // Rooms breakdown block
  const [rooms, setRooms] = useState<RoomSelection[]>([
    { roomType: 'Double', view: 'City View', mealPlan: 'B.B', qty: 1, pax: 2, buyPriceNum: 0, sellPriceNum: 0 }
  ]);

  const selectedHotelObj = hotels.find(h => h.id === hotelId);

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

  const handleEdit = (res: Reservation) => {
    setEditingId(res.id);
    setClientId(res.clientId);
    setSupplierId(res.supplierId);
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
    setSupplierVoucher(res.supplierVoucher || '');
    setCancellationFee(res.cancellationFee || 0);
    setCancellationReason(res.cancellationReason || '');
    setAmountPaidByClient(res.amountPaidByClient || 0);
    setAmountPaidToSupplier(res.amountPaidToSupplier || 0);
    
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !supplierId || !hotelId || !checkIn || !checkOut || !guestName) {
      alert('Please fill out all mandatory booking specs.');
      return;
    }

    // Direct auto incremental RSV ID counting
    let nextId = 1;
    if (!editingId) {
      nextId = reservations.reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
    } else {
      nextId = editingId;
    }

    const calculatedNights = calculateNightsCount();

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
      amountPaidByClient,
      amountPaidToSupplier,
      clientOptionDate: status === 'Tentative' ? clientOptionDate : undefined,
      supplierOptionDate: status === 'Tentative' ? supplierOptionDate : undefined,
      hotelConfirmationNo: status === 'Confirmed' ? hotelConfirmationNo : undefined,
      bankAccountId: bankAccountId || undefined,
      agreementNo,
      supplierVoucher,
      createdAt: editingId ? (reservations.find(r => r.id === editingId)?.createdAt || getEgyptTime().toISOString().replace('T', ' ').substring(0, 19)) : getEgyptTime().toISOString().replace('T', ' ').substring(0, 19),
      createdBy: currentUser
    };

    onSaveReservation(reservationToSave);
    resetForm();
    alert(`📅 Booking Reservation RSV-${nextId} saved successfully! Account indexes synchronized.`);
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
    setCancellationReason('');
    setAmountPaidByClient(0);
    setAmountPaidToSupplier(0);
    setRooms([{ roomType: 'Double', view: 'City View', mealPlan: 'B.B', qty: 1, pax: 2, buyPriceNum: 0, sellPriceNum: 0 }]);
    setShowForm(false);
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
      alert('✨ Agreement specifications and confirmation reference updated in ledger!');
    }
  };

  const handlePostBookingPayment = (isClientPayment: boolean) => {
    const resObj = reservations.find(r => r.id.toString() === viewingId);
    if (!resObj) return;

    let computedAmount = payAmount;
    if (payCurrency === 'EGP') {
      computedAmount = payOriginalAmount / payExchangeRate;
      if (!computedAmount || computedAmount <= 0) {
        alert('Exchange rate and EGP amount must be valid.');
        return;
      }
    }

    if (!computedAmount || computedAmount <= 0) {
      alert('Please specify a positive valid payment amount.');
      return;
    }
    if (!payAccountId) {
      alert('Please choose an active treasury account / bank account safe.');
      return;
    }

    const trType = isClientPayment ? 'ClientPayment' : 'SupplierPayment';
    const targetAgentId = isClientPayment ? resObj.clientId : resObj.supplierId;
    const agentObj = agents.find(a => a.id === targetAgentId);
    if (!agentObj) {
      alert('Associated agent account not located!');
      return;
    }

    const trDate = new Date().toISOString().split('T')[0];
    const newTr: Transaction = {
      id: `tr_${trType.toLowerCase()}_rsv_${resObj.id}_${Date.now()}`,
      docNo: (Date.now() % 10000000).toString(),
      date: trDate,
      type: trType,
      amount: computedAmount,
      fromAccountId: payAccountId,
      agentId: targetAgentId,
      description: isClientPayment 
        ? `Automatic Reservation Client Payment for RSV-${resObj.id} (Guest: ${resObj.guestName})`
        : `Automatic Reservation Supplier Payment for RSV-${resObj.id} (Hotel: ${hotels.find(h => h.id === resObj.hotelId)?.name})`,
      paymentMethod: payMethod,
      voucherNo: payVoucher || `VOP-${Date.now().toString().slice(-6)}`,
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

    if (onSaveTransaction) {
      onSaveTransaction(newTr);
    }
    onSaveReservation(updatedRes);

    alert(`✨ ${isClientPayment ? 'Client Receipt' : 'Supplier Payment'} of ${computedAmount.toLocaleString()} SAR registered & transaction #${newTr.voucherNo} ledgered successfully!`);
    
    // Refresh payment states
    setPayVoucher(`PAY-${Date.now().toString().slice(-5)}`);
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

  const handleExportCSV = () => {
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
        'Profit': totals.profit
      };
    });
    exportToCSV('reservations-export.csv', reportData);
  };

  const [printingRoomingList, setPrintingRoomingList] = useState<Reservation | null>(null);

  return (
    <div className="space-y-6 text-xs">
      
      {/* Upper hidden area for printing rooming list */}
      {printingRoomingList && (
        <div className="fixed inset-0 bg-white z-[9999] overflow-y-auto block print:block pb-16">
          <div className="flex justify-between items-center p-4 bg-slate-100 border-b border-slate-200 print:hidden text-xs">
            <h2 className="font-bold text-slate-800">Print Rooming List</h2>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="bg-indigo-650 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded shadow transition">Print List</button>
              <button onClick={() => setPrintingRoomingList(null)} className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded transition">Close (Esc)</button>
            </div>
          </div>
          
          <div id="rooming-list-pdf" className="bg-white p-8 max-w-4xl mx-auto my-8 print:my-0 shadow-sm print:shadow-none text-slate-900 font-sans border border-slate-200 print:border-none">
            <div className="flex justify-between items-center mb-2 border-b-[3px] border-slate-300 pb-2">
              <div className="flex flex-col text-left font-sans gap-1 flex-1">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
                  ZUMRA HOTELS
                </span>
                <span className="text-2xl font-bold text-slate-800 tracking-wider font-serif" dir="rtl">
                  زمرة للفنادق
                </span>
              </div>
              <div className="flex-shrink-0 flex justify-end">
                <ZumraLogo size="xxl" />
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-4 border-b border-slate-900 pb-1">
              <h2 className="text-[20px] font-extrabold tracking-tight">Rooming List</h2>
              <h2 className="text-[22px] font-extrabold" dir="rtl">تسكين الغرف</h2>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-[13px] font-medium mb-6">
              <div className="flex">
                <span className="w-32 font-bold">Res No :</span>
                <span>{printingRoomingList.id}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Hotel :</span>
                <span>{hotels.find(h => h.id === printingRoomingList.hotelId)?.name}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Arrival Date :</span>
                <span>{new Date(printingRoomingList.checkIn).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Departure Date :</span>
                <span>{new Date(printingRoomingList.checkOut).toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            <table className="w-full text-left text-[12px] border-collapse" style={{ border: '1px solid #1e293b' }}>
              <thead>
                <tr className="bg-slate-100/50">
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>Room Type</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>Meal Plan</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>Guest Name</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>Conf. No</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>Room No</th>
                  <th className="p-1.5 font-bold" style={{ border: '1px solid #1e293b' }}>Remarks</th>
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
                            <td className="p-1.5 text-[11px]" style={{ border: '1px solid #1e293b' }}>{rm.hasExtraBed ? '+ Extra Bed' : ''}</td>
                          </tr>
                        );
                      }
                      return rows;
                    });
                  })()
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center" style={{ border: '1px solid #1e293b' }}>
                      No rooms allocated.
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
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Reservation ledgers & Operations Console</h2>
              <p className="text-[10px] text-slate-450 mt-0.5">Filter, search, review details, and trigger confirmation PDF letters.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-indigo-200"
              >
                ⬇️ Export CSV
              </button>
              <button
                onClick={() => {
                resetForm();
                // Pick default hotel
                if (hotels.length > 0) {
                  setHotelId(hotels[0].id);
                  setClientId(agents.find(a => a.type === 'Customer' || a.type === 'Both')?.id || '');
                  setSupplierId(agents.find(a => a.type === 'Supplier' || a.type === 'Both')?.id || '');
                }
                setShowForm(true);
              }}
              className="bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5"
            >
              ➕ Book New Reservation
            </button>
          </div>
        </div>

          {/* Filtering row */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Search RSV# / Guest / Hotel</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="RSV-1001 or guest name"
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Check-In Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-white px-2 py-1.5 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Client / Agent</label>
              <select
                value={filterAgentId}
                onChange={(e) => setFilterAgentId(e.target.value)}
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs"
              >
                <option value="">-- All Clients --</option>
                {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => (
                  <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs"
              >
                <option value="">-- All Statuses --</option>
                <option value="Tentative">Tentative (معلق)</option>
                <option value="Confirmed">Confirmed (مؤكد)</option>
                <option value="Cancelled">Cancelled (ملغي)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Sort By</label>
              <select
                value={filterSort}
                onChange={(e) => setFilterSort(e.target.value)}
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs font-bold"
              >
                <option value="Newest">Creation: Newest</option>
                <option value="Oldest">Creation: Earliest</option>
                <option value="Check-In (Up)">Check-In: Earliest</option>
                <option value="Check-In (Down)">Check-In: Latest</option>
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
              {editingId ? `Edit Booking RSV-${editingId}` : 'New Reservation'}
            </h3>
            <div className="flex items-center gap-3">
              {/* Live Pricing Summary Badge */}
              {selectedHotelObj && checkIn && checkOut && (
                <div className="flex items-center gap-4 text-[10px] bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Nights: <strong className="text-slate-800">{calculateNightsCount()}</strong></span>
                                  <span className="text-red-600">Cost: <strong className="font-mono">{rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'buy'), 0).toLocaleString()}</strong></span>
                                  <span className="text-emerald-700">Sell: <strong className="font-mono">{rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'sell'), 0).toLocaleString()}</strong></span>
                                  <span className="text-amber-700">Profit: <strong className="font-mono">{rooms.reduce((acc, rm) => acc + (roomFullTotal(rm, 'sell') - roomFullTotal(rm, 'buy')), 0).toLocaleString()}</strong></span>
                </div>
              )}
              <button type="button" onClick={resetForm} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-xl transition shadow-sm">✕ Close</button>
            </div>
          </div>

          {/* Section 1: Booking Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="text-amber-600">●</span> Booking Assignment
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">👤 Customer / Agent</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors" required>
                  <option value="">-- Choose Customer --</option>
                  {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => (
                    <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">🏭 Supplier</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors" required>
                  <option value="">-- Choose Supplier --</option>
                  {agents.filter(a => a.type === 'Supplier' || a.type === 'Both').map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">🏨 Destination Hotel</label>
                <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); const matchedH = hotels.find(h => h.id === e.target.value); if (matchedH) { setRooms([{ roomType: matchedH.roomTypes[0] || 'Double', view: matchedH.views[0] || 'City View', mealPlan: matchedH.mealPlans[0] || 'B.B', qty: 1, pax: getPaxForRoomType(matchedH.roomTypes[0] || 'Double'), buyPriceNum: 100, sellPriceNum: 150 }]); } }} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-800 focus:bg-white focus:border-amber-500 transition-colors" required>
                  <option value="">-- Select Partner Hotel --</option>
                  {hotels.map(h => (
                    <option key={h.id} value={h.id}>{h.city === 'Makkah' ? '🕋' : '🕌'} {h.name}</option>
                  ))}
                </select>
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
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">🧳 Lead Guest Name</label>
                <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="MOHAMED AL-AHMADI" className="w-full bg-slate-50 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:bg-white transition-colors" required />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">🌍 Nationality</label>
                <input type="text" list="nationalities" value={guestNationality} onChange={(e) => setGuestNationality(e.target.value)} placeholder="Saudi" className="w-full bg-slate-50 px-3 py-2.5 border border-slate-200 rounded-xl text-sm uppercase focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">📊 Booking Status</label>
                <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {(['Tentative', 'Confirmed', 'Cancelled'] as const).map(s => (
                    <button key={s} type="button" onClick={() => {
                      if (s === 'Confirmed' && status !== 'Confirmed') {
                        const formTotalSell = rooms.reduce((acc, rm) => acc + roomFullTotal(rm, 'sell'), 0);
                        if (amountPaidByClient < formTotalSell && formTotalSell > 0) {
                          const owed = formTotalSell - amountPaidByClient;
                          if (!confirm(`\u26a0\ufe0f Client has not fully paid yet.\n\nPaid: ${amountPaidByClient.toLocaleString()} SAR\nTotal: ${formTotalSell.toLocaleString()} SAR\nOutstanding: ${owed.toLocaleString()} SAR\n\nDo you want to confirm this booking anyway?`)) {
                            return;
                          }
                        }
                      }
                      setStatus(s);
                      if (s !== 'Cancelled') { setCancellationFee(0); setCancellationReason(''); }
                      else { setCancellationReason('Customer requested cancellation (\u0637\u0644\u0628 \u0627\u0644\u0639\u0645\u064a\u0644)'); }
                      if (s === 'Confirmed') { setClientOptionDate(''); setSupplierOptionDate(''); }
                    }} className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${status === s ? s === 'Confirmed' ? 'bg-emerald-600 text-white shadow-sm' : s === 'Cancelled' ? 'bg-rose-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}>
                      <span className="text-[10px] leading-none">{s === 'Tentative' ? '⏳' : s === 'Confirmed' ? '✅' : '❌'}</span>{s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Room Configuration */}
          {selectedHotelObj && (
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
              <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2">
                  <span className="text-amber-600">●</span> Room Configuration
                </h4>
                <button type="button" onClick={handleAddRoomRow} className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1">+ Add Room Line</button>
              </div>

              <div className="space-y-3">
                {rooms.map((rm, idx) => {
                  const roomBuyTotal = roomFullTotal(rm, 'buy');
                  const roomSellTotal = roomFullTotal(rm, 'sell');
                  const roomProfit = roomSellTotal - roomBuyTotal;
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <div className="grid grid-cols-2 md:grid-cols-8 gap-3 items-end">
                        <div className="col-span-2">
                          <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Room Type</label>
                          <select value={rm.roomType} onChange={(e) => handleUpdateRoomRow(idx, { roomType: e.target.value })} className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold">
                            {selectedHotelObj.roomTypes.map((t, i) => (<option key={i} value={t}>{t}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">View</label>
                          <select value={rm.view} onChange={(e) => handleUpdateRoomRow(idx, { view: e.target.value })} className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs">
                            {selectedHotelObj.views.map((v, i) => (<option key={i} value={v}>{v}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Meal Plan</label>
                          <select value={rm.mealPlan} onChange={(e) => handleUpdateRoomRow(idx, { mealPlan: e.target.value })} className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg text-xs">
                            {selectedHotelObj.mealPlans.map((mp, i) => (<option key={i} value={mp}>{mp}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Qty</label>
                          <input type="number" min={1} value={rm.qty} onChange={(e) => handleUpdateRoomRow(idx, { qty: Number(e.target.value) })} className="w-full px-2 py-2 border border-slate-200 rounded-lg font-bold font-mono text-xs text-center" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Pax</label>
                          {rm.roomType.toLowerCase().includes('suite') ? (
                            <select value={rm.pax || 2} onChange={(e) => handleUpdateRoomRow(idx, { pax: Number(e.target.value) })} className="w-full bg-white px-1 py-2 border border-slate-200 rounded-lg text-[11px] font-mono font-bold text-center">
                              {[2,3,4,5,6].map(n => (<option key={n} value={n}>{n} Pax</option>))}
                            </select>
                          ) : (
                            <span className="w-full bg-slate-100 font-mono text-[11px] font-bold block text-center py-2 border border-slate-200 rounded-lg select-none">{rm.pax} Pax</span>
                          )}
                        </div>
                        <div className="flex items-end justify-end">
                          <button type="button" onClick={() => handleRemoveRoomRow(idx)} className="text-red-500 hover:bg-rose-50 p-2 rounded-lg transition" title="Delete Room Line">🗑️</button>
                        </div>
                      </div>

                      {/* Pricing Row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-red-500 block mb-0.5">Buy Rate / Night</label>
                          <input type="number" value={rm.buyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { buyPriceNum: Number(e.target.value) })} className="w-full px-3 py-2 border border-red-200 rounded-lg text-red-700 font-bold font-mono text-xs bg-red-50/30" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-emerald-600 block mb-0.5">Sell Rate / Night</label>
                          <input type="number" value={rm.sellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { sellPriceNum: Number(e.target.value) })} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-emerald-800 font-bold font-mono text-xs bg-emerald-50/30" />
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                          <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Room Totals ({calculateNightsCount()}N × {rm.qty} rooms)</div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-red-600 font-mono font-bold">-{roomBuyTotal.toLocaleString()}</span>
                            <span className="text-emerald-700 font-mono font-bold">+{roomSellTotal.toLocaleString()}</span>
                            <span className={`font-mono font-extrabold ${roomProfit >= 0 ? 'text-amber-700' : 'text-rose-600'}`}>{roomProfit.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={rm.hasWeekend || false} onChange={(e) => handleUpdateRoomRow(idx, { hasWeekend: e.target.checked })} className="rounded text-amber-600 w-3 h-3" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Weekend Rate</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={rm.hasExtraBed || false} onChange={(e) => handleUpdateRoomRow(idx, { hasExtraBed: e.target.checked })} className="rounded text-indigo-600 w-3 h-3" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Extra Bed</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={rm.hasSeparateMealRate || false} onChange={(e) => handleUpdateRoomRow(idx, { hasSeparateMealRate: e.target.checked })} className="rounded text-rose-600 w-3 h-3" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Separate Meal</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={rm.hasViewSupplement || false} onChange={(e) => handleUpdateRoomRow(idx, { hasViewSupplement: e.target.checked })} className="rounded text-sky-600 w-3 h-3" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">View Supplement</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={rm.hasExtraMeal1 || false} onChange={(e) => handleUpdateRoomRow(idx, { hasExtraMeal1: e.target.checked })} className="rounded text-orange-600 w-3 h-3" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Extra Meal 1</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={rm.hasExtraMeal2 || false} onChange={(e) => handleUpdateRoomRow(idx, { hasExtraMeal2: e.target.checked })} className="rounded text-teal-600 w-3 h-3" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Extra Meal 2</span>
                          </label>
                        </div>
                      </div>

                      {/* Expandable option rows */}
                      {rm.hasWeekend && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-amber-200 bg-amber-50/30 py-2 mt-3 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-amber-700 block mb-0.5">Weekend Buy/Night (Thu-Fri)</label><input type="number" value={rm.weekendBuyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { weekendBuyPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-amber-200 bg-amber-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-amber-700 block mb-0.5">Weekend Sell/Night (Thu-Fri)</label><input type="number" value={rm.weekendSellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { weekendSellPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-amber-200 bg-amber-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasExtraBed && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-indigo-200 bg-indigo-50/30 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-indigo-700 block mb-0.5">Extra Bed Buy/Night</label><input type="number" value={rm.extraBedBuyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraBedBuyPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-indigo-200 bg-indigo-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-indigo-700 block mb-0.5">Extra Bed Sell/Night</label><input type="number" value={rm.extraBedSellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraBedSellPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-indigo-200 bg-indigo-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasSeparateMealRate && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-rose-200 bg-rose-50/30 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-rose-700 block mb-0.5">Meal Buy/Pax/Night</label><input type="number" value={rm.mealRateBuyNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { mealRateBuyNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-rose-200 bg-rose-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-rose-700 block mb-0.5">Meal Sell/Pax/Night</label><input type="number" value={rm.mealRateSellNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { mealRateSellNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-rose-200 bg-rose-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasViewSupplement && (
                        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-sky-200 bg-sky-50/30 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-sky-700 block mb-0.5">View Supp. Buy/Room/Night</label><input type="number" value={rm.viewSuppBuyPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { viewSuppBuyPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-sky-200 bg-sky-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-sky-700 block mb-0.5">View Supp. Sell/Room/Night</label><input type="number" value={rm.viewSuppSellPriceNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { viewSuppSellPriceNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-sky-200 bg-sky-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasExtraMeal1 && (
                        <div className="grid grid-cols-3 gap-3 pl-4 border-l-2 border-orange-200 bg-orange-50/30 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-orange-700 block mb-0.5">Meal Label</label><input type="text" value={rm.extraMeal1Label || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal1Label: e.target.value })} placeholder="Dinner / Lunch" className="w-full px-2.5 py-1.5 border border-orange-200 bg-orange-50 rounded text-slate-800 font-bold text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-orange-700 block mb-0.5">Buy/Pax/Night</label><input type="number" value={rm.extraMeal1BuyNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal1BuyNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-orange-200 bg-orange-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-orange-700 block mb-0.5">Sell/Pax/Night</label><input type="number" value={rm.extraMeal1SellNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal1SellNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-orange-200 bg-orange-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                      {rm.hasExtraMeal2 && (
                        <div className="grid grid-cols-3 gap-3 pl-4 border-l-2 border-teal-200 bg-teal-50/30 py-2 mt-2 rounded-r">
                          <div><label className="text-[9px] uppercase font-bold text-teal-700 block mb-0.5">Meal Label</label><input type="text" value={rm.extraMeal2Label || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal2Label: e.target.value })} placeholder="Dinner / Lunch" className="w-full px-2.5 py-1.5 border border-teal-200 bg-teal-50 rounded text-slate-800 font-bold text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-teal-700 block mb-0.5">Buy/Pax/Night</label><input type="number" value={rm.extraMeal2BuyNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal2BuyNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-teal-200 bg-teal-50 rounded text-red-600 font-bold font-mono text-xs" /></div>
                          <div><label className="text-[9px] uppercase font-bold text-teal-700 block mb-0.5">Sell/Pax/Night</label><input type="number" value={rm.extraMeal2SellNum || ''} onChange={(e) => handleUpdateRoomRow(idx, { extraMeal2SellNum: Number(e.target.value) })} className="w-full px-2.5 py-1.5 border border-teal-200 bg-teal-50 rounded text-emerald-800 font-bold font-mono text-xs" /></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Status-Specific Fields & References */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="text-amber-600">●</span> References & Status Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Option Dates - visible for Tentative */}
              {status === 'Tentative' && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-rose-800 block mb-1 font-serif">⏰ Client Option Expire</label>
                    <input type="date" value={clientOptionDate} onChange={(e) => setClientOptionDate(e.target.value)} className="w-full px-3 py-2.5 border border-rose-200 rounded-xl text-xs bg-rose-50/50 font-semibold text-rose-900 focus:bg-white" required />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-red-800 block mb-1 font-serif">⏰ Supplier Option Expire</label>
                    <input type="date" value={supplierOptionDate} onChange={(e) => setSupplierOptionDate(e.target.value)} className="w-full px-3 py-2.5 border border-red-200 rounded-xl text-xs bg-red-50/50 font-semibold text-red-900 focus:bg-white" required />
                  </div>
                </>
              )}

              {/* Confirmed fields */}
              {status === 'Confirmed' && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-emerald-800 block mb-1">✅ Hotel Confirmation #</label>
                    <input type="text" value={hotelConfirmationNo} onChange={(e) => setHotelConfirmationNo(e.target.value)} placeholder="CONF-559021" className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm font-bold focus:bg-white font-mono bg-emerald-50/30 text-emerald-900" required />
                  </div>
                </>
              )}

              {/* Cancelled fields */}
              {status === 'Cancelled' && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">💰 Cancellation Penalty (SAR)</label>
                    <input type="number" value={cancellationFee || ''} onChange={(e) => setCancellationFee(Number(e.target.value))} className="w-full px-3 py-2.5 border border-rose-200 bg-rose-50/30 rounded-xl text-sm font-mono font-bold text-rose-700" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">📝 Reason / سبب الإلغاء</label>
                    <select value={cancellationReason.startsWith('Other') ? 'Other' : cancellationReason} onChange={(e) => { const sel = e.target.value; if (sel === 'Other') { setCancellationReason('Other: '); } else { setCancellationReason(sel); } }} className="w-full px-3 py-2.5 border border-rose-200 bg-rose-50/30 rounded-xl text-xs font-medium focus:bg-white">
                      <option value="Customer requested cancellation (طلب العميل)">Customer requested cancellation</option>
                      <option value="Supplier unable to confirm allotment (المورد غير قادر على التأكيد)">Supplier unable to confirm</option>
                      <option value="Expiry of Option Date without deposit (انتهاء مهلة الحجز)">Expiry of Option Date</option>
                      <option value="Duplicate booking reservation (حجز مكرر)">Duplicate booking</option>
                      <option value="Pricing discrepancy / agreement dispute (خلاف في السعر)">Pricing discrepancy</option>
                      <option value="Other">Other reason (سبب آخر)</option>
                    </select>
                    {cancellationReason.startsWith('Other') && (
                      <input type="text" value={cancellationReason.replace('Other: ', '')} onChange={(e) => setCancellationReason('Other: ' + e.target.value)} placeholder="Describe exact reason..." className="w-full mt-2 px-3 py-2 border border-rose-200 bg-white rounded-xl text-xs font-semibold focus:border-rose-400" required />
                    )}
                  </div>
                </>
              )}

              {/* Common reference fields */}
              <div>
                <label className="text-[10px] uppercase font-bold text-indigo-800 block mb-1">🏛️ Bank Account (Confirmation PDF)</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="w-full px-3 py-2.5 border border-indigo-200 bg-indigo-50/30 rounded-xl text-xs font-semibold focus:bg-white text-indigo-900">
                  <option value="">Default Bank Info</option>
                  {accounts?.filter(a => a.type === 'Bank').map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.currency || 'SAR'})</option>))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">📋 Agreement No</label>
                <input type="text" value={agreementNo} onChange={(e) => setAgreementNo(e.target.value)} placeholder="Contract No" className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">🧾 Supplier Voucher</label>
                <input type="text" value={supplierVoucher} onChange={(e) => setSupplierVoucher(e.target.value)} placeholder="Supplier Ref" className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">💳 Client Downpay (SAR)</label>
                <input type="number" value={amountPaidByClient || ''} onChange={(e) => setAmountPaidByClient(Number(e.target.value))} className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">💸 Supplier Downpay (SAR)</label>
                <input type="number" value={amountPaidToSupplier || ''} onChange={(e) => setAmountPaidToSupplier(Number(e.target.value))} className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white" />
              </div>
            </div>
          </div>

          {/* Section 4: Financial Summary */}
          {selectedHotelObj && checkIn && checkOut && (
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
              <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                <span className="text-amber-600">●</span> Financial Summary
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
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Total Cost</div>
                        <div className="text-sm font-extrabold font-mono text-red-600">{totalBuy.toLocaleString()} SAR</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Total Sell</div>
                        <div className="text-sm font-extrabold font-mono text-emerald-700">{totalSell.toLocaleString()} SAR</div>
                      </div>
                      <div className={`rounded-xl p-3 border ${profit >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Profit</div>
                        <div className={`text-sm font-extrabold font-mono ${profit >= 0 ? 'text-amber-700' : 'text-rose-600'}`}>{profit.toLocaleString()} SAR</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Rooms / Pax</div>
                        <div className="text-sm font-extrabold font-mono text-slate-800">{totalRooms} / {totalPax}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Client Paid</div>
                        <div className="text-sm font-extrabold font-mono text-indigo-700">{amountPaidByClient.toLocaleString()} SAR</div>
                        {clientOutstanding > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">Due: {clientOutstanding.toLocaleString()}</div>}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Supplier Paid</div>
                        <div className="text-sm font-extrabold font-mono text-indigo-700">{amountPaidToSupplier.toLocaleString()} SAR</div>
                        {(totalBuy - amountPaidToSupplier) > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">Due: {(totalBuy - amountPaidToSupplier).toLocaleString()}</div>}
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
              Commit Save Booking
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-6 py-2.5 rounded-xl transition"
            >
              Cancel Block
            </button>
          </div>

        </form>
      ) : (
        /* Dynamic table listing of filter output */
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm overflow-x-auto text-[11px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-light text-slate-400 font-semibold bg-slate-50/50 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 font-mono">RSV ID</th>
                <th className="py-2.5 px-3">Lead Guest</th>
                <th className="py-2.5 px-3 text-left">Tour Agent Client</th>
                <th className="py-2.5 px-3 text-left">Hotel</th>
                <th className="py-2.5 px-3 font-mono">Dates & Nights</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Client Payment</th>
                <th className="py-2.5 px-3 text-right">Supplier Payment</th>
                <th className="py-2.5 px-3 text-right text-indigo-950">Profit</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {sortedReservations.map((res) => {
                const client = agents.find(a => a.id === res.clientId);
                const hotel = hotels.find(h => h.id === res.hotelId);
                const { totalSell, totalBuy, profit } = getReservationTotals(res);
                const clientPaid = res.amountPaidByClient || 0;
                const paidPercent = totalSell > 0 ? Math.round((clientPaid / totalSell) * 100) : 0;

                return (
                  <tr key={res.id} className="hover:bg-slate-50/40 text-xs">
                    <td className="py-3 px-3 font-bold font-mono text-slate-900 bg-amber-50/5">
                      RSV-{res.id}
                    </td>
                    <td className="py-3 px-3 font-semibold uppercase text-slate-900">
                      {res.guestName}
                    </td>
                    <td className="py-3 px-1.5 font-medium">{client?.companyName || client?.name}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{hotel?.name}</td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-650">
                      <div>{res.checkIn}</div>
                      <div className="text-[9px] text-slate-400 font-bold">To: {res.checkOut}</div>
                      <div className="text-[10px] text-indigo-700 font-bold mt-0.5">{res.nights} Nights</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <select 
                        value={res.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as any;
                          if (newStatus === 'Confirmed' && !(res.amountPaidByClient && res.amountPaidByClient > 0)) {
                            if (!confirm(`⚠️ WARNING: No client payment recorded for RSV-${res.id} (${res.guestName}).

Are you sure you want to confirm this booking without receiving any payment from the client?

Click OK to confirm anyway, or Cancel to go back.`)) {
                              return;
                            }
                          }
                          onSaveReservation({...res, status: newStatus});
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
                      <div className="text-[9px] text-slate-400 font-bold">of {totalSell.toLocaleString()} ({paidPercent}%)</div>
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-1 ml-auto overflow-hidden">
                        <div className={`h-full rounded-full ${paidPercent >= 100 ? 'bg-emerald-500' : paidPercent > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${Math.min(paidPercent, 100)}%` }}></div>
                      </div>
                      {paidPercent < 100 && totalSell > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">Due: {(totalSell - clientPaid).toLocaleString()}</div>}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {(() => {
                        const suppPaid = res.amountPaidToSupplier || 0;
                        const suppPercent = totalBuy > 0 ? Math.round((suppPaid / totalBuy) * 100) : 0;
                        return (
                          <>
                            <div className="font-mono font-bold text-indigo-700">{suppPaid.toLocaleString()} <span className="text-[8px] text-slate-400">SAR</span></div>
                            <div className="text-[9px] text-slate-400 font-bold">of {totalBuy.toLocaleString()} ({suppPercent}%)</div>
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-1 ml-auto overflow-hidden">
                              <div className={`h-full rounded-full ${suppPercent >= 100 ? 'bg-emerald-500' : suppPercent > 0 ? 'bg-blue-400' : 'bg-slate-200'}`} style={{ width: `${Math.min(suppPercent, 100)}%` }}></div>
                            </div>
                            {suppPercent < 100 && totalBuy > 0 && <div className="text-[8px] text-rose-500 font-bold mt-0.5">Due: {(totalBuy - suppPaid).toLocaleString()}</div>}
                          </>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className={`font-mono font-bold text-[11px] ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{profit.toLocaleString()} SAR</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setViewingId(res.id.toString())}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded border border-slate-200 text-[10px] whitespace-nowrap"
                          title="View full details and register payments"
                        >
                          🔍 Details & Pay
                        </button>
                        <button
                          onClick={() => {
                            const outstanding = totalSell - (res.amountPaidByClient || 0);
                            if (outstanding <= 0) { alert('Client has fully paid this booking.'); return; }
                            if (confirm(`Quick-record full client payment of ${outstanding.toLocaleString()} SAR for RSV-${res.id}?\n\nYou will need to select a treasury account in the Details pane.`)) {
                              setViewingId(res.id.toString());
                              setActiveDetailTab('payment');
                              setPayAmount(outstanding);
                            }
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-1.5 py-1 rounded border border-emerald-200 text-[9px] whitespace-nowrap"
                          title="Quick record client payment"
                        >
                          💰 Client Pay
                        </button>
                        <button
                          onClick={() => {
                            const outstanding = totalBuy - (res.amountPaidToSupplier || 0);
                            if (outstanding <= 0) { alert('Supplier has been fully paid.'); return; }
                            if (confirm(`Quick-record full supplier payment of ${outstanding.toLocaleString()} SAR for RSV-${res.id}?\n\nYou will need to select a treasury account in the Details pane.`)) {
                              setViewingId(res.id.toString());
                              setActiveDetailTab('payment');
                              setPayAmount(outstanding);
                            }
                          }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-1.5 py-1 rounded border border-blue-200 text-[9px] whitespace-nowrap"
                          title="Quick record supplier payment"
                        >
                          🏦 Supplier Pay
                        </button>
                        <button
                          onClick={() => setPrintingDoc({ res: res, isVoucher: false })}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded border border-indigo-200 text-[10px] whitespace-nowrap hidden lg:block"
                          title="Print Client Confirmation PDF"
                        >
                          📄 Print PDF
                        </button>
                        <button
                          onClick={() => setPrintingDoc({ res: res, isVoucher: true })}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded border border-emerald-200 text-[10px] whitespace-nowrap hidden lg:block"
                          title="Print Hotel Check-in Voucher"
                        >
                          🎫 Voucher
                        </button>
                        <button
                          onClick={() => setPrintingInvoice(res)}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded border border-purple-200 text-[10px] whitespace-nowrap hidden lg:block"
                          title="Generate Professional Invoice"
                        >
                          🧾 Invoice
                        </button>
                        <button
                          onClick={() => handleEdit(res)}
                          className="p-1 hover:bg-amber-55/35 text-amber-800 rounded"
                          title="Edit booking"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete reservation RSV-' + res.id + '?')) onDeleteReservation(res.id.toString());
                          }}
                          className="p-1 hover:bg-rose-50 text-red-650 rounded"
                          title="Remove booking"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReservations.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-450 italic">No bookings found satisfying filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Reservation overlay card - Redesigned with tabs */}
      {viewingId && (() => {
        const resObj = reservations.find(r => r.id.toString() === viewingId);
        if (!resObj) return null;
        const hotelObj = hotels.find(h => h.id === resObj.hotelId);
        const { totalSell, totalBuy } = getReservationTotals(resObj);
        const nightsLocal = resObj.nights;
        const profit = totalSell - totalBuy;
        const clientPaid = resObj.amountPaidByClient || 0;
        const supplierPaid = resObj.amountPaidToSupplier || 0;
        const clientRemaining = Math.max(totalSell - clientPaid, 0);
        const supplierRemaining = Math.max(totalBuy - supplierPaid, 0);
        const clientPct = totalSell > 0 ? Math.min(Math.round((clientPaid / totalSell) * 100), 100) : 0;
        const supplierPct = totalBuy > 0 ? Math.min(Math.round((supplierPaid / totalBuy) * 100), 100) : 0;
        const relatedTrs = transactions.filter(t => t.reservationId === resObj.id.toString());

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-6 animate-in fade-in zoom-in-95 text-xs overflow-hidden">

              {/* Header Bar */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded-lg text-[10px] font-black">RSV-{resObj.id}</span>
                    {resObj.guestName}
                  </h3>
                  <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                    {hotelObj?.name} &bull; {resObj.checkIn} → {resObj.checkOut} ({nightsLocal}N) &bull; By <span className="text-amber-400 font-bold">{resObj.createdBy || 'Hazem'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${
                    resObj.status === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                    resObj.status === 'Cancelled' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                    'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>{resObj.status}</span>
                  <button onClick={() => { setViewingId(null); handleEdit(resObj); }} className="bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition">✏️ Edit</button>
                  <button onClick={() => setViewingId(null)} className="text-slate-400 hover:text-white text-lg transition">✕</button>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 bg-slate-50/50 px-4">
                {([
                  { key: 'overview' as const, label: 'Overview', icon: '📋' },
                  { key: 'payment' as const, label: 'Record Payment', icon: '💳' },
                  { key: 'agreements' as const, label: 'Agreements & Rooms', icon: '⚙️' },
                  { key: 'documents' as const, label: 'Documents', icon: '📄' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDetailTab(tab.key)}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
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
              <div className="p-6 max-h-[70vh] overflow-y-auto">

                {/* ===== OVERVIEW TAB ===== */}
                {activeDetailTab === 'overview' && (
                  <div className="space-y-5">
                    {/* Guest & Booking Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-2">Guest Information</h5>
                        <div className="grid grid-cols-2 gap-y-1.5">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Lead Guest</span>
                          <span className="font-bold text-slate-900 text-sm uppercase">{resObj.guestName}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Nationality</span>
                          <span className="font-semibold text-slate-700">{resObj.guestNationality}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Stay Period</span>
                          <span className="font-mono text-slate-700 text-[10px]">{resObj.checkIn} → {resObj.checkOut}</span>
                        </div>
                        {resObj.status === 'Tentative' && (
                          <div className="mt-2 bg-rose-50 rounded-lg p-2.5 border border-rose-200 space-y-1">
                            <div className="text-[9px] uppercase font-bold text-rose-400 mb-1">Option Deadlines</div>
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-rose-700">Client: {resObj.clientOptionDate || 'Not Set'}</span>
                              <span className="text-rose-700">Supplier: {resObj.supplierOptionDate || 'Not Set'}</span>
                            </div>
                          </div>
                        )}
                        {resObj.status === 'Confirmed' && (
                          <div className="mt-2 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                            <div className="text-[9px] uppercase font-bold text-emerald-400">Hotel Confirmation #</div>
                            <div className="font-mono font-bold text-emerald-800 text-sm">{resObj.hotelConfirmationNo || 'Pending'}</div>
                          </div>
                        )}
                        {resObj.status === 'Cancelled' && (
                          <div className="mt-2 bg-rose-50 rounded-lg p-2.5 border border-rose-200">
                            <div className="text-[9px] uppercase font-bold text-rose-400">Cancellation</div>
                            <div className="text-[10px] text-rose-700">{resObj.cancellationReason || 'N/A'}</div>
                            {resObj.cancellationFee ? <div className="text-[10px] font-bold text-rose-800 mt-1">Penalty: {resObj.cancellationFee.toLocaleString()} SAR</div> : null}
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-2">Booking Details</h5>
                        <div className="grid grid-cols-2 gap-y-1.5">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Client</span>
                          <span className="font-semibold text-slate-800">{agents.find(a => a.id === resObj.clientId)?.companyName || 'N/A'}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Supplier</span>
                          <span className="font-semibold text-slate-800">{agents.find(a => a.id === resObj.supplierId)?.name || 'Direct'}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Hotel</span>
                          <span className="font-semibold text-slate-800">{hotelObj?.name}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Agreement</span>
                          <span className="font-mono text-slate-700">{resObj.agreementNo || 'Direct'}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Agreement Status</span>
                          <span className="font-bold uppercase font-mono text-indigo-700">{resObj.agreementStatus || 'Pending'}</span>
                        </div>
                        <div className="mt-2 bg-indigo-50 rounded-lg p-2.5 border border-indigo-200">
                          <div className="text-[9px] uppercase font-bold text-indigo-400 mb-1">Rooms</div>
                          {resObj.rooms.map((rm, i) => (
                            <div key={i} className="text-[10px] font-medium text-indigo-800">{rm.qty}× {rm.roomType} ({rm.view} / {rm.mealPlan})</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                      <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-3">Financial Summary</h5>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center mb-4">
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Sale</span>
                          <span className="font-mono font-extrabold text-emerald-700 text-sm">{totalSell.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Supplier Cost</span>
                          <span className="font-mono font-extrabold text-amber-800 text-sm">{totalBuy.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className={`rounded-lg p-2.5 border ${profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Net Profit</span>
                          <span className={`font-mono font-extrabold text-sm ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{profit.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Client Due</span>
                          <span className={`font-mono font-extrabold text-sm ${clientRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{clientRemaining.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Supplier Due</span>
                          <span className={`font-mono font-extrabold text-sm ${supplierRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{supplierRemaining.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block">SAR</span>
                        </div>
                      </div>

                      {/* Payment Progress Bars */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-slate-600">Client Payment</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${clientPct >= 100 ? 'bg-emerald-100 text-emerald-800' : clientPct > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
                              {clientPct >= 100 ? 'Paid' : clientPct > 0 ? 'Partial' : 'Unpaid'} {clientPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                            <div className={`h-full rounded-full transition-all ${clientPct >= 100 ? 'bg-emerald-500' : clientPct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${clientPct}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-emerald-700 font-bold">{clientPaid.toLocaleString()} SAR</span>
                            <span className="text-slate-400">of {totalSell.toLocaleString()} SAR</span>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-slate-600">Supplier Payment</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${supplierPct >= 100 ? 'bg-emerald-100 text-emerald-800' : supplierPct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-700'}`}>
                              {supplierPct >= 100 ? 'Paid' : supplierPct > 0 ? 'Partial' : 'Unpaid'} {supplierPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                            <div className={`h-full rounded-full transition-all ${supplierPct >= 100 ? 'bg-emerald-500' : supplierPct > 0 ? 'bg-blue-400' : 'bg-slate-200'}`} style={{ width: `${supplierPct}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-indigo-700 font-bold">{supplierPaid.toLocaleString()} SAR</span>
                            <span className="text-slate-400">of {totalBuy.toLocaleString()} SAR</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {relatedTrs.length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest mb-2">Payment History ({relatedTrs.length} transactions)</h5>
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
                    {/* Quick Pay Presets */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPayAmount(clientRemaining);
                          setPayAccountId('');
                          setPayVoucher(`REC-${Date.now().toString().slice(-5)}`);
                        }}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          clientRemaining > 0 ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:shadow-md' : 'border-slate-200 bg-slate-50 opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-[9px] font-bold uppercase text-emerald-600">Receive from Client</div>
                            <div className="font-mono font-extrabold text-emerald-800 text-lg">{clientRemaining.toLocaleString()} SAR</div>
                            <div className="text-[9px] text-slate-500">Outstanding balance from {agents.find(a => a.id === resObj.clientId)?.companyName || 'client'}</div>
                          </div>
                          <div className="text-3xl">📥</div>
                        </div>
                        <div className="mt-2 w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${clientPct}%` }}></div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPayAmount(supplierRemaining);
                          setPayAccountId('');
                          setPayVoucher(`PAY-${Date.now().toString().slice(-5)}`);
                        }}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          supplierRemaining > 0 ? 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md' : 'border-slate-200 bg-slate-50 opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-[9px] font-bold uppercase text-blue-600">Pay Supplier</div>
                            <div className="font-mono font-extrabold text-blue-800 text-lg">{supplierRemaining.toLocaleString()} SAR</div>
                            <div className="text-[9px] text-slate-500">Outstanding to {agents.find(a => a.id === resObj.supplierId)?.name || 'supplier'}</div>
                          </div>
                          <div className="text-3xl">📤</div>
                        </div>
                        <div className="mt-2 w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${supplierPct}%` }}></div>
                        </div>
                      </button>
                    </div>

                    {/* Payment Form */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <h5 className="font-bold text-xs uppercase text-slate-700 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                        <span className="text-amber-500">●</span> Payment Details
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Amount Section */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Payment Amount (SAR)</label>
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
                                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">EGP Amount</label>
                                <input type="number" value={payOriginalAmount || ''} onChange={(e) => setPayOriginalAmount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-bold" required />
                              </div>
                              <div>
                                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Exchange Rate</label>
                                <input type="number" value={payExchangeRate || ''} step="0.01" onChange={(e) => setPayExchangeRate(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-bold" required />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Method & Account Section */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Payment Method</label>
                            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                              <button type="button" onClick={() => setPayMethod('Bank Transfer')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition ${payMethod === 'Bank Transfer' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>🏦 Bank Transfer</button>
                              <button type="button" onClick={() => setPayMethod('Cash')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition ${payMethod === 'Cash' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>💵 Cash</button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Treasury / Bank Account</label>
                            <select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 rounded-xl py-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500" required>
                              <option value="">-- Select Account --</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} SAR)</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Voucher / Reference</label>
                            <input type="text" value={payVoucher} onChange={(e) => setPayVoucher(e.target.value)} placeholder="REC-5509" className="w-full bg-slate-50 border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-semibold" />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => handlePostBookingPayment(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
                        >
                          📥 Post Client Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePostBookingPayment(false)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
                        >
                          📤 Post Supplier Payment
                        </button>
                      </div>
                    </div>

                    {/* Recent Payment Transactions */}
                    {relatedTrs.length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest mb-2">Recent Transactions</h5>
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
                        <span className="text-amber-500">●</span> Confirmation & Agreement Details
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Hotel Confirmation Number</label>
                          <input type="text" value={localHotelConf} onChange={(e) => setLocalHotelConf(e.target.value)} placeholder="e.g. CONF-99201" className="w-full bg-slate-50 border border-slate-200 px-3 rounded-xl py-2 text-xs font-mono font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Agreement / Contract ID</label>
                          <input type="text" value={localAgreementNo} onChange={(e) => setLocalAgreementNo(e.target.value)} placeholder="e.g. CONTRACT-ZM502" className="w-full bg-slate-50 border border-slate-200 px-3 rounded-xl py-2 text-xs font-mono font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[9px] uppercase font-bold text-slate-500 block mb-2">Agreement Status</label>
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
                                {statusVal === 'Approved' ? '✅' : statusVal === 'Declined' ? '❌' : '⏳'} {statusVal}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rooming List */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <h5 className="font-bold text-xs uppercase text-slate-700 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                        <span className="text-amber-500">●</span> Rooming List / Guest Names
                      </h5>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
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
                        💾 Save Confirmation Details
                      </button>
                      <button
                        type="button"
                        onClick={() => { const r = reservations.find(r => r.id.toString() === viewingId); if (r) setPrintingRoomingList(r); }}
                        className="flex-1 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-[10px] uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        🖨️ Print Rooming List
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
                        <h5 className="font-bold text-sm text-slate-800 mb-1">Agent Confirmation</h5>
                        <p className="text-[10px] text-slate-500 mb-4">Official booking confirmation letter for the tour operator / client agent.</p>
                        <button
                          onClick={() => setPrintingDoc({ res: resObj, isVoucher: false })}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl transition shadow text-xs w-full"
                        >
                          Print Confirmation PDF
                        </button>
                      </div>
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200 text-center hover:shadow-lg transition-shadow">
                        <div className="text-4xl mb-3">🎫</div>
                        <h5 className="font-bold text-sm text-slate-800 mb-1">Guest Card Voucher</h5>
                        <p className="text-[10px] text-slate-500 mb-4">Hotel check-in voucher for the guest with booking and room details.</p>
                        <button
                          onClick={() => setPrintingDoc({ res: resObj, isVoucher: true })}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition shadow text-xs w-full"
                        >
                          Print Voucher PDF
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest mb-3">Quick Actions</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <button
                          onClick={() => { setViewingId(null); handleEdit(resObj); }}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-[10px] uppercase flex items-center justify-center gap-1.5"
                        >
                          ✏️ Edit Booking
                        </button>
                        <button
                          onClick={() => { const r = reservations.find(r => r.id.toString() === viewingId); if (r) setPrintingRoomingList(r); }}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-[10px] uppercase flex items-center justify-center gap-1.5"
                        >
                          🖨️ Rooming List
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
                          🗑️ Delete Booking
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-6 py-3 bg-slate-50/50 flex justify-between items-center">
                <div className="flex gap-2">
                  <button onClick={() => setPrintingDoc({ res: resObj, isVoucher: false })} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]">📄 Confirmation</button>
                  <button onClick={() => setPrintingDoc({ res: resObj, isVoucher: true })} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]">🎫 Voucher</button>
                  <button onClick={() => setPrintingInvoice(resObj)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px]">🧾 Invoice</button>
                </div>
                <button onClick={() => setViewingId(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-1.5 rounded-lg transition text-[10px]">Close</button>
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

    </div>
  );
}
