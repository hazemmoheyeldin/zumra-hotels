import React, { useState, useEffect } from 'react';
import { getApiWarnings, onApiWarningChange, clearApiWarning } from '../lib/safeFetch';
import { getSyncStatus, onSyncStatusChange, SyncStatus } from '../lib/storage';

/** Non-intrusive API warning banner - shows when external services are unavailable or offline */
export default function ApiWarningBanner() {
  const [warnings, setWarnings] = useState(getApiWarnings());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus());

  useEffect(() => {
    const unsub1 = onApiWarningChange(setWarnings);
    const unsub2 = onSyncStatusChange(setSyncStatus);
    return () => { unsub1(); unsub2(); };
  }, []);

  const keys = Object.keys(warnings);
  const isOffline = !syncStatus.online;

  if (!isOffline && keys.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-2 max-w-sm">
      {isOffline && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg shadow-lg px-3 py-2 flex items-start gap-2 animate-slide-up">
          <span className="text-rose-500 text-sm mt-0.5">🔌</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-rose-800">Connection Lost</p>
            <p className="text-[10px] text-rose-600">Working offline. Changes will sync when reconnected.</p>
            {syncStatus.pendingCount > 0 && (
              <p className="text-[9px] text-rose-400 mt-0.5">{syncStatus.pendingCount} change(s) pending</p>
            )}
          </div>
          <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse flex-shrink-0 mt-1"></span>
        </div>
      )}
      {keys.map(key => (
        <div
          key={key}
          className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg px-3 py-2 flex items-start gap-2 animate-slide-up"
        >
          <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-amber-800 truncate">{key}</p>
            <p className="text-[10px] text-amber-600 truncate">{warnings[key].message}</p>
            <p className="text-[9px] text-amber-400 mt-0.5">Using fallback data. Auto-dismisses in 30s.</p>
          </div>
          <button
            onClick={() => clearApiWarning(key)}
            className="text-amber-400 hover:text-amber-600 text-xs font-bold flex-shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
