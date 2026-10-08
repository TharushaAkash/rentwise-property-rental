import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PropertyForm } from '../../../src/features/properties/PropertyForm';
vi.mock('../../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner-1', role: 'PropertyOwner' } }) }));
const sample = { title: 'Colombo family house', description: 'Spacious family house with garden', address: '12 Main Road, Colombo', monthlyRent: 50000, bedrooms: 3, bathrooms: 2, sqft: 1200, propertyType: 'House' };
function show(initialData) { const submit = vi.fn(); const view = render(<PropertyForm initialData={initialData} onSubmit={submit} />); return { ...view, submit }; }
function fill(container, data = sample) { for (const [name, value] of Object.entries(data)) { const field = container.querySelector(`[name="${name}"]`); if (field) fireEvent.change(field, { target: { value: String(value) } }); } }
function send(container) { fireEvent.submit(container.querySelector('form')); }
it('WEB-06 valid property invokes create action with numeric fields and photos', async () => {
  const { container, submit } = show(); fill(container); send(container);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][0]).toMatchObject(sample); expect(submit.mock.calls[0][1]).toEqual([]);
});
it('WEB-06 empty required fields block creation', async () => {
  const { container, submit } = show(); send(container);
  expect(await screen.findByText('Title must be at least 3 characters')).toBeInTheDocument();
  expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
  expect(screen.getByText('Address is required')).toBeInTheDocument(); expect(submit).not.toHaveBeenCalled();
});
it.each([-1, 0, 'abc'])('WEB-06 invalid rent %s blocks submission', async rent => {
  const { container, submit } = show(); fill(container, { ...sample, monthlyRent: rent }); send(container);
  await waitFor(() => expect(screen.getByLabelText('Monthly Rent (Rs.)')).toHaveAttribute('aria-invalid', 'true'));
  expect(submit).not.toHaveBeenCalled();
});
it('WEB-06 minimum allowed rent 1 submits successfully', async () => {
  const { container, submit } = show(); fill(container, { ...sample, monthlyRent: 1 }); send(container);
  await waitFor(() => expect(submit).toHaveBeenCalled()); expect(submit.mock.calls[0][0].monthlyRent).toBe(1);
});
it('WEB-06 image chooser restricts unsupported types and previews supported image', async () => {
  const { container, submit } = show(); const input = container.querySelector('input[type=file][multiple]');
  expect(input).toHaveAttribute('accept', 'image/*');
  await userEvent.upload(input, new File(['bad'], 'document.txt', { type: 'text/plain' })); expect(input.files).toHaveLength(0);
  const image = new File(['image'], 'house.png', { type: 'image/png' }); await userEvent.upload(input, image);
  expect(await screen.findByAltText('preview-0')).toBeInTheDocument(); fill(container); send(container);
  await waitFor(() => expect(submit).toHaveBeenCalled()); expect(submit.mock.calls[0][1]).toEqual([image]);
});
it('WEB-06 handler must reject unsupported files bypassing chooser', async () => {
  const { container, submit } = show(); const invalid = new File(['bad'], 'document.txt', { type: 'text/plain' });
  fireEvent.change(container.querySelector('input[type=file][multiple]'), { target: { files: [invalid] } }); fill(container); send(container);
  expect(screen.getByRole('alert')).toHaveTextContent('Only image files are allowed');
  expect(screen.queryByAltText('preview-0')).not.toBeInTheDocument();
  await waitFor(() => expect(submit).toHaveBeenCalled()); expect(submit.mock.calls[0][1]).not.toContain(invalid);
});
it('WEB-07 existing property prefills and submits updated values', async () => {
  const { container, submit } = show(sample); expect(screen.getByLabelText('Property Title')).toHaveValue(sample.title);
  fireEvent.change(screen.getByLabelText('Property Title'), { target: { value: 'Updated Colombo house' } }); send(container);
  await waitFor(() => expect(submit).toHaveBeenCalled()); expect(submit.mock.calls[0][0]).toMatchObject({ ...sample, title: 'Updated Colombo house' });
});
