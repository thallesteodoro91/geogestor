const { createClient } = require('@libsql/client');

async function main() {
  const client = createClient({
    url: 'file:./data/geogestor.db',
  });

  const tables = [
    'clientes', 'projetos', 'tarefas', 'arquivos', 
    'notificacoes', 'historico', 'oportunidades', 
    'licencas', 'notas', 'contatos', 'configuracoes'
  ];

  for (const table of tables) {
    try {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN deleted_at text`);
      console.log(`Added deleted_at to ${table}`);
    } catch (e) {
      if (e.message.includes('duplicate column name')) {
        console.log(`${table} already has deleted_at`);
      } else {
        console.error(`Error on ${table}:`, e.message);
      }
    }
  }
}

main().catch(console.error);
