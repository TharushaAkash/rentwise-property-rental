import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { FindRentals } from '../../../src/features/rentals/FindRentals';
import { queryClient } from '../../../src/services/queryClient';
import { server, http, HttpResponse } from '../support/server';
import { property } from '../support/fixtures';
vi.mock('../../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
const show = () => render(<QueryClientProvider client={queryClient}><MemoryRouter><FindRentals /></MemoryRouter></QueryClientProvider>);
it('WEB-10 budget filter requests filtered API data and displays matching results', async () => {
  let filteredRequest = false;
  const expensive = { ...property, id: 'p-2', title: 'Expensive apartment', monthlyRent: 90000 };
  server.use(http.get('*/properties/browse', ({ request }) => {
    const max = new URL(request.url).searchParams.get('maxBudget');
    filteredRequest = max === '60000';
    return HttpResponse.json({ items: max ? [property, expensive].filter(p => p.monthlyRent <= Number(max)) : [property, expensive], hasMore: false });
  }));
  const { container } = show();
  expect(await screen.findByText(expensive.title)).toBeInTheDocument();
  fireEvent.change(container.querySelector('input[placeholder="LKR maximum"]'), { target: { value: '60000' } });
  await waitFor(() => expect(filteredRequest).toBe(true));
  expect(await screen.findByText(property.title)).toBeInTheDocument();
  expect(screen.queryByText(expensive.title)).not.toBeInTheDocument();
});
it('WEB-11 empty API results display empty state', async () => {
  server.use(http.get('*/properties/browse', () => HttpResponse.json({ items: [], hasMore: false })));
  show(); expect(await screen.findByText('No properties match your filters')).toBeInTheDocument();
});
it('WEB-11 API failure displays error and retry; retry restores listings', async () => {
  server.use(http.get('*/properties/browse', () => HttpResponse.json({ message: 'Unavailable' }, { status: 503 })));
  show(); expect(await screen.findByText('Could not load properties. Please try again.', {}, { timeout: 5000 })).toBeInTheDocument();
  server.use(http.get('*/properties/browse', () => HttpResponse.json({ items: [property], hasMore: false })));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(property.title)).toBeInTheDocument();
});
