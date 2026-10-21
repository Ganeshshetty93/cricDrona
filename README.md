# CricDrona

Cricket academy website with a public event catalog, player accounts, event registrations, coaching batches, enquiries, and staff management. The frontend is a React/Vite single-page app. A Node API serves `/api/*`, and Supabase provides authentication and PostgreSQL storage.

## Current setup status

The project URL and public key have been saved locally in the ignored `.env.local` file. On 21 October 2026, a read-only check reached Supabase Auth successfully (HTTP 200), while the catalog RPC returned `PGRST202`: `public.list_events` was unavailable in the API schema cache. Database setup is still required; valid keys alone do not create the application tables or functions. No live account, booking, role, or batch workflow has been verified yet.

## Run locally

Use Node.js **22.12 or newer** and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). This starts Vite on port 5173 and the API on port 3001; Vite proxies `/api` to the API. Use the same hostname consistently because authentication redirects depend on the browser's origin. Stop both processes with Ctrl+C.

For a fresh checkout, create `.env.local` using `.env.example` as a template. Do not replace an existing configuration. Both applications must point to the same Supabase project:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

The equivalent `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY` names remain supported for legacy public anon keys. The browser uses `VITE_*` values, which Vite embeds at build time. The Node API uses `SUPABASE_*` values, with `VITE_*` fallbacks, and loads `.env` and `.env.local` in development. Restart development processes after changing configuration. Keep `.env.local` out of source control. Never use a secret or service-role key for either side of this application: API requests must retain the signed-in user's database permissions.

Without configuration, the API exposes four read-only demonstration events. Account, booking, and enquiry actions are disabled. A configured project with missing database objects reports an error rather than silently substituting demo data.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run frontend and API together |
| `npm run dev:client` | Run only Vite on port 5173 |
| `npm run dev:api` or `npm run server` | Run only the API on port 3001 |
| `npm run build` | Build the frontend into `dist/` |
| `npm run preview` | Preview the built frontend on port 4173; this does not start or proxy the API |
| `npm test` | Run API and authentication utility tests |
| `npm run test:e2e` | Run isolated desktop/mobile demo-mode browser tests |
| `node scripts/check-supabase.mjs` | Read-only Auth and catalog connectivity checks |

`npm start` starts Vite alone, listening on all interfaces. Use `npm run dev` for the complete local application. `@supabase/ssr` is installed as requested but is currently unused: this SPA uses `@supabase/supabase-js` with browser-managed sessions, rather than server-rendered pages or cookie-based SSR authentication.

## Set up the Supabase database

1. Open the intended project's Supabase SQL Editor with a database administrator account.
2. Review and run the complete [initial migration](supabase/migrations/001_cricdrona.sql) once in a project without existing CricDrona tables. It creates tables, grants, RLS policies, account triggers, validation triggers, and transactional RPCs. It also creates player profiles for existing Auth users. This script is not idempotent; do not repeatedly run it against an already installed schema.
3. Confirm that the Data API exposes the `public` schema. The migration explicitly grants the required access and enables RLS. Table access grants and row policies are both necessary; see [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).
4. Run `node scripts/check-supabase.mjs`. Auth and catalog should both return HTTP 200; an empty catalog is valid before events are created. `GET /api/health` only reports whether configuration is present, so its `connected` mode does not prove the database migration succeeded.
5. Optionally review and run [seed.sql](supabase/seed.sql) to publish four sample events with dates relative to the execution day. Replace sample venue, fees, and descriptions before using them with real players. The seed never runs automatically.

If the catalog still reports `PGRST202`, inspect the SQL Editor result, confirm that the complete migration committed in the same project used by `.env.local`, and confirm the function is exposed through the Data API. Do not disable RLS to resolve a setup error.

## Configure authentication and the first owner

Enable email/password authentication in the Supabase dashboard. Configure the Site URL for the production origin, or the local origin during initial development. Add redirect allowlist entries for the actual origins you use. The application sends these URLs:

- Sign-up confirmation: `ORIGIN/auth/callback?next=ENCODED_APP_PATH`
- Password recovery: `ORIGIN/reset-password`

For local development, `http://127.0.0.1:5173/**` covers both flows. For production, restrict the origin and callback paths; allow the callback's `next` query, including encoded paths such as `%2Fdashboard` or `%2Fevents%2F...`. For example, use `https://YOUR_DOMAIN/auth/callback?next=**` and `https://YOUR_DOMAIN/reset-password`. Add localhost or Vercel preview origins only when using them. Review the [Supabase redirect matching rules](https://supabase.com/docs/guides/auth/redirect-urls) and test both confirmation and recovery on the deployed domain.

Configure custom SMTP for production confirmation and recovery emails. Supabase's default email service restricts delivery to project team addresses and is intended for testing; see [custom SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp). Enquiry submissions are stored in the academy inbox and do not send email.

After the migration and authentication configuration are ready:

1. Register the owner's account through the website and confirm its email.
2. Open [bootstrap-owner.sql](supabase/bootstrap-owner.sql), replace `REPLACE_WITH_OWNER_EMAIL` with that account's email, and execute the script as an administrator in the SQL Editor. It grants owner access to the selected account.
3. Sign in again or reload the profile, then open `/admin`.
4. Have other staff create their own accounts. The owner can assign `admin`, `coach`, or `player` through Team access. The app cannot grant or revoke owner access, and the role editor protects the current owner's own role.

Players manage only their own profiles and registrations. Coaches can view assigned batches and their players; admins manage academy operations; owners additionally manage staff roles. Roles are stored in the database, not trusted from editable sign-up metadata. Event times and age eligibility use the academy's Asia/Kolkata timezone and the event date.

## Deploy to Vercel

1. Import the repository into Vercel with this directory as the project root. Use a Node runtime satisfying `package.json`.
2. Retain the Vite framework configuration, `npm run build`, and `dist` output directory from [vercel.json](vercel.json). [api/[...path].js](api/%5B...path%5D.js) exposes the shared Node handler as Vercel Functions; SPA routes are rewritten to `index.html`.
3. Add the four configuration variables shown above to the desired Vercel environments. The local ignored `.env.local` is not deployed. Use the same project URL and public key for frontend and API.
4. Configure Supabase Site URL, redirect allowlist, and SMTP for the deployed origin. Install the SQL migration in the target database if it has not already been installed.
5. Deploy, then verify `/api/health`, `/api/events`, direct navigation to `/events`, sign-up confirmation, sign-in, and password recovery. Rebuild and redeploy after changing any `VITE_*` value because it is compiled into the browser bundle.

Uploading `dist/` alone to a static host does not provide the Node API. No deployment has been performed as part of the current local setup.

## Verification and release checklist

Run `npm test` and `npm run build` after changes. The API tests use a fake Supabase client to verify validation, permissions at the HTTP boundary, RPC selection, and error handling. They do **not** execute PostgreSQL policies, triggers, or locks.

The browser suite runs the real app/API with Supabase configuration explicitly disabled and external requests blocked. It covers public pages, navigation, filters, demo-mode restrictions, protected-page gates, and responsive layouts. It requires Chromium or a supported installed browser; on Windows it can fall back to installed Edge. See [browser test instructions](tests/e2e/README.md) for setup and reports.

Before opening a connected deployment to real players, complete these checks using test accounts and events:

- [ ] Confirm Auth and catalog checks succeed against the intended project.
- [ ] Confirm sign-up email, sign-in, sign-out, refresh persistence, expired links, and password recovery work on the deployed origin.
- [ ] Create owner, admin, coach, and separate player accounts. Verify each role's UI and API access, and verify direct Supabase requests cannot bypass ownership or staff restrictions.
- [ ] Save player profiles; confirm invalid dates and role/email injection are rejected. Confirm age eligibility at an age-category boundary.
- [ ] Register once, reject duplicates, and send simultaneous requests for the final seat to verify only one succeeds.
- [ ] Cancel before the event begins, verify the seat is released, and re-register. Verify cancellation closes at the event start and academy event cancellation releases all bookings and batch assignments.
- [ ] Assign a confirmed class registration to a matching batch. Reject wrong ball format, ineligible age, and full capacity. Verify the assigned coach sees the right players and other coaches do not.
- [ ] Verify event/batch capacity cannot shrink below current bookings, and age/format edits cannot invalidate existing assignments.
- [ ] Submit an enquiry, verify staff inbox and read status, and verify the per-account submission limit.
- [ ] Verify changes survive reloads and are visible to another authorized account. Test on desktop and mobile.

Remaining product limits: no online payment or refunds are processed; displayed fees are payable directly to the academy. Enquiries have no outbound email/reply integration. Administrative registration and enquiry lists are capped at 1,000 rows and have no pagination. Live email delivery, database authorization, and concurrent seat/batch capacity behavior require the connected acceptance checks above.
