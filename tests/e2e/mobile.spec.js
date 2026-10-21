import { test, expect, expectNoHorizontalOverflow } from './fixtures.js';

test('mobile navigation opens, follows links, and closes after navigating', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');

  for (const [name, path] of [['Events', '/events'], ['Contact', '/contact'], ['Home', '/']]) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(navigation).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await expectNoHorizontalOverflow(page);
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(navigation).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  }

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(navigation).toBeHidden();
});

test('mobile players can filter coaching classes and open a preview event', async ({ page }) => {
  await page.goto('/events');
  await page.getByRole('button', { name: 'Classes', exact: true }).click();
  await page.getByRole('combobox', { name: 'Age category' }).selectOption('Under 14');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Junior Champions Academy' })).toBeVisible();
  await page.getByRole('link', { name: 'View details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Junior Champions Academy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview event · Booking unavailable' })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: 'All matches & classes' }).click();
  await expect(page).toHaveURL('/events');
  await expect(page.getByRole('article')).toHaveCount(4);
});

for (const width of [390, 320]) {
  test(`public pages fit a ${width}px mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/', '/about', '/events', '/events/11111111-1111-4111-8111-111111111111', '/contact', '/register', '/setup']) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText('Preview mode · Sample events.', { exact: false })).toBeVisible();
        if (path === '/events') await expect(page.getByRole('article')).toHaveCount(4);
        await expectNoHorizontalOverflow(page);
      });
    }
  });
}
