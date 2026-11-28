import type { ManagerialReport } from '@geogestor/contracts';
import type { Content } from 'pdfmake/interfaces';
import { formatCurrency, formatMonth, formatPeriod } from './reportPresentation';

type FinancialReport = ManagerialReport['financial'];
type MonthlyCash = FinancialReport['monthly'][number];
type CashScale = { min: number; max: number; step: number };

const cardWidth = 348;
const cashHeight = 365;
const categoryHeight = 164;
const monthsPerChart = 7;
const compactNumber = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const categoryGradients = [
  ['#f43f5e', '#ec4899'],
  ['#ef6820', '#fac515'],
  ['#2e90fa', '#0ea5e9']
];

function escapeXml(value: string) {
  return Array.from(value).filter((character) => character >= ' ' || character === '\t' || character === '\r' || character === '\n').join('')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function text(x: number, y: number, value: string, options: {
  size?: number; color?: string; bold?: boolean; anchor?: 'start' | 'middle' | 'end';
} = {}) {
  const { size = 12, color = '#fff', bold = false, anchor = 'start' } = options;
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${bold ? 'bold' : 'normal'}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function fitSize(value: string, width: number, maxSize: number) {
  return Math.min(maxSize, Math.floor(width / (Array.from(value).length * 0.63)));
}

function currencySize(value: string, width: number, maxSize: number) {
  const units = Array.from(value).reduce((total, character) => total + (/[.,\s]/u.test(character) ? 0.27 : 0.62), 0);
  return Math.min(maxSize, Math.floor(width / units));
}

function chartSvg(height: number, defs: string, content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${height}" viewBox="0 0 ${cardWidth} ${height}" font-family="Roboto">
    <defs>${defs}</defs>
    ${content}
  </svg>`;
}

function cashScale(months: MonthlyCash[]): CashScale {
  let min = 0;
  let max = 0;
  for (const { receivedRevenue, paidExpenses, cashResult } of months) {
    min = Math.min(min, receivedRevenue, paidExpenses, cashResult);
    max = Math.max(max, receivedRevenue, paidExpenses, cashResult);
  }
  const ideal = Math.max(1, (max - min) / 4);
  const power = 10 ** Math.floor(Math.log10(ideal));
  const step = Math.ceil(([1, 2, 2.5, 5, 10].find(value => value * power >= ideal) ?? 10) * power);
  return { min: Math.floor(min / step) * step, max: Math.max(step, Math.ceil(max / step) * step), step };
}

function monthLabel(month: string, short = false) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) return month.slice(0, 9);
  if (!short) return formatMonth(month);
  return `${monthShort.format(new Date(`${month}-01T12:00:00Z`)).replace('.', '')}/${month.slice(2, 4)}`;
}

function cashBar(x: number, y: number, bottom: number, w: number, received: boolean) {
  const height = Math.abs(bottom - y);
  if (height === 0) return '';
  const top = Math.min(y, bottom);
  const fill = received ? '#7a5af8' : '#fff';
  const stripes = Array.from({ length: Math.floor(w / 3.65) }, (_, index) => (
    `<rect x="${x + 1 + index * 3.65}" y="${top + 1}" width="1.83" height="${Math.max(0, height - 2)}" fill="#fff" fill-opacity="0.05"/>`
  )).join('');
  return `<rect x="${x}" y="${top}" width="${w}" height="${height}" rx="${Math.min(2.5, height / 2)}" fill="${fill}" fill-opacity="${received ? 1 : 0.1}"/>${stripes}`;
}

function cashPlot(months: MonthlyCash[], scale: CashScale) {
  if (!months.length) {
    return text(174, 260, 'Sem movimentações de caixa no período.', { anchor: 'middle', color: '#d0c6df' });
  }
  const left = 57;
  const right = 332;
  const top = 211;
  const bottom = 317;
  const group = (right - left) / months.length;
  const barWidth = Math.min(26, group * 0.35);
  const y = (value: number) => bottom - (value - scale.min) * (bottom - top) / (scale.max - scale.min);
  const x = (index: number) => left + group * (index + 0.5);

  const ticks = Array.from({ length: Math.round((scale.max - scale.min) / scale.step) + 1 }, (_, index) => {
    const value = scale.min + index * scale.step;
    const label = Math.abs(value) < 100 ? formatCurrency(value) : `R$ ${compactNumber.format(value / 100)}`;
    const position = y(value);
    return `<line x1="${left}" y1="${position}" x2="${right}" y2="${position}" stroke="${value === 0 ? '#8c819d' : '#51495e'}" ${value === 0 ? '' : 'stroke-dasharray="4 4"'} />`
      + text(left - 5, position + 3, label, { size: 8, color: '#c5bbd5', anchor: 'end' });
  }).join('');

  const bars = months.map((month, index) => (
    cashBar(x(index) - barWidth - 1, y(month.receivedRevenue), y(0), barWidth, true)
    + cashBar(x(index) + 1, y(month.paidExpenses), y(0), barWidth, false)
    + text(x(index), 332, monthLabel(month.month, true), { size: 9, anchor: 'middle', color: '#d0c6df' })
  )).join('');
  const points = months.map((month, index) => `${x(index)},${y(month.cashResult)}`).join(' ');
  const markers = months.map((month, index) => `<circle cx="${x(index)}" cy="${y(month.cashResult)}" r="2.5" fill="#c5f5df" stroke="#251a34" stroke-width="0.7"/>`).join('');

  return ticks + bars
    + (months.length > 1 ? `<polyline points="${points}" fill="none" stroke="#c5f5df" stroke-width="1.55" stroke-linejoin="round"/>` : '')
    + markers;
}

function cashCard(months: MonthlyCash[], scale: CashScale, period: string, result: number, chunked: boolean) {
  const label = formatCurrency(result);
  const status = result > 0 ? 'Superávit' : result < 0 ? 'Déficit' : 'Saldo zero';
  const statusFill = result > 0 ? '#0e3328' : result < 0 ? '#482336' : '#302840';
  const statusInk = result > 0 ? '#a0e7c6' : result < 0 ? '#ffd1e2' : '#e1d8ed';
  return chartSvg(cashHeight, `
    <linearGradient id="cash-panel" x2="0" y2="1">
      <stop offset="0" stop-color="#6938ef"/><stop offset="1" stop-color="#7a5af8"/>
    </linearGradient>
    <radialGradient id="cash-panel-shade" cx=".5" cy=".5" r="1.315315">
      <stop offset=".2818425" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  `, `
    <rect width="348" height="365" rx="24" fill="url(#cash-panel)"/>
    <rect width="348" height="365" rx="24" fill="url(#cash-panel-shade)"/>
    ${text(16, 35, 'Fluxo de caixa', { size: 16, bold: true })}
    <rect x="276" y="16" width="56" height="28" rx="14" fill="#7957f0"/>
    ${text(304, 33.5, 'Mensal', { size: 10, bold: true, anchor: 'middle' })}
    <rect x="16" y="60" width="316" height="40" rx="12" fill="#fff" fill-opacity="0.1"/>
    ${text(174, 84, period, { size: fitSize(period, 290, 13), anchor: 'middle' })}
    ${text(16, 127, chunked ? 'RESULTADO DOS MESES EXIBIDOS' : 'RESULTADO DO PERÍODO', { size: 11.5, color: '#d0c6df' })}
    ${text(16, 175, label, { size: currencySize(label, 233, 38), bold: true })}
    <rect x="259" y="158" width="73" height="23" rx="11.5" fill="${statusFill}"/>
    ${text(295.5, 173, status, { size: 10, anchor: 'middle', color: statusInk })}
    ${cashPlot(months, scale)}
    ${months.length ? `
      <rect x="22" y="345" width="9" height="9" rx="2" fill="#7a5af8"/>
      ${text(36, 353, 'Recebido', { size: 9 })}
      <rect x="105" y="345" width="9" height="9" rx="2" fill="#756986"/>
      ${text(119, 353, 'Despesas pagas', { size: 9 })}
      <line x1="222" y1="349.5" x2="234" y2="349.5" stroke="#c5f5df" stroke-width="1.55"/>
      <circle cx="228" cy="349.5" r="2" fill="#c5f5df"/>
      ${text(239, 353, 'Resultado mensal', { size: 9 })}
    ` : ''}
  `);
}

function categoryCard(financial: FinancialReport) {
  const categories = financial.expensesByCategory
    .filter(item => item.paidTotal !== 0)
    .map(item => ({ label: item.category, value: item.paidTotal, weight: Math.abs(item.paidTotal) }))
    .sort((a, b) => b.weight - a.weight);
  const signed = categories.some(item => item.value < 0);
  const totalWeight = categories.reduce((sum, item) => sum + item.weight, 0);
  const groups = categories.length <= 3 ? categories : [
    ...categories.slice(0, 2),
    categories.slice(2).reduce((other, item) => ({
      label: other.label, value: other.value + item.value, weight: other.weight + item.weight
    }), { label: 'Demais categorias', value: 0, weight: 0 })
  ];
  let offset = 18;
  const segments = groups.map(({ weight }, index) => {
    const width = 312 * weight / totalWeight;
    const gap = index < groups.length - 1 ? Math.min(2, width * 0.18) : 0;
    const segment = `<rect x="${offset}" y="58" width="${width - gap}" height="8" rx="${Math.min(4, (width - gap) / 2)}" fill="url(#category-${index})"/>`;
    offset += width;
    return segment;
  }).join('');
  const columns = groups.map(({ label, value }, index) => {
    const x = 16 + index * (320 / groups.length);
    const columnWidth = (316 / groups.length) - 8;
    const amount = formatCurrency(value);
    const characters = Array.from(label.trim() || 'Sem categoria');
    const maxLength = Math.floor(columnWidth / 5.7);
    const shownLabel = characters.length > maxLength ? `${characters.slice(0, maxLength - 1).join('')}…` : characters.join('');
    return text(x, 86, shownLabel, { size: fitSize(shownLabel, columnWidth, 10), color: '#e4d7e7' })
      + text(x, 111, amount, { size: currencySize(amount, columnWidth, 22), bold: true });
  }).join('');
  const total = `Total pago ${formatCurrency(financial.kpis.paidExpenses)}`;

  return chartSvg(categoryHeight, `
    <linearGradient id="category-panel" x2="0" y2="1">
      <stop offset="0" stop-color="#d01592"/><stop offset="1" stop-color="#e0bcfe"/>
    </linearGradient>
    <radialGradient id="category-panel-shade" cx="0" cy="0" r="1" gradientTransform="translate(.5 1.789634) scale(1.036083 1.789634)">
      <stop offset="0" stop-color="#0a0a0a" stop-opacity="0"/><stop offset="1" stop-color="#0a0a0a"/>
    </radialGradient>
    ${categoryGradients.map(([from, mid], index) => `<linearGradient id="category-${index}"><stop offset="0" stop-color="${from}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="#fff"/></linearGradient>`).join('')}
  `, `
    <rect width="348" height="164" rx="24" fill="url(#category-panel)"/>
    <rect width="348" height="164" rx="24" fill="url(#category-panel-shade)"/>
    ${text(16, 35, 'Despesas por categoria', { size: 15, bold: true })}
    <rect x="247" y="16" width="85" height="28" rx="14" fill="#7957f0"/>
    ${text(289.5, 33.5, signed ? 'Peso absoluto' : 'Despesas pagas', { size: 9.5, bold: true, anchor: 'middle' })}
    ${groups.length ? `
      <rect x="16" y="56" width="316" height="12" rx="6" fill="#fff" fill-opacity="0.2"/>
      ${segments}${columns}
    ` : text(174, 94, 'Sem despesas pagas por categoria.', { anchor: 'middle', color: '#e4d7e7' })}
    <rect x="16" y="116" width="316" height="32" rx="16" fill="#fff"/>
    ${text(174, 136, total, { size: fitSize(total, 285, 12), color: '#25182d', anchor: 'middle', bold: true })}
  `);
}

export function executivePdfCharts(report: ManagerialReport): Content[] {
  const monthly = report.financial.monthly;
  const scale = cashScale(monthly);
  const pageCount = Math.max(1, Math.ceil(monthly.length / monthsPerChart));
  const period = formatPeriod(report);

  return Array.from({ length: pageCount }, (_, index): Content => {
    const months = monthly.slice(index * monthsPerChart, (index + 1) * monthsPerChart);
    const chunked = pageCount > 1;
    const chunkPeriod = chunked ? `${monthLabel(months[0].month)} a ${monthLabel(months[months.length - 1].month)}` : period;
    const result = chunked ? months.reduce((sum, month) => sum + month.cashResult, 0) : report.financial.kpis.cashResult;
    return {
      pageBreak: 'before',
      stack: [
        { text: chunked ? `Gráficos financeiros · ${index + 1} de ${pageCount}` : 'Gráficos financeiros', style: 'section', margin: [0, 0, 0, 5] },
        { text: `Período do relatório · ${period}`, color: '#52525b', fontSize: 9, margin: [0, 0, 0, 10] },
        { svg: cashCard(months, scale, chunkPeriod, result, chunked), width: cardWidth, alignment: 'center' },
        ...(index === pageCount - 1 ? [
          { svg: categoryCard(report.financial), width: cardWidth, alignment: 'center', margin: [0, 12, 0, 0] } as Content,
          { text: 'Valores exatos e categorias completas nas tabelas financeiras do relatório.', color: '#52525b', fontSize: 8, margin: [0, 12, 0, 0] } as Content
        ] : [])
      ]
    };
  });
}
