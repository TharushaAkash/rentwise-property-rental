import { z } from 'zod';















export const propertySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(5, 'Address is required'),
  monthlyRent: z.number().min(1, 'Rent must be greater than 0'),
  bedrooms: z.number().min(0, 'Bedrooms cannot be negative'),
  bathrooms: z.number().min(0, 'Bathrooms cannot be negative'),
  facilities: z.string().optional().default(''),
  sqft: z.number().min(0, 'Square footage cannot be negative').optional().or(z.nan()),
  propertyType: z.string().optional().default('House'),
  featureTags: z.array(z.string()).optional().default([]),
  photoCount: z.number().optional().default(0),
  utilityBillUrl: z.string().optional().default(''),
  status: z.enum(['PendingVerification', 'Active', 'Suspended']).default('PendingVerification')
});