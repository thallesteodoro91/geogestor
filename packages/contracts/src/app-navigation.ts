const encodeSegment = (value: string) => encodeURIComponent(value);

type QueryValue = string | number | boolean | null | undefined;

export function withAppQuery(
  path: string,
  query: Record<string, QueryValue>,
  currentSearch = ''
) {
  const search = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') search.delete(key);
    else search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function withQuery(path: string, entries: Array<[string, string]>) {
  return withAppQuery(path, Object.fromEntries(entries));
}

export const APP_ROUTES = {
  setup: { id: 'setup', path: '/configuracoes-iniciais', label: 'Configuração inicial', availability: 'setup' },
  dashboard: { id: 'dashboard', path: '/', label: 'Visão Geral', availability: 'authenticated' },
  clients: { id: 'clients', path: '/clientes', label: 'Clientes', availability: 'authenticated' },
  clientDetails: { id: 'clientDetails', path: '/clientes/:id', label: 'Detalhes do cliente', availability: 'authenticated' },
  projects: { id: 'projects', path: '/projetos', label: 'Projetos', availability: 'authenticated' },
  projectDetails: { id: 'projectDetails', path: '/projetos/:id', label: 'Detalhes do projeto', availability: 'authenticated' },
  budgets: { id: 'budgets', path: '/orcamentos', label: 'Orçamentos', availability: 'authenticated' },
  budgetNew: { id: 'budgetNew', path: '/orcamentos/novo', label: 'Novo orçamento', availability: 'authenticated' },
  budgetEdit: { id: 'budgetEdit', path: '/orcamentos/:id/editar', label: 'Editar orçamento', availability: 'authenticated' },
  finance: { id: 'finance', path: '/financeiro', label: 'Financeiro', availability: 'authenticated' },
  importData: { id: 'importData', path: '/importacao', label: 'Importação', availability: 'authenticated' },
  importSchemas: { id: 'importSchemas', path: '/importacao/esquemas', label: 'Esquemas de importação', availability: 'authenticated' },
  tasks: { id: 'tasks', path: '/tarefas', label: 'Tarefas', availability: 'authenticated' },
  reports: { id: 'reports', path: '/relatorios', label: 'Relatórios', availability: 'authenticated' },
  topography: { id: 'topography', path: '/topografia', label: 'Topografia', availability: 'authenticated' },
  environmental: { id: 'environmental', path: '/ambiental', label: 'Ambiental', availability: 'authenticated' },
  licenseDetails: { id: 'licenseDetails', path: '/ambiental/licencas/:id', label: 'Detalhes da licença', availability: 'authenticated' },
  environmentalDetails: { id: 'environmentalDetails', path: '/ambiental/:id', label: 'Detalhes ambientais', availability: 'authenticated' },
  calendar: { id: 'calendar', path: '/calendario', label: 'Agenda', availability: 'authenticated' },
  calendarDetails: { id: 'calendarDetails', path: '/calendario/:tipo/:id', label: 'Detalhes da agenda', availability: 'authenticated' },
  crm: { id: 'crm', path: '/crm', label: 'CRM', availability: 'authenticated' },
  settings: { id: 'settings', path: '/configuracoes', label: 'Configurações', availability: 'authenticated' },
  auxiliaryRecords: { id: 'auxiliaryRecords', path: '/cadastros', label: 'Cadastros', availability: 'authenticated' },
  properties: { id: 'properties', path: '/propriedades', label: 'Propriedades', availability: 'authenticated' },
  dataQuality: { id: 'dataQuality', path: '/qualidade-dados', label: 'Qualidade dos dados', availability: 'authenticated' },
  postUpdate: { id: 'postUpdate', path: '/pos-atualizacao', label: 'Pós-atualização', availability: 'authenticated' },
  auditLogs: { id: 'auditLogs', path: '/audit-logs', label: 'Auditoria', availability: 'authenticated' },
  help: { id: 'help', path: '/ajuda', label: 'Ajuda', availability: 'authenticated' },
  planning: { id: 'planning', path: '/planejamento', label: 'Planejamento', availability: 'authenticated' }
} as const;

export type AppRouteId = keyof typeof APP_ROUTES;
export type AppRouteDefinition = (typeof APP_ROUTES)[AppRouteId];

/** Compatibilidade para consumidores que já usam nomes curtos de caminhos. */
export const APP_PATHS = {
  clients: APP_ROUTES.clients.path,
  clientDetails: APP_ROUTES.clientDetails.path,
  projects: APP_ROUTES.projects.path,
  projectDetails: APP_ROUTES.projectDetails.path,
  tasks: APP_ROUTES.tasks.path,
  budgets: APP_ROUTES.budgets.path,
  budgetNew: APP_ROUTES.budgetNew.path,
  budgetEdit: APP_ROUTES.budgetEdit.path,
  finance: APP_ROUTES.finance.path,
  licenseDetails: APP_ROUTES.licenseDetails.path,
  calendarDetails: APP_ROUTES.calendarDetails.path,
  crm: APP_ROUTES.crm.path
} as const;

export const APP_ROUTE_PATTERNS = Object.freeze(
  Object.values(APP_ROUTES).map((route) => route.path)
);

export const APP_QUERY_KEYS = {
  task: 'tarefaId',
  receivable: 'parcela',
  payable: 'despesa',
  condition: 'condicionante',
  opportunity: 'oportunidade'
} as const;

export const APP_LEGACY_REDIRECTS = [
  { id: 'contacts', from: '/contatos', to: withQuery(APP_ROUTES.crm.path, [['view', 'leads']]), status: 'compatible', risk: 'medium', minimumVersion: '1.0.0', removalCondition: 'Confirmar ausência de favoritos antigos e integrações externas.' },
  { id: 'financeDashboard', from: '/dashboard-financeiro', to: APP_ROUTES.finance.path, status: 'compatible', risk: 'medium', minimumVersion: '1.0.0', removalCondition: 'Confirmar ausência de atalhos externos persistidos.' },
  { id: 'financeManagement', from: '/gestao-financeira', to: withQuery(APP_ROUTES.finance.path, [['tab', 'auxiliares']]), status: 'compatible', risk: 'medium', minimumVersion: '1.0.0', removalCondition: 'Inventariar favoritos e documentação antigos e anunciar uma janela de retirada.' },
  { id: 'expenses', from: '/despesas', to: withQuery(APP_ROUTES.finance.path, [['tab', 'pagar']]), status: 'compatible', risk: 'high', minimumVersion: '1.0.0', removalCondition: 'Comprovar ausência de alertas e favoritos financeiros persistidos.' },
  { id: 'operational', from: '/operacional', to: withQuery(APP_ROUTES.projects.path, [['visualizacao', 'estatisticas']]), status: 'compatible', risk: 'medium', minimumVersion: '1.0.0', removalCondition: 'Confirmar ausência de atalhos operacionais externos.' },
  { id: 'environmentalCalculator', from: '/calculadora-ambiental', to: withQuery(APP_ROUTES.environmental.path, [['tab', 'car']]), status: 'compatible', risk: 'medium', minimumVersion: '1.0.0', removalCondition: 'Confirmar migração dos favoritos da calculadora antiga.' },
  { id: 'licensing', from: '/licenciamento', to: withQuery(APP_ROUTES.environmental.path, [['tab', 'licenciamento']]), status: 'compatible', risk: 'high', minimumVersion: '1.0.0', removalCondition: 'Comprovar ausência de links persistidos para licenciamento.' },
  { id: 'invoices', from: '/faturas', to: withQuery(APP_ROUTES.finance.path, [['tab', 'faturas']]), status: 'compatible', risk: 'high', minimumVersion: '1.0.0', removalCondition: 'Comprovar ausência de alertas e favoritos financeiros persistidos.' },
  { id: 'executiveReport', from: '/relatorio-executivo', to: withQuery(APP_ROUTES.reports.path, [['tipo', 'executivo']]), status: 'compatible', risk: 'high', minimumVersion: '1.0.0', removalCondition: 'Migrar documentos e favoritos suportados antes da retirada.' }
] as const;

export const appLinks = {
  settings: (section: string, focus?: string) => withAppQuery(
    APP_ROUTES.settings.path,
    { secao: section, foco: focus }
  ),
  client: (id: string) => `/clientes/${encodeSegment(id)}`,
  project: (id: string) => `/projetos/${encodeSegment(id)}`,
  task: (id: string) => withQuery(APP_PATHS.tasks, [[APP_QUERY_KEYS.task, id]]),
  receivable: (id: string) => withQuery(APP_PATHS.finance, [['tab', 'faturas'], [APP_QUERY_KEYS.receivable, id]]),
  payable: (id: string) => withQuery(APP_PATHS.finance, [['tab', 'pagar'], [APP_QUERY_KEYS.payable, id]]),
  budgetEdit: (id: string) => `/orcamentos/${encodeSegment(id)}/editar`,
  license: (id: string) => `/ambiental/licencas/${encodeSegment(id)}`,
  condition: (licenseId: string, conditionId: string) => withQuery(
    `/ambiental/licencas/${encodeSegment(licenseId)}`,
    [['tab', 'conditions'], [APP_QUERY_KEYS.condition, conditionId]]
  ),
  appointment: (id: string) => `/calendario/compromisso/${encodeSegment(id)}`,
  opportunity: (id: string) => withQuery(APP_PATHS.crm, [[APP_QUERY_KEYS.opportunity, id]])
} as const;

export function isInternalAppLink(value: string) {
  return value.startsWith('/') && !value.startsWith('//');
}

export function isExternalNavigation(value: string) {
  return /^(?:https?:|mailto:|tel:)/i.test(value);
}

/** Preserva os parâmetros de links antigos sem permitir que substituam o destino canônico. */
export function resolveLegacyRedirect(target: string, currentSearch: string) {
  const [pathname, targetSearch = ''] = target.split('?');
  const merged = new URLSearchParams(currentSearch);
  new URLSearchParams(targetSearch).forEach((value, key) => merged.set(key, value));
  const search = merged.toString();
  return search ? `${pathname}?${search}` : pathname;
}
