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

/**
 * The SQLite copy is authoritative. localStorage remains only as a local cache
 * for screens and PDF generators that need synchronous reads.
 */
export async function persistOperationalSetting(
  key: OperationalSettingKey,
  value: unknown,
  storageValue = JSON.stringify(value),
) {
  await apiClient.put('/api/dados-operacionais/configuracoes-operacionais/migrar', {
    values: { [key]: value },
  });
  localStorage.setItem(key, storageValue);
}
