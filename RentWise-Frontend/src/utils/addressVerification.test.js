import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePropertyVerification } from './addressVerification.js';

const document = { documentType: 'UtilityBill', documentUrl: 'https://example.test/electricity.jpg', createdAt: '2026-09-26T10:00:00Z' };
const property = { address: '12/3 Garden Lane, Piliyandala', status: 'Active', documents: [document] };
const record = (recommendation = 'Approve-ready', overrides = {}) => ({
  createdAt: '2026-09-26T10:05:00Z', comments: '[AI_PROPERTY_VERIFICATION]', isApproved: recommendation === 'Approve-ready',
  agentReport: JSON.stringify({ recommendation, reasoning: 'Checks completed.', propertyAddress: property.address, documentUrl: document.documentUrl }),
  ...overrides
});

test('sample URLs and client-side address/manual flags never imply verification', () => {
  const result = evaluatePropertyVerification({ ...property, utilityBillAddress: property.address, adminManuallyVerified: true });
  assert.equal(result.isVerified, false);
  assert.equal(result.statusLabel, 'Pending Verification');
  assert.equal(result.billAddress, '');
  assert.equal(result.matchScore, null);
});

test('persisted approval verifies the current property', () => {
  const result = evaluatePropertyVerification({ ...property, verificationRecords: [record()] });
  assert.equal(result.isVerified, true);
  assert.equal(result.matchDetails, 'Checks completed.');
});

test('review, rejection recommendation and suspension are not verified', () => {
  for (const recommendation of ['Needs Review', 'Reject-recommended']) {
    assert.equal(evaluatePropertyVerification({ ...property, verificationRecords: [record(recommendation)] }).isVerified, false);
  }
  assert.equal(evaluatePropertyVerification({ ...property, status: 'Suspended', verificationRecords: [record()] }).isVerified, false);
});

test('a later failed verification supersedes an old approval', () => {
  const records = [record(), record('Needs Review', { createdAt: '2026-09-26T11:00:00Z' })];
  assert.equal(evaluatePropertyVerification({ ...property, verificationRecords: records }).statusLabel, 'Needs Review');
});

test('fee payments never supersede a verification decision', () => {
  const records = [record(), { createdAt: '2026-09-26T12:00:00Z', comments: '[LISTING_FEE_PAID]', agentReport: 'Listing fee paid.' }];
  assert.equal(evaluatePropertyVerification({ ...property, verificationRecords: records }).isVerified, true);
});

test('edited addresses, removed documents and newer proofs invalidate old approvals', () => {
  const variants = [
    { ...property, address: '99 Another Street' },
    { ...property, documents: [] },
    { ...property, documents: [document, { ...document, documentUrl: 'https://example.test/new.jpg', createdAt: '2026-09-26T11:00:00Z' }] }
  ];
  for (const variant of variants) {
    assert.equal(evaluatePropertyVerification({ ...variant, verificationRecords: [record()] }).isVerified, false);
  }
});

test('persisted manual approval takes precedence over an earlier AI recommendation', () => {
  const records = [record('Reject-recommended'), { createdAt: '2026-09-26T11:00:00Z', adminId: 'admin', isApproved: true, comments: 'Manually reviewed.' }];
  const result = evaluatePropertyVerification({ ...property, verificationRecords: records });
  assert.equal(result.isManuallyVerified, true);
  assert.equal(result.statusLabel, 'Admin Verified');
});

test('malformed reports and missing data remain unverified', () => {
  for (const agentReport of ['broken JSON', 'null', '{}', '[]']) {
    assert.equal(evaluatePropertyVerification({ ...property, verificationRecords: [record('Approve-ready', { agentReport })] }).isVerified, false);
  }
  assert.equal(evaluatePropertyVerification(null).isVerified, false);
});
