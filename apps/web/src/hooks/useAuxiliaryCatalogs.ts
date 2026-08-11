import { useQuery } from '@tanstack/react-query';
import { loadAuxiliaryCatalogs } from '../services/auxiliaryCatalogs';

export const auxiliaryCatalogQueryKey = ['auxiliary-catalogs'] as const;

export function useAuxiliaryCatalogs() {
  return useQuery({
    queryKey: auxiliaryCatalogQueryKey,
    queryFn: loadAuxiliaryCatalogs,
    staleTime: 60_000
  });
}
