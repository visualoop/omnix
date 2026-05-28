# DUKA WEBSITE — Plan 04: CI/CD Release Pipeline

This document defines the end-to-end automated release pipeline. The desktop repo (the existing Tauri app) builds the installer; the website (the new Payload deployment) takes over from there: ingesting the artifact into Cloudflare R2, creating a `Release` document in Payload, and serving the auto-updater manifest.

The owner ships a new version by typing one command:
```bash
git tag v0.2.0 && git push origin v0.2.0
```
Everything else happens automatically. The website's `/downloads` page shows the new version inside ~15 minutes. Existing installs see the upgrade prompt on next start.

---

## 1. CURRENT STATE (audited)

The desktop repo (`sokoOS/`) already has a working CI pipeline. To not break what works, this plan **extends** it rather than replacing it.

### What's there today

`.circleci/config.yml`:
- `validate` job — Linux, every push: `pnpm install` → `pnpm tsc --noEmit` → `cargo check` → `cargo test --lib`
- `build-windows` job — Windows medium, **only on tags `v*.*.*`**: pnpm install → installer images → tauri build (msi + nsis with updater signatures) → generates `latest.json`
- `publish-release` — Linux, on tag: uploads the artifact bundle to GitHub Releases via `gh`

`.github/workflows/ci.yml`:
- Currently disabled (workflow_dispatch only). We will leave this disabled.

`tauri.conf.json`:
- `productName: "SokoOS"` ← needs rename to brand const
- `bundle.publisher: "SokoOS"` ← rename
- `plugins.updater.endpoints: ["https://github.com/justinelut/sokoOS/releases/latest/download/latest.json"]` ← change to Payload-served endpoint

### What's missing

1. **Cloudflare R2 upload** — currently artifacts only live on GitHub Releases. We want them on `r2.duka.sokoos.co.ke` so Payload can hand out the URL and we can rotate hosting later.
2. **Payload Release-creation webhook** — no `Release` document is created automatically; the `/downloads` page can't see new versions.
3. **Tauri updater pointing at Payload** — currently points at GitHub. Switching it lets Payload enforce: trial users blocked from latest, lapsed licences blocked from latest, major-version cap enforcement.
4. **Brand rename** — `SokoOS` → `Duka` in `tauri.conf.json`. Single change, source-controlled.

This plan adds those four pieces.

---

## 2. END-TO-END FLOW (target)

```
┌──────────┐    git tag v0.2.0 + push
│  GitHub  │─────────────────────────────────────┐
└──────────┘                                     │
                                                 ▼
┌──────────────────────────────────────────────────────┐
│              CircleCI (existing)                     │
│  1. validate (TS + Cargo + tests)                    │
│  2. build-windows (MSI + NSIS + sigs + latest.json)  │
│  3. publish-release (GitHub Release, archival)       │
└──────────────────────┬───────────────────────────────┘
                       │ persist_to_workspace
                       ▼
┌──────────────────────────────────────────────────────┐
│              CircleCI (NEW jobs)                     │
│  4. upload-to-r2  (artifacts → Cloudflare R2)        │
│  5. notify-payload (POST to /api/releases)           │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼ (HTTPS, system token)
┌──────────────────────────────────────────────────────┐
│           Duka website (Payload + Next.js)           │
│  POST /api/releases  →  Release doc created          │
│  - majorVersion derived from semver                  │
│  - status='draft' until owner reviews                │
│  - downloadCount=0, installCount=0                   │
│                                                      │
│  Owner clicks "Publish" in /admin/collections/releases │
│  →  status='published'                               │
│  →  hook fires: emails maintained customers          │
│  →  /downloads page now shows v0.2.0                 │
│  →  /api/releases/latest now returns v0.2.0          │
└──────────────────────────────────────────────────────┘
                       ▲
                       │ Tauri updater poll
┌──────────────────────────────────────────────────────┐
│         Desktop installs (every 4h on startup)       │
│  GET /api/releases/latest?license=...&current=...    │
│   → returns { version, url, signature, must_upgrade }│
│  Tauri downloads + verifies signature + installs     │
└──────────────────────────────────────────────────────┘
```

The owner is in the loop **once** — the publish click. This is intentional: prevents accidental broken builds reaching customers. Set Settings global flag `flags.autoPublishReleases = true` to skip even that.

---

## 3. CLOUDFLARE R2 SETUP

Single bucket, public-read, lifecycle-controlled.

### 3.1 Bucket configuration

- Name: `duka-releases` (or whatever brand swap dictates — keep it generic)
- Region: WEUR or NAM (closest to Vercel edge — both fine for global CDN)
- Public access: enabled via R2 custom domain (NOT direct .r2.cloudflarestorage.com URL — bare-domain subdomain for clean URLs)
- Custom domain: `r2.sokoos.co.ke` (CNAME to `<bucket>.r2.cloudflarestorage.com`) — DNS in Cloudflare zone
- CORS: allow `GET, HEAD` from any origin (artifacts are downloaded by browsers + Tauri)
- Lifecycle: object age > 730 days → transitioned to infrequent-access. Old major version artifacts are NEVER deleted (we owe them to existing licence holders).

### 3.2 Object key layout

```
duka-releases/
├── stable/
│   ├── v0.1.6/
│   │   ├── Duka_0.1.6_x64-setup.exe
│   │   ├── Duka_0.1.6_x64-setup.exe.sig
│   │   ├── Duka_0.1.6_x64.msi
│   │   ├── Duka_0.1.6_x64.msi.sig
│   │   └── latest.json                  ← per-version snapshot
│   └── v0.2.0/
│       └── ...
├── beta/
│   └── v0.3.0-beta.1/
│       └── ...
└── latest.json                          ← rolling pointer to latest stable
```

`latest.json` at the bucket root is mirrored from the latest stable release every time `notify-payload` succeeds. Tauri updater hits **Payload's** `/api/releases/latest` endpoint (not the bucket directly) so we can do license-aware routing — but the file in R2 stays as fallback.

### 3.3 R2 IAM tokens

Three separate API tokens (distinct credentials, each minimum-privilege):

| Token | Used by | Permissions | Scope |
|---|---|---|---|
| `R2_CI_UPLOAD` | CircleCI `upload-to-r2` job | Object: `Read`, `Write`, `Delete (own)` | bucket: `duka-releases` |
| `R2_PAYLOAD_READ` | Payload server (signed URL gen) | Object: `Read` | bucket: `duka-releases` |
| `R2_PAYLOAD_MEDIA` | Payload media uploads (screenshots etc.) | Object: `Read`, `Write` | bucket: `duka-media` (separate bucket) |

Stored as encrypted env vars:
- CircleCI: project settings → Environment Variables (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`)
- Vercel: project env vars (`R2_PAYLOAD_*`)

**Never** commit any of these. The GitHub workflow file references them only by name.

---

## 4. NEW CIRCLECI JOBS

Append to existing `.circleci/config.yml`. Diff-style — show what's added.

### 4.1 `upload-to-r2` job

```yaml
jobs:
  # ... existing validate, build-windows, publish-release ...

  upload-to-r2:
    executor: linux
    steps:
      - checkout
      - attach_workspace:
          at: .

      - run:
          name: Install AWS CLI (R2 is S3-compatible)
          command: |
            curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
            unzip -q awscliv2.zip
            sudo ./aws/install
            aws --version

      - run:
          name: Resolve channel + tag
          command: |
            VERSION=${CIRCLE_TAG#v}
            if [[ "$CIRCLE_TAG" == *-* ]]; then
              CHANNEL="beta"
            else
              CHANNEL="stable"
            fi
            echo "export VERSION=$VERSION" >> $BASH_ENV
            echo "export CHANNEL=$CHANNEL" >> $BASH_ENV
            echo "Uploading to: $CHANNEL/$CIRCLE_TAG"

      - run:
          name: Upload artifacts to Cloudflare R2
          command: |
            source $BASH_ENV
            cd release-assets

            # Configure AWS CLI to talk to R2
            export AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
            export AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
            export AWS_DEFAULT_REGION=auto

            S3_PREFIX="s3://${R2_BUCKET}/${CHANNEL}/${CIRCLE_TAG}"

            for f in *.exe *.exe.sig *.msi *.msi.sig latest.json; do
              if [ -f "$f" ]; then
                aws s3 cp "$f" "$S3_PREFIX/$f" \
                  --endpoint-url "$R2_ENDPOINT" \
                  --no-progress \
                  --metadata "version=$VERSION,channel=$CHANNEL"
                echo "✓ uploaded $f"
              fi
            done

            # If this is a stable channel release, also update the rolling root pointer
            if [ "$CHANNEL" = "stable" ]; then
              aws s3 cp latest.json "s3://${R2_BUCKET}/latest.json" \
                --endpoint-url "$R2_ENDPOINT" \
                --no-progress
              echo "✓ updated rolling latest.json"
            fi

      - persist_to_workspace:
          root: .
          paths:
            - release-assets
```

### 4.2 `notify-payload` job

```yaml
  notify-payload:
    executor: linux
    steps:
      - checkout
      - attach_workspace:
          at: .

      - run:
          name: Resolve metadata
          command: |
            VERSION=${CIRCLE_TAG#v}
            MAJOR=$(echo "$VERSION" | cut -d. -f1)
            if [[ "$CIRCLE_TAG" == *-* ]]; then
              CHANNEL="beta"
            else
              CHANNEL="stable"
            fi
            echo "export VERSION=$VERSION" >> $BASH_ENV
            echo "export MAJOR=$MAJOR" >> $BASH_ENV
            echo "export CHANNEL=$CHANNEL" >> $BASH_ENV

      - run:
          name: Build CHANGELOG excerpt for this version
          command: |
            source $BASH_ENV

            # Pull section between "## [vX.Y.Z]" headers in CHANGELOG.md
            CHANGELOG_BODY=""
            if [ -f CHANGELOG.md ]; then
              CHANGELOG_BODY=$(awk -v v="$CIRCLE_TAG" '
                /^## \[/ {
                  if (in_section) exit;
                  if ($0 ~ "\\[" v "\\]") in_section=1
                }
                in_section { print }
              ' CHANGELOG.md)
            fi

            # Persist for next step
            echo "$CHANGELOG_BODY" > /tmp/changelog-body.txt

      - run:
          name: POST to Payload /api/releases
          command: |
            source $BASH_ENV
            cd release-assets

            CHANGELOG_BODY=$(cat /tmp/changelog-body.txt)

            # File sizes
            MSI_FILE=$(ls *.msi 2>/dev/null | head -1)
            NSIS_FILE=$(ls *.exe 2>/dev/null | head -1)
            MSI_SIZE=$(stat -c%s "$MSI_FILE" 2>/dev/null || echo 0)
            NSIS_SIZE=$(stat -c%s "$NSIS_FILE" 2>/dev/null || echo 0)
            MSI_SHA=$(sha256sum "$MSI_FILE" 2>/dev/null | cut -d' ' -f1 || echo "")
            NSIS_SHA=$(sha256sum "$NSIS_FILE" 2>/dev/null | cut -d' ' -f1 || echo "")

            # Read the updater signature for NSIS bundle
            NSIS_SIG=$(cat "${NSIS_FILE}.sig" 2>/dev/null || echo "")

            # URLs we just uploaded to
            BASE_URL="https://r2.sokoos.co.ke/${CHANNEL}/${CIRCLE_TAG}"

            JSON_PAYLOAD=$(jq -n \
              --arg version "$VERSION" \
              --argjson major "$MAJOR" \
              --arg channel "$CHANNEL" \
              --arg tag "$CIRCLE_TAG" \
              --arg msi_url "${BASE_URL}/${MSI_FILE}" \
              --arg nsis_url "${BASE_URL}/${NSIS_FILE}" \
              --argjson msi_size "$MSI_SIZE" \
              --argjson nsis_size "$NSIS_SIZE" \
              --arg msi_sha "$MSI_SHA" \
              --arg nsis_sha "$NSIS_SHA" \
              --arg signature "$NSIS_SIG" \
              --arg notes "$CHANGELOG_BODY" \
              '{
                version: $version,
                majorVersion: $major,
                channel: $channel,
                gitTag: $tag,
                status: "draft",
                windowsMsiUrl: $msi_url,
                windowsNsisUrl: $nsis_url,
                windowsMsiSize: $msi_size,
                windowsNsisSize: $nsis_size,
                sha256Msi: $msi_sha,
                sha256Nsis: $nsis_sha,
                updaterSignature: $signature,
                summary: "Auto-created from CI",
                changelog: { root: { children: [{ type: "paragraph", children: [{ text: $notes }] }] } }
              }')

            echo "$JSON_PAYLOAD" | jq .

            HTTP_CODE=$(curl -sS -o /tmp/response.json -w "%{http_code}" \
              -X POST "${PAYLOAD_URL}/api/releases" \
              -H "Content-Type: application/json" \
              -H "X-System-Token: ${PAYLOAD_SYSTEM_TOKEN}" \
              -d "$JSON_PAYLOAD")

            echo "HTTP $HTTP_CODE"
            cat /tmp/response.json

            if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "200" ]; then
              echo "ERROR: Payload rejected the release. See above."
              exit 1
            fi

      - run:
          name: Optional - publish immediately if autoPublishReleases is enabled
          command: |
            # Payload itself decides this based on the Settings global flag.
            # The earlier POST already passed; nothing to do here unless we
            # want to force-publish from CI even when the flag is off.
            echo "Publish flag handled server-side."

# Append to workflows.release.jobs:
workflows:
  release:
    jobs:
      - validate: { ... }
      - build-windows:
          requires: [validate]
          ...
      - publish-release:
          requires: [build-windows]
          ...
      # NEW
      - upload-to-r2:
          requires: [build-windows]
          context: [r2-credentials]   # CircleCI context with R2_* vars
          filters:
            tags:
              only: /^v\d+\.\d+\.\d+(-.*)?$/
            branches:
              ignore: /.*/
      - notify-payload:
          requires: [upload-to-r2]
          context: [payload-system]    # CircleCI context with PAYLOAD_URL + PAYLOAD_SYSTEM_TOKEN
          filters:
            tags:
              only: /^v\d+\.\d+\.\d+(-.*)?$/
            branches:
              ignore: /.*/
```

### 4.3 New CircleCI contexts (one-time setup)

In CircleCI org settings → Contexts:

| Context | Variables |
|---|---|
| `github-release` (existing) | `GITHUB_TOKEN` |
| `r2-credentials` (new) | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET` |
| `payload-system` (new) | `PAYLOAD_URL` (e.g. `https://sokoos.co.ke`), `PAYLOAD_SYSTEM_TOKEN` (long random secret) |

Restrict each context to project `justinelut/sokoOS` only.

---

## 5. PAYLOAD-SIDE: ENDPOINTS

### 5.1 `POST /api/releases` — system-only

Payload exposes the standard collection endpoint. We add a custom auth strategy: if `X-System-Token` header matches `process.env.PAYLOAD_SYSTEM_TOKEN`, request is authorized as a synthetic `system` user with create-only access to `Releases`.

```ts
// src/access/system.ts
import type { AccessArgs } from 'payload';
export const allowSystem = ({ req }: AccessArgs) =>
  req.headers.get('x-system-token') === process.env.PAYLOAD_SYSTEM_TOKEN;
```

```ts
// Releases collection access:
access: {
  read: ({ req: { user }, doc }) => /* existing */,
  create: ({ req }) => allowSystem({ req }) || req.user?.role === 'owner',
  update: ({ req }) => allowSystem({ req }) || req.user?.role === 'owner',
  delete: ownerOnly,
}
```

System token is rotated quarterly. Stored in Vercel env + CircleCI context.

### 5.2 `GET /api/releases/latest` — public, license-aware

Custom Payload endpoint. Replaces direct hit to GitHub `latest.json`.

```ts
// src/endpoints/releases-latest.ts
import type { Endpoint } from 'payload';

export const latestReleaseEndpoint: Endpoint = {
  path: '/releases/latest',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url);
    const licenseKey = url.searchParams.get('license');
    const currentVersion = url.searchParams.get('current');
    const channel = url.searchParams.get('channel') ?? 'stable';

    const payload = req.payload;

    // Resolve license if provided
    let majorCap = 0;
    let isPaid = false;
    let machineSeen = false;
    if (licenseKey) {
      const lic = await payload.find({
        collection: 'licenses',
        where: { licenseKey: { equals: licenseKey } },
        limit: 1,
      });
      if (lic.docs[0]) {
        majorCap = lic.docs[0].majorVersionCap ?? 0;
        isPaid = ['active'].includes(lic.docs[0].status);
        machineSeen = true;
      }
    }

    // Find latest published Release in channel
    const result = await payload.find({
      collection: 'releases',
      where: {
        and: [
          { status: { equals: 'published' } },
          { channel: { equals: channel } },
          ...(majorCap ? [{ majorVersion: { less_than_equal: majorCap } }] : []),
        ],
      },
      sort: '-publishedAt',
      limit: 1,
    });

    const r = result.docs[0];
    if (!r) {
      return Response.json({ error: 'No release available for this license tier' }, { status: 404 });
    }

    return Response.json({
      version: r.version,
      pub_date: r.publishedAt,
      notes: r.summary,
      platforms: {
        'windows-x86_64': {
          signature: r.updaterSignature,
          url: r.windowsNsisUrl,
        },
      },
      // Extra metadata for the desktop client
      must_upgrade: r.minMajorVersionToUpgrade > majorCap,
      requires_paid_license: r.requiresPaidLicense,
      caller_paid: isPaid,
    });
  },
};
```

Mounted in `payload.config.ts → endpoints: [latestReleaseEndpoint]`.

### 5.3 `POST /api/downloads/track`

Lightweight endpoint to bump `Release.downloadCount`. Public. Rate-limited per-IP via Vercel edge config (10/min). Used by the website's download button click handlers (NOT by Tauri — Tauri tracks via telemetry).

### 5.4 Auto-publish hook (optional)

If `Settings.flags.autoPublishReleases === true`, the `Releases.afterChange` hook on `create` immediately flips status to `published` and runs the notification email job. Default is off so the owner reviews each release.

---

## 6. TAURI UPDATER ENDPOINT

Switch from GitHub Releases to Payload.

### 6.1 `tauri.conf.json` change

```jsonc
{
  "productName": "Duka",                                         // ← changed
  "identifier": "ke.co.sokoos.duka",                             // ← changed
  "publisher": "Duka",                                           // ← changed
  "homepage": "https://sokoos.co.ke",
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://sokoos.co.ke/api/releases/latest?current={{current_version}}"
      ],
      "dialog": false,                                            // ← we drive UI ourselves
      "pubkey": "<unchanged>"
    }
  }
}
```

`dialog: false` because we want a custom in-app modal that handles license-locked upgrades gracefully (e.g. "v2.0 requires a paid major upgrade — buy now"). Tauri exposes events for this via the JS API.

### 6.2 Desktop-side updater check (Rust)

```rust
// src-tauri/src/updater.rs (new file)
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

pub async fn check_for_updates(app: tauri::AppHandle) -> tauri::Result<()> {
    // Pull license from local storage to send with request
    let license = crate::license::get_local_license_key().unwrap_or_default();
    let current = app.package_info().version.to_string();

    // Tauri updater plugin will hit our endpoint with the URL placeholders
    // we set in tauri.conf.json + we pass extra headers ourselves
    let updater = app.updater_builder()
        .header("X-License-Key", license)?
        .header("X-Current-Version", current)?
        .build()?;

    if let Some(update) = updater.check().await? {
        // Don't auto-download — emit event to JS for user choice
        app.emit("updater:available", &update.version)?;
    }
    Ok(())
}
```

Frontend listens for `updater:available` and shows a banner with "Install now / Remind me later". User clicks install → `update.download_and_install().await?`.

### 6.3 Updater check schedule

- On app start (after 60s, to not slow startup)
- Every 4 hours while app is running
- Manual trigger from Settings → "Check for updates"

---

## 7. ROLLBACK PROCEDURE

Sometimes a release breaks customers. Owner needs a quick undo.

### 7.1 Soft rollback (preferred)

In Payload admin → Releases → vX.Y.Z:
- Change `status` from `published` → `rolled_back`
- Fill `rolledBackAt`, `rolledBackReason`
- Save

Effect:
- `/api/releases/latest` skips this release; serves the previous published one
- `/downloads` page hides this version (or shows it with a "rolled back" badge in admin overrides — TBD)
- Customers running this version: a hook flags their machines for retro telemetry analysis. They keep working but don't get further updates of this version family until the issue's resolved.

### 7.2 Hard rollback

For severe issues (security, data corruption):
1. Mark the release as `rolled_back` (above).
2. Add an entry to a new `kill_list` array in Settings global. The next time affected machines call `/api/licenses/validate`, response includes `force_downgrade: true` with a target version. The desktop app then *prompts* the user to downgrade (we do not silently downgrade — too dangerous).
3. Email all customers running affected version with apology + instructions.

Preferred to never need 7.2. Prevention via:
- `requiresMigration` flag with extra QA gate
- Beta channel rollout to opt-in customers first

### 7.3 R2 retention

Even after rollback, the artifact stays in R2 forever. Customers who manually downloaded it can keep it. Their telemetry will show they're running it and we can reach out.

---

## 8. PROMOTING BETA TO STABLE

```
1. CI tags v0.3.0-beta.1   →  uploads to r2/beta/v0.3.0-beta.1/  →  Release doc, channel='beta', status='draft'
2. Owner publishes the beta in admin (status='published').
3. Beta customers (those who toggled "Get pre-releases" in dashboard profile) get auto-update.
4. After ≥7 days of stable telemetry from beta machines:
5. Owner clones the beta release in admin (button: "Promote to stable") → new doc, version='0.3.0', channel='stable', status='draft'
6. Owner publishes — now all customers see it.
```

The promote action is a custom admin field component that reads the beta doc, creates a stable doc with version stripped of pre-release suffix, copies all artifact URLs, and links the two via a `promoted_from` relationship.

---

## 9. SECURITY CONSIDERATIONS

- **Tauri signing key** (`updater.key`) — already in `keys/`. Encrypted via password. Password lives in CircleCI secrets only. **Never** in repo. Compromise = attacker can ship malicious update; rotation requires re-signing all extant artifacts and bumping the public key in `tauri.conf.json` (forces customers to re-install).
- **System token** (`PAYLOAD_SYSTEM_TOKEN`) — long random string (32+ bytes). Quarterly rotation. Compromise = attacker can create fake Release docs but cannot publish them (status stays draft until owner clicks). Cannot read other collections.
- **R2 token** — write-only to releases bucket. Compromise = attacker can upload binaries but they have no signature, so Tauri rejects them.
- **HTTPS everywhere** — `r2.sokoos.co.ke` has Cloudflare-managed cert; `sokoos.co.ke` Vercel cert.
- **Signature verification at install time** — Tauri does this automatically.
- **SHA-256 verification on `/downloads`** — UI shows the hash; user can verify pre-install.

---

## 10. TESTING THE PIPELINE

Before first real release, dry-run with `v0.0.0-test.1`:

1. Tag `v0.0.0-test.1` in a feature branch.
2. Push. Watch CircleCI:
   - validate ✓
   - build-windows ✓
   - publish-release → creates GitHub draft release
   - upload-to-r2 → check files appear in R2 console
   - notify-payload → check Payload admin for new draft Release doc
3. Inspect each output. Fix any issues.
4. Delete the GitHub release, R2 artifacts, and Payload draft. Re-tag with the real version.

The `v0.0.0-` prefix never matches the channel filter for stable, so it's safe.

---

## 11. WHAT'S NEXT

Plan 04 done. Next:
- **Plan 05** — Telemetry SDK in the Tauri Rust side (events, transport, opt-out, auth).
- **Plan 06** — Acceptance tests + Visual Bible per page + Performance/Deployment/Admin handoff.
