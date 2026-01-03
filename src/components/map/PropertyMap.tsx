import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Skeleton } from '@/components/ui/skeleton';

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

export function PropertyMap({ geojson, centroide, className }: PropertyMapProps) {
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
        {/* OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* ESRI Satellite as alternative - uncomment if you prefer satellite view */}
        {/* <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        /> */}

        {/* Property Polygon */}
        <GeoJSON 
          key={JSON.stringify(geojson)}
          data={geojson} 
          style={polygonStyle}
        />

        {/* Fit bounds to polygon */}
        <FitBounds geojson={geojson} />
      </MapContainer>
    </div>
  );
}

export function PropertyMapSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={`rounded-lg ${className}`} />
  );
}
