type CacheEntry = { expiresAt: number; value?: unknown; promise?: Promise<unknown> };

const CACHE_TTL_MS = 500;
const overviewCache = new Map<string, CacheEntry>();

export async function cachedFinanceOverview<T>(key: string, load: () => Promise<T>): Promise<T> {
  const current = overviewCache.get(key);
  if (current?.value !== undefined && current.expiresAt > Date.now()) return current.value as T;
  if (current?.promise) return current.promise as Promise<T>;

  const promise = load();
  overviewCache.set(key, { expiresAt: 0, promise });
  try {
    const value = await promise;
    overviewCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    overviewCache.delete(key);
    throw error;
  }
}

export function invalidateFinanceOverviewCache() {
  overviewCache.clear();
}

export function resetFinanceOverviewCacheForTests() {
  if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
    throw new Error('O cache financeiro só pode ser reiniciado em ambiente de teste.');
  }
  overviewCache.clear();
}
