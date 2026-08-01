import { useState } from 'react';
import { Layout } from '../../components/Layout';
import { PageFilterBar } from '../../components/PageFilterBar';
import { PageHeader } from '../../components/PageHeader';
import { 
  BookOpen, MagnifyingGlass, Question, Sliders, Users, 
  FolderOpen, Coins, Shield, Keyboard, ArrowRight,
  type Icon
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { APP_VERSION } from '../../version';
import { filterClearButtonClass, filterSearchInputClass } from '../../utils/filterStyles';

interface HelpArticle {
  id: string;
  category: 'comeco' | 'crm' | 'projetos' | 'financeiro' | 'seguranca' | 'atalhos';
  title: string;
  excerpt: string;
  content: string[];
  icon: Icon;
}

export function Ajuda() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const articles: HelpArticle[] = [
    {
      id: 'setup-local',
      category: 'comeco',
      title: 'Configurando a Pasta de Dados Local',
      excerpt: 'Saiba como definir a pasta do Windows que armazenará todos os seus arquivos, plantas e relatórios.',
      icon: Sliders,
      content: [
        'O GeoGestor funciona de forma 100% local e offline. Isso significa que seus dados pertencem a você e ficam armazenados no seu próprio computador.',
        'Ao abrir o GeoGestor pela primeira vez (ou acessando o menu Configurações), você deve apontar um diretório raiz do seu Windows (ex: C:\\Users\\SeuUsuario\\Documentos\\GeoGestor).',
        'Sempre que você cadastrar um novo cliente, o GeoGestor cria automaticamente uma pasta com o nome do cliente no diretório definido.',
        'Sempre que você criar um projeto, uma subpasta com o nome do projeto será criada dentro da pasta do cliente. Você pode abrir essa pasta diretamente do sistema usando o botão "Abrir Pasta no Explorer".'
      ]
    },
    {
      id: 'importacao-dados',
      category: 'comeco',
      title: 'Importando Dados em Lote',
      excerpt: 'Aprenda a trazer seus dados antigos de planilhas CSV ou planilhas Excel em minutos.',
      icon: BookOpen,
      content: [
        'Acesse o menu Importação na barra lateral para carregar dados de Clientes ou Projetos em lote.',
        'Você pode baixar nossos modelos de planilhas locais para garantir que os cabeçalhos das colunas correspondam perfeitamente.',
        'Na etapa de mapeamento, associe cada coluna da planilha ao campo correspondente do GeoGestor. O esquema utilizado fica salvo para consulta.',
        'O processamento de CSV ou XLSX é feito localmente no aplicativo, sem enviar os dados para a nuvem. Importação de PDF e OCR ainda não estão disponíveis.'
      ]
    },
    {
      id: 'gestao-crm',
      category: 'crm',
      title: 'CRM e área comercial',
      excerpt: 'Entenda como acompanhar leads, oportunidades e indicadores comerciais.',
      icon: Users,
      content: [
        'O CRM reúne as seções Leads, Funil de vendas e Indicadores. O cadastro de clientes continua separado para preservar cada entidade e seu histórico.',
        'No Funil de vendas, você pode gerenciar oportunidades em colunas visuais (Prospectado, Contato, Proposta, Ganho e Perdido). Basta arrastar os cartões para atualizar a etapa da negociação.',
        'Ao entrar nos Detalhes do Cliente, você terá acesso à Linha do Tempo do CRM. Nela, você pode cadastrar interações manuais (como ligações, mensagens de WhatsApp ou reuniões) para registrar todo o histórico de contato.'
      ]
    },
    {
      id: 'projetos-tarefas',
      category: 'projetos',
      title: 'Acompanhamento de Projetos e Tarefas',
      excerpt: 'Configure especificações topográficas e crie checklists de controle operacional.',
      icon: FolderOpen,
      content: [
        'Ao criar um projeto, você pode preencher dados técnicos cruciais para a topografia: área em hectares (Ha), matrícula, número do CAR, código CCIR, ITR, coordenadas (latitude e longitude) e situação de averbação.',
        'Na tela de Detalhes do Projeto, há um gerenciador de Checklist operacional. Você pode cadastrar subtarefas específicas (ex: "Leitura de campo", "Desenho no AutoCAD", "Geração de RT", "Entrada no Cartório") e marcar conforme concluir.',
        'O progresso do checklist atualiza automaticamente a barra de progresso visual do projeto.'
      ]
    },
    {
      id: 'orcamentos-pdf',
      category: 'financeiro',
      title: 'Orçamentos e Emissão de PDFs',
      excerpt: 'Gere documentos formais de orçamento com parcelamento e baixe como PDF localmente.',
      icon: Coins,
      content: [
        'Acesse o menu Orçamentos e utilize o assistente para criar uma nova proposta para um cliente.',
        'Você pode descrever os serviços incluídos, valor unitário, aplicar descontos em centavos ou porcentagem, e configurar a forma de pagamento.',
        'Ao aprovar o orçamento, você pode definir o número de parcelas financeiras. O GeoGestor gerará automaticamente parcelas com vencimentos mensais.',
        'Na visualização do orçamento, clique em "Imprimir / Salvar PDF". O PDF é gerado offline no seu computador usando o pdfmake e formatado em um design executivo pronto para envio ao cliente.'
      ]
    },
    {
      id: 'despesas-fluxo',
      category: 'financeiro',
      title: 'Contas a pagar e visão financeira',
      excerpt: 'Lance despesas avulsas ou atreladas a projetos e analise a rentabilidade operacional.',
      icon: Coins,
      content: [
        'Você pode lançar custos da operação em Financeiro → Contas a pagar, inclusive despesas ligadas a projetos ou viagens.',
        'Ao cadastrar uma despesa, você pode vinculá-la a um projeto específico. Isso permite calcular a real rentabilidade de cada trabalho.',
        'Em Financeiro → Visão financeira, o sistema consolida recebimentos e despesas, apresenta o fluxo de caixa e destaca a rentabilidade por cliente.'
      ]
    },
    {
      id: 'auditoria-seguranca',
      category: 'seguranca',
      title: 'Auditoria de Logs e Banco SQLite',
      excerpt: 'Como o GeoGestor garante a integridade dos seus dados operacionais.',
      icon: Shield,
      content: [
        'O GeoGestor utiliza um banco de dados relacional leve (SQLite) armazenado no seu diretório local.',
        'Para manter a segurança das informações corporativas e histórico de operações, toda criação, edição ou exclusão de clientes, projetos, orçamentos e despesas gera um Log de Auditoria.',
        'Você pode visualizar esses logs na aba "Logs de Auditoria" na barra lateral. Ela exibe a data/hora exata do evento, a ação executada (Inserção, Atualização, Exclusão) e um comparativo de "Antes vs Depois" de cada campo editado.'
      ]
    },
    {
      id: 'atalhos-teclado',
      category: 'atalhos',
      title: 'Atalhos de Teclado Úteis',
      excerpt: 'Aumente sua produtividade na navegação diária.',
      icon: Keyboard,
      content: [
        'Para facilitar a operação diária no GeoGestor, disponibilizamos alguns atalhos de navegação rápida (sujeitos ao sistema operacional):',
        '• Esc: Fecha modais abertos e visualizações de detalhes de logs.',
        '• Ctrl + P: Abre o diálogo de impressão do navegador ou gera o PDF instantâneo na tela de relatórios.',
        '• F5: Atualiza as consultas locais com o banco de dados SQLite.',
        '• Dica: Ao usar a barra de busca offline na Central de Ajuda, o filtro é aplicado em tempo real à medida que você digita.'
      ]
    }
  ];

  // Filter articles by query and category
  const filteredArticles = articles.filter(art => {
    const matchesCategory = activeCategory === 'ALL' || art.category === activeCategory;
    const matchesQuery = searchQuery === '' || 
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.some(paragraph => paragraph.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesQuery;
  });

  const categories = [
    { id: 'ALL', label: 'Tudo', icon: Question },
    { id: 'comeco', label: 'Configuração Inicial', icon: Sliders },
    { id: 'crm', label: 'Clientes e CRM', icon: Users },
    { id: 'projetos', label: 'Projetos e Operações', icon: FolderOpen },
    { id: 'financeiro', label: 'Financeiro e PDFs', icon: Coins },
    { id: 'seguranca', label: 'Segurança & Logs', icon: Shield },
    { id: 'atalhos', label: 'Atalhos', icon: Keyboard }
  ];

  return (
    <Layout>
      <PageHeader
        eyebrow="Documentação interna"
        title="Central de Ajuda"
        description="Manual operacional offline, guias rápidos e configurações do GeoGestor."
      />

      {/* Search Input Box */}
      <PageFilterBar
        search={
          <div className="relative min-w-0">
          <label htmlFor="help-search" className="sr-only">Pesquisar manuais e guias de suporte</label>
          <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
          <input 
            id="help-search"
            name="helpSearch"
            type="search"
            autoComplete="off"
            placeholder="Pesquisar manuais e guias de suporte…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${filterSearchInputClass} pl-9`}
          />
          </div>
        }
        sorting={searchQuery ? (
          <button 
            type="button"
            onClick={() => setSearchQuery('')}
            className={`${filterClearButtonClass} inline-flex items-center justify-center px-4`}
          >
            Limpar busca
          </button>
        ) : null}
      />

      {/* Categories Horizontal Selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-12 border-b border-zinc-100 dark:border-zinc-800">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setSelectedArticle(null); // Clear active reading
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white ${
                isSelected 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Help Content Grid (Split view if article selected, otherwise list) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 items-start">
        {/* List of articles */}
        <div className={`lg:col-span-1 space-y-4 ${selectedArticle ? 'hidden lg:block' : ''}`}>
          <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500 dark:text-zinc-400 mb-6">Manuais Disponíveis</h3>
          {filteredArticles.map((art) => {
            const Icon = art.icon;
            const isSelected = selectedArticle?.id === art.id;
            return (
              <button 
                key={art.id}
                type="button"
                onClick={() => setSelectedArticle(art)}
                className={`group rounded-[2rem] p-6 text-left w-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white ${
                  isSelected 
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-md' 
                    : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-white dark:bg-zinc-900/10' : 'bg-zinc-50 dark:bg-zinc-800/50 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                    {categories.find(c => c.id === art.category)?.label}
                  </span>
                </div>
                <h4 className="font-bold text-sm leading-snug">{art.title}</h4>
                <p className={`text-xs mt-2 line-clamp-2 ${
                  isSelected ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {art.excerpt}
                </p>
                <div className="flex justify-end mt-4">
                  <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                    isSelected ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'
                  }`} />
                </div>
              </button>
            );
          })}
          {filteredArticles.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 italic py-6">Nenhum guia atende aos critérios de pesquisa.</p>
          )}
        </div>

        {/* Selected Article Viewer */}
        <div className="lg:col-span-2">
          {selectedArticle ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 ring-1 ring-zinc-900/5 dark:ring-white/10 shadow-sm border border-zinc-100 dark:border-zinc-800/50 dark:border-zinc-800"
            >
              <button 
                onClick={() => setSelectedArticle(null)}
                className="lg:hidden flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-6 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                ← Voltar para listagem
              </button>

              <div className="flex items-center gap-4 mb-6">
                <span className="text-xs uppercase font-bold tracking-widest text-zinc-500 dark:text-zinc-400 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  {categories.find(c => c.id === selectedArticle.category)?.label}
                </span>
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white mb-8">{selectedArticle.title}</h2>

              <div className="space-y-6 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans font-medium">
                {selectedArticle.content.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                <span>Versão instalada: GeoGestor v{APP_VERSION}</span>
                <span>GeoGestor Desktop</span>
              </div>
            </motion.div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-16 text-center h-full min-h-[400px]">
              <Question className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4 animate-pulse" />
              <h3 className="font-bold text-zinc-900 dark:text-white mb-2">Nenhum guia selecionado</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                Selecione um dos manuais na lista lateral para ler o guia explicativo completo.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
