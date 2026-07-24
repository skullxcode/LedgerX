import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';

/**
 * Captures an HTML element and converts it to a PDF Blob using html2canvas and jspdf.
 * @param elementId The ID of the HTML element to capture.
 * @param autoPrint Whether to inject a script to auto-print when opened in a PDF viewer.
 * @returns A Promise that resolves to a Blob containing the PDF data.
 */
export const createPdfBlob = async (elementId: string, autoPrint: boolean = false): Promise<Blob> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // Ensure element is visible during capture (useful for print-only elements)
  const originalDisplay = element.style.display;
  element.style.display = 'block';

  try {
    const imgData = await toJpeg(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    });
    
    // A4 dimensions in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // We need to calculate aspect ratio. Create an image to get intrinsic dimensions.
    const img = new Image();
    img.src = imgData;
    await new Promise((resolve) => { img.onload = resolve; });
    
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0; // Top align

    pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    
    if (autoPrint) {
      pdf.autoPrint();
    }
    
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

/**
 * Generates a PDF from an HTML element and opens it in a new tab to print natively.
 * @param elementId The ID of the HTML element to capture.
 */
export const printPDF = async (elementId: string): Promise<void> => {
  try {
    const blob = await createPdfBlob(elementId, true);
    const url = URL.createObjectURL(blob);
    
    const printWindow = window.open(url, '_blank');
    if (!printWindow) {
      console.warn("Popup blocked. Could not open print window.");
      // Fallback: trigger normal print if popups are blocked
      window.print();
    }
    
    // Note: We don't revoke the URL immediately because the new tab needs time to load it.
    // The browser will clean up blob URLs when the document is unloaded.
  } catch (error) {
    console.error('Error printing PDF:', error);
    // Fallback to normal window print if PDF generation fails
    window.print();
  }
};
