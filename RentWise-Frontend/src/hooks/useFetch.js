import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function useFetch(url) {
  const enabled = Boolean(url && !url.includes('/agr_'));
  const query = useQuery({
    queryKey: ['api', url], enabled,
    queryFn: async ({ signal }) => (await api.get(url, { signal })).data,
  });
  const { refetch: refresh } = query;
  const refetch = useCallback(() => enabled ? refresh() : Promise.resolve(), [enabled, refresh]);
  return {
    data: query.data ?? null,
    isLoading: enabled && query.isPending,
    error: query.error?.response?.data?.message || query.error?.message || null,
    refetch,
  };
}
