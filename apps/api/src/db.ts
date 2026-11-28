import { initDb } from '@geogestor/database';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';

export const dbPath = process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../data/geogestor.db');
const database = initDb(dbPath);

export const databaseContext = new AsyncLocalStorage<typeof database.db>();
let transactionTail: Promise<void> = Promise.resolve();
// All services imported by a protected route share its write transaction.
export const db = new Proxy(database.db, {
  get(target, key) {
    const current = databaseContext.getStore() || target;
    if (key === 'transaction') return async (operation: (tx: typeof database.db) => unknown) => {
      if (databaseContext.getStore()) return current.transaction(async tx => databaseContext.run(tx as unknown as typeof database.db, () => operation(tx as unknown as typeof database.db)));
      // Native BEGIN IMMEDIATE is synchronous. Queue writers in this process so
      // a second request cannot block the event loop needed by the first COMMIT.
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      try { return await target.transaction(async tx => databaseContext.run(tx as unknown as typeof database.db, () => operation(tx as unknown as typeof database.db))); }
      finally { release(); }
    };
    const value = Reflect.get(current, key);
    return typeof value === 'function' ? value.bind(current) : value;
  }
});
export const dbReady = database.ready;
export const closeDb = database.close;
