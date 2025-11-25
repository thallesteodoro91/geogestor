/**
 * @fileoverview Funções de cálculos topográficos e geoespaciais
 * @module core/topography
 */

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
  const R = 6371000; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

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
  if (coordenadas.length < 3) return 0;

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
  if (coordenadas.length < 2) return 0;

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
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
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
