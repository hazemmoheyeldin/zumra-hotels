/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MasterPDFHeader — Pre-rendered image header for ALL PDF documents.
 * Uses a single fixed header.png asset placed at the top of every PDF.
 * No CSS styling, no font rendering, no alignment shifts.
 * The image is displayed at full print-area width with its natural aspect ratio.
 */

import React from 'react';
import headerUrl from '../assets/header.png';

interface MasterPDFHeaderProps {
  /** Optional content rendered below the header bar, right-aligned */
  rightSlot?: React.ReactNode;
  /** Optional content rendered below the header bar, left-aligned */
  leftSlot?: React.ReactNode;
}

export default function MasterPDFHeader({ rightSlot, leftSlot }: MasterPDFHeaderProps) {
  return (
    <div className="master-pdf-header mb-3">
      {/* Pre-rendered header image — fixed asset, no CSS styling, no compression */}
      <img
        src={headerUrl}
        alt="Zumra Hotels Header"
        data-no-compress="true"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          imageRendering: 'auto',
        }}
      />

      {/* Optional slot area for report-specific title/badge below header */}
      {(leftSlot || rightSlot) && (
        <div className="flex items-center justify-between mb-2 mt-2">
          <div>{leftSlot}</div>
          <div>{rightSlot}</div>
        </div>
      )}
    </div>
  );
}
