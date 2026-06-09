/**
 * StampOverlay - Reusable company stamp image overlay for PDFs.
 * Uses PIXEL-BASED positioning within the full scrollable area (not percentages).
 * This ensures the stamp can be dragged ANYWHERE on the entire page, including
 * below the fold in scrollable containers.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StampPosition, StampPositionPreset, StampPositionCustom } from '../types';
import stampImg from '../assets/stamp-opt.png';

interface StampOverlayProps {
  visible: boolean;
  position: StampPosition;
  opacity?: number;
  onPositionChange?: (pos: StampPosition) => void;
  /** The id of the parent print-area container for drag bounds */
  containerId?: string;
}

function isCustom(pos: StampPosition): pos is StampPositionCustom {
  return typeof pos === 'object' && pos !== null && 'x' in pos && 'y' in pos;
}

export default function StampOverlay({
  visible,
  position,
  opacity = 0.85,
  onPositionChange,
  containerId = 'print-area',
}: StampOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pixelPos, setPixelPos] = useState<{ x: number; y: number } | null>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Convert a StampPosition to pixel coords within the container
  const posToPixels = useCallback((): { x: number; y: number } => {
    const container = document.getElementById(containerId);
    if (!container) return { x: 0, y: 0 };
    const w = container.scrollWidth;
    const h = container.scrollHeight;

    if (isCustom(position)) {
      // Custom positions are stored as percentages — convert to pixels
      return {
        x: (position.x / 100) * w,
        y: (position.y / 100) * h,
      };
    }

    // Convert presets to pixel positions
    switch (position) {
      case 'bottom-right': return { x: w - 180, y: h - 180 };
      case 'bottom-left': return { x: 20, y: h - 180 };
      case 'bottom-center': return { x: w / 2 - 80, y: h - 180 };
      case 'top-right': return { x: w - 180, y: 80 };
      default: return { x: w - 180, y: h - 180 };
    }
  }, [position, containerId]);

  // Clear pixel override when position prop changes externally
  useEffect(() => {
    setPixelPos(null);
  }, [position]);

  // Get the current pixel position
  const currentPos = pixelPos || posToPixels();

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const container = document.getElementById(containerId);
    if (!container || !stampRef.current) return;
    // Store the scroll offset at drag start so we can compensate during move
    const scrollTop = container.scrollTop;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentPos.x,
      origY: currentPos.y - scrollTop, // Adjust for current scroll position
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [containerId, currentPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    e.preventDefault();
    const container = document.getElementById(containerId);
    if (!container) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    // Add current scroll offset so stamp position is in scrollable-area coords
    const scrollTop = container.scrollTop;
    const newX = dragStartRef.current.origX + dx;
    const newY = dragStartRef.current.origY + dy + scrollTop;
    // Clamp to container bounds
    const clampedX = Math.max(0, Math.min(container.scrollWidth - 40, newX));
    const clampedY = Math.max(0, Math.min(container.scrollHeight - 40, newY));
    setPixelPos({ x: clampedX, y: clampedY });
  }, [isDragging, containerId]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setIsDragging(false);
    if (pixelPos && onPositionChange) {
      // Convert pixel position back to percentages for storage
      const container = document.getElementById(containerId);
      if (container) {
        const pctX = (pixelPos.x / container.scrollWidth) * 100;
        const pctY = (pixelPos.y / container.scrollHeight) * 100;
        onPositionChange({ x: pctX, y: pctY });
      }
    }
    setPixelPos(null);
    dragStartRef.current = null;
  }, [isDragging, pixelPos, onPositionChange, containerId]);

  if (!visible) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${currentPos.x}px`,
    top: `${currentPos.y}px`,
    opacity,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: 9999,
    touchAction: 'none',
    userSelect: 'none',
    transition: isDragging ? 'none' : 'left 0.15s ease, top 0.15s ease',
  };

  return (
    <div
      ref={stampRef}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="pointer-events-auto print:pointer-events-none"
      title="Drag to reposition stamp"
    >
      <img
        src={stampImg}
        alt="Company Stamp"
        className="w-40 h-40 object-contain select-none"
        draggable={false}
      />
      {/* Visual drag hint - screen only */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-amber-600 font-bold whitespace-nowrap no-print bg-amber-50 px-1.5 py-0.5 rounded shadow-sm border border-amber-200">
        ✋ drag to move
      </div>
    </div>
  );
}

/** Load stamp settings from localStorage */
export function getStampSettings(): { enabled: boolean; position: StampPosition; opacity: number } {
  try {
    const raw = localStorage.getItem('zumra_stamp_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? false,
        position: parsed.position ?? 'bottom-right',
        opacity: parsed.opacity ?? 0.85,
      };
    }
  } catch {}
  return { enabled: false, position: 'bottom-right', opacity: 0.85 };
}

export function saveStampSettings(settings: { enabled: boolean; position: StampPosition; opacity: number }) {
  localStorage.setItem('zumra_stamp_settings', JSON.stringify(settings));
}
