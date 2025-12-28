import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface PropertyMapProps {
  geojson: GeoJSON.FeatureCollection;
  centroide: { lat: number; lng: number };
  mapboxToken: string;
  className?: string;
}

export function PropertyMap({ geojson, centroide, mapboxToken, className }: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [centroide.lng, centroide.lat],
      zoom: 14,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.current.on('load', () => {
      if (!map.current) return;

      // Adicionar fonte GeoJSON
      map.current.addSource('property-polygon', {
        type: 'geojson',
        data: geojson
      });

      // Camada de preenchimento do polígono
      map.current.addLayer({
        id: 'property-fill',
        type: 'fill',
        source: 'property-polygon',
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.3
        }
      });

      // Camada de contorno do polígono
      map.current.addLayer({
        id: 'property-outline',
        type: 'line',
        source: 'property-polygon',
        paint: {
          'line-color': '#16a34a',
          'line-width': 3
        }
      });

      // Ajustar zoom para mostrar todo o polígono
      const bounds = new mapboxgl.LngLatBounds();
      
      geojson.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach(coord => {
            bounds.extend(coord as [number, number]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(polygon => {
            polygon[0].forEach(coord => {
              bounds.extend(coord as [number, number]);
            });
          });
        }
      });

      map.current.fitBounds(bounds, { padding: 50 });
    });

    return () => {
      map.current?.remove();
    };
  }, [geojson, centroide, mapboxToken]);

  if (!mapboxToken) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${className}`}>
        <div className="text-center p-4">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Token Mapbox não configurado</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}

export function PropertyMapSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={`rounded-lg ${className}`} />
  );
}
