import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { queryClient } from '../../src/services/queryClient';
afterEach(() => { cleanup(); queryClient.clear(); localStorage.clear(); vi.restoreAllMocks(); });
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:test-photo' });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
