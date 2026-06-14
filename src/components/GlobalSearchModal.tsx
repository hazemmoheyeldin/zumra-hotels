/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Global Search Modal (Ctrl+K) — searches across Reservations, Agents, and Hotels
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Reservation, Agent, Hotel } from '../types';
import { getReservationTotals } from '../lib/storage';

interface GlobalSearchModalProps {
  reservations: Reservation[];
  agents: Agent[];
  hotels: Hotel[];
  onClose: () => void;
  onNavigate: (tab: string, filters?: any) => void;
}

type SearchResult = {
  type: 'reservation' | 'agent' | 'hotel';
  id: string | number;
  title: string;
  subtitle: string;
  icon: string;
  tab: string;
  filters?: any;
};

export default function GlobalSearchModal({ reservations, agents, hotels, onClose, onNavigate }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Search results
  const results = useMemo<SearchResult[]>(() => {
    if (!debouncedQuery.trim()) return [];
    const term = debouncedQuery.toLowerCase().trim();
    const maxPerGroup = 10;

    // Search reservations
    const resResults: SearchResult[] = [];
    for (const res of reservations) {
      if (resResults.length >= maxPerGroup) break;
      const hotel = hotels.find(h => h.id === res.hotelId);
      const client = agents.find(a => a.id === res.clientId);
      const searchStr = `${res.id} ${res.guestName} ${hotel?.name || ''} ${client?.name || ''} ${client?.companyName || ''} ${res.hotelConfirmationNo || ''} ${res.agreementNo || ''}`.toLowerCase();
      if (searchStr.includes(term)) {
        const totals = getReservationTotals(res);
        resResults.push({
          type: 'reservation',
          id: res.id,
          title: `RSV-${res.id} — ${res.guestName}`,
          subtitle: `${hotel?.name || 'Hotel'} | ${res.checkIn} → ${res.checkOut} | ${res.status} | ${totals.totalSell.toLocaleString()} SAR`,
          icon: '📅',
          tab: 'Reservations',
          filters: { reservationId: res.id },
        });
      }
    }

    // Search agents
    const agentResults: SearchResult[] = [];
    for (const agent of agents) {
      if (agentResults.length >= maxPerGroup) break;
      const searchStr = `${agent.id} ${agent.name} ${agent.companyName} ${agent.agentNumber} ${agent.email} ${agent.phone}`.toLowerCase();
      if (searchStr.includes(term)) {
        agentResults.push({
          type: 'agent',
          id: agent.id,
          title: `${agent.companyName || agent.name}`,
          subtitle: `${agent.agentNumber} | ${agent.type} | ${agent.country || ''} | Balance: ${agent.balance.toLocaleString()} SAR`,
          icon: '👥',
          tab: 'Agents',
          filters: { agentId: agent.id },
        });
      }
    }

    // Search hotels
    const hotelResults: SearchResult[] = [];
    for (const hotel of hotels) {
      if (hotelResults.length >= maxPerGroup) break;
      const searchStr = `${hotel.name} ${hotel.nameAr || ''} ${hotel.city} ${hotel.stars}`.toLowerCase();
      if (searchStr.includes(term)) {
        hotelResults.push({
          type: 'hotel',
          id: hotel.id,
          title: hotel.name,
          subtitle: `${hotel.city} | ${'⭐'.repeat(hotel.stars)} | ${hotel.roomTypes?.length || 0} room types`,
          icon: '🏢',
          tab: 'Hotels',
          filters: { hotelId: hotel.id },
        });
      }
    }

    return [...resResults, ...agentResults, ...hotelResults];
  }, [debouncedQuery, reservations, agents, hotels]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    onNavigate(result.tab, result.filters);
    onClose();
  };

  // Group results by type for display
  const groupedResults = useMemo(() => {
    const groups: { label: string; icon: string; items: SearchResult[] }[] = [];
    const resItems = results.filter(r => r.type === 'reservation');
    const agentItems = results.filter(r => r.type === 'agent');
    const hotelItems = results.filter(r => r.type === 'hotel');
    if (resItems.length) groups.push({ label: 'Reservations', icon: '📅', items: resItems });
    if (agentItems.length) groups.push({ label: 'Agents', icon: '👥', items: agentItems });
    if (hotelItems.length) groups.push({ label: 'Hotels', icon: '🏢', items: hotelItems });
    return groups;
  }, [results]);

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center z-[100] pt-[10dvh] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up border border-slate-200 max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search reservations, agents, hotels..."
            className="flex-1 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden md:inline-block text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {!debouncedQuery.trim() && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              <p className="font-medium">Start typing to search</p>
              <p className="text-xs mt-1">Search by RSV#, guest name, hotel, agent name, or confirmation number</p>
            </div>
          )}

          {debouncedQuery.trim() && results.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              <p className="font-medium">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {groupedResults.map((group) => (
            <div key={group.label}>
              <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 sticky top-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {group.icon} {group.label} ({group.items.length})
                </span>
              </div>
              {group.items.map((item) => {
                flatIndex++;
                const idx = flatIndex;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-5 py-3 flex items-start gap-3 transition border-b border-slate-50 cursor-pointer ${
                      idx === selectedIndex ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${idx === selectedIndex ? 'text-indigo-800' : 'text-slate-800'}`}>
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                    {idx === selectedIndex && (
                      <kbd className="text-[9px] font-mono font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 flex-shrink-0 mt-1">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex-shrink-0 px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">↵</kbd> Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Esc</kbd> Close
            </span>
            <span className="ml-auto text-slate-300">{results.length} results</span>
          </div>
        )}
      </div>
    </div>
  );
}
