import { createClient } from '@libsql/client';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../../data/geogestor.db');
console.log(`Iniciando criação da tabela oportunidades no banco de dados: ${dbPath}`);

const client = createClient({
  url: `file:${dbPath}`
});

async function run() {
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS oportunidades (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        titulo TEXT NOT NULL,
        valor_estimado INTEGER,
        estagio TEXT DEFAULT 'Prospect' NOT NULL,
        ordem INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
      )
    `;
    console.log('Criando tabela oportunidades...');
    await client.execute(createTableSql);
    console.log('[SUCESSO] Tabela oportunidades criada ou já existente.');
  } catch (err) {
    console.error('Falha geral na migração:', err);
  } finally {
    client.close();
  }
}

run();
