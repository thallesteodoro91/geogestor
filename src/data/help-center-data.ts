import {
  Rocket,
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  ClipboardList,
  Briefcase,
  FileBarChart,
  Receipt,
  CalendarDays,
  Users,
  MapPin,
  FileUp,
  BarChart3,
  Bot,
  Lightbulb,
  Bell,
  FileSpreadsheet,
  Settings,
  UserCircle,
  UsersRound,
  BellRing,
  Calendar,
  FileText,
  CreditCard,
  ScrollText,
} from "lucide-react";

export interface HelpTopic {
  id: string;
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
  warnings?: string[];
  commonErrors?: string[];
}

export interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  image?: string;
  description: string;
  topics: HelpTopic[];
  relatedSections?: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  emoji: string;
  sections: HelpSection[];
}

export const helpCategories: HelpCategory[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    emoji: "🚀",
    sections: [
      {
        id: "criando-conta",
        title: "Criando sua conta",
        icon: Rocket,
        description: "Configure sua conta e comece a usar o GeoGestor em minutos.",
        topics: [
          {
            id: "criar-conta",
            title: "Como criar sua conta",
            description: "Registre-se no GeoGestor e acesse o painel principal.",
            steps: [
              "Acesse a página de login do GeoGestor",
              "Clique em **Criar conta**",
              "Preencha seu e-mail e crie uma senha segura",
              "Verifique seu e-mail clicando no link de confirmação",
              "Faça login com suas credenciais",
            ],
            tips: [
              "Use um e-mail profissional para facilitar a identificação pela equipe.",
              "A senha deve ter no mínimo 6 caracteres.",
            ],
            warnings: [
              "Sem confirmar o e-mail, você não conseguirá fazer login.",
            ],
          },
          {
            id: "primeiro-acesso",
            title: "Seu primeiro acesso",
            description: "Entenda o que fazer logo após entrar no sistema.",
            steps: [
              "Após o login, você verá o **Dashboard principal**",
              "Acesse **Configurações** no menu lateral para configurar sua empresa",
              "Cadastre os **Tipos de Serviço** e **Categorias de Despesa** em **Cadastros**",
              "Adicione seus primeiros **Clientes** e **Propriedades**",
            ],
            tips: [
              "Siga esta ordem para que todos os dashboards funcionem corretamente desde o início.",
            ],
          },
        ],
        relatedSections: ["configurando-empresa", "cadastros-iniciais"],
      },
      {
        id: "configurando-empresa",
        title: "Configurando a empresa",
        icon: Settings,
        image: "/help/configuracoes.png",
        description: "Defina os dados financeiros e visuais da sua empresa.",
        topics: [
          {
            id: "dados-empresa",
            title: "Informações da empresa",
            description: "Configure nome, receita base e custos para alimentar os dashboards.",
            steps: [
              "Acesse **Configurações** no menu lateral",
              "Na aba **Empresa**, preencha o nome da empresa",
              "Informe os dados financeiros base: receita, custos fixos e variáveis",
              "Clique em **Salvar**",
            ],
            tips: [
              "Esses valores são usados como referência nos cálculos de ponto de equilíbrio e margem.",
            ],
            warnings: [
              "Sem configurar a empresa, os dashboards financeiros ficarão zerados.",
            ],
          },
          {
            id: "template-orcamento",
            title: "Personalizando o template de orçamento",
            description: "Customize o PDF dos orçamentos com logo e dados da empresa.",
            steps: [
              "Em **Configurações**, role até **Template de Orçamento**",
              "Faça upload do logo da empresa (PNG ou JPG)",
              "Configure os textos de rodapé e informações adicionais",
              "Visualize o resultado no preview",
            ],
            tips: [
              "Use uma imagem com fundo transparente (PNG) para melhor resultado.",
            ],
          },
        ],
        relatedSections: ["criando-conta", "equipe-permissoes"],
      },
      {
        id: "cadastros-iniciais",
        title: "Cadastrando dados iniciais",
        icon: FileText,
        description: "Preencha a base de dados essencial antes de usar o sistema.",
        topics: [
          {
            id: "tipos-servico",
            title: "Cadastrar Tipos de Serviço",
            description: "Defina os serviços que sua empresa oferece.",
            steps: [
              "Acesse **Cadastros** no menu lateral",
              "Clique na aba **Tipos de Serviço**",
              "Clique em **Novo Tipo de Serviço**",
              "Informe: nome, categoria, valor sugerido e descrição",
              "Clique em **Salvar**",
            ],
            tips: [
              "Exemplos: Georreferenciamento, Desmembramento, Topografia, Levantamento Planimétrico.",
              "O valor sugerido é preenchido automaticamente ao criar orçamentos.",
            ],
          },
          {
            id: "categorias-despesa",
            title: "Cadastrar Categorias de Despesa",
            description: "Organize os tipos de gasto para relatórios precisos.",
            steps: [
              "Em **Cadastros**, clique na aba **Tipos de Despesa**",
              "Clique em **Novo Tipo de Despesa**",
              "Preencha: categoria, subcategoria e classificação (fixa ou variável)",
              "Clique em **Salvar**",
            ],
            tips: [
              "Exemplos de categorias: Combustível, Equipamentos, Mão de Obra, Material de Escritório.",
              "A classificação fixa/variável é usada no cálculo da margem de contribuição.",
            ],
          },
          {
            id: "importacao-csv",
            title: "Importação em massa via CSV",
            description: "Cadastre muitos registros de uma vez a partir de planilhas.",
            steps: [
              "Em **Cadastros**, clique no botão **Importar CSV**",
              "Selecione o arquivo CSV da sua planilha",
              "O sistema mapeia automaticamente as colunas detectadas",
              "Revise o mapeamento e ajuste se necessário",
              "Confirme a importação",
            ],
            tips: [
              "Exporte sua planilha do Excel como CSV (UTF-8) para evitar problemas com acentos.",
            ],
            warnings: [
              "Verifique se os dados não têm linhas duplicadas antes de importar.",
            ],
            commonErrors: [
              "Colunas não reconhecidas: verifique se os nomes das colunas estão corretos.",
              "Erro de encoding: salve o CSV como UTF-8.",
            ],
          },
        ],
        relatedSections: ["criando-conta", "configurando-empresa"],
      },
      {
        id: "equipe-permissoes",
        title: "Equipe e permissões",
        icon: UsersRound,
        description: "Convide membros e controle o que cada um pode fazer.",
        topics: [
          {
            id: "convidar-membro",
            title: "Convidando membros da equipe",
            description: "Adicione colaboradores para trabalharem juntos no sistema.",
            steps: [
              "Acesse **Configurações** → aba **Equipe**",
              "Clique em **Convidar Membro**",
              "Informe o e-mail do colaborador",
              "Selecione a função: **Admin**, **Membro** ou **Visualizador**",
              "Clique em **Enviar Convite**",
            ],
            tips: [
              "O convidado receberá um e-mail com link para aceitar e criar a conta.",
              "Você pode reenviar convites pendentes a qualquer momento.",
            ],
          },
          {
            id: "funcoes-permissoes",
            title: "Entendendo as funções",
            description: "Saiba o que cada tipo de usuário pode fazer no sistema.",
            steps: [
              "**Admin** — Acesso total: gerencia equipe, configurações, dados financeiros e todos os módulos",
              "**Membro** — Acesso operacional: cria e edita serviços, orçamentos, clientes e despesas",
              "**Visualizador** — Acesso somente leitura: pode consultar dashboards e relatórios, mas não editar dados",
            ],
            warnings: [
              "Apenas admins podem convidar novos membros e alterar configurações da empresa.",
              "Cuidado ao atribuir a função Admin — ela permite excluir dados.",
            ],
          },
        ],
        relatedSections: ["configurando-empresa"],
      },
    ],
  },
  {
    id: "dashboards",
    title: "Dashboards e Análises",
    emoji: "📊",
    sections: [
      {
        id: "gestao-empresa",
        title: "Gestão da Empresa",
        icon: LayoutDashboard,
        image: "/help/gestao-empresa.png",
        description: "Visão estratégica consolidada com KPIs financeiros e planejamento.",
        topics: [
          {
            id: "kpis-principais",
            title: "Indicadores financeiros (KPIs)",
            description: "Entenda os 4 cards principais do dashboard.",
            steps: [
              "**Receita Bruta** — Total faturado no período selecionado",
              "**Receita Líquida** — Receita bruta menos impostos",
              "**Margem de Contribuição** — Receita menos custos variáveis (indica quanto sobra para cobrir custos fixos)",
              "**Ponto de Equilíbrio** — Faturamento mínimo necessário para não ter prejuízo",
            ],
            tips: [
              "Passe o mouse sobre o ícone **(i)** em cada card para ver a fórmula de cálculo.",
              "Use os filtros de período (Mês, Trimestre, Ano) para comparar diferentes intervalos.",
            ],
          },
          {
            id: "insights-ia",
            title: "Insights de IA",
            description: "Receba sugestões automáticas baseadas nos seus dados.",
            steps: [
              "Os cards de insights aparecem automaticamente no dashboard",
              "Eles analisam tendências de receita, despesas e produtividade",
              "Clique em um insight para ver mais detalhes e ações sugeridas",
            ],
            tips: [
              "Os insights são mais precisos quando seus dados estão atualizados.",
            ],
          },
        ],
        relatedSections: ["dashboard-financeiro", "alertas-financeiros"],
      },
      {
        id: "dashboard-financeiro",
        title: "Dashboard Financeiro",
        icon: DollarSign,
        image: "/help/dashboard-financeiro.png",
        description: "Análise contábil detalhada com gráficos de evolução e performance.",
        topics: [
          {
            id: "evolucao-receita",
            title: "Evolução de Receita e Lucro",
            description: "Acompanhe a evolução mensal de faturamento e resultado.",
            steps: [
              "O gráfico principal mostra **barras** de receita bruta e uma **linha** de lucro líquido",
              "Meses com lucro negativo ficam destacados em vermelho",
              "Use os filtros de período no topo para ajustar o intervalo",
            ],
            tips: [
              "Compare trimestres para identificar sazonalidade no seu negócio.",
            ],
          },
          {
            id: "graficos-avancados",
            title: "Gráficos avançados",
            description: "Entenda a composição financeira com visualizações especiais.",
            steps: [
              "**Cascata (Waterfall)** — Mostra como a receita se transforma em lucro, passando por custos e despesas",
              "**Treemap de Despesas** — Visualização em blocos proporcionais por categoria de gasto",
              "**Funil de Vendas** — Acompanha a conversão: orçamentos → aprovados → faturados",
            ],
          },
        ],
        relatedSections: ["gestao-empresa", "despesas"],
      },
      {
        id: "operacional",
        title: "Gestão Operacional",
        icon: TrendingUp,
        image: "/help/operacional.png",
        description: "Análise de produtividade, tempo médio e eficiência da equipe.",
        topics: [
          {
            id: "metricas-operacionais",
            title: "Métricas de produtividade",
            description: "Monitore a eficiência operacional da sua equipe.",
            steps: [
              "**Tempo Médio de Conclusão** — Quantos dias, em média, seus serviços levam para serem concluídos",
              "**Taxa de Produtividade** — Percentual de serviços concluídos dentro do prazo",
              "**Ticket Médio** — Valor médio por serviço realizado",
              "**Status dos Serviços** — Gráfico de rosca mostrando a distribuição por status",
            ],
            tips: [
              "Use para identificar gargalos: se o tempo médio está subindo, investigue as causas.",
            ],
          },
        ],
        relatedSections: ["servicos", "gestao-empresa"],
      },
      {
        id: "relatorio-executivo",
        title: "Relatório Executivo",
        icon: ClipboardList,
        image: "/help/relatorio.png",
        description: "Gere relatórios mensais profissionais para apresentar a stakeholders.",
        topics: [
          {
            id: "gerar-relatorio",
            title: "Gerando e exportando o relatório",
            description: "Crie um relatório mensal completo com um clique.",
            steps: [
              "Acesse **Relatório Executivo** no menu lateral",
              "Use as setas para selecionar o mês desejado",
              "O relatório é gerado automaticamente com os dados do período",
              "Clique em **Baixar PDF** para exportar",
            ],
            tips: [
              "O PDF inclui logo da empresa (configure em Configurações > Template).",
              "Ative 'Comparar com mês anterior' para ver a evolução dos indicadores.",
            ],
          },
          {
            id: "conteudo-relatorio",
            title: "O que contém o relatório",
            description: "Seções incluídas no relatório executivo.",
            steps: [
              "Top clientes por faturamento no período",
              "KPIs financeiros consolidados",
              "Variação de faturamento comparado ao mês anterior",
              "Resumo operacional (serviços concluídos, em andamento)",
            ],
          },
        ],
        relatedSections: ["dashboard-financeiro"],
      },
    ],
  },
  {
    id: "operacoes",
    title: "Operações do Dia a Dia",
    emoji: "⚙️",
    sections: [
      {
        id: "servicos",
        title: "Serviços",
        icon: Briefcase,
        image: "/help/servicos.png",
        description: "Gerencie todos os serviços com acompanhamento de progresso e equipe.",
        topics: [
          {
            id: "criar-servico",
            title: "Criar novo serviço",
            description: "Registre um serviço para acompanhar progresso e faturamento.",
            steps: [
              "Acesse **Serviços** no menu lateral",
              "Clique em **+ Novo Serviço**",
              "Preencha: nome do serviço, tipo, cliente e propriedade",
              "Defina as datas de início e previsão de término",
              "Informe o valor do serviço",
              "*(Opcional)* Vincule a um orçamento existente",
              "Clique em **Salvar**",
            ],
            tips: [
              "Após criar, adicione tarefas internas e membros da equipe na tela de detalhes.",
            ],
            warnings: [
              "O tipo de serviço precisa estar cadastrado previamente em **Cadastros**.",
            ],
          },
          {
            id: "lista-kanban",
            title: "Visão Lista e Kanban",
            description: "Alterne entre duas formas de visualizar seus serviços.",
            steps: [
              "**Lista** — Tabela detalhada com todas as informações, filtros e ordenação",
              "**Kanban** — Colunas organizadas por status (Pendente, Em andamento, Concluído)",
              "No Kanban, arraste os cards entre colunas para atualizar o status rapidamente",
            ],
            tips: [
              "Use o Kanban para reuniões rápidas de status com a equipe.",
            ],
          },
          {
            id: "detalhes-servico",
            title: "Detalhes do serviço",
            description: "Gerencie equipe, tarefas e anexos de cada serviço.",
            steps: [
              "Clique em qualquer serviço para abrir a tela de detalhes",
              "**Equipe** — Adicione membros e defina funções",
              "**Tarefas** — Crie checklists internos com responsáveis e prazos",
              "**Anexos** — Faça upload de fotos, documentos e planilhas",
              "**Timeline** — Visualize o histórico de eventos do serviço",
              "**Progresso** — Acompanhe a barra de conclusão geral",
            ],
          },
        ],
        relatedSections: ["orcamentos", "calendario"],
      },
      {
        id: "orcamentos",
        title: "Orçamentos",
        icon: FileBarChart,
        image: "/help/orcamentos.png",
        description: "Crie propostas comerciais profissionais e acompanhe a conversão.",
        topics: [
          {
            id: "criar-orcamento",
            title: "Criar novo orçamento",
            description: "Monte uma proposta comercial completa para seu cliente.",
            steps: [
              "Acesse **Orçamentos** no menu lateral",
              "Clique em **Novo Orçamento**",
              "Selecione o **cliente** e a **propriedade**",
              "Adicione itens de serviço com quantidade e valor unitário",
              "Configure desconto, impostos e forma de pagamento",
              "*(Opcional)* Ative marcos/parcelas para faturamento parcial",
              "Clique em **Salvar**",
            ],
            tips: [
              "O valor unitário é preenchido automaticamente com base no Tipo de Serviço cadastrado.",
              "Use marcos para dividir o pagamento em etapas.",
            ],
          },
          {
            id: "pdf-orcamento",
            title: "Gerar PDF do orçamento",
            description: "Exporte uma proposta profissional formatada.",
            steps: [
              "Abra o orçamento desejado",
              "Clique em **Gerar PDF**",
              "O documento é gerado com logo e dados da empresa",
              "Faça o download ou envie diretamente ao cliente",
            ],
            warnings: [
              "Configure o logo da empresa em **Configurações > Template** antes de gerar o primeiro PDF.",
            ],
          },
          {
            id: "status-conversao",
            title: "Acompanhar status e conversão",
            description: "Monitore a evolução dos seus orçamentos.",
            steps: [
              "Os KPIs no topo mostram: Total, Aprovados, Pendentes e Taxa de Conversão",
              "Altere o status manualmente: **Pendente → Aprovado → Faturado** ou **Recusado**",
              "A taxa de conversão é calculada automaticamente",
            ],
          },
        ],
        relatedSections: ["servicos", "dashboard-financeiro"],
      },
      {
        id: "despesas",
        title: "Despesas",
        icon: Receipt,
        image: "/help/despesas.png",
        description: "Controle todos os gastos da empresa com categorização e análise.",
        topics: [
          {
            id: "registrar-despesa",
            title: "Registrar uma despesa",
            description: "Adicione gastos para controle financeiro preciso.",
            steps: [
              "Acesse **Despesas** no menu lateral",
              "Clique em **Nova Despesa**",
              "Selecione o **tipo/categoria** da despesa",
              "Informe o **valor** e a **data**",
              "*(Opcional)* Vincule a um serviço específico",
              "Adicione observações se necessário",
              "Clique em **Salvar**",
            ],
            tips: [
              "Categorize corretamente para que os relatórios e treemaps sejam precisos.",
              "Vincular ao serviço permite calcular o custo real vs. receita de cada trabalho.",
            ],
            warnings: [
              "Cadastre as categorias de despesa em **Cadastros** antes de registrar.",
            ],
          },
          {
            id: "analise-despesas",
            title: "Analisando despesas",
            description: "Visualize onde seu dinheiro está sendo gasto.",
            steps: [
              "Use os filtros de **Mês/Trimestre/Ano** para ajustar o período",
              "O **Treemap** mostra blocos proporcionais por subcategoria",
              "Quanto maior o bloco, maior o gasto naquela categoria",
            ],
            tips: [
              "Identifique categorias com crescimento anormal para agir rapidamente.",
            ],
          },
        ],
        relatedSections: ["dashboard-financeiro", "cadastros-iniciais"],
      },
      {
        id: "calendario",
        title: "Calendário",
        icon: CalendarDays,
        image: "/help/calendario.png",
        description: "Gerencie compromissos, prazos de orçamentos e serviços em um só lugar.",
        topics: [
          {
            id: "visoes-calendario",
            title: "Visões do calendário",
            description: "Alterne entre 4 formas de visualizar seus eventos.",
            steps: [
              "**Mensal** — Visão geral do mês com eventos coloridos por tipo",
              "**Semanal** — Detalhe da semana com navegação entre semanas",
              "**Diário** — Agenda detalhada do dia selecionado",
              "**Tabela** — Lista completa com filtros, busca e paginação",
            ],
            tips: [
              "Use a legenda de cores para identificar rapidamente o tipo de cada evento.",
            ],
          },
          {
            id: "criar-compromisso",
            title: "Criar novo compromisso",
            description: "Agende reuniões, visitas e atividades.",
            steps: [
              "Clique em **+ Novo Compromisso**",
              "Preencha: título, data/hora de início e fim",
              "Selecione o **cliente** e **serviço** relacionados (opcional)",
              "Adicione observações se necessário",
              "Clique em **Salvar**",
            ],
            tips: [
              "Os compromissos aparecem automaticamente em todas as visões do calendário.",
              "Se você tem o Google Calendar integrado, os eventos são sincronizados.",
            ],
          },
        ],
        relatedSections: ["servicos", "orcamentos"],
      },
    ],
  },
  {
    id: "clientes-projetos",
    title: "Clientes e Projetos",
    emoji: "👥",
    sections: [
      {
        id: "gestao-clientes",
        title: "Gestão de Clientes",
        icon: Users,
        image: "/help/clientes.png",
        description: "Cadastre, organize e analise a rentabilidade dos seus clientes.",
        topics: [
          {
            id: "cadastrar-cliente",
            title: "Cadastrar cliente",
            description: "Adicione novos clientes ao sistema.",
            steps: [
              "Acesse **Cadastros** → aba **Clientes e Propriedades**",
              "Clique em **Novo Cliente**",
              "Preencha: nome, CPF/CNPJ, telefone, e-mail e endereço",
              "Defina a situação: **Ativo**, **Inativo** ou **Prospecto**",
              "Clique em **Salvar**",
            ],
            tips: [
              "Adicione propriedades ao cliente na mesma tela ou depois em Projetos.",
            ],
          },
          {
            id: "detalhes-cliente",
            title: "Painel do cliente",
            description: "Veja tudo sobre um cliente em uma única tela.",
            steps: [
              "Clique no nome do cliente para abrir o painel completo",
              "**Informações** — Dados de contato e localização",
              "**Propriedades** — Imóveis vinculados com mapa",
              "**Serviços** — Histórico de trabalhos realizados",
              "**Orçamentos** — Propostas enviadas e status",
              "**Financeiro** — Receita total, LTV e rentabilidade",
              "**Timeline** — Histórico cronológico de todas as interações",
            ],
          },
          {
            id: "analise-clientes",
            title: "Análise de clientes",
            description: "Identifique seus melhores clientes e oportunidades.",
            steps: [
              "Na aba **Análise de Clientes**, visualize:",
              "**Pareto de Receita** — Os clientes que mais contribuem para o faturamento",
              "**LTV Médio** — Evolução do valor vitalício médio dos clientes",
              "**Distribuição geográfica** — Mapa de cidades com clientes ativos",
            ],
            tips: [
              "Se os Top 3 clientes representam mais de 60% da receita, considere diversificar.",
            ],
          },
        ],
        relatedSections: ["propriedades-mapa"],
      },
      {
        id: "propriedades-mapa",
        title: "Propriedades e Mapa",
        icon: MapPin,
        description: "Gerencie imóveis, visualize no mapa e faça upload de KML.",
        topics: [
          {
            id: "cadastrar-propriedade",
            title: "Cadastrar propriedade",
            description: "Registre um imóvel vinculado a um cliente.",
            steps: [
              "Acesse **Cadastros** → aba **Clientes e Propriedades**",
              "Clique em **Nova Propriedade**",
              "Selecione o **cliente** proprietário",
              "Preencha: nome, município, área (ha), tipo e documentação",
              "*(Opcional)* Informe coordenadas (latitude/longitude) para exibição no mapa",
              "Clique em **Salvar**",
            ],
          },
          {
            id: "upload-kml",
            title: "Upload de arquivo KML",
            description: "Importe perímetros georreferenciados para visualizar no mapa.",
            steps: [
              "Na aba **Projetos** (Clientes), localize a propriedade",
              "Clique em **Upload KML** no card da propriedade",
              "Selecione o arquivo **.kml** ou **.kmz** do seu computador",
              "O sistema processa e exibe o perímetro no mapa automaticamente",
              "Área, perímetro e centroide são calculados pelo sistema",
            ],
            tips: [
              "Exporte KML de softwares como Google Earth, QGIS ou CAR.",
              "Após o upload, clique na propriedade no mapa para ver detalhes completos.",
            ],
            commonErrors: [
              "Arquivo inválido: verifique se o KML contém polígonos válidos.",
              "Mapa em branco: confira se as coordenadas estão no formato correto (WGS84).",
            ],
          },
        ],
        relatedSections: ["gestao-clientes", "servicos"],
      },
    ],
  },
  {
    id: "ferramentas",
    title: "Ferramentas Inteligentes",
    emoji: "🤖",
    sections: [
      {
        id: "geobot",
        title: "GeoBot (Assistente IA)",
        icon: Bot,
        image: "/help/geobot.png",
        description: "Consultor financeiro e operacional inteligente, disponível 24h.",
        topics: [
          {
            id: "usar-geobot",
            title: "Como usar o GeoBot",
            description: "Faça perguntas e receba análises personalizadas dos seus dados.",
            steps: [
              "Acesse **GeoBot** no menu lateral",
              "Digite sua pergunta no campo de texto",
              "Pressione **Enter** ou clique em enviar",
              "O GeoBot analisa seus dados reais (KPIs, receitas, despesas) e responde",
            ],
            tips: [
              "Seja específico: mencione períodos, valores ou serviços.",
              "Use as sugestões prontas como ponto de partida.",
              "Exemplos: \"Qual minha margem de lucro este mês?\", \"Sugira estratégias para aumentar receita\".",
            ],
          },
        ],
        relatedSections: ["gestao-empresa", "alertas-financeiros"],
      },
      {
        id: "alertas-financeiros",
        title: "Alertas Financeiros",
        icon: Bell,
        description: "Receba avisos automáticos sobre situações financeiras críticas.",
        topics: [
          {
            id: "tipos-alertas",
            title: "Tipos de alertas",
            description: "Entenda os avisos automáticos do sistema.",
            steps: [
              "**Pagamento vencido** — Orçamentos com data de pagamento ultrapassada",
              "**Orçamento vencendo** — Propostas prestes a expirar",
              "**Margem baixa** — Serviços com margem de lucro abaixo do esperado",
            ],
          },
          {
            id: "configurar-alertas",
            title: "Configurar alertas",
            description: "Defina quando e com que frequência os alertas aparecem.",
            steps: [
              "Acesse **Configurações** → aba **Notificações**",
              "Ative/desative os **Alertas Financeiros**",
              "Escolha a **antecedência**: 7, 15 ou 30 dias antes do vencimento",
              "Defina a **frequência** de alertas para pagamentos já vencidos: a cada 1, 3, 7 ou 15 dias",
            ],
            tips: [
              "Configure 15 dias de antecedência para ter tempo hábil de cobrar o cliente.",
            ],
          },
        ],
        relatedSections: ["gestao-empresa", "geobot"],
      },
      {
        id: "importacao-csv",
        title: "Importação Inteligente (CSV)",
        icon: FileSpreadsheet,
        description: "Importe dados em massa a partir de planilhas Excel/CSV.",
        topics: [
          {
            id: "como-importar",
            title: "Como importar dados via CSV",
            description: "Cadastre muitos registros rapidamente.",
            steps: [
              "Em **Cadastros**, clique no botão **Importar CSV**",
              "Selecione o arquivo CSV do seu computador",
              "O sistema detecta automaticamente as colunas",
              "Mapeie cada coluna do CSV para o campo correspondente do sistema",
              "Revise os dados no preview",
              "Confirme a importação",
            ],
            tips: [
              "Formatos aceitos: CSV com separador vírgula ou ponto-e-vírgula.",
              "Exporte do Excel usando **Salvar como → CSV UTF-8**.",
            ],
            warnings: [
              "Dados importados não podem ser desfeitos em massa — revise com atenção.",
            ],
          },
        ],
        relatedSections: ["cadastros-iniciais"],
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações e Conta",
    emoji: "⚙️",
    sections: [
      {
        id: "perfil-aparencia",
        title: "Perfil e Aparência",
        icon: UserCircle,
        image: "/help/configuracoes.png",
        description: "Personalize sua conta e o visual do sistema.",
        topics: [
          {
            id: "perfil",
            title: "Atualizar perfil",
            description: "Altere seu nome e foto de perfil.",
            steps: [
              "Acesse **Configurações** → aba **Perfil**",
              "Clique na foto para fazer upload de uma nova imagem",
              "Edite seu nome de exibição",
              "Clique em **Salvar**",
            ],
          },
          {
            id: "tema",
            title: "Tema claro / escuro",
            description: "Escolha o visual que preferir.",
            steps: [
              "Em **Configurações** → aba **Aparência**",
              "Escolha entre: **Claro**, **Escuro** ou **Automático** (segue o sistema operacional)",
              "A mudança é aplicada instantaneamente",
            ],
          },
        ],
      },
      {
        id: "google-calendar",
        title: "Google Calendar",
        icon: Calendar,
        description: "Sincronize compromissos com o Google Calendar.",
        topics: [
          {
            id: "integrar-google",
            title: "Como integrar",
            description: "Conecte sua conta Google para sincronizar eventos.",
            steps: [
              "Acesse **Configurações** → aba **Integrações**",
              "Clique em **Conectar Google Calendar**",
              "Faça login com sua conta Google e autorize o acesso",
              "Selecione o calendário que deseja sincronizar",
              "Os eventos do GeoGestor aparecerão no seu Google Calendar",
            ],
            warnings: [
              "A sincronização é unidirecional: GeoGestor → Google Calendar.",
            ],
          },
        ],
        relatedSections: ["calendario"],
      },
      {
        id: "assinatura-planos",
        title: "Assinatura e Planos",
        icon: CreditCard,
        description: "Gerencie seu plano, limites e pagamento.",
        topics: [
          {
            id: "planos",
            title: "Entendendo os planos",
            description: "Saiba o que cada plano oferece.",
            steps: [
              "Acesse **Assinatura** no menu lateral para ver seu plano atual",
              "Veja os limites de cada plano: clientes, serviços, membros da equipe",
              "Faça upgrade a qualquer momento para desbloquear mais recursos",
            ],
            tips: [
              "Ao atingir um limite, o sistema exibirá um alerta orientando sobre o upgrade.",
            ],
          },
        ],
      },
      {
        id: "logs-auditoria",
        title: "Logs de Auditoria",
        icon: ScrollText,
        description: "Consulte o histórico de ações realizadas no sistema.",
        topics: [
          {
            id: "consultar-logs",
            title: "Como consultar os logs",
            description: "Veja quem fez o quê e quando no sistema.",
            steps: [
              "Acesse **Logs de Auditoria** no menu lateral (disponível para admins)",
              "Use os filtros para buscar por: usuário, ação, entidade ou período",
              "Cada registro mostra: quem executou, qual ação, em qual item e quando",
            ],
            tips: [
              "Útil para rastrear alterações em dados financeiros e exclusões.",
            ],
            warnings: [
              "Apenas usuários com função **Admin** têm acesso aos logs.",
            ],
          },
        ],
      },
    ],
  },
];
