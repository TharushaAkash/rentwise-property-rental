import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../services/api';

export function usePropertyBrowse(filters) {
  const invalidBudget = [filters.minBudget, filters.maxBudget].some(value =>
    value != null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))
    || (filters.minBudget != null && filters.minBudget !== '' && filters.maxBudget != null
      && filters.maxBudget !== '' && Number(filters.minBudget) > Number(filters.maxBudget));
  const filterKey = JSON.stringify(filters);
  const [debouncedKey, setDebouncedKey] = useState(filterKey);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(filterKey), 300);
    return () => clearTimeout(timer);
  }, [filterKey]);
  const waitingForFilters = filterKey !== debouncedKey;
  const query = useInfiniteQuery({
    queryKey: ['api', 'property-browse', debouncedKey],
    enabled: !waitingForFilters && !invalidBudget,
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => (await api.get('/properties/browse', {
      params: { ...JSON.parse(debouncedKey), pageSize: 12, cursor: pageParam || undefined }, signal,
    })).data,
    getNextPageParam: page => page.hasMore ? page.nextCursor || undefined : undefined,
  });
  const items = useMemo(() => {
    if (waitingForFilters || invalidBudget) return [];
    const unique = new Map();
    for (const page of query.data?.pages || []) {
      for (const property of page.items) unique.set(property.id, property);
    }
    return [...unique.values()];
  }, [query.data, waitingForFilters, invalidBudget]);
  const loadMore = () => {
    if (waitingForFilters || invalidBudget || query.isFetching) return;
    if (query.hasNextPage) void query.fetchNextPage({ cancelRefetch: false });
    else if (query.isError) void query.refetch();
  };
  return {
    items,
    validationError: invalidBudget,
    loading: !invalidBudget && (waitingForFilters || query.isPending),
    loadingMore: query.isFetchingNextPage,
    error: invalidBudget ? 'Enter a valid budget range: minimum cannot exceed maximum, and amounts cannot be negative.'
      : !waitingForFilters && query.isError ? 'Could not load properties. Please try again.' : '',
    hasMore: !invalidBudget && !waitingForFilters && Boolean(query.hasNextPage),
    refresh: () => { if (!waitingForFilters && !invalidBudget && !query.isFetching) void query.refetch(); },
    loadMore,
  };
}
