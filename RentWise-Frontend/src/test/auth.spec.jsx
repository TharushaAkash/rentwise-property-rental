import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../hooks/AuthProvider';
import { useAuth } from '../hooks/useAuth';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { queryClient } from '../services/queryClient';

function token(role = 'Tenant', exp = Math.floor(Date.now() / 1000) + 60) {
  return `e30.${btoa(JSON.stringify({ sub: 'user-1', role, FullName: 'Test User', exp }))}.signature`;
}
function Consumer({ name }) {
  const { user, login, updateUser } = useAuth();
  return <><p data-testid={name}>{user?.fullName || 'Guest'}</p>
    <button onClick={() => login(token())}>Login {name}</button>
    <button onClick={() => updateUser(null, { fullName: 'Updated User' })}>Update {name}</button></>;
}
afterEach(() => vi.useRealTimers());
it('shares login and profile changes between consumers', () => {
  render(<AuthProvider><Consumer name="one" /><Consumer name="two" /></AuthProvider>);
  fireEvent.click(screen.getByText('Login one'));
  expect(screen.getByTestId('two').textContent).toBe('Test User');
  fireEvent.click(screen.getByText('Update two'));
  expect(screen.getByTestId('one').textContent).toBe('Updated User');
});
it('clears cached private data when a session expires', () => {
  localStorage.setItem('token', token());
  render(<AuthProvider><Consumer name="one" /></AuthProvider>);
  queryClient.setQueryData(['api', '/private'], ['private']);
  act(() => window.dispatchEvent(new Event('rentwise:session-expired')));
  expect(screen.getByTestId('one').textContent).toBe('Guest');
  expect(queryClient.getQueryData(['api', '/private'])).toBeUndefined();
});
it('expires an open session without waiting for navigation', () => {
  vi.useFakeTimers();
  localStorage.setItem('token', token('Tenant', Math.floor(Date.now() / 1000) + 2));
  render(<AuthProvider><Consumer name="one" /></AuthProvider>);
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByTestId('one').textContent).toBe('Guest');
});
it('synchronizes logout from another tab', () => {
  localStorage.setItem('token', token());
  render(<AuthProvider><Consumer name="one" /></AuthProvider>);
  localStorage.removeItem('token');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'token' })));
  expect(screen.getByTestId('one').textContent).toBe('Guest');
});
it.each(['Tenant', 'PropertyOwner'])('blocks %s accounts from the admin route', role => {
  localStorage.setItem('token', token(role));
  render(<MemoryRouter><AuthProvider><ProtectedRoute roles={['Administrator', 'Admin', 'SystemAdmin']}><p>Admin content</p></ProtectedRoute></AuthProvider></MemoryRouter>);
  expect(screen.getByText('Access denied')).toBeTruthy();
  expect(screen.queryByText('Admin content')).toBeNull();
});
it.each(['Administrator', 'Admin', 'SystemAdmin'])('allows %s accounts into the admin route', role => {
  localStorage.setItem('token', token(role));
  render(<MemoryRouter><AuthProvider><ProtectedRoute roles={['Administrator', 'Admin', 'SystemAdmin']}><p>Admin content</p></ProtectedRoute></AuthProvider></MemoryRouter>);
  expect(screen.getByText('Admin content')).toBeTruthy();
});
it('redirects unauthenticated visitors to login', () => {
  render(<MemoryRouter initialEntries={['/admin']}><AuthProvider><Routes>
    <Route path="/admin" element={<ProtectedRoute><p>Admin content</p></ProtectedRoute>} />
    <Route path="/login" element={<p>Login page</p>} />
  </Routes></AuthProvider></MemoryRouter>);
  expect(screen.getByText('Login page')).toBeTruthy();
});
