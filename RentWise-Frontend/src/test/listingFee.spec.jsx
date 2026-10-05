import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AgreementsDashboard } from '../features/agreements/AgreementsDashboard';
import api from '../services/api';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1', role: 'PropertyOwner' } }),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const property = {
  id: 'property-1', ownerId: 'owner-1', title: 'Address mismatch listing',
  status: 'PendingVerification', documents: [{ id: 'proof-1' }],
  verificationRecords: [],
};

function openListings(listing = property) {
  const get = vi.spyOn(api, 'get').mockImplementation(url => Promise.resolve({
    data: url === '/properties/owner/owner-1' ? [listing] : [],
  }));
  render(<MemoryRouter initialEntries={['/agreements?tab=owner-approvals']}>
    <AgreementsDashboard />
  </MemoryRouter>);
  return get;
}

it('shows an unpaid pending listing from the owner endpoint', async () => {
  const get = openListings();
  expect(await screen.findByRole('button', { name: 'Pay Fee (Rs. 2,500)' })).not.toBeNull();
  expect(get).toHaveBeenCalledWith('/properties/owner/owner-1');
  expect(get).not.toHaveBeenCalledWith('/properties');
});

it('keeps a failed fee payment unpaid and shows the server error', async () => {
  openListings();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(api, 'post').mockRejectedValue({ response: { data: { message: 'Payment could not be recorded.' } } });
  fireEvent.click(await screen.findByRole('button', { name: 'Pay Fee (Rs. 2,500)' }));
  fireEvent.change(screen.getByLabelText('Cardholder name'), { target: { value: 'Test Owner' } });
  fireEvent.change(screen.getByLabelText('Card number'), { target: { value: '4242424242424242' } });
  fireEvent.change(screen.getByLabelText('Expiry'), { target: { value: '12' + String(new Date().getFullYear() + 2).slice(-2) } });
  fireEvent.change(screen.getByLabelText('CVV'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pay LKR 2,500 Now' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Payment could not be recorded.');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pay LKR 2,500 Now' }).disabled).toBe(false));
  expect(property.verificationRecords).toEqual([]);
  expect(screen.queryByText(/successfully paid/)).toBeNull();
});

it('does not offer another payment when the listing already has a fee record', async () => {
  openListings({ ...property, verificationRecords: [{ comments: '[LISTING_FEE_PAID: LKR 2,500.00]' }] });
  await screen.findByText(property.title);
  expect(screen.queryByRole('button', { name: 'Pay Fee (Rs. 2,500)' })).toBeNull();
});
