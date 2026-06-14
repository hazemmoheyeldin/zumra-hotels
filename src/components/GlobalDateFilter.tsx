/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';

export interface DateRange {
  label: string;
  from: string;
  to: string;
}

interface GlobalDateFilterProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}

const presets: { label: string; compute: () => { from: string; to: string } }[] = [
  {
    label: 'Today',
    compute: () => {
      const t = new Date().toISOString().split('T')[0];
      return { from: t, to: t };
    },
  },
  {
    label: 'This Week',
    compute: () => {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    },
  },
  {
    label: 'This Month',
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    },
  },
  {
    label: 'Last Month',
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    },
  },
  {
    label: 'This Quarter',
    compute: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    },
  },
  {
    label: 'This Year',
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    },
  },
];

export default function GlobalDateFilter({ value, onChange }: GlobalDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyPreset = (preset: typeof presets[number]) => {
    const { from, to } = preset.compute();
    onChange({ label: preset.label, from, to });
    setOpen(false);
  };

  const applyCustom = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange({ label: `${customFrom} → ${customTo}`, from: customFrom, to: customTo });
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold rounded-lg border transition ${
          value
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
        }`}
        title="Global date filter"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span className="max-w-[120px] truncate">{value ? value.label : 'Date Range'}</span>
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="ml-0.5 text-rose-400 hover:text-rose-600 font-bold cursor-pointer"
          >
            x
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[1000] overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="text-[9px] font-bold uppercase text-slate-400 px-1 mb-1">Quick Select</div>
            <div className="grid grid-cols-2 gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={`text-[10px] font-medium px-2 py-1.5 rounded-lg transition text-left ${
                    value?.label === p.label
                      ? 'bg-amber-100 text-amber-800 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-2">
            <div className="text-[9px] font-bold uppercase text-slate-400 px-1 mb-1">Custom Range</div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="flex-1 px-2 py-1 text-[10px] border border-slate-200 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="flex-1 px-2 py-1 text-[10px] border border-slate-200 rounded-lg"
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="w-full mt-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[10px] font-bold py-1.5 rounded-lg transition"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
