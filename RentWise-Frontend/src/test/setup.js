import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { queryClient } from '../services/queryClient';

afterEach(() => {
  cleanup();
  queryClient.clear();
  localStorage.clear();
});
