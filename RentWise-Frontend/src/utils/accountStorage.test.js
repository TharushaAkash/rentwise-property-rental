import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStorage, belongsToAccount } from './accountStorage.js';

const data = new Map();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: key => data.delete(key),
}, configurable: true });
const signIn = email => localStorage.setItem('token',
  `e30.${Buffer.from(JSON.stringify({ email, sub: email })).toString('base64url')}.signature`);

test('account caches ignore legacy data and remain isolated after switching and returning', () => {
  for (const key of ['rentwise_client_bookings', 'rentwise_client_agreements', 'rentwise_client_payments', 'rentwise_client_maintenance', 'rentwise_client_service_providers']) {
    localStorage.setItem(key, 'other legacy data');
    signIn(' ONE@example.com ');
    assert.equal(accountStorage.getItem(key), null);
    accountStorage.setItem(key, 'own record');
    signIn('two@example.com');
    assert.equal(accountStorage.getItem(key), null);
    accountStorage.setItem(key, 'second account record');
    signIn('one@example.com');
    assert.equal(accountStorage.getItem(key), 'own record');
    accountStorage.removeItem(key);
    signIn('two@example.com');
    assert.equal(accountStorage.getItem(key), 'second account record');
  }
  localStorage.removeItem('token');
  assert.equal(accountStorage.getItem('rentwise_client_agreements'), null);
});

test('rental ownership excludes missing and demo identities and retains tenant and owner access', () => {
  const tenant = { id: 'tenant', role: 'Tenant' };
  for (const record of [{}, { tenantId: 'demo_tenant_id' }, { tenantId: 'another' }]) {
    assert.equal(belongsToAccount(record, tenant), false);
  }
  assert.equal(belongsToAccount({ tenantId: 'tenant' }, tenant), true);
  assert.equal(belongsToAccount({ ownerId: 'owner' }, { id: 'owner', role: 'PropertyOwner' }), true);
  assert.equal(belongsToAccount({ tenantId: 'tenant', property: { ownerId: 'owner' } }, { id: 'owner', role: 'PropertyOwner' }), true);
  assert.equal(belongsToAccount({ tenantId: 'tenant', property: { ownerId: 'another' } }, { id: 'owner', role: 'PropertyOwner' }), false);
  assert.equal(belongsToAccount({ tenantId: 'another' }, { id: 'admin', role: 'SystemAdmin' }), true);
  assert.equal(belongsToAccount({ tenantId: 'tenant' }, null), false);
});
