import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import path from 'path';
import { execFile } from 'child_process';
import crypto from 'crypto';
import { z } from 'zod';
import { JornadaService } from '../services/jornada.service';
import { FileSystemService } from '../services/fs.service';
import { RecoverableFileService, type QuarantineManifest } from '../services/recoverable-file.service';
import { assertLexicalPathInsideRoot, ensurePathInsideRoot } from '../services/path-containment.service';
import { GeospatialImportService } from '../services/geospatial/geospatial-import.service';
import { GeospatialAuditService } from '../services/geospatial/geospatial-audit.service';
import { MbtilesService } from '../services/geospatial/mbtiles.service';
import { BRAZIL_CRS_CATALOG } from '../services/geospatial/crs-detection.service';
import { assertVectorSurveyUpload } from '../services/geospatial/vector-upload-policy.service';

const ALLOWED_EXTENSIONS = ['.pdf', '.gpkg', '.kml', '.kmz', '.docx', '.csv', '.xlsx', '.dwg', '.shp', '.geojson', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.txt', '.zip'];
const PREVIEW_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const HEAVY_EXTENSIONS = ['.gpkg', '.kml', '.kmz', '.dwg', '.shp', '.geojson', '.zip'];
const LEGACY_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const LEGACY_UPLOAD_BODY_LIMIT = Math.ceil(LEGACY_UPLOAD_MAX_BYTES * 4 / 3) + 32 * 1024;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  '.pdf': ['application/pdf'],
  '.gpkg': ['application/geopackage+sqlite3', 'application/vnd.sqlite3', 'application/octet-stream'],
  '.kml': ['application/vnd.google-earth.kml+xml', 'application/xml', 'text/xml'],
  '.kmz': ['application/vnd.google-earth.kmz', 'application/zip'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.csv': ['text/csv', 'application/csv', 'text/plain'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.dwg': ['image/vnd.dwg', 'application/acad', 'application/octet-stream'],
  '.shp': ['application/x-esri-shape', 'application/octet-stream'],
  '.geojson': ['application/geo+json', 'application/json'],
  '.json': ['application/json'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.txt': ['text/plain'],
  '.zip': ['application/zip', 'application/x-zip-compressed']
};

const legacyUploadSchema = z.object({
  clienteId: z.string().trim().min(1).max(200).optional(),
  projetoId: z.string().trim().min(1).max(200).optional(),
  fileName: z.string().min(1).max(255),
  fileContent: z.string().min(1).max(LEGACY_UPLOAD_BODY_LIMIT),
  mimeType: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  uploadPurpose: z.enum(['vector-survey']).optional()
}).strict().refine((input) => Boolean(input.clienteId || input.projetoId), {
  message: 'Informe clienteId ou projetoId.'
});

function validateLegacyFileName(fileName: string) {
  const normalized = fileName.normalize('NFC');
  if (path.isAbsolute(normalized)
    || path.posix.basename(normalized) !== normalized
    || path.win32.basename(normalized) !== normalized
    || normalized === '.'
    || normalized === '..'
    || /[\u0000-\u001f<>:"/\\|?*]/.test(normalized)
    || /[. ]$/.test(normalized)
    || WINDOWS_RESERVED_NAME.test(normalized)) {
    throw new Error('Use somente um nome de arquivo simples, sem caminhos ou nomes reservados.');
  }
  return normalized;
}

function decodeLegacyBase64(fileContent: string, declaredMimeType: string | undefined, extension: string) {
  const dataUrl = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i.exec(fileContent);
  const encoded = dataUrl ? dataUrl[2] : fileContent;
  const dataMimeType = dataUrl?.[1]?.toLowerCase();
  const mimeType = declaredMimeType?.toLowerCase() || dataMimeType || MIME_BY_EXTENSION[extension]?.[0];
  if (declaredMimeType && dataMimeType && declaredMimeType.toLowerCase() !== dataMimeType) {
    throw new Error('O MIME declarado diverge do MIME informado no conteÃºdo.');
  }
  if (!mimeType || !MIME_BY_EXTENSION[extension]?.includes(mimeType)) {
    throw new Error(`O MIME ${mimeType || 'ausente'} nÃ£o corresponde Ã  extensÃ£o ${extension}.`);
  }
  if (encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('O conteÃºdo Base64 estÃ¡ malformado.');
  }
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const decodedBytes = encoded.length / 4 * 3 - padding;
  if (decodedBytes <= 0 || decodedBytes > LEGACY_UPLOAD_MAX_BYTES) {
    throw new Error('O upload legado aceita arquivos de atÃ© 50 MB. Use o upload por streaming para arquivos maiores.');
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.toString('base64') !== encoded) throw new Error('O conteÃºdo Base64 nÃ£o estÃ¡ em formato canÃ´nico.');
  return buffer;
}

function getMaxFileSize(ext: string): number {
  return HEAVY_EXTENSIONS.includes(ext.toLowerCase()) ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
}

function hasExpectedSignature(buffer: Buffer, ext: string) {
  if (ext === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (ext === '.png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === '.jpg' || ext === '.jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === '.gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (ext === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (ext === '.gpkg') return buffer.subarray(0, 16).toString('ascii') === 'SQLite format 3\0';
  if (['.zip', '.kmz', '.docx', '.xlsx'].includes(ext)) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]);
  }
  if (ext === '.dwg') return buffer.subarray(0, 4).toString('ascii') === 'AC10';
  return true;
}

async function assertFileSignature(filePath: string, ext: string) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (!hasExpectedSignature(buffer.subarray(0, bytesRead), ext)) {
      throw new Error(`O conteúdo do arquivo não corresponde à extensão ${ext}.`);
    }
  } finally {
    await handle.close();
  }
}

async function readFileHead(filePath: string, length = 32) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function getVectorSurveyProcessingError(layers: unknown[]) {
  const parsedLayers = layers.filter((layer): layer is Record<string, unknown> => Boolean(layer) && typeof layer === 'object');
  if (!parsedLayers.length) {
    return 'Nenhuma camada vetorial foi encontrada. Verifique se o arquivo contém geometrias vetoriais válidas.';
  }
  if (parsedLayers.every((layer) => layer.status === 'error')) {
    const firstMessage = parsedLayers.find((layer) => typeof layer.errorMessage === 'string')?.errorMessage;
    return typeof firstMessage === 'string' && firstMessage.trim()
      ? firstMessage
      : 'Não foi possível processar nenhuma camada vetorial do arquivo.';
  }
  return null;
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

function getClientDirectory(dadosPasta: string, clienteNome: string) {
  const directory = path.join(
    dadosPasta,
    'Clientes',
    FileSystemService.sanitizeFolderName(clienteNome, 'Cliente sem nome')
  );
  assertLexicalPathInsideRoot(directory, dadosPasta);
  return directory;
}

function getProjectDirectory(dadosPasta: string, clienteNome: string, projetoNome: string) {
  const directory = path.join(
    getClientDirectory(dadosPasta, clienteNome),
    FileSystemService.sanitizeFolderName(projetoNome, 'Projeto sem nome')
  );
  assertLexicalPathInsideRoot(directory, dadosPasta);
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

async function syncDocumentRecord(
  file: any,
  scope: { clienteId: string; projetoId?: string | null; origem?: string },
  database: any = db,
  knownCategory?: Awaited<ReturnType<typeof ensureDocumentCategory>>
) {
  const category = knownCategory || await ensureDocumentCategory(file.category);
  const existing = await database.select()
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
    deletedAt: null,
    criadoEmArquivo: file.createdAt ? new Date(file.createdAt).toISOString() : null,
    modificadoEmArquivo: file.modifiedAt ? new Date(file.modifiedAt).toISOString() : null,
    ultimoSyncEm: now,
    updatedAt: now
  };

  let documentId = existing[0]?.id;

  if (existing.length) {
    await database.update(schema.documentos).set(payload)
      .where(eq(schema.documentos.id, existing[0].id));
  } else {
    documentId = crypto.randomUUID();
    await database.insert(schema.documentos).values({
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
      const uploadPurpose = (data.fields.uploadPurpose as any)?.value;
      const isVectorSurvey = uploadPurpose === 'vector-survey';
      const fileName = data.filename;

      if (!clienteId && !projetoId) {
        return reply.status(400).send({ error: 'É necessário informar clienteId ou projetoId' });
      }

      const safeFileName = path.basename(fileName).replace(/[<>:"/\\|?*]/g, '-').trim();
      const ext = path.extname(safeFileName).toLowerCase();

      if (isVectorSurvey) {
        try { assertVectorSurveyUpload(safeFileName); }
        catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Levantamento vetorial inválido.' }); }
      }

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
      await ensurePathInsideRoot(targetDir, dadosPasta);

      let filePath = '';
      try {
        await fs.mkdir(targetDir, { recursive: true });
        targetDir = await ensurePathInsideRoot(targetDir, dadosPasta, { mustExist: true });
        filePath = await getAvailableFilePath(targetDir, safeFileName);
        
        const limitBytes = getMaxFileSize(ext);
        const limiter = createSizeLimiter(limitBytes, ext);

        // Streaming file to disk com verificação de limite
        await pipeline(data.file, limiter, createWriteStream(filePath, { flags: 'wx' }));
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

      try {
        if (isVectorSurvey) assertVectorSurveyUpload(safeFileName, await readFileHead(filePath));
        await assertFileSignature(filePath, ext);
      } catch (signatureError) {
        await fs.unlink(filePath).catch(() => undefined);
        const message = signatureError instanceof Error ? signatureError.message : 'Conteúdo de arquivo inválido';
        return reply.status(400).send({ error: message });
      }
      const stat = await fs.stat(filePath);
      const relativePath = path.relative(path.dirname(targetDir), filePath);

      let syncedDocument: any;
      try {
        syncedDocument = await db.transaction(async (tx) => {
          const synced = await syncDocumentRecord({
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
          }, tx, documentCategory);
          await JornadaService.logDocumentoAgrupado({
            clienteId: currentClienteId,
            projetoId: currentProjetoId,
            nomeArquivo: synced.name,
            categoria: synced.category,
            data: new Date().toISOString()
          }, tx);
          return synced;
        });
      } catch (databaseError) {
        await fs.unlink(filePath).catch(() => undefined);
        throw databaseError;
      }

      let geospatialLayers: unknown[] = [];
      if (syncedDocument.documentId && GeospatialImportService.isCandidate(filePath)) {
        const documents = await db.select().from(schema.documentos)
          .where(eq(schema.documentos.id, syncedDocument.documentId)).limit(1);
        if (documents.length) geospatialLayers = await GeospatialImportService.processDocument(documents[0], dadosPasta);
      }
      if (isVectorSurvey) {
        const processingError = getVectorSurveyProcessingError(geospatialLayers);
        if (processingError) {
          return reply.status(422).send({ error: processingError, documentStored: true, documentId: syncedDocument.documentId, geospatialLayers });
        }
      }
      return { success: true, ...syncedDocument, geospatialLayers };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao processar stream de arquivo' });
    }
  });

  // POST: Upload a file (Base64 payload)
  server.post('/upload', { bodyLimit: LEGACY_UPLOAD_BODY_LIMIT }, async (request, reply) => {
    reply.header('Deprecation', 'true');
    reply.header('Warning', '299 GeoGestor "Endpoint Base64 depreciado; migre para /api/arquivos/upload/stream"');
    const parsed = legacyUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'O upload legado possui campos invÃ¡lidos.',
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }
    const { clienteId, projetoId, fileName, fileContent, mimeType, category, uploadPurpose } = parsed.data;

    if (!fileName || !fileContent) {
      return reply.status(400).send({ error: 'Nome do arquivo e conteúdo são obrigatórios' });
    }

    let safeFileName: string;
    let fileBuffer: Buffer;
    try {
      safeFileName = validateLegacyFileName(fileName);
      fileBuffer = decodeLegacyBase64(fileContent, mimeType, path.extname(safeFileName).toLowerCase());
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Arquivo invÃ¡lido.' });
    }
    const ext = path.extname(safeFileName).toLowerCase();
    const isVectorSurvey = uploadPurpose === 'vector-survey';

    if (isVectorSurvey) {
      try { assertVectorSurveyUpload(safeFileName); }
      catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Levantamento vetorial inválido.' }); }
    }

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

      await ensurePathInsideRoot(targetDir, dadosPasta);

      // Ensure directory exists
      await fs.mkdir(targetDir, { recursive: true });
      targetDir = await ensurePathInsideRoot(targetDir, dadosPasta, { mustExist: true });

      if (isVectorSurvey) {
        try { assertVectorSurveyUpload(safeFileName, fileBuffer.subarray(0, 32)); }
        catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Levantamento vetorial inválido.' }); }
      }
      
      const limitBytes = getMaxFileSize(ext);
      if (fileBuffer.length > limitBytes) {
        const limitMB = Math.round(limitBytes / (1024 * 1024));
        return reply.status(400).send({ error: `O arquivo excede o limite máximo permitido de ${limitMB} MB para arquivos ${ext}` });
      }

      const filePath = await getAvailableFilePath(targetDir, safeFileName);

      // Write file to disk
      if (!hasExpectedSignature(fileBuffer.subarray(0, 32), ext)) {
        return reply.status(400).send({ error: `O conteúdo do arquivo não corresponde à extensão ${ext}` });
      }
      await fs.writeFile(filePath, fileBuffer, { flag: 'wx' });
      const stat = await fs.stat(filePath);
      const relativePath = path.relative(path.dirname(targetDir), filePath);

      if (!currentClienteId) {
        return reply.status(400).send({ error: 'Não foi possível identificar o cliente do arquivo' });
      }

      let syncedDocument: any;
      try {
        syncedDocument = await db.transaction(async (tx) => {
          const synced = await syncDocumentRecord({
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
          }, tx, documentCategory);
          await JornadaService.logDocumentoAgrupado({
            clienteId: currentClienteId,
            projetoId: currentProjetoId,
            nomeArquivo: synced.name,
            categoria: synced.category,
            data: new Date().toISOString()
          }, tx);
          return synced;
        });
      } catch (databaseError) {
        await fs.unlink(filePath).catch(() => undefined);
        throw databaseError;
      }

      let geospatialLayers: unknown[] = [];
      if (syncedDocument.documentId && GeospatialImportService.isCandidate(filePath)) {
        const documents = await db.select().from(schema.documentos)
          .where(eq(schema.documentos.id, syncedDocument.documentId)).limit(1);
        if (documents.length) geospatialLayers = await GeospatialImportService.processDocument(documents[0], dadosPasta);
      }
      if (isVectorSurvey) {
        const processingError = getVectorSurveyProcessingError(geospatialLayers);
        if (processingError) {
          return reply.status(422).send({ error: processingError, documentStored: true, documentId: syncedDocument.documentId, geospatialLayers });
        }
      }
      return { success: true, ...syncedDocument, geospatialLayers };
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
      const safeFilePath = await ensurePathInsideRoot(filePath, dadosPasta, { mustExist: true });

      const stat = await fs.stat(safeFilePath);
      if (!stat.isFile()) return reply.status(404).send({ error: 'Arquivo não encontrado' });
      const fileName = path.basename(safeFilePath);

      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      reply.header('Access-Control-Expose-Headers', 'Content-Disposition');
      reply.header('Content-Length', String(stat.size));
      return reply.send(createReadStream(safeFilePath));
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
      const safeFilePath = await ensurePathInsideRoot(filePath, dadosPasta, { mustExist: true });

      const stat = await fs.stat(safeFilePath);
      if (!stat.isFile()) return reply.status(404).send({ error: 'Arquivo não encontrado' });
      const fileName = path.basename(safeFilePath);

      reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      reply.header('Cache-Control', 'no-store');
      reply.header('Content-Length', String(stat.size));
      reply.type(getMimeType(safeFilePath));
      return reply.send(createReadStream(safeFilePath));
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
      const safeFilePath = await ensurePathInsideRoot(filePath, dadosPasta, { mustExist: true });
      await fs.access(safeFilePath);
      openPath(safeFilePath);
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
      const safeTargetPath = await ensurePathInsideRoot(targetPath, dadosPasta, { mustExist: true });

      const stat = await fs.stat(safeTargetPath);
      const folderPath = stat.isDirectory() ? safeTargetPath : path.dirname(safeTargetPath);

      openPath(folderPath);
      return { success: true };
    } catch (err) {
      server.log.error(err);
      return reply.status(404).send({ error: 'Pasta não encontrada' });
    }
  });

  // POST: Restore the latest recoverable copy of a document (technical endpoint; no UI dependency)
  server.post('/restore', async (request, reply) => {
    const { documentId } = request.body as { documentId?: string };
    if (!documentId) return reply.status(400).send({ error: 'documentId é obrigatório' });

    const documentRecord = await db.select()
      .from(schema.documentos)
      .where(eq(schema.documentos.id, documentId))
      .limit(1);
    if (!documentRecord.length) return reply.status(404).send({ error: 'Documento não encontrado' });
    if (documentRecord[0].status !== 'excluido') {
      return reply.status(409).send({ error: 'O documento não está marcado como excluído' });
    }

    const dadosPasta = await getDataRoot();
    let restored = false;
    try {
      await RecoverableFileService.restoreLatestByRecordId(dadosPasta, documentId);
      restored = true;
      const restoredAt = new Date();
      await db.transaction(async (tx) => {
        await tx.update(schema.documentos).set({
          status: 'ativo',
          deletedAt: null,
          updatedAt: restoredAt.toISOString(),
          ultimoSyncEm: restoredAt.toISOString()
        }).where(eq(schema.documentos.id, documentId));
        await JornadaService.logClienteEvento({
          clienteId: documentRecord[0].clienteId,
          projetoId: documentRecord[0].projetoId || null,
          tipo: 'Documento',
          titulo: `Documento restaurado: ${documentRecord[0].nome}`,
          categoria: documentRecord[0].categoria || 'Documento',
          data: restoredAt.toISOString(),
          descricao: `Documento restaurado da lixeira interna em ${restoredAt.toLocaleDateString('pt-BR')}`
        }, tx);
      });
      return { success: true };
    } catch (error) {
      if (restored) {
        try {
          const replacement = await RecoverableFileService.quarantine({
            sourcePath: documentRecord[0].caminho,
            dataRoot: dadosPasta,
            recordId: documentId
          });
          await RecoverableFileService.commit(replacement);
        } catch (compensationError) {
          server.log.error(compensationError, 'Falha ao compensar restauração de documento');
        }
      }
      server.log.error(error);
      return reply.status(500).send({ error: 'Não foi possível restaurar o documento com segurança' });
    }
  });

  // DELETE: Move a file to an internal recoverable quarantine
  server.delete('/', async (request, reply) => {
    const { path: filePath } = request.query as any;

    if (!filePath) {
      return reply.status(400).send({ error: 'Caminho do arquivo é obrigatório' });
    }

    let quarantined: QuarantineManifest | null = null;
    let dadosPasta: string | null = null;
    try {
      dadosPasta = await getDataRoot();
      const safeFilePath = await ensurePathInsideRoot(filePath, dadosPasta, { mustExist: true });

      const documentRecord = await db.select()
        .from(schema.documentos)
        .where(eq(schema.documentos.caminho, safeFilePath))
        .limit(1);

      quarantined = await RecoverableFileService.quarantine({
        sourcePath: safeFilePath,
        dataRoot: dadosPasta,
        recordId: documentRecord[0]?.id ?? null
      });
      quarantined = await RecoverableFileService.commit(quarantined);

      if (documentRecord.length) {
        const deletedAt = new Date();
        await db.transaction(async (tx) => {
          await tx.update(schema.documentos).set({
            status: 'excluido',
            deletedAt: deletedAt.toISOString(),
            updatedAt: deletedAt.toISOString(),
            ultimoSyncEm: deletedAt.toISOString()
          }).where(eq(schema.documentos.id, documentRecord[0].id));

          await JornadaService.logClienteEvento({
            clienteId: documentRecord[0].clienteId,
            projetoId: documentRecord[0].projetoId || null,
            tipo: 'Documento',
            titulo: `Documento excluído: ${documentRecord[0].nome}`,
            categoria: documentRecord[0].categoria || 'Documento',
            data: deletedAt.toISOString(),
            descricao: `Arquivo movido para a lixeira interna em ${deletedAt.toLocaleDateString('pt-BR')}`
          }, tx);
        });
      }

      return { success: true };
    } catch (err) {
      if (quarantined && dadosPasta) {
        try {
          await RecoverableFileService.rollback(quarantined, dadosPasta);
        } catch (rollbackError) {
          server.log.error(rollbackError, 'Arquivo preservado em quarentena; restauração automática falhou');
        }
      }
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao excluir o arquivo com segurança' });
    }
  });

  // POST: Fetch geo features for multiple projects
  server.post('/projetos/geo', async (request, reply) => {
    const { projetoIds } = request.body as any;

    if (!Array.isArray(projetoIds) || projetoIds.length === 0) {
      return reply.status(400).send({ error: 'Array de projetoIds é obrigatório' });
    }

    try {
      const geoFeatures = await GeospatialImportService.listForProjects(projetoIds, await getDataRoot());
      return { geoFeatures };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao processar múltiplos arquivos geo' });
    }
  });

  // GET: Analyze geo files for mapping
  server.get('/projeto/:id/geo', async (request, reply) => {
    const { id } = request.params as any;

    try {
      const projetoInfo = await db.select({ id: schema.projetos.id }).from(schema.projetos)
        .where(eq(schema.projetos.id, id)).limit(1);

      if (!projetoInfo.length) {
        return reply.status(404).send({ error: 'Projeto não encontrado' });
      }

      const geoFeatures = await GeospatialImportService.listForProjects([id], await getDataRoot());
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

      const geoFeatures = await GeospatialImportService.listForClient(id, await getDataRoot());
      return { geoFeatures };
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro ao analisar arquivos geo do cliente' });
    }
  });

  server.get('/geospatial/crs-catalog', async () => ({ items: BRAZIL_CRS_CATALOG }));

  server.post('/geospatial/:documentId/preview-crs', async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const { sourceCrs, axisOrder } = (request.body || {}) as {
      sourceCrs?: string;
      axisOrder?: 'longitude-latitude' | 'latitude-longitude';
    };
    try {
      return await GeospatialImportService.previewDocumentCrs(documentId, { sourceCrs, axisOrder });
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Não foi possível gerar a prévia do SRC.' });
    }
  });

  server.get('/geospatial/process/:documentId/progress', async (request) => {
    const { documentId } = request.params as { documentId: string };
    return GeospatialImportService.getProgress(documentId);
  });

  server.post('/geospatial/process/:documentId/cancel', async (request) => {
    const { documentId } = request.params as { documentId: string };
    return GeospatialImportService.requestCancellation(documentId);
  });

  server.get('/geospatial/:layerId/display', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    const query = request.query as { zoom?: string; bbox?: string };
    const zoom = Number(query.zoom || 12);
    const bboxValues = query.bbox?.split(',').map(Number);
    const bbox = bboxValues?.length === 4 && bboxValues.every(Number.isFinite)
      ? bboxValues as [number, number, number, number]
      : null;
    try { return { data: await GeospatialImportService.getDisplayData(layerId, zoom, bbox) }; }
    catch (error) { return reply.status(404).send({ error: error instanceof Error ? error.message : 'Camada não encontrada' }); }
  });

  server.get('/geospatial/:layerId/report', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    try { return await GeospatialImportService.getReport(layerId); }
    catch (error) { return reply.status(404).send({ error: error instanceof Error ? error.message : 'Relatório não encontrado' }); }
  });

  server.get('/geospatial/:layerId/history', async (request) => {
    const { layerId } = request.params as { layerId: string };
    return { events: await GeospatialAuditService.listForLayer(layerId) };
  });

  server.get('/geospatial/:layerId/location-preview', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    try { return await GeospatialImportService.getLocationPreview(layerId); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Pré-visualização indisponível' }); }
  });

  server.post('/geospatial/:layerId/repair', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    try { return await GeospatialImportService.repairLayer(layerId); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Falha no reparo topológico' }); }
  });

  server.post('/geospatial/:layerId/undo-repair', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    try { return await GeospatialImportService.undoRepair(layerId); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Não foi possível desfazer o reparo' }); }
  });

  server.post('/geospatial/:layerId/undo-location', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    try { return await GeospatialImportService.undoRepresentativeLocation(layerId); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Não foi possível desfazer a localização' }); }
  });

  server.get('/geospatial/cache/maintenance', async () => GeospatialImportService.cacheMaintenance(await getDataRoot(), false));
  server.delete('/geospatial/cache/orphans', async () => GeospatialImportService.cacheMaintenance(await getDataRoot(), true));

  server.get('/geospatial/basemaps', async () => ({ basemaps: await MbtilesService.list() }));

  server.get('/geospatial/basemaps/:id/history', async (request) => {
    const { id } = request.params as { id: string };
    return { events: await GeospatialAuditService.listForBasemap(id) };
  });

  server.post('/geospatial/basemaps/:id/active', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { active } = (request.body || {}) as { active?: boolean };
    try { return { basemap: await MbtilesService.setActive(id, active !== false, await getDataRoot()) }; }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Falha ao alterar o mapa-base' }); }
  });

  server.post('/geospatial/basemaps', async (request, reply) => {
    const dataRoot = await getDataRoot();
    const temporaryDirectory = path.join(dataRoot, '.geogestor', 'tmp');
    await fs.mkdir(temporaryDirectory, { recursive: true });
    const temporaryPath = path.join(temporaryDirectory, `mbtiles-${crypto.randomUUID()}.tmp`);
    try {
      const part = await request.file();
      if (!part || path.extname(part.filename).toLowerCase() !== '.mbtiles') return reply.status(400).send({ error: 'Selecione um arquivo .mbtiles.' });
      await pipeline(part.file, createSizeLimiter(500 * 1024 * 1024, '.mbtiles'), createWriteStream(temporaryPath, { flags: 'wx' }));
      const basemap = await MbtilesService.importFile(temporaryPath, path.basename(part.filename), dataRoot);
      return reply.status(201).send({ basemap });
    } catch (error) {
      server.log.error(error);
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Falha ao importar o MBTiles.' });
    } finally {
      await fs.unlink(temporaryPath).catch(() => undefined);
    }
  });

  server.get('/geospatial/basemaps/:id/tiles/:z/:x/:y', async (request, reply) => {
    const { id, z, x, y } = request.params as Record<string, string>;
    try {
      const tile = await MbtilesService.tile(id, Number(z), Number(x), Number(y), await getDataRoot());
      if (!tile) return reply.status(404).send();
      const contentType = tile.format === 'jpg' || tile.format === 'jpeg' ? 'image/jpeg' : tile.format === 'webp' ? 'image/webp' : 'image/png';
      return reply.header('Content-Type', contentType).header('Cache-Control', 'private, max-age=86400').send(tile.bytes);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Tile inválido' });
    }
  });

  server.delete('/geospatial/basemaps/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try { return await MbtilesService.remove(id, await getDataRoot()); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Falha ao remover mapa-base' }); }
  });

  server.post('/geospatial/:documentId/process', async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const { sourceCrs, axisOrder } = (request.body || {}) as {
      sourceCrs?: string;
      axisOrder?: 'longitude-latitude' | 'latitude-longitude';
    };
    try {
      const geospatialLayers = await GeospatialImportService.reprocessDocument(
        documentId,
        await getDataRoot(),
        { sourceCrs, axisOrder }
      );
      return { geospatialLayers };
    } catch (err) {
      server.log.error(err);
      const message = err instanceof Error ? err.message : 'Erro ao reprocessar a camada';
      return reply.status(400).send({ error: message });
    }
  });

  server.post('/geospatial/:layerId/use-location', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    try {
      return { success: true, ...(await GeospatialImportService.useRepresentativeLocation(layerId)) };
    } catch (err) {
      server.log.error(err);
      const message = err instanceof Error ? err.message : 'Erro ao atualizar a localização do projeto';
      return reply.status(400).send({ error: message });
    }
  });

  server.patch('/geospatial/:layerId', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    const { visible, color, opacity } = (request.body || {}) as { visible?: boolean; color?: string; opacity?: number };
    try {
      return { success: true, layer: await GeospatialImportService.updateLayerStyle(layerId, { visible, color, opacity }) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar a camada';
      return reply.status(400).send({ error: message });
    }
  });

  server.delete('/geospatial/:layerId', async (request, reply) => {
    const { layerId } = request.params as { layerId: string };
    try {
      return { success: true, ...(await GeospatialImportService.removeLayer(layerId)) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover a camada';
      return reply.status(400).send({ error: message });
    }
  });
}
