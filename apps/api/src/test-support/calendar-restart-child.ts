import fs from 'node:fs/promises';
import path from 'node:path';
import type { CalendarTransport } from '../services/calendar-sync-engine';
import type { calendar_v3 } from 'googleapis';
const [mode, directory, id] = process.argv.slice(2);
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = path.join(directory, 'qa.db');
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';
async function main() {
  const { db, dbReady, closeDb } = await import('../db'); await dbReady;
  const { runRuntimeMigrations } = await import('../services/runtime-migrations.service'); await runRuntimeMigrations();
  const { CalendarSyncEngine } = await import('../services/calendar-sync-engine');
  const { schema } = await import('@geogestor/database');
  type Event = calendar_v3.Schema$Event;
  const events: Event[] = await fs.readFile(path.join(directory, 'remote.json'), 'utf8').then(JSON.parse).catch(() => []);
  const transport: CalendarTransport = {
    get: async remoteId => events.find(event => event.id === remoteId) || null,
    list: async () => ({ items: events }),
    insert: async event => {
      const accepted = { ...event, etag: '"qa-1"', status: 'confirmed' }; events.push(accepted);
      await fs.writeFile(path.join(directory, 'remote.json'), JSON.stringify(events));
      if (mode === 'interrupt') {
        process.send?.({ stage: 'remote-accepted' });
        setInterval(() => undefined, 1000);
        await new Promise<void>(() => {});
      }
      return accepted;
    },
    patch: async () => { throw new Error('Atualização inesperada no teste de retomada.'); },
    delete: async () => { throw new Error('Exclusão inesperada no teste de retomada.'); }
  };
  if (mode === 'interrupt') await db.insert(schema.compromissos).values({ id, titulo: 'QA retomada real', data: '2026-10-10', descricao: '' });
  await new CalendarSyncEngine(transport, 'qa-exclusive').sync();
  const rows = await db.select().from(schema.compromissos);
  await fs.writeFile(path.join(directory, 'recovered.json'), JSON.stringify({ localCount: rows.length, remoteCount: events.length, remoteId: rows[0].googleEventId, acceptedId: events[0].id }));
  closeDb();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
