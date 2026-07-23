import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures an HTML element and converts it to a PDF Blob using html2canvas and jspdf.
 * @param elementId The ID of the HTML element to capture.
 * @returns A Promise that resolves to a Blob containing the PDF data.
 */
export const createPdfBlob = async (elementId: string): Promise<Blob> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // Ensure element is visible during capture (useful for print-only elements)
  const originalDisplay = element.style.display;
  element.style.display = 'block';

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    
    // A4 dimensions in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0; // Top align

    pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    
    // Convert to Blob instead of saving directly to allow sharing
    return pdf.output('blob');
  } finally {
    element.style.display = originalDisplay;
  }
};

/**
 * Generates a PDF from an HTML element and triggers a browser download.
 * @param elementId The ID of the HTML element to capture.
 * @param filename The filename for the downloaded PDF.
 */
export const generatePDF = async (elementId: string, filename: string): Promise<void> => {
  try {
    const blob = await createPdfBlob(elementId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Generates a PDF and attempts to use the native Web Share API.
 * Falls back to downloading if sharing files is unsupported.
 * @param elementId The ID of the HTML element to capture.
 * @param filename The filename for the PDF.
 * @param title Title for the share dialog.
 * @param text Text description for the share dialog.
 */
export const sharePDF = async (elementId: string, filename: string, title: string, text: string): Promise<void> => {
  try {
    const blob = await createPdfBlob(elementId);
    const file = new File([blob], filename.endsWith('.pdf') ? filename : `${filename}.pdf`, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title,
        text
      });
    } else {
      // Fallback to download
      console.warn('Web Share API not supported for files on this browser. Falling back to download.');
      await generatePDF(elementId, filename);
    }
  } catch (error) {
    // If the user cancels the share, it throws a DOMException named 'AbortError'.
    // We shouldn't necessarily treat that as a fatal app error.
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Share was aborted by the user.');
      return;
    }
    console.error('Error sharing PDF:', error);
    throw error;
  }
};
