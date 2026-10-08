import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { AgreementsDashboard } from '../../../src/features/agreements/AgreementsDashboard';
import { user, property } from '../support/fixtures';
import { server, http, HttpResponse } from '../support/server';
vi.mock('../../../src/hooks/useAuth', () => ({ useAuth: () => ({ user }) }));
const show = () => render(<MemoryRouter><AgreementsDashboard /></MemoryRouter>);
it('WEB-12 agreement list renders selected property, rent and lease status', async () => {
  show(); expect(await screen.findByText(property.title)).toBeInTheDocument();
  expect(screen.getByText(/Sent to Tenant.*Pending Agreement/)).toBeInTheDocument();
  expect(screen.getAllByText(/50,000/).length).toBeGreaterThan(0);
});
it('WEB-13 signing agreement sends signature and changes status UI', async () => {
  let payload;
  server.use(http.put('*/agreements/a-1/agree', async ({ request }) => { payload = await request.json(); return HttpResponse.json({}); }));
  const { container } = show();
  fireEvent.click(await screen.findByRole('button', { name: 'Have to Agree' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(container.querySelector('form input[type=text]'), { target: { value: 'Test Tenant' } });
  fireEvent.click(screen.getByRole('button', { name: 'I Agree & Proceed to Payment' }));
  expect(await screen.findByText(/Agreed by Tenant.*Payment Required/)).toBeInTheDocument();
  await waitFor(() => expect(payload).toEqual({ signatureName: 'Test Tenant' }));
});
it('WEB-14 agreement API failure must display an error rather than a normal empty list', async () => {
  server.use(http.get('*/agreements/mine', () => HttpResponse.json({ message: 'Agreement service unavailable' }, { status: 503 })));
  show(); expect(await screen.findByText(/could not load agreements|failed to load agreements|agreement service unavailable/i)).toBeInTheDocument();
  expect(screen.queryByText('No Rental Agreements Yet')).not.toBeInTheDocument();
});
