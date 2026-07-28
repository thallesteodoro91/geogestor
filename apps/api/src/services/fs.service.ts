import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import os from 'os';

export type FileSystemAdapter = Pick<typeof fs, 'mkdir' | 'access' | 'rename'>;
export type FileSystemFailureInjector = (
  operation: 'mkdir' | 'access' | 'rename',
  target: string,
  destination?: string
) => void | Promise<void>;
type DatabaseExecutor = Pick<typeof db, 'select' | 'update'>;

const defaultFileSystemAdapter: FileSystemAdapter = {
  mkdir: fs.mkdir.bind(fs),
  access: fs.access.bind(fs),
  rename: fs.rename.bind(fs)
};

function assertInsideRoot(target: string, root: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Operação de filesystem recusada fora da pasta configurada.');
  }
}

async function pathExists(adapter: FileSystemAdapter, target: string) {
  try {
    await adapter.access(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export class FileSystemService {
  private static fileSystem: FileSystemAdapter = defaultFileSystemAdapter;
  private static failureInjector: FileSystemFailureInjector | null = null;

  static setFileSystemAdapterForTests(adapter: FileSystemAdapter | null) {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('A injeção de filesystem é permitida somente em ambiente de teste.');
    }
    this.fileSystem = adapter || defaultFileSystemAdapter;
  }

  static setFailureInjectorForTests(injector: FileSystemFailureInjector | null) {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('A injeção de falhas é permitida somente em ambiente de teste.');
    }
    this.failureInjector = injector;
  }

  static sanitizeFolderName(value: string, fallback = 'Sem nome'): string {
    const cleaned = String(value || '')
      .normalize('NFC')
      .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
      .replace(/[.\s]+$/g, '')
      .trim()
      .slice(0, 120);

    if (!cleaned || cleaned === '.' || cleaned === '..') {
      return fallback;
    }

    const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
    return windowsReservedName.test(cleaned) ? `_${cleaned}` : cleaned;
  }
  
  /**
   * Obtém a pasta raiz configurada no sistema.
   * Expande o caminho se usar `~` para a home do usuário.
   */
  static async getRootFolder(): Promise<string> {
    const configs = await db.select().from(schema.configuracoes).limit(1);
    if (!configs.length || !configs[0].dadosPasta) {
      throw new Error('Pasta raiz não configurada. Conclua o Setup Inicial.');
    }
    
    let rootPath = configs[0].dadosPasta;
    if (rootPath.startsWith('~/') || rootPath.startsWith('~\\')) {
      rootPath = path.join(os.homedir(), rootPath.slice(2));
    }
    return path.resolve(rootPath);
  }

  /**
   * Garante que uma pasta existe e retorna o caminho absoluto dela.
   */
  static async ensureFolder(folderPath: string): Promise<string> {
    try {
      await this.failureInjector?.('mkdir', folderPath);
      await this.fileSystem.mkdir(folderPath, { recursive: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
    }
    return folderPath;
  }

  /**
   * Cria/recupera a pasta para um cliente específico.
   */
  static async getClientFolder(clientName: string): Promise<string> {
    const root = await this.getRootFolder();
    // Sanitiza o nome do cliente para evitar caminhos inválidos
    const safeName = this.sanitizeFolderName(clientName);
    const clientPath = path.join(root, 'Clientes', safeName);
    assertInsideRoot(clientPath, root);
    return this.ensureFolder(clientPath);
  }

  /**
   * Cria/recupera a subpasta de um projeto dentro da pasta de um cliente.
   */
  static async getProjectFolder(clientName: string, projectName: string): Promise<string> {
    const clientPath = await this.getClientFolder(clientName);
    const safeProjectName = this.sanitizeFolderName(projectName);
    const projectPath = path.join(clientPath, safeProjectName);
    assertInsideRoot(projectPath, clientPath);
    return this.ensureFolder(projectPath);
  }

  static async renameClientFolder(oldClientName: string, newClientName: string, clienteId?: string, dbOrTx: DatabaseExecutor = db): Promise<{
    oldPath: string;
    newPath: string;
    renamed: boolean;
    skippedReason?: string;
  }> {
    const root = await this.getRootFolder();
    const clientsRoot = path.join(root, 'Clientes');
    const oldPath = path.join(clientsRoot, this.sanitizeFolderName(oldClientName));
    const newPath = path.join(clientsRoot, this.sanitizeFolderName(newClientName));
    assertInsideRoot(oldPath, clientsRoot);
    assertInsideRoot(newPath, clientsRoot);

    let renamed = false;
    let skippedReason: string | undefined;

    if (path.resolve(oldPath).toLowerCase() === path.resolve(newPath).toLowerCase()) {
      await this.ensureFolder(newPath);
      skippedReason = 'same-path';
    } else {
      const oldExists = await pathExists(this.fileSystem, oldPath);
      const newExists = await pathExists(this.fileSystem, newPath);
      if (oldExists && newExists) {
        throw new Error('Renomeação recusada: a pasta de destino já existe.');
      }
      if (oldExists) {
        await this.failureInjector?.('rename', oldPath, newPath);
        await this.fileSystem.rename(oldPath, newPath);
        renamed = true;
      } else {
        await this.ensureFolder(newPath);
        skippedReason = newExists ? 'already-renamed' : 'old-folder-missing';
      }
    }

    if (clienteId) {
      const docs = await (dbOrTx || db).select().from(schema.documentos).where(eq(schema.documentos.clienteId, clienteId));
      for (const doc of docs) {
        if (doc.caminho && path.relative(oldPath, doc.caminho).split(path.sep)[0] !== '..') {
          const novoCaminho = path.join(newPath, path.relative(oldPath, doc.caminho));
          const novoRelativo = doc.caminhoRelativo ? doc.caminhoRelativo.replace(oldClientName, newClientName) : null;
          await (dbOrTx || db).update(schema.documentos).set({
            caminho: novoCaminho,
            caminhoRelativo: novoRelativo || doc.caminhoRelativo,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.documentos.id, doc.id));
        }
      }
    }

    return { oldPath, newPath, renamed, skippedReason };
  }

  static async renameProjectFolder(clientName: string, oldProjectName: string, newProjectName: string, projetoId?: string, dbOrTx: DatabaseExecutor = db): Promise<{
    oldPath: string;
    newPath: string;
    renamed: boolean;
    skippedReason?: string;
  }> {
    return this.moveProjectFolder(clientName, clientName, oldProjectName, newProjectName, projetoId, dbOrTx);
  }

  static async moveProjectFolder(
    oldClientName: string,
    newClientName: string,
    oldProjectName: string,
    newProjectName: string,
    projetoId?: string,
    dbOrTx: DatabaseExecutor = db
  ): Promise<{
    oldPath: string;
    newPath: string;
    renamed: boolean;
    skippedReason?: string;
  }> {
    const root = await this.getRootFolder();
    const clientsRoot = path.join(root, 'Clientes');
    const oldClientPath = path.join(clientsRoot, this.sanitizeFolderName(oldClientName));
    const newClientPath = path.join(clientsRoot, this.sanitizeFolderName(newClientName));
    const oldPath = path.join(oldClientPath, this.sanitizeFolderName(oldProjectName));
    const newPath = path.join(newClientPath, this.sanitizeFolderName(newProjectName));
    assertInsideRoot(oldPath, clientsRoot);
    assertInsideRoot(newPath, clientsRoot);
    await this.ensureFolder(newClientPath);

    let renamed = false;
    let skippedReason: string | undefined;

    if (path.resolve(oldPath).toLowerCase() === path.resolve(newPath).toLowerCase()) {
      await this.ensureFolder(newPath);
      skippedReason = 'same-path';
    } else {
      const oldExists = await pathExists(this.fileSystem, oldPath);
      const newExists = await pathExists(this.fileSystem, newPath);
      if (oldExists && newExists) {
        throw new Error('Renomeação recusada: a pasta de destino já existe.');
      }
      if (oldExists) {
        await this.failureInjector?.('rename', oldPath, newPath);
        await this.fileSystem.rename(oldPath, newPath);
        renamed = true;
      } else {
        await this.ensureFolder(newPath);
        skippedReason = newExists ? 'already-renamed' : 'old-folder-missing';
      }
    }

    if (projetoId) {
      const docs = await (dbOrTx || db).select().from(schema.documentos).where(eq(schema.documentos.projetoId, projetoId));
      for (const doc of docs) {
        if (doc.caminho && path.relative(oldPath, doc.caminho).split(path.sep)[0] !== '..') {
          const novoCaminho = path.join(newPath, path.relative(oldPath, doc.caminho));
          const novoRelativo = doc.caminhoRelativo
            ? doc.caminhoRelativo.replace(oldClientName, newClientName).replace(oldProjectName, newProjectName)
            : null;
          await (dbOrTx || db).update(schema.documentos).set({
            caminho: novoCaminho,
            caminhoRelativo: novoRelativo || doc.caminhoRelativo,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.documentos.id, doc.id));
        }
      }
    }

    return { oldPath, newPath, renamed, skippedReason };
  }

  /**
   * Abre uma pasta no File Explorer do Windows.
   */
  static openFolderInExplorer(folderPath: string): void {
    execFile('explorer.exe', [folderPath], (error) => {
      if (error) {
        console.error(`Erro ao abrir a pasta: ${error}`);
      }
    });
  }
}
