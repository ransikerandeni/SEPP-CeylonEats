import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './fixtures';

test('an administrator sees the portal dashboard and its counters', async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.getByRole('link', { name: 'Dashboard' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Portal dashboard' })).toBeVisible();
  await expect(page.getByText('Awaiting review')).toBeVisible();
  await expect(page.getByText('Menu items')).toBeVisible();
  await expect(page.getByText('Published contributions')).toBeVisible();
});

test('a moderator gets the review desk but not the catalog tabs', async ({ page }) => {
  // Catalog editing is an administrator power; a moderator only judges content.
  await signIn(page, ACCOUNTS.moderator);
  await page.getByRole('link', { name: 'Dashboard' }).click();

  await expect(page.getByRole('button', { name: /Moderation/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurants' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu & prices' })).toHaveCount(0);
});

test('an administrator adds a restaurant and a dish, and the price band follows the boundary', async ({
  page,
}) => {
  const name = `E2E Boundary Kitchen ${Date.now()}`;
  const dish = `E2E Boundary Dish ${Date.now()}`;

  await signIn(page, ACCOUNTS.admin);
  await page.getByRole('link', { name: 'Dashboard' }).click();

  await page.getByRole('button', { name: 'Restaurants' }).click();
  await page.getByRole('button', { name: 'Add restaurant' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('City').selectOption('Colombo');
  await page.getByLabel('Address').fill('12 Test Lane, Colombo');
  await page.getByLabel('Description').fill('A venue created by the end-to-end suite.');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('No menu yet');

  // One dish priced a penny under LKR 1,000 puts the average in the budget band.
  await page.getByRole('button', { name: 'Menu & prices' }).click();
  await page.getByRole('button', { name: 'Add dish' }).click();
  // The menu tab has its own "Restaurant" filter, so scope to the open dialog.
  const form = page.locator('dialog');
  await form.getByLabel('Name', { exact: true }).fill(dish);
  await form.getByLabel('Restaurant').selectOption({ label: name });
  await form.getByLabel('Category').selectOption({ index: 1 });
  await form.getByLabel('Price in LKR').fill('999.99');
  await form.getByLabel('Description').fill('A dish created by the end-to-end suite.');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('row', { name: new RegExp(dish) })).toBeVisible();

  // The dashboard prints the raw band token; CSS capitalises it for display.
  await page.getByRole('button', { name: 'Restaurants' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('budget');

  // Walk the documented boundaries: <1000 budget, 1000-2500 mid, >2500 premium.
  for (const [price, band] of [
    ['1000', 'mid'],
    ['2500', 'mid'],
    ['2500.01', 'premium'],
  ]) {
    await page.getByRole('button', { name: 'Menu & prices' }).click();
    await page.getByLabel(`Edit ${dish}`).click();
    await page.locator('dialog').getByLabel('Price in LKR').fill(price);
    await page.locator('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Restaurants' }).click();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(band);
  }
});

test('a restaurant created in the dashboard is discoverable by visitors', async ({ page }) => {
  const name = `E2E Discoverable ${Date.now()}`;

  await signIn(page, ACCOUNTS.admin);
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: 'Restaurants' }).click();
  await page.getByRole('button', { name: 'Add restaurant' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('City').selectOption('Galle');
  await page.getByLabel('Address').fill('3 Rampart Street, Galle');
  await page
    .getByLabel('Description')
    .fill('Created by the end-to-end suite and searchable by name.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  await page.getByLabel('Sign out').click();

  // A venue with no menu yet must still be findable by name.
  await page.goto('/');
  await page.getByLabel('Search restaurants or dishes').fill(name);
  await page.getByRole('button', { name: 'Find my flavour' }).click();
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
});
