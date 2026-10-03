import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFetch } from '../hooks/useFetch';
import { usePropertyBrowse } from '../hooks/usePropertyBrowse';
import { queryClient } from '../services/queryClient';
import api from '../services/api';

const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
afterEach(() => vi.restoreAllMocks());
it('deduplicates simultaneous reads and reuses fresh cached data', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: 'one' }] });
  const first = renderHook(() => useFetch('/properties'), { wrapper });
  const second = renderHook(() => useFetch('/properties'), { wrapper });
  await waitFor(() => expect(first.result.current.data).toEqual([{ id: 'one' }]));
  expect(second.result.current.data).toEqual([{ id: 'one' }]);
  expect(get).toHaveBeenCalledTimes(1);
});
it('ignores a late response after the URL changes', async () => {
  let finishOld;
  vi.spyOn(api, 'get').mockImplementation(url => url === '/old'
    ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve({ data: 'new' }));
  const hook = renderHook(({ url }) => useFetch(url), { wrapper, initialProps: { url: '/old' } });
  hook.rerender({ url: '/new' });
  await waitFor(() => expect(hook.result.current.data).toBe('new'));
  await act(async () => finishOld({ data: 'old' }));
  expect(hook.result.current.data).toBe('new');
});
it('invalidates reads after a successful API write', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: 'before' });
  const hook = renderHook(() => useFetch('/properties'), { wrapper });
  await waitFor(() => expect(hook.result.current.data).toBe('before'));
  get.mockResolvedValue({ data: 'after' });
  await act(async () => api.post('/properties', {}, {
    adapter: async config => ({ config, data: {}, status: 200, statusText: 'OK', headers: {} }),
  }));
  await waitFor(() => expect(hook.result.current.data).toBe('after'));
});
it('appends cursor pages, deduplicates properties, and resets changed filters', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation((_url, { params }) => Promise.resolve({ data:
    params.location === 'Kandy' ? { items: [{ id: 'kandy' }], hasMore: false } :
    params.cursor ? { items: [{ id: 'one' }, { id: 'two' }], hasMore: false } :
    { items: [{ id: 'one' }], hasMore: true, nextCursor: 'cursor-1' },
  }));
  const hook = renderHook(({ location }) => usePropertyBrowse({ location }), { wrapper, initialProps: { location: 'Colombo' } });
  await waitFor(() => expect(hook.result.current.items).toEqual([{ id: 'one' }]));
  act(() => hook.result.current.loadMore());
  await waitFor(() => expect(hook.result.current.items).toEqual([{ id: 'one' }, { id: 'two' }]));
  expect(get.mock.calls[1][1].params.cursor).toBe('cursor-1');
  hook.rerender({ location: 'Kandy' });
  expect(hook.result.current.items).toEqual([]);
  await waitFor(() => expect(hook.result.current.items).toEqual([{ id: 'kandy' }]));
  expect(hook.result.current.hasMore).toBe(false);
});
it('does not request a missing URL or an unsaved agreement', () => {
  const get = vi.spyOn(api, 'get');
  renderHook(() => useFetch(null), { wrapper });
  renderHook(() => useFetch('/agreements/agr_local'), { wrapper });
  expect(get).not.toHaveBeenCalled();
});

it('sends all normal search filters to the browse API', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [], hasMore: false } });
  const filters = { location: 'Colombo', minBudget: '40000', maxBudget: '80000', bedrooms: 4, minimumBedrooms: true, propertyType: 'House' };
  const hook = renderHook(() => usePropertyBrowse(filters), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(get).toHaveBeenCalledWith('/properties/browse', expect.objectContaining({
    params: expect.objectContaining(filters),
  }));
});

it('shows invalid budgets without requesting the API and recovers after correction', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [], hasMore: false } });
  const hook = renderHook(({ minBudget }) => usePropertyBrowse({ minBudget, maxBudget: '50000' }), {
    wrapper, initialProps: { minBudget: '90000' },
  });
  expect(hook.result.current.error).toContain('minimum cannot exceed maximum');
  expect(hook.result.current.loading).toBe(false);
  expect(get).not.toHaveBeenCalled();
  hook.rerender({ minBudget: '20000' });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toBe('');
  expect(get).toHaveBeenCalledTimes(1);
});
