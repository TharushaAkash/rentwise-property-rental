import axios from 'axios';
import { queryClient } from './queryClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to inject JWT token into all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle 401s (e.g., token expired) without infinite loops
api.interceptors.response.use(
  (response) => {
    // Invalidate cached reads after writes, including calls outside useMutation.
    if (['post', 'put', 'patch', 'delete'].includes(response.config.method?.toLowerCase())) {
      void queryClient.invalidateQueries({ queryKey: ['api'] });
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (error.config?.headers?.Authorization === `Bearer ${localStorage.getItem('token')}`) {
        window.dispatchEvent(new Event('rentwise:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
