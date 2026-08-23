import path from 'node:path';
import { unzipSync } from 'fflate';

export interface SafeArchiveOptions {
  maxEntries?: number;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
  maxExpansionRatio?: number;
}

export function extractSafeArchive(buffer: Buffer | Uint8Array, options: SafeArchiveOptions = {}) {
  const maxEntries = options.maxEntries ?? 64;
  const maxEntryBytes = options.maxEntryBytes ?? 50 * 1024 * 1024;
  const maxTotalBytes = options.maxTotalBytes ?? 100 * 1024 * 1024;
  const maxExpansionRatio = options.maxExpansionRatio ?? 100;
  const data = Buffer.from(buffer);
  let offset = 0;
  let entries = 0;
  let totalUncompressed = 0;

  while (offset <= data.length - 46) {
    if (data.readUInt32LE(offset) !== 0x02014b50) {
      offset += 1;
      continue;
    }
    const compressedSize = data.readUInt32LE(offset + 20);
    const uncompressedSize = data.readUInt32LE(offset + 24);
    const fileNameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > data.length) throw new Error('Arquivo ZIP possui diretório central inválido.');
    const name = data.subarray(nameStart, nameEnd).toString('utf8').replace(/\\/g, '/');
    const normalized = path.posix.normalize(name);
    if (!name || normalized.startsWith('../') || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
      throw new Error('O arquivo compactado contém um caminho inseguro.');
    }
    entries += 1;
    totalUncompressed += uncompressedSize;
    if (entries > maxEntries) throw new Error(`O arquivo compactado excede o limite de ${maxEntries} entradas.`);
    if (uncompressedSize > maxEntryBytes) throw new Error('Uma entrada do arquivo compactado excede o limite permitido.');
    if (totalUncompressed > maxTotalBytes) throw new Error('O conteúdo expandido excede o limite permitido.');
    if (uncompressedSize > Math.max(compressedSize, 1) * maxExpansionRatio) {
      throw new Error('O arquivo compactado excede a taxa segura de expansão.');
    }
    offset = nameEnd + extraLength + commentLength;
  }
  if (!entries) throw new Error('O arquivo compactado não possui um diretório central válido.');

  const extracted = unzipSync(data);
  const result = new Map<string, Uint8Array>();
  for (const [name, content] of Object.entries(extracted)) {
    const normalized = path.posix.normalize(name.replace(/\\/g, '/'));
    if (content.length > 0) result.set(normalized, content);
  }
  return result;
}
