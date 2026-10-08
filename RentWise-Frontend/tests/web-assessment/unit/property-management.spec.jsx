import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { PropertiesDashboard } from '../../../src/features/properties/PropertiesDashboard';
import api from '../../../src/services/api';
const state = vi.hoisted(() => ({ data: [], error: null, isLoading: false, refetch: vi.fn(), create: vi.fn() }));
vi.mock('../../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner-1', role: 'PropertyOwner' } }) }));
vi.mock('../../../src/hooks/useFetch', () => ({ useFetch: url => url?.startsWith('/properties/owner/') ? state : { data: [], isLoading: false, refetch: vi.fn() } }));
vi.mock('../../../src/hooks/useMutation', () => ({ useMutation: () => ({ mutateAsync: state.create, isLoading: false }) }));
const property = { id: 'p-1', ownerId: 'owner-1', title: 'Colombo family house', address: '12 Main Road, Colombo', description: 'Spacious family house', monthlyRent: 50000, bedrooms: 3, bathrooms: 2, status: 'Active' };
beforeEach(() => { state.data = [property]; state.error = null; state.refetch.mockReset(); state.create.mockReset(); vi.spyOn(api, 'get').mockResolvedValue({ data: [] }); });
function show() { return render(<MemoryRouter><PropertiesDashboard /></MemoryRouter>); }
it('WEB-07 dashboard persists changed fields via update request', async () => {
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} }); const { container } = show();
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  fireEvent.change(screen.getByLabelText('Property Title'), { target: { value: 'Updated house' } }); fireEvent.submit(container.querySelector('form'));
  expect(await screen.findByText(/updated successfully!/)).toBeInTheDocument(); expect(put).toHaveBeenCalledWith('/properties/p-1', expect.objectContaining({ title: 'Updated house' }));
});
it('WEB-08 deletion requires confirmation, sends DELETE and refreshes list', async () => {
  const del = vi.spyOn(api, 'delete').mockResolvedValue({ data: {} }); show();
  fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true })); expect(del).not.toHaveBeenCalled();
  expect(screen.getByText('Are you sure you want to delete this property?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete Property' }));
  expect(await screen.findByText(/has been deleted/)).toBeInTheDocument(); expect(del).toHaveBeenCalledWith('/properties/p-1'); expect(state.refetch).toHaveBeenCalled();
});
