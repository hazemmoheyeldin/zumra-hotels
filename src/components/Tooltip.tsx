/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Accessible tooltip with hover delay, responsive behavior, and screen-reader support.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface TooltipProps {
  /** Tooltip text content */
  label: string;
  /** Position relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in ms before showing (default 600) */
  delay?: number;
  /** Children (trigger element) */
  children: React.ReactNode;
  /** Optional className for wrapper */
  className?: string;
  /** Disable tooltip (e.g. on mobile) */
  disabled?: boolean;
}

export default function Tooltip({
  label,
  position = 'top',
  delay = 600,
  children,
  className = '',
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 9)}`);

  const show = useCallback(() => {
    if (disabled) return;
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay, disabled]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Position classes
  const posClasses: Record<string, string> = {
    top: 'tooltip-pos-top',
    bottom: 'tooltip-pos-bottom',
    left: 'tooltip-pos-left',
    right: 'tooltip-pos-right',
  };

  return (
    <span
      className={`tooltip-wrapper ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {/* Trigger — clone to attach a11y attributes */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            'aria-describedby': visible ? tooltipId.current : undefined,
          })
        : children}

      {/* Tooltip bubble */}
      {visible && (
        <span
          id={tooltipId.current}
          role="tooltip"
          className={`tooltip-bubble ${posClasses[position] || posClasses.top}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
