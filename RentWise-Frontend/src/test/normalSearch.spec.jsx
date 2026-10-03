import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { FindRentals } from '../features/rentals/FindRentals';
import api from '../services/api';

const browse = vi.hoisted(() => ({ items: [], loading: false, refresh: vi.fn(), loadMore: vi.fn() }));
vi.mock('../hooks/usePropertyBrowse', () => ({ usePropertyBrowse: () => browse }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
afterEach(() => vi.restoreAllMocks());

async function showAiResults() {
  vi.spyOn(api, 'post').mockResolvedValue({ data: { ranked_properties: [] } });
  render(<MemoryRouter><FindRentals /></MemoryRouter>);
  fireEvent.change(screen.getByPlaceholderText(/I'm a student at SLIIT/), { target: { value: 'A house in Colombo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run Match' }));
  await screen.findByRole('heading', { name: /Agentic AI Matches/ });
}

it('switches from AI results back to normal results when a normal filter changes', async () => {
  await showAiResults();
  fireEvent.change(screen.getByPlaceholderText('City or neighbourhood'), { target: { value: 'Kandy' } });
  expect(screen.queryByRole('heading', { name: /Agentic AI Matches/ })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Places to picture yourself in' })).not.toBeNull();
});

it('normal Search leaves AI mode and refreshes the normal search', async () => {
  await showAiResults();
  const scroll = vi.fn();
  document.getElementById('rental-results').scrollIntoView = scroll;
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  expect(browse.refresh).toHaveBeenCalled();
  expect(scroll).toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: /Agentic AI Matches/ })).toBeNull();
});
