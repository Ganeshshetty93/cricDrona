# Browser smoke tests

Run `npm run test:e2e` from the project root. Playwright starts the actual local Node API and Vite app on dedicated ports 3101 and 5183, then runs desktop Chromium and mobile Chromium emulation. If bundled Chromium is absent on Windows, the configuration uses installed Microsoft Edge. Set `PLAYWRIGHT_CHANNEL` to select another installed Chromium browser, or install bundled Chromium with `npx playwright install chromium`.

The suite explicitly blanks frontend and server Supabase settings even when `.env.local` is present. Every test verifies `/api/health` reports preview mode before loading pages; browser requests to external origins are blocked. Existing servers are never reused. Change `E2E_API_PORT` and `E2E_WEB_PORT` if the dedicated ports are occupied.

Coverage includes public navigation, combined event filters and URL persistence, event details, disabled account/booking/enquiry actions, protected-page setup gates, invalid routes, mobile navigation, and overflow at 390px and 320px. Uncaught browser errors and attempted API writes fail tests. The API and public UI are real; there are no mocked authenticated players. Successful authentication, connected-account redirects, registration mutations, and database permissions need separate connected integration testing.

Failure traces and screenshots are saved under `test-results/`; open the HTML report with `npx playwright show-report`. To run one surface, use `npm run test:e2e -- --project=desktop` or `npm run test:e2e -- --project=mobile`.
