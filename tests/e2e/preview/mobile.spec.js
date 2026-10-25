import { test, expect, openAs, expectClubhouse, expectNoHorizontalOverflow } from './fixtures.js';

for (const width of [390, 320]) {
  for (const role of ['owner', 'player']) {
    test(`${role} workspace pages fit a ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const paths = role === 'owner'
        ? ['/admin', '/admin/events', '/admin/registrations', '/admin/batches', '/admin/messages', '/admin/team']
        : ['/dashboard', '/registrations', '/profile'];
      await openAs(page, role, paths[0]);
      for (const path of paths) {
        await test.step(path, async () => {
          if (new URL(page.url()).pathname !== path) await page.goto(path);
          await expectClubhouse(page);
          await expectNoHorizontalOverflow(page);
        });
      }
    });
  }
}

test('mobile profile updates remain usable through the player navigation', async ({ page }) => {
  await openAs(page, 'player', '/dashboard');
  const nav = page.getByRole('navigation', { name: 'Clubhouse navigation' });
  await nav.getByRole('link', { name: 'My profile' }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Arjun Mobile Player');
  await page.getByRole('button', { name: 'Save profile changes' }).click();
  await expect(page.getByRole('status')).toContainText('Your player profile has been updated.');
  await expectNoHorizontalOverflow(page);
  await nav.getByRole('link', { name: 'My registrations' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
});
