/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MasterPDFHeader — Single source-of-truth header for ALL PDF documents.
 * Every PDF in the system must import and use this component instead of
 * manually coding the header. This guarantees identical layout, sizing,
 * alignment and branding across all reports.
 *
 * Layout (mirrors header.png exactly):
 *   LEFT  → "ZUMRA HOTELS" (bold black) + "زمرة للفنادق" (Arabic)
 *   RIGHT → High-resolution logo asset (icon + Arabic + English in gold)
 *   Below → Golden separator line (#C1A168)
 *
 * Fixed height prevents any shrinking, stretching or repositioning
 * regardless of report content length or page count.
 */

import React from 'react';
import logoUrl from '../assets/zumra-logo-opt.png';

interface MasterPDFHeaderProps {
  /** Optional content rendered below the header bar, right-aligned (e.g. document title badge) */
  rightSlot?: React.ReactNode;
  /** Optional content rendered below the header bar, left-aligned */
  leftSlot?: React.ReactNode;
}

export default function MasterPDFHeader({ rightSlot, leftSlot }: MasterPDFHeaderProps) {
  return (
    <div className="master-pdf-header mb-3">
      {/* ── Main header bar: LEFT text + RIGHT logo ── */}
      <div
        className="flex items-center justify-between"
        style={{ height: '100px', minHeight: '100px', maxHeight: '100px' }}
      >
        {/* Left-aligned company text block */}
        <div className="flex flex-col justify-center flex-1 min-w-0">
          <span
            className="font-extrabold tracking-tight text-slate-900 leading-none font-sans"
            style={{ fontSize: '26px' }}
          >
            ZUMRA HOTELS
          </span>
          <span
            className="font-bold text-slate-800 tracking-wider font-serif mt-1.5"
            dir="rtl"
            style={{ fontSize: '20px' }}
          >
            زمرة للفنادق
          </span>
        </div>

        {/* Right-aligned high-resolution logo */}
        <div className="flex-shrink-0 flex items-center justify-end" style={{ height: '100px' }}>
          <img
            src={logoUrl}
            alt="Zumra Hotels - زمرة للفنادق"
            style={{
              height: '92px',
              width: 'auto',
              objectFit: 'contain',
              imageRendering: 'auto',
            }}
          />
        </div>
      </div>

      {/* ── Golden separator line ── */}
      <div
        className="w-full"
        style={{
          borderTop: '4px solid #C1A168',
          marginTop: '4px',
          marginBottom: '6px',
        }}
      />

      {/* ── Optional slot area for report-specific title/badge below separator ── */}
      {(leftSlot || rightSlot) && (
        <div className="flex items-center justify-between mb-2">
          <div>{leftSlot}</div>
          <div>{rightSlot}</div>
        </div>
      )}
    </div>
  );
}
