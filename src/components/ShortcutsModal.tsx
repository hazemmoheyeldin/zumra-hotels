/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const shortcuts = [
  { key: 'N', desc: 'New Booking', group: 'Navigation' },
  { key: 'Ctrl + 1', desc: 'Dashboard', group: 'Navigation' },
  { key: 'Ctrl + 2', desc: 'Reservations', group: 'Navigation' },
  { key: 'Ctrl + 3', desc: 'Hotels', group: 'Navigation' },
  { key: 'Ctrl + 4', desc: 'Agents', group: 'Navigation' },
  { key: 'Ctrl + 5', desc: 'Transactions', group: 'Navigation' },
  { key: 'Ctrl + K', desc: 'Global Search', group: 'Actions' },
  { key: 'Ctrl + B', desc: 'Reports', group: 'Actions' },
  { key: 'Ctrl + J', desc: 'Sales Pipeline', group: 'Actions' },
  { key: 'Ctrl + .', desc: 'Toggle Sidebar', group: 'Actions' },
  { key: 'C', desc: 'Calculator', group: 'Tools' },
  { key: 'Shift + ?', desc: 'Show Shortcuts', group: 'Tools' },
  { key: 'Esc', desc: 'Close Modals', group: 'Tools' },
];

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const groups = [...new Set(shortcuts.map(s => s.group))];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0 bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <span className="text-base">⌨️</span> Keyboard Shortcuts
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg transition">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {groups.map(group => (
            <div key={group}>
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2">{group}</div>
              <div className="grid grid-cols-2 gap-2">
                {shortcuts.filter(s => s.group === group).map(({ key, desc }) => (
                  <React.Fragment key={key}>
                    <kbd className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono font-bold text-slate-700 text-right shadow-sm">
                      {key}
                    </kbd>
                    <span className="text-xs text-slate-600 flex items-center">{desc}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-shrink-0 border-t border-slate-100 px-6 py-3 text-center">
          <p className="text-[10px] text-slate-400">Press <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[9px] font-mono font-bold">Esc</kbd> or click outside to close</p>
        </div>
      </div>
    </div>
  );
}
