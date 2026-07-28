import { initDb } from '@geogestor/database';
import path from 'path';

const dbPath = process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../data/geogestor.db');
const database = initDb(dbPath);

export const db = database.db;
export const dbReady = database.ready;
export const closeDb = database.close;
