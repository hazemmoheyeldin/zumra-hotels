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
    width: 100%;
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

  // Inject dynamic @page style for landscape/portrait
  const pageStyleId = 'dynamic-page-style';
  let pageStyle = document.getElementById(pageStyleId) as HTMLStyleElement | null;
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = pageStyleId;
    document.head.appendChild(pageStyle);
  }
  if (landscape) {
    pageStyle.textContent = `@media print { @page { size: A4 landscape; margin: 0; } }`;
  } else {
    pageStyle.textContent = `@media print { @page { size: A4 portrait; margin: 0; } }`;
  }

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
