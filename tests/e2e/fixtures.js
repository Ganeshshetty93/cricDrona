import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL).origin;
    const errors = [];
    const mutations = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) {
        mutations.push(`${request.method()} ${url.pathname}`);
      }
    });
    // The suite uses the real same-origin API. External traffic (including fonts)
    // is blocked, so a browser can never contact a live Supabase project.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return /^https?:$/.test(url.protocol) && url.origin !== origin
        ? route.abort('blockedbyclient')
        : route.continue();
    });
    await use(page);
    expect(errors, 'No uncaught browser errors').toEqual([]);
    expect(mutations, 'Preview UI must not attempt account, booking, or enquiry writes').toEqual([]);
  },
});

test.beforeEach(async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok(), 'The actual local API must be available').toBeTruthy();
  expect(await health.json(), 'Browser smoke tests must never run against a connected database').toEqual({
    data: { configured: false, mode: 'demo' },
  });
});

export { expect };

export async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewport: document.documentElement.clientWidth,
  })).then(({ content, viewport }) => content - viewport), {
    message: 'Page content should fit the viewport without horizontal scrolling',
  }).toBeLessThanOrEqual(1);
}
