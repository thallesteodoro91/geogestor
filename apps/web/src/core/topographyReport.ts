import type { CanvasElement, Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { CoordinateMode, GeographicPosition, ProjectedPosition, SpatialReference } from './topographySpatial';
import type { PolygonVertex } from './topographyExchange';

export interface TopographyReportInput {
  title: string;
  client?: string;
  project?: string;
  responsible?: string;
  mode: CoordinateMode;
  reference: SpatialReference;
  vertices: PolygonVertex[];
  area: number;
  perimeter: number;
  method: string;
  warnings: string[];
}

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const coordinate = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 8, useGrouping: false });

function buildSketch(vertices: PolygonVertex[], mode: CoordinateMode): Content {
  const raw = vertices.map((vertex) => mode === 'geografica'
    ? { x: (vertex as GeographicPosition).lng, y: (vertex as GeographicPosition).lat }
    : { x: (vertex as ProjectedPosition).x, y: (vertex as ProjectedPosition).y });
  if (raw.length < 2) return { text: 'Croqui indisponível: vértices insuficientes.', italics: true, color: '#71717a' };
  const minX = Math.min(...raw.map((point) => point.x));
  const maxX = Math.max(...raw.map((point) => point.x));
  const minY = Math.min(...raw.map((point) => point.y));
  const maxY = Math.max(...raw.map((point) => point.y));
  const width = Math.max(maxX - minX, Number.EPSILON);
  const height = Math.max(maxY - minY, Number.EPSILON);
  const scale = Math.min(390 / width, 170 / height);
  const points = raw.map((point) => ({
    x: 20 + (point.x - minX) * scale,
    y: 190 - (point.y - minY) * scale,
  }));
  const closed = [...points, points[0]];
  const canvas: CanvasElement[] = [
    ...closed.slice(0, -1).map((point, index): CanvasElement => ({
      type: 'line',
      x1: point.x,
      y1: point.y,
      x2: closed[index + 1].x,
      y2: closed[index + 1].y,
      lineWidth: 1.4,
      lineColor: '#0e7490',
    })),
    ...points.map((point): CanvasElement => ({
      type: 'ellipse',
      x: point.x,
      y: point.y,
      r1: 3,
      r2: 3,
      color: '#0891b2',
    })),
  ];
  return { canvas, margin: [0, 6, 0, 2] };
}

export function buildTopographyReportDefinition(input: TopographyReportInput): TDocumentDefinitions {
  const generatedAt = new Date();
  const rows = input.vertices.map((vertex, index) => {
    const values = input.mode === 'geografica'
      ? [coordinate.format((vertex as GeographicPosition).lat), coordinate.format((vertex as GeographicPosition).lng)]
      : [coordinate.format((vertex as ProjectedPosition).x), coordinate.format((vertex as ProjectedPosition).y)];
    return [`V${index + 1}`, ...values];
  });
  const metadata: Content[] = [
    { text: `Cliente: ${input.client?.trim() || 'Não informado'}` },
    { text: `Projeto: ${input.project?.trim() || 'Não informado'}` },
    { text: `Responsável: ${input.responsible?.trim() || 'Não informado'}` },
    { text: `Data e hora: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(generatedAt)}` },
    { text: `Datum: ${input.reference.datum}` },
    { text: `SRC: ${input.reference.code} · ${input.reference.name}` },
    { text: `Fuso/hemisfério: ${input.reference.zone ? `${input.reference.zone}${input.reference.hemisphere}` : 'Não aplicável'}` },
    { text: `Método: ${input.method}` },
  ];
  return {
    pageSize: 'A4',
    pageMargins: [42, 48, 42, 48],
    info: { title: input.title, subject: 'Relatório técnico de cálculo topográfico', creator: 'GeoGestor' },
    content: [
      { text: 'GEOGESTOR', style: 'eyebrow' },
      { text: input.title || 'Relatório técnico de Topografia', style: 'title' },
      { text: 'Memória de cálculo e relação de coordenadas', style: 'subtitle' },
      { columns: [{ width: '*', stack: metadata.slice(0, 4) }, { width: '*', stack: metadata.slice(4) }], columnGap: 16, margin: [0, 12, 0, 16] },
      { text: 'Resultados', style: 'section' },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [{ text: 'Área', bold: true }, `${number.format(input.area)} m² · ${number.format(input.area / 10_000)} ha · ${number.format(input.area / 1_000_000)} km²`],
            [{ text: 'Perímetro', bold: true }, `${number.format(input.perimeter)} m · ${number.format(input.perimeter / 1_000)} km`],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 6, 0, 16],
      },
      { text: 'Vértices', style: 'section' },
      {
        table: {
          headerRows: 1,
          widths: [60, '*', '*'],
          body: [[{ text: 'Vértice', bold: true }, { text: input.mode === 'geografica' ? 'Latitude' : 'X / Este (m)', bold: true }, { text: input.mode === 'geografica' ? 'Longitude' : 'Y / Norte (m)', bold: true }], ...rows],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 6, 0, 16],
      },
      { text: 'Croqui esquemático', style: 'section' },
      buildSketch(input.vertices, input.mode),
      { text: 'Representação para conferência visual, sem escala cartográfica.', fontSize: 8, color: '#71717a', margin: [0, 4, 0, 16] },
      { text: 'Advertências e limitações', style: 'section' },
      { ul: input.warnings.length ? input.warnings : ['Nenhuma advertência automática foi identificada.'], margin: [0, 6, 0, 16] },
      { text: 'Este relatório documenta uma memória de cálculo. Não declara, por si só, validade registral, cadastral ou legal. Os resultados devem ser conferidos com os dados originais e, quando exigido, em software geodésico homologado.', style: 'warning' },
      { text: 'Assinatura / identificação profissional', style: 'section', margin: [0, 28, 0, 36] },
      { canvas: [{ type: 'line', x1: 80, y1: 0, x2: 430, y2: 0, lineWidth: 0.8, lineColor: '#71717a' }] },
      { text: input.responsible?.trim() || 'Responsável não informado', alignment: 'center', margin: [0, 6, 0, 0] },
    ],
    footer: (currentPage, pageCount) => ({ text: `GeoGestor · página ${currentPage} de ${pageCount}`, alignment: 'center', fontSize: 8, color: '#71717a', margin: [0, 14, 0, 0] }),
    styles: {
      eyebrow: { fontSize: 9, bold: true, color: '#0e7490', characterSpacing: 1.4 },
      title: { fontSize: 20, bold: true, color: '#18181b', margin: [0, 4, 0, 2] },
      subtitle: { fontSize: 10, color: '#52525b' },
      section: { fontSize: 12, bold: true, color: '#18181b', margin: [0, 8, 0, 0] },
      warning: { fontSize: 9, color: '#713f12', fillColor: '#fef3c7', margin: [8, 8, 8, 8] },
    },
    defaultStyle: { fontSize: 9, color: '#27272a', lineHeight: 1.25 },
  };
}
