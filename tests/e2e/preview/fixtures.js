import { test, expect } from '../browser-fixtures.js';
export { test, expect };
export { expectNoHorizontalOverflow } from '../browser-fixtures.js';

// Each Playwright context and full document load gets independent fixture data.
// This selects a simulated role; it does not log into or create a real account.
export async function openAs(page, role, path) {
  await page.addInitScript(value => sessionStorage.setItem('cricdrona-preview-role', value), role);
  await page.goto(path);
  await expect(page.getByRole('combobox', { name: 'Preview role' })).toHaveValue(role);
}

export async function expectClubhouse(page) {
  await expect(page.getByRole('navigation', { name: 'Clubhouse navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
}
