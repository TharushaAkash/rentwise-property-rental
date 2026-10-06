import { expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { accountStorage } from '../utils/accountStorage';
import { AgreementsDashboard } from '../features/agreements/AgreementsDashboard';
import api from '../services/api';

const user = { id: 'tenant-one', email: 'one@example.com', role: 'Tenant' };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user }) }));
afterEach(() => vi.restoreAllMocks());
function signIn(email, id = 'tenant-one') {
  localStorage.setItem('token', `e30.${btoa(JSON.stringify({ email, sub: id }))}.signature`);
}
it('shows only the signed-in tenant agreements even if cache or API includes unrelated data', async () => {
  signIn(user.email);
  accountStorage.setItem('rentwise_client_agreements', JSON.stringify([
    { id: 'bad-local', tenantId: 'tenant-two', property: { title: 'Other cached rental' } },
  ]));
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [
    { id: 'own', tenantId: user.id, property: { title: 'My rental' }, status: 'Drafted' },
    { id: 'other', tenantId: 'tenant-two', property: { title: 'Other API rental' }, status: 'Drafted' },
  ] });
  render(<MemoryRouter><AgreementsDashboard /></MemoryRouter>);
  await screen.findByText('My rental');
  expect(screen.queryByText('Other cached rental')).toBeNull();
  expect(screen.queryByText('Other API rental')).toBeNull();
  await waitFor(() => expect(get).toHaveBeenCalledWith('/agreements/mine'));
  expect(get).not.toHaveBeenCalledWith('/agreements');
});
