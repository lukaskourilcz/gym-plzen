# End-to-end tests (Playwright)

Covers the public site, auth, and every admin page + form.

These tests need a **running app backed by a real Postgres** (auth and the
forms write to the database). They are not part of `next build` and do not run
on Vercel.

## Run locally

1. Start Postgres and point the app at it (`DATABASE_URL` / `DIRECT_URL`).
2. Apply schema + seed:
   ```bash
   npm run db:migrate && npm run db:seed
   ```
3. Create the test accounts the specs expect and promote the admin:
   ```bash
   # with the app running:
   curl -X POST "$APP/api/auth/sign-up/email" -H 'content-type: application/json' \
     -d '{"email":"admin@test.cz","password":"password123","name":"Admin Test"}'
   curl -X POST "$APP/api/auth/sign-up/email" -H 'content-type: application/json' \
     -d '{"email":"member@test.cz","password":"password123","name":"Member Test"}'
   npm run set-admin -- admin@test.cz
   ```
4. Build + start the app, then run the suite against it:
   ```bash
   npm run build && npm start &
   E2E_PORT=3000 npm run test:e2e
   ```

`global-setup.ts` signs the two accounts in and saves their storage states under
`tests/e2e/.auth/` (git-ignored) so admin/member specs start authenticated.

In environments with a pre-provisioned Chromium, set `PW_CHROMIUM_PATH` to its
binary so Playwright uses it instead of downloading one.
