import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'tests/IntegrationAssessment/config.local.json'), 'utf8').replace(/^\uFEFF/, ''));
const api = config.apiBaseUrl;
async function login(page, role) {
 const email = role === 'Tenant' ? config.tenantEmail : config.ownerEmail;
 const password = role === 'Tenant' ? config.tenantPassword : config.ownerPassword;
 expect(email, 'Set dedicated test account email').toBeTruthy(); expect(password, 'Set test account password').toBeTruthy();
 await page.goto('/login');
 if (role !== 'Tenant') await page.getByRole('button', { name: 'Owner / Admin' }).click();
 await page.locator('[name=email]').fill(email); await page.locator('[name=password]').fill(password);
 const pending = page.waitForResponse(r => r.url() === api + '/auth/login' && r.request().method() === 'POST');
 await page.getByRole('button', { name: 'Sign In', exact: true }).click();
 expect((await pending).status()).toBe(200); await expect(page).toHaveURL(/\/properties$/);
}
async function authenticatedGet(page, endpoint) {
 const token = await page.evaluate(() => localStorage.getItem('token'));
 const response = await page.request.get(api + endpoint, { headers: { Authorization: `Bearer ${token}` } });
 expect(response.ok(), `GET ${endpoint}: ${response.status()}`).toBe(true); return response.json();
}
test('INT-02 real login search details and rental booking workflow', async ({ page }, info) => {
 expect(config.rentalPropertyId, 'Set active unbooked test property ID').toBeTruthy();
 await login(page, 'Tenant');
 const property = await authenticatedGet(page, '/properties/' + config.rentalPropertyId);
 await page.goto('/find-rentals');
 const searched = page.waitForResponse(r => r.url().startsWith(api + '/properties/browse') && new URL(r.url()).searchParams.get('location') === config.searchLocation);
 await page.getByPlaceholder('City or neighbourhood').fill(config.searchLocation); expect((await searched).ok()).toBe(true);
 await page.getByRole('button', { name: 'Search', exact: true }).click();
 const title = page.getByText(property.title, { exact: true }); await expect(title).toBeVisible();
 // Open the matching listing's Details button, not an arbitrary first result.
 const card = page.locator('div').filter({ has: title }).filter({ has: page.getByRole('button', { name: 'Details', exact: true }) }).last();
 await card.getByRole('button', { name: 'Details', exact: true }).click();
 await page.getByRole('button', { name: 'View Full Public Listing Page' }).click();
 await expect(page).toHaveURL(new RegExp('/properties/' + config.rentalPropertyId + '$'));
 await expect(page.getByText(property.title, { exact: true }).first()).toBeVisible();
 await page.getByRole('button', { name: 'Book Property', exact: true }).click();
 await page.getByPlaceholder(/Hello, I am moving in/).fill('INT-02 integration assessment booking');
 const submitted = page.waitForResponse(r => r.url() === api + '/property-applications' && r.request().method() === 'POST');
 await page.getByRole('button', { name: 'Submit Booking Request', exact: true }).click();
 const response = await submitted; expect(response.ok()).toBe(true); const saved = await response.json(); expect(saved.id).toBeTruthy(); expect(saved.propertyId).toBe(config.rentalPropertyId);
 await expect(page.getByText('Booking Request Submitted!', { exact: true })).toBeVisible();
 const records = await authenticatedGet(page, '/property-applications'); expect(records.some(r => r.id === saved.id && r.propertyId === config.rentalPropertyId)).toBe(true);
 await info.attach('saved-booking-id', { body: JSON.stringify({ id: saved.id, propertyId: saved.propertyId }), contentType: 'application/json' });
 await page.screenshot({ path: info.outputPath('INT-02.png'), fullPage: true });
});
test('INT-03 web creates real property and exports same-record expectations for Flutter', async ({ page }, info) => {
 await login(page, 'Owner'); await page.getByRole('button', { name: 'Add Property', exact: true }).click();
 const title = 'INT-03 cross-platform ' + Date.now();
 await page.getByLabel('Property Title', { exact: true }).fill(title);
 await page.locator('textarea[name=description]').fill('Cross-platform assessment house created through real web UI');
 await page.getByLabel('Address & City').fill('12 Integration Road, Colombo');
 await page.getByLabel('Monthly Rent (Rs.)', { exact: true }).fill('56000');
 const pending = page.waitForResponse(r => r.url() === api + '/properties' && r.request().method() === 'POST');
 await page.getByRole('button', { name: 'Create Property Listing' }).click();
 const response = await pending; expect(response.status()).toBe(201); const created = await response.json(); expect(created.id).toBeTruthy();
 await expect(page.getByText(/created successfully!/)).toBeVisible();
 const saved = await authenticatedGet(page, '/properties/' + created.id);
 expect(saved.title).toBe(title); expect(saved.monthlyRent).toBe(56000); expect(saved.address).toBe('12 Integration Road, Colombo');
 const artifact = { apiBaseUrl: api, id: saved.id, title: saved.title, address: saved.address, monthlyRent: saved.monthlyRent };
 const folder = path.join(root, 'tests/IntegrationAssessment/evidence'); fs.mkdirSync(folder, { recursive: true });
 fs.writeFileSync(path.join(folder, 'INT-03-created-property.json'), JSON.stringify(artifact, null, 2));
 await info.attach('cross-platform-record', { body: JSON.stringify(artifact), contentType: 'application/json' });
 await page.screenshot({ path: info.outputPath('INT-03-web.png'), fullPage: true });
});
