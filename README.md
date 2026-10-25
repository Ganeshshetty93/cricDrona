# CricDrona

React/Vite frontend, Node API, and Supabase Auth/Postgres. The Night Stadium design is implemented in the public, player, and academy workspaces.

## Run locally

```powershell
cd E:\projects\cricDrona
npm install
npm start
```

Open **http://localhost:5173**. `npm start` starts both services and checks the website, JavaScript entry point and API proxy before printing the ready URL. Keep its terminal open. If both services are already healthy in another terminal, it reuses them and exits; the website remains available. `http://127.0.0.1:5173` reaches the same loopback app if localhost resolution differs.

For separate terminals, like Kannada Bharati, use `npm run server` for the backend and `npm run dev:client` for the frontend. The backend defaults to port **4001**; `http://localhost:4001/api/health` is its health endpoint. Port 3001 may belong to an older instance or the other project. Override `API_PORT` and `CLIENT_PORT` consistently before starting both services if necessary.

`npm run dev:design` is an optional **sample-data-only** design sandbox on port 5184. It is not the normal site and cannot save to Supabase.

## Supabase connection and accounts

`.env.local` must contain the same project URL and public key for both halves:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
# Backend-only maintenance commands; never use a VITE_ or NEXT_PUBLIC_ prefix
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
```

This workspace is configured for project **qmtwnpusswddrblbdnbi**. Run `npm run check:supabase` to check Auth settings, the event catalog, all six application tables and their required columns, and the nine API-used database functions without printing keys or player records. Table/function inspection uses the backend-only secret. Add `-- --email kmshetty@gmail.com` to inspect that account's confirmation/profile/role without changing it.

In Supabase **Authentication → Sign In / Providers → Email**, turn **Confirm email off** for registration followed by immediate login. The app navigates to the dashboard when Supabase returns a session. It does not fake a session when activation is still required. For password recovery, allow `http://localhost:5173/reset-password` and `http://127.0.0.1:5173/reset-password` in Auth URL Configuration.

Passwords and login identities are managed by **Authentication → Users** (`auth.users`). Application details live in **Table Editor → public.profiles**, with roles in **public.user_roles**. There is no application `users` table. An existing Auth account can return “User already registered” even when its profile is missing, or when the dashboard is displaying a different project/schema.

A player account was created and its initial login/profile read verified as **ganeshshetty93+player@gmail.com** using the password supplied in the conversation. A subsequent profile reload returned “Record not found”; use the repair SQL below to restore missing application rows. The original **ganeshshetty93@gmail.com** already exists and rejected that password. Do not re-register it to reset its password; use password recovery or the Supabase administrator controls.

To create or update the requested admin account locally with project administrator credentials:

```powershell
npm run account:repair -- --email kmshetty@gmail.com --name "KM Shetty" --role admin
```

This one-time CLI reads the project's secret key from the local environment, or asks for it with hidden input if absent. It asks for the desired password using hidden terminal input, creates or updates only that account, activates it without an email link, restores its profile/role, and verifies login. Passwords are not saved. It does not change the project's general signup confirmation setting. Add `--role-only` to change only an existing account's role, preserving its password/profile and any owner role.

On 23 October 2026, the existing **kmshetty@gmail.com** account was granted the **admin** role and its password was set to the user-requested value. Sign-in, confirmed email status, the role RPC, profile API, and all five admin data APIs were verified successfully through `http://localhost:5173`. No email confirmation is required. Open `http://localhost:5173/admin`; an admin can access all six academy screens. The fallback SQL in `supabase/grant-kmshetty-admin.sql` was not needed.

### Team roles

Admins and owners can open **Admin access → Add team member**, enter an existing account's email, choose **Player**, **Coach**, or **Admin**, and save. **Change access** edits a listed account. Neither role can change its own access or an owner account, or grant the owner role. Players manage their own bookings/profile; coaches can read assigned groups; admins and owners manage events, batches, enquiries, registrations and team access.

The API validates the session and the caller's database role before entering the isolated `server/team-access.js` handler. Only that handler uses `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`) to update a single existing role. It rechecks the caller's role before writing and uses the target's previous role as a condition so concurrent changes are not overwritten. Caller rechecking and the write are separate database requests, not a single transaction. The existing owner-only SQL RPC remains restricted; no broader direct browser database grants are added. Set the backend secret in the deployment environment as well as `.env.local`, then restart the Node backend after code/environment changes.

## Database SQL

- New, empty project: run `supabase/migrations/001_cricdrona.sql` once. It defines all six app tables, row access policies, signup hooks, booking/cancellation, batch assignment and role functions.
- Existing installation: review and run `supabase/verify-and-repair.sql`. It restores missing profile/role rows, checks the six tables and shows the requested Auth/profile records. It preserves existing roles and records. This SQL is supplied for review and has not been applied remotely by this agent.
- Optional fixtures: `supabase/seed.sql`.
- Requested original Ganesh admin role: `supabase/grant-ganesh-admin.sql`. Run as the project administrator after checking the account. Admin users can also open the player dashboard. Admins and owners can assign non-owner roles through the app; owner bootstrap is in `supabase/bootstrap-owner.sql`.

Keep all secret/service-role keys out of browser variables. Ordinary API routes use the public key plus the signed-in user's access token, with database row policies enforcing access. The isolated team-role mutation uses the backend secret only after server authorization.

Live verification on 23 October 2026 confirmed all required columns in `profiles`, `user_roles`, `events`, `batches`, `registrations`, and `contact_messages`, and all nine API-used RPCs. Existing tables and records were preserved; no schema recreation or seed import was necessary. This check verifies API availability, not a full audit of database policies and triggers.

## Pages

Public: home, about, event search/filtering, event details, contact, login, register, password recovery/reset, auth callback, setup, and not-found.

Player: `/dashboard`, `/profile`, `/registrations`, event booking and cancellation.

Academy: `/admin`, `/admin/events`, `/admin/registrations`, `/admin/batches`, `/admin/messages`, `/admin/team`. Event/batch editors, assignment, enquiry status and role controls use API calls. Coaches have restricted access.

## Checks and deployment

`npm test` checks API validation/authorization and local startup. `npm run test:e2e` checks public pages; `npm run test:auth` checks auth with intercepted test responses; `npm run test:design` checks the isolated role-preview workflows. Use `-- --workers=1` on browser suites when memory is limited. Preview tests are not evidence of live database writes.

`npm run build` creates `dist`. Vercel uses the supplied configuration and `api` entry point; configure both server and Vite environment variables before deployment. Event fees are payable to the academy; this app does not collect online payments. Contact forms save to the admin inbox rather than sending email.
