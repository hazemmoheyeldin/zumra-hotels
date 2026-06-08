/**
 * StampOverlay - Reusable company stamp image overlay for PDFs.
 * Supports free drag-and-drop positioning in addition to preset positions.
 * The stamp can be dragged directly on the preview to place it anywhere.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StampPosition, StampPositionPreset, StampPositionCustom } from '../types';
import stampImg from '../assets/stamp.png';

interface StampOverlayProps {
  visible: boolean;
  position: StampPosition;
  opacity?: number;
  onPositionChange?: (pos: StampPosition) => void;
  /** The id of the parent print-area container for drag bounds */
  containerId?: string;
}

const presetClasses: Record<StampPositionPreset, string> = {
  'bottom-right': 'bottom-8 right-8',
  'bottom-left': 'bottom-8 left-8',
  'bottom-center': 'bottom-8 left-1/2 -translate-x-1/2',
  'top-right': 'top-20 right-8',
};

function isPreset(pos: StampPosition): pos is StampPositionPreset {
  return typeof pos === 'string';
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
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Get the current position as percentages
  const getPercentPos = (): { x: number; y: number } => {
    if (isCustom(position)) return position;
    // Convert presets to approximate percentages
    switch (position) {
      case 'bottom-right': return { x: 85, y: 85 };
      case 'bottom-left': return { x: 5, y: 85 };
      case 'bottom-center': return { x: 50, y: 85 };
      case 'top-right': return { x: 85, y: 10 };
      default: return { x: 85, y: 85 };
    }
  };

  const currentPos = dragPos || getPercentPos();

  // Mouse/touch handlers for dragging
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const container = document.getElementById(containerId);
    if (!container || !stampRef.current) return;
    const rect = container.getBoundingClientRect();
    const stampRect = stampRef.current.getBoundingClientRect();
    // Account for scroll offset so stamp can be placed anywhere in scrollable area
    const scrollTop = container.scrollTop;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: ((stampRect.left - rect.left) / rect.width) * 100,
      origY: ((stampRect.top - rect.top + scrollTop) / container.scrollHeight) * 100,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [containerId]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    e.preventDefault();
    const container = document.getElementById(containerId);
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const newX = dragStartRef.current.origX + (dx / rect.width) * 100;
    // Use scrollHeight for Y so percentage maps to full scrollable area
    const newY = dragStartRef.current.origY + (dy / container.scrollHeight) * 100;
    // Clamp to container bounds (0-95% to keep stamp visible)
    const clampedX = Math.max(0, Math.min(95, newX));
    const clampedY = Math.max(0, Math.min(95, newY));
    setDragPos({ x: clampedX, y: clampedY });
  }, [isDragging, containerId]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setIsDragging(false);
    if (dragPos && onPositionChange) {
      onPositionChange({ x: dragPos.x, y: dragPos.y });
    }
    dragStartRef.current = null;
  }, [isDragging, dragPos, onPositionChange]);

  if (!visible) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${currentPos.x}%`,
    top: `${currentPos.y}%`,
    opacity,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: 20,
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
