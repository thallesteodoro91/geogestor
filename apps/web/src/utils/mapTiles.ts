import L from 'leaflet';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from './mapTileConfig';

export { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from './mapTileConfig';

export function createBaseTileLayer(
  map: L.Map,
  onUnavailable: () => void,
  onAvailable: () => void
) {
  const layer = L.tileLayer(MAP_TILE_URL, {
    attribution: MAP_TILE_ATTRIBUTION,
    maxZoom: 19
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
