import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import type { calendar_v3 } from 'googleapis';
import { db } from '../db';
import { buildGoogleCalendarEvent, googleEventStartToLocal } from './google-calendar-mapping';
import { nextEditTime, unchangedRow } from './edit-concurrency.service';

type Appointment = typeof schema.compromissos.$inferSelect;
type Event = calendar_v3.Schema$Event;
type Content = { titulo: string; descricao: string; data: string; hora: string | null };
type Pending = { action: 'insert' | 'patch' | 'delete'; id: string; etag?: string; operation: string; body?: Event; localHash: string };
export type CalendarSyncState = {
  calendarId: string; remoteId: string; generation: number; localHash: string;
  remoteHash: string; etag?: string; remoteDeleted: boolean;
  pending?: Pending; conflict?: { reason: string; remote: Event | null };
};
export interface CalendarTransport {
  get(id: string): Promise<Event | null>;
  list(pageToken?: string): Promise<{ items?: Event[] | null; nextPageToken?: string | null }>;
  insert(body: Event): Promise<Event>;
  patch(id: string, body: Event, etag: string): Promise<Event>;
  delete(id: string, etag: string): Promise<void>;
}

const hash = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const localContent = (row: Appointment): Content => ({ titulo: row.titulo, descricao: row.descricao || '', data: row.data, hora: row.hora || null });
const localHash = (row: Appointment) => hash({ ...localContent(row), deleted: Boolean(row.deletedAt) });
const remoteContent = (event: Event): Content | null => {
  const start = googleEventStartToLocal(event.start);
  return start ? { titulo: (event.summary || 'Sem Título (Google Agenda)').replace(/^\[GeoGestor\] /, ''), descricao: event.description || '', ...start } : null;
};
const remoteHash = (event: Event | null) => hash(event?.status === 'cancelled' || !event ? { deleted: true } : remoteContent(event));
const deleted = (event: Event | null) => !event || event.status === 'cancelled';
const remoteId = (id: string, generation: number) => hash(['geogestor', id, generation]);
const errorStatus = (error: unknown) => {
  if (!error || typeof error !== 'object') return NaN;
  const value = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  return Number(value.response?.status || value.code || value.status);
};

async function readState(id: string): Promise<CalendarSyncState | null> {
  const [row] = await db.select().from(schema.googleCalendarSync).where(eq(schema.googleCalendarSync.compromissoId, id));
  return row ? JSON.parse(row.stateJson) as CalendarSyncState : null;
}

async function saveState(id: string, state: CalendarSyncState, target: typeof db = db) {
  await target.insert(schema.googleCalendarSync).values({ compromissoId: id, stateJson: JSON.stringify(state) })
    .onConflictDoUpdate({ target: schema.googleCalendarSync.compromissoId, set: { stateJson: JSON.stringify(state) } });
}

export class CalendarSyncEngine {
  private leaseOwner?: string;
  constructor(private readonly transport: CalendarTransport, private readonly calendarId = 'primary') {}

  private async renewLease() {
    const renewed = await db.run(sql`UPDATE google_calendar_sync_lease SET expires_at=${Date.now() + 600_000} WHERE owner=${this.leaseOwner} AND expires_at > ${Date.now()}`);
    if (!renewed.rowsAffected) throw new Error('A reserva de sincronização expirou. Tente novamente.');
  }

  private async exclusive<T>(work: () => Promise<T>) {
    const owner = crypto.randomUUID();
    const acquired = await db.run(sql`INSERT INTO google_calendar_sync_lease(id, owner, expires_at) VALUES ('calendar', ${owner}, ${Date.now() + 600_000})
      ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, expires_at=excluded.expires_at WHERE expires_at < ${Date.now()}`);
    if (!acquired.rowsAffected) throw new Error('Já existe uma sincronização ou revisão em andamento. Aguarde antes de tentar novamente.');
    this.leaseOwner = owner;
    try { return await work(); }
    finally { await db.run(sql`DELETE FROM google_calendar_sync_lease WHERE owner=${owner}`); this.leaseOwner = undefined; }
  }

  private async conflict(row: Appointment, state: CalendarSyncState, reason: string, remote: Event | null) {
    state.conflict = { reason, remote };
    await saveState(row.id, state);
  }

  private async acknowledge(row: Appointment, state: CalendarSyncState, event: Event | null) {
    const pending = state.pending!;
    state.remoteId = pending.id;
    state.localHash = pending.localHash;
    // The operation marker proves acceptance, not that nobody edited it afterwards.
    state.remoteHash = remoteHash(pending.action === 'delete' ? null : pending.body!);
    state.remoteDeleted = pending.action === 'delete';
    state.etag = event?.etag || undefined;
    delete state.pending;
    delete state.conflict;
    await db.transaction(async (tx) => {
      // Metadata only: a simultaneous local edit remains dirty against pending.localHash.
      await tx.update(schema.compromissos).set({ googleEventId: state.remoteId, ultimoSyncGoogle: new Date().toISOString() })
        .where(eq(schema.compromissos.id, row.id));
      await saveState(row.id, state, tx as unknown as typeof db);
    });
  }

  private async executePending(row: Appointment, state: CalendarSyncState) {
    const pending = state.pending!;
    let current = await this.transport.get(pending.id);
    const marker = current?.extendedProperties?.private?.geogestorOperation;
    if (pending.action === 'delete' && deleted(current)) {
      await this.acknowledge(row, state, null);
      return;
    }
    if (pending.action !== 'delete' && marker === pending.operation) {
      await this.acknowledge(row, state, current);
      const [latest] = await db.select().from(schema.compromissos).where(eq(schema.compromissos.id, row.id));
      if (latest) await this.process(latest, state, new Map(current?.id ? [[current.id, current]] : []));
      return;
    }
    await this.renewLease();
    if (pending.action === 'insert') {
      if (current) return this.conflict(row, state, 'O identificador remoto reservado já existe ou foi excluído. Revise antes de tentar novamente.', current);
      try { current = await this.transport.insert({ ...pending.body, id: pending.id }); }
      catch (error) {
        if (errorStatus(error) !== 409) throw error;
        current = await this.transport.get(pending.id);
        if (current?.extendedProperties?.private?.geogestorOperation !== pending.operation) return this.conflict(row, state, 'Inserção remota conflitante.', current);
      }
    } else {
      if (deleted(current) || !current?.etag || current.etag !== pending.etag) return this.conflict(row, state, 'O evento remoto mudou durante a operação pendente.', current);
      try {
        if (pending.action === 'delete') { await this.transport.delete(pending.id, current.etag); current = null; }
        else current = await this.transport.patch(pending.id, pending.body!, current.etag);
      } catch (error) {
        if (pending.action === 'delete' && [404, 410].includes(errorStatus(error))) current = null;
        else if ([404, 410, 412].includes(errorStatus(error))) return this.conflict(row, state, 'O evento remoto mudou antes da gravação.', await this.transport.get(pending.id));
        else throw error;
      }
    }
    if (pending.action !== 'delete' && (!current?.id || !current.etag)) throw new Error('Resposta remota incompleta; a operação permanece pendente.');
    await this.acknowledge(row, state, current);
  }

  private async enqueue(row: Appointment, state: CalendarSyncState, action: Pending['action'], remote: Event | null) {
    const operation = crypto.randomUUID();
    let body: Event | undefined;
    if (action !== 'delete') {
      body = { ...buildGoogleCalendarEvent({ ...row, descricao: row.descricao || '' }), description: row.descricao || '',
        extendedProperties: { private: { ...remote?.extendedProperties?.private, geogestorId: row.id, geogestorOperation: operation } } };
      const represented = remote ? remoteContent(remote) : null;
      // Preserve original duration and remote-only fields on edits unrelated to time.
      if (remote && represented?.data === row.data && represented?.hora === row.hora) { body.start = remote.start; body.end = remote.end; }
    }
    state.pending = { action, id: state.remoteId, operation, body, etag: remote?.etag || undefined, localHash: localHash(row) };
    await saveState(row.id, state); // journal before network; never advances a failed operation's baseline
    await this.executePending(row, state);
  }

  private async receive(row: Appointment, state: CalendarSyncState, remote: Event | null) {
    const content = remote && !deleted(remote) ? remoteContent(remote) : null;
    if (!deleted(remote) && !content) return this.conflict(row, state, 'Evento remoto sem data representável.', remote);
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(schema.compromissos).set({
        ...(content || {}), deletedAt: deleted(remote) ? new Date().toISOString() : null,
        updatedAt: nextEditTime(row.updatedAt), ultimoSyncGoogle: new Date().toISOString()
      }).where(unchangedRow(schema.compromissos, row)).returning();
      if (!updated) throw new Error('O compromisso local mudou durante a sincronização. Tente novamente.');
      state.localHash = localHash(updated);
      state.remoteHash = remoteHash(remote);
      state.etag = remote?.etag || undefined;
      state.remoteDeleted = deleted(remote);
      delete state.conflict;
      await saveState(row.id, state, tx as unknown as typeof db);
    });
  }

  private async process(row: Appointment, state: CalendarSyncState | null, remoteEvents: Map<string, Event>) {
    if (state && state.calendarId !== this.calendarId) throw new Error('O calendário mudou. A associação anterior precisa de revisão explícita.');
    if (state?.conflict) {
      state.conflict.remote = await this.transport.get(state.remoteId);
      await saveState(row.id, state);
      return;
    }
    if (state?.pending) return this.executePending(row, state);
    if (!state) {
      if (!row.googleEventId && row.deletedAt) return;
      const id = row.googleEventId || remoteId(row.id, 0);
      const remote = row.googleEventId ? (remoteEvents.get(id) || await this.transport.get(id)) : null;
      state = { calendarId: this.calendarId, remoteId: id, generation: 0, localHash: '', remoteHash: '', remoteDeleted: false };
      if (!row.googleEventId) return this.enqueue(row, state, 'insert', null);
      if (deleted(remote) || hash(localContent(row)) !== hash(remoteContent(remote!))) return this.conflict(row, state, 'Associação legada sem base confirmada: compare as duas versões.', remote);
      state.localHash = localHash(row); state.remoteHash = remoteHash(remote); state.etag = remote?.etag || undefined;
      await saveState(row.id, state);
      return;
    }
    const remote = remoteEvents.get(state.remoteId) || await this.transport.get(state.remoteId);
    const localChanged = localHash(row) !== state.localHash;
    const remoteChanged = remoteHash(remote) !== state.remoteHash;
    if (localChanged && remoteChanged) {
      if (Boolean(row.deletedAt) === deleted(remote) && (row.deletedAt || hash(localContent(row)) === hash(remoteContent(remote!)))) {
        state.localHash = localHash(row); state.remoteHash = remoteHash(remote); state.etag = remote?.etag || undefined; state.remoteDeleted = deleted(remote);
        await saveState(row.id, state);
      } else await this.conflict(row, state, 'O compromisso mudou no aplicativo e no Google Agenda.', remote);
      return;
    }
    if (remoteChanged) return this.receive(row, state, remote);
    if (!localChanged) return;
    if (row.deletedAt) return this.enqueue(row, state, 'delete', remote);
    if (state.remoteDeleted) {
      state.generation += 1;
      state.remoteId = remoteId(row.id, state.generation);
      return this.enqueue(row, state, 'insert', null);
    }
    return this.enqueue(row, state, 'patch', remote);
  }

  async sync() { return this.exclusive(() => this.runSync()); }

  private async runSync() {
    let sent = 0; let received = 0; let failures = 0;
      const remoteEvents = new Map<string, Event>();
      let pageToken: string | undefined;
      do {
        await this.renewLease();
        const page = await this.transport.list(pageToken);
        for (const event of page.items || []) if (event.id) remoteEvents.set(event.id, event);
        pageToken = page.nextPageToken || undefined;
      } while (pageToken);
      const rows = await db.select().from(schema.compromissos);
      const linkCounts = new Map<string, number>();
      for (const row of rows) if (row.googleEventId) linkCounts.set(row.googleEventId, (linkCounts.get(row.googleEventId) || 0) + 1);
      const linked = new Set(rows.map((row) => row.googleEventId).filter(Boolean));
      for (const row of rows) {
        await this.renewLease();
        try {
          if (row.googleEventId && linkCounts.get(row.googleEventId)! > 1) throw new Error('Associação remota duplicada no banco legado. Revise os compromissos.');
          const before = await readState(row.id);
          await this.process(row, before, remoteEvents);
          const after = await readState(row.id);
          if (after && after.localHash !== before?.localHash) { if (localHash(row) === after.localHash) sent += 1; else received += 1; }
          if (after?.conflict) failures += 1;
          if (after?.remoteId) linked.add(after.remoteId);
        } catch { failures += 1; }
      }
      for (const event of remoteEvents.values()) {
        await this.renewLease();
        if (!event.id || linked.has(event.id) || deleted(event)) continue;
        // Reserved GeoGestor events must reconcile their durable journal, never import a duplicate.
        if (event.extendedProperties?.private?.geogestorId && rows.some((row) => row.id === event.extendedProperties?.private?.geogestorId)) continue;
        const content = remoteContent(event);
        if (!content) continue;
        await db.transaction(async (tx) => {
          const [exists] = await tx.select({ id: schema.compromissos.id }).from(schema.compromissos).where(eq(schema.compromissos.googleEventId, event.id!)).limit(1);
          if (exists) return;
          const [row] = await tx.insert(schema.compromissos).values({ id: crypto.randomUUID(), ...content, tipo: 'Outro', googleEventId: event.id, ultimoSyncGoogle: new Date().toISOString() }).returning();
          await saveState(row.id, { calendarId: this.calendarId, remoteId: event.id!, generation: 0, localHash: localHash(row), remoteHash: remoteHash(event), etag: event.etag || undefined, remoteDeleted: false }, tx as unknown as typeof db);
          received += 1;
        });
      }
      if (failures) throw new Error(`Sincronização parcial: ${failures} compromisso(s) precisam de nova tentativa ou revisão. Enviados=${sent}; recebidos=${received}.`);
      return { sent, received };
  }

  static async conflicts() {
    const rows = await db.select().from(schema.googleCalendarSync);
    const results = [];
    for (const row of rows) {
      const state = JSON.parse(row.stateJson) as CalendarSyncState;
      if (!state.conflict) continue;
      const [local] = await db.select().from(schema.compromissos).where(eq(schema.compromissos.id, row.compromissoId));
      if (local) results.push({ id: local.id, reviewToken: hash([localHash(local), state.conflict]), local: { ...localContent(local), deleted: Boolean(local.deletedAt) }, remote: state.conflict.remote ? { ...remoteContent(state.conflict.remote), deleted: deleted(state.conflict.remote) } : { deleted: true }, reason: state.conflict.reason });
    }
    return results;
  }

  async resolve(id: string, choice: 'local' | 'remote', reviewToken: string) {
    return this.exclusive(() => this.resolveUnderLease(id, choice, reviewToken));
  }

  private async resolveUnderLease(id: string, choice: 'local' | 'remote', reviewToken: string) {
    const [row] = await db.select().from(schema.compromissos).where(eq(schema.compromissos.id, id));
    const state = await readState(id);
    if (!row || !state?.conflict) throw new Error('Conflito não encontrado. Atualize a lista.');
    if (reviewToken !== hash([localHash(row), state.conflict])) throw new Error('As versões em revisão mudaram. Consulte novamente antes de decidir.');
    const remote = await this.transport.get(state.remoteId);
    await this.renewLease();
    const [latest] = await db.select().from(schema.compromissos).where(eq(schema.compromissos.id, id));
    if (!latest || localHash(latest) !== localHash(row)) throw new Error('O compromisso local mudou durante a revisão. Consulte novamente.');
    if (remoteHash(remote) !== remoteHash(state.conflict.remote)) {
      state.conflict.remote = remote;
      await saveState(id, state);
      throw new Error('O evento remoto mudou novamente. Consulte as novas versões.');
    }
    delete state.pending;
    if (choice === 'remote') return this.receive(row, state, remote);
    state.remoteHash = remoteHash(remote); state.etag = remote?.etag || undefined; state.remoteDeleted = deleted(remote);
    // Rebase only after explicit review. A different remote version still conflicts on If-Match.
    state.localHash = ''; delete state.conflict;
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(schema.compromissos).where(eq(schema.compromissos.id, id));
      if (!current || localHash(current) !== localHash(row)) throw new Error('O compromisso local mudou durante a revisão. Consulte novamente.');
      await saveState(id, state, tx as unknown as typeof db);
    });
  }
}
