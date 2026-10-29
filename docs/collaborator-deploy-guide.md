# Collaborator Guide: Previews and Deploys

How to propose changes, test them on a preview link, and get them live. You do not need a Vercel account: GitHub Actions deploys every change with the project owner's Vercel token.

## Get access

1. Ask the owner (`apatel369`) to add your GitHub account as a collaborator on `apatel369/dashera-thank-you-wall`.
2. Accept the email invite.
3. Clone the repo:

   ```bash
   git clone https://github.com/apatel369/dashera-thank-you-wall.git
   cd dashera-thank-you-wall
   npm install
   ```

Requires Node.js 24 and npm.

## Work locally

```bash
npm run dev      # front end only, at http://localhost:5173
npm run build    # type-check and compile; run before pushing
npm test         # input and wall-flow checks
```

`npm run dev` runs only the front end. The API needs the database, which only the owner can reach locally. To test anything that saves or loads notes, use a preview link (below).

## Get a preview link

1. Create a branch:

   ```bash
   git checkout main && git pull
   git checkout -b your-change-name
   ```

2. Commit and push the branch:

   ```bash
   git add -A && git commit -m "feat: short description"
   git push -u origin your-change-name
   ```

3. Open a pull request into `main` on GitHub.
4. Wait for the **Deploy to Vercel** check (about 1–2 minutes). The bot then comments on the pull request: `Preview deployed: https://...`.
5. Open that link to test. Each new push to the branch makes a new preview and a new comment.

## Deploy to production

Merge the pull request into `main`. GitHub Actions runs the tests, then deploys to https://dashera-thank-you-wall.vercel.app. Watch progress in the repo's **Actions** tab.

Pushing straight to `main` also deploys to production. Prefer pull requests so the change gets a preview and a second look first.

## Rules

- **Previews share the live database.** Notes you submit on a preview appear on the real wall. On a preview's `/admin`, **Start new session**, **Burn away**, and simply opening `/admin` all change the live projector. Never use `/admin` on a preview during the event.
- **The admin password comes from the owner directly.** Never paste it in a pull request, issue, commit, or chat channel.
- **Never commit secrets.** `.env*` files are ignored; keep it that way.
- **Leave `.github/workflows/` and `vercel.json` alone** unless the owner agrees. They control how and where the site deploys.
- **Pull before you push** (`git pull --rebase`) so you don't overwrite someone else's work.
- **Pull requests from forks only run tests.** They get no preview, because forks can't use the repo's secrets. Work on a branch in this repo instead.

## When something fails

| Symptom | What to do |
|---|---|
| `test` job fails | Run `npm test` and `npm run build` locally, fix, push again. |
| `deploy` fails at **Pull Vercel settings and env** | The Vercel token expired or was revoked. Tell the owner; they create a new token and update the `VERCEL_TOKEN` secret. |
| `deploy` fails at **Build** | Open the failed step's log in the **Actions** tab; it's usually a type or build error that `npm run build` reproduces locally. |
| No preview comment on the pull request | Check the PR is from a branch in this repo, not a fork, and that both jobs finished. |
| `git push` rejected (non-fast-forward) | Run `git pull --rebase`, then push again. |
