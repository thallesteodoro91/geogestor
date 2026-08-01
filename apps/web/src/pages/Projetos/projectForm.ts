import { ProjetoPayloadSchema, type ProjetoPayload } from '@geogestor/contracts';

export type ProjectModalTab = 'projeto' | 'propriedade' | 'geoloc';
export type ProjectModalContext = 'projeto' | 'ambiental' | 'licenciamento';
export type ProjectAreaUnit = 'ha' | 'm2';

export interface ProjectFormCopy {
  createTitle: string;
  editTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  typeLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  createAction: string;
  createSuccess: string;
  updateSuccess: string;
  discardMessage: string;
}

const projectContextCopy: Record<ProjectModalContext | 'pericia', ProjectFormCopy> = {
  projeto: {
    createTitle: 'Novo projeto',
    editTitle: 'Editar projeto',
    nameLabel: 'Nome do projeto',
    namePlaceholder: 'Ex.: Levantamento planialtimétrico — Lote 5',
    typeLabel: 'Tipo do projeto ou serviço',
    descriptionLabel: 'Descrição curta',
    descriptionPlaceholder: 'Resuma a finalidade, o escopo e o principal produto a entregar.',
    createAction: 'Criar projeto',
    createSuccess: 'Projeto criado com sucesso.',
    updateSuccess: 'Projeto atualizado com sucesso.',
    discardMessage: 'Descartar as alterações não salvas deste projeto?'
  },
  ambiental: {
    createTitle: 'Nova demanda ambiental',
    editTitle: 'Editar demanda ambiental',
    nameLabel: 'Nome da demanda',
    namePlaceholder: 'Ex.: Regularização ambiental — Fazenda Boa Vista',
    typeLabel: 'Tipo de demanda ambiental',
    descriptionLabel: 'Finalidade e escopo da demanda',
    descriptionPlaceholder: 'Resuma a finalidade ambiental, o escopo e o principal produto a entregar.',
    createAction: 'Criar demanda',
    createSuccess: 'Demanda ambiental criada com sucesso.',
    updateSuccess: 'Demanda ambiental atualizada com sucesso.',
    discardMessage: 'Descartar as alterações não salvas desta demanda ambiental?'
  },
  licenciamento: {
    createTitle: 'Novo processo de licenciamento',
    editTitle: 'Editar processo de licenciamento',
    nameLabel: 'Nome do processo',
    namePlaceholder: 'Ex.: Licenciamento ambiental — Unidade Florianópolis',
    typeLabel: 'Categoria do registro',
    descriptionLabel: 'Finalidade e escopo do licenciamento',
    descriptionPlaceholder: 'Resuma o empreendimento, o escopo do processo e a licença pretendida.',
    createAction: 'Criar processo',
    createSuccess: 'Processo de licenciamento criado com sucesso.',
    updateSuccess: 'Processo de licenciamento atualizado com sucesso.',
    discardMessage: 'Descartar as alterações não salvas deste processo de licenciamento?'
  },
  pericia: {
    createTitle: 'Nova perícia',
    editTitle: 'Editar perícia',
    nameLabel: 'Nome da perícia',
    namePlaceholder: 'Ex.: Perícia ambiental — Processo 5001234-56.2026',
    typeLabel: 'Categoria da demanda',
    descriptionLabel: 'Objeto e escopo da perícia',
    descriptionPlaceholder: 'Resuma o objeto, o escopo técnico e o produto pericial esperado.',
    createAction: 'Criar perícia',
    createSuccess: 'Perícia criada com sucesso.',
    updateSuccess: 'Perícia atualizada com sucesso.',
    discardMessage: 'Descartar as alterações não salvas desta perícia?'
  }
};

export const resolveProjectFormCopy = (
  context: ProjectModalContext,
  projectType?: string | null
): ProjectFormCopy => (
  projectType === 'Perícia'
    ? projectContextCopy.pericia
    : projectType === 'Licenciamento'
      ? projectContextCopy.licenciamento
      : projectType === 'Ambiental'
        ? projectContextCopy.ambiental
        : projectContextCopy[context]
);

export interface ProjectRecordForForm {
  nome?: string | null;
  clienteId?: string | null;
  propriedadeId?: string | null;
  descricao?: string | null;
  status?: string | null;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  areaHa?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  situacaoImovel?: string | null;
  tipo?: string | null;
  averbacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  possuiMemorialDescritivo?: string | null;
  observacoes?: string | null;
  orgaoAmbiental?: string | null;
  tipoDemanda?: string | null;
  tipoLicenca?: string | null;
  numeroLicenca?: string | null;
  dataEmissao?: string | null;
  dataVencimentoLicenca?: string | null;
  statusLicenca?: string | null;
  observacoesLicenca?: string | null;
  protocolo?: string | null;
  numeroProcesso?: string | null;
  tipoPericia?: string | null;
  dataVistoria?: string | null;
}

export interface ProjectFormState {
  nome: string;
  clienteId: string;
  propriedadeId: string;
  descricao: string;
  status: string;
  dataInicio: string;
  dataEntrega: string;
  area: string;
  areaUnit: ProjectAreaUnit;
  matricula: string;
  car: string;
  ccir: string;
  itr: string;
  uf: string;
  municipio: string;
  situacaoImovel: string;
  tipo: string;
  averbacao: string;
  latitude: string;
  longitude: string;
  possuiMemorialDescritivo: string;
  observacoes: string;
  orgaoAmbiental: string;
  tipoDemanda: string;
  tipoLicenca: string;
  numeroLicenca: string;
  dataEmissao: string;
  dataVencimentoLicenca: string;
  statusLicenca: string;
  observacoesLicenca: string;
  protocolo: string;
  numeroProcesso: string;
  tipoPericia: string;
  dataVistoria: string;
}

export type ProjectFormErrors = Partial<Record<keyof ProjectFormState, string>>;

const nullable = (value: string) => value.trim() || null;

const parseLocalizedNumber = (value: string) => {
  const normalized = value.trim().replace(/\s/g, '');
  if (!normalized) return null;
  const decimalNormalized = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  const number = Number(decimalNormalized);
  return Number.isFinite(number) ? number : Number.NaN;
};

const resolveTypeFromContext = (context: ProjectModalContext) => {
  if (context === 'ambiental') return 'Ambiental';
  if (context === 'licenciamento') return 'Licenciamento';
  return '';
};

const extractUf = (cityOrState?: string | null) => {
  const value = (cityOrState || '').trim();
  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const trailingUf = value.match(/(?:-|\/)\s*([A-Za-z]{2})$/);
  return trailingUf?.[1]?.toUpperCase() || '';
};

export const createEmptyProjectForm = (
  context: ProjectModalContext = 'projeto',
  initialClienteId = ''
): ProjectFormState => ({
  nome: '',
  clienteId: initialClienteId,
  propriedadeId: '',
  descricao: '',
  status: 'Planejamento',
  dataInicio: '',
  dataEntrega: '',
  area: '',
  areaUnit: 'ha',
  matricula: '',
  car: '',
  ccir: '',
  itr: '',
  uf: '',
  municipio: '',
  situacaoImovel: '',
  tipo: resolveTypeFromContext(context),
  averbacao: '',
  latitude: '',
  longitude: '',
  possuiMemorialDescritivo: '',
  observacoes: '',
  orgaoAmbiental: '',
  tipoDemanda: '',
  tipoLicenca: '',
  numeroLicenca: '',
  dataEmissao: '',
  dataVencimentoLicenca: '',
  statusLicenca: 'Em análise',
  observacoesLicenca: '',
  protocolo: '',
  numeroProcesso: '',
  tipoPericia: '',
  dataVistoria: ''
});

export const projectRecordToForm = (project: ProjectRecordForForm): ProjectFormState => {
  const fallbackMunicipio = !project.municipio && project.cidade && !extractUf(project.cidade)
    ? project.cidade
    : '';

  return {
    ...createEmptyProjectForm(),
    nome: project.nome || '',
    clienteId: project.clienteId || '',
    propriedadeId: project.propriedadeId || '',
    descricao: project.descricao || '',
    status: project.status || 'Planejamento',
    dataInicio: project.dataInicio || '',
    dataEntrega: project.dataEntrega || '',
    area: project.areaHa !== null && project.areaHa !== undefined ? String(project.areaHa).replace('.', ',') : '',
    matricula: project.matricula || '',
    car: project.car || '',
    ccir: project.ccir || '',
    itr: project.itr || '',
    uf: extractUf(project.cidade),
    municipio: project.municipio || fallbackMunicipio,
    situacaoImovel: project.situacaoImovel || '',
    tipo: project.tipo || '',
    averbacao: project.averbacao || '',
    latitude: project.latitude !== null && project.latitude !== undefined ? String(project.latitude) : '',
    longitude: project.longitude !== null && project.longitude !== undefined ? String(project.longitude) : '',
    possuiMemorialDescritivo: project.possuiMemorialDescritivo || '',
    observacoes: project.observacoes || '',
    orgaoAmbiental: project.orgaoAmbiental || '',
    tipoDemanda: project.tipoDemanda || '',
    tipoLicenca: project.tipoLicenca || '',
    numeroLicenca: project.numeroLicenca || '',
    dataEmissao: project.dataEmissao || '',
    dataVencimentoLicenca: project.dataVencimentoLicenca || '',
    statusLicenca: project.statusLicenca || 'Em análise',
    observacoesLicenca: project.observacoesLicenca || '',
    protocolo: project.protocolo || '',
    numeroProcesso: project.numeroProcesso || '',
    tipoPericia: project.tipoPericia || '',
    dataVistoria: project.dataVistoria || ''
  };
};

export const projectFormToPayload = (form: ProjectFormState): ProjetoPayload => {
  const parsedArea = parseLocalizedNumber(form.area);
  const areaHa = parsedArea === null || Number.isNaN(parsedArea)
    ? null
    : form.areaUnit === 'm2' ? parsedArea / 10_000 : parsedArea;
  const latitude = parseLocalizedNumber(form.latitude);
  const longitude = parseLocalizedNumber(form.longitude);

  return {
    nome: form.nome.trim(),
    clienteId: form.clienteId,
    propriedadeId: form.propriedadeId || null,
    descricao: nullable(form.descricao),
    status: form.status || 'Planejamento',
    dataInicio: nullable(form.dataInicio),
    dataEntrega: nullable(form.dataEntrega),
    areaHa,
    matricula: nullable(form.matricula),
    car: nullable(form.car),
    ccir: nullable(form.ccir),
    itr: nullable(form.itr),
    cidade: nullable(form.uf.toUpperCase()),
    municipio: nullable(form.municipio),
    situacaoImovel: nullable(form.situacaoImovel),
    tipo: nullable(form.tipo),
    averbacao: nullable(form.averbacao),
    latitude: latitude === null || Number.isNaN(latitude) ? null : latitude,
    longitude: longitude === null || Number.isNaN(longitude) ? null : longitude,
    possuiMemorialDescritivo: nullable(form.possuiMemorialDescritivo),
    observacoes: nullable(form.observacoes),
    orgaoAmbiental: form.tipo === 'Ambiental' || form.tipo === 'Licenciamento' ? nullable(form.orgaoAmbiental) : null,
    tipoDemanda: form.tipo === 'Ambiental' ? nullable(form.tipoDemanda) : null,
    tipoLicenca: form.tipo === 'Licenciamento' ? nullable(form.tipoLicenca) : null,
    numeroLicenca: form.tipo === 'Licenciamento' ? nullable(form.numeroLicenca) : null,
    dataEmissao: form.tipo === 'Licenciamento' ? nullable(form.dataEmissao) : null,
    dataVencimentoLicenca: form.tipo === 'Licenciamento' ? nullable(form.dataVencimentoLicenca) : null,
    statusLicenca: form.tipo === 'Licenciamento' ? form.statusLicenca as ProjetoPayload['statusLicenca'] : null,
    observacoesLicenca: form.tipo === 'Licenciamento' ? nullable(form.observacoesLicenca) : null,
    protocolo: form.tipo === 'Ambiental' || form.tipo === 'Licenciamento' ? nullable(form.protocolo) : null,
    numeroProcesso: form.tipo === 'Perícia' ? nullable(form.numeroProcesso) : null,
    tipoPericia: form.tipo === 'Perícia' ? nullable(form.tipoPericia) : null,
    dataVistoria: form.tipo === 'Perícia' ? nullable(form.dataVistoria) : null
  };
};

export const validateProjectForm = (form: ProjectFormState) => {
  const payload = projectFormToPayload(form);
  const result = ProjetoPayloadSchema.safeParse(payload);
  const errors: ProjectFormErrors = {};

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const payloadField = issue.path[0];
      const formField = payloadField === 'areaHa' ? 'area' : payloadField;
      if (formField && !errors[formField as keyof ProjectFormState]) {
        errors[formField as keyof ProjectFormState] = issue.message;
      }
    });
  }

  if (form.area.trim() && Number.isNaN(parseLocalizedNumber(form.area))) {
    errors.area = 'Informe uma área válida usando vírgula ou ponto como separador decimal';
  }
  if (form.latitude.trim() && Number.isNaN(parseLocalizedNumber(form.latitude))) {
    errors.latitude = 'Informe a latitude em graus decimais';
  }
  if (form.longitude.trim() && Number.isNaN(parseLocalizedNumber(form.longitude))) {
    errors.longitude = 'Informe a longitude em graus decimais';
  }
  if (Boolean(form.latitude.trim()) !== Boolean(form.longitude.trim())) {
    if (!form.latitude.trim()) errors.latitude = 'Informe a latitude junto com a longitude';
    if (!form.longitude.trim()) errors.longitude = 'Informe a longitude junto com a latitude';
  }
  if (form.dataInicio && form.dataEntrega && form.dataEntrega < form.dataInicio) {
    errors.dataEntrega = 'A previsão de entrega deve ser igual ou posterior à data de início';
  }
  if (form.uf && !/^[A-Za-z]{2}$/.test(form.uf)) {
    errors.uf = 'Informe a UF com duas letras, por exemplo SC';
  }
  if (!form.tipo) {
    errors.tipo = 'Selecione o tipo de projeto ou serviço';
  }
  if (form.tipo === 'Licenciamento') {
    if (!form.tipoLicenca) errors.tipoLicenca = 'Selecione o tipo da licença';
    if (!form.numeroLicenca.trim()) errors.numeroLicenca = 'Informe o número da licença';
    if (!form.orgaoAmbiental.trim()) errors.orgaoAmbiental = 'Informe o órgão ambiental';
    if (!form.dataVencimentoLicenca) errors.dataVencimentoLicenca = 'Informe a data de vencimento';
    if (form.dataEmissao && form.dataVencimentoLicenca && form.dataVencimentoLicenca < form.dataEmissao) {
      errors.dataVencimentoLicenca = 'O vencimento deve ser posterior ou igual à emissão';
    }
  }

  return {
    payload,
    errors,
    valid: result.success && Object.keys(errors).length === 0
  };
};

export const projectFormFingerprint = (form: ProjectFormState) => JSON.stringify(form);

export const projectFieldTab: Partial<Record<keyof ProjectFormState, ProjectModalTab>> = {
  nome: 'projeto',
  clienteId: 'projeto',
  propriedadeId: 'propriedade',
  descricao: 'projeto',
  status: 'projeto',
  dataInicio: 'projeto',
  dataEntrega: 'projeto',
  tipo: 'projeto',
  orgaoAmbiental: 'projeto',
  tipoDemanda: 'projeto',
  tipoLicenca: 'projeto',
  numeroLicenca: 'projeto',
  dataEmissao: 'projeto',
  dataVencimentoLicenca: 'projeto',
  statusLicenca: 'projeto',
  observacoesLicenca: 'projeto',
  protocolo: 'projeto',
  numeroProcesso: 'projeto',
  tipoPericia: 'projeto',
  dataVistoria: 'projeto',
  area: 'propriedade',
  areaUnit: 'propriedade',
  matricula: 'propriedade',
  car: 'propriedade',
  ccir: 'propriedade',
  itr: 'propriedade',
  situacaoImovel: 'propriedade',
  averbacao: 'propriedade',
  uf: 'geoloc',
  municipio: 'geoloc',
  latitude: 'geoloc',
  longitude: 'geoloc',
  possuiMemorialDescritivo: 'geoloc',
  observacoes: 'geoloc'
};
