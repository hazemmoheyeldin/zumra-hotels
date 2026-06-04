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
  const sizeMap: Record<string, { h: number; printH: number }> = {
    sm:  { h: 40,  printH: 56 },
    md:  { h: 56,  printH: 72 },
    lg:  { h: 72,  printH: 90 },
    xl:  { h: 96,  printH: 120 },
    xxl: { h: 140, printH: 160 },
  };

  const { h } = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src={logoUrl}
        alt="Zumra Hotels - زمرة للفنادق"
        className="object-contain w-auto"
        style={{ height: `${h}px` }}
      />
    </div>
  );
}
