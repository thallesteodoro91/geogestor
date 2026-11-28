import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import type { calendar_v3 } from 'googleapis';
import type { CalendarTransport } from './services/calendar-sync-engine';

const root = path.resolve('scratch', `calendar-sync-${process.pid}-${crypto.randomUUID()}`);
process.env.GEOGESTOR_DB_PATH = path.join(root, 'qa.db');
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';
type Event = calendar_v3.Schema$Event;

class FakeCalendar implements CalendarTransport {
  events = new Map<string, Event>();
  writes = 0;
  loseResponse = false;
  failBefore = false;
  racePatch = false;
  afterInsert?: () => Promise<unknown>;
  async get(id: string) { return structuredClone(this.events.get(id) || null); }
  async list(pageToken?: string) {
    const values = [...this.events.values()];
    const offset = Number(pageToken || 0);
    return { items: structuredClone(values.slice(offset, offset + 2)), nextPageToken: offset + 2 < values.length ? String(offset + 2) : null };
  }
  async insert(body: Event) {
    if (this.failBefore) { this.failBefore = false; throw new Error('offline'); }
    if (this.events.has(body.id!)) throw { code: 409 };
    const event = { ...structuredClone(body), etag: `"${++this.writes}"`, status: 'confirmed' };
    this.events.set(body.id!, event);
    if (this.afterInsert) { const action = this.afterInsert; this.afterInsert = undefined; await action(); }
    if (this.loseResponse) { this.loseResponse = false; throw new Error('resposta perdida após inserir'); }
    return structuredClone(event);
  }
  async patch(id: string, body: Event, etag: string) {
    if (this.racePatch) { this.racePatch = false; this.edit(id, 'Edição remota durante patch'); }
    const before = this.events.get(id)!;
    if (before.etag !== etag) throw { code: 412 };
    const event = { ...before, ...structuredClone(body), etag: `"${++this.writes}"` };
    this.events.set(id, event);
    if (this.loseResponse) { this.loseResponse = false; throw new Error('resposta perdida após atualizar'); }
    return structuredClone(event);
  }
  async delete(id: string, etag: string) {
    const before = this.events.get(id);
    if (!before || before.status === 'cancelled') throw { code: 410 };
    if (before.etag !== etag) throw { code: 412 };
    this.events.set(id, { id, status: 'cancelled', etag: `"${++this.writes}"` });
    if (this.loseResponse) { this.loseResponse = false; throw new Error('resposta perdida após excluir'); }
  }
  edit(id: string, summary: string) {
    this.events.set(id, { ...this.events.get(id), summary, etag: `"${++this.writes}"` });
  }
}

test('matriz de sincronização durável com transporte Google simulado', async (t) => {
  await fs.mkdir(root, { recursive: true });
  const [{ CalendarSyncEngine }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }, { server }] = await Promise.all([
    import('./services/calendar-sync-engine'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database'), import('./server')
  ]);
  const fake = new FakeCalendar();
  const engine = () => new CalendarSyncEngine(fake, 'qa-exclusive');
  const create = async (titulo: string) => {
    const [row] = await db.insert(schema.compromissos).values({ id: crypto.randomUUID(), titulo, descricao: '', data: '2026-10-10', hora: null }).returning();
    return row.id;
  };
  const read = async (id: string) => (await db.select().from(schema.compromissos).where(eq(schema.compromissos.id, id)))[0];
  const change = async (id: string, titulo: string) => db.update(schema.compromissos).set({ titulo, updatedAt: new Date().toISOString() }).where(eq(schema.compromissos.id, id));
  const resolve = async (id: string, choice: 'local' | 'remote') => {
    const conflict = (await CalendarSyncEngine.conflicts()).find((item) => item.id === id)!;
    await engine().resolve(id, choice, conflict.reviewToken);
  };
  try {
    await dbReady; await runRuntimeMigrations();
    const id = await create('Original');
    await t.test('criação, repetição e resposta perdida não duplicam; serviço novo retoma', async () => {
      fake.loseResponse = true;
      await assert.rejects(engine().sync(), /parcial/);
      assert.equal(fake.events.size, 1);
      await engine().sync();
      assert.equal(fake.events.size, 1);
      const writes = fake.writes;
      await engine().sync();
      assert.equal(fake.writes, writes);
      assert.ok((await read(id)).googleEventId);
    });
    await t.test('edição local, remoto-only, patch perdido e ausência de ciclo', async () => {
      await change(id, 'Local');
      fake.loseResponse = true;
      await assert.rejects(engine().sync(), /parcial/);
      await engine().sync();
      const remoteId = (await read(id)).googleEventId!;
      assert.equal(fake.events.get(remoteId)?.summary, '[GeoGestor] Local');
      fake.edit(remoteId, 'Remoto');
      await engine().sync();
      assert.equal((await read(id)).titulo, 'Remoto');
      const writes = fake.writes;
      await engine().sync(); await engine().sync();
      assert.equal(fake.writes, writes);
    });
    await t.test('conflito preserva ambas as versões; resolução explícita e 412', async () => {
      const remoteId = (await read(id)).googleEventId!;
      await change(id, 'Rascunho local'); fake.edit(remoteId, 'Versão remota');
      await assert.rejects(engine().sync(), /parcial/);
      assert.equal((await read(id)).titulo, 'Rascunho local');
      assert.equal(fake.events.get(remoteId)?.summary, 'Versão remota');
      await resolve(id, 'remote');
      assert.equal((await read(id)).titulo, 'Versão remota');
      await change(id, 'Outro rascunho'); fake.racePatch = true;
      await assert.rejects(engine().sync(), /parcial/);
      assert.equal((await read(id)).titulo, 'Outro rascunho');
      await resolve(id, 'local'); await engine().sync();
      assert.equal(fake.events.get(remoteId)?.summary, '[GeoGestor] Outro rascunho');
    });
    await t.test('exclusão remota não recria; undo preserva identidade lógica e troca associação', async () => {
      const before = await read(id);
      await fake.delete(before.googleEventId!, fake.events.get(before.googleEventId!)!.etag!);
      await engine().sync(); await engine().sync();
      assert.ok((await read(id)).deletedAt);
      assert.equal(fake.events.size, 1);
      const restored = await server.inject({ method: 'POST', url: `/api/compromissos/${id}/restaurar`, headers: { 'x-api-token': 'test-token' } });
      assert.equal(restored.statusCode, 200, restored.body);
      assert.equal(restored.json<{ id: string }>().id, id);
      fake.loseResponse = true;
      await assert.rejects(engine().sync(), /parcial/);
      await engine().sync();
      const after = await read(id);
      assert.notEqual(after.googleEventId, before.googleEventId);
      assert.equal(fake.events.size, 2);
      assert.equal([...fake.events.values()].filter((item) => item.status !== 'cancelled').length, 1);
    });
    await t.test('delete local perdido e undo anterior à sincronização', async () => {
      const tombstone = new Date().toISOString();
      await db.update(schema.compromissos).set({ deletedAt: tombstone }).where(eq(schema.compromissos.id, id));
      await db.update(schema.compromissos).set({ deletedAt: null }).where(eq(schema.compromissos.id, id));
      const writes = fake.writes;
      await engine().sync(); assert.equal(fake.writes, writes);
      await db.update(schema.compromissos).set({ deletedAt: tombstone }).where(eq(schema.compromissos.id, id));
      fake.loseResponse = true;
      await assert.rejects(engine().sync(), /parcial/);
      await engine().sync(); await engine().sync();
      assert.equal([...fake.events.values()].filter((item) => item.status !== 'cancelled').length, 0);
    });
    await t.test('falha parcial preserva pendência e importação paginada é idempotente', async () => {
      const other = await create('Após falha'); fake.failBefore = true;
      await assert.rejects(engine().sync(), /parcial/);
      await engine().sync(); assert.ok((await read(other)).googleEventId);
      for (let i = 0; i < 3; i += 1) fake.events.set(`external-${i}`, { id: `external-${i}`, summary: `Externo ${i}`, start: { date: '2026-10-10' }, end: { date: '2026-10-11' }, etag: `"external-${i}"` });
      await engine().sync(); await engine().sync();
      const rows = await db.select().from(schema.compromissos);
      assert.equal(rows.filter((row) => row.googleEventId?.startsWith('external-')).length, 3);
    });
    await t.test('edição remota após resposta perdida é recebida sem mascarar o novo conteúdo', async () => {
      const localId = await create('Antes da resposta perdida'); fake.loseResponse = true;
      await assert.rejects(engine().sync(), /parcial/);
      const accepted = [...fake.events.values()].find(event => event.extendedProperties?.private?.geogestorId === localId)!;
      fake.edit(accepted.id!, 'Mudou no Google após a aceitação');
      await engine().sync();
      assert.equal((await read(localId)).titulo, 'Mudou no Google após a aceitação');
    });
    await t.test('rascunho local alterado durante envio continua pendente para próximo ciclo', async () => {
      const localId = await create('Conteúdo enviado'); fake.afterInsert = () => change(localId, 'Editei enquanto aguardava');
      await engine().sync(); assert.equal((await read(localId)).titulo, 'Editei enquanto aguardava');
      await engine().sync();
      assert.equal(fake.events.get((await read(localId)).googleEventId!)?.summary, '[GeoGestor] Editei enquanto aguardava');
    });
    await t.test('exclusão versus edição e associação legada exigem revisão', async () => {
      const localId = await create('QA legado');
      fake.events.set('legacy-qa', { id: 'legacy-qa', summary: 'Versão legada remota', start: { date: '2026-10-10' }, etag: '"legacy"' });
      await db.update(schema.compromissos).set({ googleEventId: 'legacy-qa' }).where(eq(schema.compromissos.id, localId));
      await assert.rejects(engine().sync(), /parcial/);
      await resolve(localId, 'remote');
      await db.update(schema.compromissos).set({ deletedAt: new Date().toISOString() }).where(eq(schema.compromissos.id, localId));
      fake.edit('legacy-qa', 'Remoto alterado enquanto excluí localmente');
      await assert.rejects(engine().sync(), /parcial/);
      assert.notEqual(fake.events.get('legacy-qa')?.status, 'cancelled');
      await resolve(localId, 'remote'); assert.equal((await read(localId)).deletedAt, null);
    });
    await t.test('lease SQLite impede sincronizações simultâneas entre serviços', async () => {
      let release!: () => void; let reached!: () => void;
      const paused = new Promise<void>(resolve => { release = resolve; });
      const started = new Promise<void>(resolve => { reached = resolve; });
      const originalList = fake.list.bind(fake);
      fake.list = async token => { reached(); await paused; return originalList(token); };
      const running = engine().sync(); await started;
      await assert.rejects(engine().sync(), /andamento/);
      release(); await running; fake.list = originalList;
    });
  } finally { await server.close(); closeDb(); }
});
