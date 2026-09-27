import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, signIn } from './fixtures';

/**
 * Every seeded review is attached to a dish, and the unique index covers
 * (author, restaurant, dish). These two customers therefore have no
 * restaurant-level review yet, so each pairing below is free - which lets the
 * suite avoid registration, whose limit is five accounts an hour.
 */
const AUTHORS = {
  submit: { email: ACCOUNTS.arun, restaurant: 'The Cinnamon Courtyard' },
  privacy: { email: ACCOUNTS.arun, restaurant: 'Salt & Sea Kitchen' },
  approval: { email: ACCOUNTS.maya, restaurant: 'Palmyrah Table' },
  rejection: { email: ACCOUNTS.maya, restaurant: 'Lakehouse Wok' },
};

/** Each run needs a body it can find again in the moderation queue. */
function uniqueBody(label: string) {
  return `E2E ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}: the rice arrived hot and the service was unhurried.`;
}

async function openRestaurant(page: Page, restaurant: string) {
  // Load the results already filtered. Submitting the search form instead lets
  // the result list re-render under the click, which detaches the link.
  await page.goto(`/?q=${encodeURIComponent(restaurant)}`);
  // The card's accessible name carries the rating and price too, so match loosely.
  const link = page.getByRole('link', { name: new RegExp(restaurant) }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: restaurant })).toBeVisible();
}

async function submitReview(page: Page, body: string) {
  await page.getByRole('button', { name: 'Write a review' }).click();
  for (const aspect of ['Food quality', 'Customer service', 'Value for money', 'Ambience']) {
    await page.getByLabel(`${aspect}: 5 stars`).check();
  }
  await page.getByLabel('Your review').fill(body);
  await page.getByRole('button', { name: 'Submit for approval' }).click();
}

test('a signed-in customer submits a review and is told it awaits approval', async ({ page }) => {
  const { email, restaurant } = AUTHORS.submit;
  await signIn(page, email);
  await openRestaurant(page, restaurant);

  await submitReview(page, uniqueBody('submit'));

  await expect(page.getByText(/awaiting moderator approval/)).toBeVisible();
});

test('a pending review is listed privately but stays off the public page', async ({ page }) => {
  const { email, restaurant } = AUTHORS.privacy;
  const body = uniqueBody('privacy');
  await signIn(page, email);
  await openRestaurant(page, restaurant);
  await submitReview(page, body);

  // Scope to this contribution: the author may have others awaiting approval.
  await page.getByRole('link', { name: 'My contributions' }).click();
  const entry = page.locator('article', { hasText: body });
  await expect(entry).toBeVisible();
  await expect(entry.getByText('Waiting for moderator approval.')).toBeVisible();

  // The same text must not reach anyone reading the restaurant page.
  await openRestaurant(page, restaurant);
  await page.getByRole('button', { name: /Community reviews/ }).click();
  await expect(page.getByText(body)).toHaveCount(0);
});

test('a signed-out visitor is asked to sign in before contributing', async ({ page }) => {
  await openRestaurant(page, 'Kandy Clay Pot');

  await page.getByRole('button', { name: 'Write a review' }).click();

  await expect(page.getByText('Sign in to contribute to the conversation.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for approval' })).toHaveCount(0);
});

test('a moderator approves a pending review and it becomes publicly visible', async ({ page }) => {
  const { email, restaurant } = AUTHORS.approval;
  const body = uniqueBody('approval');

  await signIn(page, email);
  await openRestaurant(page, restaurant);
  await submitReview(page, body);
  await expect(page.getByText(/awaiting moderator approval/)).toBeVisible();
  await page.getByLabel('Sign out').click();

  await signIn(page, ACCOUNTS.moderator);
  await page.getByRole('link', { name: 'Dashboard' }).click();
  const card = page.locator('article', { hasText: body });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Approve/ }).click();
  await expect(page.locator('article', { hasText: body })).toHaveCount(0);
  await page.getByLabel('Sign out').click();

  await openRestaurant(page, restaurant);
  await page.getByRole('button', { name: /Community reviews/ }).click();
  await expect(page.getByText(body)).toBeVisible();
});

test('a moderator rejects a review and the author reads the reason', async ({ page }) => {
  const { email, restaurant } = AUTHORS.rejection;
  const body = uniqueBody('rejection');
  const reason = 'Please describe the meal itself rather than the queue outside.';

  await signIn(page, email);
  await openRestaurant(page, restaurant);
  await submitReview(page, body);
  await expect(page.getByText(/awaiting moderator approval/)).toBeVisible();
  await page.getByLabel('Sign out').click();

  await signIn(page, ACCOUNTS.moderator);
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page
    .locator('article', { hasText: body })
    .getByRole('button', { name: /Reject|Unpublish/ })
    .click();
  await page.getByLabel('Reason').fill(reason);
  await page.getByRole('button', { name: 'Confirm rejection' }).click();
  await expect(page.locator('article', { hasText: body })).toHaveCount(0);
  await page.getByLabel('Sign out').click();

  await signIn(page, email);
  await page.getByRole('link', { name: 'My contributions' }).click();
  await expect(page.getByText(`Moderator’s note: ${reason}`)).toBeVisible();

  // A rejected review must not reach the public page either.
  await openRestaurant(page, restaurant);
  await page.getByRole('button', { name: /Community reviews/ }).click();
  await expect(page.getByText(body)).toHaveCount(0);
});
