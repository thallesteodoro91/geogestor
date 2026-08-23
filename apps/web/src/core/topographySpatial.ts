import proj4 from 'proj4';

export type CoordinateMode = 'geografica' | 'projetada';
export type Hemisphere = 'N' | 'S';
export type Datum = 'SIRGAS 2000' | 'WGS 84';
export type GeographicPosition = { lat: number; lng: number };
export type ProjectedPosition = { x: number; y: number };

export interface SpatialReference {
  code: string;
  name: string;
  datum: Datum;
  mode: CoordinateMode;
  zone?: number;
  hemisphere?: Hemisphere;
}

const WGS84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
const SIRGAS2000 = '+proj=longlat +ellps=GRS80 +no_defs +type=crs';

proj4.defs('EPSG:4326', WGS84);
proj4.defs('EPSG:4674', SIRGAS2000);

for (let zone = 18; zone <= 25; zone += 1) {
  if (zone <= 23) {
    proj4.defs(
      `EPSG:${31954 + zone}`,
      `+proj=utm +zone=${zone} +ellps=GRS80 +units=m +no_defs +type=crs`,
    );
    proj4.defs(
      `EPSG:${32600 + zone}`,
      `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs +type=crs`,
    );
  }
  proj4.defs(
    `EPSG:${31960 + zone}`,
    `+proj=utm +zone=${zone} +south +ellps=GRS80 +units=m +no_defs +type=crs`,
  );
  proj4.defs(
    `EPSG:${32700 + zone}`,
    `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs +type=crs`,
  );
}

export const BRAZIL_SPATIAL_REFERENCES: SpatialReference[] = [
  { code: 'EPSG:4674', name: 'SIRGAS 2000 — latitude/longitude', datum: 'SIRGAS 2000', mode: 'geografica' },
  { code: 'EPSG:4326', name: 'WGS 84 — latitude/longitude', datum: 'WGS 84', mode: 'geografica' },
  ...Array.from({ length: 6 }, (_, index) => index + 18).flatMap((zone): SpatialReference[] => [
    {
      code: `EPSG:${31954 + zone}`,
      name: `SIRGAS 2000 / UTM zona ${zone}N`,
      datum: 'SIRGAS 2000',
      mode: 'projetada',
      zone,
      hemisphere: 'N',
    },
    {
      code: `EPSG:${32600 + zone}`,
      name: `WGS 84 / UTM zona ${zone}N`,
      datum: 'WGS 84',
      mode: 'projetada',
      zone,
      hemisphere: 'N',
    },
  ]),
  ...Array.from({ length: 8 }, (_, index) => index + 18).flatMap((zone): SpatialReference[] => [
    {
      code: `EPSG:${31960 + zone}`,
      name: `SIRGAS 2000 / UTM zona ${zone}S`,
      datum: 'SIRGAS 2000',
      mode: 'projetada',
      zone,
      hemisphere: 'S',
    },
    {
      code: `EPSG:${32700 + zone}`,
      name: `WGS 84 / UTM zona ${zone}S`,
      datum: 'WGS 84',
      mode: 'projetada',
      zone,
      hemisphere: 'S',
    },
  ]),
];

export const DEFAULT_SPATIAL_REFERENCE_CODE = 'EPSG:31982';
export const SPATIAL_REFERENCE_STORAGE_KEY = 'geogestor:topography:spatial-reference';

export function getSpatialReference(code: string): SpatialReference | null {
  return BRAZIL_SPATIAL_REFERENCES.find((item) => item.code === code) ?? null;
}

export function serializeSpatialReference(code: string): string {
  return JSON.stringify({ version: 1, code });
}

export function parseStoredSpatialReference(value: string | null): string {
  if (!value) return DEFAULT_SPATIAL_REFERENCE_CODE;
  try {
    const parsed = JSON.parse(value) as { code?: unknown };
    return typeof parsed.code === 'string' && getSpatialReference(parsed.code)
      ? parsed.code
      : DEFAULT_SPATIAL_REFERENCE_CODE;
  } catch {
    return DEFAULT_SPATIAL_REFERENCE_CODE;
  }
}

export function geographicToProjected(
  position: GeographicPosition,
  targetCode: string,
): ProjectedPosition {
  const target = getSpatialReference(targetCode);
  if (!target || target.mode !== 'projetada') {
    throw new Error('Selecione um SRC projetado para converter latitude/longitude em X/Y.');
  }
  assertGeographicPosition(position);
  const geographicCode = target.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
  const [x, y] = proj4(geographicCode, target.code, [position.lng, position.lat]);
  return { x, y };
}

export function wgs84MapPositionToProjected(
  position: GeographicPosition,
  targetCode: string,
): ProjectedPosition {
  const target = getSpatialReference(targetCode);
  if (!target || target.mode !== 'projetada') {
    throw new Error('Selecione um SRC projetado para posicionar o ponto do mapa.');
  }
  assertGeographicPosition(position);
  const [x, y] = proj4('EPSG:4326', target.code, [position.lng, position.lat]);
  return { x, y };
}

export function projectedToGeographic(
  position: ProjectedPosition,
  sourceCode: string,
): GeographicPosition {
  const source = getSpatialReference(sourceCode);
  if (!source || source.mode !== 'projetada') {
    throw new Error('Selecione o SRC projetado de origem para posicionar X/Y.');
  }
  assertProjectedPosition(position);
  const geographicCode = source.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
  const [lng, lat] = proj4(source.code, geographicCode, [position.x, position.y]);
  const result = { lat, lng };
  assertGeographicPosition(result);
  return result;
}

export function transformGeographicDatum(
  position: GeographicPosition,
  sourceCode: string,
  targetCode: string,
): GeographicPosition {
  assertGeographicPosition(position);
  const [lng, lat] = proj4(sourceCode, targetCode, [position.lng, position.lat]);
  return { lat, lng };
}

export function suggestUtmZone(longitude: number): number | null {
  if (!Number.isFinite(longitude) || longitude < -78 || longitude > -30) return null;
  return Math.max(18, Math.min(25, Math.floor((longitude + 180) / 6) + 1));
}

export function suggestSpatialReference(
  longitude: number,
  latitude: number,
  datum: Datum = 'SIRGAS 2000',
): SpatialReference | null {
  const zone = suggestUtmZone(longitude);
  if (!zone) return null;
  const hemisphere: Hemisphere = latitude >= 0 ? 'N' : 'S';
  return BRAZIL_SPATIAL_REFERENCES.find((reference) =>
    reference.mode === 'projetada' && reference.zone === zone && reference.hemisphere === hemisphere && reference.datum === datum,
  ) ?? null;
}

export type SpatialIssueSeverity = 'error' | 'warning';

export interface SpatialIssue {
  code: string;
  severity: SpatialIssueSeverity;
  message: string;
  fix: string;
}

export function validateProjectedPosition(
  position: ProjectedPosition,
  reference: SpatialReference,
): SpatialIssue[] {
  const issues: SpatialIssue[] = [];
  if (reference.mode !== 'projetada' || !reference.zone || !reference.hemisphere) {
    return [{ code: 'projected-src-required', severity: 'error', message: 'X/Y exige um SRC projetado com fuso e hemisfério.', fix: 'Selecione um EPSG UTM antes de usar estas coordenadas.' }];
  }
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return [{ code: 'non-finite-position', severity: 'error', message: 'X/Y contém valor não numérico.', fix: 'Corrija os dois valores antes de calcular.' }];
  }
  if (position.x < 100_000 || position.x > 900_000) {
    issues.push({ code: 'implausible-easting', severity: 'warning', message: `O Este ${position.x.toFixed(3)} m está fora da faixa UTM usual de 100.000 a 900.000 m.`, fix: 'Confira o fuso e se X/Y foram invertidos.' });
  }
  if (position.y < 0 || position.y > 10_000_000) {
    issues.push({ code: 'invalid-northing', severity: 'error', message: `O Norte ${position.y.toFixed(3)} m está fora do intervalo UTM.`, fix: 'Use um Norte entre 0 e 10.000.000 m e confira o hemisfério.' });
  }
  if (position.x > 1_000_000 && position.y >= 100_000 && position.y <= 900_000) {
    issues.push({ code: 'possible-xy-swap', severity: 'warning', message: 'Os valores parecem estar invertidos: X possui magnitude típica de Norte e Y de Este.', fix: 'Confira se X corresponde ao Este e Y ao Norte.' });
  }
  try {
    const geographic = projectedToGeographic(position, reference.code);
    if ((reference.hemisphere === 'N' && geographic.lat < -0.000001) || (reference.hemisphere === 'S' && geographic.lat > 0.000001)) {
      issues.push({ code: 'hemisphere-mismatch', severity: 'error', message: `A coordenada transformada cai no hemisfério ${geographic.lat >= 0 ? 'Norte' : 'Sul'}, diferente do ${reference.hemisphere} informado.`, fix: 'Selecione o EPSG do hemisfério correto.' });
    }
    const zone = suggestUtmZone(geographic.lng);
    if (zone && zone !== reference.zone) {
      issues.push({ code: 'zone-mismatch', severity: 'warning', message: `A longitude transformada pertence normalmente ao fuso ${zone}, mas o SRC selecionado usa o fuso ${reference.zone}.`, fix: 'Confirme o fuso do levantamento antes de prosseguir.' });
    }
    const outsideBrazil = geographic.lng < -74.5 || geographic.lng > -32 || geographic.lat < -34.5 || geographic.lat > 6;
    if (outsideBrazil) {
      const oppositeHemisphere = BRAZIL_SPATIAL_REFERENCES.find((candidate) =>
        candidate.mode === 'projetada'
        && candidate.datum === reference.datum
        && candidate.zone === reference.zone
        && candidate.hemisphere !== reference.hemisphere);
      if (oppositeHemisphere) {
        try {
          const alternative = projectedToGeographic(position, oppositeHemisphere.code);
          const alternativeInsideBrazil = alternative.lng >= -74.5 && alternative.lng <= -32 && alternative.lat >= -34.5 && alternative.lat <= 6;
          if (alternativeInsideBrazil) {
            issues.push({ code: 'possible-hemisphere-mismatch', severity: 'warning', message: `Os mesmos valores caem no território brasileiro usando o hemisfério ${oppositeHemisphere.hemisphere}.`, fix: `Confirme se o EPSG correto é ${oppositeHemisphere.code} (${oppositeHemisphere.zone}${oppositeHemisphere.hemisphere}).` });
          }
        } catch {
          // A advertência territorial genérica abaixo permanece suficiente.
        }
      }
    }
    if (outsideBrazil) {
      issues.push({ code: 'outside-brazil', severity: 'warning', message: 'A posição transformada está fora da extensão territorial brasileira esperada.', fix: 'Prossiga se o levantamento for externo; caso contrário, confira SRC e eixos.' });
    }
  } catch {
    issues.push({ code: 'transform-failed', severity: 'error', message: 'A transformação das coordenadas produziu uma posição inválida.', fix: 'Confira EPSG, fuso, hemisfério e ordem X/Y.' });
  }
  return issues;
}

export function validateGeographicPositions(
  positions: GeographicPosition[],
  reference: SpatialReference,
): SpatialIssue[] {
  if (!positions.length) return [];
  const issues: SpatialIssue[] = [];
  const invalid = positions.some((position) => !Number.isFinite(position.lat) || !Number.isFinite(position.lng) || Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180);
  if (invalid) issues.push({ code: 'invalid-geographic', severity: 'error', message: 'Há latitude ou longitude fora dos limites geográficos.', fix: 'Use latitude entre −90 e 90 e longitude entre −180 e 180.' });
  const possibleSwap = positions.some((position) => Math.abs(position.lat) > 34.5 && position.lng >= -34.5 && position.lng <= 6);
  if (possibleSwap) issues.push({ code: 'possible-lat-lng-swap', severity: 'warning', message: 'Uma coordenada parece ter latitude e longitude invertidas.', fix: 'Confira se latitude vem antes de longitude.' });
  const zones = new Set(positions.map((position) => suggestUtmZone(position.lng)).filter((zone): zone is number => zone !== null));
  if (zones.size > 1) issues.push({ code: 'multiple-utm-zones', severity: 'warning', message: `A geometria atravessa ${zones.size} fusos UTM (${[...zones].join(', ')}).`, fix: 'Para área técnica, avalie um SRC adequado à extensão total ou cálculo geodésico.' });
  if (reference.mode === 'projetada' && reference.zone) {
    const mismatched = positions.some((position) => suggestUtmZone(position.lng) !== reference.zone);
    if (mismatched) issues.push({ code: 'selected-zone-mismatch', severity: 'warning', message: `Parte da geometria não pertence ao fuso ${reference.zone} selecionado.`, fix: 'Use a sugestão automática ou confirme que o SRC do levantamento está correto.' });
    const hemisphereMismatch = positions.some((position) => reference.hemisphere === 'N' ? position.lat < 0 : position.lat > 0);
    if (hemisphereMismatch) issues.push({ code: 'selected-hemisphere-mismatch', severity: 'error', message: `A geometria é incompatível com o hemisfério ${reference.hemisphere}.`, fix: 'Selecione o EPSG correspondente ao hemisfério dos pontos.' });
  }
  const nearestDistances = positions.map((position, index) => Math.min(
    ...positions.filter((_, candidateIndex) => candidateIndex !== index).map((candidate) => {
      const latitudeScale = 111_320;
      const longitudeScale = latitudeScale * Math.cos((position.lat * Math.PI) / 180);
      return Math.hypot((candidate.lat - position.lat) * latitudeScale, (candidate.lng - position.lng) * longitudeScale);
    }),
  )).filter(Number.isFinite).sort((a, b) => a - b);
  const medianNearest = nearestDistances[Math.floor(nearestDistances.length / 2)] ?? 0;
  if (nearestDistances.some((distance) => distance > Math.max(100_000, medianNearest * 20))) {
    issues.push({ code: 'geographic-outlier', severity: 'warning', message: 'Há um vértice muito distante dos demais.', fix: 'Confira sinal, ordem latitude/longitude e se o ponto pertence à mesma geometria.' });
  }
  return issues;
}

export function validateProjectedPositions(
  positions: ProjectedPosition[],
  reference: SpatialReference,
): SpatialIssue[] {
  const issues = positions.flatMap((position) => validateProjectedPosition(position, reference));
  if (positions.length >= 3) {
    const nearestDistances = positions.map((position, index) => Math.min(
      ...positions.filter((_, candidateIndex) => candidateIndex !== index)
        .map((candidate) => Math.hypot(candidate.x - position.x, candidate.y - position.y)),
    )).sort((a, b) => a - b);
    const medianNearest = nearestDistances[Math.floor(nearestDistances.length / 2)] ?? 0;
    if (nearestDistances.some((distance) => distance > Math.max(100_000, medianNearest * 20))) {
      issues.push({ code: 'projected-outlier', severity: 'warning', message: 'Há um vértice X/Y muito distante dos demais.', fix: 'Confira eixos, unidade, fuso e se o ponto pertence à mesma geometria.' });
    }
  }
  return issues.filter((issue, index) =>
    issues.findIndex((candidate) => candidate.code === issue.code && candidate.message === issue.message) === index);
}

export function transformProjectedPositions(
  positions: ProjectedPosition[],
  sourceReference: SpatialReference,
  targetReference: SpatialReference,
): { mode: CoordinateMode; geographic: GeographicPosition[]; projected: ProjectedPosition[] } {
  if (sourceReference.mode !== 'projetada') throw new Error('O SRC de origem precisa ser projetado para transformar X/Y.');
  const sourceGeographicCode = sourceReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
  const targetGeographicCode = targetReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
  const geographic = positions.map((position) => {
    const sourceGeographic = projectedToGeographic(position, sourceReference.code);
    return transformGeographicDatum(sourceGeographic, sourceGeographicCode, targetGeographicCode);
  });
  if (targetReference.mode === 'geografica') return { mode: 'geografica', geographic, projected: [] };
  return { mode: 'projetada', geographic: [], projected: geographic.map((position) => geographicToProjected(position, targetReference.code)) };
}

export function calculateUtmMetadata(position: GeographicPosition, reference: SpatialReference) {
  if (reference.mode !== 'projetada' || !reference.zone) return null;
  assertGeographicPosition(position);
  const phi = degreesToRadians(position.lat);
  const deltaLambda = degreesToRadians(position.lng - (reference.zone * 6 - 183));
  const convergenceDegrees = radiansToDegrees(Math.atan(Math.tan(deltaLambda) * Math.sin(phi)));
  const eccentricitySquared = reference.datum === 'SIRGAS 2000'
    ? 0.00669438002290
    : 0.00669437999014;
  const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
  const a = 6378137;
  const n = a / Math.sqrt(1 - eccentricitySquared * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = secondEccentricitySquared * Math.cos(phi) ** 2;
  const projected = geographicToProjected(position, reference.code);
  const normalizedEasting = (projected.x - 500000) / (n * 0.9996);
  const scaleFactor = 0.9996 * (
    1 + ((1 + c) * normalizedEasting ** 2) / 2
      + ((5 - 4 * t + 42 * c + 13 * c ** 2 - 28 * secondEccentricitySquared)
        * normalizedEasting ** 4) / 24
  );
  return { convergenceDegrees, scaleFactor };
}

function assertGeographicPosition(position: GeographicPosition) {
  if (
    !Number.isFinite(position.lat) ||
    !Number.isFinite(position.lng) ||
    position.lat < -90 ||
    position.lat > 90 ||
    position.lng < -180 ||
    position.lng > 180
  ) {
    throw new Error('A latitude ou longitude está fora dos limites válidos.');
  }
}

function assertProjectedPosition(position: ProjectedPosition) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new Error('As coordenadas X/Y precisam ser numéricas.');
  }
}

const degreesToRadians = (value: number) => (value * Math.PI) / 180;
const radiansToDegrees = (value: number) => (value * 180) / Math.PI;
