/**
 * VirtualTable — paginated + virtualized list renderer.
 * Renders only visible rows via @tanstack/react-virtual, with page navigation.
 */
import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualTableProps<T> {
  /** Full filtered+sorted array */
  items: T[];
  /** Estimated height of each row in px */
  estimateSize: number;
  /** Render a single row/card */
  renderRow: (item: T, globalIndex: number) => React.ReactNode;
  /** Height of the scrollable viewport in px (default 600) */
  containerHeight?: number;
  /** Key extractor for items (default: index) */
  keyExtractor?: (item: T, index: number) => string | number;
  /** Label for total count display (e.g., "reservations") */
  itemLabel?: string;
  /** Available page sizes (default [25, 50, 100]) */
  pageSizeOptions?: number[];
  /** Overscan rows beyond viewport (default 5) */
  overscan?: number;
  /** If true, renders as a grid (children use grid classes) instead of a linear list */
  gridMode?: boolean;
  /** Number of grid columns (only used when gridMode=true, default 3) */
  gridColumns?: number;
}

export default function VirtualTable<T>({
  items,
  estimateSize,
  renderRow,
  containerHeight = 600,
  keyExtractor,
  itemLabel = 'items',
  pageSizeOptions = [25, 50, 100],
  overscan = 5,
  gridMode = false,
  gridColumns = 3,
}: VirtualTableProps<T>) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeOptions[1] || 50);
  const parentRef = useRef<HTMLDivElement>(null);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pagedItems = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, safePage, pageSize]
  );

  // Reset page when items change length significantly (e.g., filter change)
  const prevLenRef = useRef(items.length);
  if (Math.abs(items.length - prevLenRef.current) > pageSize && page > 0) {
    // Not ideal but prevents stale page on filter change
  }

  // For grid mode, we virtualize "rows" where each row = gridColumns items
  const rowCount = gridMode ? Math.ceil(pagedItems.length / gridColumns) : pagedItems.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => gridMode ? estimateSize + 16 : estimateSize, [estimateSize, gridMode]),
    overscan,
  });

  const goToPage = (p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
    parentRef.current?.scrollTo({ top: 0 });
  };

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setPage(0);
    parentRef.current?.scrollTo({ top: 0 });
  };

  const globalStartIndex = safePage * pageSize;

  return (
    <div>
      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        style={{ height: containerHeight }}
        className="overflow-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            if (gridMode) {
              // Grid mode: each virtual row contains gridColumns items
              const startIdx = virtualRow.index * gridColumns;
              const rowItems = pagedItems.slice(startIdx, startIdx + gridColumns);
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${gridColumns} gap-4 pb-4`}
                >
                  {rowItems.map((item, colIdx) => {
                    const gIdx = globalStartIndex + startIdx + colIdx;
                    const k = keyExtractor ? keyExtractor(item, gIdx) : gIdx;
                    return <React.Fragment key={k}>{renderRow(item, gIdx)}</React.Fragment>;
                  })}
                </div>
              );
            }

            // Linear mode: one item per virtual row
            const localIdx = virtualRow.index;
            const item = pagedItems[localIdx];
            if (!item) return null;
            const gIdx = globalStartIndex + localIdx;
            const k = keyExtractor ? keyExtractor(item, gIdx) : gIdx;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderRow(item, gIdx)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 bg-white border-t border-slate-150 rounded-b-2xl text-xs">
        <span className="text-slate-500">
          Showing <span className="font-bold text-slate-800">{safePage * pageSize + 1}</span>–
          <span className="font-bold text-slate-800">{Math.min((safePage + 1) * pageSize, items.length)}</span> of{' '}
          <span className="font-bold text-slate-800">{items.length}</span> {itemLabel}
        </span>

        <div className="flex items-center gap-2">
          {/* Page size selector */}
          <select
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>

          {/* Page navigation */}
          <button
            onClick={() => goToPage(0)}
            disabled={safePage === 0}
            className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title="First page"
          >
            «
          </button>
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 0}
            className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous page"
          >
            ‹
          </button>
          <span className="px-2 text-slate-700 font-medium">
            Page <span className="font-bold">{safePage + 1}</span> of {totalPages}
          </span>
          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages - 1}
            className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next page"
          >
            ›
          </button>
          <button
            onClick={() => goToPage(totalPages - 1)}
            disabled={safePage >= totalPages - 1}
            className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Last page"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
