/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction, compact }: EmptyStateProps) {
  if (compact) {
    return (
      <div className="py-8 text-center">
        <div className="text-3xl mb-2 opacity-40">{icon}</div>
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        {description && <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>}
      </div>
    );
  }

  return (
    <div className="py-16 text-center">
      <div className="text-5xl mb-4 opacity-30">{icon}</div>
      <h3 className="text-sm font-bold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-400 mb-4">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
