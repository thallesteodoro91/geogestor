import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import os from 'os';

export class FileSystemService {
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
      await fs.mkdir(folderPath, { recursive: true });
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
    return this.ensureFolder(clientPath);
  }

  /**
   * Cria/recupera a subpasta de um projeto dentro da pasta de um cliente.
   */
  static async getProjectFolder(clientName: string, projectName: string): Promise<string> {
    const clientPath = await this.getClientFolder(clientName);
    const safeProjectName = this.sanitizeFolderName(projectName);
    const projectPath = path.join(clientPath, safeProjectName);
    return this.ensureFolder(projectPath);
  }

  static async renameClientFolder(oldClientName: string, newClientName: string, clienteId?: string, dbOrTx: any = db): Promise<{
    oldPath: string;
    newPath: string;
    renamed: boolean;
    skippedReason?: string;
  }> {
    const root = await this.getRootFolder();
    const clientsRoot = path.join(root, 'Clientes');
    const oldPath = path.join(clientsRoot, this.sanitizeFolderName(oldClientName));
    const newPath = path.join(clientsRoot, this.sanitizeFolderName(newClientName));

    let renamed = false;
    let skippedReason: string | undefined;

    if (path.resolve(oldPath).toLowerCase() === path.resolve(newPath).toLowerCase()) {
      await this.ensureFolder(newPath);
      skippedReason = 'same-path';
    } else {
      try {
        await fs.access(oldPath);
        try {
          await fs.access(newPath);
          skippedReason = 'new-folder-exists';
        } catch {
          await fs.rename(oldPath, newPath);
          renamed = true;
        }
      } catch {
        await this.ensureFolder(newPath);
        skippedReason = 'old-folder-missing';
      }
    }

    if (clienteId) {
      const docs = await (dbOrTx || db).select().from(schema.documentos).where(eq(schema.documentos.clienteId, clienteId));
      for (const doc of docs) {
        if (doc.caminho && doc.caminho.includes(oldPath)) {
          const novoCaminho = doc.caminho.replace(oldPath, newPath);
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

  static async renameProjectFolder(clientName: string, oldProjectName: string, newProjectName: string, projetoId?: string, dbOrTx: any = db): Promise<{
    oldPath: string;
    newPath: string;
    renamed: boolean;
    skippedReason?: string;
  }> {
    const clientPath = await this.getClientFolder(clientName);
    const oldPath = path.join(clientPath, this.sanitizeFolderName(oldProjectName));
    const newPath = path.join(clientPath, this.sanitizeFolderName(newProjectName));

    let renamed = false;
    let skippedReason: string | undefined;

    if (path.resolve(oldPath).toLowerCase() === path.resolve(newPath).toLowerCase()) {
      await this.ensureFolder(newPath);
      skippedReason = 'same-path';
    } else {
      try {
        await fs.access(oldPath);
        try {
          await fs.access(newPath);
          skippedReason = 'new-folder-exists';
        } catch {
          await fs.rename(oldPath, newPath);
          renamed = true;
        }
      } catch {
        await this.ensureFolder(newPath);
        skippedReason = 'old-folder-missing';
      }
    }

    if (projetoId) {
      const docs = await (dbOrTx || db).select().from(schema.documentos).where(eq(schema.documentos.projetoId, projetoId));
      for (const doc of docs) {
        if (doc.caminho && doc.caminho.includes(oldPath)) {
          const novoCaminho = doc.caminho.replace(oldPath, newPath);
          const novoRelativo = doc.caminhoRelativo ? doc.caminhoRelativo.replace(oldProjectName, newProjectName) : null;
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
    // Escapa aspas para evitar injeção de comando
    const safePath = folderPath.replace(/"/g, '\\"');
    exec(`explorer "${safePath}"`, (error) => {
      if (error) {
        console.error(`Erro ao abrir a pasta: ${error}`);
      }
    });
  }
}
