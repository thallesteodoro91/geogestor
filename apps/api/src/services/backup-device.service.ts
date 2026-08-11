import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type BackupDeviceIdentity = {
  id: string;
  name: string;
};

function dataDirectory() {
  const databasePath = process.env.GEOGESTOR_DB_PATH
    ? path.resolve(process.env.GEOGESTOR_DB_PATH)
    : path.resolve(__dirname, '../../../../data/geogestor.db');
  return path.dirname(databasePath);
}

export class BackupDeviceService {
  private static cachedIdentity: BackupDeviceIdentity | null = null;

  static async getIdentity(): Promise<BackupDeviceIdentity> {
    if (this.cachedIdentity) return { ...this.cachedIdentity };
    const target = path.join(dataDirectory(), 'backup-device.json');
    try {
      const parsed = JSON.parse(await fs.readFile(target, 'utf8')) as Partial<BackupDeviceIdentity>;
      if (typeof parsed.id === 'string' && parsed.id.length >= 16 && typeof parsed.name === 'string' && parsed.name.trim()) {
        this.cachedIdentity = { id: parsed.id, name: parsed.name.trim().slice(0, 120) };
        return { ...this.cachedIdentity };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    const identity: BackupDeviceIdentity = {
      id: crypto.randomUUID(),
      name: os.hostname().trim().slice(0, 120) || 'Dispositivo GeoGestor'
    };
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${crypto.randomUUID()}.pending`;
    await fs.writeFile(temporary, `${JSON.stringify(identity, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    try {
      await fs.rename(temporary, target);
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      return this.getIdentity();
    }
    this.cachedIdentity = identity;
    return { ...identity };
  }

  static resetForTests() {
    this.cachedIdentity = null;
  }
}
