export const VECTOR_SURVEY_ACCEPT = '.kml,.kmz,.geojson,.json,.zip,.shp,.shx,.dbf,.prj,.cpg,.gpkg';
export const VECTOR_SURVEY_EXTENSIONS = ['.gpkg', '.shp', '.zip', '.kml', '.kmz', '.geojson', '.json'] as const;
export const SHAPEFILE_COMPONENT_EXTENSIONS = ['.shp', '.shx', '.dbf', '.prj', '.cpg'] as const;
export const RASTER_SURVEY_EXTENSIONS = ['.tif', '.tiff', '.geotiff', '.cog', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.ecw', '.jp2', '.j2k', '.jpeg2000', '.dem', '.img', '.asc', '.grd', '.bil', '.bip', '.bsq', '.hgt', '.ntf', '.nitf', '.sid', '.vrt'] as const;

export const RASTER_SURVEY_GUIDANCE = 'O GeoGestor não importa arquivos raster como levantamento. Utilize KML, KMZ, GeoJSON, Shapefile ou GeoPackage vetorial.';
export const MBTILES_SURVEY_GUIDANCE = 'MBTiles é usado somente como mapa-base offline. Importe-o em Configurar mapa-base offline.';
export const VECTOR_SURVEY_GUIDANCE = 'Envie um levantamento vetorial em KML, KMZ, GeoJSON, Shapefile ou GeoPackage.';

export function fileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] || '';
}

export function classifyVectorSurveyFileName(fileName: string) {
  const extension = fileExtension(fileName);
  if (extension === '.mbtiles') return 'mbtiles' as const;
  if ((RASTER_SURVEY_EXTENSIONS as readonly string[]).includes(extension)) return 'raster' as const;
  if ((SHAPEFILE_COMPONENT_EXTENSIONS as readonly string[]).includes(extension)) return 'shapefile-component' as const;
  if ((VECTOR_SURVEY_EXTENSIONS as readonly string[]).includes(extension)) return 'vector' as const;
  return 'unsupported' as const;
}
