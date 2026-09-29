import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export function usePropertyBrowse(filters) {
  const filterKey = JSON.stringify(filters);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(null);
  const busy = useRef(false);

  async function fetchPage(after, signal) {
    busy.current = true;
    setError('');
    if (after) setLoadingMore(true);
    else setLoading(true);
    try {
      const { data } = await api.get('/properties/browse', {
        params: { ...JSON.parse(filterKey), pageSize: 12, cursor: after || undefined }, signal,
      });
      if (signal.aborted) return;
      setItems(previous => after
        ? [...previous, ...data.items.filter(item => !previous.some(p => p.id === item.id))]
        : data.items);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      if (!signal.aborted) setError('Could not load properties. Please try again.');
    } finally {
      if (!signal.aborted) {
        busy.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setItems([]);
    setCursor(null);
    setHasMore(false);
    setError('');
    setLoading(true);
    setLoadingMore(false);
    const timer = setTimeout(() => fetchPage(null, controller.signal), 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filterKey]);

  function loadMore() {
    if (!busy.current && request.current) fetchPage(cursor, request.current.signal);
  }

  return { items, loading, loadingMore, error, hasMore, loadMore };
}
