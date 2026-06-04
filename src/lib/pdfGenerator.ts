import html2pdf from 'html2pdf.js';

export const downloadPDF = (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[downloadPDF] Element with id "${elementId}" not found.`);
    alert('Print area not found. Please try again.');
    return;
  }

  // Temporarily ensure all images in the print area are loaded (prevents html2canvas hang)
  const images = element.querySelectorAll('img');
  const imagePromises = Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve(); // resolve even on error to prevent hanging
      setTimeout(() => resolve(), 3000); // 3s timeout per image
    });
  });

  Promise.all(imagePromises).then(() => {
    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        onclone: (clonedDoc: Document) => {
          // Ensure cloned images use the same resolved URLs
          const clonedImgs = clonedDoc.querySelectorAll('img');
          clonedImgs.forEach(img => {
            img.crossOrigin = 'anonymous';
          });
        },
      },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as 'portrait' | 'landscape' }
    };

    html2pdf().set(opt).from(element).save().catch((err: unknown) => {
      console.error('[downloadPDF] Generation failed:', err);
      alert('PDF generation failed. Please try using your browser\'s Print function (Ctrl+P) and select "Save as PDF".');
    });
  });
};
