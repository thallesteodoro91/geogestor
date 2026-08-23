import L from 'leaflet';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from './mapTileConfig';

export { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from './mapTileConfig';

export function createBaseTileLayer(
  map: L.Map,
  onUnavailable: () => void,
  onAvailable: () => void,
  options: { url?: string; attribution?: string; minZoom?: number; maxZoom?: number } = {}
) {
  const layer = L.tileLayer(options.url || MAP_TILE_URL, {
    attribution: options.attribution || MAP_TILE_ATTRIBUTION,
    minZoom: options.minZoom ?? 0,
    maxZoom: options.maxZoom ?? 19
  });
  let errorReported = false;
  layer.on('tileerror', () => {
    if (errorReported) return;
    errorReported = true;
    onUnavailable();
  });
  layer.on('load', () => {
    errorReported = false;
    onAvailable();
  });
  layer.addTo(map);
  return layer;
}

export function createNeutralGridLayer(map: L.Map) {
  const layer = L.gridLayer({ tileSize: 256, attribution: 'Grade de referência local · sem mapa-base' });
  (layer as L.GridLayer & { createTile: (coords: L.Coords) => HTMLElement }).createTile = (coords) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#f4f4f5';
      context.fillRect(0, 0, 256, 256);
      context.strokeStyle = '#d4d4d8';
      context.lineWidth = 1;
      for (let value = 0; value <= 256; value += 64) {
        context.beginPath(); context.moveTo(value, 0); context.lineTo(value, 256); context.stroke();
        context.beginPath(); context.moveTo(0, value); context.lineTo(256, value); context.stroke();
      }
      context.fillStyle = '#71717a';
      context.font = '12px sans-serif';
      context.fillText(`z${coords.z} · ${coords.x}/${coords.y}`, 12, 22);
    }
    return canvas;
  };
  layer.addTo(map);
  return layer;
}
