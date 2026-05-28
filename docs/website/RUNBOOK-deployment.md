# Production Deployment & R2 Setup Runbook

This document walks through the one-time setup of:
1. **Cloudflare R2** buckets and tokens
2. **CircleCI contexts** wiring those tokens
3. **Vercel** project configuration with all environment variables
4. **Neon Postgres** production database
5. **Resend** email domain verification
6. **Paystack** webhook + key configuration
7. **First admin user** + seeding the CMS

Allow ~3 hours end-to-end the first time. After this, every release flows automatically.

---

## 1. Cloudflare R2 — buckets + tokens

### 1.1 Create the buckets

In the Cloudflare dashboard → **R2** → **Create bucket**:

| Name | Purpose | Region |
|---|---|---|
| `duka-releases` | Desktop installers (signed binaries) | EEUR or WEUR |
| `duka-media` | Payload CMS uploads (screenshots, blog images) | EEUR or WEUR |
| `duka-backups` | Encrypted nightly customer backups (cloud backup add-on) | EEUR or WEUR |

For each, enable **Public access** *only* on `duka-releases` and `duka-media`. `duka-backups` stays private.

### 1.2 Custom domains (recommended)

Under each bucket → **Settings → Custom domains**:

- `duka-releases` → `r2.sokoos.co.ke`
- `duka-media` → `media.sokoos.co.ke`

Cloudflare auto-creates the DNS records and SSL.

### 1.3 API tokens (3 separate, minimum-privilege)

In **R2 → Manage R2 API Tokens → Create**:

| Token | Permissions | Bucket scope | Used by |
|---|---|---|---|
| `R2_CI_UPLOAD` | Object: `Read` + `Write` | `duka-releases` | CircleCI `upload-to-r2` job |
| `R2_PAYLOAD_MEDIA` | Object: `Read` + `Write` | `duka-media` | Payload server (S3 storage adapter) |
| `R2_BACKUPS` | Object: `Read` + `Write` | `duka-backups` | Customer cloud-backup add-on (server-side) |

For each token, save the **Access Key ID** and **Secret Access Key** — you can't view them again. Also save the **Account ID** (top right of the R2 page) and the **S3 endpoint URL** which is `https://<accountid>.r2.cloudflarestorage.com`.

### 1.4 CORS on the public buckets

Each public bucket → **Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 2. CircleCI contexts

In CircleCI **Organization Settings → Contexts**, create three contexts:

### 2.1 `r2-credentials`
Restrict to `justinelut/sokoOS` project only. Add env vars:

| Key | Value |
|---|---|
| `R2_ACCESS_KEY_ID` | from token `R2_CI_UPLOAD` |
| `R2_SECRET_ACCESS_KEY` | from token `R2_CI_UPLOAD` |
| `R2_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `duka-releases` |
| `R2_PUBLIC_HOST` | `r2.sokoos.co.ke` |

### 2.2 `payload-system`
Same project restriction. Generate a long random secret:

```bash
openssl rand -base64 32
```

| Key | Value |
|---|---|
| `PAYLOAD_URL` | `https://sokoos.co.ke` (no trailing slash) |
| `PAYLOAD_SYSTEM_TOKEN` | the generated secret |

Save the same `PAYLOAD_SYSTEM_TOKEN` value for use in Vercel below.

### 2.3 `github-release` (already exists)
Just confirm `GITHUB_TOKEN` has `repo` scope.

---

## 3. Neon Postgres

In **console.neon.tech**:

1. Create a new project: `duka-production`
2. Choose `aws-eu-central-1` region (closest to KE for now)
3. Copy the **pooled connection string** — that's your `DATABASE_URL`
4. Copy the **direct connection string** — that's your `DATABASE_URL_DIRECT` for migrations

Enable **Point-in-Time Restore** (free 24h on hobby tier; upgrade to 7-day on Pro after first paid customer).

---

## 4. Resend

In **resend.com**:

1. Add domain `sokoos.co.ke` (or your final brand domain)
2. Add the SPF, DKIM, MX records Resend gives you to Cloudflare DNS
3. Wait for verification (usually 30 min)
4. Generate an API key — full-access scoped to `sokoos.co.ke` only
5. Set the from address: `notifications@sokoos.co.ke` (or `noreply@…`)

---

## 5. Paystack

In **dashboard.paystack.com**:

1. Switch to **Live mode** when ready
2. **Settings → API Keys & Webhooks**:
   - Copy `Public key` and `Secret key`
   - Add webhook URL: `https://sokoos.co.ke/api/paystack/webhook`
3. Verify your business documents (KRA PIN, business registration cert, ID).

---

## 6. Vercel project

In **vercel.com**:

1. Import the `sokoOS` repo, set **Root Directory** = `website/`
2. Set **Build Command** = `pnpm build`, **Output** = `.next`
3. Add env vars (all sensitive ones to "Production" only; some need "Preview" too):

```
# Database
DATABASE_URL                  = postgres://...neon.tech...?sslmode=require
DATABASE_URL_DIRECT           = postgres://...neon.tech...?sslmode=require

# Payload
PAYLOAD_SECRET                = openssl rand -base64 64
PAYLOAD_SYSTEM_TOKEN          = same as CircleCI payload-system context
NEXT_PUBLIC_SITE_URL          = https://sokoos.co.ke
NEXT_PUBLIC_BRAND_NAME        = Duka

# Resend
RESEND_API_KEY                = re_...
RESEND_FROM_EMAIL             = notifications@sokoos.co.ke

# Paystack
PAYSTACK_SECRET_KEY           = sk_live_...
PAYSTACK_PUBLIC_KEY           = pk_live_...

# R2 — Media (used by Payload S3 adapter)
R2_ACCESS_KEY_ID              = from R2_PAYLOAD_MEDIA token
R2_SECRET_ACCESS_KEY          = from R2_PAYLOAD_MEDIA token
R2_ENDPOINT                   = https://<accountid>.r2.cloudflarestorage.com
R2_MEDIA_BUCKET               = duka-media
R2_PUBLIC_URL                 = https://media.sokoos.co.ke

# Cron protection
CRON_SECRET                   = openssl rand -base64 32

# Optional but recommended
SENTRY_DSN                    = https://...@sentry.io/...
NEXT_PUBLIC_POSTHOG_KEY       = phc_...
NEXT_PUBLIC_POSTHOG_HOST      = https://eu.i.posthog.com
```

4. Deploy. The first build will run Payload migrations because `db.push:true` only applies in dev.
5. Add custom domain `sokoos.co.ke` → Vercel.

---

## 7. First admin user + CMS seeding

After the first deploy:

1. Visit `https://sokoos.co.ke/admin`
2. Create the first user — this becomes the owner
3. Set `role = owner` on yourself
4. Open `/admin/globals/settings` and fill:
   - WhatsApp number `+254 7XX XXX XXX`
   - Support email
   - Sales email
   - Office address
   - Social links
5. Open `/admin/globals/pricing` — defaults are already wired (Starter 30k, Business 75k); confirm or edit.
6. Open `/admin/globals/landing-page` — review hero copy, swap the screenshot for a real one.
7. Optional: import the seed data from `src/lib/modules-seed.ts`, `src/lib/blog-seed.ts`, `src/lib/docs-seed.ts` into the corresponding collections (or run the planned `seed.ts` script).

---

## 8. Test the release pipeline

Smoke test before the first real release:

1. From `sokoOS/` (the desktop repo), tag a fake version:

   ```bash
   git tag v0.0.0-test.1
   git push origin v0.0.0-test.1
   ```

2. CircleCI runs:
   - `validate` (Linux)
   - `build-windows` (Windows)
   - `publish-release` (GitHub Release with installer)
   - `upload-to-r2` (artifacts to R2)
   - `notify-payload` (POST to /api/releases creates a draft)

3. Verify in `https://sokoos.co.ke/admin/collections/releases`:
   - A new draft Release `v0.0.0-test.1`
   - Highlights from CHANGELOG.md
   - R2 URLs for MSI + EXE
   - SHA-256 hashes filled in

4. Review and click **Publish** — the public `/downloads` page now shows it.

5. Clean up: delete the draft Release in admin, the GitHub release on the desktop repo, and the R2 path:

   ```bash
   aws s3 rm "s3://duka-releases/beta/v0.0.0-test.1/" \
     --endpoint-url https://<accountid>.r2.cloudflarestorage.com --recursive
   ```

When the dry run passes, tag the real version (`v0.2.0` etc.) and the same path runs for production.

---

## 9. Rotate secrets

Quarterly rotation schedule (set a calendar reminder):

| Secret | Where stored | How to rotate |
|---|---|---|
| `PAYLOAD_SYSTEM_TOKEN` | Vercel + CircleCI | `openssl rand -base64 32` → update both. New CI runs use new token. |
| `R2_ACCESS_KEY_ID/SECRET` | CircleCI + Vercel | Cloudflare R2 → Manage Tokens → Roll → update CircleCI context + Vercel env vars |
| `RESEND_API_KEY` | Vercel | Resend dashboard → revoke + new key |
| `PAYSTACK_SECRET_KEY` | Vercel | Paystack dashboard → API Keys → roll secret |
| Tauri signing key | CircleCI | High-impact rotation — see desktop runbook |

---

## 10. Failure modes + recovery

| Symptom | Probable cause | Fix |
|---|---|---|
| `notify-payload` returns 401 | `PAYLOAD_SYSTEM_TOKEN` mismatch | Verify CircleCI context matches Vercel env var |
| `upload-to-r2` returns 403 | R2 token lacks Write on `duka-releases` | Re-create token, update context |
| Tauri auto-updater can't reach `releases/latest` | Custom domain DNS not propagated | Check `r2.sokoos.co.ke` resolves; allow 30 min |
| Paystack webhook isn't called | URL not configured or mode mismatch (test vs live) | Re-add webhook in Paystack settings |
| Customer didn't get welcome email | `RESEND_API_KEY` missing or domain unverified | Check Vercel env var; verify domain in Resend |
| Cron jobs not firing | `vercel.json` not committed or plan is hobby | Confirm vercel.json on main branch; Vercel hobby tier supports daily crons |

---

## 11. Daily owner checklist (after launch)

- `/admin` dashboard → check error count, new sign-ups, payments overnight
- `/admin/collections/support-tickets?status=new` → triage
- `/admin/collections/payments?status=success` → confirm overnight collections
- Once a week: `/admin/views/installs-map` → confirm geographic spread
- Once a week: rotate WhatsApp replies — owner answers personally
