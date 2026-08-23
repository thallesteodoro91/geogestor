import path from 'node:path';

export const VECTOR_SURVEY_EXTENSIONS = ['.kml', '.kmz', '.geojson', '.json', '.shp', '.zip', '.gpkg'] as const;
export const SHAPEFILE_COMPONENT_EXTENSIONS = ['.shp', '.shx', '.dbf', '.prj', '.cpg'] as const;
export const RASTER_EXTENSIONS = [
  '.tif', '.tiff', '.geotiff', '.cog', '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.bmp', '.ecw', '.jp2', '.j2k', '.jpeg2000', '.dem', '.img', '.asc', '.grd',
  '.bil', '.bip', '.bsq', '.hgt', '.ntf', '.nitf', '.sid', '.vrt'
] as const;

export const RASTER_SURVEY_ERROR = 'O GeoGestor não importa arquivos raster como levantamento. Utilize KML, KMZ, GeoJSON, Shapefile ou GeoPackage vetorial.';
export const MBTILES_SURVEY_ERROR = 'MBTiles é aceito somente como mapa-base offline. Use a seção Configurar mapa-base offline.';
export const VECTOR_FORMAT_ERROR = 'Formato de levantamento incompatível. Utilize KML, KMZ, GeoJSON, Shapefile ou GeoPackage vetorial.';

export type VectorUploadClassification = 'vector' | 'raster' | 'mbtiles' | 'unsupported';

export function hasRasterSignature(buffer: Uint8Array) {
  const bytes = Buffer.from(buffer);
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString('ascii');
  return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    || (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || ['GIF87a', 'GIF89a'].includes(ascii(0, 6))
    || (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    || (ascii(0, 4) === 'II*\0')
    || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    || bytes.subarray(0, 12).equals(Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]))
    || bytes.subarray(0, 4).equals(Buffer.from([0xff, 0x4f, 0xff, 0x51]));
}

export function classifyVectorSurveyUpload(fileName: string, head?: Uint8Array): VectorUploadClassification {
  const extension = path.extname(path.basename(fileName)).toLowerCase();
  if (extension === '.mbtiles') return 'mbtiles';
  if ((RASTER_EXTENSIONS as readonly string[]).includes(extension) || (head && hasRasterSignature(head))) return 'raster';
  if ((VECTOR_SURVEY_EXTENSIONS as readonly string[]).includes(extension)) return 'vector';
  return 'unsupported';
}

export function assertVectorSurveyUpload(fileName: string, head?: Uint8Array) {
  const classification = classifyVectorSurveyUpload(fileName, head);
  if (classification === 'raster') throw new Error(RASTER_SURVEY_ERROR);
  if (classification === 'mbtiles') throw new Error(MBTILES_SURVEY_ERROR);
  if (classification !== 'vector') throw new Error(VECTOR_FORMAT_ERROR);
}
