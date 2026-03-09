import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const A4_HEIGHT_MM = 297;
const A4_WIDTH_MM = 210;
const MARGIN_MM = 15;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - 2 * MARGIN_MM; // 180mm
const SECTION_GAP_MM = 4;

/**
 * Section-based PDF capture that prevents content from being cut across pages.
 * Each element with [data-pdf-section] is captured individually and placed
 * on the current page only if it fits; otherwise, a new page is started.
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
  const originalVisibility = element.style.visibility;

  // Position off-screen but rendered
  element.style.display = "block";
  element.style.position = "fixed";
  element.style.left = "-9999px";
  element.style.top = "0";
  element.style.width = "794px"; // A4 at 96 DPI
  element.style.visibility = "visible";

  // Wait for Recharts and fonts to render
  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Find all sections marked with data-pdf-section
    const sections = Array.from(
      element.querySelectorAll("[data-pdf-section]")
    ) as HTMLElement[];

    // Fallback: if no sections found, capture entire element
    if (sections.length === 0) {
      await captureFullElement(pdf, element);
    } else {
      let currentY = MARGIN_MM;
      let isFirstPage = true;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        // Capture this section
        const canvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 794,
        });

        // Calculate dimensions in mm
        const widthPx = canvas.width / 2; // scale factor
        const heightPx = canvas.height / 2;
        const scaleFactor = CONTENT_WIDTH_MM / widthPx;
        const heightMM = heightPx * scaleFactor;

        // Check if section fits on current page
        const remainingSpace = A4_HEIGHT_MM - MARGIN_MM - currentY;

        if (heightMM > remainingSpace && !isFirstPage) {
          // Section doesn't fit, start a new page
          pdf.addPage();
          currentY = MARGIN_MM;
        }

        // Add the section image to PDF
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", MARGIN_MM, currentY, CONTENT_WIDTH_MM, heightMM);

        // Move Y position for next section
        currentY += heightMM + SECTION_GAP_MM;
        isFirstPage = false;

        // If we're past the page boundary after adding gap, reset for next
        if (currentY >= A4_HEIGHT_MM - MARGIN_MM) {
          pdf.addPage();
          currentY = MARGIN_MM;
        }
      }
    }

    pdf.save(filename);
  } finally {
    // Restore original styles
    element.style.display = originalDisplay;
    element.style.position = originalPosition;
    element.style.left = originalLeft;
    element.style.top = originalTop;
    element.style.width = originalWidth;
    element.style.visibility = originalVisibility;
  }
}

/**
 * Fallback: capture entire element as single image with page splitting
 */
async function captureFullElement(pdf: jsPDF, element: HTMLElement): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: 794,
    windowWidth: 794,
  });

  const imgWidth = CONTENT_WIDTH_MM;
  const imgHeight = (canvas.height * CONTENT_WIDTH_MM) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  const pageContentHeight = A4_HEIGHT_MM - 2 * MARGIN_MM;
  let heightLeft = imgHeight;
  let position = MARGIN_MM;

  // First page
  pdf.addImage(imgData, "PNG", MARGIN_MM, position, imgWidth, imgHeight);
  heightLeft -= pageContentHeight;

  // Additional pages if needed
  while (heightLeft > 0) {
    position = MARGIN_MM - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "PNG", MARGIN_MM, position, imgWidth, imgHeight);
    heightLeft -= pageContentHeight;
  }
}
