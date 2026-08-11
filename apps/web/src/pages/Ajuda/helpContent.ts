export const HELP_CATEGORY_IDS = [
  'primeiros-passos',
  'comercial',
  'projetos',
  'financeiro',
  'operacional',
  'sistema',
] as const;

export type HelpCategoryId = typeof HELP_CATEGORY_IDS[number];
export type HelpCategoryFilter = 'all' | HelpCategoryId;
export type HelpIconKey = 'start' | 'users' | 'crm' | 'projects' | 'finance' | 'calendar' | 'environment' | 'topography' | 'reports' | 'planning' | 'records' | 'import' | 'quality' | 'audit' | 'documents' | 'backup' | 'alerts';

export interface HelpSection {
  title: string;
  paragraphs?: string[];
  steps?: string[];
  note?: string;
  warning?: string;
}

export interface HelpArticle {
  id: string;
  category: HelpCategoryId;
  title: string;
  excerpt: string;
  keywords: string[];
  route: string;
  routeLabel: string;
  updatedAt: string;
  minimumVersion: string;
  icon: HelpIconKey;
  sections: HelpSection[];
  relatedArticles?: string[];
}

export interface HelpCategory {
  id: HelpCategoryFilter;
  label: string;
  icon: HelpIconKey;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'all', label: 'Todos os guias', icon: 'start' },
  { id: 'primeiros-passos', label: 'Primeiros passos', icon: 'start' },
  { id: 'comercial', label: 'Comercial', icon: 'users' },
  { id: 'projetos', label: 'Projetos', icon: 'projects' },
  { id: 'financeiro', label: 'Financeiro', icon: 'finance' },
  { id: 'operacional', label: 'Operacional', icon: 'topography' },
  { id: 'sistema', label: 'Sistema e segurança', icon: 'backup' },
];

const reviewDate = '2026-08-08';
const minimumVersion = '1.1.3';

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'primeira-configuracao',
    category: 'primeiros-passos',
    title: 'Primeira configuração e pasta de dados',
    excerpt: 'Defina onde o GeoGestor guarda o banco local, documentos e arquivos de trabalho.',
    keywords: ['configuração inicial', 'diretório', 'pasta local', 'sqlite', 'arquivos'],
    route: '/configuracoes?secao=arquivos',
    routeLabel: 'Abrir Arquivos e pastas',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'start',
    sections: [
      {
        title: 'Antes de começar',
        paragraphs: ['Escolha uma pasta local estável, com espaço disponível e permissão de gravação. O GeoGestor continua operando localmente mesmo sem internet.'],
      },
      {
        title: 'Como configurar',
        steps: [
          'Abra Configurações e selecione Arquivos e pastas.',
          'Informe ou selecione o diretório de documentos usado pelo GeoGestor.',
          'Salve a alteração e aguarde a confirmação antes de fechar a tela.',
          'Use Abrir pasta de dados para conferir o local no Explorador de Arquivos.',
        ],
        warning: 'Não mova manualmente o banco ou a pasta de dados enquanto o GeoGestor estiver aberto.',
      },
    ],
    relatedArticles: ['backup-recuperacao', 'clientes-propriedades'],
  },
  {
    id: 'clientes-propriedades',
    category: 'comercial',
    title: 'Clientes e propriedades',
    excerpt: 'Cadastre o cliente e organize os imóveis que serão vinculados aos trabalhos.',
    keywords: ['cliente', 'propriedade', 'imóvel', 'matrícula', 'car', 'documentos'],
    route: '/clientes',
    routeLabel: 'Abrir Clientes',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'users',
    sections: [
      {
        title: 'Cadastrar um cliente',
        steps: [
          'Abra Comercial e acesse Clientes.',
          'Selecione Novo cliente.',
          'Preencha a identificação e os dados de contato necessários.',
          'Selecione Salvar cliente e abra o cadastro para consultar o histórico consolidado.',
        ],
      },
      {
        title: 'Cadastrar uma propriedade',
        steps: [
          'Abra Cadastros e acesse Propriedades.',
          'Selecione Novo cadastro de propriedade.',
          'Vincule o cliente, informe o nome do imóvel e complete matrícula, CAR e localização quando disponíveis.',
          'Selecione Criar propriedade.',
        ],
        note: 'Cadastre a propriedade antes de vinculá-la a projetos, orçamentos e registros ambientais.',
      },
    ],
    relatedArticles: ['projetos-checklist', 'orcamentos-aprovacao'],
  },
  {
    id: 'crm-oportunidades',
    category: 'comercial',
    title: 'CRM e oportunidades',
    excerpt: 'Acompanhe negociações da prospecção ao ganho ou à perda.',
    keywords: ['crm', 'lead', 'funil', 'oportunidade', 'proposta', 'ganho', 'perdido'],
    route: '/crm',
    routeLabel: 'Abrir CRM',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'crm',
    sections: [
      {
        title: 'Criar e acompanhar',
        steps: [
          'Abra Comercial e acesse CRM.',
          'Selecione Nova oportunidade e vincule um cliente ou lead.',
          'Informe título, valor previsto, responsável e próxima ação.',
          'Mova a oportunidade entre Prospectado, Contato e Proposta conforme a negociação avançar.',
          'Use as ações do cartão para registrar o ganho ou informar o motivo da perda.',
        ],
        note: 'Uma oportunidade ganha pode ser convertida em projeto. Se existir orçamento vinculado, ele precisa estar aprovado.',
      },
    ],
    relatedArticles: ['orcamentos-aprovacao', 'projetos-checklist'],
  },
  {
    id: 'projetos-checklist',
    category: 'projetos',
    title: 'Projetos e checklist operacional',
    excerpt: 'Organize dados técnicos, documentos, tarefas e o andamento do serviço.',
    keywords: ['projeto', 'checklist', 'tarefas', 'matrícula', 'car', 'ccir', 'itr', 'coordenadas'],
    route: '/projetos',
    routeLabel: 'Abrir Projetos',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'projects',
    sections: [
      {
        title: 'Criar o projeto',
        steps: [
          'Abra Projetos e selecione Criar projeto.',
          'Vincule cliente e propriedade e preencha os dados técnicos disponíveis.',
          'Informe matrícula, CAR, CCIR, ITR e coordenadas em SIRGAS 2000 quando aplicável.',
          'Salve e abra os detalhes do projeto.',
        ],
      },
      {
        title: 'Controlar a execução',
        steps: [
          'Na área Checklist, inclua as tarefas necessárias para o trabalho.',
          'Marque cada item à medida que for concluído.',
          'Use Abrir Pasta do Projeto para acessar os arquivos locais relacionados.',
        ],
      },
    ],
    relatedArticles: ['agenda-tarefas', 'topografia-calculos'],
  },
  {
    id: 'orcamentos-aprovacao',
    category: 'financeiro',
    title: 'Orçamentos, PDF e aprovação',
    excerpt: 'Crie propostas, gere o PDF e aprove o orçamento com efeitos financeiros controlados.',
    keywords: ['orçamento', 'proposta', 'pdf', 'aprovação', 'parcelas', 'pagamento'],
    route: '/orcamentos',
    routeLabel: 'Abrir Orçamentos',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'finance',
    sections: [
      {
        title: 'Preparar a proposta',
        steps: [
          'Abra Comercial e acesse Orçamentos.',
          'Crie uma proposta e vincule cliente, propriedade e serviços.',
          'Revise valores, descontos, custos internos e forma de pagamento.',
          'Abra os detalhes e selecione Gerar PDF para produzir o documento do cliente.',
        ],
      },
      {
        title: 'Aprovar com segurança',
        steps: [
          'Nos detalhes do orçamento, selecione Aprovar.',
          'Vincule um projeto existente ou informe o nome do novo projeto.',
          'Revise o cronograma de parcelas e selecione Aprovar e gerar efeitos.',
        ],
        warning: 'A aprovação cria contas a receber previstas. O caixa realizado só muda quando um recebimento é efetivamente registrado.',
      },
    ],
    relatedArticles: ['contas-receber', 'modelos-documentos'],
  },
  {
    id: 'contas-receber',
    category: 'financeiro',
    title: 'Contas a receber',
    excerpt: 'Acompanhe parcelas previstas e registre recebimentos confirmados.',
    keywords: ['faturas', 'parcelas', 'recebimento', 'receita', 'caixa'],
    route: '/financeiro?tab=faturas',
    routeLabel: 'Abrir Contas a receber',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'finance',
    sections: [
      {
        title: 'Registrar um recebimento',
        steps: [
          'Abra Financeiro e selecione Contas a receber.',
          'Localize a parcela pelo cliente, vencimento ou situação.',
          'Abra a ação de recebimento e informe valor e data efetivamente recebidos.',
          'Confirme e consulte o histórico da parcela.',
        ],
        note: 'Valores previstos e valores recebidos são apresentados separadamente para preservar a leitura correta do caixa.',
      },
    ],
    relatedArticles: ['orcamentos-aprovacao', 'relatorios-exportacao'],
  },
  {
    id: 'contas-pagar',
    category: 'financeiro',
    title: 'Contas a pagar',
    excerpt: 'Registre despesas, pagamentos e custos associados a clientes ou projetos.',
    keywords: ['despesa', 'contas a pagar', 'custo', 'pagamento', 'reembolso'],
    route: '/financeiro?tab=pagar',
    routeLabel: 'Abrir Contas a pagar',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'finance',
    sections: [
      {
        title: 'Lançar uma despesa',
        steps: [
          'Abra Financeiro e selecione Contas a pagar.',
          'Use Novo lançamento e escolha Nova despesa.',
          'Informe descrição, valor, vencimento e categoria.',
          'Vincule cliente ou projeto quando o custo fizer parte de um trabalho específico.',
          'Salve e registre o pagamento somente quando ele ocorrer.',
        ],
      },
    ],
    relatedArticles: ['cadastros-auxiliares', 'relatorios-exportacao'],
  },
  {
    id: 'agenda-tarefas',
    category: 'operacional',
    title: 'Agenda e tarefas',
    excerpt: 'Organize compromissos, prazos e tarefas operacionais.',
    keywords: ['agenda', 'calendário', 'tarefa', 'prazo', 'compromisso'],
    route: '/calendario',
    routeLabel: 'Abrir Agenda',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'calendar',
    sections: [
      {
        title: 'Planejar o trabalho',
        steps: [
          'Abra Agenda para consultar os compromissos no calendário.',
          'Selecione Novo compromisso e informe data, horário e vínculo operacional.',
          'Abra Tarefas para criar atividades com responsável, prioridade e prazo.',
          'Atualize a situação da tarefa conforme a execução avançar.',
        ],
        note: 'Tarefas também podem aparecer em checklists de clientes e projetos quando possuem vínculo correspondente.',
      },
    ],
    relatedArticles: ['projetos-checklist', 'alertas-notificacoes'],
  },
  {
    id: 'ambiental-licenciamento',
    category: 'operacional',
    title: 'Ambiental e licenciamento',
    excerpt: 'Controle demandas ambientais, licenças, condicionantes e análise preliminar do CAR.',
    keywords: ['ambiental', 'licenciamento', 'licença', 'condicionante', 'car', 'perícia'],
    route: '/ambiental',
    routeLabel: 'Abrir Ambiental',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'environment',
    sections: [
      {
        title: 'Escolher a área correta',
        steps: [
          'Use Demandas Ambientais para processos, perícias, fases e próximas ações.',
          'Use Licenciamento para licenças, renovações, condicionantes e vencimentos.',
          'Use Análise CAR para uma triagem quantitativa preliminar da Reserva Legal.',
        ],
        warning: 'A Análise CAR é uma triagem e não substitui a análise técnica ou a validação do órgão ambiental competente.',
      },
      {
        title: 'Cadastrar',
        steps: [
          'Escolha a aba desejada.',
          'Selecione Nova demanda ou Nova licença.',
          'Vincule cliente, propriedade ou projeto quando aplicável.',
          'Registre prazos e próximas ações para alimentar os alertas operacionais.',
        ],
      },
    ],
    relatedArticles: ['alertas-notificacoes', 'clientes-propriedades'],
  },
  {
    id: 'topografia-calculos',
    category: 'operacional',
    title: 'Topografia e cálculos',
    excerpt: 'Use as calculadoras e registre resultados técnicos de forma organizada.',
    keywords: ['topografia', 'coordenadas', 'azimute', 'distância', 'área', 'perímetro', 'conversor'],
    route: '/topografia',
    routeLabel: 'Abrir Topografia',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'topography',
    sections: [
      {
        title: 'Executar um cálculo',
        steps: [
          'Abra Topografia e escolha a ferramenta necessária.',
          'Informe as coordenadas ou medidas no formato solicitado.',
          'Revise o sistema de referência e as unidades antes de calcular.',
          'Selecione Salvar cálculo quando quiser manter o resultado no histórico.',
        ],
        warning: 'Confira datum, hemisfério e unidade. Um resultado matematicamente válido pode estar incorreto se a referência informada não corresponder ao levantamento.',
      },
    ],
    relatedArticles: ['projetos-checklist', 'relatorios-exportacao'],
  },
  {
    id: 'relatorios-exportacao',
    category: 'operacional',
    title: 'Relatórios e exportação',
    excerpt: 'Aplique filtros, revise indicadores e exporte documentos em PDF.',
    keywords: ['relatório', 'pdf', 'indicadores', 'filtros', 'exportar', 'imprimir'],
    route: '/relatorios',
    routeLabel: 'Abrir Relatórios',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'reports',
    sections: [
      {
        title: 'Gerar um relatório',
        steps: [
          'Abra Relatórios e escolha o tipo de análise.',
          'Defina o período e os filtros necessários.',
          'Revise indicadores, comparações e tabelas exibidos na tela.',
          'Selecione Exportar PDF para gerar o arquivo com o mesmo recorte.',
        ],
        note: 'Se o documento não refletir o esperado, revise os filtros e a identidade visual configurada antes de exportar novamente.',
      },
    ],
    relatedArticles: ['modelos-documentos', 'qualidade-dados'],
  },
  {
    id: 'planejamento-estrategico',
    category: 'operacional',
    title: 'Planejamento estratégico',
    excerpt: 'Registre objetivos, indicadores, iniciativas e acompanhamento periódico.',
    keywords: ['planejamento', 'objetivo', 'indicador', 'meta', 'iniciativa', 'estratégia'],
    route: '/planejamento',
    routeLabel: 'Abrir Planejamento',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'planning',
    sections: [
      {
        title: 'Criar um objetivo',
        steps: [
          'Abra Planejamento e selecione Novo objetivo.',
          'Informe título, perspectiva, período e responsável.',
          'Adicione indicadores e iniciativas mensuráveis.',
          'Atualize o progresso nas revisões periódicas.',
        ],
        note: 'Use metas objetivas e uma frequência de revisão compatível com o ciclo de trabalho da empresa.',
      },
    ],
    relatedArticles: ['relatorios-exportacao', 'agenda-tarefas'],
  },
  {
    id: 'cadastros-auxiliares',
    category: 'sistema',
    title: 'Cadastros auxiliares',
    excerpt: 'Padronize tipos de serviço e categorias de despesa usados nos formulários.',
    keywords: ['cadastros', 'serviço', 'categoria', 'despesa', 'catálogo'],
    route: '/cadastros',
    routeLabel: 'Abrir Cadastros',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'records',
    sections: [
      {
        title: 'Manter os catálogos',
        steps: [
          'Abra Cadastros.',
          'Escolha Tipos de serviço ou Categorias de despesa.',
          'Selecione Novo tipo de serviço ou Nova categoria de despesa.',
          'Informe um nome claro e mantenha ativos apenas os itens que devem aparecer nos formulários.',
        ],
      },
    ],
    relatedArticles: ['contas-pagar', 'orcamentos-aprovacao'],
  },
  {
    id: 'importacao-dados',
    category: 'sistema',
    title: 'Importação de dados',
    excerpt: 'Importe clientes ou projetos por CSV e XLSX com validação antes da gravação.',
    keywords: ['importação', 'csv', 'xlsx', 'planilha', 'mapeamento', 'esquema'],
    route: '/importacao',
    routeLabel: 'Abrir Importação de dados',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'import',
    sections: [
      {
        title: 'Importar uma planilha',
        steps: [
          'Abra Configurações e selecione Importação de dados.',
          'Escolha Clientes ou Projetos e carregue um arquivo CSV ou XLSX.',
          'Confirme o mapeamento entre as colunas da planilha e os campos do GeoGestor.',
          'Revise a prévia e corrija os registros inválidos.',
          'Confirme a gravação somente depois que a validação estiver satisfatória.',
        ],
        note: 'O esquema de colunas é salvo após a importação e pode ser consultado em Esquemas salvos.',
      },
    ],
    relatedArticles: ['qualidade-dados', 'backup-recuperacao'],
  },
  {
    id: 'qualidade-dados',
    category: 'sistema',
    title: 'Qualidade dos dados',
    excerpt: 'Localize cadastros incompletos ou inconsistentes antes de gerar documentos e análises.',
    keywords: ['qualidade', 'inconsistência', 'cadastro incompleto', 'validação', 'diagnóstico'],
    route: '/qualidade-dados',
    routeLabel: 'Abrir Qualidade dos dados',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'quality',
    sections: [
      {
        title: 'Revisar pendências',
        steps: [
          'Abra Configurações e selecione Qualidade dos dados.',
          'Revise os grupos de inconsistências apresentados.',
          'Abra o cadastro indicado e complete ou corrija as informações.',
          'Volte à análise para confirmar que a pendência foi resolvida.',
        ],
        note: 'Faça esta revisão antes de relatórios executivos, importações amplas ou emissão de documentos para clientes.',
      },
    ],
    relatedArticles: ['importacao-dados', 'relatorios-exportacao'],
  },
  {
    id: 'logs-auditoria',
    category: 'sistema',
    title: 'Logs de auditoria',
    excerpt: 'Consulte alterações importantes, autoria, origem e comparação de valores.',
    keywords: ['logs', 'auditoria', 'histórico', 'antes', 'depois', 'alterações'],
    route: '/audit-logs',
    routeLabel: 'Abrir Logs de auditoria',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'audit',
    sections: [
      {
        title: 'Consultar uma alteração',
        steps: [
          'Abra Configurações e, em Ferramentas, selecione Logs de auditoria.',
          'Use os filtros para localizar data, entidade ou tipo de ação.',
          'Abra o registro para comparar os valores anteriores e posteriores.',
          'Use data, origem e usuário para contextualizar o evento.',
        ],
        note: 'Os logs ajudam na rastreabilidade, mas não substituem uma política de backup e recuperação.',
      },
    ],
    relatedArticles: ['backup-recuperacao', 'qualidade-dados'],
  },
  {
    id: 'modelos-documentos',
    category: 'sistema',
    title: 'Modelos de documentos',
    excerpt: 'Configure identidade visual, cabeçalho e termos padrão dos PDFs.',
    keywords: ['modelo', 'documento', 'logo', 'cores', 'cabeçalho', 'termos', 'pdf'],
    route: '/configuracoes?secao=modelos',
    routeLabel: 'Abrir Modelos e documentos',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'documents',
    sections: [
      {
        title: 'Configurar o modelo oficial',
        steps: [
          'Abra Configurações e selecione Modelos e documentos.',
          'Informe nome, dados corporativos, endereço e termos padrão.',
          'Escolha as cores e carregue a identidade visual quando necessário.',
          'Revise a Prévia do cabeçalho e salve as alterações.',
          'Gere um PDF de teste antes de enviar um documento ao cliente.',
        ],
      },
    ],
    relatedArticles: ['orcamentos-aprovacao', 'relatorios-exportacao'],
  },
  {
    id: 'backup-recuperacao',
    category: 'sistema',
    title: 'Backup, restauração e recuperação',
    excerpt: 'Configure cópias de segurança e valide a recuperação antes de precisar dela.',
    keywords: ['backup', 'restauração', 'recuperação', 'retenção', 'checksum', 'segurança'],
    route: '/configuracoes?secao=backups',
    routeLabel: 'Abrir Backups',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'backup',
    sections: [
      {
        title: 'Configurar a proteção',
        steps: [
          'Abra Configurações e selecione Backups.',
          'Defina destino, frequência e retenção das cópias.',
          'Prefira um destino diferente da pasta de dados principal.',
          'Salve a política e confira o indicador de status do backup.',
        ],
      },
      {
        title: 'Validar a recuperação',
        steps: [
          'Na mesma seção, localize Restaurar e testar backup.',
          'Selecione uma cópia e execute o teste isolado de integridade.',
          'Confira o resultado antes de considerar o backup confiável.',
        ],
        warning: 'Não substitua a base ativa por uma cópia sem confirmar a origem, a data e o resultado da validação.',
      },
    ],
    relatedArticles: ['primeira-configuracao', 'logs-auditoria'],
  },
  {
    id: 'alertas-notificacoes',
    category: 'sistema',
    title: 'Alertas e notificações',
    excerpt: 'Configure antecedência e recorrência para prazos operacionais importantes.',
    keywords: ['alerta', 'notificação', 'prazo', 'vencimento', 'recorrência', 'lembrete'],
    route: '/configuracoes?secao=alertas',
    routeLabel: 'Abrir Alertas',
    updatedAt: reviewDate,
    minimumVersion,
    icon: 'alerts',
    sections: [
      {
        title: 'Configurar alertas',
        steps: [
          'Abra Configurações e selecione Alertas.',
          'Defina a antecedência e a recorrência desejadas.',
          'Salve as alterações.',
          'Use o centro de notificações para consultar prazos detectados pelo sistema.',
        ],
        note: 'Alertas dependem de datas válidas nos projetos, tarefas, licenças, condicionantes e registros financeiros.',
      },
    ],
    relatedArticles: ['agenda-tarefas', 'ambiental-licenciamento'],
  },
];

export const DEFAULT_RECOMMENDED_ARTICLE_IDS = [
  'primeira-configuracao',
  'backup-recuperacao',
  'importacao-dados',
];

export function isHelpCategory(value: string | null): value is HelpCategoryId {
  return HELP_CATEGORY_IDS.includes(value as HelpCategoryId);
}

export function normalizeHelpText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function helpArticleSearchText(article: HelpArticle) {
  return normalizeHelpText([
    article.title,
    article.excerpt,
    ...article.keywords,
    ...article.sections.flatMap((section) => [
      section.title,
      ...(section.paragraphs ?? []),
      ...(section.steps ?? []),
      section.note ?? '',
      section.warning ?? '',
    ]),
  ].join(' '));
}

export function filterHelpArticles(
  articles: HelpArticle[],
  category: HelpCategoryFilter,
  query: string,
) {
  const normalizedQuery = normalizeHelpText(query);
  return articles.filter((article) => {
    const matchesCategory = category === 'all' || article.category === category;
    return matchesCategory && (!normalizedQuery || helpArticleSearchText(article).includes(normalizedQuery));
  });
}

export function getHelpArticle(id: string | null) {
  return id ? HELP_ARTICLES.find((article) => article.id === id) ?? null : null;
}

export function buildHelpArticleSearch(article: HelpArticle, query = '') {
  const params = new URLSearchParams();
  params.set('categoria', article.category);
  params.set('artigo', article.id);
  if (query.trim()) params.set('q', query.trim());
  return params;
}
