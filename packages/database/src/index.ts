import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Inicialização segura do banco de dados (cria a pasta se não existir)
export function initDb(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const client = createClient({
    url: `file:${dbPath}`
  });

  const ready = Promise.all([
    client.execute('PRAGMA foreign_keys = ON;'),
    client.execute('PRAGMA busy_timeout = 5000;')
  ]).then(() => undefined);

  return {
    db: drizzle(client, { schema }),
    ready,
    close: () => client.close()
  };
}

export { schema };
