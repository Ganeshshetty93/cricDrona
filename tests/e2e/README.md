# Browser UI checks

`npm run test:e2e` runs public demo smoke checks against the real Node API and Vite app on dedicated ports 3101 and 5183. It blanks both frontend and server Supabase variables, verifies demo health before each test, and never reuses an existing server. Coverage includes public navigation, event filters and details, disabled accounts/bookings/enquiries, protected setup gates, recovery and invalid routes, mobile navigation, and 390px/320px overflow.

`npm run test:design` runs role and workflow checks against the isolated design-preview server on port 5184. Authentication and API data are simulated by the preview modules; this is not evidence of live authentication or database permissions. Tests cover all admin sections, event creation/editing, batch creation, player profile editing, booking cancellation, owner/admin/coach/player/guest UI access, redirect destinations, and mobile workspaces. Each browser gets its own fixture state.

Both suites block external browser requests and all network mutations. They fail on attempted writes or uncaught browser errors. Preview mutations run only in memory. Production API behavior and database permissions require separate integration checks.

Bundled Chromium is used when installed; Windows falls back to installed Edge. Set `PLAYWRIGHT_CHANNEL` to another installed Chromium channel if needed, or run `npx playwright install chromium`. Public test ports can be changed with `E2E_API_PORT` and `E2E_WEB_PORT`. Browser concurrency is capped at two workers.

Failure screenshots and traces are saved in `test-results/`. View reports with `npx playwright show-report` (public) or `npx playwright show-report playwright-report/preview` (design preview).
