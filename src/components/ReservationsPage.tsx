/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Reservation, Agent, Hotel, RoomLine, Transaction, Account, User } from '../types';
import ZumraLogo from './ZumraLogo';
import { getReservationTotals, getEgyptTime, exportToCSV } from '../lib/storage';
import ConfirmationPDF from './ConfirmationPDF';

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
  onSaveTransaction
}: ReservationsPageProps) {
  
  // View states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [printingDoc, setPrintingDoc] = useState<{ res: Reservation; isVoucher: boolean } | null>(null);

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
  }, [initialFilters]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgentId, setFilterAgentId] = useState(initialFilters?.clientId || '');
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
        mealRateSellNum: rm.mealRate || 0
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
      bankAccountId: status === 'Confirmed' ? bankAccountId : undefined,
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
    const matchesSearch = res.guestName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (client && client.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          res.id.toString().includes(searchTerm.replace(/RSV-/i, '')) ||
                          res.checkIn.includes(searchTerm);
    
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
    const matchesStatus = !filterStatus || res.status === filterStatus;
    const matchesDate = !filterDate || res.checkIn === filterDate || res.checkOut === filterDate || res.clientOptionDate === filterDate;

    return matchesSearch && matchesAgent && matchesStatus && matchesDate && matchesCustom;
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
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Search ID / Guest</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. RSV-100 หรือ Hazem"
                className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded text-xs select-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Agent / Operator</label>
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
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Option Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-white px-2 py-1.5 border border-slate-200 rounded text-xs select-none"
              />
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
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-[24px] p-6 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 leading-relaxed text-xs max-w-6xl mx-auto">
          
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">🏨</span>
              {editingId ? `Edit Booking RSV-${editingId}` : 'New Reservation'}
            </h3>
            <button type="button" onClick={resetForm} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-xl transition shadow-sm">✕ Close</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Primary Details */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-2 border-b border-slate-100 pb-2">Core Assignment</h4>
                
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Customer / Agent</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors"
                    required
                  >
                    <option value="">-- Choose Customer --</option>
                    {agents.filter(a => a.type === 'Customer' || a.type === 'Both').map(a => (
                      <option key={a.id} value={a.id}>{a.companyName || a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors"
                    required
                  >
                    <option value="">-- Choose Supplier --</option>
                    {agents.filter(a => a.type === 'Supplier' || a.type === 'Both').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Destination Hotel</label>
                  <select
                    value={hotelId}
                    onChange={(e) => {
                      setHotelId(e.target.value);
                      const matchedH = hotels.find(h => h.id === e.target.value);
                      if (matchedH) {
                        setRooms([{
                          roomType: matchedH.roomTypes[0] || 'Double',
                          view: matchedH.views[0] || 'City View',
                          mealPlan: matchedH.mealPlans[0] || 'B.B',
                          qty: 1,
                          pax: getPaxForRoomType(matchedH.roomTypes[0] || 'Double'),
                          buyPriceNum: 100,
                          sellPriceNum: 150
                        }]);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-800 focus:bg-white focus:border-amber-500 transition-colors"
                    required
                  >
                    <option value="">-- Select Partner Hotel --</option>
                    {hotels.map(h => (
                      <option key={h.id} value={h.id}>{h.city === 'Makkah' ? '🕋' : '🕌'} {h.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-2 border-b border-slate-100 pb-2">Stay Info</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Check-In</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full bg-slate-50 font-mono px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block flex justify-between">
                      Check-Out
                      {checkIn && checkOut && (
                        <span className="text-emerald-600 font-extrabold">{calculateNightsCount()}N</span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full bg-slate-50 font-mono px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Lead Guest Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="MOHAMED AL-AHMADI"
                    className="w-full bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:bg-white transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nationality</label>
                  <input
                    type="text"
                    list="nationalities"
                    value={guestNationality}
                    onChange={(e) => setGuestNationality(e.target.value)}
                    placeholder="Saudi"
                    className="w-full bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-sm uppercase focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Rooms & Options */}
            <div className="lg:col-span-8 space-y-4 flex flex-col">
              
              <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex-1">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Room Configuration</h4>
                  <button
                    type="button"
                    onClick={handleAddRoomRow}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1"
                  >
                    + Add Room Line
                  </button>
                </div>

                <div className="space-y-3">
                {rooms.map((rm, idx) => (
                  <div key={idx} className="grid grid-cols-2 lg:grid-cols-8 gap-2 items-end bg-white border border-slate-100 p-3 rounded-lg text-xs">
                    
                    <div className="col-span-2">
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Room Type</label>
                      <select
                        value={rm.roomType}
                        onChange={(e) => handleUpdateRoomRow(idx, { roomType: e.target.value })}
                        className="w-full px-2.5 py-1 border border-slate-200 bg-slate-50/50 rounded"
                      >
                        {selectedHotelObj.roomTypes.map((t, i) => (
                          <option key={i} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">View</label>
                      <select
                        value={rm.view}
                        onChange={(e) => handleUpdateRoomRow(idx, { view: e.target.value })}
                        className="w-full px-2.5 py-1 border border-slate-200 bg-slate-50/50 rounded"
                      >
                        {selectedHotelObj.views.map((v, i) => (
                          <option key={i} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Meal Plan</label>
                      <select
                        value={rm.mealPlan}
                        onChange={(e) => handleUpdateRoomRow(idx, { mealPlan: e.target.value })}
                        className="w-full px-2.5 py-1 border border-slate-200 bg-slate-50/50 rounded"
                      >
                        {selectedHotelObj.mealPlans.map((mp, i) => (
                          <option key={i} value={mp}>{mp}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Qty / الغرف</label>
                      <input
                        type="number"
                        min={1}
                        value={rm.qty}
                        onChange={(e) => handleUpdateRoomRow(idx, { qty: Number(e.target.value) })}
                        className="w-full px-2.5 py-1 border border-slate-200 rounded font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Pax / الأفراد</label>
                      {rm.roomType.toLowerCase().includes('suite') ? (
                        <select
                          value={rm.pax || 2}
                          onChange={(e) => handleUpdateRoomRow(idx, { pax: Number(e.target.value) })}
                          className="w-full bg-white px-1 py-1 border border-slate-200 rounded text-[11px] font-mono font-bold text-center"
                        >
                          <option value={2}>2 Pax</option>
                          <option value={3}>3 Pax</option>
                          <option value={4}>4 Pax</option>
                          <option value={5}>5 Pax</option>
                          <option value={6}>6 Pax</option>
                        </select>
                      ) : (
                        <span className="w-full bg-slate-100 font-mono text-[11px] font-bold block text-center py-1 border border-slate-200 rounded select-none">
                          {rm.pax} Pax
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Buy/Night (Cost)</label>
                      <input
                        type="number"
                        value={rm.buyPriceNum || ''}
                        onChange={(e) => handleUpdateRoomRow(idx, { buyPriceNum: Number(e.target.value) })}
                        className="w-full px-2.5 py-1 border border-slate-200 rounded text-red-600 font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Sell/Night (Sales)</label>
                      <input
                        type="number"
                        value={rm.sellPriceNum || ''}
                        onChange={(e) => handleUpdateRoomRow(idx, { sellPriceNum: Number(e.target.value) })}
                        className="w-full px-2.5 py-1 border border-slate-200 rounded text-emerald-800 font-bold font-mono"
                      />
                    </div>
                    
                    <div className="col-span-2 lg:col-span-1 flex flex-col justify-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rm.hasWeekend || false}
                          onChange={(e) => handleUpdateRoomRow(idx, { hasWeekend: e.target.checked })}
                          className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3"
                        />
                        <span className="text-[9px] font-bold text-slate-500 uppercase whitespace-nowrap">Weekend Rate</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rm.hasExtraBed || false}
                          onChange={(e) => handleUpdateRoomRow(idx, { hasExtraBed: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                        />
                        <span className="text-[9px] font-bold text-slate-500 uppercase whitespace-nowrap">Extra Bed</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rm.hasSeparateMealRate || false}
                          onChange={(e) => handleUpdateRoomRow(idx, { hasSeparateMealRate: e.target.checked })}
                          className="rounded text-rose-600 focus:ring-rose-500 w-3 h-3"
                        />
                        <span className="text-[9px] font-bold text-slate-500 uppercase whitespace-nowrap">Separate Meal</span>
                      </label>
                    </div>

                    {rm.hasWeekend && (
                      <div className="col-span-2 lg:col-span-5 grid grid-cols-2 gap-3 pl-4 border-l-2 border-amber-200 bg-amber-50/30 py-2 mt-1 rounded-r">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-amber-700 block mb-0.5">Weekend Buy/Night (Thu-Fri)</label>
                          <input
                            type="number"
                            value={rm.weekendBuyPriceNum || ''}
                            onChange={(e) => handleUpdateRoomRow(idx, { weekendBuyPriceNum: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 border border-amber-200 bg-amber-50 rounded text-red-600 font-bold font-mono"
                            placeholder="Cost on weekend"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-amber-700 block mb-0.5">Weekend Sell/Night (Thu-Fri)</label>
                          <input
                            type="number"
                            value={rm.weekendSellPriceNum || ''}
                            onChange={(e) => handleUpdateRoomRow(idx, { weekendSellPriceNum: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 border border-amber-200 bg-amber-50 rounded text-emerald-800 font-bold font-mono"
                            placeholder="Sale on weekend"
                          />
                        </div>
                      </div>
                    )}
                    
                    {rm.hasExtraBed && (
                      <div className="col-span-2 lg:col-span-5 grid grid-cols-2 gap-3 pl-4 border-l-2 border-indigo-200 bg-indigo-50/30 py-2 mt-1 rounded-r">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-indigo-700 block mb-0.5">Extra Bed Buy/Night</label>
                          <input
                            type="number"
                            value={rm.extraBedBuyPriceNum || ''}
                            onChange={(e) => handleUpdateRoomRow(idx, { extraBedBuyPriceNum: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 border border-indigo-200 bg-indigo-50 rounded text-red-600 font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-indigo-700 block mb-0.5">Extra Bed Sell/Night</label>
                          <input
                            type="number"
                            value={rm.extraBedSellPriceNum || ''}
                            onChange={(e) => handleUpdateRoomRow(idx, { extraBedSellPriceNum: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 border border-indigo-200 bg-indigo-50 rounded text-emerald-800 font-bold font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {rm.hasSeparateMealRate && (
                      <div className="col-span-2 lg:col-span-5 grid grid-cols-2 gap-3 pl-4 border-l-2 border-rose-200 bg-rose-50/30 py-2 mt-1 rounded-r">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-rose-700 block mb-0.5">Meal Buy/Pax</label>
                          <input
                            type="number"
                            value={rm.mealRateBuyNum || ''}
                            onChange={(e) => handleUpdateRoomRow(idx, { mealRateBuyNum: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 border border-rose-200 bg-rose-50 rounded text-red-600 font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-rose-700 block mb-0.5">Meal Sell/Pax</label>
                          <input
                            type="number"
                            value={rm.mealRateSellNum || ''}
                            onChange={(e) => handleUpdateRoomRow(idx, { mealRateSellNum: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 border border-rose-200 bg-rose-50 rounded text-emerald-800 font-bold font-mono"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end col-span-2 lg:col-span-1 items-end pb-1 pb-safe">
                      <button
                        type="button"
                        onClick={() => handleRemoveRoomRow(idx)}
                        className="text-red-600 hover:bg-rose-50 p-1.5 rounded"
                        title="Delete Room Line"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                  </div>
                ))}
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm mt-4">
                <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-2 border-b border-slate-100 pb-2">Status & Options</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Reservation Status</label>
                    <select
                      value={status}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setStatus(val);
                        if (val !== 'Cancelled') {
                          setCancellationFee(0);
                          setCancellationReason('');
                        } else {
                          setCancellationReason('Customer requested cancellation (طلب العميل)');
                        }
                        if (val === 'Confirmed') {
                          setClientOptionDate('');
                          setSupplierOptionDate('');
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white"
                    >
                      <option value="Tentative">Tentative (معلق)</option>
                      <option value="Confirmed">Confirmed (مؤكد)</option>
                      <option value="Cancelled">Cancelled (ملغي)</option>
                    </select>
                  </div>

            {/* Option Date selection: disappears/hidden IF status is Confirmed */}
            {status !== 'Confirmed' && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-rose-800 block mb-1 font-serif">Client Option Expire Date</label>
                  <input
                    type="date"
                    value={clientOptionDate}
                    onChange={(e) => setClientOptionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-rose-200 rounded-xl text-xs bg-rose-50/50 font-semibold text-rose-900 focus:bg-white"
                    required={status === 'Tentative'}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-red-800 block mb-1 font-serif">Supplier Option Expire Date</label>
                  <input
                    type="date"
                    value={supplierOptionDate}
                    onChange={(e) => setSupplierOptionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-red-200 rounded-xl text-xs bg-red-50/50 font-semibold text-red-900 focus:bg-white"
                    required={status === 'Tentative'}
                  />
                </div>
              </>
            )}

            {/* Hotel Confirmation display ONLY if status is Confirmed */}
            {status === 'Confirmed' && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-emerald-800 block mb-1">Hotel Confirmation #</label>
                  <input
                    type="text"
                    value={hotelConfirmationNo}
                    onChange={(e) => setHotelConfirmationNo(e.target.value)}
                    placeholder="CONF-559021"
                    className="w-full px-3 py-2 border border-emerald-200 rounded-xl text-sm font-bold focus:bg-white font-mono bg-emerald-50/30 text-emerald-900"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-indigo-800 block mb-1">Bank for Confirmation</label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/30 rounded-xl text-xs font-semibold focus:bg-white text-indigo-900"
                  >
                    <option value="">Default/No Bank</option>
                    {accounts?.filter(a => a.type === 'Bank').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency || 'SAR'})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {status === 'Cancelled' && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">Cancellation Penalty (SAR)</label>
                  <input
                    type="number"
                    value={cancellationFee || ''}
                    onChange={(e) => setCancellationFee(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-rose-200 bg-rose-50/30 rounded-xl text-sm font-mono font-bold text-rose-700"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 space-y-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-rose-700 block mb-1">Reason / سبب الإلغاء</label>
                    <select
                      value={cancellationReason.startsWith('Other') ? 'Other' : cancellationReason}
                      onChange={(e) => {
                        const sel = e.target.value;
                        if (sel === 'Other') {
                          setCancellationReason('Other: ');
                        } else {
                          setCancellationReason(sel);
                        }
                      }}
                      className="w-full px-3 py-2 border border-rose-200 bg-rose-50/30 rounded-xl text-xs font-medium focus:bg-white"
                    >
                      <option value="Customer requested cancellation (طلب العميل)">Customer requested cancellation</option>
                      <option value="Supplier unable to confirm allotment (المورد غير قادر على التأكيد)">Supplier unable to confirm</option>
                      <option value="Expiry of Option Date without deposit (انتهاء مهلة الحجز)">Expiry of Option Date without deposit</option>
                      <option value="Duplicate booking reservation (حجز مكرر)">Duplicate booking</option>
                      <option value="Pricing discrepancy / agreement dispute (خلاف في السعر)">Pricing discrepancy</option>
                      <option value="Other">Other reason (سبب آخر)</option>
                    </select>
                  </div>

                  {cancellationReason.startsWith('Other') && (
                    <div>
                      <input
                        type="text"
                        value={cancellationReason.replace('Other: ', '')}
                        onChange={(e) => setCancellationReason('Other: ' + e.target.value)}
                        placeholder="Describe exact reason..."
                        className="w-full px-3 py-2 border border-rose-200 bg-white rounded-xl text-xs font-semibold focus:border-rose-400"
                        required
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Agreement No</label>
              <input
                type="text"
                value={agreementNo}
                onChange={(e) => setAgreementNo(e.target.value)}
                placeholder="Contract No"
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Supplier V.No</label>
              <input
                type="text"
                value={supplierVoucher}
                onChange={(e) => setSupplierVoucher(e.target.value)}
                placeholder="Supplier Ref"
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Client Downpay (SAR)</label>
              <input
                type="number"
                value={amountPaidByClient || ''}
                onChange={(e) => setAmountPaidByClient(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Supplier Downpay (SAR)</label>
              <input
                type="number"
                value={amountPaidToSupplier || ''}
                onChange={(e) => setAmountPaidToSupplier(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white"
              />
            </div>

            </div>

            </div>
          </div> {/* Close Status & Options box */}

          </div> {/* Close Right Column lg:col-span-8 space-y-4 */}
          </div> {/* Close grid grid-cols-1 lg:grid-cols-12 gap-6 */}

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
                <th className="py-2.5 px-3 text-right">What Paid / المحصل</th>
                <th className="py-2.5 px-3 text-right text-indigo-950">Sale & Cost & Profit</th>
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
                        onChange={(e) => onSaveReservation({...res, status: e.target.value as any})}
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
                      <div className="font-mono font-bold text-slate-800">{clientPaid.toLocaleString()} SAR</div>
                      <div className="text-[9px] text-slate-400 font-bold">Of {totalSell.toLocaleString()} SAR ({paidPercent}%)</div>
                      <div className="w-16 bg-slate-100 h-1 rounded-full mt-1 ml-auto overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(paidPercent, 100)}%` }}></div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap bg-emerald-50/5">
                      <div className="font-mono text-emerald-800 text-[11px] font-semibold"><span className="text-[9px] text-slate-400">Sale:</span> {totalSell.toLocaleString()} SAR</div>
                      <div className="font-mono text-amber-900 text-[10px]"><span className="text-[8px] text-slate-450">Cost:</span> {totalBuy.toLocaleString()} SAR</div>
                      <div className="font-mono mt-0.5 text-[10px]"><span className="text-[8px] text-slate-450">Profit:</span> <span className={`font-bold ${profit >= 0 ? 'text-indigo-805' : 'text-rose-600'}`}>{profit.toLocaleString()} SAR</span></div>
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
                  <td colSpan={9} className="py-12 text-center text-slate-450 italic">No bookings found satisfying filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Reservation overlay card */}
      {viewingId && (() => {
        const resObj = reservations.find(r => r.id.toString() === viewingId);
        if (!resObj) return null;
        const hotelObj = hotels.find(h => h.id === resObj.hotelId);
        const { totalSell, totalBuy } = getReservationTotals(resObj);
        const nightsLocal = resObj.nights;
        const profit = totalSell - totalBuy;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 my-10 text-xs">
              
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-slate-850 text-sm uppercase">Booking Details Ledger & Payments (RSV-{resObj.id})</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Created by: <span className="font-bold text-amber-700">{resObj.createdBy || 'Hazem'}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setViewingId(null); handleEdit(resObj); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] uppercase shadow-sm">✏️ Edit Booking</button>
                  <button onClick={() => setViewingId(null)} className="text-slate-450 hover:text-slate-600 font-bold transition">✕ Close</button>
                </div>
              </div>

              {/* Two Column details specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-slate-100">
                <div className="space-y-2.5 text-xs">
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Lead Guest:</span> <span className="font-bold text-slate-900 uppercase text-sm">{resObj.guestName}</span></p>
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Nationality:</span> {resObj.guestNationality}</p>
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Stay Period:</span> <span className="font-semibold text-indigo-950 font-serif">{resObj.checkIn}</span> to <span className="font-semibold text-indigo-950 font-serif">{resObj.checkOut}</span> ({nightsLocal} nights)</p>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Status:</span>
                    <div className="flex items-center gap-2">
                      <select 
                        value={resObj.status}
                        onChange={(e) => onSaveReservation({...resObj, status: e.target.value as any})}
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold outline-none cursor-pointer border ${
                          resObj.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-850 border-emerald-100' :
                          resObj.status === 'Cancelled' ? 'bg-rose-50 text-rose-850 border-rose-100' :
                          'bg-amber-50 text-amber-850 border-amber-100'
                        }`}
                      >
                        <option value="Tentative">Tentative</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      {resObj.status === 'Cancelled' && <span className="text-[9px] text-rose-600 font-bold">(Reason: {resObj.cancellationReason || 'N/A'})</span>}
                    </div>
                  </div>
                  {resObj.status === 'Tentative' && (
                    <div className="space-y-1 bg-rose-50/30 p-2 rounded border border-rose-100">
                      <p className="text-rose-900 font-medium font-mono"><span className="font-bold uppercase text-[9px] block text-rose-450">Client Option Expire:</span> 📅 {resObj.clientOptionDate || 'Not Configured'}</p>
                      <p className="text-red-900 font-medium font-mono"><span className="font-bold uppercase text-[9px] block text-red-400">Supplier Option Expire:</span> 📅 {resObj.supplierOptionDate || 'Not Configured'}</p>
                    </div>
                  )}
                  {resObj.status === 'Confirmed' && (
                    <p className="font-mono bg-emerald-50/40 p-2 rounded border border-emerald-100"><span className="font-bold text-emerald-800 uppercase text-[9px] block">Hotel Confirmation #:</span> {resObj.hotelConfirmationNo || 'Pending Allocation'}</p>
                  )}
                </div>

                <div className="space-y-2.5 text-xs">
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Tour Operator Client:</span> <span className="font-semibold text-slate-800">{agents.find(a => a.id === resObj.clientId)?.companyName || 'N/A'}</span></p>
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Voucher Supplier Sponsor:</span> <span className="font-semibold text-slate-800">{agents.find(a => a.id === resObj.supplierId)?.name || 'Direct Hotel'}</span></p>
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Hotel:</span> {hotelObj?.name}</p>
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Agreement Contract Code:</span> {resObj.agreementNo || 'Direct Standard'}</p>
                  <p><span className="font-bold text-slate-400 uppercase text-[9px] block">Agreement Status:</span> <span className="font-bold uppercase font-mono text-indigo-750">{resObj.agreementStatus || 'Pending'}</span></p>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Rooms Demanded:</span>
                    <ul className="text-[10px] list-disc pl-4 text-indigo-900 font-medium">
                      {resObj.rooms.map((rm, i) => (
                        <li key={i}>{rm.qty}x {rm.roomType} ({rm.view} / {rm.mealPlan})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Financial Balance sheet of this reservation */}
              <div className="bg-slate-50/80 rounded-xl p-4 mt-4 border border-slate-150 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">Total Invoiced (Sell)</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">{totalSell.toLocaleString()} SAR</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">Supplier Cost (Buy)</span>
                  <span className="font-mono font-bold text-amber-900 text-sm">{totalBuy.toLocaleString()} SAR</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">Operator Deposit</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">{(resObj.amountPaidByClient || 0).toLocaleString()} SAR</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">Estimated Profit</span>
                  <span className="font-mono font-bold text-indigo-650 text-sm">{profit.toLocaleString()} SAR</span>
                </div>
              </div>

              {/* TWO PANEL ADD-ON: Editable metadata and interactive payments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                
                {/* Panel 1: Editable Confirmation Keys & Agreement Status */}
                <div className="bg-slate-100/50 p-4 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    ⚙️ Edit Confirmation Details & Agreements
                  </h4>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hotel Conf Number</label>
                      <input
                        type="text"
                        value={localHotelConf}
                        onChange={(e) => setLocalHotelConf(e.target.value)}
                        placeholder="e.g. CONF-99201"
                        className="w-full bg-white border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Agreement / Contract ID</label>
                      <input
                        type="text"
                        value={localAgreementNo}
                        onChange={(e) => setLocalAgreementNo(e.target.value)}
                        placeholder="e.g. CONTRACT-ZM502"
                        className="w-full bg-white border border-slate-200 px-3 rounded-lg py-1.5 text-xs font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Agreement Status</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['Approved', 'Pending', 'Declined'] as const).map((statusVal) => (
                          <button
                            key={statusVal}
                            type="button"
                            onClick={() => setLocalAgreementStatus(statusVal)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${
                              localAgreementStatus === statusVal
                                ? statusVal === 'Approved' ? 'bg-emerald-600 border-emerald-600 text-white' :
                                  statusVal === 'Declined' ? 'bg-rose-600 border-rose-600 text-white' :
                                  'bg-amber-500 border-amber-500 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            {statusVal}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Rooming List / Guest Names</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {localRoomDetails.map((rm, idx) => (
                          <div key={idx} className="flex gap-2">
                            <div className="flex bg-slate-100 rounded-lg px-2 items-center justify-center font-bold text-slate-400 text-xs w-8">
                              {idx + 1}
                            </div>
                            <input
                              type="text"
                              value={rm.name}
                              onChange={(e) => {
                                const newDetails = [...localRoomDetails];
                                newDetails[idx].name = e.target.value;
                                setLocalRoomDetails(newDetails);
                              }}
                              placeholder="Guest Name"
                              className="flex-1 bg-white border border-slate-200 px-2 rounded-lg py-1.5 text-xs focus:outline-none focus:border-amber-400 font-semibold text-slate-800"
                            />
                            <input
                              type="text"
                              value={rm.confNo}
                              onChange={(e) => {
                                const newDetails = [...localRoomDetails];
                                newDetails[idx].confNo = e.target.value;
                                setLocalRoomDetails(newDetails);
                              }}
                              placeholder="Conf #"
                              className="w-24 bg-white border border-slate-200 px-2 rounded-lg py-1.5 text-xs focus:outline-none focus:border-amber-400 font-mono text-slate-800"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleUpdateConfirmationSpecs}
                        className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl transition text-[10px] uppercase tracking-wider shadow-sm cursor-pointer"
                      >
                        💾 Update Booking references
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const resObjToPrint = reservations.find(r => r.id.toString() === viewingId);
                          if (resObjToPrint) setPrintingRoomingList(resObjToPrint);
                        }}
                        className="flex-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold py-2 rounded-xl transition text-[10px] uppercase tracking-wider shadow-sm cursor-pointer whitespace-nowrap"
                      >
                        🖨️ Print Rooming List
                      </button>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Ledger Transaction direct automation workspace */}
                <div className="bg-amber-50/15 p-4 border border-amber-200 rounded-xl space-y-3">
                  <h4 className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                    💳 Record Booking Payments to Transactions
                  </h4>

                  {/* Toggle payment destination type */}
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      id="opt-client-pay-trigger"
                      onClick={() => {
                        const outstanding = totalSell - (resObj.amountPaidByClient || 0);
                        setPayAmount(outstanding > 0 ? outstanding : 0);
                      }}
                      className="bg-white py-1 font-bold rounded text-slate-800 border shadow-sm border-slate-200 text-center"
                    >
                      Client Received Info
                    </button>
                    <button
                      type="button"
                      id="opt-supp-pay-trigger"
                      onClick={() => {
                        const outstandingSupp = totalBuy - (resObj.amountPaidToSupplier || 0);
                        setPayAmount(outstandingSupp > 0 ? outstandingSupp : 0);
                      }}
                      className="bg-white py-1 font-bold rounded text-slate-800 border shadow-sm border-slate-200 text-center"
                    >
                      What I Paid Supplier
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 flex gap-2">
                      <div className="w-1/3">
                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Currency</label>
                        <select
                          value={payCurrency}
                          onChange={(e) => setPayCurrency(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 px-2 rounded-lg py-1 text-xs font-semibold focus:outline-none"
                        >
                          <option value="SAR">SAR</option>
                          <option value="EGP">EGP</option>
                        </select>
                      </div>
                      
                      {payCurrency === 'SAR' ? (
                        <div className="w-2/3">
                          <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Amount (SAR)</label>
                          <input
                            type="number"
                            value={payAmount || ''}
                            onChange={(e) => setPayAmount(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 px-2.5 rounded-lg py-1 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            required
                          />
                        </div>
                      ) : (
                        <>
                          <div className="w-1/3">
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">EGP Amount</label>
                            <input
                              type="number"
                              value={payOriginalAmount || ''}
                              onChange={(e) => setPayOriginalAmount(Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 px-2.5 rounded-lg py-1 text-xs font-mono font-bold text-indigo-700 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                              required
                            />
                          </div>
                          <div className="w-1/3">
                            <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Exch. Rate</label>
                            <input
                              type="number"
                              value={payExchangeRate || ''}
                              step="0.01"
                              onChange={(e) => setPayExchangeRate(Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 px-2.5 rounded-lg py-1 text-xs font-mono font-bold text-indigo-700 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                              required
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Payment Method</label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 px-2 rounded-lg py-1 text-xs font-semibold"
                      >
                        <option value="Cash">Cash (كاش)</option>
                        <option value="Bank Transfer">Bank Transfer (تحويل)</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Voucher / Receipt Reference</label>
                      <input
                        type="text"
                        value={payVoucher}
                        onChange={(e) => setPayVoucher(e.target.value)}
                        placeholder="REC-5509"
                        className="w-full bg-white border border-slate-200 px-3 rounded-lg py-1 text-xs font-mono font-semibold"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Debit/Credit Treasury Bank Account</label>
                      <select
                        value={payAccountId}
                        onChange={(e) => setPayAccountId(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-2.5 rounded-lg py-1.5 text-xs font-semibold"
                        required
                      >
                        <option value="">-- Select Bank/Safe Account --</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} SAR)</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handlePostBookingPayment(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl transition text-[10px] uppercase cursor-pointer"
                    >
                      📥 Post Client Pay
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePostBookingPayment(false)}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl transition text-[10px] uppercase cursor-pointer"
                    >
                      📤 Post Supplier Pay
                    </button>
                  </div>
                </div>

              </div>

              {/* Triggering confirmation PDF prints buttons */}
              <div className="flex flex-wrap gap-2 justify-between items-center border-t border-slate-150 mt-6 pt-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPrintingDoc({ res: resObj, isVoucher: false })}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl transition shadow text-xs"
                  >
                    📄 Print Agent Confirmation PDF
                  </button>
                  <button
                    onClick={() => setPrintingDoc({ res: resObj, isVoucher: true })}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition shadow text-xs"
                  >
                    🎫 Print Guest Card Voucher
                  </button>
                </div>
                <button
                  onClick={() => setViewingId(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl transition text-xs"
                >
                  Close Detail Pane
                </button>
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

    </div>
  );
}
