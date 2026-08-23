import type { CoordinateMode, GeographicPosition, ProjectedPosition } from './topographySpatial';

export type ImportDelimiter = 'auto' | ';' | ',' | '\t';
export type DecimalSeparator = 'auto' | ',' | '.';

export interface ImportOptions {
  delimiter: ImportDelimiter;
  decimalSeparator: DecimalSeparator;
  hasHeader: boolean;
  firstCoordinateColumn?: number;
  secondCoordinateColumn?: number;
}

export interface ImportPreviewRow {
  line: number;
  raw: string[];
  coordinate: GeographicPosition | ProjectedPosition | null;
  error: string | null;
}

export interface VertexImportPreviewData {
  delimiter: Exclude<ImportDelimiter, 'auto'>;
  headers: string[];
  firstCoordinateColumn: number;
  secondCoordinateColumn: number;
  rows: ImportPreviewRow[];
  validVertices: Array<GeographicPosition | ProjectedPosition>;
  errors: string[];
  totalLines: number;
}

const MAX_IMPORT_BYTES = 2_000_000;
const MAX_IMPORT_LINES = 10_000;
const MAX_IMPORT_COLUMNS = 50;

export function analyzeVertexImport(
  text: string,
  mode: CoordinateMode,
  options: ImportOptions,
): VertexImportPreviewData {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('O conteúdo excede o limite seguro de 2 MB.');
  const nonEmptyLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (nonEmptyLines.length > MAX_IMPORT_LINES) throw new Error(`O arquivo excede o limite de ${MAX_IMPORT_LINES.toLocaleString('pt-BR')} linhas.`);
  const delimiter = options.delimiter === 'auto' ? detectDelimiter(nonEmptyLines.slice(0, 8)) : options.delimiter;
  const parsedLines = nonEmptyLines.map((line) => splitLine(line, delimiter));
  if (parsedLines.some((columns) => columns.length > MAX_IMPORT_COLUMNS)) throw new Error(`O arquivo excede o limite de ${MAX_IMPORT_COLUMNS} colunas.`);
  const headers = options.hasHeader && parsedLines.length ? parsedLines[0] : createGenericHeaders(Math.max(0, ...parsedLines.map((columns) => columns.length)));
  const dataLines = options.hasHeader ? parsedLines.slice(1) : parsedLines;
  const detected = detectCoordinateColumns(headers, mode, parsedLines[0] ?? []);
  const firstCoordinateColumn = options.firstCoordinateColumn ?? detected[0];
  const secondCoordinateColumn = options.secondCoordinateColumn ?? detected[1];
  const parsedRows = dataLines.map((columns, index): ImportPreviewRow => {
    const line = index + (options.hasHeader ? 2 : 1);
    const first = parseNumber(columns[firstCoordinateColumn], options.decimalSeparator);
    const second = parseNumber(columns[secondCoordinateColumn], options.decimalSeparator);
    if (first === null || second === null) return { line, raw: columns, coordinate: null, error: 'As duas coordenadas precisam ser numéricas.' };
    if (mode === 'geografica' && (first < -90 || first > 90 || second < -180 || second > 180)) {
      const looksSwapped = Math.abs(first) > 90 && Math.abs(second) <= 90;
      return { line, raw: columns, coordinate: null, error: looksSwapped ? 'Latitude/longitude parecem invertidas.' : 'Latitude ou longitude fora dos limites.' };
    }
    const coordinate = mode === 'geografica' ? { lat: first, lng: second } : { x: first, y: second };
    return { line, raw: columns, coordinate, error: null };
  });
  const seenCoordinates = new Set<string>();
  const rows = parsedRows.map((row) => {
    if (!row.coordinate || row.error) return row;
    const key = 'lat' in row.coordinate
      ? `${row.coordinate.lat.toFixed(10)}:${row.coordinate.lng.toFixed(10)}`
      : `${row.coordinate.x.toFixed(6)}:${row.coordinate.y.toFixed(6)}`;
    if (seenCoordinates.has(key)) return { ...row, coordinate: null, error: 'Vértice duplicado na importação.' };
    seenCoordinates.add(key);
    return row;
  });
  const validVertices = rows.flatMap((row) => row.coordinate ? [row.coordinate] : []);
  return {
    delimiter,
    headers,
    firstCoordinateColumn,
    secondCoordinateColumn,
    rows,
    validVertices,
    errors: rows.flatMap((row) => row.error ? [`Linha ${row.line}: ${row.error}`] : []),
    totalLines: dataLines.length,
  };
}

function detectDelimiter(lines: string[]): Exclude<ImportDelimiter, 'auto'> {
  const candidates: Array<Exclude<ImportDelimiter, 'auto'>> = [';', '\t', ','];
  return candidates
    .map((delimiter) => ({ delimiter, score: lines.reduce((total, line) => total + Math.max(0, splitLine(line, delimiter).length - 1), 0) }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter ?? ';';
}

function splitLine(line: string, delimiter: Exclude<ImportDelimiter, 'auto'>) {
  return line.split(delimiter).map((column) => column.trim().replace(/^"|"$/g, ''));
}

function createGenericHeaders(length: number) {
  return Array.from({ length }, (_, index) => `Coluna ${index + 1}`);
}

function detectCoordinateColumns(headers: string[], mode: CoordinateMode, sample: string[]): [number, number] {
  const firstPattern = mode === 'geografica' ? /^(lat|latitude)$/i : /^(x|este|e|easting|x_este_m)$/i;
  const secondPattern = mode === 'geografica' ? /^(lon|lng|long|longitude)$/i : /^(y|norte|n|northing|y_norte_m)$/i;
  const normalized = headers.map((header) => header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  const first = normalized.findIndex((header) => firstPattern.test(header));
  const second = normalized.findIndex((header) => secondPattern.test(header));
  if (first >= 0 && second >= 0) return [first, second];
  const numericIndexes = sample.map((value, index) => parseNumber(value, 'auto') !== null ? index : -1).filter((index) => index >= 0);
  if (numericIndexes.length >= 2) return [numericIndexes.at(-2) ?? 0, numericIndexes.at(-1) ?? 1];
  return [Math.max(0, headers.length - 2), Math.max(1, headers.length - 1)];
}

function parseNumber(value: string | undefined, separator: DecimalSeparator): number | null {
  if (value === undefined) return null;
  let normalized = value.trim().replace(/\s/g, '');
  if (separator === ',') normalized = normalized.replace(/\./g, '').replace(',', '.');
  else if (separator === '.') normalized = normalized.replace(/,/g, '');
  else if (normalized.includes(',') && !normalized.includes('.')) normalized = normalized.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
