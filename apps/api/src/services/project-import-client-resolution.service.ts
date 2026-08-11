import { isValidCnpj, isValidCpf } from '@geogestor/contracts';

export type ImportClientReference = {
  id: string;
  nome: string;
  documentoNormalizado: string | null;
  municipio?: string | null;
};

export type ProjectImportClientInput = {
  clienteId?: string;
  clienteReferencia?: string;
  clienteDocumento?: string;
  associacaoManual?: boolean;
  associacaoPendente?: boolean;
};

export type ProjectImportClientResolution =
  | { status: 'resolved'; client: ImportClientReference; method: 'document' | 'exact_name' | 'manual' | 'internal_id' }
  | { status: 'missing' | 'ambiguous' | 'invalid_document' | 'manual_pending'; message: string };

export type ProjectImportPreviewRow = {
  index: number;
  row: number;
  projectName: string;
  reference: string;
  status: 'resolved' | 'pending';
  action: 'create' | 'reject';
  reason: 'document' | 'exact_name' | 'manual' | 'internal_id' | 'missing' | 'ambiguous' | 'invalid_document' | 'manual_pending' | 'invalid_row';
  message: string;
  association?: {
    clientId: string;
    clientName: string;
    documentMasked: string | null;
    municipality: string | null;
    method: 'document' | 'exact_name' | 'manual' | 'internal_id';
  };
};

const normalizedName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function maskedDocument(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? `CPF ***.***.***-${digits.slice(-2)}` : `CNPJ **.***.***/****-${digits.slice(-2)}`;
}

export function resolveProjectImportClient(
  input: ProjectImportClientInput,
  clients: ImportClientReference[]
): ProjectImportClientResolution {
  if (input.associacaoPendente) {
    return { status: 'manual_pending', message: 'Associação mantida como pendente por decisão do usuário.' };
  }
  if (input.clienteId) {
    const client = clients.find(candidate => candidate.id === input.clienteId);
    return client
      ? { status: 'resolved', client, method: input.associacaoManual ? 'manual' : 'internal_id' }
      : { status: 'missing', message: 'Cliente não localizado pelo identificador informado.' };
  }

  const reference = input.clienteDocumento?.trim() || input.clienteReferencia?.trim() || '';
  const digits = reference.replace(/\D/g, '');
  const looksLikeDocument = digits.length === 11 || digits.length === 14;
  let candidates: ImportClientReference[];

  if (looksLikeDocument) {
    const valid = digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
    if (!valid) {
      return { status: 'invalid_document', message: `${maskedDocument(digits)} inválido. Corrija o documento ou associe o cliente manualmente.` };
    }
    candidates = clients.filter(candidate => candidate.documentoNormalizado === digits);
  } else {
    candidates = clients.filter(candidate => normalizedName(candidate.nome) === normalizedName(reference));
  }

  if (candidates.length === 0) {
    return {
      status: 'missing',
      message: looksLikeDocument
        ? `Cliente não localizado para ${maskedDocument(digits)}. Cadastre ou associe o cliente manualmente.`
        : `Cliente não localizado pelo nome exato “${reference}”. Cadastre ou associe o cliente manualmente.`
    };
  }
  if (candidates.length > 1) {
    return {
      status: 'ambiguous',
      message: `Cliente ambíguo para o nome “${reference}”. Use CPF/CNPJ ou faça a associação manual.`
    };
  }
  return { status: 'resolved', client: candidates[0], method: looksLikeDocument ? 'document' : 'exact_name' };
}

export function projectImportPreviewRow(
  item: ProjectImportClientInput & { nome?: string },
  index: number,
  clients: ImportClientReference[]
): ProjectImportPreviewRow {
  const resolution = resolveProjectImportClient(item, clients);
  const reference = item.clienteDocumento?.trim() || item.clienteReferencia?.trim() || '';
  const referenceDigits = reference.replace(/\D/g, '');
  const safeReference = referenceDigits.length === 11 || referenceDigits.length === 14 ? maskedDocument(reference) || '' : reference;
  if (resolution.status !== 'resolved') {
    return {
      index,
      row: index + 2,
      projectName: item.nome?.trim() || 'Projeto sem nome',
      reference: safeReference,
      status: 'pending',
      action: 'reject',
      reason: resolution.status,
      message: resolution.message
    };
  }
  return {
    index,
    row: index + 2,
    projectName: item.nome?.trim() || 'Projeto sem nome',
    reference: safeReference,
    status: 'resolved',
    action: 'create',
    reason: resolution.method,
    message: resolution.method === 'manual' ? 'Cliente confirmado manualmente.' : 'Cliente identificado automaticamente.',
    association: {
      clientId: resolution.client.id,
      clientName: resolution.client.nome,
      documentMasked: maskedDocument(resolution.client.documentoNormalizado),
      municipality: resolution.client.municipio ?? null,
      method: resolution.method
    }
  };
}

export function summarizeProjectImportPreview(rows: ProjectImportPreviewRow[]) {
  return {
    total: rows.length,
    automatic: rows.filter(row => row.status === 'resolved' && row.association?.method !== 'manual').length,
    manual: rows.filter(row => row.association?.method === 'manual').length,
    pending: rows.filter(row => row.status === 'pending').length,
    missing: rows.filter(row => row.reason === 'missing').length,
    ambiguous: rows.filter(row => row.reason === 'ambiguous').length,
    invalid: rows.filter(row => row.reason === 'invalid_document' || row.reason === 'invalid_row').length
  };
}
