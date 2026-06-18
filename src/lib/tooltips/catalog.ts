/**
 * Catálogo central de tooltips do GeoGestor.
 *
 * Regras:
 * - Sempre usar `<InfoTooltip termKey="..." />` em vez de strings inline.
 * - Toda entrada tem `description` não vazia.
 * - `calculation` é opcional, reservado para KPIs e métricas derivadas.
 * - Chaves seguem o padrão `dominio.campo` (lower camelCase no campo).
 */

export interface TooltipEntry {
  title?: string;
  description: string;
  calculation?: string;
}

export const TOOLTIPS = {
  // ───── Financeiro ─────
  "finance.receitaTotal": {
    title: "Receita Total",
    description: "Total de valores recebidos ou faturados no período selecionado.",
    calculation: "Soma de receitas realizadas (com fallback para faturadas).",
  },
  "finance.receitaBruta": {
    title: "Receita Bruta",
    description: "Faturamento total antes de impostos e deduções.",
  },
  "finance.receitaLiquida": {
    title: "Receita Líquida",
    description: "Receita após dedução de impostos e cancelamentos.",
    calculation: "Receita Bruta − Impostos − Cancelamentos",
  },
  "finance.lucroBruto": {
    title: "Lucro Bruto",
    description: "Rentabilidade antes das despesas operacionais fixas.",
    calculation: "Receita Líquida − Custo dos Serviços",
  },
  "finance.lucroLiquido": {
    title: "Lucro Líquido",
    description: "Receita menos custos, despesas e impostos no período.",
    calculation: "Receita − (Custos + Despesas + Impostos)",
  },
  "finance.margemBruta": {
    title: "Margem Bruta",
    description: "Percentual da receita disponível para cobrir despesas fixas e gerar lucro.",
    calculation: "(Lucro Bruto ÷ Receita Líquida) × 100",
  },
  "finance.margemLiquida": {
    title: "Margem Líquida",
    description: "Percentual de lucro líquido sobre a receita total.",
    calculation: "(Lucro Líquido ÷ Receita Total) × 100",
  },
  "finance.despesasTotais": {
    title: "Despesas Totais",
    description: "Soma de todas as despesas operacionais confirmadas no período.",
  },
  "finance.pipeline": {
    title: "Pipeline",
    description: "Valor estimado de oportunidades, orçamentos ou serviços ainda não concluídos.",
  },
  "finance.ticketMedio": {
    title: "Ticket Médio",
    description: "Valor médio de receita por serviço realizado.",
    calculation: "Receita Total ÷ Nº de Serviços concluídos",
  },
  "finance.breakEven": {
    title: "Ponto de Equilíbrio",
    description: "Receita mínima necessária para cobrir todos os custos do período.",
  },
  "finance.conversao": {
    title: "Taxa de Conversão",
    description: "Percentual de orçamentos convertidos em serviços executados.",
    calculation: "(Orçamentos aprovados ÷ Orçamentos enviados) × 100",
  },

  // ───── Projetos / Serviços ─────
  "projeto.categoria": {
    title: "Categoria do Projeto",
    description:
      "Classificação do projeto. Ex.: Georreferenciamento, CAR, Levantamento, Desmembramento.",
  },
  "projeto.status": {
    title: "Status do Projeto",
    description: "Estado atual do projeto no fluxo operacional (orçado, em execução, concluído, cancelado).",
  },
  "projeto.dataServico": {
    title: "Data do Serviço",
    description: "Data prevista ou realizada para execução do serviço.",
  },
  "projeto.responsavel": {
    title: "Responsável",
    description: "Membro da equipe encarregado pela execução do projeto.",
  },
  "projeto.progresso": {
    title: "Progresso",
    description: "Percentual concluído com base nas tarefas finalizadas do projeto.",
  },

  // ───── Orçamentos ─────
  "orcamento.status": {
    title: "Status do Orçamento",
    description: "Estado do orçamento: rascunho, enviado, aprovado, recusado ou expirado.",
  },
  "orcamento.codigo": {
    title: "Código do Orçamento",
    description: "Identificador único e imutável gerado a partir das iniciais do cliente e sequência.",
  },
  "orcamento.impostos": {
    title: "Impostos",
    description: "Percentual aplicado globalmente sobre o subtotal do orçamento.",
  },
  "orcamento.descontos": {
    title: "Descontos",
    description: "Desconto aplicado globalmente sobre o subtotal do orçamento.",
  },
  "orcamento.marco": {
    title: "Marco Topográfico",
    description: "Item opcional do orçamento que entra no resumo financeiro mas pode ser alternado pelo cliente.",
  },
  "orcamento.margemInterna": {
    title: "Margem Interna",
    description: "Margem calculada apenas para acompanhamento interno; não aparece no documento do cliente.",
  },
  "orcamento.custoInterno": {
    title: "Custo Interno",
    description: "Despesas contabilizadas como custos do orçamento. No documento do cliente aparecem apenas como “Custo dos Serviços”.",
  },

  // ───── Despesas ─────
  "despesa.geral": {
    title: "Despesa",
    description: "Gastos relacionados à operação ou execução dos serviços.",
  },
  "despesa.categoria": {
    title: "Categoria da Despesa",
    description: "Agrupamento contábil da despesa (combustível, mão de obra, materiais, taxas, etc.).",
  },
  "despesa.pendente": {
    title: "Despesa Pendente",
    description: "Despesa originada de um orçamento ainda não convertido em serviço — não impacta o caixa.",
  },
  "despesa.confirmada": {
    title: "Despesa Confirmada",
    description: "Despesa efetivada que impacta o resultado financeiro do período.",
  },
  "despesa.vinculoOrcamento": {
    title: "Vínculo com Orçamento",
    description: "Indica o orçamento ou serviço que originou esta despesa.",
  },

  // ───── Pagamentos ─────
  "pagamento.forma": {
    title: "Forma de Pagamento",
    description: "Meio usado pelo cliente para pagar. Ex.: PIX, boleto, cartão ou transferência.",
  },
  "pagamento.situacao": {
    title: "Situação do Pagamento",
    description: "Estado atual do pagamento: pago, pendente, atrasado, parcial ou cancelado.",
  },
  "pagamento.parcelamento": {
    title: "Parcelamento",
    description: "Quantidade de parcelas em que o valor foi dividido.",
  },

  // ───── Clientes ─────
  "cliente.cpfCnpj": {
    title: "CPF/CNPJ",
    description: "Documento brasileiro do cliente, com validação automática de formato.",
  },
  "cliente.timeline": {
    title: "Linha do Tempo",
    description: "Histórico completo do cliente: propriedades, orçamentos, serviços e eventos.",
  },
  "cliente.tags": {
    title: "Tags",
    description: "Marcadores livres para segmentar e filtrar clientes.",
  },

  // ───── Propriedades ─────
  "propriedade.area": {
    title: "Área",
    description: "Área da propriedade em hectares, calculada a partir da geometria importada.",
  },
  "propriedade.geometria": {
    title: "Geometria",
    description: "Polígono da propriedade carregado via KML, KMZ ou desenho manual.",
  },
  "propriedade.kml": {
    title: "Arquivo KML",
    description: "Envie um KML/KMZ para extrair automaticamente os limites da propriedade.",
  },
  "propriedade.car": {
    title: "CAR",
    description: "Cadastro Ambiental Rural vinculado à propriedade.",
  },

  // ───── Importação ─────
  "importacao.geral": {
    title: "Importação de Dados",
    description:
      "Envie uma planilha para o sistema identificar clientes, propriedades, serviços, receitas e despesas automaticamente.",
  },
  "importacao.colunaPlanilha": {
    title: "Coluna da Planilha",
    description: "Nome original da coluna detectado no arquivo enviado.",
  },
  "importacao.confianca": {
    title: "Confiança do Mapeamento",
    description: "Grau de certeza do sistema ao associar a coluna a um campo conhecido. Alta ≥ 80%, média ≥ 45%.",
  },
  "importacao.campoPersonalizado": {
    title: "Campo Personalizado",
    description: "A coluna será preservada como atributo extra, sem entrar nas métricas padrão.",
  },

  // ───── Configurações ─────
  "config.empresa": {
    title: "Dados da Empresa",
    description: "Informações exibidas em orçamentos, PDFs e comunicações com o cliente.",
  },
  "config.notificacoes": {
    title: "Notificações",
    description: "Controle quais alertas você recebe por e-mail e no aplicativo.",
  },
  "config.integracoes": {
    title: "Integrações",
    description: "Conexões com serviços externos como Google Calendar e Stripe.",
  },
  "config.plano": {
    title: "Plano",
    description: "Plano de assinatura ativo, limites de uso e data de renovação.",
  },
  "config.equipe": {
    title: "Equipe",
    description: "Membros com acesso ao tenant e seus papéis.",
  },
  "config.roles": {
    title: "Papéis e Permissões",
    description: "Define o que cada membro pode visualizar, criar ou editar.",
  },

  // ───── Relatórios ─────
  "relatorio.executivo": {
    title: "Relatório Executivo",
    description: "Narrativa consolidada do período com KPIs, variações e destaques operacionais.",
  },
  "relatorio.variacaoMoM": {
    title: "Variação Mensal",
    description: "Diferença percentual em relação ao mês anterior.",
    calculation: "((Mês atual − Mês anterior) ÷ Mês anterior) × 100",
  },
  "relatorio.periodo": {
    title: "Período",
    description: "Intervalo de datas que define o recorte das métricas exibidas.",
  },

  // ───── Dashboard ─────
  "dashboard.alertas": {
    title: "Alertas Financeiros",
    description: "Eventos críticos detectados automaticamente: inadimplência, queda de margem, despesas acima do previsto.",
  },
  "dashboard.proximasAcoes": {
    title: "Próximas Ações",
    description: "Tarefas e compromissos sugeridos com base nos prazos de projetos e orçamentos.",
  },
  "dashboard.conflitos": {
    title: "Conflitos de Agenda",
    description: "Compromissos com sobreposição de horário detectados no calendário.",
  },

  // ───── Filtros / Controles ─────
  "filtros.periodo": {
    title: "Filtro de Período",
    description: "Define o intervalo aplicado a todos os indicadores e listagens da tela.",
  },
  "filtros.tenant": {
    title: "Empresa Ativa",
    description: "Selecione o tenant (empresa) cujos dados serão exibidos.",
  },
  "filtros.densidade": {
    title: "Densidade",
    description: "Ajusta o espaçamento entre linhas de tabelas e cards.",
  },
  "filtros.daltonismo": {
    title: "Modo Daltônico",
    description: "Substitui a paleta por cores acessíveis para pessoas com deficiência visual cromática.",
  },
} as const;

export type TooltipKey = keyof typeof TOOLTIPS;

/**
 * Recupera uma entrada do catálogo. Em desenvolvimento, avisa se a chave não existir
 * para evitar tooltips silenciosamente vazios.
 */
export function getTooltip(key: string): TooltipEntry | undefined {
  const entry = (TOOLTIPS as Record<string, TooltipEntry>)[key];
  if (!entry && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[tooltips] chave desconhecida: "${key}"`);
  }
  return entry;
}
