import { cloneDatabaseWithKeysSync, inspectProtectedDatabaseSync } from '@geogestor/database';
import { createClient } from '@libsql/client';
import { databaseClientConfig } from '@geogestor/database';

const [operation, sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath) {
  throw new Error('A origem da operação protegida é obrigatória.');
}

async function run() {
  if (operation === 'validate') {
    const sourceKey = process.env.GEOGESTOR_DB_SOURCE_KEY;
    if (sourceKey) {
      process.stdout.write(JSON.stringify(inspectProtectedDatabaseSync(sourcePath, sourceKey)));
    } else {
      const client = createClient(databaseClientConfig(sourcePath));
      try {
        const quickCheck = await client.execute('PRAGMA quick_check;');
        const foreignKeys = await client.execute('PRAGMA foreign_key_check;');
        const userVersion = await client.execute('PRAGMA user_version;');
        const quickCheckValue = quickCheck.rows[0] ? Object.values(quickCheck.rows[0])[0] : undefined;
        if (String(quickCheckValue) !== 'ok') throw new Error('O banco falhou no quick_check.');
        if (foreignKeys.rows.length > 0) throw new Error('O banco contém vínculos inválidos.');
        process.stdout.write(JSON.stringify({ encrypted: false, keyId: null, schemaVersion: Number(userVersion.rows[0]?.user_version ?? 0) }));
      } finally {
        await client.close();
      }
    }
  } else if (operation === 'clone' && targetPath) {
    cloneDatabaseWithKeysSync(
      sourcePath,
      process.env.GEOGESTOR_DB_SOURCE_KEY,
      targetPath,
      process.env.GEOGESTOR_DB_TARGET_KEY
    );
  } else if (operation === 'count-sensitive-credentials' || operation === 'scrub-sensitive-credentials') {
    const sourceKey = process.env.GEOGESTOR_DB_SOURCE_KEY;
    const client = createClient(databaseClientConfig(sourcePath, sourceKey));
    try {
      if (operation === 'scrub-sensitive-credentials') {
        await client.execute(`
          UPDATE configuracoes
          SET google_client_secret = NULL,
              google_refresh_token = NULL,
              google_access_token = NULL,
              google_sync_active = 0
        `);
        await client.execute('VACUUM;');
      }
      const result = await client.execute(`
        SELECT COUNT(*) AS total
        FROM configuracoes
        WHERE google_client_secret IS NOT NULL
           OR google_refresh_token IS NOT NULL
           OR google_access_token IS NOT NULL
      `);
      process.stdout.write(JSON.stringify({ total: Number(result.rows[0]?.total || 0) }));
    } finally {
      await client.close();
    }
  } else {
    throw new Error('Operação protegida desconhecida.');
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
