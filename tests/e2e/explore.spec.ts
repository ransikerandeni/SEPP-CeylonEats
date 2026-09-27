import { expect, test } from '@playwright/test';

test('the landing page introduces the three cities and lists seeded restaurants', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good food.');
  await expect(page.getByText('Colombo · Kandy · Galle').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /The Cinnamon Courtyard/ })).toBeVisible();
});

test('searching in English finds a restaurant by name', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search restaurants or dishes').fill('Kandy Clay Pot');
  await page.getByRole('button', { name: 'Find my flavour' }).click();

  await expect(page.getByRole('link', { name: /Kandy Clay Pot/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /The Cinnamon Courtyard/ })).toHaveCount(0);
});

test('searching in Sinhala finds the dish stored under its local name', async ({ page }) => {
  // The catalog stores each dish in English, Sinhala and Tamil; searching in a
  // non-Latin script must round-trip through PostgreSQL unchanged.
  await page.goto('/?view=dishes');

  await page.getByLabel('Search restaurants or dishes').fill('කොත්තු');
  await page.getByRole('button', { name: 'Find my flavour' }).click();

  await expect(page.getByRole('link', { name: /Chicken kottu/ })).toBeVisible();
});

test('an injection-shaped query is treated as ordinary text, not SQL', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search restaurants or dishes').fill("'; DROP TABLE restaurants; --");
  await page.getByRole('button', { name: 'Find my flavour' }).click();

  await expect(page.getByText('No matches on the menu.')).toBeVisible();

  // The catalog must still be intact afterwards.
  await page.goto('/');
  await expect(page.getByRole('link', { name: /The Cinnamon Courtyard/ })).toBeVisible();
});

test('the city filter narrows results to that city', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search city').selectOption('Galle');
  await page.getByRole('button', { name: 'Find my flavour' }).click();

  await expect(page.getByRole('link', { name: /Salt & Sea Kitchen/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Kandy Clay Pot/ })).toHaveCount(0);
});

test('the dishes tab switches the result type', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('group', { name: 'Result type' })
    .getByRole('button', { name: /Dishes/ })
    .click();

  await expect(page).toHaveURL(/view=dishes/);
  await expect(page.getByRole('link', { name: /Village rice & curry/ })).toBeVisible();
});

test('a restaurant card opens its detail page with menu and reviews', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('link', { name: /Kandy Clay Pot/ })
    .first()
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Kandy Clay Pot' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Restaurant sections' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A taste of what\u2019s here' })).toBeVisible();
});
