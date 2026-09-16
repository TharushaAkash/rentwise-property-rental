import { useState } from 'react';
import api from '../services/api';
import { AxiosError } from 'axios';









export function useMutation(
url,
method = 'POST')
{
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutateAsync = async (variables) => {
    setIsLoading(true);
    setError(null);
    try {
      const targetUrl = typeof url === 'function' ? url(variables) : url;
      let response;
      if (method === 'POST') response = await api.post(targetUrl, variables);else
      if (method === 'PUT') response = await api.put(targetUrl, variables);else
      if (method === 'DELETE') response = await api.delete(targetUrl);else
      throw new Error('Unsupported method');

      return response.data;
    } catch (err) {
      const axiosError = err;
      const errorMsg = axiosError.response?.data?.message || axiosError.message || 'An error occurred';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutateAsync, isLoading, error };
}