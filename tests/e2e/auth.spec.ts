import { expect, test } from '@playwright/test';
import { ACCOUNTS, PASSWORD, registerFreshAccount, signIn } from './fixtures';

test('a seeded customer can sign in and is greeted by name', async ({ page }) => {
  await signIn(page, ACCOUNTS.customer);

  await expect(page.getByText(/Hi, Nethmi/)).toBeVisible();
  await expect(page.getByLabel('Sign out')).toBeVisible();
});

test('the wrong password is rejected and leaves the visitor signed out', async ({ page }) => {
  await signIn(page, ACCOUNTS.customer, 'Definitely-not-the-password');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Sign out')).toHaveCount(0);
});

test('an unknown email is rejected without revealing whether the account exists', async ({
  page,
}) => {
  await signIn(page, 'nobody@nowhere.test');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Sign out')).toHaveCount(0);
});

test('signing out clears the session and restores the signed-out navigation', async ({ page }) => {
  await signIn(page, ACCOUNTS.customer);
  await expect(page.getByLabel('Sign out')).toBeVisible();

  await page.getByLabel('Sign out').click();

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Sign out')).toHaveCount(0);
});

test('a new visitor can register and is signed in immediately', async ({ page }) => {
  await registerFreshAccount(page, 'signup');

  await expect(page.getByRole('link', { name: 'My contributions' })).toBeVisible();
});

test('registration refuses a password shorter than the documented minimum', async ({ page }) => {
  // The field carries minLength=12, so the browser blocks submission and the
  // visitor stays on the form rather than creating a weak account.
  await page.goto('/account');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Too Short');
  await page.getByLabel('Email address').fill(`short-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByLabel('Sign out')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});

test('a signed-out visitor is sent to the sign-in form when opening my contributions', async ({
  page,
}) => {
  await page.goto('/my-reviews');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Sign out')).toHaveCount(0);
});

test('a customer has no staff dashboard link and cannot open the dashboard', async ({ page }) => {
  await signIn(page, ACCOUNTS.customer);

  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

  await page.goto('/admin');
  await expect(
    page.getByText('This dashboard is for portal administrators and review moderators.'),
  ).toBeVisible();
});

test('a moderator signs in and reaches the moderation dashboard', async ({ page }) => {
  await signIn(page, ACCOUNTS.moderator, PASSWORD);

  await page.getByRole('link', { name: 'Dashboard' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Review moderation' })).toBeVisible();
});
