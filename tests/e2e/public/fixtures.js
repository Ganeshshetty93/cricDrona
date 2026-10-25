import { test, expect } from '../browser-fixtures.js';

test.beforeEach(async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json(), 'Tests must use the real local API in demo mode').toEqual({
    data: { configured: false, mode: 'demo' },
  });
});
export { test, expect };
export { expectNoHorizontalOverflow } from '../browser-fixtures.js';
