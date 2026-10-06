import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentPurpose, paidRentMonths } from './paymentPurpose.js';

test('deposit and repeated payments never add extra rent months', () => {
  const payments = [
    { purpose: 'SecurityDeposit', paymentDate: '2026-09-10', isSuccessful: true },
    { purpose: 'MonthlyRent', paymentDate: '2026-09-11', isSuccessful: true },
    { purpose: 'MonthlyRent', paymentDate: '2026-09-12', isSuccessful: true },
    { purpose: 'MonthlyRent', paymentDate: '2026-10-12', isSuccessful: false },
  ];
  assert.equal(paidRentMonths(payments).length, 1);
});
test('explicit purpose overrides legacy reference and unknown payments stay unclassified', () => {
  assert.equal(paymentPurpose({ purpose: 'MonthlyRent', paymentReference: 'PAY-123' }), 'MonthlyRent');
  assert.equal(paymentPurpose({ paymentReference: 'RENT-202609-ABC' }), 'MonthlyRent');
  assert.equal(paymentPurpose({ paymentReference: 'PAY-123' }), 'SecurityDeposit');
  assert.equal(paymentPurpose({ paymentReference: 'unknown' }), 'Unspecified');
});
