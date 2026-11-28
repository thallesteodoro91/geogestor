import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { databaseClientConfig, ensureDatabaseProtectionSync } from './database-security';

// Inicialização segura do banco de dados (cria a pasta se não existir)
export function initDb(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  ensureDatabaseProtectionSync(dbPath);
  const client = createClient(databaseClientConfig(dbPath));

  // The local libSQL client lazily replaces its connection after transaction().
  // Connection-scoped PRAGMAs must therefore be reapplied before every use.
  const execute = client.execute.bind(client);
  const transaction = client.transaction.bind(client);
  const configureConnection = async () => {
    await execute('PRAGMA foreign_keys = ON;');
    await execute('PRAGMA busy_timeout = 5000;');
  };
  client.execute = async (statement) => {
    await configureConnection();
    return execute(statement);
  };
  client.transaction = async (mode?: 'write' | 'read' | 'deferred') => {
    await configureConnection();
    return transaction(mode);
  };

  const ready = Promise.all([
    execute('PRAGMA foreign_keys = ON;'),
    execute('PRAGMA busy_timeout = 5000;')
  ]).then(() => undefined);

  return {
    db: drizzle(client, { schema }),
    ready,
    close: () => client.close()
  };
}

export { schema };
export * from './database-security';
