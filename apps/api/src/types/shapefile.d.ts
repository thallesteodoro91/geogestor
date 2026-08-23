declare module 'shapefile' {
  export function read(
    shp: string | ArrayBuffer | Uint8Array,
    dbf?: string | ArrayBuffer | Uint8Array | null,
    options?: { encoding?: string }
  ): Promise<unknown>;
}
