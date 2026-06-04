/**
 * Print/PDF generator using browser's native print dialog.
 * Clones the print-area element to body level for clean output,
 * hiding all other page content.
 */
export const downloadPDF = (elementId: string, _filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[downloadPDF] Element with id "${elementId}" not found.`);
    alert('Print area not found. Please try again.');
    return;
  }

  // Clone the print area and attach directly to body for clean printing
  const clone = element.cloneNode(true) as HTMLElement;
  clone.id = 'print-area-clone';
  clone.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    max-height: none;
    overflow: visible;
    padding: 20px;
    margin: 0;
    border: none;
    box-shadow: none;
    background: white;
    z-index: 999999;
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

  const cleanup = () => {
    document.body.classList.remove('printing-report');
    const cloneEl = document.getElementById('print-area-clone');
    if (cloneEl) cloneEl.remove();
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
