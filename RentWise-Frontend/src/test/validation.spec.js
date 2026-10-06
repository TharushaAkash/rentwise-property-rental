import { describe, expect, it } from 'vitest';
import { validateCard } from '../utils/paymentValidation';
import { registerSchema } from '../features/auth/schemas';
import { propertySchema } from '../features/properties/types';
import { applyServerErrors } from '../utils/formErrors';

const now = new Date(2026, 9, 1);
const card = { cardHolder: 'Test Tenant', cardNumber: '4242 4242 4242 4242', cardExpiry: '10/26', cardCvc: '123' };
describe('payment validation', () => {
  it('accepts a valid card through the end of its expiry month', () => {
    expect(validateCard(card, new Date(2026, 9, 31))).toBe('');
  });
  it.each([
    { cardNumber: '4242424242424241' }, { cardNumber: '424242424242424X' },
    { cardExpiry: '09/26' }, { cardExpiry: '13/28' }, { cardExpiry: '00/28' },
    { cardCvc: '1234' }, { cardCvc: '12a' }, { cardHolder: '   ' },
  ])('rejects invalid input %j', invalid => {
    expect(validateCard({ ...card, ...invalid }, now)).not.toBe('');
  });
  it('requires four CVV digits for Amex', () => {
    const amex = { ...card, cardNumber: '378282246310005', cardCvc: '1234' };
    expect(validateCard(amex, now)).toBe('');
    expect(validateCard({ ...amex, cardCvc: '123' }, now)).not.toBe('');
  });
});
it('rejects whitespace-only property text and fractional room counts', () => {
  const valid = { title: 'City apartment', description: 'A furnished apartment', address: 'Colombo 07', monthlyRent: 10000, bedrooms: 1, bathrooms: 1 };
  expect(propertySchema.safeParse(valid).success).toBe(true);
  for (const invalid of [{ title: '    ' }, { bedrooms: 1.5 }, { bathrooms: -1 }, { monthlyRent: Infinity }]) {
    expect(propertySchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
  }
});
it('reports password confirmation against the confirmation field', () => {
  const result = registerSchema.safeParse({ fullName: 'Test Tenant', email: 'test@example.com', phoneNumber: '0712345678', nicNumber: '200012345678', password: 'testpass123', confirmPassword: 'different123', role: 'Tenant' });
  expect(result.success).toBe(false);
  expect(result.error.issues.some(issue => issue.path[0] === 'confirmPassword')).toBe(true);
});
it('maps PascalCase server validation keys only to known fields', () => {
  const errors = {};
  applyServerErrors({ response: { data: { errors: { Email: ['Already registered'], Unknown: ['No'] } } } },
    (field, error) => { errors[field] = error.message; }, ['email']);
  expect(errors).toEqual({ email: 'Already registered' });
});
