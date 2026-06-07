/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { generateSeedData } from '../lib/storage';
import ZumraLogo from './ZumraLogo';

export interface PortalVisibilitySettings {
  showFinancialInfo: boolean; // totals, paid, outstanding
  showBookingDetails: boolean; // dates, hotel, rooms, nights
  showStatus: boolean; // confirmed/tentative status
  showGuestInfo: boolean; // guest name, nationality
  showSpecialRequests: boolean; // special requests field
  showTags: boolean; // booking tags
  showHotelConfirmation: boolean; // hotel confirmation number
  showPaymentBreakdown: boolean; // detailed payment info
  showSearchAndFilter: boolean; // search and filter controls
  showStats: boolean; // stats cards at top
  allowCancelledBookings: boolean; // show cancelled bookings
}

const DEFAULT_SETTINGS: PortalVisibilitySettings = {
  showFinancialInfo: true,
  showBookingDetails: true,
  showStatus: true,
  showGuestInfo: true,
  showSpecialRequests: true,
  showTags: true,
  showHotelConfirmation: true,
  showPaymentBreakdown: true,
  showSearchAndFilter: true,
  showStats: true,
  allowCancelledBookings: false,
};

const STORAGE_KEY = 'zumra_portal_settings';

export function loadPortalSettings(): PortalVisibilitySettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function savePortalSettings(settings: PortalVisibilitySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface ClientPortalSettingsProps {
  onLogAudit?: (action: string, entityType: string, entityId: string, details: string) => void;
}

export default function ClientPortalSettings({ onLogAudit }: ClientPortalSettingsProps) {
  const [settings, setSettings] = useState<PortalVisibilitySettings>(loadPortalSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleToggle = (key: keyof PortalVisibilitySettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    savePortalSettings(updated);
    onLogAudit?.('Update', 'PortalSettings', key, `Toggled ${key}: ${updated[key]}`);
    setSaved(true);
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    savePortalSettings(DEFAULT_SETTINGS);
    onLogAudit?.('Update', 'PortalSettings', 'all', 'Reset to defaults');
    setSaved(true);
  };

  const handleLoadSeedData = () => {
    if (!confirm('This will add 3 sample reservations, 3 transactions, and 2 follow-ups to your database for testing. Continue?')) return;
    const seed = generateSeedData();
    
    // Save to localStorage
    const existingReservations = JSON.parse(localStorage.getItem('zumra_reservations') || '[]');
    const existingTransactions = JSON.parse(localStorage.getItem('zumra_transactions') || '[]');
    const existingFollowUps = JSON.parse(localStorage.getItem('zumra_follow_ups') || '[]');
    
    const newReservations = [...existingReservations, ...seed.reservations];
    const newTransactions = [...existingTransactions, ...seed.transactions];
    const newFollowUps = [...existingFollowUps, ...seed.followUps];
    
    localStorage.setItem('zumra_reservations', JSON.stringify(newReservations));
    localStorage.setItem('zumra_transactions', JSON.stringify(newTransactions));
    localStorage.setItem('zumra_follow_ups', JSON.stringify(newFollowUps));
    
    onLogAudit?.('Create', 'SeedData', 'seed', `Loaded ${seed.reservations.length} reservations, ${seed.transactions.length} transactions, ${seed.followUps.length} follow-ups`);
    alert('Seed data loaded! Please refresh the page to see the new data.');
    window.location.reload();
  };

  const toggleItems: { key: keyof PortalVisibilitySettings; label: string; description: string; icon: string; category: string }[] = [
    { key: 'showStats', label: 'Statistics Cards', description: 'Show booking count, confirmed, tentative, and outstanding amount cards at the top', icon: '📊', category: 'Layout' },
    { key: 'showSearchAndFilter', label: 'Search & Filter', description: 'Show search box and status filter dropdown', icon: '🔍', category: 'Layout' },
    { key: 'showGuestInfo', label: 'Guest Information', description: 'Show guest name and nationality', icon: '👤', category: 'Booking Details' },
    { key: 'showBookingDetails', label: 'Booking Details', description: 'Show dates, hotel name, room count, and nights', icon: '📋', category: 'Booking Details' },
    { key: 'showStatus', label: 'Booking Status', description: 'Show Confirmed/Tentative status badge', icon: '✅', category: 'Booking Details' },
    { key: 'showHotelConfirmation', label: 'Hotel Confirmation #', description: 'Show hotel confirmation number when available', icon: '🏨', category: 'Booking Details' },
    { key: 'showSpecialRequests', label: 'Special Requests', description: 'Show guest special requests and preferences', icon: '📝', category: 'Booking Details' },
    { key: 'showTags', label: 'Booking Tags', description: 'Show tags like VIP, Honeymoon, Corporate, etc.', icon: '🏷️', category: 'Booking Details' },
    { key: 'showFinancialInfo', label: 'Financial Totals', description: 'Show booking total amount in summary card', icon: '💰', category: 'Financial' },
    { key: 'showPaymentBreakdown', label: 'Payment Breakdown', description: 'Show paid amount, percentage, and outstanding balance', icon: '💳', category: 'Financial' },
    { key: 'allowCancelledBookings', label: 'Show Cancelled', description: 'Include cancelled bookings in the portal view', icon: '❌', category: 'Advanced' },
  ];

  const categories = Array.from(new Set(toggleItems.map(t => t.category)));

  const portalUrl = `${window.location.origin}${window.location.pathname}?portal=CLIENT_ID`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ZumraLogo size="xxl" variant="gold" />
          <div>
            <h2 className="text-xl font-bold text-slate-800">Client Portal Settings</h2>
            <p className="text-sm text-slate-500 mt-1">Configure what information is visible to clients in their booking portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadSeedData}
            className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
          >
            🧪 Load Test Data
          </button>
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Portal URL Info */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔗</span>
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 text-sm">Portal Access URL</h3>
            <p className="text-xs text-amber-700 mt-1">Share this URL with your clients (replace CLIENT_ID with their agent ID):</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 text-[11px] bg-white/80 border border-amber-200 rounded-lg px-3 py-2 font-mono text-amber-900 truncate">
                {portalUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(portalUrl)}
                className="px-3 py-2 text-[10px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Indicator */}
      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-emerald-600">✓</span>
          <span className="text-sm font-medium text-emerald-800">Settings saved automatically</span>
        </div>
      )}

      {/* Settings by Category */}
      {categories.map(category => (
        <div key={category} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-700">{category}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {toggleItems.filter(t => t.category === category).map(item => (
              <div key={item.key} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xl mt-0.5">{item.icon}</span>
                  <div>
                    <div className="font-semibold text-sm text-slate-800">{item.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(item.key)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    settings[item.key] ? 'bg-amber-500' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      settings[item.key] ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Preview Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-700">Live Preview</h3>
          <p className="text-xs text-slate-500 mt-0.5">This is how a booking card will appear to clients</p>
        </div>
        <div className="p-5">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
            {/* Mock booking card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-xs font-mono font-bold text-slate-400">RSV</div>
                    <div className="text-lg font-bold text-slate-800">1001</div>
                  </div>
                  <div>
                    {settings.showGuestInfo && (
                      <>
                        <div className="font-semibold text-slate-800">John Smith</div>
                        <div className="text-xs text-slate-500">Grand Plaza Hotel &bull; 5N</div>
                      </>
                    )}
                    {!settings.showGuestInfo && settings.showBookingDetails && (
                      <div className="text-xs text-slate-500">Grand Plaza Hotel &bull; 5N</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {settings.showFinancialInfo && (
                    <div className="text-right">
                      <div className="text-xs text-slate-500">2026-07-01 → 2026-07-06</div>
                      <div className="font-bold text-sm text-slate-800">12,500 SAR</div>
                    </div>
                  )}
                  {settings.showStatus && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Confirmed
                    </span>
                  )}
                </div>
              </div>
              {settings.showPaymentBreakdown && (
                <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/50">
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Payment</div>
                      <div className="font-medium text-slate-700">Paid: 60%</div>
                      <div className="text-[10px] text-slate-500">7,500 / 12,500</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Outstanding</div>
                      <div className="font-bold text-rose-700">5,000 SAR</div>
                    </div>
                  </div>
                </div>
              )}
              {settings.showSpecialRequests && (
                <div className="border-t border-slate-100 px-5 py-3 bg-amber-50/50">
                  <div className="text-xs text-amber-800">
                    <span className="font-bold">Special Requests:</span> Early check-in, extra pillows
                  </div>
                </div>
              )}
              {settings.showTags && (
                <div className="border-t border-slate-100 px-5 py-3 flex gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">VIP</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700">Honeymoon</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
