/**
 * ConsolidatedInvoicePDF - Professional multi-service invoice PDF
 * with stamp overlay and currency support (SAR/EGP).
 */

import React, { useState } from 'react';
import { ConsolidatedInvoice, Agent, StampPosition } from '../types';
import MasterPDFHeader from './MasterPDFHeader';
import StampOverlay, { getStampSettings, saveStampSettings } from './StampOverlay';
import { exportPDF, compressImagesForPrint } from '../lib/pdfGenerator';

interface ConsolidatedInvoicePDFProps {
  invoice: ConsolidatedInvoice;
  client: Agent | undefined;
  onClose: () => void;
}

const STAMP_POSITIONS: StampPosition[] = ['bottom-right', 'bottom-left', 'bottom-center', 'top-right']; // kept for backward compat

export default function ConsolidatedInvoicePDF({ invoice, client, onClose }: ConsolidatedInvoicePDFProps) {
  const stampDefaults = getStampSettings();
  const [stampVisible, setStampVisible] = useState(invoice.showStamp ?? stampDefaults.enabled);
  const [stampPosition, setStampPosition] = useState<StampPosition>(invoice.stampPosition ?? stampDefaults.position);
  const [isGenerating, setIsGenerating] = useState(false);

  React.useEffect(() => { compressImagesForPrint('print-area'); }, []);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currency = invoice.currency;
  const rate = invoice.exchangeRate;
  const convert = (sar: number) => currency === 'EGP' ? sar * rate : sar;

  const invoiceDate = invoice.createdAt.split('T')[0];
  const formatDate = (d: string) => {
    if (!d) return 'N/A';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  const handlePrint = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const clientName = (client?.companyName || client?.name || 'Client').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      const success = await exportPDF('print-area', `${invoice.invoiceNo} ${clientName} ${invoiceDate}.pdf`, { landscape: false });
      if (success) setTimeout(onClose, 400);
    } catch {
      // fallback
    } finally {
      setIsGenerating(false);
    }
  };

  const whatsappLink = () => {
    const text = `*ZUMRA HOTELS - Consolidated Invoice*\n` +
      `*Invoice:* ${invoice.invoiceNo}\n` +
      `*Client:* ${client?.companyName || client?.name || 'Client'}\n` +
      `*Items:* ${invoice.items.length}\n` +
      `*Total:* ${fmt(convert(invoice.totalWithVat))} ${currency}\n` +
      `*Date:* ${invoiceDate}\n` +
      `Thank you!`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 border-b border-slate-200 no-print">
          <h2 className="font-bold text-slate-800">Consolidated Invoice Preview</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Stamp controls */}
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={stampVisible} onChange={e => setStampVisible(e.target.checked)} className="rounded" />
              Stamp
            </label>
            {stampVisible && (
              <button
                onClick={() => { setStampPosition('bottom-right'); saveStampSettings({ enabled: stampVisible, position: 'bottom-right', opacity: 0.85 }); }}
                className="px-2 py-1 border rounded text-xs bg-white hover:bg-slate-50 text-slate-500 cursor-pointer"
                title="Reset stamp to default position"
              >Reset</button>
            )}
            <button onClick={handlePrint} disabled={isGenerating} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {isGenerating ? 'Generating...' : 'Print / Save PDF'}
            </button>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">WhatsApp</a>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">Close</button>
          </div>
        </div>

        {/* Printable Invoice */}
        <div className="overflow-y-auto flex-1 p-4">
          <div id="print-area" className="relative bg-white p-6 pb-8 border border-slate-200 text-slate-900 font-sans shadow-inner max-h-[80vh] overflow-y-auto no-scrollbar print:p-4 print:pb-0 print:border-none print:shadow-none print:max-h-full print:overflow-visible">

            {/* Stamp Overlay */}
            <StampOverlay
              visible={stampVisible}
              position={stampPosition}
              opacity={0.85}
              onPositionChange={(pos) => { setStampPosition(pos); saveStampSettings({ enabled: stampVisible, position: pos, opacity: 0.85 }); }}
            />

            {/* Header */}
            <MasterPDFHeader />

            {/* Title */}
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Consolidated Invoice</h1>
              <div className="text-right text-xs">
                <div className="font-mono font-bold text-slate-900">{invoice.invoiceNo}</div>
                <div className="text-slate-500">{formatDate(invoiceDate)}</div>
              </div>
            </div>

            {/* Bill To + Currency */}
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Bill To</h3>
                <p className="font-bold text-slate-800">{client?.companyName || client?.name || 'N/A'}</p>
                <p className="text-xs text-slate-600">{client?.address || ''}</p>
                <p className="text-xs text-slate-600">{client?.phone || ''}</p>
                <p className="text-xs text-slate-600">{client?.email || ''}</p>
              </div>
              <div className="text-right">
                <div className="inline-block text-left bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Currency</span>
                    <span className="font-bold text-emerald-700">{currency}</span>
                  </div>
                  {currency === 'EGP' && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Rate</span>
                      <span className="font-medium">1 SAR = {rate} EGP</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse text-xs mb-4">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2 text-left font-bold">#</th>
                  <th className="px-3 py-2 text-left font-bold">Type</th>
                  <th className="px-3 py-2 text-left font-bold">Description</th>
                  <th className="px-3 py-2 text-center font-bold">Qty</th>
                  <th className="px-3 py-2 text-right font-bold">Unit Price (SAR)</th>
                  <th className="px-3 py-2 text-right font-bold">VAT %</th>
                  <th className="px-3 py-2 text-right font-bold">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => {
                  const amount = convert(item.total);
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2 border border-slate-200">{idx + 1}</td>
                      <td className="px-3 py-2 border border-slate-200">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{item.type === 'OtherService' ? 'Service' : 'Hotel'}</span>
                      </td>
                      <td className="px-3 py-2 border border-slate-200 font-medium">{item.description}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right">{fmt(item.unitPrice)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right">{item.taxRate}%</td>
                      <td className="px-3 py-2 border border-slate-200 text-right font-bold">{fmt(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-80">
                <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium">{fmt(convert(invoice.subtotal))} {currency}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">VAT</span>
                  <span className="font-medium">{fmt(convert(invoice.vatAmount))} {currency}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b-2 border-slate-800 font-bold">
                  <span>Grand Total</span>
                  <span className="text-emerald-700">{fmt(convert(invoice.totalWithVat))} {currency}</span>
                </div>
                {currency === 'EGP' && (
                  <div className="flex justify-between text-[10px] py-1 text-slate-500">
                    <span>Original (SAR)</span>
                    <span>{fmt(invoice.totalWithVat)} SAR</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="border-t border-slate-200 pt-3 mb-4">
                <h4 className="text-xs font-bold text-slate-700 mb-1">Notes</h4>
                <p className="text-xs text-slate-600">{invoice.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-slate-200 pt-3 mt-4">
              <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500">
                <div>
                  <h4 className="font-bold text-slate-700 mb-1">Terms & Conditions</h4>
                  <p>All rates quoted in {currency}. Payments due within 30 days of invoice date. Late payments may incur additional charges.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 mb-1">Bank Details</h4>
                  <p>Zumra Hotels - For bank transfer details please contact our finance department.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-300 pt-3 mt-4 text-center text-[10px] text-slate-400">
              Generated by Zumra Hotels RMS | {formatDate(invoiceDate)} | Created by: {invoice.createdBy}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
