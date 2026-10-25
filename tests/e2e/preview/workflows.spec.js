import { test, expect, openAs, expectClubhouse } from './fixtures.js';

test('preview role selector updates the active workspace and access controls', async ({ page }) => {
  await openAs(page, 'owner', '/admin');
  const roles = page.getByRole('combobox', { name: 'Preview role' });
  await roles.selectOption('player');
  await expect(page).toHaveURL('/dashboard');
  await expectClubhouse(page);
  await expect(page.getByRole('navigation', { name: 'Clubhouse navigation' }).getByRole('link', { name: 'My profile' })).toBeVisible();
  await roles.selectOption('coach');
  await expect(page).toHaveURL('/admin');
  await expectClubhouse(page);
  await expect(page.getByRole('navigation', { name: 'Clubhouse navigation' }).getByRole('link', { name: 'Team access' })).toHaveCount(0);
  await roles.selectOption('guest');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('navigation', { name: 'Clubhouse navigation' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
});

for (const section of ['', '/events', '/registrations', '/batches', '/messages', '/team']) {
  test(`owner can open /admin${section} with sample data`, async ({ page }) => {
    await openAs(page, 'owner', `/admin${section}`);
    await expectClubhouse(page);
    if (section === '/events') await expect(page.getByRole('row').filter({ hasText: 'Weekend Warriors Cup' })).toBeVisible();
    if (section === '/registrations') await expect(page.getByRole('table')).toBeVisible();
    if (section === '/batches') await expect(page.getByRole('heading', { name: 'Junior Strikers', exact: true })).toBeVisible();
    if (section === '/messages') await expect(page.getByRole('button', { name: 'Mark as read' }).first()).toBeVisible();
    if (section === '/team') await expect(page.getByRole('button', { name: 'Update access' })).toBeVisible();
  });
}

test('owner creates and edits a sample event through the real editor', async ({ page }) => {
  await openAs(page, 'owner', '/admin/events');
  await page.getByRole('button', { name: '+ Create event', exact: true }).click();
  const editor = page.getByRole('form', { name: 'Create event' });
  await editor.getByLabel('Event title', { exact: true }).fill('Browser smoke cricket class');
  await editor.getByLabel('Event type', { exact: true }).selectOption('Class');
  await editor.getByLabel('Ball type', { exact: true }).selectOption('Hard ball');
  await editor.getByLabel('Age group', { exact: true }).selectOption('Open');
  await editor.getByLabel('Visibility', { exact: true }).selectOption('published');
  await editor.getByLabel('Date (IST)', { exact: true }).fill('2099-11-01');
  await editor.getByLabel('Start time (IST)', { exact: true }).fill('18:30');
  await editor.getByLabel('Venue', { exact: true }).fill('Preview training ground');
  await editor.getByLabel('Fee (₹)', { exact: true }).fill('500');
  await editor.getByLabel('Total seats', { exact: true }).fill('16');
  await editor.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Event created.');
  const row = page.getByRole('row').filter({ hasText: 'Browser smoke cricket class' });
  await expect(row).toContainText('Preview training ground');
  await expect(row).toContainText('published');
  await row.getByRole('button', { name: 'Edit Browser smoke cricket class', exact: true }).click();
  const edit = page.getByRole('form', { name: 'Edit event' });
  await edit.getByLabel('Event title', { exact: true }).fill('Updated browser cricket class');
  await edit.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Event updated.');
  await expect(page.getByRole('row').filter({ hasText: 'Updated browser cricket class' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Browser smoke cricket class' })).toHaveCount(0);
});

test('owner creates a sample coaching batch with a linked coach', async ({ page }) => {
  await openAs(page, 'owner', '/admin/batches');
  await page.getByRole('button', { name: '+ Create batch', exact: true }).click();
  const editor = page.getByRole('form', { name: 'Create batch' });
  await editor.getByLabel('Batch name', { exact: true }).fill('Browser evening academy');
  await editor.getByLabel('Coach display name', { exact: true }).fill('Rahul Desai');
  await editor.getByLabel('Linked coach account', { exact: true }).selectOption({ label: 'Rahul Desai (coach)' });
  await editor.getByLabel('Age group', { exact: true }).selectOption('Under 14');
  await editor.getByLabel('Ball type', { exact: true }).selectOption('Hard ball');
  await editor.getByLabel('Schedule (IST)', { exact: true }).fill('Tuesday 18:00–19:00');
  await editor.getByLabel('Capacity', { exact: true }).fill('12');
  await editor.getByRole('button', { name: 'Create batch', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Coaching batch created.');
  const batch = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Browser evening academy' }) });
  await expect(batch).toContainText('Rahul Desai');
  await expect(batch).toContainText('0 / 12 places');
  await expect(batch).toContainText('Tuesday 18:00–19:00');
});

test('player updates their profile and sees the change after client navigation', async ({ page }) => {
  await openAs(page, 'player', '/profile');
  await page.getByLabel('Full name', { exact: true }).fill('Arjun Preview Player');
  await page.getByLabel('Phone number', { exact: true }).fill('9876501234');
  await page.getByLabel('Playing role', { exact: true }).selectOption('Batter');
  await page.getByLabel('Preferred cricket', { exact: true }).selectOption('Hard ball');
  await page.getByRole('button', { name: 'Save profile changes' }).click();
  await expect(page.getByRole('status')).toContainText('Your player profile has been updated.');
  const nav = page.getByRole('navigation', { name: 'Clubhouse navigation' });
  await nav.getByRole('link', { name: 'My dashboard' }).click();
  await expectClubhouse(page);
  await nav.getByRole('link', { name: 'My profile' }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Arjun Preview Player');
  await expect(page.getByLabel('Phone number', { exact: true })).toHaveValue('9876501234');
  await expect(page.getByLabel('Playing role', { exact: true })).toHaveValue('Batter');
});

test('player can keep or cancel a sample registration and sees released status', async ({ page }) => {
  await openAs(page, 'player', '/registrations');
  const registration = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Weekend Warriors Cup', exact: true }) });
  await expect(registration.getByText('confirmed', { exact: true })).toBeVisible();
  await registration.getByRole('button', { name: 'Cancel registration' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my place' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(registration.getByText('confirmed', { exact: true })).toBeVisible();
  await registration.getByRole('button', { name: 'Cancel registration' }).click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByRole('status')).toContainText('Your registration has been cancelled');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(registration.getByText('cancelled', { exact: true })).toBeVisible();
  await expect(registration.getByRole('button', { name: 'Cancel registration' })).toHaveCount(0);
});

test('player cannot enter academy management', async ({ page }) => {
  await openAs(page, 'player', '/admin/events');
  await expect(page.getByRole('heading', { name: 'Access is limited.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create event/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Your dashboard' }).click();
  await expect(page).toHaveURL('/dashboard');
  await expectClubhouse(page);
});

test('coach views assigned work with no management controls', async ({ page }) => {
  await openAs(page, 'coach', '/admin/events');
  const nav = page.getByRole('navigation', { name: 'Clubhouse navigation' });
  await expect(nav.getByRole('link', { name: 'Enquiries' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Team access' })).toHaveCount(0);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(\+ )?Create event|^Edit / })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Batches', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Junior Strikers', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(\+ )?Create batch|^Edit / })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Registrations', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await page.goto('/admin/team');
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update access' })).toHaveCount(0);
});

test('admin can grant admin access to another registered account', async ({ page }) => {
  await openAs(page, 'admin', '/admin/team');
  await expectClubhouse(page);
  await expect(page.getByRole('table')).toBeVisible();
  const row = page.getByRole('row').filter({hasText:'rahul@example.test'});
  await row.getByRole('button', {name:/Change access/}).click();
  const editor = page.locator('form.admin-editor');
  await editor.getByLabel('Role', {exact:true}).selectOption('admin');
  await editor.getByRole('button', {name:'Update access'}).click();
  await expect(page.getByRole('status')).toContainText('Account access updated.');
  await expect(row).toContainText(/admin/i);
});

test('guest protected-route redirects preserve their intended local destination', async ({ page }) => {
  await openAs(page, 'guest', '/profile?next=%2Fevents%2F11111111-1111-4111-8111-111111111111');
  await expect(page).toHaveURL(url => url.pathname === '/login'
    && url.searchParams.get('next') === '/profile?next=%2Fevents%2F11111111-1111-4111-8111-111111111111');
  await expect(page.getByRole('navigation', { name: 'Clubhouse navigation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
