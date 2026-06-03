/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ZumraLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  variant?: 'light' | 'dark' | 'gold';
}

export default function ZumraLogo({ className = '', size = 'md', variant = 'gold' }: ZumraLogoProps) {
  // Size mapping: height in pixels for each variant
  const sizeMap: Record<string, { h: number; printH: number }> = {
    sm:  { h: 40,  printH: 48 },
    md:  { h: 56,  printH: 64 },
    lg:  { h: 72,  printH: 80 },
    xl:  { h: 96,  printH: 104 },
    xxl: { h: 120, printH: 140 },
  };

  const { h, printH } = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/zumra-logo.png"
        alt="Zumra Hotels - زمرة للفنادق"
        className="object-contain w-auto"
        style={{ height: `${h}px` }}
        /* Print-safe inline height override */
        // @ts-ignore CSS custom property for print media
        data-print-height={`${printH}px`}
      />
    </div>
  );
}
