/**
 * Print/PDF generator using browser's native print dialog.
 * This avoids html2pdf.js CORS/image issues entirely.
 */
export const downloadPDF = (elementId: string, _filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[downloadPDF] Element with id "${elementId}" not found.`);
    alert('Print area not found. Please try again.');
    return;
  }

  // Add a class to body to trigger print-only CSS, then print
  document.body.classList.add('printing-report');

  // Small delay to let CSS apply
  setTimeout(() => {
    window.print();
    // Remove after print dialog closes
    document.body.classList.remove('printing-report');
  }, 100);
};
