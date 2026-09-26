import type { TDocumentDefinitions } from 'pdfmake/interfaces';

type PdfMakeRuntime = {
  vfs?: Record<string, string>;
  addVirtualFileSystem?: (vfs: Record<string, string>) => void;
  createPdf: (definition: TDocumentDefinitions) => {
    download: (fileName?: string) => void | Promise<void>;
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
    const vfs = fonts.pdfMake?.vfs || fonts.vfs || fonts as unknown as Record<string, string>;
    if (!vfs['Roboto-Regular.ttf'] || !vfs['Roboto-Medium.ttf']) {
      throw new Error('As fontes incorporadas do gerador de PDF não foram carregadas.');
    }
    if (make.addVirtualFileSystem) make.addVirtualFileSystem(vfs);
    else make.vfs = vfs;
    return make;
  }).catch((error) => {
    runtimePromise = null;
    throw error;
  });

  return runtimePromise;
}
