import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Captures a DOM element as a high-quality PDF using html2canvas + jsPDF.
 * This approach preserves all Unicode characters, CSS styling, and Recharts visuals.
 */
export async function captureReportAsPDF(
  element: HTMLElement,
  filename: string
): Promise<void> {
  // Temporarily make the element visible for capture
  const originalDisplay = element.style.display;
  const originalPosition = element.style.position;
  const originalLeft = element.style.left;
  const originalTop = element.style.top;
  const originalWidth = element.style.width;

  // Position off-screen but rendered
  element.style.display = "block";
  element.style.position = "fixed";
  element.style.left = "-9999px";
  element.style.top = "0";
  element.style.width = "794px"; // A4 at 96 DPI

  // Wait for Recharts to render
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
    });

    // A4 dimensions in mm
    const pdfWidth = 210;
    const pdfHeight = 297;

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF("p", "mm", "a4");
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Additional pages
    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(filename);
  } finally {
    // Restore original styles
    element.style.display = originalDisplay;
    element.style.position = originalPosition;
    element.style.left = originalLeft;
    element.style.top = originalTop;
    element.style.width = originalWidth;
  }
}
