import { z } from 'zod';
import { isRealEnvironmentalDateKey } from './environmental';
const optionalText = (max: number) => z.string().trim().max(max).default('');
export const EnvironmentalDocumentInputSchema = z.object({
  projetoNome: z.string().trim().min(1).max(200), clienteNome: z.string().trim().min(1).max(200),
  tipoLaudo: z.enum(['acompanhamento', 'vistoria', 'fauna', 'flora', 'outros']),
  dataVistoria: z.string().refine(isRealEnvironmentalDateKey, 'Informe uma data de referência válida.'),
  tecnicoResponsavel: z.string().trim().min(1).max(200), observacoes: optionalText(5000),
  tipoDemanda: optionalText(200), propriedadeNome: optionalText(200), protocolo: optionalText(200), orgaoAmbiental: optionalText(200),
  finalidade: optionalText(3000), documentosConsiderados: optionalText(3000), proximosPassos: optionalText(3000),
  situacaoTrabalho: optionalText(200), faseAmbiental: optionalText(200), sintese: optionalText(1000)
}).strict();
export type EnvironmentalDocumentInput = z.infer<typeof EnvironmentalDocumentInputSchema>;
export interface EnvironmentalDocumentIssue {
  id: string; codigo: string; revisao: number; emittedAt: string; fileName: string;
  projetoId: string; sha256: string; tipoLaudo: string; responsavel: string;
}
export interface EnvironmentalDocumentPreview { pdfBase64: string; previewHash: string; createdAt: string }
