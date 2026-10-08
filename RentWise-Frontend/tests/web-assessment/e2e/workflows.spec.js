import { test, expect } from '@playwright/test';
const property = { id: 'p-1', ownerId: 'owner-1', title: 'Colombo family house', description: 'Spacious family house with garden', address: '12 Main Road, Colombo', monthlyRent: 50000, bedrooms: 3, bathrooms: 2, sqft: 1200, propertyType: 'House', status: 'Active', photos: [], featureTags: [] };
function token(role) { return `e30.${Buffer.from(JSON.stringify({ sub: role === 'Tenant' ? 'tenant-1' : 'owner-1', email: 'test@example.com', FullName: 'Test User', role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`; }
async function mockApi(page, role = 'PropertyOwner', options = {}) {
  const created = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace(/^.*?\/api/, '');
    let body = [];
    if (path === '/agentic/workflow/maintenance-triage') return route.fulfill({ status: 503, json: { message: 'AI triage unavailable' } });
    if (path === '/auth/login') body = { token: token(role), user: { role } };
    else if (path === '/properties' && request.method() === 'POST') {
      if (options.createFailure) return route.fulfill({ status: 500, json: { message: 'Service unavailable' } });
      const item = { ...request.postDataJSON(), id: 'created-1', status: 'PendingVerification' }; created.push(item); body = item;
    } else if (path.startsWith('/properties/owner/')) body = [property, ...created];
    else if (path.startsWith('/properties/browse')) body = { items: new URL(request.url()).searchParams.get('location')?.includes('Kandy') ? [] : [property], hasMore: false };
    else if (path === '/agreements/mine') body = [{ id: 'a-1', tenantId: 'tenant-1', ownerId: 'owner-1', propertyId: property.id, property, status: 'Active' }];
    else if (path === '/properties') body = [property];
    else if (path === '/maintenance-requests' && request.method() === 'POST') body = { ...request.postDataJSON(), id: 'm-new' };
    else if (path === '/properties/p-1') body = property;
    await route.fulfill({ status: 200, json: body });
  });
  return created;
}
async function login(page, role = 'PropertyOwner') {
  await page.goto('/login'); if (role !== 'Tenant') await page.getByRole('button', { name: 'Owner / Admin' }).click();
  await page.locator('[name=email]').fill('test@example.com'); await page.locator('[name=password]').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await expect(page).toHaveURL(/\/properties$/);
}
async function shot(page, info, id) { await page.screenshot({ path: info.outputPath(`${id}.png`), fullPage: true }); }
async function fillProperty(page) {
  await page.getByLabel('Property Title', { exact: true }).fill('New assessment house');
  await page.locator('textarea[name=description]').fill(property.description); await page.getByLabel('Address & City').fill(property.address);
  await page.getByLabel('Monthly Rent (Rs.)', { exact: true }).fill('50000');
}

test('WEB-01 valid browser login with mocked successful authentication', async ({ page }, info) => {
  await mockApi(page); await login(page); await expect(page.getByRole('button', { name: 'Add Property', exact: true })).toBeVisible(); await shot(page, info, 'WEB-01');
});
test('WEB-03 unauthenticated protected route is blocked', async ({ page }, info) => {
  await page.goto('/agreements'); await expect(page).toHaveURL(/\/login$/); await shot(page, info, 'WEB-03');
});
test('WEB-05 browser creates property with mocked success and updated listing', async ({ page }, info) => {
  const created = await mockApi(page); await login(page);
  await page.getByRole('button', { name: 'Add Property', exact: true }).click(); await fillProperty(page);
  await page.getByRole('button', { name: 'Create Property Listing' }).click();
  await expect(page.getByText(/created successfully!/)).toBeVisible();
  expect(created[0]).toMatchObject({ title: 'New assessment house', monthlyRent: 50000, ownerId: 'owner-1' });
  await expect(page.getByText('New assessment house', { exact: true }).first()).toBeVisible(); await shot(page, info, 'WEB-05');
});
test('WEB-09 browser search sends criteria and renders matching results', async ({ page }, info) => {
  await mockApi(page, 'Tenant'); await page.goto('/find-rentals');
  await page.getByPlaceholder('City or neighbourhood').fill('Kandy');
  await expect(page.getByText('No properties match your filters')).toBeVisible();
  const request = page.waitForRequest(r => r.url().includes('/properties/browse') && new URL(r.url()).searchParams.get('location') === 'Colombo');
  await page.getByPlaceholder('City or neighbourhood').fill('Colombo'); await request;
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText(property.title, { exact: true }).first()).toBeVisible(); await shot(page, info, 'WEB-09');
});
test('WEB-16 browser submits maintenance request with mocked success', async ({ page }, info) => {
  await mockApi(page, 'Tenant'); await login(page, 'Tenant'); await page.goto('/maintenance');
  await page.getByRole('button', { name: 'Request Maintenance', exact: true }).first().click();
  await page.locator('textarea[name=description]').fill('Bathroom tap leaking continuously');
  const request = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/maintenance-requests'));
  await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ propertyId: 'p-1', description: 'Bathroom tap leaking continuously', tenantId: 'tenant-1' });
  await expect(page.getByText(/Maintenance request created successfully!/)).toBeVisible(); await shot(page, info, 'WEB-16');
});
