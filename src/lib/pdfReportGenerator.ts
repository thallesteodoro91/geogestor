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
  const sections = ["1. KPIs", "2. Semanal", "3. Categorias", "4. Top Clientes", "5. Historico", "6. Servicos", "7. Clientes", "8. Orcamentos", "9. Insights"];
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

  // === KPI BAND (5 KPIs) ===
  const kpiWidth = contentWidth / 5;
  const kpis = [
    { label: "Faturamento", value: formatCurrency(data.receitaTotal), color: SKYGEO_BLUE },
    { label: "Total Gasto", value: formatCurrency(data.despesaTotal), color: ALERT_RED },
    { label: "Lucro Liquido", value: formatCurrency(data.lucroLiquido), color: data.lucroLiquido >= 0 ? SUCCESS_GREEN : ALERT_RED },
    { label: "Margem Lucro", value: formatPercent(data.margemLucro), color: data.margemLucro >= 0 ? SUCCESS_GREEN : ALERT_RED },
    { label: "Tx. Conversao", value: formatPercent(data.taxaConversao), color: ACCENT_PURPLE },
  ];

  drawLine(page, margin, y, pageWidth - margin, y, GRAY_400, 0.5);
  y -= 45;
  kpis.forEach((kpi, i) => {
    const x = margin + i * kpiWidth;
    drawText(page, kpi.label, x + 5, y + 22, helvetica, 7, GRAY_600);
    drawText(page, kpi.value, x + 5, y + 6, helveticaBold, 10, kpi.color);
  });
  y -= 15;
  drawLine(page, margin, y, pageWidth - margin, y, GRAY_400, 0.5);
  y -= 30;

  // === WEEKLY CHART (Entradas vs Saídas) ===
  if (data.dadosSemanais.length > 0) {
    ensureSpace(120);
    drawText(page, "ENTRADAS VS SAIDAS (SEMANAL)", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 15;
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

  // === RECEITA POR CATEGORIA ===
  const validCategorias = data.receitaCategorias.filter((c) => {
    const cat = c.categoria?.toLowerCase().trim();
    return cat && cat !== "sem categoria" && cat !== "outros" && cat !== "null";
  });

  if (validCategorias.length > 0) {
    ensureSpace(30 + validCategorias.slice(0, 5).length * 20);
    drawText(page, "RECEITA POR CATEGORIA", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 20;
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

  // === TOP CLIENTES ===
  if (data.topClientes.length > 0) {
    ensureSpace(30 + data.topClientes.slice(0, 3).length * 18);
    drawText(page, "TOP CLIENTES POR FATURAMENTO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 20;
    data.topClientes.slice(0, 3).forEach((cliente, i) => {
      drawText(page, `${i + 1}. ${cliente.nome}`, margin + 5, y, helvetica, 10, BLACK);
      drawText(page, formatCurrency(cliente.receita), margin + 250, y, helveticaBold, 10, SKYGEO_BLUE);
      drawText(page, `${formatPercent(cliente.percentual)} do total`, margin + 370, y, helvetica, 9, GRAY_600);
      y -= 18;
    });
    y -= 15;
  }

  // === 12-MONTH REVENUE TREND ===
  if (data.historico12Meses.length > 0) {
    ensureSpace(100);
    drawText(page, "TENDENCIA DE RECEITA (12 MESES)", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 15;
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

  // === SERVIÇOS E CUSTOS TABLE ===
  if (data.servicosCusto.length > 0) {
    ensureSpace(30 + data.servicosCusto.slice(0, 8).length * 15 + 20);
    drawText(page, "SERVICOS E CUSTOS", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 18;
    drawRect(page, margin, y - 15, contentWidth, 18, LIGHT_BG);
    drawText(page, "Servico", margin + 5, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Receita", margin + 220, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Custo", margin + 310, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Margem", margin + 400, y - 10, helveticaBold, 8, GRAY_600);
    y -= 22;

    data.servicosCusto.slice(0, 8).forEach((srv) => {
      ensureSpace(18);
      const nomeShort = srv.nome.length > 32 ? srv.nome.substring(0, 29) + "..." : srv.nome;
      drawText(page, nomeShort, margin + 5, y, helvetica, 8, BLACK);
      drawText(page, formatCurrency(srv.receita), margin + 220, y, helvetica, 8, SUCCESS_GREEN);
      drawText(page, formatCurrency(srv.custo), margin + 310, y, helvetica, 8, ALERT_RED);
      drawText(page, formatPercent(srv.margem), margin + 400, y, helveticaBold, 8, srv.margem >= 0 ? SUCCESS_GREEN : ALERT_RED);
      y -= 15;
    });
    y -= 15;
  }

  // === CLIENTES NOVOS TABLE ===
  if (data.clientesNovos.length > 0) {
    ensureSpace(30 + Math.min(data.clientesNovos.length, 10) * 15 + 20);
    drawText(page, `NOVOS CLIENTES (${data.clientesNovos.length})`, margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 18;
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
    y -= 18;
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

  // === AI INSIGHTS ===
  if (data.aiInsights.length > 0) {
    ensureSpace(40);
    drawText(page, "INSIGHTS EXECUTIVOS (IA)", margin, y, helveticaBold, 10, ACCENT_PURPLE);
    y -= 20;

    data.aiInsights.slice(0, 5).forEach((insight, i) => {
      const titleLines = wrapText(`${i + 1}. ${insight.titulo}`, 90);
      const descLines = wrapText(insight.descricao, 95);
      const acaoLines = insight.acao ? wrapText(`Acao: ${insight.acao}`, 95) : [];
      const totalLines = titleLines.length + descLines.length + acaoLines.length;
      ensureSpace(totalLines * 12 + 15);

      // Title
      titleLines.forEach((line) => {
        drawText(page, line, margin + 5, y, helveticaBold, 9, BLACK);
        y -= 12;
      });
      // Description
      descLines.forEach((line) => {
        drawText(page, line, margin + 5, y, helvetica, 8, GRAY_600);
        y -= 11;
      });
      // Action
      acaoLines.forEach((line) => {
        drawText(page, line, margin + 5, y, helvetica, 8, ACCENT_PURPLE);
        y -= 11;
      });
      y -= 6;
    });
    y -= 10;
  }

  // === PLANO DE AÇÃO (fallback if no AI insights) ===
  if (data.insights.length > 0 && data.aiInsights.length === 0) {
    ensureSpace(30 + data.insights.length * 20);
    drawText(page, "PLANO DE ACAO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 20;
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
