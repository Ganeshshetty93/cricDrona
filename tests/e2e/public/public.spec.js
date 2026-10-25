import { test, expect } from './fixtures.js';

test('public navigation connects all primary pages and setup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Weekend Warriors Cup' })).toBeVisible();
  for (const [name, path] of [['About us', '/about'], ['Events', '/events'], ['Contact', '/contact']]) {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.getByText('Enquiry delivery is unavailable in preview mode.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send enquiry' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Setup guide', exact: true }).click();
  await expect(page).toHaveURL('/setup');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('event filters combine format, age and venue and survive refresh', async ({ page }) => {
  await page.goto('/events');
  await expect(page.getByRole('article')).toHaveCount(4);
  await page.getByRole('button', { name: 'Matches', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Weekend Warriors Cup' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Junior Champions Academy' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hard ball', exact: true }).click();
  await page.getByRole('combobox', { name: 'Age category' }).selectOption('Under 14');
  await page.getByRole('searchbox').fill('training NETS');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Junior Champions Academy' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('training NETS');
  await expect(page.getByRole('combobox', { name: 'Age category' })).toHaveValue('Under 14');
  await expect(page.getByRole('button', { name: 'Hard ball', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('searchbox').fill('no matching cricket venue');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('article')).toHaveCount(4);
  await expect(page.getByRole('searchbox')).toBeEmpty();
});

test('home format links and event detail links keep booking unavailable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Find tennis ball events' }).click();
  await expect(page).toHaveURL(url => url.searchParams.get('category') === 'Tennis ball');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Weekend Warriors Cup' }) }).getByRole('link', { name: 'View details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Weekend Warriors Cup' })).toBeVisible();
  await expect(page.getByText('Drona Cricket Ground', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview event · Booking unavailable' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Log in to register' })).toHaveCount(0);
  await page.getByRole('link', { name: 'All matches & classes' }).click();
  await expect(page).toHaveURL('/events');
});

test('account forms disable sign-in and registration until configured', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Account setup is pending.')).toBeVisible();
  await expect(page.getByLabel('Email or existing username', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Password', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  for (const label of ['Full name', 'Password', 'Confirm password']) await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
});

test('password recovery remains disabled until setup and rejects missing reset links', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL('/forgot-password');
  await expect(page.getByLabel('Email address', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText('Open the password reset link from your email');
  await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Request a new reset link' }).click();
  await expect(page).toHaveURL('/forgot-password');
});

for (const path of ['/dashboard', '/registrations', '/profile', '/admin', '/admin/team']) {
  test(`${path} requires setup before exposing protected content`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Clubhouse navigation' })).toHaveCount(0);
    await page.getByRole('link', { name: 'View setup guide' }).click();
    await expect(page).toHaveURL('/setup');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test('unknown events and pages provide working return links', async ({ page }) => {
  await page.goto('/events/99999999-9999-4999-8999-999999999999');
  await expect(page.getByText('Event not found.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Browse events' }).click();
  await expect(page.getByRole('article')).toHaveCount(4);
  await page.goto('/missing-page');
  await page.getByRole('link', { name: 'Back to the clubhouse' }).click();
  await expect(page).toHaveURL('/');
});
