import { test, expect } from '@playwright/test';
const property = { id: 'p-1', ownerId: 'owner-1', title: 'Colombo family house', description: 'Spacious family house with garden', address: '12 Main Road, Colombo', monthlyRent: 50000, bedrooms: 3, bathrooms: 2, sqft: 1200, propertyType: 'House', status: 'Active', photos: [], featureTags: [] };
function token(role) { return `e30.${Buffer.from(JSON.stringify({ sub: role === 'Tenant' ? 'tenant-1' : 'owner-1', email: 'test@example.com', FullName: 'Test User', role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`; }
async function mockApi(page, role = 'PropertyOwner', options = {}) {
  const created = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace(/^.*?\/api/, '');
    let body = [];
    if (path === '/auth/login') body = { token: token(role), user: { role } };
    else if (path === '/properties' && request.method() === 'POST') {
      if (options.createFailure) return route.fulfill({ status: 500, json: { message: 'Service unavailable' } });
      const item = { ...request.postDataJSON(), id: 'created-1', status: 'PendingVerification' }; created.push(item); body = item;
    } else if (path.startsWith('/properties/owner/')) body = [property, ...created];
    else if (path.startsWith('/properties/browse')) body = { items: [property], hasMore: false };
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
test('WEB-04 unauthenticated protected route redirects to login', async ({ page }, info) => {
  await page.goto('/rental-workflows'); await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible(); await shot(page, info, 'WEB-04');
});
test('WEB-16 unauthenticated property management redirects; tenant has no management actions', async ({ page }, info) => {
  await mockApi(page, 'Tenant'); await page.goto('/properties'); await expect(page).toHaveURL(/\/login$/); await shot(page, info, 'WEB-16-guest');
  await login(page, 'Tenant'); await expect(page.getByRole('button', { name: 'Add Property', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0); await shot(page, info, 'WEB-16-tenant');
});
test('WEB-09 login, browse, open details and save a property', async ({ page }, info) => {
  await mockApi(page, 'Tenant'); await login(page, 'Tenant'); await page.goto('/find-rentals');
  await expect(page.getByText(property.title, { exact: true }).first()).toBeVisible(); await shot(page, info, 'WEB-09-listing');
  await page.getByRole('button', { name: 'Details', exact: true }).first().click(); await page.getByRole('button', { name: 'View Full Public Listing Page' }).click(); await expect(page).toHaveURL(/\/properties\/p-1$/); await expect(page.getByText(property.title, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]').includes('p-1'))).toBe(true); await shot(page, info, 'WEB-09-saved');
});
test('WEB-17 owner login, add property, submit and confirm creation', async ({ page }, info) => {
  await mockApi(page); await login(page); await shot(page, info, 'WEB-01'); await page.getByRole('button', { name: 'Add Property', exact: true }).click(); await fillProperty(page); await shot(page, info, 'WEB-10-form');
  const request = page.waitForRequest(req => /\/api\/properties$/.test(new URL(req.url()).pathname) && req.method() === 'POST');
  await page.getByRole('button', { name: 'Create Property Listing' }).click(); expect((await request).postDataJSON()).toMatchObject({ title: 'New assessment house', monthlyRent: 50000, ownerId: 'owner-1' });
  await expect(page.getByText(/created successfully!/)).toBeVisible(); await expect(page.getByText('New assessment house', { exact: true }).first()).toBeVisible(); await shot(page, info, 'WEB-17');
});
test('WEB-02 WEB-03 login validation/error screenshots', async ({ page }, info) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { message: 'Invalid email or password.' } }));
  await page.goto('/login'); await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await expect(page.getByText('Password is required', { exact: true })).toBeVisible(); await shot(page, info, 'WEB-02');
  await page.locator('[name=email]').fill('test@example.com'); await page.locator('[name=password]').fill('WrongPassword'); await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Invalid email or password.', { exact: true })).toBeVisible(); await shot(page, info, 'WEB-03');
});
test('WEB-11 WEB-12 WEB-13 property validation and upload screenshots', async ({ page }, info) => {
  await mockApi(page); await login(page); await page.getByRole('button', { name: 'Add Property', exact: true }).click();
  await page.getByRole('button', { name: 'Create Property Listing' }).click(); await expect(page.getByText('Title must be at least 3 characters')).toBeVisible(); await shot(page, info, 'WEB-11');
  await fillProperty(page); await page.getByLabel('Monthly Rent (Rs.)', { exact: true }).fill('-1'); await page.getByRole('button', { name: 'Create Property Listing' }).click();
  await expect(page.getByText('Rent must be greater than 0')).toBeVisible(); await shot(page, info, 'WEB-12');
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'house.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByAltText('preview-0')).toBeVisible(); await shot(page, info, 'WEB-13');
});
test('WEB-14 WEB-15 update and delete screenshots', async ({ page }, info) => {
  await mockApi(page); await login(page); await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Property Title', { exact: true }).fill('Updated assessment house'); await page.getByRole('button', { name: 'Save & Update Details' }).click();
  await expect(page.getByText(/updated successfully!/)).toBeVisible(); await shot(page, info, 'WEB-14');
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click(); await expect(page.getByText('Are you sure you want to delete this property?')).toBeVisible(); await shot(page, info, 'WEB-15-confirmation');
  await page.getByRole('button', { name: 'Yes, Delete Property' }).click(); await expect(page.getByText(/has been deleted/)).toBeVisible(); await shot(page, info, 'WEB-15');
});
test('WEB-18 failed property creation screenshot', async ({ page }, info) => {
  await mockApi(page, 'PropertyOwner', { createFailure: true }); await login(page); await page.getByRole('button', { name: 'Add Property', exact: true }).click(); await fillProperty(page);
  await page.getByRole('button', { name: 'Create Property Listing' }).click(); await expect(page.getByText('Failed to create property listing. Please check the inputs.')).toBeVisible(); await shot(page, info, 'WEB-18');
});
