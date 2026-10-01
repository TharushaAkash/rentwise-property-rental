import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Full name is required (min 3 characters)'),
  email: z.string().trim().email('Invalid email address format'),
  phoneNumber: z.string().trim()
    .min(1, 'Phone number is required')
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits (e.g. 0712345678)'),
  nicNumber: z.string().trim()
    .min(1, 'NIC number is required')
    .regex(/^([0-9]{9}[vV]|[0-9]{12})$/, "NIC must be 12 digits or 9 digits followed by 'V' (e.g. 123456789V or 200012345678)"),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
  role: z.enum(['Tenant', 'PropertyOwner']).default('Tenant')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

