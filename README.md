# Dusshera Sabha Thank You Wall

Live site: https://dashera-thank-you-wall.vercel.app

This is a separate Vercel project based on `thank-you-wall-main`. It keeps the original Dusshera artwork, visual theme, and sticky note choices: message, paper color, texture, ink color, and symbol. It uses Vercel Functions and Neon Postgres on the Free plan.

## Event flow

1. Open `/admin` and sign in. Every authenticated load or refresh of the admin dashboard starts a new session: it creates a new QR code, clears the active wall, and starts in Fill wall mode without showing the code. The prior session's display mode is not carried over. A refresh during the 100-note test leaves that test in place.
2. Open `/display` on the projector. Press **Show QR code** on `/admin` when you are ready; two large QR codes appear, one on each side of the logo. Both QR panels and the logo align 20 pixels from the top of the screen.
3. Attendees scan the code and submit notes. The QR code stays the same when you switch display modes.
4. The admin page shows incoming notes as a read-only list. Press **Fill wall** to add one note every two seconds around the center artwork. Once full, each waiting note replaces one randomly chosen visible note; the wall stays still when no new notes arrive.
5. Press **Scroll notes** to loop the latest 100 notes upward in side columns, leaving the artwork clear. New submissions join the moving stream without restarting it.
6. Press **Burn away** to animate visible notes into smoke and close submissions. Press **Show QR code** to return to the same code, or **Start new session** to clear the active wall and expire the previous code. The new code stays hidden until you press **Show QR code**.

For a rehearsal, press **Start 100-note test** on `/admin`. The projector and admin preview show a **TEST MODE** label and 100 labeled demo notes fill automatically. You can switch between Fill wall, Scroll notes, and Burn away during the test. After burning, choosing Fill wall starts the demo fill again. Guest submissions pause. Press **End test and restore wall** to delete demo notes and return to the prior display mode, QR code, and real notes. Test mode persists across refreshes until an admin ends it.

The admin page includes a live display preview. Open `/display` in a separate full-screen browser window for projection. The display and admin page poll the shared state every few seconds.

For roughly 500 guests, the database stores all submitted notes and the projector queues them in arrival order. At one note every two seconds, showing 500 notes once takes about 16 minutes 40 seconds. Scroll notes intentionally loops only the latest 100. The initial 500-note feed is about 125 KB; later polls fetch only new notes.

**Opening or refreshing `/admin` clears the active wall and expires the previous QR code.** The **Start new session** button does the same without a refresh. Earlier notes remain in Neon for retention; the burn action removes them visually and closes submissions, rather than permanently deleting them. Old session-specific QR links can no longer submit. The bare `/` URL remains available for direct access.

## Local work

Requires Node.js 24 and npm.

```bash
npm install
npx vercel link --project dashera-thank-you-wall --scope nimit-sevaks-projects
npx vercel env pull .env.local --yes
npm run db:migrate
npx vercel dev
```

GitHub Actions deploys this public repo (`apatel369/dashera-thank-you-wall`): merges to the protected `main` branch go to production, and pull requests get a preview link. Collaborators: see [docs/collaborator-deploy-guide.md](docs/collaborator-deploy-guide.md).

Run `npm run build` to type-check and compile. `npm run dev` starts only the Vite front end; use `vercel dev` when testing the API.

Required Vercel environment variables:

- `ADMIN_PASSWORD`: protects `/admin` and its control API.
- `DATABASE_URL`: automatically provided by the connected Neon Free database.

The project is linked to the Vercel project `dashera-thank-you-wall` and Neon resource `dashera-wall-db`. The admin password is stored locally outside this project in `../dashera-wall-admin-password.txt` and in Vercel as a secret. Do not commit `.env.local` or the password file.

## Routes

- `/`: attendee sticky note form and success state.
- `/display`: projector view, controlled remotely from `/admin`.
- `/admin`: password-protected QR, wall, and burn controls.

Notes and the current session/display mode are stored in Neon. The projector fetches only new notes after its initial load. The test action atomically creates a separate demo session and 100 notes; ending it atomically restores the saved live state and removes demo data. Historical approval records remain in Neon but are no longer used to display notes. The older Blob store is no longer used by this app.

Run `npm test` for input checks. To run the test-mode integration case, create an isolated Neon branch, set `DATABASE_URL` and `TEST_DATABASE_URL` to that branch in the ignored `.env.test.local` file, run `node --env-file=.env.test.local scripts/migrate.mjs`, then run `npm test`. Never point `TEST_DATABASE_URL` at the production branch: the integration case temporarily switches the branch's wall state.
