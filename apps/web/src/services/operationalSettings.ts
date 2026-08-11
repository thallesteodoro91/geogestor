import { apiClient } from './apiClient';

export const OPERATIONAL_SETTING_KEYS = [
  'geogestor_tipos_servico',
  'geogestor_tipos_despesa',
  'geogestor_jornada_categorias',
  'geogestor_empresa_template',
  'import_schemas',
  'geogestor_alerta_dias',
] as const;

export type OperationalSettingKey = typeof OPERATIONAL_SETTING_KEYS[number];

function persistCache(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The SQLite copy is authoritative. localStorage remains only as a local cache
 * for screens and PDF generators that need synchronous reads.
 */
export async function persistOperationalSetting(
  key: OperationalSettingKey,
  value: unknown,
  storageValue = JSON.stringify(value),
) {
  await apiClient.put('/api/dados-operacionais/configuracoes-operacionais', {
    values: { [key]: value },
  });
  return { cachePersisted: persistCache(key, storageValue) };
}

export async function persistOperationalSettings(values: Partial<Record<OperationalSettingKey, unknown>>) {
  await apiClient.put('/api/dados-operacionais/configuracoes-operacionais', { values });
  const cacheFailures: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!persistCache(key, JSON.stringify(value))) cacheFailures.push(key);
  }
  return { cacheFailures };
}

export function getOperationalSettings() {
  return apiClient.get<Record<string, unknown>>('/api/dados-operacionais/configuracoes-operacionais');
}

export async function hydrateOperationalSettingsCache() {
  const values = await getOperationalSettings();
  const cacheFailures: string[] = [];
  for (const key of OPERATIONAL_SETTING_KEYS) {
    if (!(key in values)) continue;
    if (!persistCache(key, JSON.stringify(values[key]))) cacheFailures.push(key);
  }
  return { values, cacheFailures };
}
