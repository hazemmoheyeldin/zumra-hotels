/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * SmartSelect - Reusable searchable dropdown with autocomplete
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface SmartSelectOption {
  id: string;
  label: string;
  sublabel?: string;    // Secondary text (e.g. Arabic name)
  number?: string | number;       // Lookup number (hotel number, agent ID like C-001)
  badge?: string;        // Badge text (e.g. city, stars)
  disabled?: boolean;    // Greyed out option
  warning?: string;      // Warning text (e.g. Suspended, Blacklisted)
  extra?: string;        // Additional info line
}

interface SmartSelectProps {
  options: SmartSelectOption[];
  value: string | null;              // Currently selected option id
  onChange: (id: string | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  /** Special "DIRECT" or custom top options that always appear first */
  topOptions?: SmartSelectOption[];
  /** Max items to show in dropdown */
  maxResults?: number;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Clear button */
  clearable?: boolean;
}

export default function SmartSelect({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  label,
  required,
  disabled,
  className = '',
  emptyMessage = 'No results found',
  topOptions = [],
  maxResults = 20,
  compact = false,
  clearable = false,
}: SmartSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find selected option
  const allOptions = [...topOptions, ...options];
  const selectedOption = allOptions.find(o => o.id === value) || null;

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) {
      return [...topOptions, ...options].slice(0, maxResults + topOptions.length);
    }
    
    const query = search.trim().toLowerCase();
    const numQuery = parseInt(search.trim());
    
    const scored = options.map(opt => {
      let score = 0;
      const labelLower = opt.label.toLowerCase();
      const subLower = (opt.sublabel || '').toLowerCase();
      
      // Exact number match = highest priority
      if (opt.number !== undefined && opt.number === numQuery) score += 100;
      // Exact label match
      if (labelLower === query) score += 90;
      // Starts with query
      if (labelLower.startsWith(query)) score += 80;
      // Contains query
      if (labelLower.includes(query)) score += 60;
      // Arabic name match
      if (subLower && (opt.sublabel || '').includes(search.trim())) score += 50;
      // Number prefix match
      if (opt.number !== undefined && opt.number.toString().startsWith(search.trim())) score += 40;
      // Word boundary match
      const words = labelLower.split(/\s+/);
      if (words.some(w => w.startsWith(query))) score += 30;
      
      return { opt, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
    
    return [...topOptions, ...scored.map(s => s.opt)].slice(0, maxResults + topOptions.length);
  }, [search, options, topOptions, maxResults]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Auto-select on exact number match
  useEffect(() => {
    if (search.trim()) {
      const numQuery = parseInt(search.trim());
      if (!isNaN(numQuery)) {
        const exactMatch = options.find(o => o.number === numQuery);
        if (exactMatch && filteredOptions.length === 1 + topOptions.length) {
          // Only exact number match remains
          // Don't auto-select, let user press Enter
        }
      }
    }
  }, [search, filteredOptions, options, topOptions.length]);

  const selectOption = useCallback((opt: SmartSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.id);
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        selectOption(filteredOptions[highlightedIndex]);
      } else if (isOpen && filteredOptions.length === 1) {
        selectOption(filteredOptions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      setHighlightedIndex(-1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setSearch('');
    }
  };

  const getStarsDisplay = (opt: SmartSelectOption) => {
    if (!opt.badge) return null;
    // If badge contains star info, show it
    if (opt.badge.includes('★')) return opt.badge;
    return null;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      
      {/* Display area */}
      <div
        className={`w-full border rounded-lg transition cursor-text ${
          isOpen ? 'border-amber-500 ring-1 ring-amber-200' : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'bg-slate-100 opacity-60' : 'bg-white'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {selectedOption && !isOpen ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {selectedOption.number && (
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 rounded">{selectedOption.number}</span>
                )}
                <span className={`text-xs font-semibold truncate ${selectedOption.warning ? 'text-rose-600' : 'text-slate-800'}`}>
                  {selectedOption.label}
                </span>
                {selectedOption.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                    {selectedOption.badge}
                  </span>
                )}
              </div>
              {selectedOption.sublabel && (
                <span className="text-[10px] text-slate-400" dir="rtl">{selectedOption.sublabel}</span>
              )}
            </div>
            {clearable && !disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                className="text-slate-400 hover:text-rose-500 p-0.5 shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={isOpen ? search : ''}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {}}
              onKeyDown={handleKeyDown}
              placeholder={selectedOption ? selectedOption.label : placeholder}
              disabled={disabled}
              className={`flex-1 px-3 outline-none text-xs font-semibold text-slate-800 placeholder:text-slate-400 ${compact ? 'py-1' : 'py-1.5'}`}
              autoComplete="off"
            />
            <svg className="w-4 h-4 text-slate-400 shrink-0 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto"
          style={{ minWidth: '200px' }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">{emptyMessage}</div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={opt.id}
                className={`px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${
                  idx === highlightedIndex ? 'bg-amber-50' : 'hover:bg-slate-50'
                } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${
                  topOptions.includes(opt) ? 'bg-indigo-50/50' : ''
                } ${opt.id === value ? 'bg-amber-100/50' : ''}`}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                <div className="flex items-center gap-2">
                  {opt.number !== undefined && (
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 rounded shrink-0">{opt.number}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold truncate ${opt.warning ? 'text-rose-600' : 'text-slate-800'}`}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {opt.sublabel && (
                      <span className="text-[10px] text-slate-400 block" dir="rtl">{opt.sublabel}</span>
                    )}
                    {opt.warning && (
                      <span className="text-[9px] font-bold text-rose-500 uppercase">{opt.warning}</span>
                    )}
                    {opt.extra && (
                      <span className="text-[9px] text-slate-400 block">{opt.extra}</span>
                    )}
                  </div>
                  {opt.id === value && (
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
