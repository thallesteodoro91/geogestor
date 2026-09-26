import { getOperationalSettings, persistOperationalSetting } from './operationalSettings';

export interface ImportSchema {
  id: string;
  name: string;
  entity: string;
  mapping: Record<string, string>;
  date: string;
}

function isImportSchema(value: unknown): value is ImportSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.entity === 'string'
    && typeof candidate.date === 'string'
    && Boolean(candidate.mapping)
    && typeof candidate.mapping === 'object'
    && !Array.isArray(candidate.mapping)
    && Object.values(candidate.mapping as Record<string, unknown>).every(item => typeof item === 'string');
}

export function parseImportSchemas(raw: string | null): ImportSchema[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isImportSchema) : [];
  } catch {
    return [];
  }
}

export function readCachedImportSchemas() {
  return parseImportSchemas(localStorage.getItem('import_schemas'));
}

export function parseStoredImportSchemas(value: unknown): ImportSchema[] {
  if (typeof value === 'string') return parseImportSchemas(value);
  return parseImportSchemas(JSON.stringify(value ?? null));
}

export async function fetchStoredImportSchemas() {
  const settings = await getOperationalSettings();
  return parseStoredImportSchemas(settings.import_schemas);
}

export async function saveImportSchema(schema: ImportSchema) {
  const existing = await fetchStoredImportSchemas();
  await persistOperationalSetting('import_schemas', [...existing, schema]);
}
