import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import path from 'path';
import zlib from 'zlib';
import { execFile } from 'child_process';
import crypto from 'crypto';
import { JornadaService } from '../services/jornada.service';
import { FileSystemService } from '../services/fs.service';

const ALLOWED_EXTENSIONS = ['.pdf', '.gpkg', '.kml', '.kmz', '.docx', '.csv', '.xlsx', '.dwg', '.shp', '.geojson', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.txt', '.zip'];
const PREVIEW_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const HEAVY_EXTENSIONS = ['.gpkg', '.kml', '.kmz', '.dwg', '.shp', '.geojson', '.zip'];

function getMaxFileSize(ext: string): number {
  return HEAVY_EXTENSIONS.includes(ext.toLowerCase()) ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
}

function createSizeLimiter(limitBytes: number, ext: string) {
  let accumulated = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      accumulated += chunk.length;
      if (accumulated > limitBytes) {
        const limitMB = Math.round(limitBytes / (1024 * 1024));
        callback(new Error(`O arquivo excede o limite máximo permitido de ${limitMB} MB para arquivos ${ext}`));
      } else {
        callback(null, chunk);
      }
    }
  });
}
const DEFAULT_CATEGORY = 'Outros';
const MAX_FILE_SCAN_DEPTH = 2;
const DEFAULT_CATEGORY_META: Record<string, { icone: string; cor: string; ordem: number }> = {
  Contratos: { icone: 'FileText', cor: 'indigo', ordem: 10 },
  Documentos: { icone: 'FilePdf', cor: 'zinc', ordem: 20 },
  Mapas: { icone: 'MapTrifold', cor: 'emerald', ordem: 30 },
  Fotos: { icone: 'ImageSquare', cor: 'sky', ordem: 40 },
  Orçamentos: { icone: 'Receipt', cor: 'violet', ordem: 50 },
  Licenças: { icone: 'Check', cor: 'amber', ordem: 60 },
  Outros: { icone: 'FolderSimple', cor: 'zinc', ordem: 999 }
};

function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.geojson': 'application/geo+json; charset=utf-8',
    '.kml': 'application/vnd.google-earth.kml+xml; charset=utf-8',
    '.kmz': 'application/vnd.google-earth.kmz'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

async function getDataRoot() {
  return FileSystemService.getRootFolder();
}

function ensurePathInsideRoot(filePath: string, dadosPasta: string) {
  const normalizedRoot = path.resolve(dadosPasta).toLowerCase();
  const normalizedPath = path.resolve(filePath).toLowerCase();

  if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error('Acesso negado fora do diretório raiz');
  }
}

function getClientDirectory(dadosPasta: string, clienteNome: string) {
  const directory = path.join(
    dadosPasta,
    'Clientes',
    FileSystemService.sanitizeFolderName(clienteNome, 'Cliente sem nome')
  );
  ensurePathInsideRoot(directory, dadosPasta);
  return directory;
}

function getProjectDirectory(dadosPasta: string, clienteNome: string, projetoNome: string) {
  const directory = path.join(
    getClientDirectory(dadosPasta, clienteNome),
    FileSystemService.sanitizeFolderName(projetoNome, 'Projeto sem nome')
  );
  ensurePathInsideRoot(directory, dadosPasta);
  return directory;
}

function openPath(targetPath: string) {
  const opener =
    process.platform === 'win32'
      ? { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', targetPath] }
      : process.platform === 'darwin'
        ? { command: 'open', args: [targetPath] }
        : { command: 'xdg-open', args: [targetPath] };

  execFile(opener.command, opener.args, (error) => {
    if (error) {
      console.error('[Arquivos] Erro ao abrir caminho:', error);
    }
  });
}

async function getAvailableFilePath(targetDir: string, fileName: string) {
  const parsed = path.parse(fileName);
  let candidate = path.join(targetDir, fileName);
  let index = 1;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(targetDir, `${parsed.name} (${index})${parsed.ext}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}

function sanitizeFolderName(value?: string | null) {
  return FileSystemService.sanitizeFolderName(value || DEFAULT_CATEGORY, DEFAULT_CATEGORY);
}

function inferCategoryMeta(categoryName: string) {
  if (DEFAULT_CATEGORY_META[categoryName]) return DEFAULT_CATEGORY_META[categoryName];

  const normalized = categoryName.toLowerCase();
  if (normalized.includes('contrato')) return DEFAULT_CATEGORY_META.Contratos;
  if (normalized.includes('mapa') || normalized.includes('kml') || normalized.includes('kmz')) return DEFAULT_CATEGORY_META.Mapas;
  if (normalized.includes('foto') || normalized.includes('imagem')) return DEFAULT_CATEGORY_META.Fotos;
  if (normalized.includes('orçamento') || normalized.includes('orcamento')) return DEFAULT_CATEGORY_META.Orçamentos;
  if (normalized.includes('licen')) return DEFAULT_CATEGORY_META.Licenças;
  if (normalized.includes('document')) return DEFAULT_CATEGORY_META.Documentos;

  return { icone: 'FolderSimple', cor: 'teal', ordem: 500 };
}

function parseStoredTags(tags?: string | null) {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function listDocumentCategories() {
  const categories = await db.select().from(schema.documentoCategorias);
  return categories
    .filter((category) => category.ativo !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function ensureDocumentCategory(categoryName?: string | null, options?: { icone?: string; cor?: string }) {
  const name = (categoryName || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY;
  const categories = await listDocumentCategories();
  const existing = categories.find((category) => category.nome.toLowerCase() === name.toLowerCase());

  if (existing) {
    if (options?.icone || options?.cor) {
      const updated = await db.update(schema.documentoCategorias).set({
        icone: options.icone || existing.icone,
        cor: options.cor || existing.cor,
        updatedAt: new Date().toISOString()
      })
        .where(eq(schema.documentoCategorias.id, existing.id))
        .returning();
      return updated[0] || existing;
    }

    return existing;
  }

  const meta = inferCategoryMeta(name);
  const created = await db.insert(schema.documentoCategorias).values({
    id: crypto.randomUUID(),
    nome: name,
    pastaNome: sanitizeFolderName(name),
    icone: options?.icone || meta.icone,
    cor: options?.cor || meta.cor,
    ordem: meta.ordem,
    ativo: true
  }).returning();

  return created[0];
}

async function syncDocumentRecord(file: any, scope: { clienteId: string; projetoId?: string | null; origem?: string }) {
  const category = await ensureDocumentCategory(file.category);
  const existing = await db.select()
    .from(schema.documentos)
    .where(eq(schema.documentos.caminho, file.path))
    .limit(1);

  const now = new Date().toISOString();
  const tags = Array.from(new Set([category.nome, getFileKindLabel(file.extension)].filter(Boolean)));
  const payload = {
    clienteId: scope.clienteId,
    projetoId: scope.projetoId || null,
    categoriaId: category.id,
    categoria: category.nome,
    nome: file.name,
    nomeOriginal: file.name,
    extensao: file.extension,
    caminho: file.path,
    caminhoRelativo: file.relativePath || null,
    tamanhoBytes: file.sizeBytes || 0,
    mimeType: getMimeType(file.path),
    tags: JSON.stringify(tags),
    origem: scope.origem || 'sync',
    status: 'ativo',
    criadoEmArquivo: file.createdAt ? new Date(file.createdAt).toISOString() : null,
    modificadoEmArquivo: file.modifiedAt ? new Date(file.modifiedAt).toISOString() : null,
    ultimoSyncEm: now,
    updatedAt: now
  };

  let documentId = existing[0]?.id;

  if (existing.length) {
    await db.update(schema.documentos).set(payload)
      .where(eq(schema.documentos.id, existing[0].id));
  } else {
    documentId = crypto.randomUUID();
    await db.insert(schema.documentos).values({
      id: documentId,
      ...payload
    });
  }

  return {
    ...file,
    documentId,
    categoryId: category.id,
    category: category.nome,
    categoryIcon: category.icone,
    categoryTone: category.cor,
    tags
  };
}

function getFileKindLabel(extension: string) {
  const ext = extension.toLowerCase();
  if (ext === '.pdf') return 'PDF';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'Imagem';
  if (['.gpkg', '.shp', '.kml', '.kmz', '.geojson', '.json'].includes(ext)) return 'Mapa';
  return 'Arquivo';
}

async function collectFilesFromDir(rootDir: string, options: { excludedDirectories?: string[] } = {}, depth = 0, category = '', currentDir = rootDir): Promise<unknown[]> {
  try {
    await fs.access(currentDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const excluded = new Set((options.excludedDirectories || []).map(item => item.toLowerCase()));
  const fileList: any[] = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (depth === 0 && excluded.has(entry.name.toLowerCase())) continue;
      if (depth < MAX_FILE_SCAN_DEPTH) {
        const nextCategory = category || entry.name;
        fileList.push(...await collectFilesFromDir(rootDir, options, depth + 1, nextCategory, entryPath));
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

    const stat = await fs.stat(entryPath);
    fileList.push({
      name: entry.name,
      extension: ext,
      sizeBytes: stat.size,
      createdAt: stat.birthtime,
      modifiedAt: stat.mtime,
      path: entryPath,
      category: category || DEFAULT_CATEGORY,
      relativePath: path.relative(rootDir, entryPath)
    });
  }

  return fileList;
}

function parseKmlFeatureCollection(content: string, fileName: string) {
  const coordMatches = [...content.matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi)];
  const features: any[] = [];

  for (const match of coordMatches) {
    const rawCoords = match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const coords = rawCoords
      .split(/\s+/)
      .map((str) => {
        const parts = str.split(',');
        const lng = Number(parts[0]);
        const lat = Number(parts[1]);
        return [lng, lat];
      })
      .filter((c) => !isNaN(c[0]) && !isNaN(c[1]));

    if (coords.length > 0) {
      let type = 'LineString';
      let geometryCoords: any = coords;

      if (coords.length === 1) {
        type = 'Point';
        geometryCoords = coords[0];
      } else if (
        coords.length > 2 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1]
      ) {
        type = 'Polygon';
        geometryCoords = [coords];
      }

      features.push({
        type: 'Feature',
        properties: { name: fileName },
        geometry: {
          type,
          coordinates: geometryCoords
        }
      });
    }
  }

  if (features.length === 0) return null;

  return {
    type: 'FeatureCollection',
    features
  };
}

function decodeZipEntry(data: Buffer, compressionMethod: number) {
  if (compressionMethod === 0) return data.toString('utf-8');
  if (compressionMethod === 8) return zlib.inflateRawSync(data).toString('utf-8');
  return null;
}

function extractKmlEntriesFromKmz(buffer: Buffer) {
  const entries: Array<{ name: string; content: string }> = [];
  let offset = 0;

  while (offset <= buffer.length - 46) {
    const signature = buffer.readUInt32LE(offset);

    if (signature !== 0x02014b50) {
      offset += 1;
      continue;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const entryName = buffer.subarray(fileNameStart, fileNameEnd).toString('utf-8');

    if (entryName.toLowerCase().endsWith('.kml') && localHeaderOffset <= buffer.length - 30) {
      const localSignature = buffer.readUInt32LE(localHeaderOffset);

      if (localSignature === 0x04034b50) {
        const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
        const dataEnd = dataStart + compressedSize;

        if (dataEnd <= buffer.length) {
          const content = decodeZipEntry(buffer.subarray(dataStart, dataEnd), compressionMethod);
          if (content) entries.push({ name: entryName, content });
        }
      }
    }

    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

async function collectGeoFeaturesFromDir(targetDir: string, depth = 0) {
  try {
    await fs.access(targetDir);
  } catch {
    return [];
  }

  const files = await fs.readdir(targetDir, { withFileTypes: true });
  const geoFeatures: any[] = [];

  for (const file of files) {
    if (file.isDirectory()) {
      if (depth < MAX_FILE_SCAN_DEPTH) {
        geoFeatures.push(...await collectGeoFeaturesFromDir(path.join(targetDir, file.name), depth + 1));
      }
      continue;
    }

    if (!file.isFile()) continue;

    const ext = path.extname(file.name).toLowerCase();
    const filePath = path.join(targetDir, file.name);

    if (ext === '.geojson' || ext === '.json') {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const json = JSON.parse(content);
        if (json.type === 'FeatureCollection' || json.type === 'Feature') {
          geoFeatures.push({
            fileName: file.name,
            type: 'geojson',
            data: json
          });
        }
      } catch (err) {
        // Ignore invalid json
      }
    } else if (ext === '.kml') {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const featureCollection = parseKmlFeatureCollection(content, file.name);

        if (featureCollection) {
          geoFeatures.push({
            fileName: file.name,
            type: 'kml',
            data: featureCollection
          });
        }
      } catch (err) {
        // Ignore malformed kml
      }
    } else if (ext === '.kmz') {
      try {
        const kmzBuffer = await fs.readFile(filePath);
        const kmlEntries = extractKmlEntriesFromKmz(kmzBuffer);

        for (const entry of kmlEntries) {
          const featureCollection = parseKmlFeatureCollection(entry.content, `${file.name} / ${entry.name}`);

          if (featureCollection) {
            geoFeatures.push({
              fileName: `${file.name} / ${entry.name}`,
              type: 'kmz',
              data: featureCollection
            });
          }
        }
      } catch (err) {
        // Ignore malformed kmz
      }
    }
  }

  return geoFeatures;
}

export async function arquivosRoutes(server: FastifyInstance) {
  server.get('/categorias', async (request, reply) => {
    try {
      return await listDocumentCategories();
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao carregar categorias de documentos' });
    }
  });

  server.post('/categorias', async (request, reply) => {
    const { nome, icone, cor } = request.body as any;

    if (!nome || !String(nome).trim()) {
      return reply.status(400).send({ error: 'Nome da categoria é obrigatório' });
    }

    try {
      const category = await ensureDocumentCategory(String(nome).trim(), { icone, cor });
      return reply.status(201).send(category);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao salvar categoria de documentos' });
    }
  });

  server.patch('/categorias/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { nome, icone, cor, ativo } = request.body as any;

    try {
      const current = await db.select()
        .from(schema.documentoCategorias)
        .where(eq(schema.documentoCategorias.id, id))
        .limit(1);

      if (!current.length) {
        return reply.status(404).send({ error: 'Categoria não encontrada' });
      }

      const nextName = nome !== undefined ? String(nome).trim() : undefined;
      if (nome !== undefined && !nextName) {
        return reply.status(400).send({ error: 'Nome da categoria é obrigatório' });
      }

      if (nextName) {
        const categories = await listDocumentCategories();
        const duplicate = categories.find((category) =>
          category.id !== id && category.nome.toLowerCase() === nextName.toLowerCase()
        );

        if (duplicate) {
          return reply.status(409).send({ error: 'Já existe uma categoria com esse nome' });
        }
      }

      const updated = await db.update(schema.documentoCategorias).set({
        nome: nextName !== undefined ? nextName : undefined,
        pastaNome: nextName !== undefined ? sanitizeFolderName(nextName) : undefined,
        icone: icone !== undefined ? icone : undefined,
        cor: cor !== undefined ? cor : undefined,
        ativo: ativo !== undefined ? Boolean(ativo) : undefined,
        updatedAt: new Date().toISOString()
      })
        .where(eq(schema.documentoCategorias.id, id))
        .returning();

      if (nextName) {
        await db.update(schema.documentos).set({
          categoria: nextName,
          updatedAt: new Date().toISOString()
        })
          .where(eq(schema.documentos.categoriaId, id));
      }

      return updated[0];
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao atualizar categoria de documentos' });
    }
  });

  server.delete('/categorias/:id', async (request, reply) => {
    const { id } = request.params as any;

    try {
      const current = await db.select()
        .from(schema.documentoCategorias)
        .where(eq(schema.documentoCategorias.id, id))
        .limit(1);

      if (!current.length) {
        return reply.status(404).send({ error: 'Categoria não encontrada' });
      }

      const linkedDocument = await db.select({ id: schema.documentos.id })
        .from(schema.documentos)
        .where(eq(schema.documentos.categoriaId, id))
        .limit(1);

      if (linkedDocument.length > 0) {
        return reply.status(409).send({ error: 'Não é possível apagar uma categoria que possui documentos vinculados' });
      }

      const updated = await db.update(schema.documentoCategorias).set({
        ativo: false,
        updatedAt: new Date().toISOString()
      })
        .where(eq(schema.documentoCategorias.id, id))
        .returning();

      return updated[0];
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao apagar categoria de documentos' });
    }
  });
  
  // GET: List files for a project
  server.get('/projeto/:id', async (request, reply) => {
    const { id } = request.params as any;

    try {
      const projetoInfo = await db
        .select({
          clienteId: schema.projetos.clienteId,
          projetoNome: schema.projetos.nome,
          clienteNome: schema.clientes.nome
        })
        .from(schema.projetos)
        .innerJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(eq(schema.projetos.id, id))
        .limit(1);

      if (!projetoInfo.length) {
        return reply.status(404).send({ error: 'Projeto não encontrado' });
      }

      const { clienteId, projetoNome, clienteNome } = projetoInfo[0];

      const dadosPasta = await getDataRoot();
      const targetDir = getProjectDirectory(dadosPasta, clienteNome, projetoNome);

      // Create folder if it doesn't exist
      await fs.mkdir(targetDir, { recursive: true });

      const fileList = await collectFilesFromDir(targetDir);
      const syncedFiles = await Promise.all(
        fileList.map((file) => syncDocumentRecord(file, { clienteId, projetoId: id }))
      );

      return { files: syncedFiles, path: targetDir };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao processar arquivos do projeto' });
    }
  });

  // GET: List files for a client (general files only)
  server.get('/cliente/:id', async (request, reply) => {
    const { id } = request.params as any;

    try {
      const clienteInfo = await db
        .select({
          nome: schema.clientes.nome
        })
        .from(schema.clientes)
        .where(eq(schema.clientes.id, id))
        .limit(1);

      if (!clienteInfo.length) {
        return reply.status(404).send({ error: 'Cliente não encontrado' });
      }

      const clienteNome = clienteInfo[0].nome;

      const dadosPasta = await getDataRoot();
      const targetDir = getClientDirectory(dadosPasta, clienteNome);

      // Create folder if it doesn't exist
      await fs.mkdir(targetDir, { recursive: true });

      const projetosCliente = await db
        .select({ nome: schema.projetos.nome })
        .from(schema.projetos)
        .where(eq(schema.projetos.clienteId, id));

      const fileList = await collectFilesFromDir(targetDir, {
        excludedDirectories: projetosCliente.map(projeto => projeto.nome)
      });
      const syncedFiles = await Promise.all(
        fileList.map((file) => syncDocumentRecord(file, { clienteId: id }))
      );

      return { files: syncedFiles, path: targetDir };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao processar arquivos do cliente' });
    }
  });

  // POST: Upload a file (Streaming Multipart)
  server.post('/upload/stream', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'Nenhum arquivo enviado' });
      }

      const clienteId = (data.fields.clienteId as any)?.value;
      const projetoId = (data.fields.projetoId as any)?.value;
      const category = (data.fields.category as any)?.value || DEFAULT_CATEGORY;
      const fileName = data.filename;

      if (!clienteId && !projetoId) {
        return reply.status(400).send({ error: 'É necessário informar clienteId ou projetoId' });
      }

      const safeFileName = path.basename(fileName).replace(/[<>:"/\\|?*]/g, '-').trim();
      const ext = path.extname(safeFileName).toLowerCase();

      if (!safeFileName || !ALLOWED_EXTENSIONS.includes(ext)) {
        return reply.status(400).send({ error: 'Tipo de arquivo não permitido' });
      }

      const dadosPasta = await getDataRoot();
      let targetDir = '';
      let currentClienteId = clienteId || null;
      let currentProjetoId = projetoId || null;
      const documentCategory = await ensureDocumentCategory(category);
      const folderCategory = documentCategory.pastaNome || sanitizeFolderName(documentCategory.nome);

      if (projetoId) {
        const info = await db
          .select({
            clienteId: schema.projetos.clienteId,
            projetoNome: schema.projetos.nome,
            clienteNome: schema.clientes.nome
          })
          .from(schema.projetos)
          .innerJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
          .where(eq(schema.projetos.id, projetoId))
          .limit(1);

        if (!info.length) return reply.status(404).send({ error: 'Projeto ou cliente não encontrado' });
        
        currentClienteId = info[0].clienteId;
        currentProjetoId = projetoId;
        targetDir = path.join(getProjectDirectory(dadosPasta, info[0].clienteNome, info[0].projetoNome), folderCategory);
      } else if (clienteId) {
        const info = await db
          .select({ clienteNome: schema.clientes.nome })
          .from(schema.clientes)
          .where(eq(schema.clientes.id, clienteId))
          .limit(1);

        if (!info.length) return reply.status(404).send({ error: 'Cliente não encontrado' });
        currentClienteId = clienteId;
        targetDir = path.join(getClientDirectory(dadosPasta, info[0].clienteNome), folderCategory);
      }
      ensurePathInsideRoot(targetDir, dadosPasta);

      let filePath = '';
      try {
        await fs.mkdir(targetDir, { recursive: true });
        filePath = await getAvailableFilePath(targetDir, safeFileName);
        
        const limitBytes = getMaxFileSize(ext);
        const limiter = createSizeLimiter(limitBytes, ext);

        // Streaming file to disk com verificação de limite
        await pipeline(data.file, limiter, createWriteStream(filePath));
      } catch (streamErr) {
        if (filePath) {
          await fs.unlink(filePath).catch(() => {});
        }
        const message = streamErr instanceof Error ? streamErr.message : String(streamErr);
        if (message && message.includes('excede o limite')) {
          return reply.status(400).send({ error: message });
        }
        throw streamErr;
      }

      const stat = await fs.stat(filePath);
      const relativePath = path.relative(path.dirname(targetDir), filePath);

      const syncedDocument = await syncDocumentRecord({
        name: path.basename(filePath),
        extension: ext,
        sizeBytes: stat.size,
        createdAt: stat.birthtime,
        modifiedAt: stat.mtime,
        path: filePath,
        category: documentCategory.nome,
        relativePath
      }, {
        clienteId: currentClienteId,
        projetoId: currentProjetoId,
        origem: 'upload'
      });

      if (currentClienteId) {
        const uploadedAt = new Date();
        await JornadaService.logDocumentoAgrupado({
          clienteId: currentClienteId,
          projetoId: currentProjetoId,
          nomeArquivo: syncedDocument.name,
          categoria: syncedDocument.category,
          data: uploadedAt.toISOString()
        });
      }

      return { success: true, ...syncedDocument };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao processar stream de arquivo' });
    }
  });

  // POST: Upload a file (Base64 payload)
  server.post('/upload', async (request, reply) => {
    const { clienteId, projetoId, fileName, fileContent, category } = request.body as any;

    if (!fileName || !fileContent) {
      return reply.status(400).send({ error: 'Nome do arquivo e conteúdo são obrigatórios' });
    }

    const safeFileName = path.basename(fileName).replace(/[<>:"/\\|?*]/g, '-').trim();
    const ext = path.extname(safeFileName).toLowerCase();

    if (!safeFileName || !ALLOWED_EXTENSIONS.includes(ext)) {
      return reply.status(400).send({ error: 'Tipo de arquivo não permitido' });
    }

    try {
      const dadosPasta = await getDataRoot();
      let targetDir = '';
      let currentClienteId = clienteId || null;
      let currentProjetoId = projetoId || null;
      const documentCategory = await ensureDocumentCategory(category);
      const folderCategory = documentCategory.pastaNome || sanitizeFolderName(documentCategory.nome);

      if (projetoId) {
        // Fetch project and client
        const info = await db
          .select({
            clienteId: schema.projetos.clienteId,
            projetoNome: schema.projetos.nome,
            clienteNome: schema.clientes.nome
          })
          .from(schema.projetos)
          .innerJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
          .where(eq(schema.projetos.id, projetoId))
          .limit(1);

        if (!info.length) {
          return reply.status(404).send({ error: 'Projeto ou cliente não encontrado' });
        }
        currentClienteId = info[0].clienteId;
        currentProjetoId = projetoId;
        targetDir = path.join(getProjectDirectory(dadosPasta, info[0].clienteNome, info[0].projetoNome), folderCategory);
      } else if (clienteId) {
        // Fetch client
        const info = await db
          .select({
            clienteNome: schema.clientes.nome
          })
          .from(schema.clientes)
          .where(eq(schema.clientes.id, clienteId))
          .limit(1);

        if (!info.length) {
          return reply.status(404).send({ error: 'Cliente não encontrado' });
        }
        currentClienteId = clienteId;
        targetDir = path.join(getClientDirectory(dadosPasta, info[0].clienteNome), folderCategory);
      } else {
        return reply.status(400).send({ error: 'É necessário informar clienteId ou projetoId' });
      }

      ensurePathInsideRoot(targetDir, dadosPasta);

      // Ensure directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Decode Base64 content
      let base64Data = fileContent;
      if (fileContent.includes(';base64,')) {
        base64Data = fileContent.split(';base64,')[1];
      }
      const fileBuffer = Buffer.from(base64Data, 'base64');
      
      const limitBytes = getMaxFileSize(ext);
      if (fileBuffer.length > limitBytes) {
        const limitMB = Math.round(limitBytes / (1024 * 1024));
        return reply.status(400).send({ error: `O arquivo excede o limite máximo permitido de ${limitMB} MB para arquivos ${ext}` });
      }

      const filePath = await getAvailableFilePath(targetDir, safeFileName);

      // Write file to disk
      await fs.writeFile(filePath, fileBuffer);
      const stat = await fs.stat(filePath);
      const relativePath = path.relative(path.dirname(targetDir), filePath);

      if (!currentClienteId) {
        return reply.status(400).send({ error: 'Não foi possível identificar o cliente do arquivo' });
      }

      const syncedDocument = await syncDocumentRecord({
        name: path.basename(filePath),
        extension: ext,
        sizeBytes: stat.size,
        createdAt: stat.birthtime,
        modifiedAt: stat.mtime,
        path: filePath,
        category: documentCategory.nome,
        relativePath
      }, {
        clienteId: currentClienteId,
        projetoId: currentProjetoId,
        origem: 'upload'
      });

      if (currentClienteId) {
        const uploadedAt = new Date();
        await JornadaService.logDocumentoAgrupado({
          clienteId: currentClienteId,
          projetoId: currentProjetoId,
          nomeArquivo: syncedDocument.name,
          categoria: syncedDocument.category,
          data: uploadedAt.toISOString()
        });
      }

      return { success: true, ...syncedDocument };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao salvar o arquivo no servidor' });
    }
  });

  // GET: Download/Open a file
  server.get('/download', async (request, reply) => {
    const { path: filePath } = request.query as any;

    if (!filePath) {
      return reply.status(400).send({ error: 'Caminho do arquivo é obrigatório' });
    }

    try {
      const dadosPasta = await getDataRoot();
      ensurePathInsideRoot(filePath, dadosPasta);

      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      reply.header('Access-Control-Expose-Headers', 'Content-Disposition');
      reply.send(fileBuffer);
    } catch (err) {
      server.log.error(err);
      return reply.status(404).send({ error: 'Arquivo não encontrado' });
    }
  });

  // GET: Inline preview for PDFs and images
  server.get('/preview', async (request, reply) => {
    const { path: filePath } = request.query as any;

    if (!filePath) {
      return reply.status(400).send({ error: 'Caminho do arquivo é obrigatório' });
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!PREVIEW_EXTENSIONS.includes(ext)) {
      return reply.status(415).send({ error: 'Pré-visualização disponível apenas para PDF e imagens' });
    }

    try {
      const dadosPasta = await getDataRoot();
      ensurePathInsideRoot(filePath, dadosPasta);

      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      reply.header('Cache-Control', 'no-store');
      reply.type(getMimeType(filePath));
      return reply.send(fileBuffer);
    } catch (err) {
      server.log.error(err);
      return reply.status(404).send({ error: 'Arquivo não encontrado' });
    }
  });

  // POST: Open a file in the operating system default app
  server.post('/open-file', async (request, reply) => {
    const { path: filePath } = request.body as any;

    if (!filePath) {
      return reply.status(400).send({ error: 'Caminho do arquivo é obrigatório' });
    }

    try {
      const dadosPasta = await getDataRoot();
      ensurePathInsideRoot(filePath, dadosPasta);
      await fs.access(filePath);
      openPath(filePath);
      return { success: true };
    } catch (err) {
      server.log.error(err);
      return reply.status(404).send({ error: 'Arquivo não encontrado' });
    }
  });

  // POST: Open a folder in the operating system file explorer
  server.post('/open-folder', async (request, reply) => {
    const { path: targetPath } = request.body as any;

    if (!targetPath) {
      return reply.status(400).send({ error: 'Caminho da pasta é obrigatório' });
    }

    try {
      const dadosPasta = await getDataRoot();
      ensurePathInsideRoot(targetPath, dadosPasta);

      const stat = await fs.stat(targetPath);
      const folderPath = stat.isDirectory() ? targetPath : path.dirname(targetPath);

      openPath(folderPath);
      return { success: true };
    } catch (err) {
      server.log.error(err);
      return reply.status(404).send({ error: 'Pasta não encontrada' });
    }
  });

  // DELETE: Delete a file
  server.delete('/', async (request, reply) => {
    const { path: filePath } = request.query as any;

    if (!filePath) {
      return reply.status(400).send({ error: 'Caminho do arquivo é obrigatório' });
    }

    try {
      const dadosPasta = await getDataRoot();
      ensurePathInsideRoot(filePath, dadosPasta);

      const documentRecord = await db.select()
        .from(schema.documentos)
        .where(eq(schema.documentos.caminho, filePath))
        .limit(1);

      await fs.unlink(filePath);

      if (documentRecord.length) {
        const deletedAt = new Date();
        await db.update(schema.documentos).set({
          status: 'excluido',
          updatedAt: deletedAt.toISOString(),
          ultimoSyncEm: deletedAt.toISOString()
        })
          .where(eq(schema.documentos.id, documentRecord[0].id));

        await JornadaService.logClienteEvento({
          clienteId: documentRecord[0].clienteId,
          projetoId: documentRecord[0].projetoId || null,
          tipo: 'Documento',
          titulo: `Documento excluído: ${documentRecord[0].nome}`,
          categoria: documentRecord[0].categoria || 'Documento',
          data: deletedAt.toISOString(),
          descricao: `Arquivo: ${documentRecord[0].nome}\nCategoria: ${documentRecord[0].categoria || 'Documento'}\nData: ${deletedAt.toLocaleDateString('pt-BR')}`
        });
      }

      return { success: true };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir o arquivo do disco' });
    }
  });

  // POST: Fetch geo features for multiple projects
  server.post('/projetos/geo', async (request, reply) => {
    const { projetoIds } = request.body as any;

    if (!Array.isArray(projetoIds) || projetoIds.length === 0) {
      return reply.status(400).send({ error: 'Array de projetoIds é obrigatório' });
    }

    try {
      const dadosPasta = await getDataRoot();
      const allGeoFeatures: any[] = [];

      for (const id of projetoIds) {
        const projetoInfo = await db
          .select({
            projetoNome: schema.projetos.nome,
            clienteNome: schema.clientes.nome
          })
          .from(schema.projetos)
          .innerJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
          .where(eq(schema.projetos.id, id))
          .limit(1);

        if (projetoInfo.length > 0) {
          const targetDir = getProjectDirectory(dadosPasta, projetoInfo[0].clienteNome, projetoInfo[0].projetoNome);
          const features = await collectGeoFeaturesFromDir(targetDir);
          
          // Inject project ID so frontend knows which polygon belongs to which project
          const enrichedFeatures = features.map(f => ({ ...f, projetoId: id }));
          allGeoFeatures.push(...enrichedFeatures);
        }
      }

      return { geoFeatures: allGeoFeatures };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao processar múltiplos arquivos geo' });
    }
  });

  // GET: Analyze geo files for mapping
  server.get('/projeto/:id/geo', async (request, reply) => {
    const { id } = request.params as any;

    try {
      const projetoInfo = await db
        .select({
          projetoNome: schema.projetos.nome,
          clienteNome: schema.clientes.nome
        })
        .from(schema.projetos)
        .innerJoin(schema.clientes, eq(schema.projetos.clienteId, schema.clientes.id))
        .where(eq(schema.projetos.id, id))
        .limit(1);

      if (!projetoInfo.length) {
        return reply.status(404).send({ error: 'Projeto não encontrado' });
      }

      const { projetoNome, clienteNome } = projetoInfo[0];

      const dadosPasta = await getDataRoot();
      const targetDir = getProjectDirectory(dadosPasta, clienteNome, projetoNome);
      const geoFeatures = await collectGeoFeaturesFromDir(targetDir);

      return { geoFeatures };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao analisar arquivos geo' });
    }
  });

  // GET: Analyze client-level geo files for mapping
  server.get('/cliente/:id/geo', async (request, reply) => {
    const { id } = request.params as any;

    try {
      const clienteInfo = await db
        .select({
          nome: schema.clientes.nome
        })
        .from(schema.clientes)
        .where(eq(schema.clientes.id, id))
        .limit(1);

      if (!clienteInfo.length) {
        return reply.status(404).send({ error: 'Cliente não encontrado' });
      }

      const dadosPasta = await getDataRoot();
      const targetDir = getClientDirectory(dadosPasta, clienteInfo[0].nome);
      const geoFeatures = await collectGeoFeaturesFromDir(targetDir);

      return { geoFeatures };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao analisar arquivos geo do cliente' });
    }
  });
}
