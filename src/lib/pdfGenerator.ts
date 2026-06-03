import html2pdf from 'html2pdf.js';

export const downloadPDF = (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const opt = {
    margin:       [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
    filename:     filename,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as 'portrait' | 'landscape' }
  };

  html2pdf().set(opt).from(element).save();
};
