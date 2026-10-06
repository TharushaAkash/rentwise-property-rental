import { useMutation as useQueryMutation } from '@tanstack/react-query';
import api from '../services/api';

export function useMutation(url, method = 'POST') {
  const mutation = useQueryMutation({
    mutationFn: async (variables) => {
      const targetUrl = typeof url === 'function' ? url(variables) : url;
      if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) throw new Error('Unsupported method');
      const response = await api.request({
        url: targetUrl, method, data: method === 'DELETE' ? undefined : variables,
      });
      return response.data;
    },
  });
  return {
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error?.response?.data?.message || mutation.error?.message || null,
  };
}
