/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import logoUrl from '../assets/zumra-logo.png';

interface ZumraLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  variant?: 'light' | 'dark' | 'gold';
}

export default function ZumraLogo({ className = '', size = 'md', variant = 'gold' }: ZumraLogoProps) {
  // Size mapping: height in pixels for each variant
  // New logo is wide (icon + text), so heights are tuned for prominence
  const sizeMap: Record<string, { h: number; printH: number }> = {
    sm:  { h: 44,  printH: 56 },
    md:  { h: 56,  printH: 72 },
    lg:  { h: 80,  printH: 100 },
    xl:  { h: 120, printH: 140 },
    xxl: { h: 220, printH: 260 },
  };

  const { h } = sizeMap[size] || sizeMap.md;

  // For dark backgrounds, add a subtle glow/brightness boost
  const filterStyle = variant === 'light'
    ? 'brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.2))'
    : variant === 'dark'
    ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
    : 'drop-shadow(0 2px 12px rgba(193,162,116,0.3))';

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src={logoUrl}
        alt="Zumra Hotels - زمرة للفنادق"
        className="object-contain w-auto"
        style={{ height: `${h}px`, filter: filterStyle }}
      />
    </div>
  );
}
