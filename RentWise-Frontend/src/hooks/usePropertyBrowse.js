import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../services/api';

export function usePropertyBrowse(filters) {
  const filterKey = JSON.stringify(filters);
  const [debouncedKey, setDebouncedKey] = useState(filterKey);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(filterKey), 300);
    return () => clearTimeout(timer);
  }, [filterKey]);
  const waitingForFilters = filterKey !== debouncedKey;
  const query = useInfiniteQuery({
    queryKey: ['api', 'property-browse', debouncedKey],
    enabled: !waitingForFilters,
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => (await api.get('/properties/browse', {
      params: { ...JSON.parse(debouncedKey), pageSize: 12, cursor: pageParam || undefined }, signal,
    })).data,
    getNextPageParam: page => page.hasMore ? page.nextCursor || undefined : undefined,
  });
  const items = useMemo(() => {
    if (waitingForFilters) return [];
    const unique = new Map();
    for (const page of query.data?.pages || []) {
      for (const property of page.items) unique.set(property.id, property);
    }
    return [...unique.values()];
  }, [query.data, waitingForFilters]);
  const loadMore = () => {
    if (waitingForFilters || query.isFetching) return;
    if (query.hasNextPage) void query.fetchNextPage({ cancelRefetch: false });
    else if (query.isError) void query.refetch();
  };
  return {
    items,
    loading: waitingForFilters || query.isPending,
    loadingMore: query.isFetchingNextPage,
    error: !waitingForFilters && query.isError ? 'Could not load properties. Please try again.' : '',
    hasMore: !waitingForFilters && Boolean(query.hasNextPage),
    loadMore,
  };
}
