import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Login } from '../../../src/features/auth/Login';
import api from '../../../src/services/api';
const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('../../../src/hooks/useAuth', () => ({ useAuth: () => auth }));
beforeEach(() => auth.login.mockReset());
function show() { return render(<MemoryRouter><Routes><Route path="/" element={<Login />} /><Route path="/dashboard" element={<p>Dashboard reached</p>} /></Routes></MemoryRouter>); }
function submit(container, email = 'tenant@example.com', password = 'Password123!') {
  fireEvent.change(container.querySelector('[name=email]'), { target: { value: email } });
  fireEvent.change(container.querySelector('[name=password]'), { target: { value: password } });
  fireEvent.submit(container.querySelector('form'));
}
it('WEB-02 empty required fields show validation and block request', async () => {
  const post = vi.spyOn(api, 'post'); const { container } = show(); submit(container, '', '');
  expect(await screen.findByText('Password is required')).toBeInTheDocument();
  expect(screen.getByText('Invalid email address')).toBeInTheDocument(); expect(post).not.toHaveBeenCalled();
});
it('WEB-02 rejected credentials display friendly error and preserve login form', async () => {
  vi.spyOn(api, 'post').mockRejectedValue({ response: { data: { message: 'Invalid email or password.' } } });
  const { container } = show(); submit(container);
  expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  expect(auth.login).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
});
it('WEB-02 minimum password length is one; whitespace-only email is invalid', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'boundary', user: { role: 'Tenant' } } });
  const { container } = show(); submit(container, '   ', 'x');
  expect(await screen.findByText('Invalid email address')).toBeInTheDocument(); expect(post).not.toHaveBeenCalled();
  submit(container, 'tenant@example.com', 'x');
  await waitFor(() => expect(auth.login).toHaveBeenCalledWith('boundary'));
});
