const STORAGE_PREFIX = 'geogestor:shared-data-notice:';

export const sharedDataNoticeStorageKey = (preferenceKey: string) => `${STORAGE_PREFIX}${preferenceKey}`;

export function readSharedDataNoticePreference(preferenceKey: string, storage: Pick<Storage, 'getItem'> | undefined = typeof window === 'undefined' ? undefined : window.localStorage) {
  if (!storage) return false;
  try {
    return storage.getItem(sharedDataNoticeStorageKey(preferenceKey)) === 'hidden';
  } catch {
    return false;
  }
}

export function writeSharedDataNoticePreference(preferenceKey: string, hidden: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = typeof window === 'undefined' ? undefined : window.localStorage) {
  if (!storage) return;
  try {
    if (hidden) storage.setItem(sharedDataNoticeStorageKey(preferenceKey), 'hidden');
    else storage.removeItem(sharedDataNoticeStorageKey(preferenceKey));
  } catch {
    // A orientação continua utilizável mesmo quando o armazenamento local está indisponível.
  }
}
