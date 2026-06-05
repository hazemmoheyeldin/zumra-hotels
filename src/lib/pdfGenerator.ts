/**
 * Print/PDF generator using browser's native print dialog.
 * Clones the print-area element to body level for clean output,
 * hiding all other page content.
 */

interface PDFOptions {
  landscape?: boolean;
}

export const downloadPDF = (elementId: string, filename: string, options?: PDFOptions) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[downloadPDF] Element with id "${elementId}" not found.`);
    alert('Print area not found. Please try again.');
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
    // Clear inner content
    marker.innerHTML = '';
  });

  // Remove insert zones and toggle buttons from clone
  clone.querySelectorAll('.pb-insert-zone').forEach(el => el.remove());
  clone.querySelectorAll('.pb-insert-zone-row').forEach(el => el.remove());
  clone.querySelectorAll('.pb-toggle-btn').forEach(el => el.remove());

  clone.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    min-height: 100vh;
    max-height: none;
    height: auto;
    overflow: visible;
    padding: 20px;
    margin: 0;
    border: none;
    box-shadow: none;
    background: white;
    z-index: 999999;
    page-break-inside: avoid;
    break-inside: avoid;
  `;

  // Inject dynamic @page style for landscape/portrait + mobile print fixes
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
      @page { size: ${pageSize}; margin: 0; }
      html, body {
        overflow: hidden !important;
        height: 100% !important;
        background: white !important;
        position: fixed !important;
        width: 100% !important;
      }
      body.printing-report > *:not(#print-area-clone) {
        display: none !important;
        visibility: hidden !important;
      }
      #print-area-clone {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        background: white !important;
        z-index: 999999 !important;
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
    document.body.classList.remove('printing-report');
    const cloneEl = document.getElementById('print-area-clone');
    if (cloneEl) cloneEl.remove();
    // Restore original title
    document.title = originalTitle;
    // Remove dynamic page style
    const ps = document.getElementById(pageStyleId);
    if (ps) ps.remove();
  };

  // Listen for afterprint event for reliable cleanup
  const onAfterPrint = () => {
    cleanup();
    window.removeEventListener('afterprint', onAfterPrint);
  };
  window.addEventListener('afterprint', onAfterPrint);

  // Wait for images then print
  Promise.all(imagePromises).then(() => {
    // Small extra delay to ensure DOM is painted
    setTimeout(() => {
      window.print();
      // Fallback cleanup in case afterprint doesn't fire
      setTimeout(cleanup, 1000);
    }, 200);
  });
};
