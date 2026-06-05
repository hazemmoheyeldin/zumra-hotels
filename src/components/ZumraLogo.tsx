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
    sm:  { h: 48,  printH: 64 },
    md:  { h: 64,  printH: 80 },
    lg:  { h: 80,  printH: 100 },
    xl:  { h: 150, printH: 150 },
    xxl: { h: 200, printH: 220 },
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
