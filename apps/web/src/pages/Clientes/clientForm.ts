import { ClientePayloadSchema, type ClientePayload } from '@geogestor/contracts';
import { formatCnpj, formatCpf, formatPhoneBR, onlyDigits } from '../../utils/formatters';
import { CLIENT_PRIMARY_ORIGIN_OPTIONS, PUBLIC_ENTITY_CATEGORY, resolveClientClassification } from '../../utils/clientTags';

export type PersonType = 'PF' | 'PJ';

export interface ClientRecordForForm {
  nome?: string | null;
  tipoPessoa?: PersonType | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  numero?: string | null;
  semNumero?: boolean | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  celular?: string | null;
  celularWhatsapp?: boolean | null;
  cpf?: string | null;
  rg?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  origem?: string | null;
  origemPrincipal?: string | null;
  origemDetalhe?: string | null;
  indicadoPor?: string | null;
  categoria?: string | null;
  perfis?: string | null;
  anotacoes?: string | null;
  situacao?: string | null;
  previsaoEntrega?: string | null;
  servicos?: string | null;
}

export interface ClientFormState {
  tipoPessoa: PersonType | '';
  nome: string;
  cpf: string;
  rg: string;
  cnpj: string;
  inscricaoEstadual: string;
  email: string;
  celular: string;
  celularWhatsapp: boolean;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  semNumero: boolean;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  categoriaPrincipal: string;
  categoriaPendente: string;
  perfis: string[];
  origemPrincipal: string;
  origemDetalhe: string;
  indicadoPor: string;
  servicos: string[];
  anotacoes: string;
  situacao: string;
}

export type ClientFormErrors = Partial<Record<keyof ClientFormState, string>>;

const splitTags = (value?: string | null) =>
  (value || '').split(',').map((item) => item.trim()).filter(Boolean);

export const formatCep = (value?: string | null) => {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const readPersonType = (client?: ClientRecordForForm | null): ClientFormState['tipoPessoa'] =>
  client?.tipoPessoa === 'PF' || client?.tipoPessoa === 'PJ' ? client.tipoPessoa : '';

export const createEmptyClientForm = (): ClientFormState => ({
  tipoPessoa: '',
  nome: '',
  cpf: '',
  rg: '',
  cnpj: '',
  inscricaoEstadual: '',
  email: '',
  celular: '',
  celularWhatsapp: false,
  telefone: '',
  cep: '',
  endereco: '',
  numero: '',
  semNumero: false,
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  categoriaPrincipal: '',
  categoriaPendente: '',
  perfis: [],
  origemPrincipal: '',
  origemDetalhe: '',
  indicadoPor: '',
  servicos: [],
  anotacoes: '',
  situacao: 'Ativo'
});

export const clientRecordToForm = (client?: ClientRecordForForm | null): ClientFormState => {
  if (!client) return createEmptyClientForm();

  const tipoPessoa = readPersonType(client);
  const classification = resolveClientClassification(client.categoria, client.perfis);
  const legacyOrigins = splitTags(client.origem);
  const legacyPrimary = legacyOrigins[0] || '';
  const hasSupportedLegacyOrigin = CLIENT_PRIMARY_ORIGIN_OPTIONS.includes(legacyPrimary);
  const origemPrincipal = client.origemPrincipal || (hasSupportedLegacyOrigin ? legacyPrimary : legacyPrimary ? 'Outro' : '');
  const legacyDocument = client.documento || '';
  const documentDigits = onlyDigits(legacyDocument);

  return {
    tipoPessoa,
    nome: client.nome || '',
    cpf: formatCpf(client.cpf || (documentDigits.length === 11 ? legacyDocument : '')),
    rg: client.rg || (tipoPessoa === 'PF' && documentDigits.length !== 11 && documentDigits.length !== 14 ? legacyDocument : ''),
    cnpj: formatCnpj(client.cnpj || (documentDigits.length === 14 ? legacyDocument : '')),
    inscricaoEstadual: client.inscricaoEstadual || (tipoPessoa === 'PJ' && documentDigits.length !== 11 && documentDigits.length !== 14 ? legacyDocument : ''),
    email: client.email || '',
    celular: formatPhoneBR(client.celular || ''),
    celularWhatsapp: Boolean(client.celularWhatsapp),
    telefone: formatPhoneBR(client.telefone || ''),
    cep: formatCep(client.cep || ''),
    endereco: client.endereco || '',
    numero: client.numero || '',
    semNumero: Boolean(client.semNumero),
    complemento: client.complemento || '',
    bairro: client.bairro || '',
    municipio: client.municipio || '',
    uf: (client.uf || '').toUpperCase(),
    categoriaPrincipal: classification.primary || '',
    categoriaPendente: classification.legacyCategory || '',
    perfis: classification.profiles,
    origemPrincipal,
    origemDetalhe: client.origemDetalhe || (!hasSupportedLegacyOrigin && legacyPrimary ? client.origem || '' : ''),
    indicadoPor: client.indicadoPor || '',
    servicos: splitTags(client.servicos),
    anotacoes: client.anotacoes || '',
    situacao: client.situacao || 'Ativo'
  };
};

export const applyClientPrefill = (form: ClientFormState, prefill?: Record<string, string>) => {
  if (!prefill) return form;
  const tipoPessoa = prefill.tipoPessoa === 'PJ' || prefill.cnpj ? 'PJ' : form.tipoPessoa;
  return {
    ...form,
    tipoPessoa,
    nome: prefill.nome || form.nome,
    email: prefill.email || form.email,
    telefone: prefill.telefone ? formatPhoneBR(prefill.telefone) : form.telefone,
    celular: prefill.celular ? formatPhoneBR(prefill.celular) : form.celular,
    endereco: prefill.endereco || form.endereco,
    numero: prefill.numero || form.numero,
    bairro: prefill.bairro || form.bairro,
    municipio: prefill.municipio || form.municipio,
    uf: (prefill.uf || form.uf).toUpperCase(),
    cep: prefill.cep ? formatCep(prefill.cep) : form.cep,
    cpf: prefill.cpf ? formatCpf(prefill.cpf) : form.cpf,
    cnpj: prefill.cnpj ? formatCnpj(prefill.cnpj) : form.cnpj
  };
};

const nullable = (value: string) => value.trim() || null;

const resolveLegacyOrigin = (form: ClientFormState, existing?: ClientRecordForForm | null) => {
  const existingOrigin = existing?.origem?.trim();
  if (!existingOrigin) return nullable(form.origemPrincipal);

  const existingOrigins = splitTags(existingOrigin);
  const containsLegacyInformation = existingOrigins.length > 1
    || !CLIENT_PRIMARY_ORIGIN_OPTIONS.includes(existingOrigins[0] || '');

  return containsLegacyInformation ? existingOrigin : nullable(form.origemPrincipal);
};

export const clientFormToPayload = (
  form: ClientFormState,
  existing?: ClientRecordForForm | null
): ClientePayload => {
  const activeDocument = form.tipoPessoa === 'PJ' ? form.cnpj : form.cpf;

  return {
    nome: form.nome.trim(),
    tipoPessoa: form.tipoPessoa as PersonType,
    documento: nullable(activeDocument),
    email: nullable(form.email),
    telefone: nullable(form.telefone),
    endereco: nullable(form.endereco),
    numero: form.semNumero ? null : nullable(form.numero),
    semNumero: form.semNumero,
    complemento: nullable(form.complemento),
    bairro: nullable(form.bairro),
    municipio: nullable(form.municipio),
    uf: nullable(form.uf.toUpperCase()),
    cep: nullable(form.cep),
    celular: nullable(form.celular),
    celularWhatsapp: Boolean(form.celular && form.celularWhatsapp),
    cpf: nullable(form.cpf),
    rg: nullable(form.rg),
    cnpj: nullable(form.cnpj),
    inscricaoEstadual: nullable(form.inscricaoEstadual),
    // Origens múltiplas ou fora da lista nova permanecem intactas para consumidores antigos.
    origem: resolveLegacyOrigin(form, existing),
    origemPrincipal: (form.origemPrincipal || null) as ClientePayload['origemPrincipal'],
    origemDetalhe: form.origemPrincipal === 'Outro' ? nullable(form.origemDetalhe) : null,
    indicadoPor: form.origemPrincipal === 'Indicação' ? nullable(form.indicadoPor) : null,
    // Tipo de pessoa e categoria são taxonomias independentes.
    categoria: nullable(form.categoriaPrincipal || form.categoriaPendente),
    perfis: nullable(form.perfis.join(', ')),
    anotacoes: nullable(form.anotacoes),
    situacao: form.situacao || 'Ativo',
    previsaoEntrega: existing?.previsaoEntrega || null,
    servicos: nullable(form.servicos.join(', '))
  };
};

export const validateClientForm = (form: ClientFormState, existing?: ClientRecordForForm | null) => {
  const payload = clientFormToPayload(form, existing);
  const result = ClientePayloadSchema.safeParse(payload);
  const errors: ClientFormErrors = {};

  if (!form.tipoPessoa) errors.tipoPessoa = 'Selecione Pessoa Física ou Pessoa Jurídica para revisar o cadastro.';
  if (form.categoriaPendente && !form.categoriaPrincipal) {
    errors.categoriaPrincipal = 'Escolha uma categoria principal para resolver a classificação anterior.';
  }
  if (form.categoriaPrincipal === PUBLIC_ENTITY_CATEGORY && form.tipoPessoa === 'PF') {
    errors.categoriaPrincipal = 'Entidade Pública exige Pessoa Jurídica. Para um representante em nome próprio, mantenha Pessoa Física e escolha outro perfil.';
  }

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const pathField = issue.path[0];
      const field = (pathField === 'categoria' ? 'categoriaPrincipal' : pathField) as keyof ClientFormState | undefined;
      if (field && !errors[field]) errors[field] = issue.message;
    });
  }

  return { payload, errors, valid: result.success && Object.keys(errors).length === 0 };
};

export const clientFormFingerprint = (form: ClientFormState) => JSON.stringify(form);
