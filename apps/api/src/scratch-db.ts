import { db } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Running manual DDL for tarefas table...');
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS \`tarefas\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`projeto_id\` text NOT NULL,
        \`titulo\` text NOT NULL,
        \`descricao\` text,
        \`status\` text DEFAULT 'A Fazer' NOT NULL,
        \`prioridade\` text DEFAULT 'Média' NOT NULL,
        \`data_limite\` text,
        \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (\`projeto_id\`) REFERENCES \`projetos\`(\`id\`) ON UPDATE no action ON DELETE no action
      );
    `);
    console.log('Table tarefas created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to run DDL:', err);
    process.exit(1);
  }
}

main();
