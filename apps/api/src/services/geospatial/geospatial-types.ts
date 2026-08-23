export type Position = number[];

export interface GeoGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoGeometry[];
}

export interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: GeoGeometry | null;
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
  crs?: unknown;
  bbox?: number[];
}

export interface ParsedGeospatialLayer {
  name: string;
  sourceLayer?: string | null;
  format: 'kml' | 'kmz' | 'geojson' | 'shapefile' | 'geopackage';
  collection?: GeoFeatureCollection;
  sourceCrs?: string | null;
  sourceEpsg?: number | null;
  warnings: string[];
  status?: 'ready' | 'needs_crs' | 'needs_review' | 'error';
  errorMessage?: string | null;
  ignoredRasterLayers?: string[];
}

export interface GeospatialProcessOptions {
  sourceCrs?: string;
  axisOrder?: 'longitude-latitude' | 'latitude-longitude';
}
