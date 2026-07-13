import { db } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Running manual DDL for compromissos table...');
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS \`compromissos\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`titulo\` text NOT NULL,
        \`descricao\` text,
        \`data\` text NOT NULL,
        \`tipo\` text DEFAULT 'Visita de Campo' NOT NULL,
        \`projeto_id\` text,
        \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (\`projeto_id\`) REFERENCES \`projetos\`(\`id\`) ON UPDATE no action ON DELETE no action
      );
    `);
    console.log('Table compromissos created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to run DDL:', err);
    process.exit(1);
  }
}

main();
