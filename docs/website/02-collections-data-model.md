# DUKA WEBSITE — Plan 02: Payload Collections & Telemetry Data Model

This document defines every collection, global, and field in Payload CMS. Once approved, Plan 03 references these by name. The owner must be able to do everything from `/admin` — never edit code to add a release, change a price, ban a license, or read a support ticket.

---

## 0. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                     PAYLOAD ADMIN (/admin)                  │
│  Owner sees: Releases, Customers, Licenses, Machines,       │
│              Telemetry, Tickets, Payments, Modules,         │
│              Pages content, Pricing, Settings               │
└──────────────────┬──────────────────────────────────────────┘
                   │ same Postgres
┌──────────────────┴──────────────────────────────────────────┐
│                  CUSTOMER DASHBOARD (/dashboard)            │
│  Customer sees: Their licenses, machines, downloads,        │
│                 invoices, support tickets, profile          │
└─────────────────────────────────────────────────────────────┘
                   ▲
                   │ REST + JWT
┌──────────────────┴──────────────────────────────────────────┐
│              DESKTOP APP (Tauri, the Duka ERP)              │
│  Phones home: telemetry, license check, version updates     │
│  Receives:    new release notifications, license status     │
└─────────────────────────────────────────────────────────────┘
```

Three actors: **owner** (Payload admin), **customer** (dashboard), **machine** (Tauri app reporting telemetry). Each has its own auth tier.

---

## 1. AUTH MODEL

### 1.1 Three user types, three auth flows

**Payload Users collection** is split into roles:

| Role | Login at | Can access |
|------|----------|------------|
| `owner` | `/admin` | Full Payload admin, all collections |
| `support` | `/admin` | Read all customer data, write to Tickets, no Pricing/Settings |
| `customer` | `/login` (custom UI on marketing site) | `/dashboard/*` only — their own data |

Customer auth uses Payload's built-in auth on a separate **Customers** collection (NOT Users). The Users collection is owner+staff only.

### 1.2 Machine auth

Desktop apps authenticate to the API with a **machine token** (issued at activation, distinct from license key). Token in `Authorization: Bearer <token>` header. Tokens stored hashed in DB.

### 1.3 Payload roles config

```ts
// payload.config.ts users collection
admin: { useAsTitle: 'email' },
auth: true,
fields: [
  { name: 'role', type: 'select', options: ['owner', 'support'], required: true },
  { name: 'name', type: 'text', required: true },
],
access: {
  create: ({ req: { user } }) => user?.role === 'owner',
  // owner can manage everyone; support is read-only on this collection
}
```

---

## 2. COLLECTIONS

Each collection lives in `src/collections/<Name>.ts`. Naming: PascalCase singular.

### 2.1 `Customers` (auth-enabled)

The customer-facing user. Logs in to dashboard. Can hold multiple licenses (one per business or branch).

```ts
{
  slug: 'customers',
  auth: true,                // Payload's email/password auth
  admin: { useAsTitle: 'email' },
  fields: [
    // Core identity
    { name: 'fullName', type: 'text', required: true },
    { name: 'businessName', type: 'text', required: true },           // "Mama Mary's Pharmacy"
    { name: 'phone', type: 'text', required: true },                   // +254 7XX XXX XXX
    { name: 'whatsapp', type: 'text' },                                // optional second number
    { name: 'kraPin', type: 'text' },                                  // KRA PIN, optional but recommended
    // Address
    { name: 'country', type: 'text', defaultValue: 'Kenya' },
    { name: 'county', type: 'select', options: KE_COUNTIES },          // 47 KE counties enum
    { name: 'town', type: 'text' },
    { name: 'physicalAddress', type: 'textarea' },
    // Business profile
    { name: 'businessType', type: 'select', options: [
      'pharmacy', 'mini_mart', 'duka', 'salon', 'restaurant', 'hardware', 'electronics', 'other'
    ]},
    { name: 'employeeCount', type: 'select', options: ['1', '2-5', '6-15', '16-50', '50+'] },
    // Marketing
    { name: 'howDidYouHear', type: 'select', options: ['google', 'friend', 'social', 'reseller', 'other'] },
    { name: 'newsletterOptIn', type: 'checkbox', defaultValue: true },
    // System
    { name: 'emailVerified', type: 'checkbox', defaultValue: false },
    { name: 'emailVerificationToken', type: 'text', admin: { hidden: true } },
    { name: 'lastSeenAt', type: 'date' },
    { name: 'status', type: 'select', options: ['active', 'suspended', 'banned'], defaultValue: 'active' },
    // Internal owner notes
    { name: 'internalNotes', type: 'richText', access: { read: ownerOnly } },
  ],
  access: {
    read: ({ req: { user }, id }) => {
      if (user?.role === 'owner' || user?.role === 'support') return true;
      // customer can only read themselves
      return user?.collection === 'customers' && user.id === id;
    },
    update: sameAsRead,
    delete: ownerOnly,
    create: () => true,                          // public sign-up allowed
  },
}
```

### 2.2 `Licenses`

The product entitlement. One Customer can hold many. Each License has a unique key, a tier, and rules about which Releases it can install.

```ts
{
  slug: 'licenses',
  admin: { useAsTitle: 'licenseKey', defaultColumns: ['licenseKey', 'customer', 'tier', 'status', 'expiresAt'] },
  fields: [
    { name: 'licenseKey', type: 'text', required: true, unique: true,    // DUKA-XXXX-XXXX-XXXX
      admin: { description: 'Auto-generated on creation. Cannot be edited.' } },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true, hasMany: false },
    { name: 'tier', type: 'select', options: [
      'trial',                                                          // 30-day free
      'starter',                                                        // 1 branch
      'business',                                                       // up to 5 branches
      'enterprise',                                                     // unlimited
    ], required: true },
    { name: 'modules', type: 'select', hasMany: true, options: [
      'core', 'dawa', 'retail', 'salon', 'restaurant', 'hardware'
    ], required: true, defaultValue: ['core'] },
    { name: 'maxBranches', type: 'number', defaultValue: 1 },
    { name: 'maxMachines', type: 'number', defaultValue: 3 },           // PCs that can install with this key
    // Lifecycle
    { name: 'status', type: 'select', options: [
      'trial',           // free, ticking down
      'active',          // paid, valid
      'lapsed',          // trial ended, awaiting payment
      'suspended',       // owner banned (refund/abuse)
      'maintenance_expired', // license valid for current major, but no minor updates
      'cancelled',
    ], required: true, defaultValue: 'trial' },
    { name: 'trialStartedAt', type: 'date' },
    { name: 'trialEndsAt', type: 'date' },
    { name: 'paidAt', type: 'date' },                                    // when first license fee was paid
    { name: 'maintenanceUntil', type: 'date' },                          // last paid maintenance year covers up to this date
    // Major version cap — a v1 license cannot install v2+ without paying again
    { name: 'majorVersionCap', type: 'number', defaultValue: 1,
      admin: { description: 'Maximum major version this license can install. Increment when customer pays for major upgrade.' } },
    // Pricing snapshot (so historical changes don't rewrite what they paid)
    { name: 'priceFeePaid', type: 'number' },                            // KES one-time fee
    { name: 'priceMaintenancePaid', type: 'number' },                    // KES per year
    { name: 'currency', type: 'text', defaultValue: 'KES' },
    // Cloud backup add-on
    { name: 'cloudBackupEnabled', type: 'checkbox', defaultValue: false },
    { name: 'cloudBackupExpiresAt', type: 'date' },
    // Audit
    { name: 'issuedBy', type: 'relationship', relationTo: 'users' },     // null = system, else owner/support
    { name: 'internalNotes', type: 'richText', access: { read: ownerOnly } },
  ],
  hooks: {
    beforeChange: [generateLicenseKeyHook, computeTrialEndsAtHook],
  },
  access: {
    read: ({ req: { user }, doc }) => {
      if (user?.role === 'owner' || user?.role === 'support') return true;
      return user?.collection === 'customers' && doc?.customer === user.id;
    },
    create: ownerOnly,         // licenses created by Paystack webhook (system) or owner
    update: ownerOnly,
    delete: ownerOnly,
  },
}
```

### 2.3 `Machines`

Every install of the desktop app. One License has many Machines (up to `maxMachines`). Telemetry events join here.

```ts
{
  slug: 'machines',
  admin: { useAsTitle: 'hostname', defaultColumns: ['hostname', 'license', 'os', 'lastSeenAt', 'currentVersion'] },
  fields: [
    { name: 'machineId', type: 'text', required: true, unique: true,    // hash of CPU+motherboard+disk fingerprint
      admin: { description: 'Hardware fingerprint, generated by the desktop app.' } },
    { name: 'authToken', type: 'text', required: true, admin: { hidden: true } },  // hashed
    { name: 'license', type: 'relationship', relationTo: 'licenses', required: true },
    // Identity
    { name: 'hostname', type: 'text' },                                 // computer name from OS
    { name: 'os', type: 'select', options: ['windows', 'linux', 'macos'], defaultValue: 'windows' },
    { name: 'osVersion', type: 'text' },
    { name: 'arch', type: 'select', options: ['x86_64', 'aarch64'] },
    // App state
    { name: 'currentVersion', type: 'text' },                           // "0.1.6"
    { name: 'activeModule', type: 'select', options: ['core', 'dawa', 'retail'] },
    { name: 'branchName', type: 'text' },                               // self-reported from setup
    // Telemetry rollups (denormalised for fast admin display)
    { name: 'productCount', type: 'number' },
    { name: 'employeeCount', type: 'number' },
    { name: 'salesCountLast30d', type: 'number' },
    { name: 'salesValueLast30d', type: 'number' },
    { name: 'lastSyncAt', type: 'date' },                               // last time it phoned home
    { name: 'firstSeenAt', type: 'date' },
    { name: 'lastSeenAt', type: 'date' },
    // Geo
    { name: 'lastIp', type: 'text', admin: { description: 'Used for city-level geolocation only.' } },
    { name: 'lat', type: 'number' },
    { name: 'lng', type: 'number' },
    { name: 'city', type: 'text' },
    { name: 'county', type: 'text' },
    // Network mode
    { name: 'networkMode', type: 'select', options: ['standalone', 'lan_master', 'lan_client'] },
    { name: 'lanPeers', type: 'array', fields: [
      { name: 'peerMachineId', type: 'text' },
      { name: 'role', type: 'select', options: ['master', 'client'] },
    ]},
    // Integration status
    { name: 'integrations', type: 'group', fields: [
      { name: 'etimsConfigured', type: 'checkbox' },
      { name: 'mpesaConfigured', type: 'checkbox' },
      { name: 'paystackConfigured', type: 'checkbox' },
      { name: 'shaConfigured', type: 'checkbox' },
    ]},
    // Health
    { name: 'status', type: 'select', options: ['active', 'idle', 'offline', 'deactivated'], defaultValue: 'active' },
    { name: 'deactivatedAt', type: 'date' },
    { name: 'deactivationReason', type: 'select', options: ['user_initiated', 'license_revoked', 'replaced'] },
  ],
  access: {
    read: ({ req: { user }, doc }) => {
      if (user?.role === 'owner' || user?.role === 'support') return true;
      // customer reads only their own machines (via their licenses)
      // implemented by where-clause middleware
      return false;
    },
    create: () => true,        // desktop app can self-register on activation
    update: machineOrOwner,
    delete: ownerOnly,
  },
}
```

### 2.4 `Releases`

Every version of the desktop app. CI uploads a new entry on every successful tag-build. Marketing site reads `where: status='published'` to display downloads.

```ts
{
  slug: 'releases',
  admin: { useAsTitle: 'version', defaultColumns: ['version', 'channel', 'status', 'publishedAt', 'downloadCount'] },
  fields: [
    { name: 'version', type: 'text', required: true, unique: true,      // "0.1.6", "1.0.0-beta.2"
      admin: { description: 'Semver. Auto-set by CI but editable.' } },
    { name: 'majorVersion', type: 'number', required: true,             // 0 / 1 / 2 — for licence-cap matching
      admin: { description: 'First number from version. Used to enforce major-version license cap.' } },
    { name: 'channel', type: 'select', options: ['stable', 'beta', 'alpha'], defaultValue: 'stable' },
    { name: 'status', type: 'select', options: ['draft', 'published', 'rolled_back', 'archived'],
      defaultValue: 'draft', required: true },
    // Download artifacts (uploaded by CI to R2, URLs stored here)
    { name: 'windowsMsiUrl', type: 'text' },
    { name: 'windowsNsisUrl', type: 'text' },
    { name: 'windowsMsiSize', type: 'number' },                         // bytes
    { name: 'windowsNsisSize', type: 'number' },
    { name: 'updaterSignature', type: 'text', admin: { description: 'Tauri updater signature for the NSIS installer.' } },
    { name: 'sha256Msi', type: 'text' },
    { name: 'sha256Nsis', type: 'text' },
    // Release notes
    { name: 'title', type: 'text', admin: { description: 'e.g. "v0.2.0 — Banking & Recurring Invoices"' } },
    { name: 'summary', type: 'textarea', admin: { description: 'One-paragraph summary, shown on changelog page.' } },
    { name: 'changelog', type: 'richText', admin: { description: 'Full changelog. Markdown-style rich text.' } },
    { name: 'highlights', type: 'array', fields: [
      { name: 'title', type: 'text' },
      { name: 'description', type: 'textarea' },
      { name: 'icon', type: 'text', admin: { description: 'Lucide icon name, e.g. "ShoppingCart"' } },
      { name: 'screenshot', type: 'upload', relationTo: 'media' },
    ]},
    { name: 'breaking', type: 'array', fields: [{ name: 'description', type: 'textarea' }] },
    { name: 'requiresMigration', type: 'checkbox' },
    { name: 'migrationNotes', type: 'textarea' },
    // Distribution control
    { name: 'minMajorVersionToUpgrade', type: 'number',
      admin: { description: 'Customers with majorVersionCap below this cannot upgrade — they need to buy major upgrade.' } },
    { name: 'requiresPaidLicense', type: 'checkbox', defaultValue: false,
      admin: { description: 'When true, trial users cannot download.' } },
    // Telemetry
    { name: 'downloadCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'installCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    // Audit
    { name: 'publishedAt', type: 'date' },
    { name: 'publishedBy', type: 'relationship', relationTo: 'users' },
    { name: 'rolledBackAt', type: 'date' },
    { name: 'rolledBackReason', type: 'textarea' },
  ],
  access: {
    read: ({ req: { user }, doc }) => {
      // Owner sees everything
      if (user?.role === 'owner' || user?.role === 'support') return true;
      // Public/customers see only published stable releases
      return doc?.status === 'published';
    },
    create: ownerOrSystem,    // system = CI calling /api/releases with secret
    update: ownerOrSystem,
    delete: ownerOnly,
  },
}
```

### 2.5 `TelemetryEvents`

Append-only log of everything machines report. Used for debugging, adoption analytics, support investigation.

```ts
{
  slug: 'telemetry-events',
  admin: { useAsTitle: 'eventType', defaultColumns: ['eventType', 'machine', 'severity', 'createdAt'] },
  fields: [
    { name: 'machine', type: 'relationship', relationTo: 'machines', required: true },
    { name: 'eventType', type: 'select', required: true, options: [
      'app_started', 'app_closed', 'sync_completed',
      'sale_completed',            // counts only, no PII
      'license_validated', 'license_invalid', 'license_expired',
      'crash', 'panic', 'db_error', 'migration_error',
      'integration_error',          // mpesa/etims/sha failure
      'updater_check', 'updater_download', 'updater_installed',
      'manual_diagnostic',          // owner-pulled dump
      'feedback_submitted',
    ]},
    { name: 'severity', type: 'select', options: ['debug', 'info', 'warn', 'error', 'fatal'],
      defaultValue: 'info' },
    { name: 'appVersion', type: 'text' },
    { name: 'message', type: 'textarea' },
    { name: 'stackTrace', type: 'code', admin: { language: 'text' } },
    { name: 'metadata', type: 'json',
      admin: { description: 'Arbitrary structured data. NEVER include customer PII or business data.' } },
    { name: 'sessionId', type: 'text' },
    { name: 'ipAddress', type: 'text' },
  ],
  timestamps: true,             // createdAt indexed
  indexes: [
    { fields: ['machine', 'createdAt'] },
    { fields: ['eventType', 'severity'] },
    { fields: ['severity', 'createdAt'] },                              // for "show me all errors today"
  ],
  access: {
    read: ownerOrSupport,
    create: () => true,        // any machine can write its own
    update: ownerOnly,
    delete: ownerOnly,
  },
}
```

**Retention:** scheduled job (Payload Job Queue) deletes events older than 90 days for `severity in (debug, info)`. Errors retained 1 year. Set up via `node-cron` or Vercel Cron.

### 2.6 `Payments`

Every Paystack transaction. Source of truth for revenue.

```ts
{
  slug: 'payments',
  admin: { useAsTitle: 'paystackReference', defaultColumns: ['paystackReference', 'customer', 'amount', 'status', 'createdAt'] },
  fields: [
    { name: 'paystackReference', type: 'text', required: true, unique: true },
    { name: 'paystackTransactionId', type: 'text' },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true },
    { name: 'license', type: 'relationship', relationTo: 'licenses' },
    // Money
    { name: 'amount', type: 'number', required: true,
      admin: { description: 'In KES (or whatever currency).' } },
    { name: 'currency', type: 'text', defaultValue: 'KES' },
    { name: 'paystackFees', type: 'number' },
    { name: 'netAmount', type: 'number' },                              // after fees
    // Method
    { name: 'channel', type: 'select', options: ['card', 'mpesa', 'bank_transfer', 'apple_pay', 'mobile_money'] },
    { name: 'mpesaReceiptNumber', type: 'text' },
    { name: 'cardLast4', type: 'text' },
    { name: 'cardBrand', type: 'text' },
    // Purpose
    { name: 'purpose', type: 'select', required: true, options: [
      'license_fee',                  // initial one-time fee
      'maintenance_renewal',          // yearly maintenance
      'major_upgrade',                // pay to bump majorVersionCap
      'cloud_backup',                 // monthly add-on
      'extra_branch',                 // add another branch to existing license
      'extra_machine',                // raise maxMachines
    ]},
    // Status
    { name: 'status', type: 'select', required: true, options: [
      'pending', 'success', 'failed', 'reversed', 'refunded'
    ]},
    { name: 'failureReason', type: 'text' },
    // Refund
    { name: 'refundedAt', type: 'date' },
    { name: 'refundReason', type: 'textarea' },
    { name: 'refundedBy', type: 'relationship', relationTo: 'users' },
    // Audit
    { name: 'paidAt', type: 'date' },
    { name: 'rawWebhookPayload', type: 'json', admin: { readOnly: true, hidden: true } },
  ],
  access: {
    read: ({ req: { user }, doc }) => {
      if (user?.role === 'owner' || user?.role === 'support') return true;
      return user?.collection === 'customers' && doc?.customer === user.id;
    },
    create: () => true,        // webhook
    update: ownerOnly,
    delete: ownerOnly,
  },
}
```

### 2.7 `SupportTickets`

Customer raises, support replies, owner has overview.

```ts
{
  slug: 'support-tickets',
  admin: { useAsTitle: 'subject', defaultColumns: ['subject', 'customer', 'status', 'priority', 'updatedAt'] },
  fields: [
    { name: 'ticketNumber', type: 'text', unique: true,                 // DUKA-T-2026-001234
      admin: { description: 'Auto-generated.' } },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true },
    { name: 'license', type: 'relationship', relationTo: 'licenses' },
    { name: 'machine', type: 'relationship', relationTo: 'machines' },
    { name: 'subject', type: 'text', required: true },
    { name: 'category', type: 'select', options: [
      'bug', 'feature_request', 'question', 'billing', 'data_recovery', 'install_help', 'other'
    ]},
    { name: 'priority', type: 'select', options: ['low', 'normal', 'high', 'urgent'], defaultValue: 'normal' },
    { name: 'status', type: 'select', options: [
      'new', 'in_progress', 'awaiting_customer', 'resolved', 'closed'
    ], defaultValue: 'new' },
    { name: 'description', type: 'richText' },
    { name: 'attachments', type: 'array', fields: [
      { name: 'file', type: 'upload', relationTo: 'media' },
    ]},
    { name: 'attachedDiagnosticId', type: 'relationship', relationTo: 'telemetry-events',
      admin: { description: 'If customer attached a manual diagnostic dump.' } },
    { name: 'thread', type: 'array', fields: [
      { name: 'sender', type: 'select', options: ['customer', 'support', 'owner', 'system'] },
      { name: 'senderName', type: 'text' },
      { name: 'body', type: 'richText' },
      { name: 'attachments', type: 'array', fields: [{ name: 'file', type: 'upload', relationTo: 'media' }] },
      { name: 'sentAt', type: 'date', defaultValue: () => new Date() },
    ]},
    { name: 'assignedTo', type: 'relationship', relationTo: 'users' },
    { name: 'resolvedAt', type: 'date' },
    { name: 'satisfactionRating', type: 'number', min: 1, max: 5 },     // closed-ticket rating
  ],
}
```

### 2.8 `Pages` (CMS)

Every long-form public page (privacy, terms, refunds, ToU, careers, comparison pages). NOT used for the landing page or pricing — those have their own components reading from Globals.

```ts
{
  slug: 'pages',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'kind', type: 'select', options: ['legal', 'help', 'about', 'compare'] },
    { name: 'body', type: 'richText' },
    { name: 'seo', type: 'group', fields: [
      { name: 'metaTitle', type: 'text' },
      { name: 'metaDescription', type: 'textarea' },
      { name: 'ogImage', type: 'upload', relationTo: 'media' },
    ]},
    { name: 'lastReviewedAt', type: 'date' },
  ],
}
```

### 2.9 `BlogPosts` / `Changelog` (separate collections)

```ts
// Changelog — sourced from Releases collection automatically. NOT a separate collection.
//   The /changelog page reads from Releases where status='published'.

// BlogPosts — for marketing posts
{
  slug: 'blog-posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'body', type: 'richText' },
    { name: 'category', type: 'select', options: ['product', 'industry', 'tutorial', 'announcement'] },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'publishedAt', type: 'date' },
    { name: 'status', type: 'select', options: ['draft', 'published'], defaultValue: 'draft' },
    { name: 'seo', type: 'group', fields: [...] },
  ],
}
```

### 2.10 `Modules`

The marketable verticals. Owner can add a new module page (Hardware, Salon) without code.

```ts
{
  slug: 'modules',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'moduleId', type: 'select', required: true, unique: true, options: [
      'core', 'dawa', 'retail', 'salon', 'restaurant', 'hardware', 'electronics'
    ]},
    { name: 'name', type: 'text', required: true },                    // "Dawa Pharmacy"
    { name: 'shortName', type: 'text', required: true },               // "Dawa"
    { name: 'tagline', type: 'text', required: true },                 // "Run your pharmacy. Calm and compliant."
    { name: 'available', type: 'select', options: ['live', 'beta', 'planned'], defaultValue: 'planned' },
    { name: 'priority', type: 'number', defaultValue: 100 },           // for sort order on /modules
    { name: 'gradient', type: 'select', options: ['amber', 'teal', 'orange', 'blue', 'pink'] },
    // Marketing copy
    { name: 'shortDescription', type: 'textarea', required: true },
    { name: 'longDescription', type: 'richText' },
    { name: 'features', type: 'array', fields: [
      { name: 'title', type: 'text' },
      { name: 'description', type: 'textarea' },
      { name: 'icon', type: 'text' },                                  // Lucide name
      { name: 'screenshot', type: 'upload', relationTo: 'media' },
    ]},
    { name: 'screenshots', type: 'array', fields: [
      { name: 'image', type: 'upload', relationTo: 'media' },
      { name: 'caption', type: 'text' },
    ]},
    { name: 'targetCustomers', type: 'array', fields: [
      { name: 'label', type: 'text' },                                 // "Pharmacies registered with PPB"
    ]},
    { name: 'compliance', type: 'array', fields: [
      { name: 'item', type: 'text' },                                  // "PPB Pharmacy & Poisons Act compliant"
    ]},
    // Pricing override per module (optional — uses global pricing otherwise)
    { name: 'pricing', type: 'group', fields: [
      { name: 'starterFee', type: 'number' },                          // KES one-time
      { name: 'businessFee', type: 'number' },
      { name: 'maintenanceYearly', type: 'number' },
    ]},
    { name: 'seo', type: 'group', fields: [...] },
  ],
}
```

Seed at first deploy: `core` (always live), `dawa` (live), `retail` (live), all others as `planned`.

### 2.11 `Pricing` (Global)

Single instance. Editable from `/admin/globals/pricing`.

```ts
{
  slug: 'pricing',
  fields: [
    { name: 'starter', type: 'group', fields: [
      { name: 'oneTimeFee', type: 'number', defaultValue: 30000 },
      { name: 'maintenanceYearly', type: 'number', defaultValue: 12000 },
      { name: 'maxBranches', type: 'number', defaultValue: 1 },
      { name: 'maxMachines', type: 'number', defaultValue: 3 },
      { name: 'features', type: 'array', fields: [{ name: 'item', type: 'text' }] },
    ]},
    { name: 'business', type: 'group', fields: [...] },
    { name: 'enterprise', type: 'group', fields: [
      { name: 'priceLabel', type: 'text', defaultValue: 'Contact us' }, // hides number
      { name: 'features', type: 'array', fields: [...] },
    ]},
    { name: 'cloudBackupMonthly', type: 'number', defaultValue: 500 },
    { name: 'extraBranchOneTime', type: 'number', defaultValue: 15000 },
    { name: 'extraMachineOneTime', type: 'number', defaultValue: 5000 },
    { name: 'majorUpgradeDiscount', type: 'number', defaultValue: 50,
      admin: { description: 'Percent off the new major version fee for existing license holders.' } },
    { name: 'currency', type: 'text', defaultValue: 'KES' },
    { name: 'trialDays', type: 'number', defaultValue: 30 },
    { name: 'compareTable', type: 'array', fields: [
      { name: 'feature', type: 'text' },
      { name: 'starter', type: 'text' },                                // "✓" or "✗" or "1 branch"
      { name: 'business', type: 'text' },
      { name: 'enterprise', type: 'text' },
    ]},
  ],
}
```

### 2.12 `Settings` (Global)

```ts
{
  slug: 'settings',
  fields: [
    // Brand (mostly read-only, set via env / brand.ts)
    { name: 'brandName', type: 'text', defaultValue: 'Duka', admin: { readOnly: true } },
    { name: 'tagline', type: 'text' },
    // Contact channels
    { name: 'supportEmail', type: 'email', defaultValue: 'support@sokoos.co.ke' },
    { name: 'salesEmail', type: 'email' },
    { name: 'whatsappNumber', type: 'text' },                           // +254... shown as wa.me link
    { name: 'phoneNumber', type: 'text' },
    { name: 'office', type: 'group', fields: [
      { name: 'address', type: 'textarea' },
      { name: 'mapEmbedUrl', type: 'text' },
      { name: 'workingHours', type: 'text' },
    ]},
    // Social
    { name: 'social', type: 'group', fields: [
      { name: 'twitter', type: 'text' },
      { name: 'linkedin', type: 'text' },
      { name: 'youtube', type: 'text' },
      { name: 'github', type: 'text' },
    ]},
    // SEO defaults
    { name: 'defaultMetaTitle', type: 'text' },
    { name: 'defaultMetaDescription', type: 'textarea' },
    { name: 'defaultOgImage', type: 'upload', relationTo: 'media' },
    // Footer
    { name: 'footerCopy', type: 'richText' },
    { name: 'kraPin', type: 'text' },                                   // shown in footer
    // Feature flags (global toggles)
    { name: 'flags', type: 'group', fields: [
      { name: 'allowSelfSignup', type: 'checkbox', defaultValue: true },
      { name: 'allowSelfServeCheckout', type: 'checkbox', defaultValue: true },
      { name: 'showBetaModules', type: 'checkbox', defaultValue: false },
      { name: 'showPricing', type: 'checkbox', defaultValue: true },
      { name: 'maintenanceMode', type: 'checkbox', defaultValue: false },
    ]},
    // Trial behaviour
    { name: 'trialLockoutMode', type: 'select', options: ['soft', 'readonly', 'hard'], defaultValue: 'soft' },
  ],
}
```

### 2.13 `LandingPage` (Global)

Editable hero / sections of `/`. Owner changes copy without touching code.

```ts
{
  slug: 'landing-page',
  fields: [
    { name: 'hero', type: 'group', fields: [
      { name: 'eyebrow', type: 'text', defaultValue: 'Run your business. From your duka.' },
      { name: 'headline', type: 'text', required: true },
      { name: 'subheadline', type: 'textarea' },
      { name: 'primaryCtaLabel', type: 'text', defaultValue: 'Start free trial' },
      { name: 'secondaryCtaLabel', type: 'text', defaultValue: 'See it in action' },
      { name: 'screenshotPosition', type: 'select', options: ['below', 'right', 'bento'] },
      { name: 'screenshot', type: 'upload', relationTo: 'media' },
    ]},
    { name: 'logoCloud', type: 'array', fields: [
      { name: 'name', type: 'text' },
      { name: 'logo', type: 'upload', relationTo: 'media' },
    ]},
    { name: 'modulesSection', type: 'group', fields: [
      { name: 'eyebrow', type: 'text', defaultValue: 'Built for your trade' },
      { name: 'headline', type: 'text' },
      { name: 'description', type: 'textarea' },
    ]},
    { name: 'featuresBento', type: 'array', fields: [
      { name: 'title', type: 'text' },
      { name: 'description', type: 'textarea' },
      { name: 'image', type: 'upload', relationTo: 'media' },
      { name: 'span', type: 'select', options: ['1', '2', '3'], defaultValue: '1' },
    ]},
    { name: 'testimonials', type: 'array', fields: [
      { name: 'quote', type: 'textarea' },
      { name: 'name', type: 'text' },
      { name: 'role', type: 'text' },
      { name: 'businessName', type: 'text' },
      { name: 'photo', type: 'upload', relationTo: 'media' },
    ]},
    { name: 'closingCta', type: 'group', fields: [
      { name: 'headline', type: 'text' },
      { name: 'subheadline', type: 'text' },
    ]},
  ],
}
```

### 2.14 `Media`

Default Payload upload collection, configured for R2.

```ts
{
  slug: 'media',
  upload: {
    staticDir: 'media',
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: 576, position: 'centre' },
      { name: 'feature', width: 1200, height: 800, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*', 'video/mp4'],
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'caption', type: 'text' },
  ],
}
// All files routed to Cloudflare R2 via @payloadcms/storage-s3.
```

---

## 3. RELATIONSHIPS DIAGRAM

```
Customer ──< License ──< Machine ──< TelemetryEvent
              │              │
              │              └──< (network: lan_master/client refs other Machine)
              │
              ├──< Payment
              │
              └──< (Module via license.modules[])

Customer ──< SupportTicket >── License/Machine

Release   (independent — referenced by Machine.currentVersion text)
Module    (independent — referenced by License.modules[])
```

---

## 4. KEY HOOKS / BUSINESS LOGIC

### 4.1 `generateLicenseKeyHook`
- Triggered: `Licenses.beforeChange` on create.
- Generates `DUKA-XXXX-XXXX-XXXX` format (16 chars after prefix, base32 alphabet, validates uniqueness).
- Sets `trialStartedAt = now`, `trialEndsAt = now + Settings.pricing.trialDays`.

### 4.2 Paystack webhook handler (`/api/paystack/webhook`)
- Validates Paystack signature header.
- Looks up payment by `reference`.
- On `charge.success`:
  - `purpose = 'license_fee'` → set License.status='active', License.paidAt=now, License.maintenanceUntil = now + 1 year.
  - `purpose = 'maintenance_renewal'` → extend maintenanceUntil by 1 year from current value.
  - `purpose = 'major_upgrade'` → bump majorVersionCap to latest stable major.
  - `purpose = 'cloud_backup'` → set cloudBackupExpiresAt = now + 30 days.
  - Send Resend email to customer with receipt + license details.

### 4.3 Trial expiry job (cron, daily 2am)
- Find `Licenses where status='trial' and trialEndsAt < now`.
- Set `status = 'lapsed'`.
- Email customer ("your trial ended; pay to continue") and set License so the next machine check-in triggers a soft-lock in the desktop app.

### 4.4 Telemetry rollup job (cron, every 15 min)
- For each Machine that synced in the last 15 min, recompute denormalised counters (productCount, salesCountLast30d, salesValueLast30d).

### 4.5 Geolocation enrichment (machine create/update)
- On Machine create or `lastIp` change: call MaxMind / IPinfo with rate-limit, set `lat`, `lng`, `city`, `county`. Cache by IP.

### 4.6 Release publish hook
- On `Releases.afterChange` when `status` becomes `published`:
  - Set `publishedAt = now`, `publishedBy = current user`.
  - Notify webhook subscribers (none at launch).
  - Optionally send email to customers with `License.maintenanceUntil > now AND license.majorVersionCap >= release.majorVersion` ("v0.2.0 is now available").

### 4.7 License validation endpoint (`/api/licenses/validate`)
- Public, called by desktop app on every startup.
- Body: `{ licenseKey, machineId, currentVersion }`.
- Returns: `{ status, expiresAt, modules, maxBranches, lockoutMode, latestVersion, mustUpgrade }`.
- Side-effects: updates Machine.lastSeenAt, currentVersion.

---

## 5. INDEXING STRATEGY

For Postgres performance under scale:

- `Customers (email)` unique idx (already from auth)
- `Licenses (licenseKey)` unique idx
- `Licenses (customer)` idx
- `Licenses (status, trialEndsAt)` composite idx (for cron)
- `Machines (machineId)` unique idx
- `Machines (license)` idx
- `Machines (lastSeenAt DESC)` idx (for "recent activity")
- `TelemetryEvents (machine, createdAt DESC)` composite idx
- `TelemetryEvents (eventType, severity, createdAt)` composite idx
- `Payments (paystackReference)` unique idx
- `Releases (status, channel, publishedAt DESC)` composite idx

Add via Drizzle migrations.

---

## 6. ACCESS CONTROL HELPERS

```ts
// src/access/index.ts
export const ownerOnly = ({ req }) => req.user?.role === 'owner';
export const ownerOrSupport = ({ req }) => ['owner', 'support'].includes(req.user?.role ?? '');
export const ownerOrSystem = ({ req }) =>
  req.user?.role === 'owner' || req.headers['x-system-token'] === process.env.PAYLOAD_SYSTEM_TOKEN;
export const sameAsRead = (args) => /* delegate */;
export const customerSelfOnly = ({ req }, doc) =>
  req.user?.collection === 'customers' && req.user?.id === doc?.customer;
```

---

## 7. WHAT'S NEXT

Plan 02 done. Next:
- **Plan 03** — Page-by-page spec for marketing site + customer dashboard. References these collections by slug.
- **Plan 04** — CI/CD pipeline (GitHub → R2 → Payload Releases entry).
- **Plan 05** — Telemetry SDK in the Tauri desktop app.
- **Plan 06** — Acceptance test checklist.

Reply "go" if this data model is good, and I'll write Plan 03.

If you want changes:
- Add/remove fields on any collection
- Different status enums
- Different access control
- Pricing tier names you prefer
say which.
