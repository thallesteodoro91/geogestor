import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  Bot,
  CalendarDays,
  ClipboardList,
  Briefcase,
  FileBarChart,
  Receipt,
  Users,
  FileText,
  Settings,
  Search,
  BookOpen,
  Rocket,
} from "lucide-react";

interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  image?: string;
  description: string;
  topics: { title: string; content: string }[];
}

const helpSections: HelpSection[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    icon: Rocket,
    description:
      "Comece aqui! Aprenda a configurar sua empresa e personalizar o sistema.",
    topics: [
      {
        title: "Criando sua conta",
        content:
          "Ao acessar o GeoGestor pela primeira vez, você criará sua conta com e-mail e senha. Após confirmar o e-mail, faça login para acessar o painel principal.",
      },
      {
        title: "Configurando a empresa",
        content:
          'Vá em Configurações > Empresa para definir o nome, dados financeiros base (receita, custos) e personalizar o template de orçamento. Essas informações alimentam todos os dashboards.',
      },
      {
        title: "Convidando membros da equipe",
        content:
          "Em Configurações > Equipe, clique em 'Convidar Membro' para adicionar colaboradores. Defina a função (admin, membro ou visualizador) para controlar as permissões.",
      },
      {
        title: "Cadastrando dados iniciais",
        content:
          "Antes de usar o sistema, cadastre: Tipos de Serviço, Categorias de Despesa e seus primeiros Clientes e Propriedades na seção Cadastros.",
      },
    ],
  },
  {
    id: "gestao-empresa",
    title: "Gestão da Empresa",
    icon: LayoutDashboard,
    image: "/help/gestao-empresa.png",
    description:
      "Visão estratégica consolidada com KPIs financeiros e planejamento.",
    topics: [
      {
        title: "Indicadores Financeiros",
        content:
          "Os 4 cards principais mostram: Receita Bruta, Receita Líquida, Margem de Contribuição e Ponto de Equilíbrio. Passe o mouse sobre o ícone (i) para entender cada métrica.",
      },
      {
        title: "Filtros por período",
        content:
          "Use o seletor de Mês/Trimestre/Ano no topo para filtrar os dados. Você pode navegar entre períodos usando as setas.",
      },
      {
        title: "Alertas Financeiros",
        content:
          "O sistema gera alertas automáticos sobre pagamentos vencidos, orçamentos prestes a vencer e margem de lucro baixa. Configure a antecedência dos alertas em Configurações > Notificações.",
      },
      {
        title: "Insights de IA",
        content:
          "Cards de insights automáticos analisam seus dados e sugerem ações estratégicas baseadas nas tendências identificadas.",
      },
    ],
  },
  {
    id: "dashboard-financeiro",
    title: "Dashboard Financeiro",
    icon: DollarSign,
    image: "/help/dashboard-financeiro.png",
    description:
      "Análise contábil detalhada com gráficos de evolução e performance.",
    topics: [
      {
        title: "Evolução de Receita e Lucro",
        content:
          "O gráfico principal mostra barras de receita bruta e uma linha de lucro líquido mês a mês. Meses com lucro abaixo de zero ficam destacados.",
      },
      {
        title: "Métricas de performance",
        content:
          "Acompanhe Receita Bruta, Receita Líquida, Margem de Contribuição e Ponto de Equilíbrio. Use os filtros de período (Mês, Trimestre, Ano) para comparar diferentes intervalos.",
      },
      {
        title: "Gráficos avançados",
        content:
          "Inclui gráficos de cascata (waterfall) para entender a composição dos resultados, treemap de despesas por categoria e funil de vendas.",
      },
    ],
  },
  {
    id: "operacional",
    title: "Gestão Operacional",
    icon: TrendingUp,
    image: "/help/operacional.png",
    description:
      "Análise de produtividade, tempo médio e eficiência operacional.",
    topics: [
      {
        title: "Tempo Médio de Conclusão",
        content:
          "Mostra quanto tempo, em média, seus serviços levam para ser concluídos. Ideal para identificar gargalos no processo.",
      },
      {
        title: "Produtividade e Ticket Médio",
        content:
          "Acompanhe a taxa de produtividade da equipe e o valor médio por serviço realizado.",
      },
      {
        title: "Status dos Serviços",
        content:
          "Visualize a distribuição dos serviços por status (em andamento, concluído, pendente) em gráficos de rosca.",
      },
    ],
  },
  {
    id: "geobot",
    title: "GeoBot (Assistente IA)",
    icon: Bot,
    image: "/help/geobot.png",
    description:
      "Seu consultor financeiro e operacional inteligente, disponível 24h.",
    topics: [
      {
        title: "Como usar o GeoBot",
        content:
          "Digite sua pergunta no campo de texto e pressione Enter. O GeoBot analisa seus dados reais (KPIs, receitas, despesas) para dar respostas personalizadas.",
      },
      {
        title: "Tipos de perguntas",
        content:
          'Exemplos: "Qual minha margem de lucro este mês?", "Analise as margens financeiras", "Identifique riscos", "Sugira estratégias para aumentar receita". Use as sugestões prontas como ponto de partida.',
      },
      {
        title: "Dicas para melhores respostas",
        content:
          "Seja específico na pergunta. Mencione períodos, valores ou serviços específicos. O GeoBot funciona melhor quando seus dados estão atualizados no sistema.",
      },
    ],
  },
  {
    id: "calendario",
    title: "Calendário de Atividades",
    icon: CalendarDays,
    image: "/help/calendario.png",
    description:
      "Gerencie orçamentos, serviços e compromissos em um só lugar.",
    topics: [
      {
        title: "Visões do calendário",
        content:
          "Alterne entre 4 visões: Mensal (visão geral), Semanal (detalhe da semana), Diário (agenda do dia) e Tabela (lista completa com filtros).",
      },
      {
        title: "Criar novo compromisso",
        content:
          'Clique em "+ Novo Compromisso" para criar um evento. Preencha título, data/hora de início e fim, selecione o cliente e serviço relacionados. Os compromissos aparecem em todas as visões.',
      },
      {
        title: "KPIs do calendário",
        content:
          "Os cards no topo mostram: Total de Orçamentos, Serviços, Total de Eventos e Valor Total. Use para ter uma visão rápida do volume de atividades.",
      },
      {
        title: "Filtros e busca",
        content:
          "Filtre eventos por tipo (orçamento, serviço, compromisso), status e busque por nome de cliente ou serviço.",
      },
    ],
  },
  {
    id: "relatorio",
    title: "Relatório Executivo",
    icon: ClipboardList,
    image: "/help/relatorio.png",
    description:
      "Gere relatórios mensais completos com gráficos e análises para apresentar aos stakeholders.",
    topics: [
      {
        title: "Gerando o relatório",
        content:
          "Selecione o mês desejado usando as setas de navegação. O relatório é gerado automaticamente com os dados do período selecionado.",
      },
      {
        title: "Conteúdo do relatório",
        content:
          "Inclui: Top Clientes por faturamento, KPIs financeiros, variação de faturamento comparado ao mês anterior e resumo operacional.",
      },
      {
        title: "Exportar PDF",
        content:
          'Clique em "Baixar PDF" para gerar um documento formatado com o logo da empresa, pronto para impressão ou envio por e-mail.',
      },
      {
        title: "Comparação mensal",
        content:
          "Ative 'Comparar com mês anterior' para ver a evolução dos indicadores e identificar tendências.",
      },
    ],
  },
  {
    id: "servicos",
    title: "Serviços",
    icon: Briefcase,
    image: "/help/servicos.png",
    description:
      "Gerencie todos os serviços da empresa com acompanhamento de progresso.",
    topics: [
      {
        title: "Lista e Kanban",
        content:
          "Alterne entre visão de Lista (tabela detalhada) e Kanban (colunas por status). Arraste cards entre colunas no Kanban para atualizar o status.",
      },
      {
        title: "Criar novo serviço",
        content:
          'Clique em "+ Novo Serviço" e preencha: nome, tipo de serviço, cliente, propriedade, datas de início/fim e valor. Vincule a um orçamento existente se houver.',
      },
      {
        title: "Detalhes do serviço",
        content:
          "Ao clicar em um serviço, acesse: equipe designada, tarefas internas, anexos (fotos, documentos), timeline de eventos e progresso geral.",
      },
      {
        title: "KPIs de serviços",
        content:
          "Os cards mostram: Total de Serviços, Concluídos, Em Andamento e Média de Progresso para acompanhar a produtividade.",
      },
    ],
  },
  {
    id: "orcamentos",
    title: "Orçamentos",
    icon: FileBarChart,
    image: "/help/orcamentos.png",
    description:
      "Crie propostas comerciais profissionais e acompanhe a conversão.",
    topics: [
      {
        title: "Criar orçamento",
        content:
          'Clique em "Novo Orçamento" para abrir o assistente. Selecione cliente, propriedade, adicione itens de serviço com quantidade e valor unitário. Configure desconto, impostos e forma de pagamento.',
      },
      {
        title: "Gerar PDF do orçamento",
        content:
          "Cada orçamento pode ser exportado como PDF profissional com o logo e dados da empresa, pronto para enviar ao cliente.",
      },
      {
        title: "Status e conversão",
        content:
          "Acompanhe o status de cada orçamento (pendente, aprovado, recusado) e a taxa de conversão geral nos KPIs do topo.",
      },
      {
        title: "Marcos e parcelas",
        content:
          "Configure marcos (parcelas) para controlar o faturamento parcial de orçamentos grandes.",
      },
    ],
  },
  {
    id: "despesas",
    title: "Despesas",
    icon: Receipt,
    image: "/help/despesas.png",
    description:
      "Controle todas as despesas da empresa com categorização e análise.",
    topics: [
      {
        title: "Registrar despesa",
        content:
          "Adicione despesas informando: tipo/categoria, valor, data, serviço relacionado (opcional) e observações. Categorize corretamente para relatórios precisos.",
      },
      {
        title: "Filtros por período",
        content:
          "Use os filtros de Mês/Trimestre/Ano para analisar despesas em diferentes períodos. Expanda os filtros avançados para mais opções.",
      },
      {
        title: "Visualização por categoria",
        content:
          "O gráfico de treemap mostra a distribuição visual das despesas por subcategoria, facilitando identificar onde o dinheiro está sendo gasto.",
      },
    ],
  },
  {
    id: "clientes",
    title: "Clientes e Projetos",
    icon: Users,
    image: "/help/clientes.png",
    description:
      "Gestão completa de clientes com análise de rentabilidade e LTV.",
    topics: [
      {
        title: "Análise de clientes",
        content:
          "A aba 'Análise de Clientes' mostra gráficos de Receita por Cliente (Pareto), evolução do LTV Médio e distribuição geográfica.",
      },
      {
        title: "Projetos (Propriedades)",
        content:
          "Na aba 'Projetos', gerencie todas as propriedades cadastradas com mapa interativo, upload de KML e informações detalhadas.",
      },
      {
        title: "Detalhes do cliente",
        content:
          "Ao clicar em um cliente, acesse: informações de contato, propriedades vinculadas, serviços realizados, orçamentos, timeline de interações e métricas financeiras.",
      },
      {
        title: "KPIs de clientes",
        content:
          "Monitore: Total de Clientes, LTV Médio, concentração dos Top 3 Clientes e número de Cidades Ativas.",
      },
    ],
  },
  {
    id: "cadastros",
    title: "Cadastros",
    icon: FileText,
    image: "/help/cadastros.png",
    description:
      "Base de dados central para gerenciar clientes, serviços e despesas.",
    topics: [
      {
        title: "Clientes e Propriedades",
        content:
          "Cadastre clientes com CPF/CNPJ, contato, endereço e situação. Cada cliente pode ter múltiplas propriedades vinculadas.",
      },
      {
        title: "Tipos de Serviço",
        content:
          "Configure os tipos de serviço que sua empresa oferece (ex: Georreferenciamento, Desmembramento, Topografia). Defina categorias e valores sugeridos.",
      },
      {
        title: "Tipos de Despesa",
        content:
          "Organize as categorias de despesa (ex: Combustível, Equipamentos, Mão de Obra) para classificar corretamente os gastos.",
      },
      {
        title: "Importação CSV",
        content:
          "Use o importador inteligente para cadastrar dados em massa a partir de planilhas CSV. O sistema mapeia automaticamente as colunas.",
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    icon: Settings,
    image: "/help/configuracoes.png",
    description:
      "Personalize o sistema, gerencie equipe e configure integrações.",
    topics: [
      {
        title: "Perfil do Usuário",
        content:
          "Atualize seu nome, foto de perfil e visualize o e-mail vinculado à conta.",
      },
      {
        title: "Aparência",
        content:
          "Escolha entre tema claro, escuro ou automático (segue o sistema). A mudança é aplicada instantaneamente.",
      },
      {
        title: "Gestão de Equipe",
        content:
          "Convide novos membros por e-mail, defina funções (admin, membro, visualizador) e gerencie convites pendentes.",
      },
      {
        title: "Notificações",
        content:
          "Ative/desative alertas financeiros e configure: quantos dias antes do vencimento os alertas aparecem (7, 15 ou 30 dias) e a frequência de alertas para pagamentos vencidos.",
      },
      {
        title: "Google Calendar",
        content:
          "Integre com o Google Calendar para sincronizar seus compromissos automaticamente. Os eventos criados no GeoGestor aparecem no seu calendário Google.",
      },
      {
        title: "Template de Orçamento",
        content:
          "Personalize o layout dos PDFs de orçamento: faça upload do logo da empresa e configure textos e informações de rodapé.",
      },
    ],
  },
];

const Ajuda = () => {
  const [search, setSearch] = useState("");

  const filteredSections = useMemo(() => {
    if (!search.trim()) return helpSections;
    const q = search.toLowerCase();
    return helpSections
      .map((section) => {
        const matchesSection =
          section.title.toLowerCase().includes(q) ||
          section.description.toLowerCase().includes(q);
        const filteredTopics = section.topics.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.content.toLowerCase().includes(q)
        );
        if (matchesSection) return section;
        if (filteredTopics.length > 0)
          return { ...section, topics: filteredTopics };
        return null;
      })
      .filter(Boolean) as HelpSection[];
  }, [search]);

  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Central de Ajuda</h1>
          </div>
          <p className="text-muted-foreground">
            Guia completo de todas as funcionalidades do GeoGestor. Use a busca
            para encontrar rapidamente o que precisa.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por funcionalidade, dúvida ou recurso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredSections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum resultado encontrado para "{search}". Tente termos
                diferentes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {filteredSections.map((section) => (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <section.icon className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-left">
                      <span className="font-semibold">{section.title}</span>
                      <p className="text-sm text-muted-foreground font-normal">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {section.image && (
                      <img
                        src={section.image}
                        alt={`Tela de ${section.title}`}
                        className="w-full max-w-3xl rounded-lg shadow-md border border-border"
                        loading="lazy"
                      />
                    )}
                    <div className="space-y-3">
                      {section.topics.map((topic, i) => (
                        <div key={i} className="pl-4 border-l-2 border-primary/30">
                          <h4 className="font-medium text-sm mb-1">
                            {topic.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {topic.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda com dúvidas? Use o{" "}
              <a href="/geobot" className="text-primary hover:underline font-medium">
                GeoBot
              </a>{" "}
              para tirar dúvidas em tempo real ou entre em contato pelo e-mail{" "}
              <span className="font-medium text-foreground">
                suporte@geogestor.com.br
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Ajuda;
