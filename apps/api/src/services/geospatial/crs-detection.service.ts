import proj4 from 'proj4';

const WGS84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
const SIRGAS2000 = '+proj=longlat +ellps=GRS80 +no_defs +type=crs';
const SAD69 = '+proj=longlat +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +no_defs +type=crs';
const CORREGO_ALEGRE = '+proj=longlat +ellps=intl +towgs84=-206.05,168.28,-3.82,0,0,0,0 +no_defs +type=crs';

proj4.defs('EPSG:4326', WGS84);
proj4.defs('EPSG:4674', SIRGAS2000);
proj4.defs('EPSG:4618', SAD69);
proj4.defs('EPSG:4225', CORREGO_ALEGRE);
for (let zone = 18; zone <= 25; zone += 1) {
  proj4.defs(`EPSG:${31960 + zone}`, `+proj=utm +zone=${zone} +south +ellps=GRS80 +units=m +no_defs +type=crs`);
  proj4.defs(`EPSG:${32700 + zone}`, `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs +type=crs`);
  proj4.defs(`EPSG:${29170 + zone}`, `+proj=utm +zone=${zone} +south +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +units=m +no_defs +type=crs`);
  proj4.defs(`EPSG:${22500 + zone}`, `+proj=utm +zone=${zone} +south +ellps=intl +towgs84=-206.05,168.28,-3.82,0,0,0,0 +units=m +no_defs +type=crs`);
}

const EPSG_ALIASES: Record<string, string> = {
  'CRS84': 'EPSG:4326',
  'OGC:CRS84': 'EPSG:4326',
  'URN:OGC:DEF:CRS:OGC:1.3:CRS84': 'EPSG:4326',
  'SIRGAS 2000': 'EPSG:4674',
  'WGS 84': 'EPSG:4326',
  'SAD69': 'EPSG:4618',
  'SAD 69': 'EPSG:4618',
  'CÓRREGO ALEGRE': 'EPSG:4225',
  'CORREGO ALEGRE': 'EPSG:4225'
};

export interface CrsCatalogItem {
  code: string;
  name: string;
  datum: string;
  zone?: number;
  favorite?: boolean;
}

export const BRAZIL_CRS_CATALOG: CrsCatalogItem[] = [
  { code: 'EPSG:4326', name: 'WGS 84', datum: 'WGS 84', favorite: true },
  { code: 'EPSG:4674', name: 'SIRGAS 2000', datum: 'SIRGAS 2000', favorite: true },
  { code: 'EPSG:4618', name: 'SAD69', datum: 'SAD69' },
  { code: 'EPSG:4225', name: 'Córrego Alegre', datum: 'Córrego Alegre' },
  ...Array.from({ length: 8 }, (_, index) => index + 18).flatMap((zone) => [
    { code: `EPSG:${31960 + zone}`, name: `SIRGAS 2000 / UTM zona ${zone}S`, datum: 'SIRGAS 2000', zone, favorite: zone === 22 },
    { code: `EPSG:${32700 + zone}`, name: `WGS 84 / UTM zona ${zone}S`, datum: 'WGS 84', zone },
    { code: `EPSG:${29170 + zone}`, name: `SAD69 / UTM zona ${zone}S`, datum: 'SAD69', zone },
    { code: `EPSG:${22500 + zone}`, name: `Córrego Alegre / UTM zona ${zone}S`, datum: 'Córrego Alegre', zone }
  ])
];

export function normalizeCrsIdentifier(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const alias = EPSG_ALIASES[trimmed.toUpperCase()];
  if (alias) return alias;
  const epsgMatches = [...trimmed.matchAll(/(?:EPSG[\s:/"]*|AUTHORITY\s*\[\s*["']EPSG["']\s*,\s*["']?)(\d{4,6})/gi)];
  const epsgMatch = epsgMatches.at(-1);
  if (epsgMatch) return `EPSG:${epsgMatch[1]}`;
  if (/^\d{4,6}$/.test(trimmed)) return `EPSG:${trimmed}`;
  return trimmed;
}

export function extractEpsg(value?: string | null): number | null {
  const normalized = normalizeCrsIdentifier(value);
  const match = normalized?.match(/^EPSG:(\d+)$/i);
  return match ? Number(match[1]) : null;
}

export function assertSupportedCrs(value: string): string {
  if (value.length > 20_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new Error('A definição do SRC excede os limites seguros.');
  }
  const normalized = normalizeCrsIdentifier(value) || value;
  try {
    proj4(normalized, 'EPSG:4326');
    return normalized;
  } catch {
    try {
      proj4(value, 'EPSG:4326');
      return value;
    } catch {
      throw new Error(`O SRC informado não pôde ser interpretado: ${value.slice(0, 120)}`);
    }
  }
}

export function detectionMetadata(input: { sourceCrs?: string | null; sourceEpsg?: number | null; format: string; manuallyProvided?: boolean }) {
  if (input.manuallyProvided) return { source: 'seleção manual', confidence: 'high' as const };
  if (input.format === 'kml' || input.format === 'kmz') return { source: 'especificação KML', confidence: 'high' as const };
  if (input.format === 'geopackage') return { source: 'metadados GeoPackage', confidence: input.sourceEpsg ? 'high' as const : 'medium' as const };
  if (input.format === 'shapefile' && input.sourceCrs) return { source: 'arquivo .prj', confidence: input.sourceEpsg ? 'high' as const : 'medium' as const };
  if (input.format === 'geojson' && input.sourceCrs) return { source: input.sourceEpsg === 4326 ? 'RFC 7946 / metadado GeoJSON' : 'propriedade crs legada', confidence: 'medium' as const };
  return { source: 'não identificado', confidence: 'low' as const };
}

export function suggestBrazilUtmZone(longitude: number) {
  if (!Number.isFinite(longitude) || longitude < -78 || longitude > -30) return null;
  return Math.max(18, Math.min(25, Math.floor((longitude + 180) / 6) + 1));
}

export function transformPosition(position: number[], sourceCrs: string, swapAxis = false): number[] {
  if (position.length < 2 || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
    throw new Error('A geometria contém uma coordenada inválida.');
  }
  const input: [number, number] = swapAxis
    ? [Number(position[1]), Number(position[0])]
    : [Number(position[0]), Number(position[1])];
  const [longitude, latitude] = proj4(sourceCrs, 'EPSG:4326', input);
  return [longitude, latitude, ...position.slice(2)];
}

export function crsLabel(value?: string | null, epsg?: number | null) {
  if (epsg) return `EPSG:${epsg}`;
  if (!value) return null;
  if (/SIRGAS[_\s]?2000/i.test(value)) return 'SIRGAS 2000';
  if (/WGS[_\s]?84/i.test(value)) return 'WGS 84';
  if (/SAD[_\s]?69/i.test(value)) return 'SAD69';
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}
