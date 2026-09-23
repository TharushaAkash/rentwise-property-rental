import { z } from 'zod';











export const tenantProfileSchema = z.object({
  income: z.number().min(0, 'Income must be positive'),
  creditScore: z.number().min(300, 'Invalid credit score').max(850, 'Invalid credit score'),
  employmentStatus: z.string().min(2, 'Required'),
  rentalHistory: z.string(),
  preferences: z.string()
});