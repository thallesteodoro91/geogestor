import { createLaudoPdfDefinition, sanitizeLaudoFileName, type LaudoOptions } from '@geogestor/contracts/src/environmental-document-pdf';
import { loadPdfMake } from './loadPdfMake';
export { createLaudoPdfDefinition, sanitizeLaudoFileName, formatLaudoDate, type LaudoOptions } from '@geogestor/contracts/src/environmental-document-pdf';
export const gerarLaudoTecnico = async (options: LaudoOptions) => {
  const pdfMake = await loadPdfMake();
  const prefix = options.tipoLaudo === 'acompanhamento' ? 'Relatorio_Acompanhamento' : 'Laudo';
  await pdfMake.createPdf(createLaudoPdfDefinition(options)).download(`${prefix}_${sanitizeLaudoFileName(options.projetoNome)}.pdf`);
};