import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export class BackupService {
  static getDatabasePath(): string {
    return process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../../data/geogestor.db');
  }

  static getDataDirectory(): string {
    return path.dirname(this.getDatabasePath());
  }

  static async createLocalBackup(): Promise<{ backupPath: string; copiedFiles: string[] }> {
    const databasePath = this.getDatabasePath();
    const dataDirectory = this.getDataDirectory();
    const backupDirectory = path.join(dataDirectory, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupBasePath = path.join(backupDirectory, `geogestor-backup-${timestamp}`);

    await fs.mkdir(backupDirectory, { recursive: true });

    const copiedFiles: string[] = [];
    const mainBackupPath = `${backupBasePath}.db`;

    // Snapshot atômico e consistente nativo do SQLite
    const safeBackupPath = mainBackupPath.replace(/\\/g, '/');
    await db.run(sql.raw(`VACUUM INTO '${safeBackupPath}'`));
    copiedFiles.push(mainBackupPath);

    return {
      backupPath: mainBackupPath,
      copiedFiles
    };
  }
}
