import { createClient } from '@libsql/client';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../../data/geogestor.db');
console.log(`Iniciando criação da tabela interacoes_cliente no banco: ${dbPath}`);

const client = createClient({
  url: `file:${dbPath}`
});

async function run() {
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS interacoes_cliente (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        data TEXT NOT NULL,
        descricao TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
      )
    `;
    console.log('Criando tabela...');
    await client.execute(createTableSql);
    console.log('[SUCESSO] Tabela interacoes_cliente criada.');
  } catch (err) {
    console.error('Falha:', err);
  } finally {
    client.close();
  }
}

run();
