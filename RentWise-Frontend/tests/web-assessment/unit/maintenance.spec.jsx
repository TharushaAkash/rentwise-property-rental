import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { MaintenanceDashboard } from '../../../src/features/maintenance/MaintenanceDashboard';
import { RequestForm } from '../../../src/features/maintenance/RequestForm';
import { user, property, maintenance } from '../support/fixtures';
import { server, http, HttpResponse } from '../support/server';
vi.mock('../../../src/hooks/useAuth', () => ({ useAuth: () => ({ user }) }));
it('WEB-15 maintenance requests render description, category and status', async () => {
  render(<MemoryRouter><MaintenanceDashboard /></MemoryRouter>);
  expect(await screen.findByText(maintenance.description)).toBeInTheDocument();
  expect(screen.getAllByText(/Plumbing/).length).toBeGreaterThan(0);
  expect(screen.getByText('Issue Reported')).toBeInTheDocument();
});
it.each(['', 'abcd'])('WEB-17 invalid description %s blocks maintenance submission', async description => {
  const submit = vi.fn(); const { container } = render(<RequestForm properties={[property]} onSubmit={submit} />);
  fireEvent.change(container.querySelector('textarea[name=description]'), { target: { value: description } });
  fireEvent.submit(container.querySelector('form'));
  expect(await screen.findByText('Please describe the maintenance issue (at least 5 characters)')).toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
});
it('WEB-17 failed maintenance create must display error and preserve form for retry', async () => {
  let posted = false;
  server.use(http.post('*/maintenance-requests', () => { posted = true; return HttpResponse.json({ message: 'Maintenance service unavailable' }, { status: 503 }); }));
  const { container } = render(<MemoryRouter><MaintenanceDashboard /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Request Maintenance' }));
  fireEvent.change(container.querySelector('textarea[name=description]'), { target: { value: maintenance.description } });
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(posted).toBe(true));
  expect(await screen.findByText(/maintenance service unavailable|failed to submit maintenance request/i)).toBeInTheDocument();
  expect(screen.queryByText(/Maintenance request created successfully!/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit Request' })).toBeEnabled();
});
