import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Map, Satellite } from 'lucide-react';

interface PropertyMapProps {
  geojson: GeoJSON.FeatureCollection;
  centroide: { lat: number; lng: number };
  className?: string;
}

// Component to fit bounds when geojson changes
function FitBounds({ geojson }: { geojson: GeoJSON.FeatureCollection }) {
  const map = useMap();

  useEffect(() => {
    if (geojson.features.length > 0) {
      const geoJsonLayer = L.geoJSON(geojson);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [geojson, map]);

  return null;
}

type MapLayer = 'street' | 'satellite';

const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

export function PropertyMap({ geojson, centroide, className }: PropertyMapProps) {
  const [activeLayer, setActiveLayer] = useState<MapLayer>('satellite');

  const polygonStyle = {
    color: '#16a34a',
    weight: 3,
    fillColor: '#22c55e',
    fillOpacity: 0.3,
  };

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      <MapContainer
        center={[centroide.lat, centroide.lng]}
        zoom={14}
        className="absolute inset-0"
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          key={activeLayer}
          attribution={TILE_LAYERS[activeLayer].attribution}
          url={TILE_LAYERS[activeLayer].url}
        />

        {/* Property Polygon */}
        <GeoJSON 
          key={JSON.stringify(geojson)}
          data={geojson} 
          style={polygonStyle}
        />

        {/* Fit bounds to polygon */}
        <FitBounds geojson={geojson} />
      </MapContainer>

      {/* Layer Toggle */}
      <div className="absolute top-2 right-2 z-[1000] flex gap-1 bg-background/90 backdrop-blur-sm rounded-md p-1 shadow-md border">
        <Button
          variant={activeLayer === 'street' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2"
          onClick={() => setActiveLayer('street')}
          title="Mapa de rua"
        >
          <Map className="h-4 w-4" />
        </Button>
        <Button
          variant={activeLayer === 'satellite' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2"
          onClick={() => setActiveLayer('satellite')}
          title="Satélite"
        >
          <Satellite className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PropertyMapSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={`rounded-lg ${className}`} />
  );
}
