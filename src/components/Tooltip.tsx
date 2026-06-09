/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Pure CSS tooltip — zero React state, zero hooks overhead.
 * Uses CSS :hover + transition-delay for show/hide with built-in delay.
 */

import React from 'react';

interface TooltipProps {
  label: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function Tooltip({
  label,
  position = 'top',
  children,
  className = '',
  disabled = false,
}: TooltipProps) {
  if (disabled) return <>{children}</>;

  return (
    <span className={`tt-wrap ${className}`} data-tip={label} data-pos={position}>
      {children}
    </span>
  );
}
