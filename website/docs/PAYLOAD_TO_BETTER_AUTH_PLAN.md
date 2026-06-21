# Payload CMS → Better Auth + Drizzle migration plan

Status: **proposal — not yet started**.
Authored: 2026-06-21.
Cycle target: v0.8.2 → v0.8.10 → v0.9.0 cycle bump.
Scope: website only (`/website`). Desktop app is unaffected.

---

## 0 · Why

Payload is doing too many jobs in this codebase: auth, admin UI, ORM, CMS, REST endpoint factory, and email. Each job is a half-fit, and the seams between them are where bugs live (the `/api/customers/logout` 403, the auth pages crashing, Tailwind getting clobbered by Payload's own root layout, GraphQL routes leaking into the localised app).

Better Auth is a single-purpose library that does auth properly: sign-in / sign-up / sessions / verification / password reset / RBAC / orgs / teams / impersonation / ban / 2FA. It exposes plain HTTP under `/api/auth/*` and a typed `auth.api.*` server interface for RSCs. Drizzle is the ORM for everything else. Postgres stays the database. The current Vercel Postgres / Neon connection works without change.

The split: **Better Auth owns identity. Drizzle owns business data. Static config owns CMS content that changes < weekly. Markdown + frontmatter owns blog posts and changelog entries.**

---

## 1 · Current state inventory

### 1.1 Payload collections (14)

| Collection | Rows ~ | Used for | Migration target |
| --- | --- | --- | --- |
| `Users` | <10 | Payload admins (login at `/admin`) | Better Auth `user` + `admin` plugin role |
| `Customers` | live customers | website auth (`/login`, `/signup`, dashboard) | Better Auth `user` (auth) + Drizzle `customer_profile` (extra fields) |
| `Licenses` | live | issued device licences | Drizzle `licenses` |
| `Machines` | live | registered devices | Drizzle `machines` |
| `Activations` | log | activation events | Drizzle `activations` |
| `Releases` | manifest | desktop release entries | Drizzle `releases` (or static JSON checked into git, since releases are slow-moving and CI-driven) |
| `TelemetryEvents` | high-volume | heartbeat data | Drizzle `telemetry_events` (TTL job stays) |
| `Payments` | live | Paystack payment rows | Drizzle `payments` |
| `SupportTickets` | live | tickets + threaded messages | Drizzle `support_tickets` + `support_messages` |
| `Pages` | content | generic CMS pages | **delete** — replace with markdown in `content/pages/` |
| `BlogPosts` | content | blog | **delete** — replace with markdown in `content/blog/` |
| `Modules` | content | module info | **delete** — static config in `src/config/modules.ts` |
| `Media` | uploads | image uploads | **keep storage in S3 directly**; expose via signed URLs from Drizzle `media` table (no admin upload UI required for v0.9 — admins can upload to S3 directly via console or `aws s3 cp`) |
| `CloudBackups` | live | encrypted backup blobs | Drizzle `cloud_backups` |

### 1.2 Payload globals (7)

| Global | Migration target |
| --- | --- |
| `Settings` (sitewide) | `src/config/site.ts` (typed config, checked in) |
| `Pricing` (per-currency tiers) | `src/config/pricing.ts` |
| `LandingPage` | `src/config/landing.ts` |
| `HomeContent` | `src/config/home.ts` |
| `ContactContent` | `src/config/contact.ts` |
| `FooterContent` | `src/config/footer.ts` |
| `TradeLandings` (per-vertical) | `src/config/trade-landings.ts` |

The user has been editing these globals through Payload admin so far. After migration, edits become PRs. This is acceptable because:
- Pricing changes ~once a quarter (not per-week).
- Landing copy changes during marketing pushes (1–2× a month) and goes through review anyway.
- Trade landings are vertical pitches that rarely change once written.

If a per-tenant editable global ever becomes necessary, we can add a thin `site_config` Drizzle table with a JSON blob and a tiny custom editor inside the new admin dashboard. Out of scope for v0.9.

### 1.3 Files using Payload (77 total)

Grouped by category:

- **Auth pages** (`src/app/(auth)/*`): 4 files — login, signup, forgot-password, verify-email.
- **Dashboard pages** (`src/app/(dashboard)/*`): 11 files — overview + 6 subpages.
- **API endpoints** (`src/endpoints/*`): 17 files — paystack, licenses, telemetry, support, cloud-backups, downloads, releases.
- **Cron jobs** (`src/app/api/cron/*`): 2 files — daily reconcile + telemetry retention.
- **Marketing pages** (`src/app/[locale]/(frontend)/*`): 6 files — homepage, pricing, downloads, contact, changelog, variant landings.
- **Lib helpers**: `paystack.ts`, `dashboard-helpers.ts`, `site-settings.ts`, `buy-resolver.ts`, `settings.ts` — 5 files.
- **Payload glue**: `payload.config.ts`, `endpoints/index.ts`, `endpoints/_auth.ts`, `(payload)/admin/*`, `(payload)/api/*`, `migrations/*` — 30+ files. **All deleted at the end.**

### 1.4 Database

- Provider: Vercel Postgres / Neon (already running)
- Existing schema: managed by Payload migrations (`src/migrations/*.ts`)
- Connection: `vercelPostgresAdapter` from `@payloadcms/db-vercel-postgres` (uses `POSTGRES_URL` env var)

### 1.5 Email

- Provider: Resend (`@payloadcms/email-resend` — wraps the same Resend API key)
- Used for: customer email verification, password reset, support replies, signup confirmations
- After migration: Resend SDK called directly; Better Auth's `sendVerificationEmail` and `sendResetPassword` callbacks invoke it.

---

## 2 · Target architecture

### 2.1 Better Auth instance (`src/lib/auth.ts`)

The website is **passwordless**. There is no email+password sign-in form anywhere on omnix.co.ke. The only password in the entire system lives in the desktop app's local SQLite, hashed with Argon2id, and is never sent to the cloud. The website's job is billing, staff management, and *resetting that desktop password* — never as a daily login surface.

Plugins, in this order (order matters — `nextCookies` MUST be last):

```ts
betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // ── Email + password — DISABLED ─────────────────────────
  // The website has no password sign-in. Daily auth lives on the desktop
  // (local Argon2 hash in SQLite). Removing emailAndPassword from Better
  // Auth eliminates the entire credential-account code path and the
  // associated attack surface (credential stuffing, breach correlation,
  // password reuse across sites). The /reset/desktop flow that resets
  // the desktop password is implemented separately as a custom magic-link
  // flow (see §13) — Better Auth's resetPassword is not used because
  // there is no website password to reset.
  emailAndPassword: { enabled: false },

  // ── Google OAuth (one-tap) ──────────────────────────────
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      mapProfileToUser: (profile) => ({
        emailVerified: profile.email_verified ?? false,
        name: profile.name,
        image: profile.picture,
      }),
    },
  },
  account: {
    accountLinking: {
      // Auto-link Google to existing email-only users on first sign-in.
      // Trusted because Google verifies the email server-side.
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  user: {
    additionalFields: {
      phoneNumber:   { type: 'string', required: false },
      businessName:  { type: 'string', required: false },
      country:       { type: 'string', required: false, defaultValue: 'KE' },
      currency:      { type: 'string', required: false, defaultValue: 'KES' },
      staffTeam:     { type: 'string', required: false },  // 'support' | 'sales' | 'eng' | null
    },
  },

  plugins: [
    // ── Magic link (the only email-based sign-in) ───────────
    // The user pastes their email, gets a 15-minute link, clicks → signed in.
    // No password, no verification step (the link IS the verification).
    magicLink({
      sendMagicLink: async ({ email, url }) => sendMagicLinkEmail({ to: email, url }),
      expiresIn: 60 * 15,                  // 15 minutes
    }),

    organization({
      teams: { enabled: true, maximumTeams: 5 },
      sendInvitationEmail: async (data) => sendInviteEmail(data),
      requireEmailVerificationOnInvitation: false,  // Magic-link inherently verifies
      ac, roles: { owner, admin, member },
    }),
    admin({
      adminRoles: ['platform_admin'],
      ac: platformAc,
      roles: { platform_admin, support_agent, sales_rep },
      defaultRole: 'user',
      impersonationSessionDuration: 60 * 60,
    }),
    nextCookies(),                          // LAST
  ],
})
```

There is no `sendResetPassword` callback because Better Auth's resetPassword is never invoked (no password to reset). There is no `/forgot-password` page on the website. The desktop-password-reset flow at `/reset/desktop` is a distinct custom feature — see §13.

### 2.2 Auth surface separation (the load-bearing diagram)

Two surfaces, two auth modalities, one shared identity (the email address):

```
┌─────────────────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  DESKTOP  /  the till                           │  │  WEBSITE  /  omnix.co.ke           │
│                                                 │  │                                     │
│  Password (Argon2id local)    ← daily auth      │  │  Magic link    ← daily auth        │
│  Recovery phrase (BIP39)      ← lockout fallback│  │  Google OAuth  ← daily auth        │
│  Email (mandatory)            ← reset bridge    │  │  Email         ← identity anchor    │
│                                                 │  │                                     │
│  Used: every shift, every login                 │  │  Used: rarely (billing, staff mgmt) │
│  Network: not required                          │  │  Network: required (it's a website) │
└─────────────────────────────────────────────────┘  └─────────────────────────────────────┘

           ↑                                                          ↑
           │                                                          │
           │  ────── ONE bridge: /reset/desktop ────────┐              │
           │                                            ↓              │
           │  Cashier types email + licence number on phone, gets magic link in email,
           │  clicks link → website page asks for new desktop password → cloud queues
           │  the new Argon2 hash → till pulls on next heartbeat (30s) and applies.
           │                                                                │
           │  No website session is created during this flow. The cashier is
           │  not "logged in" to omnix.co.ke when they finish. They go back
           │  to the till and log in there with the new password.
           └────────────────────────────────────────────────────────────┘
```

**What lives where**:

| Concept | Desktop | Website |
| --- | --- | --- |
| Daily user identity (cashier, manager, admin) | local SQLite `users` table, mirrored read-only on cloud `desktop_users` | n/a (cashiers don't have website accounts) |
| Daily auth credential | Argon2id password hash (local only — never sent to cloud) | Google account OR magic-link to email |
| Lockout fallback | BIP39 recovery phrase (local + cloud hash) | n/a (just request another magic link) |
| Owner identity | local SQLite `users` row (role=owner) | Better Auth `user` row + `account` row (Google or no-account-row for magic-link users) |
| Linking the two for an owner | shared email address | shared email address |
| Platform admin (visualoop staff) | n/a (visualoop staff don't operate tills) | Better Auth `user` with `role=platform_admin` |

**Who has a website account**:

- ✅ Owners — always (so they can manage billing, staff, support tickets)
- ⚠️ Org members (chain managers, accountant, supplier-rep): optional. Created on owner-invite. They get a Better Auth account so they can access /dashboard for the org's data.
- ❌ Cashiers — typically do NOT need a website account. They use the till exclusively. They only touch the website to reset their desktop password (which is a public flow — no website account required).
- ✅ Platform admins (Omnix staff) — always.

**What the website pages look like** (post-migration):

- `/login` — exactly two surfaces: a "Sign in with Google" button + a "Sign in with email" form. The email form sends a magic link. NO password field.
- `/signup` — same UI as /login. Magic-link sign-up and sign-in are the same operation.
- `/reset/desktop` — public form: email + licence number → triggers magic link → set new desktop password
- No `/forgot-password` page (there's no website password to forget)
- No `/verify-email` page (magic link IS the verification; Google's `email_verified` is trusted)

### 2.3 Drizzle setup

```
src/db/
  index.ts                # drizzle({ client: pg }) — exports `db`
  schema/
    auth.ts               # better-auth tables (user, session, account, verification, ...)
    org.ts                # organization, member, invitation, team, teamMember (better-auth org plugin)
    domain/
      machines.ts         # registered devices
      licenses.ts         # issued licences
      activations.ts      # activation log
      payments.ts         # paystack payment rows
      support.ts          # tickets + messages
      cloud_backups.ts    # encrypted backup metadata
      releases.ts         # release manifest
      telemetry.ts        # heartbeat events (high-volume; partition by day)
      audit_log.ts        # audit trail across the system
      customer_profile.ts # extra customer fields beyond what better-auth stores
    index.ts              # re-exports everything
```

Drizzle schema files are owned by us; better-auth schema is generated via `npx auth@latest generate` and committed to `src/db/schema/auth.ts`. Migrations are emitted via `drizzle-kit generate` and applied on deploy via a deploy hook (no Payload migration runner anymore).

**Connection driver**: Neon Postgres over HTTPS (current setup). We use `@neondatabase/serverless` + `drizzle-orm/neon-http`. The existing `lib/neon-proxy.ts` patches stay as-is.

### 2.4 Access control statements

```ts
// src/lib/permissions/org.ts — per-org permissions
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements as orgDefaults, adminAc as orgAdminAc, memberAc as orgMemberAc, ownerAc as orgOwnerAc } from 'better-auth/plugins/organization/access'

const statement = {
  ...orgDefaults,
  machine:  ['list', 'register', 'rebind', 'delete'],
  license:  ['list', 'issue', 'rebind', 'transfer', 'cancel'],
  payment:  ['list', 'refund'],
  ticket:   ['list', 'create', 'reply', 'close'],
  backup:   ['list', 'restore', 'delete'],
} as const

export const ac = createAccessControl(statement)
export const owner  = ac.newRole({ ...orgOwnerAc.statements,  machine: ['list','register','rebind','delete'], license: ['list','issue','rebind','transfer','cancel'], payment: ['list','refund'], ticket: ['list','create','reply','close'], backup: ['list','restore','delete'] })
export const admin  = ac.newRole({ ...orgAdminAc.statements,  machine: ['list','register','rebind'],          license: ['list','issue','rebind'],                 payment: ['list'],          ticket: ['list','create','reply'],         backup: ['list','restore'] })
export const member = ac.newRole({ ...orgMemberAc.statements, machine: ['list'],                              license: ['list'],                                  payment: ['list'],          ticket: ['list','create'],                  backup: ['list'] })
```

```ts
// src/lib/permissions/platform.ts — platform-wide permissions for staff
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements as adminDefaults, adminAc as platAdminAc } from 'better-auth/plugins/admin/access'

const statement = {
  ...adminDefaults,
  release:  ['publish', 'rollback'],
  customer: ['view', 'edit', 'delete'],
  org:      ['view', 'edit', 'delete'],
  payment:  ['view', 'refund'],
  ticket:   ['view', 'reply', 'close', 'reassign'],
} as const

export const platformAc = createAccessControl(statement)
export const platform_admin  = platformAc.newRole({ ...platAdminAc.statements, release: ['publish','rollback'], customer: ['view','edit','delete'], org: ['view','edit','delete'], payment: ['view','refund'], ticket: ['view','reply','close','reassign'] })
export const support_agent   = platformAc.newRole({ user: ['list','get'], customer: ['view','edit'], ticket: ['view','reply','close','reassign'] })
export const sales_rep       = platformAc.newRole({ user: ['list','get'], customer: ['view'], payment: ['view'], release: [] })
```

### 2.5 SSR patterns

Three rules.

**Rule 1 — Server components fetch session directly through `auth.api.getSession`.** No HTTP roundtrip, no fetch-from-self-cookie hack.

```ts
// app/(dashboard)/dashboard/page.tsx
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')
  // session.user.id available; pass to Drizzle queries
  const machines = await db.query.machines.findMany({ where: eq(machines.userId, session.user.id) })
  return <DashboardShell machines={machines} session={session} />
}
```

**Rule 2 — Server actions use `auth.api.signInMagicLink` or the Google OAuth callback.** With the `nextCookies()` plugin, Set-Cookie headers auto-forward through Next's cookie store. There is no `signInEmail` because there is no password.

```ts
'use server'
import { auth } from '@/lib/auth'

export async function requestMagicLinkAction(formData: FormData) {
  await auth.api.signInMagicLink({
    body: { email: formData.get('email')! as string, callbackURL: '/dashboard' },
  })
  return { ok: true }   // Page shows: "Check your email for a sign-in link."
}
```

The corresponding client-side form lives in `/login/page.tsx` and posts to this action.

**Rule 3 — Middleware (now `proxy.ts` per Next.js 16) uses cookie-only checks for redirects.** No DB calls in middleware. Full session validation happens in the page itself.

```ts
// proxy.ts (was middleware.ts)
import { getSessionCookie } from 'better-auth/cookies'

export async function proxy(req: NextRequest) {
  const cookie = getSessionCookie(req)
  if (!cookie && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] }
```

The current geo-redirect code stays exactly as-is in middleware.

### 2.6 Email infrastructure

Single helper module `src/lib/email.ts`:

```ts
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendVerifyEmail({ to, url }: { to: string; url: string }) { ... }
export async function sendResetEmail({ to, url }: { to: string; url: string }) { ... }
export async function sendInviteEmail(data: InviteData) { ... }
export async function sendSupportReplyEmail({ to, ticket, message }: ReplyData) { ... }
export async function sendPaymentReceiptEmail({ to, receipt }: ReceiptData) { ... }
```

Uses React Email templates (`@react-email/components`) for the bodies. Replaces `@payloadcms/email-resend`.

---

## 3 · Drizzle schema (table by table)

### 3.1 Better Auth core (auto-generated by `npx auth@latest generate`)

```ts
// src/db/schema/auth.ts
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // Admin plugin
  role: text('role').notNull().default('user'),
  banned: boolean('banned').notNull().default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),

  // Custom additionalFields
  phoneNumber: text('phone_number'),
  businessName: text('business_name'),
  country: text('country').notNull().default('KE'),
  currency: text('currency').notNull().default('KES'),
  staffTeam: text('staff_team'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'),
  activeTeamId: text('active_team_id'),
  impersonatedBy: text('impersonated_by').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', { /* better-auth credentials + social */ })
export const verification = pgTable('verification', { /* email/reset tokens */ })
```

### 3.2 Better Auth organization plugin (auto-generated)

`organization`, `member`, `invitation`, `team`, `teamMember`, `organizationRole` (if dynamic AC enabled).

### 3.3 Domain tables (hand-written by us)

```ts
// machines.ts
export const machines = pgTable('machines', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => organization.id),
  fingerprint: text('fingerprint').notNull(),               // RSA-signed device fingerprint
  hostname: text('hostname'),
  os: text('os'),
  cpu: text('cpu'),
  ramMb: integer('ram_mb'),
  status: text('status').notNull().default('active'),       // active | revoked | rebinding
  lastSeenAt: timestamp('last_seen_at'),
  registeredAt: timestamp('registered_at').notNull().defaultNow(),
  // ... mirrors current Payload Machines collection
}, (t) => ({
  fingerprintIdx: uniqueIndex('machines_fingerprint_idx').on(t.fingerprint),
  userIdx: index('machines_user_idx').on(t.userId),
  orgIdx: index('machines_org_idx').on(t.organizationId),
}))

// licenses.ts
export const licenses = pgTable('licenses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => organization.id),
  machineId: text('machine_id').references(() => machines.id),
  variant: text('variant').notNull(),                       // dawa | retail | hardware | hospitality | core
  tier: text('tier').notNull().default('standard'),
  modules: jsonb('modules').notNull().default('[]'),        // entitlement flags
  signedKey: text('signed_key').notNull(),                  // RSA-signed payload
  status: text('status').notNull().default('active'),       // active | suspended | rebinding | revoked
  trialEndsAt: timestamp('trial_ends_at'),
  complianceUntil: timestamp('compliance_until'),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at'),
}, (t) => ({
  userIdx: index('licenses_user_idx').on(t.userId),
  machineIdx: index('licenses_machine_idx').on(t.machineId),
}))

// activations.ts
export const activations = pgTable('activations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  licenseId: text('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  machineId: text('machine_id').notNull().references(() => machines.id),
  outcome: text('outcome').notNull(),                       // ok | fingerprint_mismatch | revoked | trial_expired
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// payments.ts
export const payments = pgTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => organization.id),
  licenseId: text('license_id').references(() => licenses.id),
  paystackReference: text('paystack_reference').notNull().unique(),
  amount: integer('amount').notNull(),                      // in smallest currency unit
  currency: text('currency').notNull(),
  status: text('status').notNull(),                         // pending | success | failed | reversed
  paidAt: timestamp('paid_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userIdx: index('payments_user_idx').on(t.userId),
  refIdx: uniqueIndex('payments_ref_idx').on(t.paystackReference),
}))

// support_tickets.ts + support_messages.ts (split for clean joins)
export const supportTickets = pgTable('support_tickets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => user.id),
  assignedTo: text('assigned_to').references(() => user.id),
  subject: text('subject').notNull(),
  category: text('category').notNull(),
  priority: text('priority').notNull().default('normal'),
  status: text('status').notNull().default('open'),         // open | pending | resolved | closed
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const supportMessages = pgTable('support_messages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  ticketId: text('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => user.id),
  body: text('body').notNull(),
  attachments: jsonb('attachments').default('[]'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// cloud_backups.ts
export const cloudBackups = pgTable('cloud_backups', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  machineId: text('machine_id').notNull().references(() => machines.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id),
  s3Key: text('s3_key').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  encryptedSha256: text('encrypted_sha256').notNull(),
  takenAt: timestamp('taken_at').notNull(),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
})

// releases.ts (could also be static JSON if desired)
export const releases = pgTable('releases', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  version: text('version').notNull().unique(),              // semver
  channel: text('channel').notNull().default('stable'),     // stable | beta | nightly
  publishedAt: timestamp('published_at').notNull().defaultNow(),
  notes: text('notes'),
  msiUrl: text('msi_url'),
  exeUrl: text('exe_url'),
  dmgUrl: text('dmg_url'),
  appImageUrl: text('app_image_url'),
  signature: text('signature'),                              // tauri-updater signature
})

// telemetry_events.ts (high-volume, partition-friendly)
export const telemetryEvents = pgTable('telemetry_events', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  machineId: text('machine_id').notNull().references(() => machines.id),
  kind: text('kind').notNull(),                              // heartbeat | crash | error | event
  occurredAt: timestamp('occurred_at').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  machineIdx: index('telemetry_machine_idx').on(t.machineId),
  occurredIdx: index('telemetry_occurred_idx').on(t.occurredAt),
}))

// audit_log.ts — system-wide audit
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  actorId: text('actor_id').references(() => user.id),
  action: text('action').notNull(),                          // 'license.issue', 'user.ban', etc.
  resource: text('resource'),                                // 'license:abc123'
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

Relations declared via `relations()` so Better Auth's experimental joins (3× faster `getSession`) light up automatically.

---

## 4 · Migration phases — ship-each-phase strategy

Two cycles. The Payload removal lives in v0.8.x. Desktop ↔ cloud user sync (the part that lets a cashier reset their till password from a phone) lives in v0.9.x as a separate cycle that builds on the auth foundation. Each phase ships independently. No big-bang.

### v0.8.2 — Better Auth + Drizzle scaffolding (no traffic switch)

- Install `better-auth`, `@better-auth/drizzle-adapter`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `@react-email/components`. Resend already there.
- Create `src/db/index.ts` (drizzle client) + `src/db/schema/*` (auth core + every domain table).
- Create `src/lib/auth.ts` with **email+password + Google OAuth + magic link + organization + admin + nextCookies** plugins. Do NOT mount the route handler yet.
- Create `src/lib/auth-client.ts` (client-side, with `magicLinkClient`, `organizationClient`, `adminClient`).
- Create `src/lib/permissions/org.ts` and `src/lib/permissions/platform.ts`.
- Create `src/lib/email.ts` with `sendVerifyEmail`, `sendResetEmail`, `sendMagicLinkEmail`, `sendInviteEmail`, `sendPaymentReceiptEmail`, `sendSupportReplyEmail`.
- Run `drizzle-kit generate` → produces migration that adds Better Auth tables alongside Payload tables. Apply on deploy.
- New env vars on Vercel: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. The Google OAuth app is registered with redirect URIs `https://omnix.co.ke/api/auth/callback/google` (prod) + `http://localhost:3000/api/auth/callback/google` (dev).

**At end of phase:** new tables exist, Payload still serves all traffic, no route changes, no user-facing UI.
**Risk:** zero — additive only.
**Verify:** tsc clean, build clean, all 156 tests still pass.

### v0.8.3 — Auth route swap with two passwordless modalities

- Mount `/api/auth/[...all]/route.ts` with `toNextJsHandler(auth)`.
- Rewrite the auth pages with two sign-in surfaces side-by-side:
  - **Primary**: `/login` shows Google one-tap + magic-link form. NO password field.
  - `/signup` is identical to `/login` (magic-link sign-up and sign-in are the same operation; new emails create new users transparently).
  - **Delete**: `/forgot-password` and `/verify-email/[token]` go away — there is no website password to forget, and magic-link IS the verification.
  - **NEW**: `/reset/desktop` — public form for the desktop password reset flow (see §13). Distinct from any Better Auth flow.
- One-shot data migration script `scripts/migrate-customers-to-auth.ts`:
  - Read Payload `customers`, insert into Better Auth `user` table (with `emailVerified=true` since they've already verified their email under Payload).
  - **Do NOT migrate passwords.** There is no website password storage in the new architecture. The legacy PBKDF2 hashes on Payload's `customers` table are dropped during the migration. No dual-hash window. No rehash dance.
  - Map `customer_profile` extra fields (phone, business name, country, currency) to `user.additionalFields`.
  - Migrated customers do NOT get an `account` row (they have no credential to store). Their first sign-in via Google or magic-link creates the appropriate `account` row at that point.
- One-time customer email blast on the day v0.8.3 deploys: "We've upgraded sign-in. Click here to sign in to your dashboard — no password required from now on. You'll use Google or a one-time email link." The "click here" goes to a magic-link sign-in URL with the customer's email pre-filled.
- Keep `/api/customers/*` endpoints alive for one release as a 308-redirect to `/login` (so any old in-app links don't 404).
- Update `src/app/(dashboard)/layout.tsx` to use `auth.api.getSession()`.

**At end of phase:** owners can sign in via Google or magic-link. There is no password sign-in anywhere on the website. The desktop is unchanged. Old Customer collection still exists but is read-only.
**Risk:** medium — biggest UX risk is customers who were used to password sign-in. Mitigation: clear migration email + a "trouble signing in?" link on /login that opens a support ticket.
**Verify:** smoke test sign-in via both Google and magic link on three browsers.

### v0.8.4 — Domain data migration

[unchanged from earlier draft — Payments → Machines → Licenses → Tickets → CloudBackups → Activations → TelemetryEvents in dual-write order]

### v0.8.5 — Custom admin dashboard

[unchanged — see §5]

### v0.8.6 — User dashboard revamp

[unchanged — see §6]

### v0.8.7 — CMS content migration

[unchanged]

### v0.8.8 — Endpoints + crons migration

[unchanged]

### v0.8.9 — Payload deletion + cycle bump to v0.9.0

- Delete `src/payload.config.ts`, `collections/`, `globals/`, `migrations/`, `payload-types.ts`, `(payload)/` group, all Payload deps in `package.json`.
- Drop the `customers` and other Payload-shaped tables from the database (after a 30-day backup window).
- Cycle bump to v0.9.0.

### v0.9.x — Desktop ↔ cloud user sync (new auth modality)

This cycle delivers the staff-password-reset-via-website feature. See §13 for the full design.

**v0.9.0** — `desktop_users` Drizzle table + sync API
- New cloud table: `desktop_users` (mirrors a subset of the desktop SQLite `users` table per licence)
- New cloud table: `desktop_password_resets` (pending reset queue per licence)
- New cloud routes:
  - `POST /api/desktop/sync/users` — desktop pushes user changes (create / update / delete) tied to its licence
  - `GET /api/desktop/sync/pending` — desktop polls for pending password resets to apply locally
  - `POST /api/desktop/sync/ack` — desktop acknowledges that a pending reset has been applied (clears the queue entry)
- New website route: `/reset/desktop` — public page where staff enter their email + licence number to trigger reset
- New website route: `/reset/desktop/[token]` — magic-link landing where they set new password
- Email templates updated for the desktop-reset flow (different copy from website-account reset)

**v0.9.1** — Desktop client wires up the sync
- New Tauri command: `sync_users_to_cloud()` — pushes any pending local user changes via heartbeat
- Heartbeat schedule extended: in addition to telemetry, fetch `/api/desktop/sync/pending` every 30s when online; apply any returned reset payloads atomically
- New desktop UI: in user-management settings, every user row gets a verified-email badge + a "reset password" button that triggers the cloud flow
- New desktop UI: forgot-password link on the login screen. Opens the system browser to `omnix.co.ke/reset/desktop?machine=<fingerprint>` so the user can finish the reset on their phone
- Email field becomes mandatory on user-create; existing users without email are migrated to "owner@unknown.local" with a 30-day grace banner asking the owner to backfill emails

**v0.9.2** — Owner staff-management page on website
- New route: `/dashboard/staff` — owner sees all staff across all their machines, can:
  - Add a staff member (email + role) → pushed to all bound machines on next heartbeat
  - Reset any staff member's password → sends magic link to their email
  - Disable a staff member (revokes their local sessions on every machine)
- Audit-log entries for every change

**v0.9.3** — Recovery key for the locked-out owner
- During first-time-setup wizard on desktop, generate a 12-word BIP39 recovery phrase
- Show it once, ask the owner to write it down
- Store an Argon2 hash of the phrase locally + on cloud
- New desktop UI on the login screen: "I've lost everything" → enter recovery phrase → reset owner password locally without internet (verifies against the local hash)
- Same path on cloud: enter recovery phrase + email + licence number → cloud-side owner password reset, useful when the owner forgot their password AND there's no admin to help

**v0.9.4** — Multi-machine reset propagation
- A reset triggered on machine A should propagate to machines B and C in the same chain
- The pending-reset queue is keyed by `(license_id, user_id)`, not `(machine_id, user_id)`
- Each machine acks independently when it applies the reset; queue entry is deleted after the LAST machine acks (or after 30 days, whichever comes first)
- LAN-sync between machines (already exists for inventory/sales) gets a new message type: `user.reset_applied` so a chain can self-heal even without internet on one machine

**v0.9.5** — Stabilisation, docs, cycle bump to v0.10.0

---

## 5 · Custom admin dashboard (replaces Payload admin)

Lives at `/admin/*`. Same path Payload used; Payload's admin gets removed in v0.8.9.

### 5.1 Visual design

Same design language as the desktop redesign in v0.7.x. **frontend-design + emil-design-eng + anti-slop-writing.**

- Background: `#FBFAF6` (cream paper) — matches POS overview + P&L
- Display type: Fraunces serif for headings + key metrics
- Body type: Geist sans, 13px / 1.45
- Mono: Geist Mono for IDs, dates, numbers
- Layout: sidebar (`/admin/users`, `/admin/orgs`, `/admin/machines`, `/admin/licenses`, `/admin/payments`, `/admin/tickets`, `/admin/releases`, `/admin/audit`) + content
- No drop shadows, no gradient cards, hairline rules between sections
- Tables: dense (32–36px row height), monospace numbers, sticky header

### 5.2 Routes

```
/admin                          → overview (system health KPIs)
/admin/users                    → user list (better-auth admin.listUsers)
  /admin/users/[id]             → detail (sessions, orgs, payments, machines, ban/impersonate actions)
  /admin/users/new              → create user (admin can pre-create accounts)
/admin/orgs                     → organization list
  /admin/orgs/[id]              → detail (members, teams, invitations, licences)
/admin/machines                 → machine list (filter by user/org/status)
  /admin/machines/[id]          → detail (heartbeat history, license, activations)
/admin/licenses                 → license list
  /admin/licenses/[id]          → detail (rebind, suspend, transfer)
  /admin/licenses/new           → manual issue
/admin/payments                 → payment list
  /admin/payments/[id]          → detail (refund button, paystack receipt)
/admin/tickets                  → support inbox
  /admin/tickets/[id]           → ticket thread (reply, close, reassign)
/admin/releases                 → desktop release manifest editor
  /admin/releases/new           → publish a new release
/admin/audit                    → audit log (filter by actor / action / date)
/admin/settings                 → platform settings (rate limits, feature flags)
```

### 5.3 Auth gate

Single guard at `app/admin/layout.tsx`:

```ts
export default async function AdminLayout({ children }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?next=/admin')
  if (session.user.role !== 'platform_admin' && !STAFF_ROLES.includes(session.user.role)) {
    return <Forbidden />
  }
  return <AdminShell user={session.user}>{children}</AdminShell>
}
```

Per-route permission checks happen via `auth.api.userHasPermission({ ... })` in each page.

### 5.4 Component library

- **Lists**: shadcn `Table` + custom row component with motion/react entrance
- **Filters**: shadcn `Combobox`, `Select`, date-range picker (recharts wasn't available; use `react-day-picker`)
- **Detail panels**: shadcn `Sheet` for inline edit, separate routes for full edits
- **Actions**: shadcn `Button` + confirm-dialog for destructive ops (ban, refund, revoke)
- **Charts**: `recharts` for the overview KPIs (system health, signups/day, MRR over time)
- **Forms**: react-hook-form + zod (already in the codebase via Better Auth's plugin patterns)

### 5.5 Killer-feature pages

**Overview (`/admin`)**

- Hero: today's MRR figure in Fraunces 80px (or trial signups, depending on the day)
- 6-bento grid: signups today, paid users today, active licences, active orgs, open tickets, system error rate
- Activity feed: last 20 audit events with actor + action + target
- "Top of mind": pending support escalations, failed Paystack webhooks, newly-banned users

**User detail (`/admin/users/[id]`)**

- Identity card: name, email (with verified ✓), phone, country, currency, joined-on
- Session list (active + recent) with revoke button per session and "revoke all"
- Organisations the user belongs to + role per org
- Machines registered to this user
- Licences they hold
- Payments made (with refund link)
- Support tickets they've opened
- Audit trail of admin actions touching this user
- Action bar: ban / unban / impersonate / set role / set password / send password reset / delete

**License issue (`/admin/licenses/new`)**

- Search-bind to a customer (Combobox, autocompletes from `users` table)
- Pick variant (Dawa / Retail / Hardware / Hospitality / Core) — modules toggle on
- Pick tier (standard) — single tier per current product, kept as a select for future
- Set compliance window (1y default)
- Pick currency from the user's country, KES default
- Manual price override (optional, for grandfathered customers)
- Issue button — generates RSA-signed key, writes to `licenses` table, creates audit log entry, fires email to the user

---

## 6 · User dashboard revamp

Visual language: same as POS overview / P&L (Fraunces serif headlines, Geist body, cream background, hairline rules).

### 6.1 Routes

```
/dashboard                     → overview (current state of their omnix install)
/dashboard/profile             → profile + security (password, email, sessions)
/dashboard/organisations       → orgs they belong to
  /dashboard/organisations/[id] → org detail (members, teams, invitations)
/dashboard/machines            → machines list
  /dashboard/machines/[id]     → machine detail (rebind, deactivate)
/dashboard/licenses            → licenses they hold
  /dashboard/licenses/[id]     → license detail (download, manage seats)
/dashboard/billing             → payments + add-ons + compliance window
/dashboard/support             → tickets
  /dashboard/support/new       → new ticket
  /dashboard/support/[id]      → ticket thread
/dashboard/downloads           → installer downloads (variant-specific)
```

### 6.2 Overview redesign (`/dashboard`)

Current state is a long page of cards. Redesign:

- **Top strip**: cashier-name + active org + clock (newspaper masthead pattern)
- **Hero**: their CURRENT licence status as the headline. If active: "**Compliance until 2027-Mar-12**" in Fraunces 80px. If trial: "**Trial · 14 days left**" in italic. If expired: "**Renew compliance**" in rose with a renew CTA.
- **5-bento grid**: machines registered, licences held, last heartbeat, support tickets open, latest payment
- **Activity timeline**: last 10 events affecting their account (machine activated, license renewed, payment processed, ticket replied)
- **Quick actions**: download installer, register a new machine, open ticket, invite teammate (if they own an org)

### 6.3 Organizations page (NEW — built on Better Auth org plugin)

New surface that didn't exist in the Payload-backed dashboard:

- List of orgs the user belongs to with role per org
- Active org highlighted (drives currency + machine pool)
- Switch active org via `authClient.organization.setActive()`
- For each org the user owns:
  - Member list with role chips
  - Invite member by email (sends invite via better-auth)
  - Remove / change role
  - Teams sub-section (if teams enabled)

### 6.4 Profile page

- Identity: name, email (with verified state), phone, business name, country
- Security: change password, list active sessions, revoke individual sessions, "revoke all other sessions" button
- Preferences: language (en/sw/fr/...), currency (KES/USD/...), timezone

### 6.5 Other routes — minimal redesigns

Machines / Licenses / Billing / Support / Downloads keep their current information architecture but get the typographic treatment + Drizzle data layer.

---

## 7 · Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Customer password rehash fails for some users | medium | high (locked-out customers) | Dual-hash window: keep Payload's hash on the user row for 90 days. On login, try better-auth scrypt first; if fails, try legacy PBKDF2; on success, update to scrypt. |
| Live migration loses data due to dual-write race | low | high | Explicit transactions, retry-with-idempotency-key on every webhook handler. Reconciliation script runs nightly during migration window. |
| Payload admin removal breaks something Operations relies on | medium | medium | Build admin dashboard FIRST (v0.8.5) with feature parity audit. Operations signs off before v0.8.9 deletes Payload. |
| Better Auth migration breaks existing dashboard sessions | medium | medium | Set up dual-cookie window: read both Payload-issued cookies AND better-auth cookies during transition. Old cookies redirect to /login on first valid request. |
| Drizzle schema drift between dev / prod | low | medium | drizzle-kit migrations checked into git; CI verifies migration applies cleanly to a temp DB before deploy. |
| Email rate limits during migration (resend) | low | low | Bulk-send to all migrated customers staggered over 24h. Pre-warm Resend quotas. |
| Edge runtime limitations on `auth.api.*` calls in middleware | high (already known) | medium | Use `getSessionCookie()` cookie-only checks in middleware. Full session validation moves to page bodies. |
| Vercel cold-start regression from extra Drizzle / better-auth imports | low | low | Bundle-size watcher in CI. Use `better-auth/minimal` import per the docs. |
| TradeLandings + Pricing edits become slower (PR vs CMS) | known | low (acceptable) | Add a thin admin editor in v0.9 if it bites. For now, edit-via-PR. |

---

## 8 · Testing strategy

**Phase 0 — every phase**:
- `npx tsc --noEmit` clean
- `npx vitest run` all tests pass
- `pnpm exec next build` clean
- Smoke test all four auth flows (login, signup, forgot, verify) + dashboard load + admin load + paystack init + paystack webhook + every cron + every endpoint

**Phase 0.8.3 specifics — auth swap**:
- Manual: full sign-up flow with verification email, then sign-in, then password reset, then sign-out, on a staging deployment, on three browsers (Chrome / Firefox / Safari)
- Automated: each better-auth client method has a vitest spec hitting a test DB
- Migration script: dry-run mode that prints diff (would-create N users, would-skip M users)

**Phase 0.8.4 specifics — domain data**:
- Reconciliation script: every Payload row has a matching Drizzle row, every Drizzle row has a Payload counterpart (during dual-write window)
- 24h soak after each switch before turning off Payload writes

**Phase 0.8.9 specifics — Payload removal**:
- Final smoke test of every route that previously imported Payload
- Bundle-size delta should be NEGATIVE (we're removing a lot)

---

## 9 · Environment variables — additions + removals

**Add for v0.8.x**:
- `BETTER_AUTH_SECRET` — 32+ char random
- `BETTER_AUTH_URL` — `https://omnix.co.ke` (prod) / `http://localhost:3000` (dev)
- `GOOGLE_CLIENT_ID` — OAuth app client id
- `GOOGLE_CLIENT_SECRET` — OAuth app client secret

**Already present (kept)**:
- `POSTGRES_URL` — Neon Postgres connection string
- `RESEND_API_KEY` — email
- `S3_*` — backup storage
- `PAYSTACK_*` — payments
- `NEXT_PUBLIC_SITE_URL`

**Remove (after v0.8.9)**:
- `PAYLOAD_SECRET` — no longer needed

---

## 10 · Deliverables checklist

**Website cycle (v0.8.x → v0.9.0 cycle bump)**:
- [ ] **v0.8.2** Better Auth + Drizzle scaffolding with email/password + Google OAuth + magic link plugins (no traffic switch)
- [ ] **v0.8.3** Auth route swap, three sign-in modalities live, customer migration with dual-hash window
- [ ] **v0.8.4** Domain data dual-write + read-switch (machines / licences / payments / tickets / cloud-backups / activations / telemetry)
- [ ] **v0.8.5** Custom admin dashboard at /admin
- [ ] **v0.8.6** User dashboard revamp
- [ ] **v0.8.7** CMS content migration to static config + markdown
- [ ] **v0.8.8** Endpoints + crons migration to Drizzle
- [ ] **v0.8.9** Payload deletion, cycle bump to v0.9.0

**Desktop ↔ cloud bridge cycle (v0.9.x → v0.10.0 cycle bump)**:
- [ ] **v0.9.0** desktop_users + desktop_password_resets + desktop_reset_tokens cloud tables; sync API + /reset/desktop website pages
- [ ] **v0.9.1** Desktop client implements push/pull sync; email mandatory on user create; forgot-password link on login screen
- [ ] **v0.9.2** Owner staff-management page at /dashboard/staff
- [ ] **v0.9.3** Recovery key (BIP39 12-word phrase) for the locked-out owner, both offline + online recovery flows
- [ ] **v0.9.4** Multi-machine reset propagation across chain tills
- [ ] **v0.9.5** Stabilisation, docs, cycle bump to v0.10.0

Each line shippable in isolation; failures are reverted via the previous tag.

---

## 11 · Open questions for the user

These need a decision before v0.8.2 starts:

1. **Passwordless-only website** — confirm that the website has no email+password sign-in (only Google + magic-link), and existing customers get a one-time migration email asking them to sign in via Google or magic-link from now on. **Recommendation: yes, passwordless.** Removes the dual-hash migration burden and the credential-stuffing attack surface.
2. **Blog content migration** — markdown in `content/blog/` or stay in Drizzle? **Recommendation: markdown.**
3. **Pricing global** — typed config file in git, or thin Drizzle table with a custom admin editor? **Recommendation: config file. Add an editor in v0.10 if pricing changes more than once a quarter.**
4. **Multi-language auth pages** — keep next-intl translations, or English-only? **Recommendation: keep next-intl.**
5. **Releases** — Drizzle table editable via admin dashboard, or static JSON via CI on `git tag`? **Recommendation: Drizzle table** — releases get a few manual edits per cycle (release notes, hotfix re-publishes).
6. **Audit log retention** — forever, or partition + roll off after 1 year to cold S3? **Recommendation: 1-year hot, archive cold.**
7. **Magic link surface** — secondary tab on /login, or a separate /magic-link page? **Recommendation: secondary tab — keeps the auth surface unified.**
8. **Google OAuth scopes** — minimal `openid email profile` only, or also extra scopes for future integrations? **Recommendation: minimal only — request more later when there's a feature that needs them.**
9. **Account linking trust** — auto-link Google sign-in to an existing email/password account when emails match, or require explicit confirmation? **Recommendation: auto-link, since Google verifies the email.**
10. **Desktop user migration timing** — push existing desktop users to cloud automatically on first online heartbeat after v0.9.1, or require an explicit "sync staff to cloud" button? **Recommendation: automatic with a 7-day grace banner allowing the owner to opt out.**
11. **Recovery phrase strength** — BIP39 12-word phrase (128-bit entropy, error-correcting) or 6-digit numeric PIN (simpler, 20-bit entropy, brute-forceable)? **Recommendation: BIP39 12-word.**
12. **Recovery phrase storage on cloud** — store the hash on cloud too (enables fresh-device recovery via licence + email + phrase) or only locally on the desktop? **Recommendation: store both** — local enables offline recovery; cloud enables fresh-device recovery if the till is wiped.
13. **Reset email "from" address** — `noreply@omnix.co.ke` (less support volume) or `support@omnix.co.ke` (replies go straight to support)? **Recommendation: `noreply@` for transactional, with a clear "if you didn't request this, contact support@omnix.co.ke" footer.**

---

## 12 · Out of scope for v0.10

These are real things to do but not in this two-cycle migration:

- 2FA / passkey (Better Auth supports both via plugins; add post-v0.10 once foundation is settled)
- Apple sign-in / Microsoft sign-in (Better Auth supports them; not required today)
- Mobile app auth — desktop-only product; not needed
- Self-serve org transfer (move a licence from one owner to another) — covered partially by /dashboard/staff in v0.9.2; full transfer is a separate epic
- Customer-facing webhook subscriptions (notify a customer's CRM on licence events) — interesting feature, separate epic
- Single-sign-on (SAML, SCIM) for enterprise customers — Better Auth has plugins; defer until enterprise demand justifies it

## 13 · Desktop ↔ cloud user sync (the staff-password-reset bridge)

The user's directive: *"the better option now is to plan for everything to be reset through the website including the local passwords for users and admins that way we wont be getting support tickets every time"*.

This section designs that bridge. Belongs in v0.9.x, after Payload is gone and Better Auth is the established auth layer.

### 13.1 Problem statement

Today the desktop app stores its own staff users in local SQLite (id, email, role, argon2_hash). Cashier "Mary" forgets her PIN. Today's only paths:
- Owner manually resets it from the till's user-management screen (requires owner is on-premises and remembers their own password)
- Open a support ticket → support manually pushes a reset → 1–2 day delay during which the till is one cashier short

Neither is acceptable at scale. A till operator should be able to reset their own password using their email, the way every consumer SaaS does it. The reset must work even though the till is offline-first and authoritative for its own data.

### 13.2 Goal

- Cashier types email into omnix.co.ke/reset/desktop on her phone
- 5 minutes later she's back at the till with a new password
- Zero support tickets
- Owner stays in the loop via audit log
- Works on a single till; works on a 5-till chain

### 13.3 Architecture

**Hybrid sync, NOT cloud-first auth.** Daily login keeps using the local Argon2 hash — no internet required for normal till operation. The cloud is only involved when:
1. A user is created/edited/deleted on the desktop → push to cloud (next heartbeat)
2. A password reset happens via the cloud → push to desktop (desktop pulls during heartbeat)

The desktop SQLite remains the authoritative auth store for that machine. The cloud is a propagation channel.

```
┌─────────────┐                 ┌─────────────┐                  ┌─────────────┐
│  desktop A  │  push staff ─→  │   cloud DB  │  ←── reset       │ phone       │
│ (Mary's     │  pull resets    │ desktop_*   │   request        │ (Mary)      │
│  till)      │  ←── (every    │ tables      │                  │             │
│             │      30s)       │             │                  │             │
└─────────────┘                 └─────────────┘                  └─────────────┘
                                       ↓
                                ┌─────────────┐
                                │  desktop B  │ pull resets  ←── (chain till)
                                └─────────────┘
```

### 13.4 Cloud schema additions

```ts
// src/db/schema/domain/desktop_users.ts
export const desktopUsers = pgTable('desktop_users', {
  id: text('id').primaryKey(),                       // Mirrors local SQLite user_id (UUID generated on desktop)
  licenseId: text('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull(),                      // owner | manager | cashier | accountant
  active: boolean('active').notNull().default(true),
  // We do NOT store the password hash here — that lives on each desktop.
  // We store only the hash of the *recovery key* (in case the desktop is wiped).
  recoveryKeyHash: text('recovery_key_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  licenseEmailIdx: uniqueIndex('desktop_users_license_email_idx').on(t.licenseId, t.email),
}))

// src/db/schema/domain/desktop_password_resets.ts
export const desktopPasswordResets = pgTable('desktop_password_resets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  desktopUserId: text('desktop_user_id').notNull().references(() => desktopUsers.id, { onDelete: 'cascade' }),
  licenseId: text('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  // Pre-computed Argon2id hash of the user's new password.
  // Computed server-side using the same parameters the desktop uses.
  // Pinning these params is critical — see §13.6.
  argon2Hash: text('argon2_hash').notNull(),
  argon2Params: jsonb('argon2_params').notNull(),    // { memory, iterations, parallelism, version }
  // Set when the cashier completed the reset on the website.
  completedAt: timestamp('completed_at').notNull().defaultNow(),
  // Set when each desktop machine has applied the reset.
  // For multi-till chains, we have one `applied_at` per machine.
  appliedByMachine: jsonb('applied_by_machine').notNull().default('{}'), // { 'machine_id_1': '2026-06-22T08:30:00Z' }
  // Resets expire after 30 days even if no machine has acked.
  expiresAt: timestamp('expires_at').notNull(),
}, (t) => ({
  licenseIdx: index('desktop_resets_license_idx').on(t.licenseId),
  expiresIdx: index('desktop_resets_expires_idx').on(t.expiresAt),
}))

// src/db/schema/domain/desktop_reset_tokens.ts
// Short-lived magic-link tokens for the desktop reset flow.
export const desktopResetTokens = pgTable('desktop_reset_tokens', {
  id: text('id').primaryKey(),                       // The token itself (cryptographically random, URL-safe)
  desktopUserId: text('desktop_user_id').notNull().references(() => desktopUsers.id, { onDelete: 'cascade' }),
  licenseId: text('license_id').notNull().references(() => licenses.id),
  email: text('email').notNull(),
  consumedAt: timestamp('consumed_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### 13.5 API surface

**Desktop → cloud** (called via the existing telemetry heartbeat channel, which already authenticates with the licence's RSA key):

- `POST /api/desktop/sync/users` — push user creates/updates/deletes since last sync. Idempotent on `(license_id, user_id)`. Body: `{ users: [{ id, email, fullName, role, active, deleted, updatedAt }] }`.
- `GET /api/desktop/sync/pending?machineId=<fingerprint>` — pull pending resets that this machine hasn't acked yet. Returns `[{ resetId, desktopUserId, argon2Hash, argon2Params, expiresAt }]`.
- `POST /api/desktop/sync/ack` — confirm a reset was applied. Body: `{ resetId, machineId, appliedAt }`. Cloud updates `appliedByMachine`. When ALL machines bound to the licence have acked, cloud sets `completedAt = now()` and the queue entry is purged after a 7-day audit window.

**Customer → cloud** (browser flow):

- `POST /api/desktop/reset/request` — public, rate-limited. Body: `{ email, licenseNumber }`. Cloud finds matching `desktop_users` row, generates a `desktop_reset_tokens` row with 15-min expiry, sends magic link to email.
- `GET /reset/desktop/[token]` — landing page, shows the desktop user's name + the licence's business name for confirmation, asks for new password.
- `POST /api/desktop/reset/complete` — body: `{ token, newPassword }`. Cloud computes Argon2id hash with pinned params, inserts `desktop_password_resets` row, marks token `consumed_at`. Returns success page: "Reset complete. Go back to the till and log in with your new password. The till will sync within 30 seconds when it's online."

**Owner → cloud** (authenticated dashboard flow):

- All the above plus:
- `POST /api/desktop/staff/create` — owner adds a new staff member. Cloud inserts `desktop_users` row, queues a `pending` user-create entry that the desktop pulls and applies (creates the local SQLite row with a temporary password, which the staff then resets).
- `POST /api/desktop/staff/disable` — set `active=false`, queues a sync; desktop kicks the user's local sessions on next pull.

### 13.6 Argon2 params pinning

The desktop and the cloud must hash with **identical** Argon2id parameters or login will silently fail. The desktop side already uses Argon2id via the Rust `argon2` crate. We pin:

```
memory_kb:     19_456    # OWASP-recommended baseline (2024)
iterations:    2
parallelism:   1
hash_length:   32
version:       0x13      # Argon2id v1.3
salt_length:   16        # generated per-hash, random
```

These values are duplicated in:
- Desktop: `src-tauri/src/auth.rs` (existing)
- Cloud: `src/lib/argon2-params.ts` (new) — uses `@node-rs/argon2`
- Documented in `AGENTS.md` so future changes happen on both sides simultaneously

If we ever change the params (e.g., memory increase as hardware improves), we increment a `params_version` field stored alongside the hash. Desktop on apply-reset checks if its local params match the reset's `argon2_params.version`; if not, it stores the new hash AS-IS and uses those params for that user only — local rehashes happen on next successful login.

### 13.7 Reset flow walkthrough

**Important — no website session is created during the reset flow.** The cashier doesn't end up logged in to omnix.co.ke. They go from "I forgot my till password" → magic link in email → set new desktop password → "go back to your till and log in there". Their identity at the till is what matters; the website is only the medium through which the new password reaches the till. This keeps the website session model simple (only owners and platform admins ever have web sessions, and they get them via magic-link / Google sign-in on `/login` — distinct flow from `/reset/desktop`).

**Mary's till is single-machine. She forgot her PIN.**

1. **At the till**: Mary clicks "Forgot password?" on the desktop login screen. Tauri opens the system browser to `https://omnix.co.ke/reset/desktop?fp=<machine_fingerprint>`. The fingerprint pre-fills so she doesn't have to type the licence number on her phone.
2. **On her phone**: she sees a form with email + licence number (licence pre-filled from the fingerprint). Types her email. Submits.
3. **Cloud**: looks up `desktop_users` where `licenseId = ... AND email = ...`. Finds Mary. Generates a `desktop_reset_tokens` row with 15-min expiry. Sends magic-link email.
4. **Mary's phone**: clicks the email link → `https://omnix.co.ke/reset/desktop/abc123`. Page shows: "Reset password for **Mary Wanjiku**, cashier at **Joyce's Pharmacy**". Asks for new password (twice, with strength meter).
5. **On submit**: cloud hashes the new password with pinned Argon2 params, inserts a `desktop_password_resets` row with `licenseId`, `desktopUserId`, `argon2Hash`, `argon2Params`. Marks the token `consumed_at`. Sends an audit-log entry to the owner's email: "Mary Wanjiku reset her password from a phone in Nairobi".
6. **Page renders**: "Reset complete. Go back to the till and log in. The till will sync within 30 seconds." Shows a small countdown.
7. **At the till**: Mary's till heartbeats every 30 seconds (existing telemetry). On next heartbeat, the desktop hits `GET /api/desktop/sync/pending?machineId=<fp>`, gets back `[{ resetId, desktopUserId, argon2Hash, argon2Params }]`. Tauri command applies the hash to local SQLite atomically, then calls `POST /api/desktop/sync/ack`.
8. **Mary types her new password on the till login screen**. Local SQLite verifies against the new hash. She's in.

Total elapsed time on a healthy network: ~60 seconds.

**Edge case: chain with 5 tills.** Same flow as above, except every till independently pulls the pending reset on its next heartbeat and acks. The cloud `appliedByMachine` map fills up. After all 5 ack, the reset is marked complete. If one till is offline for a week, that till applies the reset whenever it reconnects; the cloud holds the queue entry until `expiresAt` (30 days) or until that till acks. Other tills aren't blocked.

**Edge case: till has no internet for a week.** The reset queues on cloud. Mary can't log in until either (a) the till comes online and pulls the reset, or (b) someone with PIN access uses the local user-management UI to manually set Mary's password.

**Edge case: Mary's email is bouncing.** Email send fails → cloud marks the token `expired` immediately and shows an error. No reset is queued. Mary opens a support ticket — the only path to support.

### 13.8 The locked-out owner

Special-case the OWNER role because they're the one who creates other users.

**At setup time** (already in the wizard, just augmented):
- After the owner sets their own password during Step 4 (Owner Account), the wizard generates a 12-word BIP39 recovery phrase (memorable, transcribable, error-correcting).
- The wizard shows it once: "Write this down. Photo it. Email it to yourself. This is your only way back into the till if you forget your password and have no internet." With a "Print" button that opens the system print dialog.
- The wizard requires the owner to type back any 3 random words from the phrase as confirmation (proof they've recorded it).
- Argon2 hash of the phrase is stored locally (`recovery_key_hash` column on `users`) AND pushed to cloud (`desktop_users.recoveryKeyHash`).

**Recovery flow (offline)**:
- On the desktop login screen, after 3 failed owner password attempts, a "I've lost everything" link appears.
- Clicking it shows a 12-input grid for the recovery phrase.
- The desktop verifies against `recovery_key_hash` locally. On success, prompts for a new password. Sets it. Done. No internet required.

**Recovery flow (online, fresh device install)**:
- After installing Omnix on a new machine, before the licence is bound, the user can pick "Restore from licence" on the activation screen.
- They enter licence number + their email + their recovery phrase.
- Cloud verifies recovery_key_hash via the website, returns a one-time setup token + the licence file.
- Desktop applies the licence and creates the owner account locally.

This handles the "the owner forgot their password AND lost the till" worst case.

### 13.9 Owner staff-management on the website

New page at `/dashboard/staff`:

- Shows every staff member across every machine bound to this owner's licence
- Columns: name, email, role, last seen (per-machine), active toggle
- Actions: add staff (email + name + role) → desktop receives a queued create on next heartbeat → desktop admin reviews + sets a temporary password → staff member resets via website
- Reset password: triggers the same magic-link flow as the cashier-self-reset, but sent by the owner; staff sees "your owner has initiated a password reset" in the email
- Disable staff: cloud queues a `disable`, all desktops kick that user's sessions on next pull

### 13.10 Audit + security

- Every cloud-side action (request reset, complete reset, owner-initiated reset, staff add/disable) writes to `audit_log` with the actor's IP + user agent
- Every desktop-side action (apply reset, kick session) writes to the local audit log AND, on next heartbeat, to cloud `audit_log`
- Email notifications:
  - Owner gets emailed on every staff reset, every staff add, every disable
  - Staff member gets emailed when their account is created, reset, or disabled
- Rate limits: 5 reset requests per email per hour, 20 per licence per day

### 13.11 What changes in the desktop app

This is non-trivial work on the Tauri side. Lives in v0.9.1 of the desktop release line.

- `src-tauri/src/db/users.rs` adds `email` as required (NOT NULL) on the `users` table; existing users get migrated with `'<placeholder>@<licence_id>.local'` and a 30-day grace banner asking the owner to backfill
- `src-tauri/src/sync/users.rs` — new module. On every heartbeat, push pending changes; pull pending resets; apply atomically
- `src-tauri/src/recovery.rs` — new module. Generate 12-word phrase, hash it, verify it
- `src/pages/login.tsx` — adds "forgot password" link + "I've lost everything" link
- `src/pages/setup.tsx` — adds the recovery-phrase show-and-confirm step right after owner password
- `src/pages/users.tsx` (existing user-management) — email becomes required on create/edit; "reset password" button per row that triggers the cloud flow

These changes ship as desktop v0.9.x patches in lockstep with the website v0.9.x cycle.


---

## 14 · Purchasing, upgrading, cloud backup, license-renewal — flow redesign

User's directive: *"update the purching process its rough and not modern… nothing should be made hard enough for users — purchasing the system, upgrading, cloud backup, purchasing major upgrade license."* Plus: install **21st.dev Magic MCP** and use it with the **frontend-design** skill.

This section designs the new purchase + upgrade flows. Targeted at the **v0.8.6 user dashboard revamp** cycle (one cycle after the auth foundation is in place — at that point we're on Drizzle + Better Auth + can cleanly rebuild the checkout).

### 14.0 Tooling: 21st.dev Magic MCP

Wired into `.kiro/settings/mcp.json` (workspace scope). Disabled until the user adds `TWENTY_FIRST_API_KEY` from `https://21st.dev/magic`. Once active, the agent gains a `/ui …` prompt surface that generates polished React + Tailwind components (with shadcn primitives, motion/react, and design-engineering polish baked in). We use it in this redesign for the **bento price card**, the **stepper progress bar**, the **stat tickers on the success receipt**, the **encryption-key reveal** in cloud-backup setup, and the **renewal-countdown ribbon** on the dashboard hero.

### 14.1 Audit of what's wrong today

Catalogued from reading `(checkout)/buy/page.tsx`, `(checkout)/buy/[licenseId]/page.tsx`, `components/checkout/checkout-form.tsx`, `(dashboard)/dashboard/billing/page.tsx`, `(dashboard)/dashboard/licenses/[id]/page.tsx`:

| # | Pain point | Where it lives today |
| --- | --- | --- |
| 1 | **Two-page checkout** — /buy resolves auth + creates a hidden trial license, then redirects to /buy/[licenseId] — the customer doesn't know a license was just created on their behalf, doesn't know what they're paying for, doesn't see the modules they're getting. | `(checkout)/buy/page.tsx` redirects to `(checkout)/buy/[licenseId]` |
| 2 | **Single-purpose checkouts** — `?type=license_fee` vs `?type=maintenance_renewal` vs `?type=major_upgrade` vs `?type=cloud_backup` vs `?type=extra_branch` vs `?type=extra_machine` are six distinct entry points that each render a single line item with no opportunity to bundle. A customer paying for compliance renewal can't add cloud backup in the same transaction. | `computeLines()` switch in `[licenseId]/page.tsx` |
| 3 | **System-flavoured copy** — "Maintenance renewals", "Major version upgrade (50 % off business)", "license_fee", "Stay on v1.x as long as you like — there's no rush" — reads like internal product-management documentation, not a customer-facing checkout. | All over `billing/page.tsx`, `licenses/[id]/page.tsx`, `purposeLabel()` |
| 4 | **No upcoming-expiry hero** — the dashboard shows "Maintenance until 2027-Mar-12" as a 13px stat in a 4-column grid alongside "Branches", "Machines", "Major-version cap". An owner whose compliance expires in 14 days has to scroll past three other stats to see it. | `licenses/[id]/page.tsx` Stat component grid |
| 5 | **Cloud backup has no setup wizard** — paying for cloud backup just records a `cloudBackupEnabled=true` flag. The customer goes back to their till, opens settings, and is dropped into a raw form that asks for "S3 endpoint, access key, secret key, bucket name, encryption passphrase". No one understands what a "bucket name" is. | `(dashboard)/dashboard/billing` adds-on card → `/buy?type=cloud_backup` → success → no further guidance |
| 6 | **Major-upgrade prompt is buried** — it appears as a card at the bottom of `licenses/[id]/page.tsx` with copy "v2.0 ships later this year" and a single CTA "See what's coming". The CTA goes to /changelog (which is generic) instead of the upgrade-purchase flow. | `licenses/[id]/page.tsx` bottom card |
| 7 | **No bundle pricing** — owner who wants a Hospitality license + cloud backup + 2 extra machines pays in three separate transactions. Each invoice is separate. Their accountant gets three Paystack receipts to reconcile. | Architecture: `purpose` is a single string per `init` call |
| 8 | **Receipt after pay is just a redirect** — `onSuccess` of the Paystack popup redirects to `/buy/success?ref=…` which… doesn't render anything memorable. No "here's what you got", no "copy your license key", no "open Omnix to activate". | `CheckoutForm.onSuccess` |
| 9 | **Currency is inconsistent** — Pricing page shows multi-currency (KES/USD/NGN/etc. via cookie). Checkout page shows the currency from `pricing.currency` global (one value: KES). A US visitor sees USD on /pricing then KES at checkout. | `[licenseId]/page.tsx` reads pricing global directly |
| 10 | **Trial → paid path is invisible to the user** — the user sees "Trial · 14 days left" somewhere, but the upgrade CTA is a "Sparkles + Upgrade to paid" button at the top-right of the license detail page. There's no countdown urgency, no "what changes when you upgrade", no comparison. | `licenses/[id]/page.tsx` hero card actions |

### 14.2 Design principles (frontend-design + emil-design-eng + anti-slop-writing)

For every flow:

1. **Single page when humanly possible.** Land on one page that contains everything — what you're buying, what's included, what you can add, the pay button. No /buy → /buy/[licenseId] hand-off.
2. **Plain copy.** "Pay for Omnix · KSh 30,000" — not "Complete license fee transaction". "Add another year of compliance updates" — not "Maintenance renewal". The anti-slop-writing list applies here: no "seamlessly", "robust", "comprehensive", "elevate", etc.
3. **One transaction, many line items.** A customer adding cloud backup AND an extra machine seat AND renewing compliance pays once. The Paystack metadata carries the breakdown.
4. **Receipt-style success.** After paying, render a receipt-strip: "Joyce's Pharmacy · 2026-06-21 · KSh 32,500 · License OMX-A8E2-...-3F1B is now active on your till". Numbers count up via motion/react useMotionValue. A "Open Omnix" button uses the `omnix://` URL scheme to deep-link back to the desktop.
5. **Dashboard is the renewal radar.** The hero figure on /dashboard is the compliance-expiry date. Subtle 90+ days out, eyebrow turns amber 30 days out, the whole card pulses 7 days out. One-click "Renew compliance" that enters the same single-page checkout pre-filled.
6. **Cloud backup is set up FOR you.** The user pays. A Drizzle-side worker auto-creates the encryption key, generates the recovery phrase, provisions the R2 bucket, and writes the connection details into the customer's database row. The desktop pulls these on next heartbeat. No "S3 endpoint" field anywhere.
7. **Editorial type, not dashboard cards.** Same Fraunces serif + Geist body system as POS overview / P&L. Cream paper background. Hairline rules. No drop shadows.
8. **Motion is one moment, not constant.** Number tick-up on receipt landing. Ribbon-grow on renewal countdown when it crosses a threshold. Nothing else animates ambient.
9. **Mobile-first — the cashier resets a password from her phone, not a desktop.** Every flow renders cleanly at 375px / 414px / 768px / 1024px+.

### 14.3 The new purchase page — `/checkout`

Replaces `/buy` AND `/buy/[licenseId]`. Single route. Single page.

URL shape:
```
/checkout?for=<licenseId|new>&plan=<dawa|retail|hospitality|hardware|pro>&extras=<cloud,seats:2,branch:1>&renew=<licenseId>&upgrade=<licenseId>
```

Anything goes through ONE page. The page reads the query params and renders the appropriate hero.

Layout (mobile, then scales up):

```
┌──────────────────────────────────────────────────────────────┐
│  ← Omnix · checkout                                  ⓘ help  │  ← masthead, hairline rule below
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   YOU'RE BUYING                       (mono caption, 10px)   │
│                                                              │
│   Omnix Dawa · pharmacy build         (Fraunces 36px, two    │
│   for one till in Kenya                lines, italic)        │
│                                                              │
│   ───────────────────────────────────────                    │
│                                                              │
│   Includes:                                                  │
│     · POS, inventory, customers, suppliers                   │
│     · KRA eTIMS auto-signing                                 │
│     · SHA insurance claims                                   │
│     · Drug interactions, expiry watch                        │
│     · 1 year of compliance updates                           │
│     · 3 till seats, 1 branch                                 │
│                                                              │
│   ───────────────────────────────────────                    │
│                                                              │
│   Add to this order        ⌄  (collapsed by default)         │
│   ┌────────────────────────────────────────┐                 │
│   │ ☐ Cloud backup        + KSh 500/mo     │                 │
│   │ ☐ Extra till seat     + KSh 5 000     │                 │
│   │ ☐ Extra branch        + KSh 15 000    │                 │
│   └────────────────────────────────────────┘                 │
│                                                              │
│   ───────────────────────────────────────                    │
│                                                              │
│   Total                                                      │
│   KSh 30,000                          (Fraunces 64px,        │
│                                        tabular-nums)         │
│                                                              │
│   [   Pay KSh 30,000 with M-Pesa or card   ]  ← sticky on    │
│                                                  scroll      │
│                                                              │
│   🔒 Paystack handles the popup. Cards never touch our       │
│      server. 14-day refund.                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

When `?renew=<licenseId>`:
- Hero swaps to "Renew Joyce's Pharmacy" (in Fraunces) + "Compliance through 2027-Mar-12" (mono caption above)
- "Includes" becomes "What you keep"
- "Add to this order" stays — they can renew + add cloud backup in the same checkout
- Pay button: "Pay KSh 12,000 — extends compliance to 2028-Mar-12"

When `?upgrade=<licenseId>`:
- Hero: "Upgrade to v2.0" + "50 % off list price for current owners" caption
- Includes: "Everything in v1, plus: [list of new features pulled from changelog]"
- Pay button: "Pay KSh 15,000 — upgrade to v2.0"

When `?for=new`:
- Same as the regular Pro/Dawa/Retail/Hospitality/Hardware purchase — first-time buyers
- Bottom of page: a small "Trying it first?" link that takes them to `/start-trial?plan=...` instead

### 14.4 The success page — `/checkout/success`

Replaces `/buy/success`. Renders **once**, on first land — receipt-style.

```
┌──────────────────────────────────────────────────────────────┐
│           OMNIX · RECEIPT · 2026-06-21 · 14:32              │
│  ─────────────────────────────────────────────────           │
│                                                              │
│  THANK YOU                                                   │
│  Joyce Wanjiku                       (Fraunces 28px)         │
│                                                              │
│  ─────────────────────────────────────────────────           │
│                                                              │
│  Omnix Dawa · pharmacy build                                 │
│  KSh 30,000.00                       (motion count-up)       │
│  + Cloud backup, 1 month                                     │
│  KSh    500.00                                               │
│  ──────────────                                              │
│  Total                               (Fraunces 36px)         │
│  KSh 30,500.00                                               │
│                                                              │
│  Paid via M-Pesa · ref OMX-A8E2-3F1B                         │
│                                                              │
│  ─────────────────────────────────────────────────           │
│                                                              │
│  Your licence is now active                                  │
│  ─────────────────────────────────────────────────           │
│                                                              │
│  OMX-DAWA-2026-A8E2-3F1B-9C7D-1E5A      ← copy button        │
│                                                              │
│  Open Omnix on your till. The licence will activate the      │
│  moment the till has internet.                               │
│                                                              │
│  [   Open Omnix on this device   ]   (omnix:// deeplink)     │
│  [   Email me the receipt        ]                           │
│  [   Go to my dashboard           ]                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

motion/react: every figure (KSh 30,000 / 500 / 30,500) animates from 0 over 600ms with the editorial cubic-out curve. Once. Nothing pulses.

The "Open Omnix" deeplink uses `omnix://activate?license=...` — already handled by Tauri's deep-link plugin in v0.7.x. If the desktop is open it activates immediately; if it's closed Tauri starts it and applies the licence on first launch.

### 14.5 Dashboard hero — the renewal radar

Replaces the current `/dashboard/licenses/[id]` hero card. Lives on the main `/dashboard` overview (per the v0.8.6 plan in §6.2) and is the first thing every owner sees on every visit.

State machine:

| Days until expiry | Visual treatment | Copy |
| --- | --- | --- |
| > 90 | Quiet · foreground/60 | "Compliance through **{date}**" — small caption, no CTA |
| 31–90 | Foreground/100 + amber 2px underline | "Compliance through **{date}** · {N} days left · [Renew]" — secondary CTA |
| 8–30 | Amber-tinted ribbon at top of card · italic Fraunces | "**{N} days** until your compliance lapses · [Renew now]" — primary CTA |
| 1–7 | Rose ribbon · pulsing 1.5s ease-in-out | "**{N} days** left · renew today to avoid disruption · [Renew]" — primary CTA, larger |
| Lapsed | Solid rose card · italic display "Compliance lapsed" | "Some features (eTIMS auto-sign, claims) are paused. [Renew] to restore." — primary CTA |

The "Renew" button always lands in `/checkout?renew=<licenseId>` — the new single-page flow.

### 14.6 Cloud backup — set-it-and-forget-it

The desktop can already encrypt + chunk + upload backups to S3-compatible storage (we use Cloudflare R2). The friction today is the **configuration**: the till asks for endpoint / access-key / secret / bucket / passphrase. Owners don't know what those are.

New flow:

1. Owner clicks "Add cloud backup" on /dashboard/billing (or includes it in a new-licence checkout).
2. Pay completes.
3. Server-side, on the paystack-webhook handler:
   - Provision a **per-licence R2 bucket** named `omnix-backup-<licenseId>` (we own the R2 account; bucket is created inside our org)
   - Generate a **256-bit encryption key**, hash it, store the hash in `cloud_backups.keyHash`
   - Generate a **BIP39 12-word recovery phrase** that XOR-protects the encryption key — store hash in `cloud_backups.recoveryPhraseHash`
   - Insert a row in `desktop_password_resets`-like queue: `desktop_cloud_backup_config_pending` keyed by licence
4. Owner is redirected to `/checkout/success` (the receipt page).
5. Receipt page has a special block when cloud backup was just enabled:

   ```
   ─────────────────────────────────
   CLOUD BACKUP RECOVERY PHRASE
   ─────────────────────────────────

   abandon ability able about above
   absent absorb abstract absurd abuse
   access accident

   ─── WRITE THIS DOWN ─────────────
   You'll need these 12 words to restore
   from cloud backup if your till is
   stolen or lost. We can't show them
   to you again.

   [ I've written it down ]   ← gates the [Continue] button
   ─────────────────────────────────
   ```

6. Phrase is shown ONCE. After "I've written it down" the words are blurred + an unblur-on-hover affordance. After clicking "Continue", they're cleared.
7. Desktop heartbeats → pulls the cloud-backup config (bucket name, encryption key wrapped under the recovery phrase) → applies → starts taking nightly backups.
8. Owner does nothing else. Their till is now backed up.

**Restore flow** (separate, only used post-disaster):

1. Fresh till, owner installs Omnix, enters licence + email + recovery phrase.
2. Desktop derives the encryption key from the phrase, fetches the latest backup blob from R2, decrypts, restores SQLite.
3. Done. Same flow as the licence-restore flow described in §13.8 ("locked-out owner / fresh device").

### 14.7 Trial → paid bridge

Today the trial-to-paid path is a single button on the licence detail page. It deserves a dedicated nudge.

On every `/dashboard` visit during a trial:

- A bento-card under the renewal radar: "**{N}** days left in your trial · [Continue with Omnix]"
- The CTA opens `/checkout?for=<licenseId>&plan=<variant>` — the same single-page checkout
- During the last 3 days of trial: card promotes to a banner across the top of the dashboard

After trial expiry without payment:
- Banner across top: "Your trial ended. Your data is safe. [Continue with Omnix]"
- Until they pay, sale-side features are disabled at the till (the existing licensing gate); the till still opens, sales-history is read-only

### 14.8 Major-upgrade flow

When v2.0 ships, every existing v1 licence holder gets an email + a banner on /dashboard:

- Email subject: "Omnix v2.0 is here — 50 % off for current owners"
- Banner on /dashboard: "v2.0 is available · [What's new] · [Upgrade for KSh 15,000]"
- "What's new" link goes to a v2-changelog landing page (separate from the regular changelog) with side-by-side v1-vs-v2 feature comparison
- "Upgrade" link goes to `/checkout?upgrade=<licenseId>`

The single-page checkout for upgrade shows:
- Hero: "Upgrade to v2.0" + "Includes everything in v1, plus: …"
- Total: 50 % of current list price (computed server-side)
- Pay button: "Pay KSh {amount} — upgrade to v2.0 forever"

After payment: the desktop pulls a new licence file with `majorVersionCap = 2` on next heartbeat. The owner can now install v2.x installers.

### 14.9 Add-ons unified into the main checkout

`/dashboard/billing` becomes simpler — an "**Add to my subscription**" page with toggleable rows:

```
┌──────────────────────────────────────────────────────┐
│  Add to OMX-A8E2-3F1B                                │
│  ─────────────────────────────────────               │
│                                                      │
│  ☐  Cloud backup            KSh 500 / month          │
│       Encrypted nightly snapshots                    │
│                                                      │
│  ☐  Extra till seat         KSh 5 000 one-time       │
│       Currently 1 of 3 used                          │
│                                                      │
│  ☐  Extra branch            KSh 15 000 one-time      │
│       Currently 1 of 1 used                          │
│                                                      │
│  ─────────────────────────────────────               │
│  Total                                               │
│  KSh 0                                               │
│                                                      │
│  [  Continue to checkout  ]                          │
└──────────────────────────────────────────────────────┘
```

Toggle items → total updates live → continue → lands in `/checkout?for=<licenseId>&extras=cloud,seats:1` with everything pre-selected.

### 14.10 Implementation phases

This sits in the v0.8.6 user dashboard revamp cycle, with three patches:

**v0.8.6** — Dashboard renewal radar (the most-impactful single change)
- Hero strip on /dashboard with the date + state-machine treatment from §14.5
- Email reminders 30 / 7 / 1 day before expiry (already in code; redesigned copy)
- One-click `/checkout?renew=<licenseId>` link

**v0.8.7** — Single-page checkout + receipt
- New `/checkout` route replaces `/buy` and `/buy/[licenseId]`
- New `/checkout/success` receipt page replaces `/buy/success`
- Add-ons unified into the same Paystack init call (one transaction)
- Old /buy and /buy/[licenseId] redirect to /checkout for one cycle
- `paystack-init` endpoint accepts an array of line items instead of a single `purpose`

**v0.8.8** — Cloud backup auto-provision
- Webhook handler for `cloud_backup` line item provisions R2 bucket + generates encryption key + queues desktop config
- Receipt page reveals the recovery phrase with the gate-confirm flow
- Desktop v0.9.x (in lockstep) pulls the config and starts backing up
- Restore flow at `/restore?licence=…&email=…&phrase=…`

**v0.8.9** — Major-upgrade banner + flow
- New v2-changelog landing page
- `/checkout?upgrade=<id>` flow that computes the discounted price server-side
- Email blast template for v2 announcement (deferred to actual v2 ship date)

### 14.11 Risks

| Risk | Mitigation |
| --- | --- |
| Paystack's popup flow can't be wrapped in our own success page reliably (depends on browser redirects) | Keep the existing onSuccess→`/buy/success` pattern but rebuild that page; don't try to inline Paystack |
| Per-licence R2 buckets hit Cloudflare org quotas at scale | Use a single shared bucket with per-licence prefixes; encryption keeps tenants isolated |
| Recovery phrase shown only once is a customer support nightmare if they don't write it down | Force-confirm + "I've written it down" toggle + email a hashed-only confirmation that they generated one + audit log; refuse to regenerate without identity verification through support |
| Single-page checkout becomes too long on mobile | Sticky CTA at bottom; "Add to this order" collapsed by default; total visible above the CTA always |
| Currency mismatch between /pricing and /checkout | Single source of truth: cookie set in middleware drives both. Audit the entire pricing chain for the cookie read. |
| Customers paying for an upgrade then not getting v2 | `majorVersionCap` updated atomically in the webhook handler; idempotency-keyed; reconciliation script catches stragglers |

### 14.12 Open questions for the user

These need a decision before the v0.8.6/.7/.8 patches start:

1. **Cloud backup R2 architecture** — per-licence bucket (cleaner isolation but Cloudflare quota concerns at 1000+ customers) or shared bucket with per-licence prefix (scales but slightly weaker isolation, encryption is the real protection anyway)? **Recommendation: shared bucket + per-licence prefixes + per-licence encryption keys.**
2. **Free trial of cloud backup with new purchase** — bundle 1 month free with every new-licence purchase to drive adoption, or charge from day 1? **Recommendation: 1 month free with new purchase; renewal of standalone backup is paid.**
3. **Pay-once vs. monthly cloud backup** — current pricing is KES 500/month/branch. Switch to annual pre-paid (KES 5000/year/branch with 2 months free)? **Recommendation: offer both; default is annual prepaid for simpler reconciliation.**
4. **Major-upgrade discount duration** — 50 % for the FIRST 12 months after v2 ships, or 50 % forever for v1-grandfathered customers? **Recommendation: 12 months from ship; afterwards 25 %; afterwards full price.** Creates an urgency curve that drives the upgrade cohort.
5. **omnix:// deeplink fallback** — if Tauri isn't installed when the user clicks "Open Omnix" on the receipt, what should happen? **Recommendation: if no app handler, redirect to /downloads page with the licence pre-filled in a copy-to-clipboard widget.**
6. **Trial extension** — give customers ONE 7-day trial extension if they ask (via support), or hard 14-day cap? **Recommendation: one extension via support; tracked on the licence row to prevent abuse.**


---

## 15 · Desktop site-wide design language rollout (Lucide → Phosphor, Fraunces, cream paper)

User directive: *"the way u designed the pos page before opening pos where it says open the drawer the cursive fonts u used etc makes the erp look so good… plan how the sidebar and all other pages will use such a design and Phosphor Icons… redesign every other section including the dashboard etc… use Material icons too when setting up the system… in short remove lucide icons from everywhere completely swap with Phosphor Icons the font u used before opening pos use it everywhere and that design implement it everywhere also."*

The POS overview / P&L design language (cream paper #FBFAF6, Fraunces serif masthead, mono uppercase eyebrows, hairline rules instead of card containers, motion/react count-ups) becomes the **system language** for the entire desktop app. Lucide icons leave the building. Phosphor takes over for the app surface; Material icons handle the setup wizard specifically.

### 15.1 The two icon planes

| Plane | Library | Where |
| --- | --- | --- |
| **App surface** (every screen, including setup) | `@phosphor-icons/react` | sidebar, topbar, hub pages, P&L, POS, settings, hospitality, hardware, dawa, retail, every modal, every form, the setup wizard |
| **External user content** (eg. category icons) | n/a — first-letter lettermark + colour | already in v0.7.6 cart card pattern; keep as-is |

Lucide is removed entirely from `src/`. Material icons are NOT used anywhere — Phosphor is the single icon language for the whole app. The website (`/website`) is unchanged — it has its own icon set already.

### 15.2 Migration order — five patches

Each patch is a self-contained release with verifiable scope. After all five, Lucide is uninstalled.

**v0.7.14 — Sidebar**
- Swap every Lucide icon imported in `src/components/layout/sidebar.tsx` for the Phosphor equivalent (table below).
- Swap the brand wordmark in the collapsed-rail header to set with `font-family: var(--font-display)` (Fraunces).
- Active nav row: 2 px module-accent strip on the left edge + bg-foreground/[0.06] (already in v0.7.10).
- Hover: motion/react `whileHover={{ x: 2 }}` for a 100 ms tactile feel.

**v0.7.15 — Topbar + Cmd+K palette**
- Topbar (`src/components/layout/topbar.tsx`): Phosphor icons, Fraunces for the active-module name on the left, hairline border-b instead of card-style chrome.
- Cmd+K palette (`src/components/cmd-palette.tsx` if it exists, else cmdk inline): Phosphor icons in result rows, mono-uppercase section labels.

**v0.7.16 — Dashboard page redesign**
- Apply the POS-overview newspaper masthead pattern.
- Hero figure: today's revenue at clamp(64 px, 11 vw, 140 px) Fraunces + tabular-nums.
- 5-bento grid replaced with a single editorial paragraph deck under the headline.
- Quick actions become a keyboard-row list ([S] open sale, [C] customers, [R] reports, [I] inventory).
- Cream paper #FBFAF6 background. Hairline rules. No card containers.
- motion/react useMotionValue count-up on revenue + transactions count.

**v0.7.17 — Setup wizard with Phosphor**
- Replace every Lucide icon in `src/pages/setup.tsx` (plus its sub-steps) with the Phosphor equivalent.
- Setup wizard uses the SAME icon language as the rest of the app — Phosphor everywhere keeps the visual contract simple.
- Cream paper background per step. Fraunces serif on step titles.
- motion/react step entrance: `initial={{ opacity: 0, y: 12 }}` for each step body.

**v0.7.18 — Bulk Lucide → Phosphor sweep**
- Mechanical replacement across every remaining `src/**/*.tsx` and `src/**/*.ts` file.
- Mapping table at `docs/icon-mapping.md` (see §15.3 below).
- Keep one parity helper at `src/components/icons/index.ts` if a Lucide icon has no Phosphor equivalent (rare — Phosphor is comprehensive).
- Uninstall `lucide-react` from `package.json`. tsc verifies no stragglers.

**v0.7.19 — Cream-paper aesthetic on the long tail**
- Apply `#FBFAF6` background + Fraunces masthead pattern to: customers, suppliers, employees, attendance, leave, payroll, expenses, banking, all hospitality pages, all hardware pages, all dawa pages, all retail pages.
- Each page gets:
  - Masthead: mono caption + Fraunces title + 14 px description
  - Hairline rules between sections
  - No card containers — content flows in a single column with hairline separators
- Tables stay tabular but lose their thick borders; use 1 px foreground/10 hairlines.

**v0.7.20** — Stabilisation + cycle bump to v0.8.0.

### 15.3 Icon mapping table — Lucide → Phosphor

Documented in `docs/icon-mapping.md` for the bulk sweep. Excerpt of the most-used:

| Lucide | Phosphor |
| --- | --- |
| `Search` | `MagnifyingGlass` |
| `Settings` | `GearSix` |
| `User` / `Users` | `User` / `Users` |
| `ShoppingCart` | `ShoppingCart` |
| `Package` | `Package` |
| `Pill` | `Pill` |
| `Plus` | `Plus` |
| `Trash2` | `Trash` |
| `Edit3` / `Pencil` | `Pencil` |
| `Check` | `Check` |
| `X` | `X` |
| `ChevronDown` / `Up` / `Left` / `Right` | `CaretDown` / etc. |
| `ChevronsLeft` / `Right` | `CaretDoubleLeft` / `Right` |
| `ArrowLeft` / `Right` | `ArrowLeft` / `Right` |
| `MoreHorizontal` | `DotsThree` |
| `MoreVertical` | `DotsThreeVertical` |
| `Loader2` | `CircleNotch` (spin via `className="animate-spin"`) |
| `Info` | `Info` |
| `AlertCircle` | `WarningCircle` |
| `AlertTriangle` | `Warning` |
| `CheckCircle2` | `CheckCircle` |
| `Lock` / `Unlock` | `Lock` / `LockOpen` |
| `Eye` / `EyeOff` | `Eye` / `EyeSlash` |
| `Download` / `Upload` | `Download` / `Upload` / `UploadSimple` |
| `Receipt` | `Receipt` |
| `Banknote` | `Money` |
| `Wallet` | `Wallet` |
| `Smartphone` | `DeviceMobile` |
| `Monitor` | `Monitor` |
| `Calendar` / `CalendarClock` | `Calendar` / `CalendarDots` |
| `Clock` | `Clock` |
| `Tag` | `Tag` |
| `Layers` | `Stack` |
| `BarChart3` | `ChartBar` |
| `LineChart` | `ChartLine` |
| `PieChart` | `ChartPie` |
| `TrendingUp` | `TrendUp` |
| `TrendingDown` | `TrendDown` |
| `FileText` | `FileText` |
| `FileCheck` | `FileText` (with `CheckCircle` overlay if needed) |
| `FileSignature` | `Signature` |
| `Send` | `PaperPlaneTilt` |
| `Building2` | `Building` |
| `Truck` | `Truck` |
| `Coins` | `Coins` |
| `RotateCcw` | `ArrowCounterClockwise` |
| `Pause` | `Pause` |
| `Heart` | `Heart` |
| `Sparkles` | `Sparkle` |
| `Zap` | `Lightning` |
| `Calculator` | `Calculator` |
| `Bed` / `BedDouble` | `Bed` |
| `ChefHat` | `ChefHat` |
| `UtensilsCrossed` | `ForkKnife` |
| `Wrench` | `Wrench` |
| `Pill` | `Pill` |
| `Stethoscope` | `Stethoscope` |
| `Snowflake` | `Snowflake` |
| `RefreshCw` | `ArrowsClockwise` |

Special cases:
- Phosphor icons are bundled per-icon (no tree-shake issue), but the ESM package is large. We import only what we use, no barrel.
- For icons used once or twice, we accept the slight bundle hit. For the sweep, we'll spot-check `pnpm run build` post-merge.

### 15.4 Typography contract

Two CSS variables on `:root`:

```css
:root {
  --font-display: "Fraunces", "Iowan Old Style", "Cambria", "Georgia", serif;
  --font-mono: "Geist Mono", "Berkeley Mono", "JetBrains Mono", ui-monospace, monospace;
}
```

Already declared in `src/index.css`. Page mastheads use `style={{ fontFamily: "var(--font-display)" }}` inline; Tailwind's `font-mono` picks up the mono stack via the existing config.

Rules of thumb:
- Page titles: Fraunces, weight 500, clamp(24 px, 3 vw, 38 px), leading-[1.05], tracking-[-0.01em]
- Eyebrows above the title: mono, 10 px, uppercase, tracking-[0.22em], muted-foreground
- Body: Geist sans (default), 13 px / 1.45
- Numbers: mono with `tabular-nums`, never sans
- Hero figures (revenue, expiry date, count): Fraunces at clamp(48 px, 8 vw, 100 px+) with `tabular-nums`

### 15.5 Out of scope for this rollout

- Charts library (recharts) — leave as-is; matches the editorial language fine
- Toaster + dialog + sheet primitives — already redesigned
- Modal dialogs — already glass-thin or hairline-bordered, no further work needed
- Apple liquid-glass screens (login, lock, license-activation, idle-auto-lock) — explicitly preserved as designed in v0.7.x

