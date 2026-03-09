import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TopCliente, ServicoCusto, OrcamentoPendente, ReceitaCategoria, DadoSemanal, ClienteNovo, HistoricoMensal } from "@/hooks/useRelatorioData";

// Color palette
const SKYGEO_BLUE = rgb(30 / 255, 58 / 255, 95 / 255);
const ALERT_RED = rgb(220 / 255, 38 / 255, 38 / 255);
const SUCCESS_GREEN = rgb(22 / 255, 163 / 255, 74 / 255);
const GRAY_600 = rgb(75 / 255, 85 / 255, 99 / 255);
const GRAY_400 = rgb(156 / 255, 163 / 255, 175 / 255);
const GRAY_200 = rgb(229 / 255, 231 / 255, 235 / 255);
const BLACK = rgb(0, 0, 0);
const LIGHT_BG = rgb(0.97, 0.98, 0.99);
const ACCENT_PURPLE = rgb(124 / 255, 58 / 255, 237 / 255);
const ACCENT_CYAN = rgb(6 / 255, 182 / 255, 212 / 255);
const AMBER_100 = rgb(254 / 255, 243 / 255, 199 / 255);
const AMBER_600 = rgb(217 / 255, 119 / 255, 6 / 255);

interface AIInsight {
  tipo?: string;
  titulo: string;
  descricao: string;
  acao?: string;
}

interface ReportData {
  empresa: string;
  periodoLabel: string;
  receitaTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  margemLucro: number;
  taxaConversao: number;
  variacaoReceita: number | null;
  // NEW: MoM variations
  variacaoDespesa?: number | null;
  variacaoLucro?: number | null;
  receitaAnterior?: number;
  despesaAnterior?: number;
  lucroAnterior?: number;
  // Data arrays
  topClientes: TopCliente[];
  servicosCusto: ServicoCusto[];
  orcamentosPendentes: OrcamentoPendente[];
  receitaCategorias: ReceitaCategoria[];
  dadosSemanais: DadoSemanal[];
  clientesNovos: ClienteNovo[];
  historico12Meses: HistoricoMensal[];
  aiInsights: AIInsight[];
  insights: string[];
  isDraft: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatVariation(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function generateReportId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `SG-${id}`;
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = BLACK) {
  page.drawText(text, { x, y, size, font, color });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color = GRAY_400, thickness = 1) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

function drawRect(page: PDFPage, x: number, y: number, width: number, height: number, color = SKYGEO_BLUE) {
  page.drawRectangle({ x, y, width, height, color });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  words.forEach((word) => {
    if ((currentLine + " " + word).length > maxChars) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Generate narrative highlights based on data
function generateDestaques(data: ReportData): string[] {
  const destaques: string[] = [];
  
  // Revenue variation
  if (data.variacaoReceita !== null) {
    if (data.variacaoReceita > 10) {
      destaques.push(`Crescimento expressivo de ${formatVariation(data.variacaoReceita)} no faturamento em relacao ao mes anterior.`);
    } else if (data.variacaoReceita > 0) {
      destaques.push(`Faturamento cresceu ${formatVariation(data.variacaoReceita)} em comparacao ao periodo anterior.`);
    } else if (data.variacaoReceita < -10) {
      destaques.push(`Queda significativa de ${formatVariation(data.variacaoReceita)} no faturamento requer atencao.`);
    } else if (data.variacaoReceita < 0) {
      destaques.push(`Faturamento retraiu ${formatVariation(data.variacaoReceita)} em comparacao ao mes anterior.`);
    }
  }
  
  // Profit margin status
  if (data.margemLucro >= 30) {
    destaques.push(`Margem de lucro saudavel de ${formatPercent(data.margemLucro)} indica boa rentabilidade.`);
  } else if (data.margemLucro >= 15) {
    destaques.push(`Margem de lucro de ${formatPercent(data.margemLucro)} esta dentro da media do setor.`);
  } else if (data.margemLucro > 0) {
    destaques.push(`Margem de ${formatPercent(data.margemLucro)} esta apertada; considere revisar custos.`);
  } else {
    destaques.push(`Operacao com prejuizo (margem ${formatPercent(data.margemLucro)}); acao corretiva necessaria.`);
  }
  
  // Pending quotes
  if (data.orcamentosPendentes.length > 0) {
    const totalPendente = data.orcamentosPendentes.reduce((s, o) => s + o.valor, 0);
    destaques.push(`${data.orcamentosPendentes.length} orcamento(s) pendente(s) totalizam ${formatCurrency(totalPendente)} em potencial.`);
  }
  
  // New clients
  if (data.clientesNovos.length > 0) {
    destaques.push(`${data.clientesNovos.length} novo(s) cliente(s) cadastrado(s) no periodo.`);
  }
  
  // Conversion rate
  if (data.taxaConversao >= 50) {
    destaques.push(`Taxa de conversao de ${formatPercent(data.taxaConversao)} esta acima da media.`);
  } else if (data.taxaConversao < 30 && data.taxaConversao > 0) {
    destaques.push(`Taxa de conversao de ${formatPercent(data.taxaConversao)} pode ser otimizada.`);
  }
  
  return destaques.slice(0, 4);
}

// Generate executive summary paragraph
function generateSumarioExecutivo(data: ReportData): string {
  const status = data.lucroLiquido >= 0 ? "positivo" : "negativo";
  const tendencia = data.variacaoReceita !== null 
    ? (data.variacaoReceita >= 0 ? "crescente" : "decrescente") 
    : "estavel";
  
  return `No periodo de ${data.periodoLabel}, a empresa registrou faturamento de ${formatCurrency(data.receitaTotal)} ` +
    `com despesas totais de ${formatCurrency(data.despesaTotal)}, resultando em ${status === "positivo" ? "lucro" : "prejuizo"} ` +
    `de ${formatCurrency(Math.abs(data.lucroLiquido))}. A tendencia de faturamento e ${tendencia}` +
    (data.variacaoReceita !== null ? ` (${formatVariation(data.variacaoReceita)})` : "") +
    `, e a margem operacional atingiu ${formatPercent(data.margemLucro)}. ` +
    (data.taxaConversao > 0 ? `A taxa de conversao de orcamentos foi de ${formatPercent(data.taxaConversao)}.` : "");
}

export async function generateReportPDF(data: ReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const footerHeight = 60;

  let pageNum = 1;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const reportId = generateReportId();
  const dataEmissao = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  function drawFooter(p: PDFPage, num: number) {
    drawLine(p, margin, footerHeight, pageWidth - margin, footerHeight, GRAY_400, 0.5);
    drawText(p, `Gerado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })} | SkyGeo - Inteligencia Geoespacial`, margin, footerHeight - 15, helvetica, 7, GRAY_400);
    drawText(p, `Pagina ${num}`, pageWidth - margin - 40, footerHeight - 15, helvetica, 7, GRAY_400);
  }

  function ensureSpace(needed: number): void {
    if (y - needed < footerHeight + 20) {
      drawFooter(page, pageNum);
      pageNum++;
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  // === HEADER ===
  drawText(page, "SkyGeo", margin, y, helveticaBold, 24, SKYGEO_BLUE);
  drawText(page, "Inteligencia Geoespacial & Gestao", margin, y - 18, helvetica, 8, GRAY_400);
  const rightX = pageWidth - margin - 120;
  drawText(page, `ID: ${reportId}`, rightX, y, helvetica, 8, GRAY_600);
  drawText(page, `Emissao: ${dataEmissao}`, rightX, y - 12, helvetica, 8, GRAY_600);
  drawText(page, `Responsavel: ${data.empresa}`, rightX, y - 24, helvetica, 8, GRAY_600);
  y -= 50;
  drawLine(page, margin, y, pageWidth - margin, y, SKYGEO_BLUE, 2);
  y -= 25;

  // === TITLE ===
  drawText(page, "Relatorio de Gestao Financeira", margin, y, helveticaBold, 16, BLACK);
  y -= 18;
  drawText(page, data.periodoLabel, margin, y, helvetica, 12, SKYGEO_BLUE);
  y -= 30;

  // === DRAFT WATERMARK ===
  if (data.isDraft) {
    page.drawText("RASCUNHO", {
      x: pageWidth / 2 - 100, y: pageHeight / 2, size: 60, font: helveticaBold,
      color: rgb(0.9, 0.9, 0.9), rotate: { angle: -30, type: "degrees" }, opacity: 0.3,
    } as any);
  }

  // === TOC ===
  drawRect(page, margin, y - 35, contentWidth, 35, LIGHT_BG);
  drawText(page, "CONTEUDO", margin + 10, y - 12, helveticaBold, 7, SKYGEO_BLUE);
  const sections = ["1. Destaques", "2. KPIs", "3. Semanal", "4. Categorias", "5. Top Clientes", "6. Historico", "7. Servicos", "8. Clientes", "9. Orcamentos", "10. Insights"];
  drawText(page, sections.join("  •  "), margin + 10, y - 26, helvetica, 6, GRAY_600);
  y -= 50;

  // === HEALTH STATUS ===
  const isHealthy = data.lucroLiquido >= 0 && (data.variacaoReceita === null || data.variacaoReceita >= 0);
  const statusColor = isHealthy ? rgb(0.94, 0.99, 0.95) : rgb(1, 0.98, 0.92);
  const statusTextColor = isHealthy ? SUCCESS_GREEN : rgb(0.85, 0.47, 0.02);
  drawRect(page, margin, y - 25, contentWidth, 25, statusColor);
  drawRect(page, margin, y - 25, 3, 25, statusTextColor);
  drawText(page, isHealthy ? "[OK] Saudavel" : "[!] Atencao", margin + 12, y - 17, helveticaBold, 9, statusTextColor);
  const statusText = data.variacaoReceita !== null ? ` — ${data.variacaoReceita >= 0 ? "+" : ""}${formatPercent(data.variacaoReceita)} vs. mes anterior` : "";
  drawText(page, `Saude Financeira${statusText}`, margin + 85, y - 17, helvetica, 9, GRAY_600);
  y -= 45;

  // === DESTAQUES DO PERÍODO (Storytelling) ===
  const destaques = generateDestaques(data);
  if (destaques.length > 0) {
    ensureSpace(25 + destaques.length * 14);
    drawText(page, "DESTAQUES DO PERIODO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Identifique rapidamente os pontos de atencao do periodo.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 26;
    destaques.forEach((dest, i) => {
      drawText(page, `•`, margin + 5, y, helveticaBold, 9, SKYGEO_BLUE);
      const lines = wrapText(dest, 85);
      lines.forEach((line) => {
        drawText(page, line, margin + 15, y, helvetica, 9, GRAY_600);
        y -= 12;
      });
      y -= 2;
    });
    y -= 10;
  }

  // === KPI BAND (5 KPIs with MoM indicators) ===
  ensureSpace(80);
  drawText(page, "INDICADORES-CHAVE (KPIs)", margin, y, helveticaBold, 10, SKYGEO_BLUE);
  drawText(page, "Metricas essenciais do periodo com variacao em relacao ao mes anterior.", margin, y - 12, helvetica, 7, GRAY_400);
  y -= 28;
  
  const kpiWidth = contentWidth / 5;
  const kpis = [
    { label: "Faturamento", value: formatCurrency(data.receitaTotal), variation: data.variacaoReceita, color: SKYGEO_BLUE },
    { label: "Total Gasto", value: formatCurrency(data.despesaTotal), variation: data.variacaoDespesa, color: ALERT_RED, invertVariation: true },
    { label: "Lucro Liquido", value: formatCurrency(data.lucroLiquido), variation: data.variacaoLucro, color: data.lucroLiquido >= 0 ? SUCCESS_GREEN : ALERT_RED },
    { label: "Margem Lucro", value: formatPercent(data.margemLucro), color: data.margemLucro >= 0 ? SUCCESS_GREEN : ALERT_RED },
    { label: "Tx. Conversao", value: formatPercent(data.taxaConversao), color: ACCENT_PURPLE },
  ];

  drawLine(page, margin, y, pageWidth - margin, y, GRAY_400, 0.5);
  y -= 50;
  kpis.forEach((kpi, i) => {
    const x = margin + i * kpiWidth;
    drawText(page, kpi.label, x + 5, y + 32, helvetica, 7, GRAY_600);
    drawText(page, kpi.value, x + 5, y + 16, helveticaBold, 10, kpi.color);
    // MoM variation indicator
    if (kpi.variation !== undefined && kpi.variation !== null) {
      const varColor = kpi.invertVariation 
        ? (kpi.variation <= 0 ? SUCCESS_GREEN : ALERT_RED)
        : (kpi.variation >= 0 ? SUCCESS_GREEN : ALERT_RED);
      const arrow = kpi.variation >= 0 ? "(+)" : "(-)";
      drawText(page, `${arrow} ${formatVariation(kpi.variation)}`, x + 5, y + 3, helvetica, 7, varColor);
    }
  });
  y -= 5;
  drawLine(page, margin, y, pageWidth - margin, y, GRAY_400, 0.5);
  y -= 25;

  // === SUMÁRIO EXECUTIVO NARRATIVO ===
  ensureSpace(60);
  drawText(page, "SUMARIO EXECUTIVO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
  y -= 15;
  const sumario = generateSumarioExecutivo(data);
  const sumarioLines = wrapText(sumario, 95);
  sumarioLines.forEach((line) => {
    drawText(page, line, margin, y, helvetica, 9, GRAY_600);
    y -= 12;
  });
  y -= 15;

  // === WEEKLY CHART (Entradas vs Saídas) ===
  if (data.dadosSemanais.length > 0) {
    ensureSpace(120);
    drawText(page, "ENTRADAS VS SAIDAS (SEMANAL)", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Compare entradas e saidas semanais para identificar padroes de fluxo de caixa.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    const maxVal = Math.max(...data.dadosSemanais.map(d => Math.max(d.entradas, d.saidas)), 1);
    const barMaxWidth = 180;
    const barHeight = 10;

    data.dadosSemanais.forEach((sem) => {
      ensureSpace(35);
      drawText(page, sem.semana, margin, y - 5, helvetica, 8, GRAY_600);
      const labelX = margin + 45;
      // Entradas bar
      const eW = (sem.entradas / maxVal) * barMaxWidth;
      drawRect(page, labelX, y - 2, eW, barHeight, SUCCESS_GREEN);
      drawText(page, formatCurrency(sem.entradas), labelX + eW + 5, y, helvetica, 7, SUCCESS_GREEN);
      y -= 14;
      // Saídas bar
      const sW = (sem.saidas / maxVal) * barMaxWidth;
      drawRect(page, labelX, y - 2, sW, barHeight, ALERT_RED);
      drawText(page, formatCurrency(sem.saidas), labelX + sW + 5, y, helvetica, 7, ALERT_RED);
      y -= 18;
    });
    y -= 10;
  }

  // === RECEITA POR CATEGORIA (with categorization alert) ===
  const validCategorias = data.receitaCategorias.filter((c) => {
    const cat = c.categoria?.toLowerCase().trim();
    return cat && cat !== "sem categoria" && cat !== "outros" && cat !== "null";
  });

  const hasUncategorized = data.receitaCategorias.some((c) => {
    const cat = c.categoria?.toLowerCase().trim();
    return !cat || cat === "sem categoria" || cat === "outros" || cat === "null";
  });

  // Categorization alert
  if (hasUncategorized && validCategorias.length === 0) {
    ensureSpace(40);
    drawRect(page, margin, y - 30, contentWidth, 30, AMBER_100);
    drawRect(page, margin, y - 30, 3, 30, AMBER_600);
    drawText(page, "[!] Dados nao categorizados", margin + 12, y - 18, helveticaBold, 9, AMBER_600);
    drawText(page, "Categorize seus servicos em Cadastros > Categorias para melhor analise.", margin + 160, y - 18, helvetica, 8, GRAY_600);
    y -= 45;
  }

  if (validCategorias.length > 0) {
    ensureSpace(30 + validCategorias.slice(0, 5).length * 20);
    drawText(page, "RECEITA POR CATEGORIA", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Identifique quais categorias de servico geram mais receita.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    const maxVal = Math.max(...validCategorias.map((c) => c.valor));
    validCategorias.slice(0, 5).forEach((cat) => {
      const barWidth = (cat.valor / maxVal) * 200;
      drawRect(page, margin, y - 10, barWidth, 12, SKYGEO_BLUE);
      drawText(page, cat.categoria, margin + barWidth + 10, y - 8, helvetica, 9, BLACK);
      drawText(page, formatCurrency(cat.valor), margin + 350, y - 8, helveticaBold, 9, SKYGEO_BLUE);
      y -= 20;
    });
    y -= 15;
  }

  // === TOP CLIENTES (with ranking indicators) ===
  if (data.topClientes.length > 0) {
    ensureSpace(30 + data.topClientes.slice(0, 3).length * 22);
    drawText(page, "TOP CLIENTES POR FATURAMENTO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Clientes com maior contribuicao para o faturamento do periodo.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    data.topClientes.slice(0, 3).forEach((cliente, i) => {
      // Ranking badge
      const rankLabels = ["1º", "2º", "3º"];
      const badgeColor = i === 0 ? rgb(255/255, 215/255, 0/255) : (i === 1 ? rgb(192/255, 192/255, 192/255) : rgb(205/255, 127/255, 50/255));
      drawRect(page, margin, y - 12, 20, 16, badgeColor);
      drawText(page, rankLabels[i], margin + 4, y - 8, helveticaBold, 8, BLACK);
      // Client info
      drawText(page, cliente.nome.length > 30 ? cliente.nome.substring(0, 27) + "..." : cliente.nome, margin + 28, y - 5, helvetica, 10, BLACK);
      drawText(page, formatCurrency(cliente.receita), margin + 280, y - 5, helveticaBold, 10, SKYGEO_BLUE);
      drawText(page, `${formatPercent(cliente.percentual)} do total`, margin + 400, y - 5, helvetica, 9, GRAY_600);
      y -= 22;
    });
    y -= 15;
  }

  // === 12-MONTH REVENUE TREND ===
  if (data.historico12Meses.length > 0) {
    ensureSpace(110);
    drawText(page, "TENDENCIA DE RECEITA (12 MESES)", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Acompanhe a evolucao do faturamento ao longo do ultimo ano.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    const maxRec = Math.max(...data.historico12Meses.map(h => h.receita), 1);
    const barW = (contentWidth - 10) / 12;
    const chartHeight = 50;
    // Draw baseline
    drawLine(page, margin, y - chartHeight, margin + contentWidth, y - chartHeight, GRAY_200, 0.5);

    data.historico12Meses.forEach((h, i) => {
      const bH = (h.receita / maxRec) * chartHeight;
      const bx = margin + i * barW + 2;
      drawRect(page, bx, y - chartHeight, barW - 4, bH, ACCENT_CYAN);
      // Label below
      drawText(page, h.label, bx, y - chartHeight - 10, helvetica, 5, GRAY_600);
    });
    y -= chartHeight + 25;
  }

  // === SERVIÇOS E CUSTOS TABLE (enriched with margin contrib. and highlight) ===
  if (data.servicosCusto.length > 0) {
    ensureSpace(30 + data.servicosCusto.slice(0, 8).length * 15 + 35);
    drawText(page, "SERVICOS E CUSTOS", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Analise rentabilidade por servico. Margens negativas destacadas em vermelho.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    drawRect(page, margin, y - 15, contentWidth, 18, LIGHT_BG);
    drawText(page, "Servico", margin + 5, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Receita", margin + 200, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Custo", margin + 280, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Contrib.", margin + 360, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Margem", margin + 440, y - 10, helveticaBold, 8, GRAY_600);
    y -= 22;

    let totalReceita = 0, totalCusto = 0;
    data.servicosCusto.slice(0, 8).forEach((srv) => {
      ensureSpace(18);
      const margemContrib = srv.receita - srv.custo;
      const isNegative = srv.margem < 0;
      // Row highlight for negative margin
      if (isNegative) {
        drawRect(page, margin, y - 10, contentWidth, 14, rgb(1, 0.95, 0.95));
      }
      const nomeShort = srv.nome.length > 28 ? srv.nome.substring(0, 25) + "..." : srv.nome;
      drawText(page, nomeShort, margin + 5, y, helvetica, 8, BLACK);
      drawText(page, formatCurrency(srv.receita), margin + 200, y, helvetica, 8, SUCCESS_GREEN);
      drawText(page, formatCurrency(srv.custo), margin + 280, y, helvetica, 8, ALERT_RED);
      drawText(page, formatCurrency(margemContrib), margin + 360, y, helvetica, 8, margemContrib >= 0 ? SUCCESS_GREEN : ALERT_RED);
      drawText(page, formatPercent(srv.margem), margin + 440, y, helveticaBold, 8, srv.margem >= 0 ? SUCCESS_GREEN : ALERT_RED);
      totalReceita += srv.receita;
      totalCusto += srv.custo;
      y -= 15;
    });
    // Summary row
    drawLine(page, margin, y, margin + contentWidth, y, GRAY_400, 0.5);
    y -= 12;
    const totalContrib = totalReceita - totalCusto;
    const avgMargem = totalReceita > 0 ? ((totalContrib / totalReceita) * 100) : 0;
    drawText(page, "TOTAL/MEDIA", margin + 5, y, helveticaBold, 8, BLACK);
    drawText(page, formatCurrency(totalReceita), margin + 200, y, helveticaBold, 8, SUCCESS_GREEN);
    drawText(page, formatCurrency(totalCusto), margin + 280, y, helveticaBold, 8, ALERT_RED);
    drawText(page, formatCurrency(totalContrib), margin + 360, y, helveticaBold, 8, totalContrib >= 0 ? SUCCESS_GREEN : ALERT_RED);
    drawText(page, formatPercent(avgMargem), margin + 440, y, helveticaBold, 8, avgMargem >= 0 ? SUCCESS_GREEN : ALERT_RED);
    y -= 20;
  }

  // === CLIENTES NOVOS TABLE ===
  if (data.clientesNovos.length > 0) {
    ensureSpace(30 + Math.min(data.clientesNovos.length, 10) * 15 + 20);
    drawText(page, `NOVOS CLIENTES (${data.clientesNovos.length})`, margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Clientes cadastrados no periodo selecionado.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    drawRect(page, margin, y - 15, contentWidth, 18, LIGHT_BG);
    drawText(page, "Nome", margin + 5, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Data Cadastro", margin + 200, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Telefone", margin + 300, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "E-mail", margin + 400, y - 10, helveticaBold, 8, GRAY_600);
    y -= 22;

    data.clientesNovos.slice(0, 10).forEach((c) => {
      ensureSpace(18);
      const nome = c.nome.length > 28 ? c.nome.substring(0, 25) + "..." : c.nome;
      drawText(page, nome, margin + 5, y, helvetica, 8, BLACK);
      drawText(page, c.data_cadastro ? format(new Date(c.data_cadastro), "dd/MM/yyyy") : "—", margin + 200, y, helvetica, 8, GRAY_600);
      drawText(page, c.telefone || "—", margin + 300, y, helvetica, 8, GRAY_600);
      const email = c.email ? (c.email.length > 20 ? c.email.substring(0, 17) + "..." : c.email) : "—";
      drawText(page, email, margin + 400, y, helvetica, 8, GRAY_600);
      y -= 15;
    });
    y -= 15;
  }

  // === ORÇAMENTOS PENDENTES TABLE ===
  if (data.orcamentosPendentes.length > 0) {
    ensureSpace(30 + Math.min(data.orcamentosPendentes.length, 10) * 15 + 20);
    drawText(page, `ORCAMENTOS PENDENTES (${data.orcamentosPendentes.length})`, margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Orcamentos aguardando conversao ou follow-up.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    drawRect(page, margin, y - 15, contentWidth, 18, LIGHT_BG);
    drawText(page, "Codigo", margin + 5, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Cliente", margin + 100, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Valor", margin + 300, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Vencimento", margin + 400, y - 10, helveticaBold, 8, GRAY_600);
    y -= 22;

    data.orcamentosPendentes.slice(0, 10).forEach((o) => {
      ensureSpace(18);
      drawText(page, o.codigo || "—", margin + 5, y, helvetica, 8, BLACK);
      const cliente = o.cliente.length > 28 ? o.cliente.substring(0, 25) + "..." : o.cliente;
      drawText(page, cliente, margin + 100, y, helvetica, 8, GRAY_600);
      drawText(page, formatCurrency(o.valor), margin + 300, y, helveticaBold, 8, SKYGEO_BLUE);
      drawText(page, o.data_faturamento ? format(new Date(o.data_faturamento), "dd/MM/yyyy") : "—", margin + 400, y, helvetica, 8, GRAY_600);
      y -= 15;
    });
    y -= 15;
  }

  // === AI INSIGHTS (full cards with context) ===
  if (data.aiInsights.length > 0) {
    ensureSpace(50);
    drawText(page, "INSIGHTS EXECUTIVOS (IA)", margin, y, helveticaBold, 10, ACCENT_PURPLE);
    drawText(page, "Analise gerada por IA com base nos dados do periodo.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;

    data.aiInsights.slice(0, 5).forEach((insight, i) => {
      const titleLines = wrapText(`${i + 1}. ${insight.titulo}`, 90);
      const descLines = wrapText(insight.descricao, 95);
      const acaoLines = insight.acao ? wrapText(`Acao sugerida: ${insight.acao}`, 95) : [];
      const totalLines = titleLines.length + descLines.length + acaoLines.length;
      ensureSpace(totalLines * 12 + 20);

      // Type indicator
      const tipoColor = insight.tipo === "positivo" ? SUCCESS_GREEN : (insight.tipo === "negativo" ? ALERT_RED : AMBER_600);
      drawRect(page, margin, y - 2, 3, (titleLines.length + descLines.length + acaoLines.length) * 11 + 5, tipoColor);

      // Title
      titleLines.forEach((line) => {
        drawText(page, line, margin + 10, y, helveticaBold, 9, BLACK);
        y -= 12;
      });
      // Description
      descLines.forEach((line) => {
        drawText(page, line, margin + 10, y, helvetica, 8, GRAY_600);
        y -= 11;
      });
      // Action
      acaoLines.forEach((line) => {
        drawText(page, line, margin + 10, y, helvetica, 8, ACCENT_PURPLE);
        y -= 11;
      });
      y -= 8;
    });
    y -= 10;
  }

  // === PLANO DE AÇÃO (fallback if no AI insights) ===
  if (data.insights.length > 0 && data.aiInsights.length === 0) {
    ensureSpace(30 + data.insights.length * 20);
    drawText(page, "PLANO DE ACAO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    drawText(page, "Proximos passos sugeridos com base na analise dos dados.", margin, y - 12, helvetica, 7, GRAY_400);
    y -= 28;
    data.insights.slice(0, 4).forEach((insight, i) => {
      const lines = wrapText(insight, 85);
      lines.forEach((line, li) => {
        ensureSpace(16);
        if (li === 0) drawText(page, `${i + 1}.`, margin, y, helveticaBold, 9, SKYGEO_BLUE);
        drawText(page, line, margin + 15, y, helvetica, 9, BLACK);
        y -= 14;
      });
      y -= 4;
    });
  }

  // === FOOTER on last page ===
  drawFooter(page, pageNum);

  return pdfDoc.save();
}

export async function downloadReportPDF(data: ReportData, filename?: string): Promise<void> {
  const pdfBytes = await generateReportPDF(data);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `relatorio-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
