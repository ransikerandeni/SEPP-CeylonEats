import { expect, type Page } from '@playwright/test';

/** Every seeded account shares this password; scripts/e2e-db.mjs sets it. */
export const PASSWORD = process.env.E2E_PASSWORD || 'Playwright-e2e-password-9137';

export const ACCOUNTS = {
  customer: 'customer@ceyloneats.test',
  arun: 'arun@ceyloneats.test',
  maya: 'maya@ceyloneats.test',
  moderator: 'moderator@ceyloneats.test',
  admin: 'admin@ceyloneats.test',
  owner: 'owner@ceyloneats.test',
} as const;

/**
 * Signs in and waits for the server's answer.
 *
 * Without the wait, a following page.goto() can abort the in-flight login and
 * the session cookie is never set - which fails later, and confusingly. The
 * wait covers a rejected sign-in too, so the failure paths can use it as well.
 */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/account');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/auth/login')),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
}

/**
 * Registers a throwaway account.
 *
 * Registration is rate limited to five an hour, so only the sign-up test uses
 * this; review tests sign in as seeded customers instead.
 */
export async function registerFreshAccount(page: Page, label: string) {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto('/account');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill(`E2E ${label}`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Sign out')).toBeVisible();
  return email;
}
