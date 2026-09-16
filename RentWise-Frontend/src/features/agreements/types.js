import { z } from 'zod';













export const agreementSchema = z.object({
  propertyId: z.string().uuid('Valid Property ID is required'),
  tenantId: z.string().uuid('Valid Tenant ID is required'),
  startDate: z.string(),
  endDate: z.string(),
  monthlyRent: z.number().min(1, 'Rent must be positive'),
  securityDeposit: z.number().min(0, 'Deposit cannot be negative'),
  terms: z.string().min(10, 'Terms are required'),
  status: z.enum(['Active', 'Terminated', 'Pending']).default('Pending')
});