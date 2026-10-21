import { test, expect } from './fixtures.js';

const matchTitle = 'Weekend Warriors Cup';
const classTitle = 'Junior Champions Academy';
const eventPath = '/events/11111111-1111-4111-8111-111111111111';

test('public navigation connects the home, about, events, contact, and setup pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Own the');
  await expect(page.getByText('Preview mode · Sample events.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: matchTitle })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'About us' }).click();
  await expect(page).toHaveURL('/about');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('More than a game.');
  await expect(nav.getByRole('link', { name: 'About us' })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('link', { name: 'Find your next step' }).click();
  await expect(page).toHaveURL('/events');
  await expect(page.getByRole('heading', { name: 'The field is calling.' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(4);

  await nav.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Let’s talk cricket.' })).toBeVisible();
  await expect(page.getByText('Enquiry delivery is unavailable in preview mode.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send enquiry' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Log in to send an enquiry' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Setup guide', exact: true }).click();
  await expect(page).toHaveURL('/setup');
  await expect(page.getByRole('heading', { name: 'Connect your clubhouse.' })).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: 'CricDrona home' }).click();
  await expect(page).toHaveURL('/');
});

test('event filters combine category, age, and venue search and survive a reload', async ({ page }) => {
  await page.goto('/events');
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(4);

  await page.getByRole('button', { name: 'Matches', exact: true }).click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('heading', { name: matchTitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: classTitle })).toHaveCount(0);

  await page.getByRole('button', { name: 'Classes', exact: true }).click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('heading', { name: classTitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: matchTitle })).toHaveCount(0);

  await page.getByRole('button', { name: 'Hard ball', exact: true }).click();
  await expect(cards).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Age category' }).selectOption('Under 14');
  await page.getByRole('searchbox', { name: 'Search events or venues' }).fill('training NETS');
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('heading', { name: classTitle })).toBeVisible();
  await expect(page).toHaveURL(url => url.searchParams.get('category') === 'Hard ball'
    && url.searchParams.get('age') === 'Under 14'
    && url.searchParams.get('search') === 'training NETS');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Hard ball', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Age category' })).toHaveValue('Under 14');
  await expect(page.getByRole('searchbox')).toHaveValue('training NETS');
  await expect(cards).toHaveCount(1);

  await page.getByRole('searchbox').fill('no matching cricket venue');
  await expect(cards).toHaveCount(0);
  await expect(page.getByText('No events match your filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards).toHaveCount(4);
  await expect(page.getByRole('searchbox')).toBeEmpty();
  await expect(page.getByRole('combobox', { name: 'Age category' })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'All events', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('home format links open the matching filtered catalogue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Find tennis ball events' }).click();
  await expect(page).toHaveURL(url => url.pathname === '/events' && url.searchParams.get('category') === 'Tennis ball');
  await expect(page.getByRole('button', { name: 'Tennis ball', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: matchTitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tennis Ball Fundamentals' })).toBeVisible();
});

test('event details show the chosen event and keep preview bookings disabled', async ({ page }) => {
  await page.goto('/events');
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: matchTitle }) })
    .getByRole('link', { name: 'View details' }).click();
  await expect(page).toHaveURL(eventPath);
  await expect(page.getByRole('heading', { level: 1, name: matchTitle })).toBeVisible();
  await expect(page.getByText('Drona Cricket Ground', { exact: true })).toBeVisible();
  await expect(page.getByText('07:00 IST', { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview event · Booking unavailable' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Log in to register' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Connect the academy to enable booking' }).click();
  await expect(page).toHaveURL('/setup');

  await page.goto(eventPath);
  await page.getByRole('link', { name: 'All matches & classes' }).click();
  await expect(page).toHaveURL('/events');
  await expect(page.getByRole('article')).toHaveCount(4);
});

test('sign-in, account creation, and recovery forms explain setup and disable submissions', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByText('Account setup is pending.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeDisabled();
  await expect(page.getByLabel('Password', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();

  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Join the squad.' })).toBeVisible();
  for (const label of ['Full name', 'Email address', 'Password', 'Confirm password']) {
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();

  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Back in the game.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeDisabled();

  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText('Open the password reset link from your email');
  await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Request a new reset link' }).click();
  await expect(page).toHaveURL('/forgot-password');
});

test('unconfigured protected player and management pages lead to setup without showing private UI', async ({ page }) => {
  for (const path of ['/dashboard', '/registrations', '/profile', '/admin', '/admin/team']) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Connect CricDrona.' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Clubhouse navigation' })).toHaveCount(0);
      await page.getByRole('link', { name: 'View setup guide' }).click();
      await expect(page).toHaveURL('/setup');
      await expect(page.getByRole('heading', { name: 'Connect your clubhouse.' })).toBeVisible();
    });
  }
});

test('unknown events and pages provide working paths back to the public site', async ({ page }) => {
  await page.goto('/events/99999999-9999-4999-8999-999999999999');
  await expect(page.getByRole('heading', { name: 'This innings is unavailable.' })).toBeVisible();
  await expect(page.getByText('Event not found.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Browse events' }).click();
  await expect(page).toHaveURL('/events');
  await expect(page.getByRole('article')).toHaveCount(4);

  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'This ball’s left the ground.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to the clubhouse' }).click();
  await expect(page).toHaveURL('/');
});
