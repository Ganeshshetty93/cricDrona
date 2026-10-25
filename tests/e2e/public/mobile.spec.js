import { test, expect, expectNoHorizontalOverflow } from './fixtures.js';

test('mobile navigation opens, follows links and closes on navigation', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeHidden();
  for (const [name, path] of [['Events', '/events'], ['Contact', '/contact'], ['Home', '/']]) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await expectNoHorizontalOverflow(page);
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(nav).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  }
});

test('mobile event filtering and detail navigation work', async ({ page }) => {
  await page.goto('/events');
  await page.getByRole('button', { name: 'Classes', exact: true }).click();
  await page.getByRole('combobox', { name: 'Age category' }).selectOption('Under 14');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('link', { name: 'View details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Junior Champions Academy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview event · Booking unavailable' })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

for (const width of [390, 320]) {
  test(`public pages fit a ${width}px viewport`, async ({ page }) => {
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
