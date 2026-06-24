# POS polish + customer display — architecture plan

**Status:** plan only. Implementation gated on review.
**Scope:** desktop app (`/src/`, `/src-tauri/`) — none of this touches the website.
**Owner:** built once, ships in v0.10.x.

---

## 1. Hardware module — broken "create quote" CTA

### What's broken
On `/hardware/...` the quote button shows: *"Use POS quote or the contractor page to build quotation"* — but doesn't navigate. It's a dead-end string.

### Root cause (suspected, to confirm)
The Hardware quote action probably calls a placeholder handler that toasts the message instead of routing. Quote creation lives in two places:
- POS quote flow (Quote-as-Sale, ring up + mark "quote" instead of "sale")
- Contractor-account page (contractor-bound quotes with credit terms)

### Fix plan
Replace the toast with a proper picker dialog:

```
┌─ Create a quote ──────────────────────────────┐
│                                               │
│  ○ Quick quote (POS-style)                    │
│    Add items at the till. Print / WhatsApp.   │
│    [Open POS in quote mode]                   │
│                                               │
│  ○ Contractor quote                           │
│    Bound to a contractor account, credit      │
│    terms, aged receivables.                   │
│    [Open contractors page]                    │
│                                               │
└───────────────────────────────────────────────┘
```

Each option is a real `<Button>` that navigates. The dialog auto-opens
when the user clicks the contextual "Create quote" CTA from the
Hardware dashboard or the contractor list.

### Cross-module audit
Sweep every module looking for the same pattern (string suggesting
navigation but no actual route). Suspects to verify:

| Module | Likely offenders |
|---|---|
| Pharmacy (Dawa) | "Open prescriber list" if no prescriber selected; "go to PPB register" copy |
| Retail | "Manage variants" hint when variants empty; "Set up suppliers" empty-state |
| Hospitality | "Open KOT printer settings" hint; "Manage tables" placeholder |
| Hardware | quote button (above) + "Manage parts catalog" copy |
| Pro (multi-trade) | inherits all four |

Each one should resolve to either:
1. A real route, or
2. A picker dialog that lists routes the user can pick from, or
3. An inline form that does the work without navigation.

No more dead-end copy.

---

## 2. POS "New sale" → Open Shift dialog first

### What should happen
Clicking **New sale** from the dashboard should check whether the cashier has an open shift. If not, prompt them to open one first (declare opening cash drawer, set discount permissions, etc.). If yes, go straight to POS.

### Flow

```
[Dashboard → New sale clicked]
         │
         ▼
   shift open for current cashier?
   ┌──────────────┬────────────────┐
   yes            no
   ▼              ▼
go POS         show Open Shift dialog
                (modal — not a side route)
                  ▼
               cashier fills opening cash + notes
                  ▼
               shift row created in DB
                  ▼
               redirect to POS
```

### Dialog details
- Header: "Open shift" + cashier name + branch
- Field: opening cash drawer (KES, default 0)
- Field: notes (optional, free text)
- Footer: [Cancel] [Open shift & start sale]
- Cancel returns to the dashboard (no sale started)

### Persistence
A shift row already exists (or we add one): `shifts` table with
`{id, cashier_id, branch_id, opened_at, opened_with_cash, closed_at,
closed_with_cash, status: 'open' | 'closed'}`. The POS reads the
current open shift and binds every sale to it.

### What this fixes
- Z-reports become accurate (each sale ties to a shift)
- Cash-drawer reconciliation actually works at end-of-day
- Multi-cashier till hand-off has a real audit trail

---

## 3. Green-color sweep — find and remove

### Why it matters
The committed brand (per `src/index.css` and `globals.css`) is warm-luxe
**espresso + cream + copper**. Green is explicitly banned:

> ✗ NO green/blue/purple/teal anywhere

But green has crept back in. Candidates to audit:

| File / area | Likely green source |
|---|---|
| Open Shift dialog | "active shift" indicator pill |
| `src/components/admin/status-dot.tsx` | `positive: var(--color-positive)` resolves to `#5F7E47` (moss green) |
| `src/components/admin/payment-card.tsx` | "Paid" status uses positive tone |
| `src/components/admin/audit-entry.tsx` | "create" actions emit positive tone |
| `src/emails/templates.tsx` | `positive: '#5F7E47'` for receipt OK ticks |
| `globals.css` | `--color-positive: #B5904A` (gilded amber, OK) — but I overrode this in the admin to moss green via my JSON-LD/audit components. Need to revert to amber. |

The `--color-positive` in `globals.css` is `#B5904A` (gilded amber).
That's fine and on-brand. The admin components I built later
introduced moss-green `#5F7E47`. **Drop the moss-green entirely.**
Use:

- Success / "active" / "ok" → `#B5904A` (gilded amber, the brand's "positive" colour)
- Warning → `#C77B3F` (copper, the accent)
- Error / "rejected" / "banned" → `#B0432F` (warm clay-red)
- Idle / muted → `#7A6F5C` (taupe)

### Sweep procedure
1. `grep -rni "green\|#5[0-9A-Fa-f]\{5\}\|#3[8-A][0-9A-Fa-f]\{4\}\|emerald\|moss\|positive.*green\|green-[0-9]\{3\}" src/ src-tauri/ website/src/components/`
2. Inventory every match.
3. Replace with the corresponding brand token (gilded amber, copper, clay-red, taupe).
4. Add a regression test that fails if any of these colour strings reappear in a future PR.

### One-line in admin/status-dot.tsx that covers most cases
The admin's `STATUS_INFO` maps for license / payment / activity all use
`var(--color-positive)`. If I change `--color-positive` in `globals.css`
from the legacy moss to `#B5904A` (gilded amber), every consumer falls
in line for free.

---

## 4. POS product card — gloss + watermark

### What's wrong
The current card is flat hairline-bordered with bare text. Reads as
"JSON in a box" rather than a product. The user describes it as
"blunt with bad colours."

### Direction
- **Soft gloss** — a subtle inner highlight along the top edge (1px
  cream → transparent gradient) + a barely-there outer shadow
  (`box-shadow: 0 1px 2px rgba(26,20,16,0.06)`). Not a Material card.
- **Category watermark** — the product's category icon (Pill, Bottle,
  Shirt, Drill, Coffee, Wine, Bread, etc.) at 25% opacity, large
  (~120px), positioned bottom-right of the card. Acts as a visual
  category cue without taking attention from the price.
- **Price hierarchy** — price sits in mono tabular-nums on the bottom
  band, slightly larger than the product name; the unit + tax flag
  are a font-mono caption above it.
- **Stock indicator** — small dot top-right: copper if low-stock,
  amber if reorder point reached, no dot otherwise. NEVER green.
- **Selected state** — copper border + inner copper wash, not a
  background shift.

### Reference
Editorial newspaper-style cards (think Cereal magazine product
panels). Hairline borders stay; the subtle gloss + watermark are the
upgrade. No drop shadows, no gradients beyond the 1px highlight, no
emoji.

### Card spec sketch
```
┌────────────────────────────────────┐
│ ┌─ image / category watermark ─┐   │
│ │                              │ ● │ ← stock dot (copper / amber / off)
│ │     [Pill icon @ 25%        ]│   │
│ │                              │   │
│ └──────────────────────────────┘   │
│                                    │
│  Panadol Extra 500mg               │ ← name (Fraunces 14px)
│  500MG · 30 TABS                   │ ← caption-mono
│                                    │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│  KSh 120     · in stock × 247      │ ← price (mono tabular)
└────────────────────────────────────┘
```

---

## 5. Customer Display — feature architecture

### What we're building
A second screen plugged into the till that shows:
- **During a sale**: live cart items + running total + suggested change
- **Idle**: a configurable playlist of media (images, videos, GIFs,
  YouTube embeds, web pages via iframe)
- **Branded**: shop logo + tagline overlay

### Why this matters
Pharmacies and retailers in Kenya already have customer-facing screens
running PowerPoint or YouTube. Bringing this into Omnix means
- The customer sees cart accuracy in real time (anti-fraud)
- Owners promote products / offers with no extra software
- The display becomes "free advertising" during slow periods

### Settings panel — `/settings/customer-display`

Owner-editable surface in the desktop's Settings module (not on the
website). Layout:

```
┌─ Customer Display ──────────────────────────────────────────┐
│                                                             │
│  Window setup                                               │
│  ─────────────                                              │
│  ▢ Enable secondary window                                  │
│  ▢ Auto-fullscreen on connected display 2                   │
│  Display rotation: [ Landscape ▾ ]                          │
│                                                             │
│  Idle media library                                         │
│  ──────────────────                                         │
│  ┌──────────────────────────────────────────┐               │
│  │ promo-banner.jpg     · 2.1 MB · default  │ [edit][delete]│
│  │ flash-sale.gif       · 4.8 MB · loop     │               │
│  │ youtube · @duka-tv   · 3:42 · 60% vol    │               │
│  │ https://omnix.co.ke/promo · iframe       │               │
│  └──────────────────────────────────────────┘               │
│  [+ Upload image]  [+ Upload video]                         │
│  [+ Add YouTube URL]  [+ Add web page URL]                  │
│                                                             │
│  Playlist behaviour                                         │
│  ──────────────────                                         │
│  ○ Sequential (in the order shown above)                    │
│  ○ Random shuffle                                           │
│  ○ Default-first then random                                │
│  Image hold time: [ 8 ] seconds                             │
│  GIF: ▢ loop forever  ▢ play once                           │
│                                                             │
│  Branding overlay                                           │
│  ────────────────                                           │
│  Shop name:  [_________________]                            │
│  Tagline:    [_________________]                            │
│  Logo:       [Choose file ▾ ]                               │
│  ▢ Show clock + weather (top-right corner)                  │
│                                                             │
│  Resource limits                                            │
│  ───────────────                                            │
│  Total media library: 2 of 50 items used (480MB / 2GB)     │
│  Single file max:    100 MB (images), 500 MB (videos)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Storage

All customer-display assets live in the desktop's local SQLite as
**file blobs** in a new `customer_display_media` table:

```
customer_display_media
  id            uuid pk
  kind          'image' | 'video' | 'gif' | 'youtube' | 'iframe' | 'logo'
  filename      text          (null for url types)
  mime          text          (null for url types)
  size_bytes    int           (null for url types)
  url           text          (null for blob types — youtube_id or iframe url)
  duration_sec  int           (videos / playlist hold time)
  is_default    bool
  display_order int
  loop          bool
  created_at    ts
```

Blobs are stored on disk under `~/.omnix/customer-display/<uuid>.<ext>`,
not as DB blobs (keeps the SQLite small + lets the customer-display
window stream files lazily). The `customer_display_media` table only
holds metadata.

### Resource limits (enforced)
- **Library cap**: 50 items max (warn at 40, hard-block at 50)
- **Total disk**: 2 GB warn, 5 GB hard-block (configurable)
- **Per-image**: 100 MB
- **Per-video**: 500 MB
- **Image dimensions**: warn if >4K (browser may drop frames)
- **Video codec**: h264 / vp9 only (Tauri's webview doesn't decode AV1
  consistently across Windows versions)
- **GIF size**: 50 MB cap (after that, suggest converting to mp4)
- **YouTube URLs**: extracted to videoId, embedded with
  `youtube-nocookie.com` to avoid tracking + bandwidth issues

### YouTube specifically
Owner pastes `https://www.youtube.com/watch?v=abc123` or
`https://youtu.be/abc123`. We extract the video ID and embed via
`<iframe src="https://www.youtube-nocookie.com/embed/abc123?
autoplay=1&loop=1&playlist=abc123&controls=0&modestbranding=1
&rel=0&playsinline=1&mute=1">`.

Mute is forced — customer-display loops are silent unless the owner
explicitly toggles per-item volume. Browsers block autoplay-with-audio
anyway.

### Multi-window architecture (Tauri)

```
┌─ POS window (cashier-facing) ────┐    ┌─ Customer display window ────┐
│                                  │    │                              │
│  Cart panel                      │    │  Live cart                   │
│  ────────────                    │ ─→ │  ─────────                   │
│  Panadol Extra      ×2  240.00   │    │  Panadol Extra      ×2 240   │
│  Amoxil 250mg       ×1  320.00   │ ◀─ │  Amoxil 250mg       ×1 320   │
│  Elastoplast        ×3  450.00   │    │  Elastoplast        ×3 450   │
│  ────────────                    │    │  ─────────                   │
│  Total          KES 1,010        │    │  TOTAL  KES 1,010            │
│  [Pay] [Hold] [Park] [Void]      │    │                              │
│                                  │    │  ↳ idles to playlist 5s      │
└──────────────────────────────────┘    │     after sale completes     │
                                        └──────────────────────────────┘
```

Implementation: Tauri's multi-window support. Open a second
`WebviewWindow` named `customer-display` that loads
`/customer-display/`. The two windows communicate via Tauri events.

### State sync
POS emits these events; customer display subscribes:

| Event | Payload |
|---|---|
| `cd:cart-add`     | `{ item, qty, lineTotal }` |
| `cd:cart-update`  | `{ item, qty, lineTotal }` |
| `cd:cart-remove`  | `{ item }` |
| `cd:cart-discount`| `{ amount, reason }` |
| `cd:totals`       | `{ subtotal, tax, total, items: ItemRow[] }` |
| `cd:payment`      | `{ method, amount, change }` |
| `cd:sale-done`    | `{ receiptNo, total }` (triggers idle countdown) |
| `cd:void`         | `{}` (jump to idle immediately) |
| `cd:branding-update` | `{ logo, tagline, shopName }` (live) |
| `cd:playlist-update` | `{ items: MediaItem[] }` (live) |

The customer display window holds local state only. POS is the source
of truth. If the POS window disconnects, the customer display falls
back to playlist mode.

### Idle detection + transition

After `cd:sale-done`, the customer display starts a 5-second timer
showing a "Thank you · receipt #00248" panel. When the timer expires,
the panel fades out and the playlist starts.

`cd:cart-add` from the next sale interrupts the playlist and switches
straight back to live-cart mode (with a 200ms cross-fade).

### Default vs random playlist

Two behaviours configurable in settings:
1. **Sequential** — items render in `display_order`. Predictable for
   "promo of the week" rotation.
2. **Random shuffle** — items shuffle on each playlist start. Repeats
   are deduped within a 10-item window so the same GIF doesn't show
   twice in a row.
3. **Default-first then random** — `is_default=true` items run first
   in `display_order`, then the rest shuffle.

A user option for "items I want every customer to see" maps to
`is_default=true`.

### Performance throttling

The customer-display window is webview-backed. We enforce:
- Max 1 video element rendered at a time. Switching videos kills the
  previous element first.
- Pre-decode the next image during the current item's hold time so
  there's no blink between items.
- Throttle live-cart updates to 30fps; batched DOM updates.
- Pause the playlist + free webview memory when the window is hidden
  (Windows minimised to taskbar or moved to a disconnected display).

### What this does NOT do
- No remote-config — every device's playlist is local.
- No analytics — we don't track which item showed when (could add
  later, opt-in).
- No content moderation — owner is responsible for what plays on their
  customer screen.
- No ads marketplace — this isn't AdMob.

---

## 6. Implementation order (when greenlit)

1. **Hardware quote dialog** + cross-module dead-end audit (1 day)
2. **POS new-sale → Open Shift gate** + shift schema migration (1 day)
3. **Green-colour sweep**: change `--color-positive` token + replace
   inline `#5F7E47` references (half-day)
4. **POS product card refresh** + watermark icon set (1 day)
5. **Customer-display feature**:
   - Settings UI + storage + media uploader (2 days)
   - Tauri second window + IPC plumbing (1 day)
   - Idle playlist + transitions (1 day)
   - YouTube/iframe embedding + safety (half-day)
   - Branding overlay + clock/weather (half-day)
   - Resource limits + warnings (half-day)
   - Manual testing on a real second monitor (1 day)

Total: ~9 working days for one engineer. Customer display is the
biggest piece (5 of those 9).

---

End of plan. Awaiting greenlight before any code is written.
