import type { TDocumentDefinitions } from 'pdfmake/interfaces';

type PdfMakeRuntime = {
  vfs?: Record<string, string>;
  createPdf: (definition: TDocumentDefinitions) => {
    download: (fileName?: string) => void;
  };
};

let runtimePromise: Promise<PdfMakeRuntime> | null = null;

export function loadPdfMake() {
  runtimePromise ||= Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts')
  ]).then(([{ default: pdfMake }, { default: pdfFonts }]) => {
    const fonts = pdfFonts as typeof pdfFonts & {
      pdfMake?: { vfs: Record<string, string> };
      vfs?: Record<string, string>;
    };
    const make = pdfMake as PdfMakeRuntime;
    make.vfs = fonts.pdfMake?.vfs || fonts.vfs || {};
    return make;
  }).catch((error) => {
    runtimePromise = null;
    throw error;
  });

  return runtimePromise;
}
