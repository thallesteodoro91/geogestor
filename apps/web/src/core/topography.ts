/**
 * @fileoverview Funções de cálculos topográficos e geoespaciais
 * @module core/topography
 */
import GeographicLib from 'geographiclib-geodesic';

const { Geodesic } = GeographicLib;

type SupportedDatum = 'SIRGAS 2000' | 'WGS 84';

function geodesicForDatum(datum: SupportedDatum) {
  return datum === 'WGS 84'
    ? Geodesic.WGS84
    : new Geodesic.Geodesic(6378137, 1 / 298.257222101);
}

/**
 * Converte metros quadrados para hectares
 * @param metrosQuadrados - Área em m²
 * @returns Área em hectares
 */
export function metrosQuadradosParaHectares(metrosQuadrados: number): number {
  return metrosQuadrados / 10000;
}

/**
 * Converte hectares para metros quadrados
 * @param hectares - Área em hectares
 * @returns Área em m²
 */
export function hectaresParaMetrosQuadrados(hectares: number): number {
  return hectares * 10000;
}

/**
 * Calcula distância entre dois pontos (coordenadas planas)
 * Usa o teorema de Pitágoras: d = √((x2-x1)² + (y2-y1)²)
 * @param x1 - Coordenada X do ponto 1
 * @param y1 - Coordenada Y do ponto 1
 * @param x2 - Coordenada X do ponto 2
 * @param y2 - Coordenada Y do ponto 2
 * @returns Distância em metros (mesma unidade das coordenadas)
 */
export function calcularDistanciaPlana(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcula distância entre dois pontos geográficos (Haversine)
 * @param lat1 - Latitude do ponto 1 (graus)
 * @param lon1 - Longitude do ponto 1 (graus)
 * @param lat2 - Latitude do ponto 2 (graus)
 * @param lon2 - Longitude do ponto 2 (graus)
 * @returns Distância em metros
 */
export function calcularDistanciaGeografica(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!validarCoordenadas(lat1, lon1) || !validarCoordenadas(lat2, lon2)) {
    return Number.NaN;
  }

  const R = 6371000; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const aLimitado = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(aLimitado), Math.sqrt(1 - aLimitado));

  return R * c;
}

/**
 * Calcula área de um polígono usando coordenadas planas
 * Usa a fórmula de Shoelace (Gauss)
 * @param coordenadas - Array de pontos {x, y}
 * @returns Área em unidades quadradas das coordenadas
 */
export function calcularAreaPoligono(
  coordenadas: Array<{ x: number; y: number }>
): number {
  if (
    coordenadas.length < 3 ||
    coordenadas.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))
  ) {
    return 0;
  }

  let area = 0;
  const n = coordenadas.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordenadas[i].x * coordenadas[j].y;
    area -= coordenadas[j].x * coordenadas[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Calcula perímetro de um polígono
 * @param coordenadas - Array de pontos {x, y}
 * @returns Perímetro em unidades das coordenadas
 */
export function calcularPerimetro(
  coordenadas: Array<{ x: number; y: number }>
): number {
  if (
    coordenadas.length < 2 ||
    coordenadas.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))
  ) {
    return 0;
  }

  let perimetro = 0;
  const n = coordenadas.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimetro += calcularDistanciaPlana(
      coordenadas[i].x,
      coordenadas[i].y,
      coordenadas[j].x,
      coordenadas[j].y
    );
  }

  return perimetro;
}

/**
 * Valida coordenadas geográficas
 * @param latitude - Latitude em graus
 * @param longitude - Longitude em graus
 * @returns true se coordenadas são válidas
 */
export function validarCoordenadas(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Calcula o azimute inicial entre dois pontos geográficos em um modelo esférico.
 * O resultado é referenciado ao norte verdadeiro e não substitui uma solução
 * geodésica elipsoidal ou um azimute de quadrícula em um SRC projetado.
 */
export function calcularAzimuteGeodesicoInicial(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!validarCoordenadas(lat1, lon1) || !validarCoordenadas(lat2, lon2)) {
    return Number.NaN;
  }

  if (lat1 === lat2 && lon1 === lon2) {
    return Number.NaN;
  }

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * Estima a área de um polígono geográfico em uma projeção equiretangular local.
 * Adequado somente para uma prévia de polígonos pequenos, longe dos polos.
 */
export function calcularAreaGeograficaEstimada(
  coordenadas: Array<{ lat: number; lng: number }>
): number {
  const coordenadasPlanas = projetarCoordenadasGeograficasLocalmente(coordenadas);
  return calcularAreaPoligono(coordenadasPlanas);
}

/**
 * Calcula o perímetro aproximado de um polígono geográfico pela soma de arcos
 * Haversine em uma Terra esférica.
 */
export function calcularPerimetroGeografico(
  coordenadas: Array<{ lat: number; lng: number }>
): number {
  if (
    coordenadas.length < 2 ||
    coordenadas.some(({ lat, lng }) => !validarCoordenadas(lat, lng))
  ) {
    return 0;
  }

  let perimetro = 0;
  for (let i = 0; i < coordenadas.length; i++) {
    const atual = coordenadas[i];
    const seguinte = coordenadas[(i + 1) % coordenadas.length];
    perimetro += calcularDistanciaGeografica(
      atual.lat,
      atual.lng,
      seguinte.lat,
      seguinte.lng
    );
  }

  return Number.isFinite(perimetro) ? perimetro : 0;
}

/**
 * Distância elipsoidal pelo método inverso de Vincenty.
 * Usa GRS80 por padrão (SIRGAS 2000) e WGS84 quando solicitado.
 */
export function calcularDistanciaElipsoidal(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  datum: 'SIRGAS 2000' | 'WGS 84' = 'SIRGAS 2000',
): { distance: number; initialBearing: number; method?: 'Karney/GeographicLib' | 'Vincenty com fallback esférico' } | null {
  if (!validarCoordenadas(lat1, lon1) || !validarCoordenadas(lat2, lon2)) return null;
  if (lat1 === lat2 && lon1 === lon2) return { distance: 0, initialBearing: Number.NaN };

  try {
    const inverse = geodesicForDatum(datum).Inverse(lat1, lon1, lat2, lon2, Geodesic.STANDARD);
    if (Number.isFinite(inverse.s12) && Number.isFinite(inverse.azi1)) {
      return {
        distance: inverse.s12 ?? 0,
        initialBearing: (((inverse.azi1 ?? 0) % 360) + 360) % 360,
        method: 'Karney/GeographicLib',
      };
    }
  } catch {
    // O algoritmo legado abaixo é mantido como fallback explícito.
  }

  const a = 6378137;
  const inverseFlattening = datum === 'SIRGAS 2000' ? 298.257222101 : 298.257223563;
  const f = 1 / inverseFlattening;
  const b = (1 - f) * a;
  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const reduced1 = Math.atan((1 - f) * Math.tan(phi1));
  const reduced2 = Math.atan((1 - f) * Math.tan(phi2));
  const sinU1 = Math.sin(reduced1);
  const cosU1 = Math.cos(reduced1);
  const sinU2 = Math.sin(reduced2);
  const cosU2 = Math.cos(reduced2);
  const longitudeDifference = degreesToRadians(lon2 - lon1);
  let lambda = longitudeDifference;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let cosSquaredAlpha = 0;
  let cos2SigmaM = 0;

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2,
    );
    if (sinSigma === 0) return { distance: 0, initialBearing: Number.NaN };
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSquaredAlpha = 1 - sinAlpha ** 2;
    cos2SigmaM = cosSquaredAlpha === 0
      ? 0
      : cosSigma - (2 * sinU1 * sinU2) / cosSquaredAlpha;
    const c = (f / 16) * cosSquaredAlpha * (4 + f * (4 - 3 * cosSquaredAlpha));
    const previousLambda = lambda;
    lambda = longitudeDifference + (1 - c) * f * sinAlpha * (
      sigma + c * sinSigma * (cos2SigmaM + c * cosSigma * (-1 + 2 * cos2SigmaM ** 2))
    );
    if (Math.abs(lambda - previousLambda) <= 1e-12) break;
    if (iteration === 199) {
      const fallbackDistance = calcularDistanciaGeografica(lat1, lon1, lat2, lon2);
      return { distance: fallbackDistance, initialBearing: calcularAzimuteGeodesicoInicial(lat1, lon1, lat2, lon2), method: 'Vincenty com fallback esférico' };
    }
  }

  const uSquared = cosSquaredAlpha * (a ** 2 - b ** 2) / b ** 2;
  const coefficientA = 1 + (uSquared / 16384) * (4096 + uSquared * (-768 + uSquared * (320 - 175 * uSquared)));
  const coefficientB = (uSquared / 1024) * (256 + uSquared * (-128 + uSquared * (74 - 47 * uSquared)));
  const deltaSigma = coefficientB * sinSigma * (
    cos2SigmaM + (coefficientB / 4) * (
      cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
      (coefficientB / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)
    )
  );
  const distance = b * coefficientA * (sigma - deltaSigma);
  const initialBearing = (radiansToDegrees(Math.atan2(
    cosU2 * Math.sin(lambda),
    cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(lambda),
  )) + 360) % 360;
  return { distance, initialBearing, method: 'Vincenty com fallback esférico' };
}

export function calcularPoligonoGeodesicoKarney(
  coordenadas: Array<{ lat: number; lng: number }>,
  datum: SupportedDatum = 'SIRGAS 2000',
): { area: number; perimeter: number; method: 'Karney/GeographicLib' } | null {
  if (coordenadas.length < 3 || coordenadas.some(({ lat, lng }) => !validarCoordenadas(lat, lng))) return null;
  try {
    const polygon = geodesicForDatum(datum).Polygon(false);
    coordenadas.forEach(({ lat, lng }) => polygon.AddPoint(lat, lng));
    const result = polygon.Compute(false, true);
    if (!Number.isFinite(result.area) || !Number.isFinite(result.perimeter)) return null;
    return { area: Math.abs(result.area ?? 0), perimeter: result.perimeter, method: 'Karney/GeographicLib' };
  } catch {
    return null;
  }
}

/**
 * Área geodésica sobre a esfera autálica do elipsoide de referência.
 * A latitude autálica preserva áreas do GRS80/WGS84 e evita tratar a Terra
 * como uma esfera de raio arbitrário. Adequada para conferência técnica;
 * peças registrais ainda devem usar software geodésico homologado.
 */
export function calcularAreaGeodesicaElipsoidal(
  coordenadas: Array<{ lat: number; lng: number }>,
  datum: 'SIRGAS 2000' | 'WGS 84' = 'SIRGAS 2000',
): number {
  const karney = calcularPoligonoGeodesicoKarney(coordenadas, datum);
  if (karney) return karney.area;
  if (coordenadas.length < 3 || coordenadas.some(({ lat, lng }) => !validarCoordenadas(lat, lng))) return 0;
  const eccentricitySquared = datum === 'SIRGAS 2000' ? 0.00669438002290 : 0.00669437999014;
  const eccentricity = Math.sqrt(eccentricitySquared);
  const a = 6378137;
  const qp = authalicQ(Math.PI / 2, eccentricitySquared, eccentricity);
  const authalicRadius = a * Math.sqrt(qp / 2);
  const authalicLatitudes = coordenadas.map(({ lat }) => {
    const q = authalicQ(degreesToRadians(lat), eccentricitySquared, eccentricity);
    return Math.asin(Math.max(-1, Math.min(1, q / qp)));
  });
  let accumulator = 0;
  for (let index = 0; index < coordenadas.length; index += 1) {
    const next = (index + 1) % coordenadas.length;
    let deltaLongitude = degreesToRadians(coordenadas[next].lng - coordenadas[index].lng);
    if (deltaLongitude > Math.PI) deltaLongitude -= 2 * Math.PI;
    if (deltaLongitude < -Math.PI) deltaLongitude += 2 * Math.PI;
    accumulator += deltaLongitude * (2 + Math.sin(authalicLatitudes[index]) + Math.sin(authalicLatitudes[next]));
  }
  const fullSurface = 4 * Math.PI * authalicRadius ** 2;
  const rawArea = Math.abs(accumulator) * authalicRadius ** 2 / 2;
  return Math.min(rawArea, fullSurface - rawArea);
}

export function calcularPerimetroElipsoidal(
  coordenadas: Array<{ lat: number; lng: number }>,
  datum: 'SIRGAS 2000' | 'WGS 84' = 'SIRGAS 2000',
): number {
  const karney = calcularPoligonoGeodesicoKarney(coordenadas, datum);
  if (karney) return karney.perimeter;
  if (coordenadas.length < 2) return 0;
  let total = 0;
  for (let index = 0; index < coordenadas.length; index += 1) {
    const current = coordenadas[index];
    const next = coordenadas[(index + 1) % coordenadas.length];
    const segment = calcularDistanciaElipsoidal(current.lat, current.lng, next.lat, next.lng, datum);
    if (!segment) return 0;
    total += segment.distance;
  }
  return total;
}

export function calcularAzimutePlano(x1: number, y1: number, x2: number, y2: number): number {
  if (![x1, y1, x2, y2].every(Number.isFinite) || (x1 === x2 && y1 === y2)) return Number.NaN;
  return (radiansToDegrees(Math.atan2(x2 - x1, y2 - y1)) + 360) % 360;
}

export function parseCoordinateText(
  input: string,
  kind: 'latitude' | 'longitude',
): { value: number | null; hemisphere: 'N' | 'S' | 'E' | 'W' | null; error: string | null } {
  const trimmed = input.trim().toUpperCase().replace(/º/g, '°');
  if (!trimmed) return { value: null, hemisphere: null, error: 'Informe a coordenada.' };
  const hemisphereMatch = trimmed.match(/[NSEWOL]$/);
  const rawHemisphere = hemisphereMatch?.[0] ?? null;
  const hemisphere = rawHemisphere === 'O' || rawHemisphere === 'L'
    ? (rawHemisphere === 'O' ? 'W' : 'E')
    : rawHemisphere as 'N' | 'S' | 'E' | 'W' | null;
  if (hemisphere && kind === 'latitude' && !['N', 'S'].includes(hemisphere)) {
    return { value: null, hemisphere, error: 'Latitude deve usar hemisfério N ou S.' };
  }
  if (hemisphere && kind === 'longitude' && !['E', 'W'].includes(hemisphere)) {
    return { value: null, hemisphere, error: 'Longitude deve usar hemisfério E, W, L ou O.' };
  }
  const numericText = hemisphere ? trimmed.slice(0, -1).trim() : trimmed;
  const parts = numericText
    .replace(/[°'′"″]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Number(part.replace(',', '.')));
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return { value: null, hemisphere, error: 'Use graus decimais ou o formato 27°35\'40,2"S.' };
  }
  const [degrees, minutes = 0, seconds = 0] = parts;
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
    return { value: null, hemisphere, error: 'Minutos e segundos devem estar entre 0 e menos de 60.' };
  }
  const limit = kind === 'latitude' ? 90 : 180;
  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  if (magnitude > limit) return { value: null, hemisphere, error: `Use um valor entre ${-limit} e ${limit}.` };
  const hemisphereSign = hemisphere && ['S', 'W'].includes(hemisphere) ? -1 : 1;
  if (degrees < 0 && hemisphere && hemisphereSign > 0) {
    return { value: null, hemisphere, error: 'O sinal negativo contradiz o hemisfério informado.' };
  }
  const sign = hemisphere ? hemisphereSign : degrees < 0 ? -1 : 1;
  return { value: magnitude * sign, hemisphere, error: null };
}

function authalicQ(phi: number, eccentricitySquared: number, eccentricity: number) {
  const sinPhi = Math.sin(phi);
  const denominator = 1 - eccentricitySquared * sinPhi ** 2;
  return (1 - eccentricitySquared) * (
    sinPhi / denominator -
    (1 / (2 * eccentricity)) * Math.log((1 - eccentricity * sinPhi) / (1 + eccentricity * sinPhi))
  );
}

const degreesToRadians = (value: number) => (value * Math.PI) / 180;
const radiansToDegrees = (value: number) => (value * 180) / Math.PI;

function projetarCoordenadasGeograficasLocalmente(
  coordenadas: Array<{ lat: number; lng: number }>
): Array<{ x: number; y: number }> {
  if (
    coordenadas.length < 3 ||
    coordenadas.some(({ lat, lng }) => !validarCoordenadas(lat, lng))
  ) {
    return [];
  }

  const raioTerra = 6371000;
  const latitudeReferencia =
    coordenadas.reduce((total, ponto) => total + ponto.lat, 0) / coordenadas.length;
  const longitudeOrigem = coordenadas[0].lng;
  const latitudeReferenciaRad = (latitudeReferencia * Math.PI) / 180;

  return coordenadas.map(({ lat, lng }) => {
    let diferencaLongitude = lng - longitudeOrigem;
    if (diferencaLongitude > 180) diferencaLongitude -= 360;
    if (diferencaLongitude < -180) diferencaLongitude += 360;

    return {
      x:
        ((diferencaLongitude * Math.PI) / 180) *
        raioTerra *
        Math.cos(latitudeReferenciaRad),
      y: ((lat - latitudeReferencia) * Math.PI * raioTerra) / 180,
    };
  });
}

/**
 * Converte graus decimais para graus, minutos e segundos
 * @param decimal - Valor em graus decimais
 * @returns Objeto com graus, minutos e segundos
 */
export function decimaisParaGMS(decimal: number): {
  graus: number;
  minutos: number;
  segundos: number;
} {
  const graus = Math.floor(Math.abs(decimal));
  const minutosDecimal = (Math.abs(decimal) - graus) * 60;
  const minutos = Math.floor(minutosDecimal);
  const segundos = (minutosDecimal - minutos) * 60;

  return {
    graus: decimal < 0 ? -graus : graus,
    minutos,
    segundos: parseFloat(segundos.toFixed(2)),
  };
}

/**
 * Converte graus, minutos e segundos para graus decimais
 * @param graus - Graus
 * @param minutos - Minutos
 * @param segundos - Segundos
 * @returns Valor em graus decimais
 */
export function gmsParaDecimais(
  graus: number,
  minutos: number,
  segundos: number
): number {
  const decimal = Math.abs(graus) + minutos / 60 + segundos / 3600;
  return graus < 0 ? -decimal : decimal;
}

/**
 * Calcula azimute entre dois pontos
 * @param x1 - Coordenada X do ponto 1
 * @param y1 - Coordenada Y do ponto 1
 * @param x2 - Coordenada X do ponto 2
 * @param y2 - Coordenada Y do ponto 2
 * @returns Azimute em graus (0-360)
 */
export function calcularAzimute(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let azimute = (Math.atan2(dx, dy) * 180) / Math.PI;

  if (azimute < 0) azimute += 360;

  return azimute;
}

/**
 * Formata coordenadas para exibição
 * @param latitude - Latitude
 * @param longitude - Longitude
 * @returns String formatada
 */
export function formatarCoordenadas(latitude: number, longitude: number): string {
  const lat = latitude >= 0 ? 'N' : 'S';
  const lon = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(6)}° ${lat}, ${Math.abs(longitude).toFixed(6)}° ${lon}`;
}
