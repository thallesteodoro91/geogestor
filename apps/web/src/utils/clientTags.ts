export const CLIENT_CATEGORY_OPTIONS = [
  'Pessoa Física',
  'Pessoa Jurídica',
  'Produtor Rural',
  'Empresa',
  'Parceiro',
  'Órgão Público',
  'Indústria',
  'Comércio'
];

export const CLIENT_PROFILE_OPTIONS = [
  'Produtor Rural',
  'Parceiro',
  'Órgão Público',
  'Indústria',
  'Comércio'
];

export const CLIENT_PRIMARY_ORIGIN_OPTIONS = [
  'Site',
  'Indicação',
  'Instagram',
  'Google',
  'WhatsApp',
  'Outro'
];

export const CLIENT_ORIGIN_OPTIONS = [
  'Site',
  'Indicação',
  'Instagram',
  'Google',
  'WhatsApp',
  'Telefone',
  'Evento',
  'Cliente antigo',
  'Outro'
];

export const CLIENT_SERVICOS_BY_CATEGORY = {
  'Agrimensura': [
    'Georreferenciamento',
    'Usucapião',
    'Remembramento',
    'Retificação',
    'Desmembramento'
  ],
  'Topografia': [
    'Topografia',
    'Planialtimétrico',
    'Drone',
    'Lev. Pontos de Inter.',
    'Levantamento GNSS'
  ],
  'Ambiental': [
    'CAR',
    'Licenciamento',
    'Outorga',
    'Laudo Florestal',
    'Supressão Vegetal',
    'PRADA',
    'EIA/RIMA'
  ]
};

export const CLIENT_SERVICOS_OPTIONS = Object.values(CLIENT_SERVICOS_BY_CATEGORY).flat();

export const CLIENT_STATUS_OPTIONS = [
  'Ativo',
  'Em Prospecção',
  'Prospectado',
  'Inativo',
  'Bloqueado'
];

const baseTagClass = 'geo-badge-base';

const normalizeTagValue = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function getClientStatusTagClass(status?: string | null) {
  switch (status) {
    case 'Ativo':
      return `${baseTagClass} geo-badge-success`;
    case 'Em Prospecção':
    case 'Prospectado':
      return `${baseTagClass} geo-badge-primary`;
    case 'Inativo':
      return `${baseTagClass} geo-badge-neutral`;
    case 'Bloqueado':
      return `${baseTagClass} geo-badge-danger`;
    default:
      return `${baseTagClass} geo-badge-neutral`;
  }
}

export function getClientCategoryTagClass(category?: string | null) {
  const normalizedCategory = normalizeTagValue(category);

  if (normalizedCategory.includes('agricultor') || normalizedCategory.includes('agricola') || normalizedCategory.includes('agro') || normalizedCategory.includes('produtor') || normalizedCategory.includes('rural')) {
    return `${baseTagClass} geo-badge-success`;
  }
  if (normalizedCategory.includes('industria')) {
    return `${baseTagClass} geo-badge-primary`;
  }
  if (normalizedCategory.includes('comercio')) {
    return `${baseTagClass} geo-badge-danger`;
  }
  if (normalizedCategory.includes('publico') || normalizedCategory.includes('orgao') || normalizedCategory.includes('prefeitura')) {
    return `${baseTagClass} geo-badge-info`;
  }
  if (normalizedCategory.includes('juridica') || normalizedCategory.includes('empresa')) {
    return `${baseTagClass} geo-badge-primary`;
  }

  switch (category) {
    case 'Pessoa Física':
      return `${baseTagClass} geo-badge-info`;
    case 'Pessoa Jurídica':
    case 'Empresa':
      return `${baseTagClass} geo-badge-primary`;
    case 'Produtor Rural':
      return `${baseTagClass} geo-badge-success`;
    case 'Parceiro':
      return `${baseTagClass} geo-badge-warning`;
    case 'Órgão Público':
      return `${baseTagClass} geo-badge-info`;
    case 'Indústria':
      return `${baseTagClass} geo-badge-primary`;
    case 'Comércio':
      return `${baseTagClass} geo-badge-danger`;
    default:
      return `${baseTagClass} geo-badge-neutral`;
  }
}

export function getClientOriginTagClass(origin?: string | null) {
  switch (origin) {
    case 'Site':
      return `${baseTagClass} geo-badge-primary`;
    case 'Indicação':
      return `${baseTagClass} geo-badge-success`;
    case 'Instagram':
      return `${baseTagClass} geo-badge-primary`;
    case 'Google':
      return `${baseTagClass} geo-badge-warning`;
    case 'WhatsApp':
      return `${baseTagClass} geo-badge-success`;
    case 'Telefone':
      return `${baseTagClass} geo-badge-info`;
    case 'Evento':
      return `${baseTagClass} geo-badge-warning`;
    case 'Cliente antigo':
      return `${baseTagClass} geo-badge-neutral`;
    default:
      return `${baseTagClass} geo-badge-neutral`;
  }
}

export function getClientServicoTagClass(servico?: string | null) {
  if (!servico) return `${baseTagClass} geo-badge-neutral`;

  if (CLIENT_SERVICOS_BY_CATEGORY['Ambiental'].includes(servico)) {
    return `${baseTagClass} geo-badge-success`;
  }
  
  if (CLIENT_SERVICOS_BY_CATEGORY['Topografia'].includes(servico)) {
    return `${baseTagClass} geo-badge-warning`;
  }
  
  if (CLIENT_SERVICOS_BY_CATEGORY['Agrimensura'].includes(servico)) {
    return `${baseTagClass} geo-badge-info`;
  }
  
  return `${baseTagClass} geo-badge-neutral`;
}
