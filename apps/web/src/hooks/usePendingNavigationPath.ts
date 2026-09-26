import { useSyncExternalStore } from 'react';
import { getPendingNavigationPath, subscribeNavigationState } from '../utils/navigationMetrics';

const getServerSnapshot = () => null;

export function usePendingNavigationPath() {
  return useSyncExternalStore(
    subscribeNavigationState,
    getPendingNavigationPath,
    getServerSnapshot
  );
}
