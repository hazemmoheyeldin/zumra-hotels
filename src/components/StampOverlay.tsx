/**
 * StampOverlay - Reusable company stamp image overlay for PDFs
 * Renders a semi-transparent stamp image positioned over the document.
 */

import React from 'react';
import { StampPosition } from '../types';
import stampImg from '../assets/stamp.png';

interface StampOverlayProps {
  visible: boolean;
  position: StampPosition;
  opacity?: number;
}

const positionClasses: Record<StampPosition, string> = {
  'bottom-right': 'bottom-8 right-8',
  'bottom-left': 'bottom-8 left-8',
  'bottom-center': 'bottom-8 left-1/2 -translate-x-1/2',
  'top-right': 'top-20 right-8',
};

export default function StampOverlay({ visible, position, opacity = 0.18 }: StampOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={`absolute ${positionClasses[position]} pointer-events-none z-10 print:z-10`}
      style={{ opacity }}
    >
      <img
        src={stampImg}
        alt="Company Stamp"
        className="w-40 h-40 object-contain select-none"
        draggable={false}
      />
    </div>
  );
}

/** Load/save stamp settings from localStorage */
export function getStampSettings() {
  try {
    const raw = localStorage.getItem('zumra_stamp_settings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: true, position: 'bottom-right', opacity: 0.18 };
}

export function saveStampSettings(settings: { enabled: boolean; position: StampPosition; opacity: number }) {
  localStorage.setItem('zumra_stamp_settings', JSON.stringify(settings));
}
