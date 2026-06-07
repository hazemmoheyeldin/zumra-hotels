import React, { useState } from 'react';
import { Reservation, Agent, Hotel, Transaction, StampPosition } from '../types';
import { getReservationTotals, getPaxForRoomType, abbreviateMealPlan } from '../lib/storage';
import ZumraLogo from './ZumraLogo';
import StampOverlay, { getStampSettings, saveStampSettings } from './StampOverlay';
import { downloadPDF, compressImagesForPrint, exportPDF } from '../lib/pdfGenerator';
import { useLang } from '../lib/LanguageContext';

interface InvoicePDFProps {
  reservation: Reservation;
  client: Agent | undefined;
  hotel: Hotel | undefined;
  transactions: Transaction[];
  onClose: () => void;
}

export default function InvoicePDF({ reservation, client, hotel, transactions, onClose }: InvoicePDFProps) {
  const totals = getReservationTotals(reservation);
  const { t, lang } = useLang();
  const stampDefaults = getStampSettings();
  const [stampVisible, setStampVisible] = useState(stampDefaults.enabled);
  const [stampPosition, setStampPosition] = useState<StampPosition>(stampDefaults.position);

  // Pre-compress images for smaller PDF file size (WhatsApp-friendly)
  React.useEffect(() => { compressImagesForPrint('print-area'); }, []);

  // Filter payments for this reservation
  const payments = transactions.filter(t =>
    t.reservationId === String(reservation.id) &&
    (t.type === 'ClientPayment' || t.type === 'ClientRefund')
  );
  const totalPaid = payments
    .filter(p => p.type === 'ClientPayment')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = payments
    .filter(p => p.type === 'ClientRefund')
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = totals.totalWithVat - totalPaid + totalRefunded;

  const invoiceNo = `INV-${reservation.id}`;
  const invoiceDate = new Date().toISOString().split('T')[0];

  const handlePrint = async () => {
    const guestSafe = (reservation.guestName || 'Guest').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const hotelName = (hotel?.name || 'Hotel').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const success = await exportPDF('print-area', `${invoiceNo} ${guestSafe} ${hotelName} ${invoiceDate}.pdf`, { landscape: false });
    if (success) setTimeout(onClose, 400);
  };

  const formatDate = (d: string) => {
    if (!d) return 'N/A';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-slate-200 no-print">
          <h2 className="font-bold text-slate-800">{t('ipdf.preview')}</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={stampVisible} onChange={e => setStampVisible(e.target.checked)} className="rounded" /> Stamp
            </label>
            {stampVisible && (
              <button
                onClick={() => { setStampPosition('bottom-right'); saveStampSettings({ enabled: stampVisible, position: 'bottom-right', opacity: 0.18 }); }}
                className="px-2 py-1 border rounded text-xs bg-white hover:bg-slate-50 text-slate-500 cursor-pointer"
                title="Reset stamp to default position"
              >Reset</button>
            )}
            <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              {t('ipdf.printSave')}
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">
              {t('common.close')}
            </button>
          </div>
        </div>

        {/* Printable Invoice */}
        <div className="overflow-y-auto flex-1 p-4">
          <div
            id="print-area"
            className="relative bg-white p-6 border border-slate-200 text-slate-900 font-sans shadow-inner max-h-[80vh] overflow-y-auto no-scrollbar print:p-4 print:border-none print:shadow-none print:max-h-full print:overflow-visible"
          >
            <StampOverlay
              visible={stampVisible}
              position={stampPosition}
              opacity={0.18}
              onPositionChange={(pos) => { setStampPosition(pos); saveStampSettings({ enabled: stampVisible, position: pos, opacity: 0.18 }); }}
            />
            {/* Header: Company Name LEFT + Logo RIGHT */}
            <div className="flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-4 gap-4">
              <div className="flex flex-col text-left font-sans flex-1">
                <span className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
                  ZUMRA HOTELS
                </span>
                <span className="text-lg font-bold text-slate-800 tracking-wider font-serif mt-0.5" dir="rtl">
                  زمرة للفنادق
                </span>
                <p className="text-sm text-slate-500 mt-1">{t('ipdf.invoiceTitle')}</p>
              </div>
              <div className="flex-shrink-0">
                <ZumraLogo size="xxl" />
              </div>
            </div>

            {/* Invoice details */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-1">{t('ipdf.billTo')}</h3>
                <p className="font-bold text-slate-800">{client?.companyName || client?.name || 'N/A'}</p>
                <p className="text-sm text-slate-600">{client?.address || ''}</p>
                <p className="text-sm text-slate-600">{client?.phone || ''}</p>
                <p className="text-sm text-slate-600">{client?.email || ''}</p>
              </div>
              <div className="text-right">
                <div className="inline-block text-left">
                  <div className="flex justify-between gap-6 text-sm">
                    <span className="text-slate-500">{t('ipdf.invoiceNo')}</span>
                    <span className="font-bold">{invoiceNo}</span>
                  </div>
                  <div className="flex justify-between gap-6 text-sm">
                    <span className="text-slate-500">{t('ipdf.dateLabel')}</span>
                    <span className="font-medium">{formatDate(invoiceDate)}</span>
                  </div>
                  <div className="flex justify-between gap-6 text-sm">
                    <span className="text-slate-500">{lang === 'ar' ? 'رقم الحجز:' : 'RSV #:'}</span>
                    <span className="font-medium">{reservation.id}</span>
                  </div>
                  <div className="flex justify-between gap-6 text-sm">
                    <span className="text-slate-500">{t('ipdf.statusLabel')}</span>
                    <span className={`font-bold ${reservation.status === 'Cancelled' ? 'text-red-600' : reservation.status === 'Confirmed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {reservation.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reservation Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">{t('ipdf.guest')}</div>
                  <div className="font-bold">{reservation.guestName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Hotel</div>
                  <div className="font-bold">{hotel?.name || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">{t('ipdf.checkInCheckOut')}</div>
                  <div className="font-medium">{formatDate(reservation.checkIn)} - {formatDate(reservation.checkOut)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">{t('ipdf.nightsLabel')}</div>
                  <div className="font-bold">{reservation.nights}</div>
                </div>
              </div>
            </div>

            {/* Itemized Charges Table */}
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2 text-left text-xs font-bold">{lang === 'ar' ? '#' : '#'}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">{t('ipdf.descriptionCol')}</th>
                  <th className="px-3 py-2 text-center text-xs font-bold">{t('ipdf.qtyCol')}</th>
                  <th className="px-3 py-2 text-center text-xs font-bold">{t('ipdf.nightsLabel')}</th>
                  <th className="px-3 py-2 text-right text-xs font-bold">{t('ipdf.rateCol')}</th>
                  <th className="px-3 py-2 text-right text-xs font-bold">{t('ipdf.amountSAR')}</th>
                </tr>
              </thead>
              <tbody>
                {reservation.rooms.map((room, idx) => {
                  const pax = getPaxForRoomType(room.roomType);
                  const mealLabel = abbreviateMealPlan(room.mealPlan) || room.mealPlan;
                  const nights = reservation.nights;
                  const qty = room.qty;
                  const rate = typeof room.nightlyRates === 'number' ? room.nightlyRates : 0;
                  const roomTotal = rate * nights * qty;

                  return (
                    <React.Fragment key={room.id}>
                      {/* Room charge */}
                      <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-2 border border-slate-200">{idx + 1}</td>
                        <td className="px-3 py-2 border border-slate-200">
                          <div className="font-medium">{room.roomType} Room{qty > 1 ? ` x${qty}` : ''} - {mealLabel}</div>
                          {room.view && <div className="text-[10px] text-slate-500">View: {room.view}</div>}
                        </td>
                        <td className="px-3 py-2 border border-slate-200 text-center">{qty}</td>
                        <td className="px-3 py-2 border border-slate-200 text-center">{nights}</td>
                        <td className="px-3 py-2 border border-slate-200 text-right">{fmt(rate)}</td>
                        <td className="px-3 py-2 border border-slate-200 text-right font-medium">{fmt(roomTotal)}</td>
                      </tr>

                      {/* Meal rate if separate */}
                      {room.hasSeparateMealRate && room.mealRate > 0 && (
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 border border-slate-200"></td>
                          <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">
                            {t('ipdf.mealPlanLabel')} {mealLabel} ({pax} {lang === 'ar' ? 'أشخاص' : 'pax'})
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{pax * qty}</td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{nights}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right">{fmt(room.mealRate)}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-medium">{fmt(room.mealRate * pax * nights * qty)}</td>
                        </tr>
                      )}

                      {/* Extra bed */}
                      {room.hasExtraBed && (room.extraBedRate || 0) > 0 && (
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 border border-slate-200"></td>
                          <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">
                            {t('ipdf.extraBeds')}
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{Math.max(0, pax - 2) * qty}</td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{nights}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right">{fmt(room.extraBedRate || 0)}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-medium">{fmt((room.extraBedRate || 0) * Math.max(0, pax - 2) * nights * qty)}</td>
                        </tr>
                      )}

                      {/* View supplement */}
                      {room.hasViewSupplement && (room.viewSupplementRate || 0) > 0 && (
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 border border-slate-200"></td>
                          <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">
                            {t('ipdf.viewSuppLabel')} {room.view || (lang === 'ar' ? 'غير متاح' : 'N/A')}
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{qty}</td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{nights}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right">{fmt(room.viewSupplementRate || 0)}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-medium">{fmt((room.viewSupplementRate || 0) * nights * qty)}</td>
                        </tr>
                      )}

                      {/* Extra meals */}
                      {room.hasExtraMeal1 && (room.extraMeal1Rate || 0) > 0 && (
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 border border-slate-200"></td>
                          <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">
                            {t('ipdf.extraLabel')} {room.extraMeal1Label || (lang === 'ar' ? 'وجبة 1' : 'Meal 1')} ({pax} {lang === 'ar' ? 'أشخاص' : 'pax'})
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{pax * qty}</td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{nights}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right">{fmt(room.extraMeal1Rate || 0)}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-medium">{fmt((room.extraMeal1Rate || 0) * pax * nights * qty)}</td>
                        </tr>
                      )}
                      {room.hasExtraMeal2 && (room.extraMeal2Rate || 0) > 0 && (
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 border border-slate-200"></td>
                          <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">
                            {t('ipdf.extraLabel')} {room.extraMeal2Label || (lang === 'ar' ? 'وجبة 2' : 'Meal 2')} ({pax} {lang === 'ar' ? 'أشخاص' : 'pax'})
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{pax * qty}</td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{nights}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right">{fmt(room.extraMeal2Rate || 0)}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-medium">{fmt((room.extraMeal2Rate || 0) * pax * nights * qty)}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-72">
                <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">{t('ipdf.subtotal')}</span>
                  <span className="font-medium">{fmt(totals.totalSell)}</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">{t('ipdf.vatIncl')}</span>
                  <span className="font-medium">{fmt(totals.vat)}</span>
                </div>
                <div className="flex justify-between text-base py-2 border-b-2 border-slate-800 font-bold">
                  <span>{t('ipdf.totalLabel')}</span>
                  <span>{fmt(totals.totalWithVat)} SAR</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-emerald-200 bg-emerald-50 px-2 -mx-2">
                  <span className="text-emerald-700">{t('ipdf.amountPaid')}</span>
                  <span className="font-medium text-emerald-700">- {fmt(totalPaid)}</span>
                </div>
                {totalRefunded > 0 && (
                  <div className="flex justify-between text-sm py-1.5 border-b border-orange-200 bg-orange-50 px-2 -mx-2">
                    <span className="text-orange-700">{t('ipdf.refunded')}</span>
                    <span className="font-medium text-orange-700">+ {fmt(totalRefunded)}</span>
                  </div>
                )}
                <div className={`flex justify-between text-base py-2 font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  <span>{balance > 0 ? t('ipdf.balanceDue') : balance < 0 ? t('ipdf.overpaid') : t('ipdf.settled')}</span>
                  <span>{fmt(Math.abs(balance))} SAR</span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">{t('ipdf.paymentHistory')}</h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-2 py-1.5 text-left font-bold">{t('common.date')}</th>
                      <th className="px-2 py-1.5 text-left font-bold">{t('common.type')}</th>
                      <th className="px-2 py-1.5 text-left font-bold">{t('ipdf.voucherCol')}</th>
                      <th className="px-2 py-1.5 text-left font-bold">{t('ipdf.methodCol')}</th>
                      <th className="px-2 py-1.5 text-right font-bold">{t('ipdf.amountSAR')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="px-2 py-1.5">{formatDate(p.date)}</td>
                        <td className="px-2 py-1.5">{p.type === 'ClientPayment' ? t('ipdf.payment') : t('ipdf.refund')}</td>
                        <td className="px-2 py-1.5">{p.voucherNo || '-'}</td>
                        <td className="px-2 py-1.5">{p.paymentMethod}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${p.type === 'ClientRefund' ? 'text-orange-600' : 'text-emerald-600'}`}>
                          {p.type === 'ClientRefund' ? '-' : ''}{fmt(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Terms & Notes */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="grid grid-cols-2 gap-6 text-xs text-slate-500">
                <div>
                  <h4 className="font-bold text-slate-700 mb-1">{t('pdf.termsConditions')}</h4>
                  <p>{reservation.termsAndConditions || t('ipdf.termsText')}</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 mb-1">{t('ipdf.bankDetailsTitle')}</h4>
                  <p>{t('ipdf.bankDetailsText')}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-300 pt-3 mt-4 text-center text-[10px] text-slate-400">
              {t('ipdf.footerText')} {formatDate(invoiceDate)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
