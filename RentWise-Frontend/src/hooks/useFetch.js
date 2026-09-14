import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { AxiosError } from 'axios';








export function useFetch(url) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(url);
      setData(response.data);
    } catch (err) {
      const axiosError = err;
      setError(axiosError.response?.data?.message || axiosError.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}