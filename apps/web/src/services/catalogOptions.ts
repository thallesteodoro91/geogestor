import { normalizeCatalogLabel } from '@geogestor/contracts/src/auxiliary-catalogs';

export function mergeCatalogAndHistoricalValues(
  catalogValues: Array<string | null | undefined>,
  historicalValues: Array<string | null | undefined>
) {
  const valuesByNormalizedLabel = new Map<string, string>();

  for (const value of [...catalogValues, ...historicalValues]) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const normalized = normalizeCatalogLabel(trimmed);
    if (!valuesByNormalizedLabel.has(normalized)) valuesByNormalizedLabel.set(normalized, trimmed);
  }

  return [...valuesByNormalizedLabel.values()]
    .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
}
