import { createClient } from '@libsql/client';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../../data/geogestor.db');
console.log(`Iniciando migração no banco de dados: ${dbPath}`);

const client = createClient({
  url: `file:${dbPath}`
});

const columnsToCreate = [
  // Clientes
  { table: 'clientes', column: 'celular', type: 'TEXT' },
  { table: 'clientes', column: 'cpf', type: 'TEXT' },
  { table: 'clientes', column: 'cnpj', type: 'TEXT' },
  { table: 'clientes', column: 'numero', type: 'TEXT' },
  { table: 'clientes', column: 'bairro', type: 'TEXT' },
  { table: 'clientes', column: 'origem', type: 'TEXT' },
  { table: 'clientes', column: 'categoria', type: 'TEXT' },
  { table: 'clientes', column: 'anotacoes', type: 'TEXT' },
  { table: 'clientes', column: 'situacao', type: 'TEXT' },

  // Projetos
  { table: 'projetos', column: 'area_ha', type: 'REAL' },
  { table: 'projetos', column: 'matricula', type: 'TEXT' },
  { table: 'projetos', column: 'car', type: 'TEXT' },
  { table: 'projetos', column: 'ccir', type: 'TEXT' },
  { table: 'projetos', column: 'itr', type: 'TEXT' },
  { table: 'projetos', column: 'cidade', type: 'TEXT' },
  { table: 'projetos', column: 'municipio', type: 'TEXT' },
  { table: 'projetos', column: 'situacao_imovel', type: 'TEXT' },
  { table: 'projetos', column: 'tipo', type: 'TEXT' },
  { table: 'projetos', column: 'averbacao', type: 'TEXT' },
  { table: 'projetos', column: 'latitude', type: 'REAL' },
  { table: 'projetos', column: 'longitude', type: 'REAL' },
  { table: 'projetos', column: 'possui_memorial_descritivo', type: 'TEXT' },
  { table: 'projetos', column: 'observacoes', type: 'TEXT' },

  // Orcamentos
  { table: 'orcamentos', column: 'anotacoes', type: 'TEXT' },
  { table: 'orcamentos', column: 'forma_de_pagamento', type: 'TEXT' },
  { table: 'orcamentos', column: 'desconto', type: 'INTEGER' },
  { table: 'orcamentos', column: 'codigo_orcamento', type: 'TEXT' },
  { table: 'orcamentos', column: 'projeto_id', type: 'TEXT' },

  // Tarefas
  { table: 'tarefas', column: 'cliente_id', type: 'TEXT' },
  { table: 'tarefas', column: 'categoria', type: 'TEXT' },
  { table: 'tarefas', column: 'contexto_tipo', type: 'TEXT' },

  // Compromissos
  { table: 'compromissos', column: 'cliente_id', type: 'TEXT' },

  // Historico do cliente
  { table: 'interacoes_cliente', column: 'projeto_id', type: 'TEXT' },
  { table: 'interacoes_cliente', column: 'orcamento_id', type: 'TEXT' },
  { table: 'interacoes_cliente', column: 'titulo', type: 'TEXT' },
  { table: 'interacoes_cliente', column: 'categoria', type: 'TEXT' },
  { table: 'interacoes_cliente', column: 'manual', type: 'INTEGER' },

  // Despesas
  { table: 'despesas', column: 'observacoes', type: 'TEXT' },
  { table: 'despesas', column: 'status', type: 'TEXT' },
  { table: 'despesas', column: 'forma_pagamento', type: 'TEXT' }
];

async function run() {
  try {
    for (const item of columnsToCreate) {
      const sql = `ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.type}`;
      try {
        console.log(`Adicionando coluna: ${item.table}.${item.column} (${item.type})...`);
        await client.execute(sql);
        console.log(`[SUCESSO] Coluna ${item.table}.${item.column} criada.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message && (message.includes('duplicate column') || message.includes('already exists'))) {
          console.log(`[INFO] Coluna ${item.table}.${item.column} já existe. Ignorando.`);
        } else {
          console.error(`[ERRO] Falha ao adicionar coluna ${item.table}.${item.column}:`, message);
        }
      }
    }
    console.log('Migração concluída com sucesso!');
  } catch (err) {
    console.error('Falha geral na migração:', err);
  } finally {
    client.close();
  }
}

run();
