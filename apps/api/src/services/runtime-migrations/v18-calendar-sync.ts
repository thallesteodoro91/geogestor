import type { Client } from '@libsql/client';

export const CALENDAR_SYNC_MIGRATION = { version: 18, name: 'calendar-sync-journal-2026-10-10' } as const;

export async function ensureCalendarSync(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS google_calendar_sync (
    compromisso_id TEXT PRIMARY KEY NOT NULL REFERENCES compromissos(id), state_json TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS google_calendar_sync_lease (
    id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_compromissos_google_event_id ON compromissos(google_event_id)');
}
