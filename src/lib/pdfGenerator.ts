/**
 * Print/PDF generator with two approaches:
 *
 * 1. exportPDF() — Screenshot-based PDF using html-to-image + jsPDF (RECOMMENDED).
 *    Uses SVG foreignObject so the browser renders text natively — Arabic ligatures,
 *    RTL text, oklch colors, and all CSS are preserved perfectly.
 *    Captures the print-area element exactly as it appears on screen, splits
 *    into A4 pages, and saves directly. Works on mobile and desktop.
 *
 * 2. downloadPDF() — Legacy browser print dialog approach (kept as fallback).
 *
 * Image Optimization:
 * - compressImagesForPrint() pre-compresses images in the print area to JPEG
 *   at optimized quality, reducing PDF file size by ~80-90%.
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

interface PDFOptions {
  landscape?: boolean;
  renderWidth?: number;
}

// Fixed render width ensures Tailwind `md:` breakpoints always activate,
// so PDFs always look like the desktop layout (no stacked mobile columns).
const PDF_RENDER_WIDTH = 900;
const PDF_LANDSCAPE_WIDTH = 1100;

// Guard flag to prevent double-triggering and "blocked from printing" errors
let isPrinting = false;
let printCleanupTimer: ReturnType<typeof setTimeout> | null = null;

// Compression cache: maps original src to compressed data URL
const compressionCache = new Map<string, string>();

/**
 * Pre-compresses all images inside the given container element for PDF output.
 * Converts PNG/large images to optimized JPEG at controlled quality.
 * Stores compressed data URL on each img element as `data-compressed-src`.
 * Call this on component mount so images are ready before synchronous print.
 *
 * @param containerId - The ID of the print-area container
 * @param maxWidth - Max pixel width for compressed images (default 800)
 * @param quality - JPEG quality 0-1 (default 0.82 for good balance)
 */
export const compressImagesForPrint = async (
  containerId: string,
  maxWidth: number = 600,
  quality: number = 0.72
): Promise<void> => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const images = container.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
  const promises = Array.from(images).map(async (img) => {
    const src = img.src;
    if (!src || src.startsWith('data:image/jpeg')) return; // already compressed or empty

    // Check cache
    if (compressionCache.has(src)) {
      img.setAttribute('data-compressed-src', compressionCache.get(src)!);
      return;
    }

    try {
      // Load image
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = src;
      });

      // Calculate scaled dimensions
      const scale = Math.min(1, maxWidth / image.width);
      const w = Math.round(image.width * scale);
      const h = Math.round(image.height * scale);

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White background for JPEG (no transparency)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(image, 0, 0, w, h);

      // Export as optimized JPEG
      const compressedUrl = canvas.toDataURL('image/jpeg', quality);
      compressionCache.set(src, compressedUrl);
      img.setAttribute('data-compressed-src', compressedUrl);
    } catch (e) {
      // Silently skip images that can't be compressed (CORS, etc.)
    }
  });

  await Promise.all(promises);
};

/**
 * Triggers the browser print dialog to generate a PDF.
 * MUST be called synchronously from a user gesture (onClick) to work on iOS Safari.
 * Returns true if print was triggered successfully, false on error.
 */
export const downloadPDF = (elementId: string, filename: string, options?: PDFOptions): boolean => {
  // Prevent re-entrant calls (causes "blocked from automatically printing")
  if (isPrinting) return false;
  isPrinting = true;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[downloadPDF] Element with id "${elementId}" not found.`);
    alert('Print area not found. Please try again.');
    isPrinting = false;
    return false;
  }

  const landscape = options?.landscape || false;
  const renderWidth = options?.renderWidth || (landscape ? PDF_LANDSCAPE_WIDTH : PDF_RENDER_WIDTH);

  // Clone the print area and attach directly to body for clean printing
  const clone = element.cloneNode(true) as HTMLElement;
  clone.id = 'print-area-clone';

  // Strip scroll-related and Tailwind print: classes from the clone.
  // Tailwind v4 print: classes use !important which would override our inline
  // styles during @media print, causing the PDF to look different from the
  // on-screen preview. We want the clone to render EXACTLY as shown on screen.
  const scrollPrintClasses = [
    'max-h-\\[75vh\\]', 'max-h-\\[80vh\\]', 'max-h-\\[85vh\\]',
    'overflow-y-auto', 'overflow-x-auto', 'overflow-auto', 'overflow-hidden',
    'print\\:p-0', 'print\\:border-none', 'print\\:shadow-none',
    'print\\:max-h-full', 'print\\:overflow-visible', 'print\\:rounded-none',
  ];
  // Remove classes from the clone element itself
  scrollPrintClasses.forEach(cls => {
    clone.classList.remove(cls.replace(/\\\\/g, '\\'));
  });
  // Also use a broader approach: remove any class starting with "print:" or containing "max-h-["
  const cloneClasses = Array.from(clone.classList);
  cloneClasses.forEach(cls => {
    if (cls.startsWith('print:') || cls.includes('max-h-[') ||
        cls === 'overflow-y-auto' || cls === 'overflow-x-auto' ||
        cls === 'overflow-auto' || cls === 'overflow-hidden' ||
        cls === 'shadow-inner') {
      clone.classList.remove(cls);
    }
  });

  // Strip overflow-related classes from ALL descendant elements to prevent
  // table content truncation in multi-page PDF output (e.g. Arrival Report).
  const overflowClasses = ['overflow-hidden', 'overflow-x-auto', 'overflow-y-auto', 'overflow-auto', 'overflow-scroll'];
  clone.querySelectorAll('*').forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    const elClasses = Array.from(el.classList);
    let hadOverflow = false;
    elClasses.forEach(cls => {
      if (overflowClasses.includes(cls) || cls.startsWith('print:') || cls.includes('max-h-[')) {
        el.classList.remove(cls);
        if (overflowClasses.includes(cls)) hadOverflow = true;
      }
    });
    if (hadOverflow) {
      el.style.overflow = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
    }
  });

  // Swap images to pre-compressed versions for smaller PDF file size
  // compressImagesForPrint() stores JPEG data URLs as data-compressed-src
  clone.querySelectorAll('img').forEach(img => {
    const compressed = img.getAttribute('data-compressed-src');
    if (compressed) {
      img.src = compressed;
      img.removeAttribute('data-compressed-src');
    }
  });

  // Convert screen page break markers to print page break markers
  const screenMarkers = clone.querySelectorAll('.page-break-marker-screen');
  screenMarkers.forEach(marker => {
    marker.classList.remove('page-break-marker-screen');
    marker.classList.add('page-break-marker');
    marker.innerHTML = '';
  });

  // Remove insert zones and toggle buttons from clone
  clone.querySelectorAll('.pb-insert-zone').forEach(el => el.remove());
  clone.querySelectorAll('.pb-insert-zone-row').forEach(el => el.remove());
  clone.querySelectorAll('.pb-toggle-btn').forEach(el => el.remove());

  // Remove any anchor <a> links from the clone so they don't appear in PDF
  clone.querySelectorAll('a[href]').forEach(anchor => {
    const span = document.createElement('span');
    span.innerHTML = anchor.innerHTML;
    Array.from(anchor.attributes).forEach(attr => {
      if (attr.name !== 'href') span.setAttribute(attr.name, attr.value);
    });
    anchor.parentNode?.replaceChild(span, anchor);
  });

  // FIXED-WIDTH CLONE: Force desktop layout at renderWidth regardless of device.
  // This prevents responsive Tailwind classes (sm:, md:, lg:) from collapsing
  // into their mobile/stacked form on phones and tablets.
  // Uses !important to override any Tailwind print: classes that survived stripping.
  clone.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    width: ${renderWidth}px !important;
    max-width: ${renderWidth}px !important;
    min-width: ${renderWidth}px !important;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    padding: 24px !important;
    margin: 0 !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 8px !important;
    box-shadow: none !important;
    background: white !important;
    z-index: 999999 !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    font-family: inherit !important;
    color: #1e293b !important;
    box-sizing: border-box !important;
  `;

  // Calculate zoom to center the fixed-width clone on the A4 page.
  // A4 width at 96dpi: portrait ≈ 794px, landscape ≈ 1123px
  // With 10mm margins: usable ≈ 718px (portrait) / 1047px (landscape)
  const A4_PX = landscape ? 1123 : 794;
  const MARGIN_PX = 38; // 10mm ≈ 38px at 96dpi
  const usablePx = A4_PX - (MARGIN_PX * 2);
  const baseZoom = Math.min(1, usablePx / renderWidth);

  // Inject dynamic @page style for landscape/portrait
  const pageStyleId = 'dynamic-page-style';
  let pageStyle = document.getElementById(pageStyleId) as HTMLStyleElement | null;
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = pageStyleId;
    document.head.appendChild(pageStyle);
  }
  const pageSize = landscape ? 'A4 landscape' : 'A4 portrait';
  pageStyle.textContent = `
    @media print {
      @page {
        size: ${pageSize};
        margin: 10mm;
      }
      html {
        overflow: visible !important;
      }
      body {
        overflow: visible !important;
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      /* Scale the fixed-width clone to fit the printed page */
      body.printing-report {
        zoom: ${baseZoom};
        overflow: visible !important;
      }
      /* Hide ALL content except the cloned print area */
      body.printing-report > *:not(#print-area-clone) {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      /* Show only the clone at fixed desktop width with full design fidelity */
      body.printing-report #print-area-clone {
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: ${renderWidth}px !important;
        max-width: ${renderWidth}px !important;
        min-width: ${renderWidth}px !important;
        max-height: none !important;
        height: auto !important;
        padding: 24px !important;
        margin: 0 !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        box-shadow: none !important;
        background: white !important;
        z-index: 999999 !important;
        overflow: visible !important;
      }
      /* Allow table rows to avoid page breaks inside themselves */
      body.printing-report #print-area-clone tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      /* Keep summary/total rows with the preceding data row */
      body.printing-report #print-area-clone .keep-with-prev {
        break-before: avoid !important;
        page-break-before: avoid !important;
      }
      /* Prevent page breaks inside the metadata grid or balance banner */
      body.printing-report #print-area-clone .no-page-break {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      /* Strip any visible URLs/links from PDF output */
      a[href] {
        text-decoration: none !important;
        color: inherit !important;
        pointer-events: none !important;
      }
      a[href]::after {
        content: none !important;
        display: none !important;
      }
    }
  `;

  // Set document title to filename so browser uses it as PDF default name
  const originalTitle = document.title;
  const cleanName = filename.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9\s\-_()]/g, '').trim();
  document.title = cleanName || originalTitle;

  const cleanup = () => {
    if (printCleanupTimer) { clearTimeout(printCleanupTimer); printCleanupTimer = null; }
    document.body.classList.remove('printing-report');
    const cloneEl = document.getElementById('print-area-clone');
    if (cloneEl) cloneEl.remove();
    document.title = originalTitle;
    const ps = document.getElementById(pageStyleId);
    if (ps) ps.remove();
    setTimeout(() => { isPrinting = false; }, 500);
  };

  // Set up cleanup listeners BEFORE printing
  const onAfterPrint = () => {
    cleanup();
    window.removeEventListener('afterprint', onAfterPrint);
  };
  window.addEventListener('afterprint', onAfterPrint);

  const onFocusReturn = () => {
    setTimeout(() => {
      if (document.getElementById('print-area-clone')) cleanup();
    }, 500);
    window.removeEventListener('focus', onFocusReturn);
  };
  window.addEventListener('focus', onFocusReturn);

  // Append clone and trigger print SYNCHRONOUSLY.
  // This is critical for iOS Safari which blocks window.print() if called
  // asynchronously (after any setTimeout/Promise microtask).
  // Images visible on screen are already cached by the browser.
  document.body.appendChild(clone);
  document.body.classList.add('printing-report');

  try {
    window.print();
  } catch (e) {
    console.warn('Print failed:', e);
    cleanup();
    return false;
  }

  // Safety fallback cleanup in case afterprint doesn't fire.
  // iOS Safari can take longer for the print dialog to appear and dismiss.
  printCleanupTimer = setTimeout(() => {
    if (document.getElementById('print-area-clone')) {
      cleanup();
      isPrinting = false;
    }
  }, 15000);

  return true;
};

/**
 * Detects if the current device is a mobile/tablet (touch-primary, small screen).
 */
const isMobileDevice = (): boolean => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 1024 && 'ontouchstart' in window)
  );
};

/**
 * Scans an element for Tailwind responsive grid/flex classes (md:*) and applies
 * inline !important styles to force the DESKTOP layout regardless of viewport width.
 * This fixes mobile PDF capture where md:grid-cols-N doesn't activate because
 * CSS media queries use device viewport width, not element width.
 *
 * Returns the list of modified elements and their original styles for cleanup.
 */
const forceDesktopLayout = (root: HTMLElement): {
  el: HTMLElement; origGridCols: string; origGap: string;
}[] => {
  const modified: { el: HTMLElement; origGridCols: string; origGap: string }[] = [];

  const allElements = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
  allElements.forEach(el => {
    const cls = el.className;
    if (typeof cls !== 'string') return;
    const tokens = cls.split(/\s+/);

    let mdCols = 0;
    let hasMdGap = false;
    tokens.forEach(token => {
      const colMatch = token.match(/^md:grid-cols-(\d+)$/);
      if (colMatch) mdCols = parseInt(colMatch[1], 10);
      if (token.startsWith('md:gap-')) hasMdGap = true;
    });

    if (mdCols > 0) {
      modified.push({
        el,
        origGridCols: el.style.getPropertyValue('grid-template-columns'),
        origGap: el.style.getPropertyValue('gap'),
      });
      el.style.setProperty('grid-template-columns', `repeat(${mdCols}, minmax(0, 1fr))`, 'important');
      if (hasMdGap) {
        el.style.setProperty('gap', '1rem', 'important');
      }
    }
  });

  return modified;
};

/** Restores inline grid styles previously set by forceDesktopLayout */
const removeDesktopLayout = (modified: { el: HTMLElement; origGridCols: string; origGap: string }[]) => {
  modified.forEach(({ el, origGridCols, origGap }) => {
    if (origGridCols) {
      el.style.setProperty('grid-template-columns', origGridCols);
    } else {
      el.style.removeProperty('grid-template-columns');
    }
    if (origGap) {
      el.style.setProperty('gap', origGap);
    } else {
      el.style.removeProperty('gap');
    }
  });
};

/**
 * Strips scroll/overflow constraints from an element AND all its descendants.
 * This prevents scrollbars from appearing in the captured PDF.
 * Returns the list of modified elements and their original styles for restoration.
 */
const stripAllScrollConstraints = (root: HTMLElement): {
  el: HTMLElement; origMaxH: string; origOvf: string; origOvfX: string; origOvfY: string;
}[] => {
  const modified: { el: HTMLElement; origMaxH: string; origOvf: string; origOvfX: string; origOvfY: string; }[] = [];
  const allElements = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
  allElements.forEach(el => {
    const cs = window.getComputedStyle(el);
    const hasScroll = (
      cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ||
      cs.maxHeight !== 'none' || el.style.overflow || el.style.overflowX || el.style.maxHeight
    );
    if (hasScroll) {
      modified.push({
        el,
        origMaxH: el.style.maxHeight,
        origOvf: el.style.overflow,
        origOvfX: el.style.overflowX,
        origOvfY: el.style.overflowY,
      });
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
    }
  });
  return modified;
};

/** Restores scroll constraints previously stripped by stripAllScrollConstraints */
const restoreScrollConstraints = (modified: {
  el: HTMLElement; origMaxH: string; origOvf: string; origOvfX: string; origOvfY: string;
}[]) => {
  modified.forEach(({ el, origMaxH, origOvf, origOvfX, origOvfY }) => {
    el.style.maxHeight = origMaxH;
    el.style.overflow = origOvf;
    el.style.overflowX = origOvfX;
    el.style.overflowY = origOvfY;
  });
};

/**
 * Generates a PDF blob from the print-area element.
 * Uses html-to-image to capture (preserves Arabic, RTL, oklch colors),
 * then jsPDF to build a multi-page A4 PDF.
 *
 * @param captureWidth - Force element to this width during capture (for mobile)
 */
const generatePDFBlob = async (
  element: HTMLElement,
  options?: PDFOptions & { jpegQuality?: number; scale?: number },
  captureWidth?: number
): Promise<Blob | null> => {
  const landscape = options?.landscape || false;
  const jpegQuality = options?.jpegQuality ?? 0.78;
  const scale = options?.scale ?? 1.5;
  const hiddenElements: { el: HTMLElement; origDisplay: string }[] = [];
  let origMaxHeight = '', origOverflow = '', origOverflowX = '';
  let origWidth = '', origMinWidth = '';
  let origHeight = '', origBoxSizing = '';
  let scrollModified: ReturnType<typeof stripAllScrollConstraints> = [];
  let desktopModified: ReturnType<typeof forceDesktopLayout> = [];

  try {
    // Hide no-print elements
    element.querySelectorAll('.no-print').forEach(el => {
      const htmlEl = el as HTMLElement;
      hiddenElements.push({ el: htmlEl, origDisplay: htmlEl.style.display });
      htmlEl.style.display = 'none';
    });

    // Remove scroll constraints from ROOT element
    origMaxHeight = element.style.maxHeight;
    origOverflow = element.style.overflow;
    origOverflowX = element.style.overflowX;
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';
    element.style.overflowX = 'visible';

    // Remove scroll constraints from ALL child elements (prevents scrollbars in PDF)
    scrollModified = stripAllScrollConstraints(element);

    // Force desktop width on mobile so content doesn't compress/overlap
    if (captureWidth) {
      origWidth = element.style.width;
      origMinWidth = element.style.minWidth;
      element.style.width = `${captureWidth}px`;
      element.style.minWidth = `${captureWidth}px`;
    }

    // Force desktop grid/flex layouts (fixes md:grid-cols-N not activating on mobile viewport)
    desktopModified = forceDesktopLayout(element);

    // CRITICAL: Force element to its full scrollable dimensions.
    // This prevents html-to-image from clipping content that was previously
    // hidden behind scrollbars (e.g., wide tables in arrival reports).
    origHeight = element.style.height;
    origBoxSizing = element.style.boxSizing;
    const fullWidth = captureWidth || Math.max(element.scrollWidth, element.offsetWidth);
    const fullHeight = element.scrollHeight;
    element.style.width = `${fullWidth}px`;
    element.style.minWidth = `${fullWidth}px`;
    element.style.height = `${fullHeight}px`;
    element.style.boxSizing = 'border-box';

    // Force reflow so all style changes are applied before capture
    void element.offsetHeight;

    // Capture as PNG (html-to-image uses SVG foreignObject — native text rendering)
    const dataUrl = await toPng(element, {
      pixelRatio: scale,
      backgroundColor: '#ffffff',
      cacheBust: false,
      width: fullWidth,
      height: fullHeight,
      filter: (node: Node) => {
        if (node instanceof HTMLElement) return !node.classList.contains('no-print');
        return true;
      },
    });

    // Restore everything
    removeDesktopLayout(desktopModified);
    element.style.maxHeight = origMaxHeight;
    element.style.overflow = origOverflow;
    element.style.overflowX = origOverflowX;
    element.style.height = origHeight;
    element.style.boxSizing = origBoxSizing;
    if (captureWidth) {
      element.style.width = origWidth;
      element.style.minWidth = origMinWidth;
    } else {
      element.style.removeProperty('width');
      element.style.removeProperty('min-width');
    }
    restoreScrollConstraints(scrollModified);
    hiddenElements.forEach(({ el, origDisplay }) => { el.style.display = origDisplay; });
    hiddenElements.length = 0;

    // Load PNG into an Image
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });

    // A4 dimensions in points
    const A4_WIDTH_PT = landscape ? 841.89 : 595.28;
    const A4_HEIGHT_PT = landscape ? 595.28 : 841.89;
    const MARGIN_PT = 20;
    const usableWidth = A4_WIDTH_PT - (MARGIN_PT * 2);
    const usableHeight = A4_HEIGHT_PT - (MARGIN_PT * 2);

    const scaleFactor = usableWidth / img.width;
    const pageHeightInImgPx = usableHeight / scaleFactor;
    const numPages = Math.max(1, Math.ceil(img.height / pageHeightInImgPx));

    // Draw image to source canvas
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.width;
    sourceCanvas.height = img.height;
    const srcCtx = sourceCanvas.getContext('2d');
    if (!srcCtx) return null;
    srcCtx.drawImage(img, 0, 0);

    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    for (let page = 0; page < numPages; page++) {
      if (page > 0) pdf.addPage();
      const srcY = Math.round(page * pageHeightInImgPx);
      const srcHeight = Math.min(Math.round(pageHeightInImgPx), img.height - srcY);
      if (srcHeight <= 0) break;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = img.width;
      pageCanvas.height = srcHeight;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(sourceCanvas, 0, srcY, img.width, srcHeight, 0, 0, img.width, srcHeight);

      const imgData = pageCanvas.toDataURL('image/jpeg', jpegQuality);
      pdf.addImage(imgData, 'JPEG', MARGIN_PT, MARGIN_PT, usableWidth, srcHeight * scaleFactor, undefined, 'FAST');
    }

    return pdf.output('blob');
  } catch (e) {
    console.error('[generatePDFBlob] Failed:', e);
    // Restore on error
    removeDesktopLayout(desktopModified);
    element.style.maxHeight = origMaxHeight;
    element.style.overflow = origOverflow;
    element.style.overflowX = origOverflowX;
    element.style.height = origHeight;
    element.style.boxSizing = origBoxSizing;
    if (captureWidth) {
      element.style.width = origWidth;
      element.style.minWidth = origMinWidth;
    } else {
      element.style.removeProperty('width');
      element.style.removeProperty('min-width');
    }
    restoreScrollConstraints(scrollModified);
    hiddenElements.forEach(({ el, origDisplay }) => { el.style.display = origDisplay; });
    return null;
  }
};

/**
 * Shows a PDF preview modal on desktop before saving.
 * Uses an iframe with the PDF blob URL so the user can review and then save.
 */
const showPDFPreview = (blob: Blob, filename: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const cleanName = filename.replace('.pdf', '');

    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); z-index: 9999999;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.2s ease;
    `;

    // Header bar
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; max-width: 900px; padding: 12px 16px;
      background: white; border-radius: 12px 12px 0 0; gap: 12px;
    `;
    header.innerHTML = `
      <span style="font-weight:700; font-size:15px; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cleanName}</span>
      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button id="pdf-preview-save" style="background:#d97706; color:white; font-weight:600; padding:8px 20px; border-radius:8px; border:none; cursor:pointer; font-size:14px;">Save PDF</button>
        <button id="pdf-preview-cancel" style="background:#f1f5f9; color:#475569; font-weight:600; padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-size:14px;">Cancel</button>
      </div>
    `;

    // Iframe for PDF preview
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = `
      width: 100%; max-width: 900px; flex: 1; min-height: 500px; max-height: 80vh;
      border: none; border-radius: 0 0 12px 12px; background: #525659;
    `;

    overlay.appendChild(header);
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.removeEventListener('keydown', onKey);
      document.body.removeChild(overlay);
      URL.revokeObjectURL(url);
    };

    // Click outside (on backdrop) to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(true);
      }
    });

    // Save button - uses File System Access API to let user choose where to save
    header.querySelector('#pdf-preview-save')!.addEventListener('click', async () => {
      cleanup();
      try {
        // Try native save dialog (choose location)
        if ('showSaveFilePicker' in window) {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'PDF Document',
              accept: { 'application/pdf': ['.pdf'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          resolve(true);
          return;
        }
      } catch (e: any) {
        // User cancelled the save dialog
        if (e?.name === 'AbortError') {
          resolve(true);
          return;
        }
      }
      // Fallback: standard download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(true);
    });

    // Cancel button
    header.querySelector('#pdf-preview-cancel')!.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    // Escape key to close
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(true);
      }
    };
    document.addEventListener('keydown', onKey);
  });
};

/**
 * Shares a PDF file using the Web Share API (opens native share sheet on mobile
 * for WhatsApp, email, etc.). Falls back to download if sharing is not supported.
 */
const sharePDF = async (blob: Blob, filename: string): Promise<boolean> => {
  const file = new File([blob], filename, { type: 'application/pdf' });

  // Check if Web Share API with files is supported
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace('.pdf', ''),
      });
      return true;
    } catch (e) {
      // User cancelled share or share failed — fall through to download
      if ((e as Error).name === 'AbortError') return true; // user cancelled = not an error
      console.warn('[sharePDF] Share failed, falling back to download:', e);
    }
  }

  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
};

/**
 * Exports the print-area element as a pixel-perfect PDF.
 *
 * Strategy (unified blob-based approach):
 * - Desktop: Generates PDF blob → shows preview modal → user saves
 * - Mobile: Generates PDF blob at desktop width → opens native share sheet (WhatsApp, email)
 * - If generation fails, auto-falls back to browser print dialog
 *
 * Fixes:
 * - Strips scroll constraints from ALL elements (no scrollbars in PDF)
 * - Forces desktop width on mobile (no compressed/overlapping content)
 * - Preserves Arabic text, RTL, oklch colors via html-to-image SVG foreignObject
 */
export const exportPDF = async (
  elementId: string,
  filename: string,
  options?: PDFOptions & { jpegQuality?: number; scale?: number }
): Promise<boolean> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[exportPDF] Element "${elementId}" not found.`);
    return false;
  }

  const cleanName = (filename.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9\s\-_()']/g, '').trim() || 'report') + '.pdf';
  const isMobile = isMobileDevice();

  // On mobile, force desktop width so content doesn't compress/overlap
  const captureWidth = isMobile ? (options?.landscape ? 1123 : 794) : undefined;

  // Generate PDF blob
  const blob = await generatePDFBlob(element, options, captureWidth);
  if (!blob) {
    // If blob generation fails, fall back to browser print dialog
    return downloadPDF(elementId, filename, options);
  }

  if (isMobile) {
    // Mobile: open native share sheet (WhatsApp, email, etc.)
    return await sharePDF(blob, cleanName);
  }

  // Desktop: show preview before saving
  return await showPDFPreview(blob, cleanName);
};
