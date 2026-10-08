import { test, expect } from '@playwright/test';
test('WEB-18 browser loads and displays property data from real ASP.NET API', async ({ page }, info) => {
  // No route interception, synthetic JWT, or mocked backend in this test.
  const apiBase = process.env.LIVE_API_URL.replace(/\/$/, '');
  const pending = page.waitForResponse(r => r.url().startsWith(apiBase + '/properties/browse') && r.request().method() === 'GET');
  await page.goto('/find-rentals');
  const response = await pending;
  expect(response.ok(), `Actual API returned ${response.status()}`).toBe(true);
  const body = await response.json(); expect(Array.isArray(body.items)).toBe(true);
  expect(body.items.length, 'Seed at least one Active, unbooked property in the test backend').toBeGreaterThan(0);
  const property = body.items.find(p => p.status === 'Active' || p.status === 1);
  expect(property, 'Real API needs a verified active property').toBeTruthy();
  await expect(page.getByText(property.title, { exact: true }).first()).toBeVisible();
  await info.attach('real-api-response', { body: JSON.stringify({ url: response.url(), status: response.status(), items: body.items }), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('WEB-18.png'), fullPage: true });
});
