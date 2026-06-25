# Multi-licence + multi-module-per-machine — plan

A solo pharmacist who buys **Dawa + Retail** today gets "machine already bound to a different licence" the second time they try to activate. The Downloads page also says "You own Dawa" even when they own two licences. Both symptoms come from the same wrong assumption: **one machine ↔ one licence**.

What follows is the plan to fix it. No code yet. Confirm or push back, then I execute.

---

## 1. What the user is hitting today

### 1a. Downloads page (`/dashboard/downloads`)
Reads the user's licences, picks **one** variant ("the variant you own"), and renders that as a hint. With two licences it picks the first by `createdAt DESC` and ignores the second. The "Pro" row says "no .exe / no .msi" because Pro isn't owned, but the same fate hits any non-owned trade variant.

### 1b. Desktop activation
The Tauri app pastes a licence key, calls the website's activation endpoint. Server checks `machines.machine_id` against the DB. If the row exists with a `license_id` other than the one being activated, server returns `409 — machine already bound to a different licence`.

### 1c. Existing schema
We **do** already have an `activations` table from a much earlier phase. That table was designed as a join: one row per `machine_id × license_id × activated_at`. Look at `website/src/db/schema/activations.ts` + `src-tauri/migrations/009_license.sql` to confirm shape before we lean on it.

What we never built was the *write path* to that table from the activation flow, and the *read paths* that surface "all licences bound to this machine".

---

## 2. The intended model

A single Windows install of Omnix can hold **N active licences** at a time. Each licence unlocks a different *module bundle* — Dawa, Retail, Hospitality, Hardware, or Pro. The customer pastes additional licence keys at any point and the app adds them to the in-app entitlements without re-installing.

Constraints:

- **One licence per (machine_id, variant)** — you can't have two Dawa licences on the same machine.
- **One Pro licence on a machine excludes all trade variants** — Pro already covers them, no need to double-bind.
- **Trade variants compose** — Dawa + Retail + Hospitality is fine.
- **Per-machine cap** — each licence has its own `max_machines`; activations consume seats independently per licence.

The in-app sidebar shows every active module. Clicking switches the active workspace. The shift-close / POS / inventory data for each module lives in the same SQLite database (we already separate by `module_id` on most tables — see `008_insurance.sql`, `021_retail.sql` for examples).

---

## 3. What changes

### 3a. Database

**Verify first**: the existing `activations` table shape. It probably has `(id, license_id, machine_id, activated_at)`. Confirm it has no `UNIQUE` constraint that says "one row per machine".

**Migration 0003 (website Drizzle, additive):**
- Drop the `machines.license_id NOT NULL` constraint if it exists — machines can pre-exist without a single owning licence.
- Add `machines.primary_license_id text references licenses(id)` — for backward compat + "first machine to register" data.
- Ensure `activations.unique(license_id, machine_id)` so re-activating the same key on the same machine is idempotent.

**Migration 046 (desktop SQLite, additive):**
- New table `local_licenses(license_key text PK, variant text, modules jsonb, signed_key text, activated_at text, status text)`. Today the desktop reads a single licence from `settings.license_key`. We need to track many.
- Migrate the existing single `settings.license_key` into `local_licenses` on first run after upgrade.

### 3b. Activation API (`/api/licensing/activate`)

Today it does roughly:
```ts
const machine = await db.query.machines.findFirst({ machineId })
if (machine && machine.licenseId !== license.id) return 409
```

New shape:
```ts
const license = await loadLicense(licenseKey)
if (license.userId !== session.user.id) return 403
// Pro excludes trade variants and vice-versa, on the same machine.
const existing = await db.select().from(activations)
  .innerJoin(licenses, …)
  .where(eq(activations.machineId, machineId))
if (existing.some(e => isVariantConflict(e.license.variant, license.variant)))
  return 409 'incompatible module on this machine'
// Seat check on THIS licence (not the machine):
const seatsUsed = await db.select({ n: count() })
  .from(activations).where(eq(activations.licenseId, license.id))
if (seatsUsed[0].n >= license.maxMachines) return 402 'all seats taken'
// Upsert the activation row + register the machine.
await db.insert(activations).values({ licenseId, machineId, activatedAt: now })
  .onConflictDoNothing({ target: [activations.licenseId, activations.machineId] })
```

Variant-conflict rule:
- `pro` × `dawa | retail | hospitality | hardware` ⇒ conflict (Pro covers them)
- two of the same trade variant ⇒ conflict (same as today)
- two different trade variants ⇒ allowed
- two Pros ⇒ conflict (one Pro is enough)

### 3c. Desktop: in-app licence list + module switcher

The login + activation pages currently read the single key. We change to:
- On startup, read every row from `local_licenses`. Pick the most-recently-active variant as the `ACTIVE_MODULE`. Sidebar gets a switcher.
- "Add another licence" button on Settings → Licences runs the activation flow with the same `/api/licensing/activate` endpoint but for the new key. On success, insert into `local_licenses` and refresh.
- The variant-aware UI (POS card theming, license prefix in placeholders, etc.) already reads `ACTIVE_MODULE` at runtime — we just need to update it on switch.

This deliberately keeps the desktop **single-binary**. Today Dawa download is a different installer from Retail. With the new flow, the installer is one binary that knows how to render every module if you have the keys; the per-variant installers stay so the cold-install onboarding is still "download Dawa, get Dawa". But if you later buy Retail, you don't re-install — you paste the second key into Settings → Licences.

### 3d. Downloads page (`/dashboard/downloads`)

- Replace "You own Dawa" with "You own Dawa + Retail" (comma-list of distinct variants from `licenses` where status is active or trial).
- Add a "your licence" badge on **every** owned variant (today only on one).
- If the user owns Pro, hide the per-trade rows and just show the Pro row.
- "Earlier versions" list keeps as-is; cosmetic only.

### 3e. Dashboard licence list (`/dashboard/licenses`)

- Already lists all licences correctly; no change to the data query.
- Add per-licence "Activate on a new machine" link → opens the desktop deep link `omnix://activate?key=…` (we have this on Windows from earlier phases).

### 3f. Admin

`/admin/users/[id]` and `/admin/machines/[id]` already render via the new EntityHero + LazyTabs primitives. Add a "Licences activated" tab to the machine detail page that joins through `activations` so an admin can see "this machine runs Dawa + Retail keys".

---

## 4. What does NOT change

- Single-licence customers (the majority today) see exactly what they see now.
- Existing activated machines stay activated; the migration runs once and seeds the join table from `machines.license_id`.
- Pricing — every licence is still per-module. KES 30,000 trade / KES 150,000 Pro. The conflict rule just keeps people honest (you can't buy both Pro AND a trade — buy one).
- Cloud backup, eTIMS sign-on, payroll — all carry over identically; they're per-business not per-licence.

---

## 4a. Server-side guarantees (the "no-funny-business" rules)

Every activation request is gated by these checks, in this order. If any fails, the activation is rejected with a clear error code so the desktop knows whether to prompt the user, retry later, or give up.

| # | Rule | Failure code |
|---|---|---|
| 1 | The key exists in our `licenses` table. | `404 unknown_key` |
| 2 | The signed-in user **owns** the key (`license.userId === session.user.id`). | `403 not_your_key` |
| 3 | The key isn't already activated on a **different user's** machine. | `409 cross_user_conflict` |
| 4 | The machine fingerprint isn't already claimed by **another user**. | `409 machine_owned_by_another_user` |
| 5 | The user doesn't already own a different active key with the **same variant** (one Dawa per user, one Retail per user, etc.). | `409 duplicate_variant` |
| 6 | The variant doesn't conflict with what's already on the machine (Pro vs trade). | `409 variant_conflict_on_machine` |
| 7 | The licence has seats left (`activations.count() < license.max_machines`). | `402 seat_exhausted` |

Rule 5 is enforced at **issue time** too. The buy-flow refuses to mint a second Dawa key for an account that already owns one — it shows "you already have Omnix Dawa, would you like to upgrade to Pro?" instead.

---

## 4b. Local-first sync — bridging the Payload→Better Auth migration gap

The big risk this addresses: **a customer bought a key under the Payload regime, has it activated locally, and the row no longer exists in our Neon DB** (because the migration didn't copy that licence over). Today they get "machine already bound to a different licence" because the local DB has a key the server doesn't recognise.

We fix this with a one-off **bootstrap sync** that runs every time the desktop signs in, before the regular activation check.

### Flow

```
desktop start
  ↓
read local_licenses (every key the user has locally)
  ↓
POST /api/licensing/sync { keys: [k1, k2, …], machineId, machineFingerprint }
  ↓
for each key:
  case 1: key exists in DB + owned by current user
          → mark as VERIFIED. nothing to do.
  case 2: key exists in DB + owned by DIFFERENT user
          → mark as FOREIGN. server returns "remove this key — it belongs
            to another account". Desktop hard-deletes it from local_licenses
            on confirmation. Audit-logged.
  case 3: key doesn't exist in DB at all
          → check if it's an RSA-signed legacy Payload key (the existing
            license-validation logic in src-tauri/src/licensing/ already
            does this offline-RSA verify).
          → if valid signature + matches the current user's email in the
            signed payload → CREATE the licence row server-side with
            origin = 'payload_migrated', auto-bind to the current user,
            return as VERIFIED.
          → otherwise mark as ORPHAN. Don't auto-delete; surface in
            Settings → Licences as "this key isn't on your account —
            contact support@omnix.co.ke" so the user has a paper trail.
  case 4: key exists in DB + owned by current user + activated on a
          DIFFERENT machine that exceeds max_machines
          → mark as SEAT_TAKEN. Desktop shows "release seat on the old
            machine first" via dashboard.
```

Return shape:

```ts
{
  ok: true,
  results: [
    { key: 'OMNIX-DAWA-…', status: 'verified', license: {…} },
    { key: 'OMNIX-PRO-…',  status: 'foreign', message: '…' },
    { key: 'OMNIX-RETAIL-…', status: 'orphan_payload', recoveryHint: '…' },
  ]
}
```

After sync, the **activation** flow can proceed with confidence — every key in `local_licenses` has a known server-side state.

### What this gets you

1. **Customer who can't open the app** (your current state): when v0.11 ships, on first launch after sign-in, sync runs, the Payload-era key is either auto-claimed (if RSA-signed and ownership-matches) or flagged. App opens with the right entitlements.
2. **Customer who flushed their machine**: nothing in `local_licenses`, sync is a no-op, activation works as normal because the keys are in the cloud dashboard.
3. **Stolen / shared key attempted on another account**: rule 2 + 3 catch it. Foreign keys never get used. Audit log records the attempt.

### Schema additions

```
ALTER TABLE licenses ADD COLUMN origin TEXT DEFAULT 'paystack';
-- 'paystack' = normal Paystack-paid checkout (default)
-- 'payload_migrated' = recreated by sync from a legacy local key
-- 'admin_issued' = manually created via /admin/licenses

CREATE TABLE license_sync_log (
  id text PRIMARY KEY,
  user_id text REFERENCES "user"(id),
  machine_id text,
  key text,
  status text,                -- verified | foreign | orphan_payload | seat_taken | recreated
  created_at timestamp DEFAULT now()
);
```

### Edge cases I'm flagging now

- **Two users sharing one machine** — rule 4 says no. The first user's keys claim the machine; the second can't activate. The fix is "deactivate the machine in the first user's dashboard, then activate under the second user". UI in Settings → Licences supports this.
- **User changes email** — Better Auth's email-change flow already triggers a session refresh. Activations stay because they're keyed on `userId`, not `email`. Sync will reverify on next start.
- **User signs out and back in as a different account** — the first thing sync does on the new session is run rule 2 across every local key. Foreign keys get flagged immediately. User gets a clear "this is account X's machine; sign in as X to use these keys".

---

## 5. Order of operations

1. Inspect actual schema of `activations` (Drizzle + desktop migration). Confirm + correct above assumptions.
2. Website migration 0003 (additive): `activations.unique(license_id, machine_id)`, `licenses.origin TEXT DEFAULT 'paystack'`, `license_sync_log`, drop `machines.license_id NOT NULL`, add `primary_license_id`.
3. Desktop migration 046 (`local_licenses` table + back-fill from existing `settings.license_key`).
4. Build `POST /api/licensing/sync` route: applies the four-case logic from §4b, writes `license_sync_log`, returns per-key status. Bootstrap-token-protected for now; flip to session-only after sign-in flow ships.
5. Rewrite `/api/licensing/activate` with the seven gates from §4a. Behind a `purchasing.multi_license_v2` feature flag so we can flip back if production hits a regression.
6. Desktop: on every sign-in, run sync **before** anything else. UI shows a one-shot "Reconnecting your licences…" toast while it runs. Result populates `local_licenses` with verified server-truth.
7. Desktop activation flow: `local_licenses` insert on success, sidebar module switcher, "Add another licence" entry point in Settings → Licences.
8. Downloads page rewrite: list all owned variants.
9. Tests:
   - `tests/sync-licenses.spec.ts` — every status branch in §4b (verified / foreign / orphan / seat-taken / recreated).
   - `tests/activation-gates.spec.ts` — every failure code in §4a table.
   - `tests/owned-variants.spec.ts` — pure helper that returns the dedup'd owned list from `licenses[]`.
10. Bump v0.11.0 (feature drop, not a patch).

---

## 6. Risk + rollout

- The `/api/licensing/activate` rewrite is the only path that could break existing customers. Add a feature flag `purchasing.multi_license_v2` defaulted to **off** until we've verified on production. Behind the flag, we run the old single-licence path. Once we're happy, flip on.
- The desktop migration is additive and idempotent — copying the single key into `local_licenses` is safe to re-run.
- Downloads page change is cosmetic; ship it independently of the desktop changes.

---

## 7. What I'd like you to confirm

1. Variant conflict rule above — is it correct? *(Pro excludes trades; trades compose.)*
2. UX expectation on the **switcher**: in-app sidebar dropdown? Or full window restart on switch?
3. **Re-using existing keys**: if a customer has a Dawa key on machine A and tries the same key on machine B, do you want it to consume the second seat from `max_machines` automatically, or do you want them to explicitly "release seat A → activate seat B"?
4. Anything that should NOT auto-migrate from old data — e.g. an old machine bound to a key that no longer exists.

Once we agree on 1–4 I execute in the order in section 5.
