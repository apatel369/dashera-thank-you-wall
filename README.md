# Diwali Sabha Celebration Wall

Live site: https://diwali-celebration-wall.vercel.app (the old `dashera-thank-you-wall.vercel.app` address redirects here)

This is a full-stack Vercel project with a Diwali festive visual theme and interactive firecrackers wall: attendee message (max 80 chars), cracker type (anar, chakri, rocket, phuljhari, bomb), and festive color palette (golden, rose, deepBlue, forestGreen). It uses Vite 7, React 19, TypeScript, Tailwind CSS, Vercel Functions, and Neon Postgres.

## Event flow

1. Open `/admin` and sign in. Every authenticated load or refresh of the admin dashboard starts a new session: it creates a new QR code, clears the active wall, and starts in Filling wall mode without showing the code. The prior session's display mode is not carried over. A refresh during the 100-note test leaves that test in place.
2. Open `/display` on the projector. Press **Show QR code** on `/admin` when you are ready; two large QR codes appear, one on each side of the center diya artwork. Both QR panels and the diya align 20 pixels from the top of the screen.
3. Attendees scan the code and submit their cracker wish ("This Diwali, I will light up..."). The QR code stays the same when you switch display modes.
4. The admin page shows incoming crackers as a read-only list. Press **Fill wall** to add or replace one cracker every two seconds around the center diya artwork. Once full, each waiting cracker replaces one randomly chosen visible cracker; the wall stays still when no new crackers arrive.
5. Press **Scroll crackers** to loop the latest 100 crackers upward in side columns, leaving the artwork clear. New submissions join the moving stream without restarting it.
6. Press **Light the crackers** to celebrate: a 3-second countdown lead-in, followed by a 20-second synchronised fireworks celebration with canvas particle effects, hand-written WebAudio sound effects, and bomb screen-shake, culminating in a glowing "Happy Diwali" aftermath with 7 flickering diyas. Guest submissions close.
7. Press **Show QR code** to return to the same code, or **Start new session** to clear the active wall and expire the previous code. The new code stays hidden until you press **Show QR code**.

For a rehearsal, press **Start 100-note test** on `/admin`. The projector and admin preview show a **TEST MODE** label and 100 labeled demo crackers fill automatically. You can switch between Fill wall, Scroll crackers, and Light the crackers during the test. After celebrating, choosing Fill wall starts the demo fill again. Guest submissions pause. Press **End test and restore wall** to delete demo crackers and return to the prior display mode, QR code, and real crackers. Test mode persists across refreshes until an admin ends it.

The admin page includes a live display preview. Open `/display` in a separate full-screen browser window for projection. The display and admin page poll the shared state every few seconds.

For roughly 500 guests, the database stores all submitted crackers and the projector queues them in arrival order. At one cracker every two seconds, showing 500 crackers once takes about 16 minutes 40 seconds. Scroll crackers intentionally loops only the latest 100. The initial 500-cracker feed is about 125 KB; later polls fetch only new crackers.

**Opening or refreshing `/admin` clears the active wall and expires the previous QR code.** The **Start new session** button does the same without a refresh. Earlier crackers remain in Neon for retention; lighting the crackers displays the fireworks celebration and closes submissions, rather than permanently deleting them. Old session-specific QR links can no longer submit. The bare `/` URL remains available for direct access.

## Audio Effects

The display view (`/display`) includes WebAudio synthesis sound effects (`fizz`, `whistle`, `pop`, `boom`, `crackle`, `finale`) with dynamics compression, voice limiting (max 24 voices), and rate limiting (max 12 cues/sec). Audio is off by default to satisfy browser autoplay policies; an unobtrusive button in the bottom-left corner (`🔇 Enable sound` / `🔊 Sound on`) enables audio for projector operators, and is automatically hidden when embedded in an iframe preview.

## Local work

Requires Node.js 24 and npm.

```bash
npm install
npx vercel link --project diwali-celebration-wall --scope nimit-sevaks-projects
npx vercel env pull .env.local --yes
npm run db:migrate
npx vercel dev
```

GitHub Actions deploys this public repo (`apatel369/dashera-thank-you-wall`): merges to the protected `main` branch go to production, and pull requests get a preview link. Collaborators: see [docs/collaborator-deploy-guide.md](docs/collaborator-deploy-guide.md).

Run `npm run build` to type-check and compile. `npm run dev` starts only the Vite front end; use `vercel dev` when testing the API.

Required Vercel environment variables:

- `ADMIN_PASSWORD`: protects `/admin` and its control API.
- `DATABASE_URL`: automatically provided by the connected Neon Free database.
- `PREVIEW_DATABASE_URL`: Preview environment only, from the separate Neon resource `dashera-wall-preview-db`. When set, the app uses it instead of `DATABASE_URL`, so pull request previews never touch the live wall. After a schema change, run the migration against both databases (`npx vercel env pull .env.preview.local --environment=preview` then `node --env-file=.env.preview.local scripts/migrate.mjs`).

The project is linked to the Vercel project `diwali-celebration-wall` and Neon resources `dashera-wall-db` (production) and `dashera-wall-preview-db` (previews). The admin password is stored locally outside this project in `../dashera-wall-admin-password.txt` and in Vercel as a secret. Do not commit `.env.local` or the password file.

## Routes

- `/`: attendee firecracker form and success state.
- `/display`: projector view, controlled remotely from `/admin`.
- `/admin`: password-protected QR, wall, and lighting controls.

Submissions and the current session/display mode are stored in Neon. The projector fetches only new crackers after its initial load. The test action atomically creates a separate demo session and 100 crackers; ending it atomically restores the saved live state and removes demo data. Historical approval records remain in Neon but are no longer used to display crackers. The older Blob store is no longer used by this app.

Run `npm test` for input and scheduling checks. To run the test-mode integration case, create an isolated Neon branch, set `DATABASE_URL` and `TEST_DATABASE_URL` to that branch in the ignored `.env.test.local` file, run `node --env-file=.env.test.local scripts/migrate.mjs`, then run `npm test`. Never point `TEST_DATABASE_URL` at the production branch: the integration case temporarily switches the branch's wall state.
