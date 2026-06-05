/**
 * Print/PDF generator using browser's native print dialog.
 * Clones the print-area element to body level for clean output,
 * forcing a fixed desktop-width (900px) layout regardless of device screen size.
 * This ensures responsive CSS classes always render in their desktop form,
 * producing a consistent A4-style document on both desktop and mobile.
 */

interface PDFOptions {
  landscape?: boolean;
}

// Fixed render width ensures Tailwind `md:` breakpoints always activate,
// so PDFs always look like the desktop layout (no stacked mobile columns).
const PDF_RENDER_WIDTH = 900;

// Guard flag to prevent double-triggering and "blocked from printing" errors
let isPrinting = false;
let printCleanupTimer: ReturnType<typeof setTimeout> | null = null;

export const downloadPDF = (elementId: string, filename: string, options?: PDFOptions) => {
  // Prevent re-entrant calls (causes "blocked from automatically printing")
  if (isPrinting) return;
  isPrinting = true;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[downloadPDF] Element with id "${elementId}" not found.`);
    alert('Print area not found. Please try again.');
    isPrinting = false;
    return;
  }

  const landscape = options?.landscape || false;

  // Clone the print area and attach directly to body for clean printing
  const clone = element.cloneNode(true) as HTMLElement;
  clone.id = 'print-area-clone';

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

  // FIXED-WIDTH CLONE: Force desktop layout at 900px regardless of device.
  // This prevents responsive Tailwind classes (sm:, md:, lg:) from collapsing
  // into their mobile/stacked form on phones and tablets.
  clone.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${PDF_RENDER_WIDTH}px;
    max-width: ${PDF_RENDER_WIDTH}px;
    min-width: ${PDF_RENDER_WIDTH}px;
    max-height: none;
    height: auto;
    overflow: visible;
    padding: 24px;
    margin: 0;
    border: none;
    box-shadow: none;
    background: white;
    z-index: 999999;
    page-break-inside: avoid;
    break-inside: avoid;
    display: block;
    visibility: visible;
    opacity: 1;
    transform: none;
    font-family: inherit;
    color: #1e293b;
    box-sizing: border-box;
  `;

  // Calculate zoom to fit the fixed-width clone onto the A4 page.
  // A4 printable width ≈ 210mm (portrait) / 297mm (landscape) at 96dpi.
  // The browser's print engine handles final page fitting; zoom gives a good baseline.
  const baseZoom = landscape ? 1.05 : 0.78;

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
        overflow: hidden !important;
      }
      /* Hide ALL content except the cloned print area */
      body.printing-report > *:not(#print-area-clone) {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      /* Show only the clone at fixed desktop width */
      body.printing-report #print-area-clone {
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: ${PDF_RENDER_WIDTH}px !important;
        max-width: ${PDF_RENDER_WIDTH}px !important;
        min-width: ${PDF_RENDER_WIDTH}px !important;
        max-height: none !important;
        height: auto !important;
        background: white !important;
        z-index: 999999 !important;
        overflow: visible !important;
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

  document.body.appendChild(clone);
  document.body.classList.add('printing-report');

  // Wait for images in clone to load
  const allImgs = clone.querySelectorAll('img');
  const imagePromises = Array.from(allImgs).map(img => {
    if (img.complete && img.naturalHeight > 0) return Promise.resolve();
    return new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(() => resolve(), 3000);
    });
  });

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
    // Release print guard after a short cooldown (allow sequential printing)
    setTimeout(() => { isPrinting = false; }, 500);
  };

  // Listen for afterprint event for reliable cleanup
  const onAfterPrint = () => {
    cleanup();
    window.removeEventListener('afterprint', onAfterPrint);
  };
  window.addEventListener('afterprint', onAfterPrint);

  // Also listen for focus return (mobile browsers sometimes skip afterprint)
  const onFocusReturn = () => {
    setTimeout(() => {
      if (document.getElementById('print-area-clone')) {
        cleanup();
      }
    }, 500);
    window.removeEventListener('focus', onFocusReturn);
  };
  window.addEventListener('focus', onFocusReturn);

  // Wait for images then print
  Promise.all(imagePromises).then(() => {
    // Longer delay on mobile to ensure the clone renders at full desktop width
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const printDelay = isMobile ? 800 : 400;
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.warn('Print failed:', e);
        cleanup();
      }
      // Safety fallback cleanup in case afterprint doesn't fire
      printCleanupTimer = setTimeout(() => {
        if (document.getElementById('print-area-clone')) {
          cleanup();
          isPrinting = false;
        }
      }, 5000);
    }, printDelay);
  });
};
