# Vercel Deploy — Root Directory

This is a **monorepo**: the Tauri desktop app lives at the repo root, the
Next.js + Payload marketing/licensing site lives in `website/`.

Vercel must build **only** `website/`. The repo root `package.json` is the
desktop app and has **no `next` dependency** — if Vercel builds from the root it
fails with:

```
Error: No Next.js version detected. Make sure your package.json has "next"...
```

## Fix (one-time project setting)

**Dashboard:** vercel.com → project `website` → Settings → Build & Deployment →
**Root Directory** → set to `website` → Save → Redeploy.

**API (with a valid token):**

```bash
# get IDs from website/.vercel/project.json
PROJECT_ID=prj_SDQWAziESxZ5YyOcBQpwAlE1KoRI
TEAM_ID=team_8Jphh0CsxREDZyzXp5enCqsX
VERCEL_TOKEN=<your token>

curl -X PATCH \
  "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$TEAM_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rootDirectory":"website","framework":"nextjs"}'
```

## Why not a root `vercel.json` redirect?

`vercel.json` has no `rootDirectory` field (it's project-level only), and faking
it from the root breaks Next.js framework detection + the API routes the desktop
app depends on (`/api/releases/latest`, `/api/licenses/activate`, `/api/cron/*`).
Root Directory = `website` is the supported monorepo approach.

## Verified deploy-ready

From `website/`: `pnpm install --frozen-lockfile` + `pnpm build` (`next build`)
both pass. pnpm is pinned via `packageManager` and `pnpm-lock.yaml`.
