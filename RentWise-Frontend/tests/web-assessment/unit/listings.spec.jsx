import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { FindRentals } from '../../../src/features/rentals/FindRentals';
import { LankaPropertyCard } from '../../../src/components/LankaPropertyCard';
import api from '../../../src/services/api';
const browse = vi.hoisted(() => ({ items: [], loading: false, refresh: vi.fn(), loadMore: vi.fn(), hasMore: false }));
vi.mock('../../../src/hooks/usePropertyBrowse', () => ({ usePropertyBrowse: () => browse }));
vi.mock('../../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
beforeEach(() => { browse.items = []; });
it('WEB-04 listing card renders sample API fields and opens selected property', () => {
  const property = { id: 'p-1', title: 'Colombo family house', address: '12 Main Road, Colombo', monthlyRent: 50000, bedrooms: 3, sqft: 1200, propertyType: 'House', photoUrl: '/house.png' };
  const select = vi.fn(); render(<LankaPropertyCard property={property} onSelect={select} />);
  expect(screen.getByText(property.title)).toBeInTheDocument(); expect(screen.getByText(/1,200 sqft/)).toBeInTheDocument();
  expect(screen.getByAltText(property.title)).toHaveAttribute('src', '/house.png');
  expect(screen.getByText(/50,000/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'View & Book' })); expect(select).toHaveBeenCalledWith(property);
});
