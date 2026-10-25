import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL).origin;
    const errors = [];
    const networkWrites = [];
    page.on('pageerror', error => errors.push(error.message));
    // UI preview writes must stay in the browser's isolated fixture store.
    await page.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) {
        networkWrites.push(`${request.method()} ${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      return /^https?:$/.test(url.protocol) && url.origin !== origin
        ? route.abort('blockedbyclient')
        : route.continue();
    });
    await use(page);
    expect(errors, 'No uncaught browser errors').toEqual([]);
    expect(networkWrites, 'Demo and design-preview flows must never send network mutations').toEqual([]);
  },
});
export { expect };

export async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => Math.max(
    document.documentElement.scrollWidth, document.body.scrollWidth,
  ) - document.documentElement.clientWidth), {
    message: 'Page should fit the viewport without horizontal scrolling',
  }).toBeLessThanOrEqual(1);
}
