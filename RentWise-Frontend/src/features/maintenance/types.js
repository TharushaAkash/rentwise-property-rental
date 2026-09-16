import { z } from 'zod';

export const requestSchema = z.object({
  propertyId: z.string().min(1, 'Please select a property'),
  tenantId: z.string().optional().nullable(),
  description: z.string().min(5, 'Please describe the maintenance issue (at least 5 characters)'),
  photoUrl: z.string().optional().nullable().or(z.literal('')),
  aiCategory: z.string().min(1, 'Please select an issue category').default('General'),
  aiPriority: z.enum(['Low', 'Medium', 'High', 'Emergency']).default('Medium'),
  status: z.enum(['Reported', 'Assigned', 'InProgress', 'Completed']).default('Reported')
});