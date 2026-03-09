import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TopCliente, ServicoCusto, OrcamentoPendente, ReceitaCategoria } from "@/hooks/useRelatorioData";

// Color palette
const SKYGEO_BLUE = rgb(30 / 255, 58 / 255, 95 / 255);
const ALERT_RED = rgb(220 / 255, 38 / 255, 38 / 255);
const SUCCESS_GREEN = rgb(22 / 255, 163 / 255, 74 / 255);
const GRAY_600 = rgb(75 / 255, 85 / 255, 99 / 255);
const GRAY_400 = rgb(156 / 255, 163 / 255, 175 / 255);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

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
  insights: string[];
  isDraft: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
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

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK
) {
  page.drawText(text, { x, y, size, font, color });
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = GRAY_400,
  thickness = 1
) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color = SKYGEO_BLUE,
  options?: { borderWidth?: number; borderColor?: typeof BLACK }
) {
  page.drawRectangle({ x, y, width, height, color, ...options });
}

export async function generateReportPDF(data: ReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const reportId = generateReportId();
  const dataEmissao = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  // === HEADER ===
  drawText(page, "SkyGeo", margin, y, helveticaBold, 24, SKYGEO_BLUE);
  drawText(page, "Inteligência Geoespacial & Gestão", margin, y - 18, helvetica, 8, GRAY_400);

  // Right side metadata
  const rightX = pageWidth - margin - 120;
  drawText(page, `ID: ${reportId}`, rightX, y, helvetica, 8, GRAY_600);
  drawText(page, `Emissão: ${dataEmissao}`, rightX, y - 12, helvetica, 8, GRAY_600);
  drawText(page, `Responsável: ${data.empresa}`, rightX, y - 24, helvetica, 8, GRAY_600);

  y -= 50;
  drawLine(page, margin, y, pageWidth - margin, y, SKYGEO_BLUE, 2);
  y -= 25;

  // === TITLE ===
  drawText(page, "Relatório de Gestão Financeira", margin, y, helveticaBold, 16, BLACK);
  y -= 18;
  drawText(page, data.periodoLabel, margin, y, helvetica, 12, SKYGEO_BLUE);
  y -= 30;

  // === DRAFT WATERMARK ===
  if (data.isDraft) {
    page.drawText("RASCUNHO", {
      x: pageWidth / 2 - 100,
      y: pageHeight / 2,
      size: 60,
      font: helveticaBold,
      color: rgb(0.9, 0.9, 0.9),
      rotate: { angle: -30, type: "degrees" },
      opacity: 0.3,
    } as any);
  }

  // === TABLE OF CONTENTS ===
  drawRect(page, margin, y - 35, contentWidth, 35, rgb(0.97, 0.98, 0.99));
  drawText(page, "CONTEÚDO", margin + 10, y - 12, helveticaBold, 7, SKYGEO_BLUE);
  const sections = ["1. Sumário Executivo", "2. KPIs", "3. Top Clientes", "4. Categorias", "5. Plano de Ação"];
  drawText(page, sections.join("   •   "), margin + 10, y - 26, helvetica, 7, GRAY_600);
  y -= 50;

  // === HEALTH STATUS ===
  const isHealthy = data.lucroLiquido >= 0 && (data.variacaoReceita === null || data.variacaoReceita >= 0);
  const statusColor = isHealthy ? rgb(0.94, 0.99, 0.95) : rgb(1, 0.98, 0.92);
  const statusTextColor = isHealthy ? SUCCESS_GREEN : rgb(0.85, 0.47, 0.02);
  drawRect(page, margin, y - 25, contentWidth, 25, statusColor);
  drawRect(page, margin, y - 25, 3, 25, statusTextColor);
  drawText(page, isHealthy ? "● Saudável" : "● Atenção", margin + 12, y - 17, helveticaBold, 9, statusTextColor);
  const statusText = data.variacaoReceita !== null
    ? ` — ${data.variacaoReceita >= 0 ? "+" : ""}${formatPercent(data.variacaoReceita)} vs. mês anterior`
    : "";
  drawText(page, `Estado de Saúde Financeira${statusText}`, margin + 85, y - 17, helvetica, 9, GRAY_600);
  y -= 45;

  // === KPI BAND ===
  const kpiWidth = contentWidth / 3;
  const kpis = [
    { label: "Faturamento", value: formatCurrency(data.receitaTotal), color: SKYGEO_BLUE },
    { label: "Total Gasto", value: formatCurrency(data.despesaTotal), color: ALERT_RED },
    { label: "Lucro Líquido", value: formatCurrency(data.lucroLiquido), color: data.lucroLiquido >= 0 ? SUCCESS_GREEN : ALERT_RED },
  ];

  drawLine(page, margin, y, pageWidth - margin, y, GRAY_400, 0.5);
  y -= 50;

  kpis.forEach((kpi, i) => {
    const x = margin + i * kpiWidth + kpiWidth / 2;
    drawText(page, kpi.label, x - 30, y + 25, helvetica, 8, GRAY_600);
    drawText(page, kpi.value, x - 40, y + 8, helveticaBold, 14, kpi.color);
  });

  y -= 20;
  drawLine(page, margin, y, pageWidth - margin, y, GRAY_400, 0.5);
  y -= 30;

  // === TOP CLIENTES ===
  if (data.topClientes.length > 0) {
    drawText(page, "TOP CLIENTES POR FATURAMENTO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 20;

    data.topClientes.slice(0, 3).forEach((cliente, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      drawText(page, `${i + 1}º ${cliente.nome}`, margin + 20, y, helvetica, 10, BLACK);
      drawText(page, formatCurrency(cliente.receita), margin + 250, y, helveticaBold, 10, SKYGEO_BLUE);
      drawText(page, `${formatPercent(cliente.percentual)} do total`, margin + 350, y, helvetica, 9, GRAY_600);
      y -= 18;
    });
    y -= 20;
  }

  // === RECEITA POR CATEGORIA ===
  const validCategorias = data.receitaCategorias.filter((c) => {
    const cat = c.categoria?.toLowerCase().trim();
    return cat && cat !== "sem categoria" && cat !== "outros" && cat !== "null";
  });

  if (validCategorias.length > 0) {
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

  // === SERVIÇOS E CUSTOS (TABLE) ===
  if (data.servicosCusto.length > 0 && y > 200) {
    drawText(page, "SERVIÇOS E CUSTOS", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 18;

    // Table header
    drawRect(page, margin, y - 15, contentWidth, 18, rgb(0.95, 0.96, 0.98));
    drawText(page, "Serviço", margin + 5, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Receita", margin + 200, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Custo", margin + 280, y - 10, helveticaBold, 8, GRAY_600);
    drawText(page, "Margem", margin + 360, y - 10, helveticaBold, 8, GRAY_600);
    y -= 22;

    data.servicosCusto.slice(0, 8).forEach((srv) => {
      const nomeShort = srv.nome.length > 30 ? srv.nome.substring(0, 27) + "..." : srv.nome;
      drawText(page, nomeShort, margin + 5, y, helvetica, 8, BLACK);
      drawText(page, formatCurrency(srv.receita), margin + 200, y, helvetica, 8, SUCCESS_GREEN);
      drawText(page, formatCurrency(srv.custo), margin + 280, y, helvetica, 8, ALERT_RED);
      drawText(page, formatPercent(srv.margem), margin + 360, y, helveticaBold, 8, srv.margem >= 0 ? SUCCESS_GREEN : ALERT_RED);
      y -= 15;
    });
    y -= 20;
  }

  // === INSIGHTS / PLANO DE AÇÃO ===
  if (data.insights.length > 0 && y > 150) {
    // Check if we need a new page
    if (y < 200) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    drawText(page, "PLANO DE AÇÃO", margin, y, helveticaBold, 10, SKYGEO_BLUE);
    y -= 20;

    data.insights.slice(0, 4).forEach((insight, i) => {
      const lines = wrapText(insight, 85);
      lines.forEach((line, li) => {
        if (li === 0) {
          drawText(page, `${i + 1}.`, margin, y, helveticaBold, 9, SKYGEO_BLUE);
        }
        drawText(page, line, margin + 15, y, helvetica, 9, BLACK);
        y -= 14;
      });
      y -= 4;
    });
  }

  // === FOOTER ===
  drawLine(page, margin, 50, pageWidth - margin, 50, GRAY_400, 0.5);
  drawText(page, `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | SkyGeo - Inteligência Geoespacial`, margin, 35, helvetica, 7, GRAY_400);

  return pdfDoc.save();
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
