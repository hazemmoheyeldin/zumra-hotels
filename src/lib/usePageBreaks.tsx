/**
 * Hook for managing user-controlled page breaks in PDF preview.
 * Users can click between rows to insert page break markers.
 */
import { useState, useCallback } from 'react';

export function usePageBreaks() {
  const [pbEnabled, setPbEnabled] = useState(false);
  const [breakPoints, setBreakPoints] = useState<Set<number>>(new Set());

  const toggleMode = useCallback(() => {
    setPbEnabled(prev => {
      if (prev) setBreakPoints(new Set());
      return !prev;
    });
  }, []);

  const toggleBreak = useCallback((idx: number) => {
    setBreakPoints(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const renderInsertZone = (idx: number) => {
    if (!pbEnabled) return null;
    return (
      <tr key={`pb-zone-${idx}`} className="pb-insert-zone-row">
        <td colSpan={99} style={{ padding: 0, border: 'none', lineHeight: 0 }}>
          <div
            className="pb-insert-zone"
            onClick={(e) => { e.stopPropagation(); toggleBreak(idx); }}
            title="Click to insert page break here"
          />
          {breakPoints.has(idx) && (
            <div className="page-break-marker-screen" onClick={() => toggleBreak(idx)} title="Click to remove page break">
              <div className="pb-line" />
              <span className="pb-label">✂ PAGE BREAK (click to remove)</span>
              <div className="pb-line" />
            </div>
          )}
        </td>
      </tr>
    );
  };

  const renderDivInsertZone = (idx: number) => {
    if (!pbEnabled) return null;
    return (
      <div key={`pb-divzone-${idx}`}>
        <div
          className="pb-insert-zone"
          onClick={(e) => { e.stopPropagation(); toggleBreak(idx); }}
          title="Click to insert page break here"
        />
        {breakPoints.has(idx) && (
          <div className="page-break-marker-screen" onClick={() => toggleBreak(idx)} title="Click to remove page break">
            <div className="pb-line" />
            <span className="pb-label">✂ PAGE BREAK (click to remove)</span>
            <div className="pb-line" />
          </div>
        )}
      </div>
    );
  };

  const PageBreakToggle = () => (
    <button
      onClick={toggleMode}
      className={`pb-toggle-btn font-semibold px-3 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer text-xs border ${
        pbEnabled
          ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
      }`}
      title={pbEnabled ? 'Exit page break mode' : 'Control page breaks'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v18" /><path d="M18 3v18" /><path d="M3 12h18" />
        <path d="M3 6h3" /><path d="M3 18h3" /><path d="M18 6h3" /><path d="M18 18h3" />
      </svg>
      {pbEnabled ? 'Exit Page Breaks' : 'Page Breaks'}
    </button>
  );

  return { pbEnabled, breakPoints, toggleMode, toggleBreak, renderInsertZone, renderDivInsertZone, PageBreakToggle };
}
