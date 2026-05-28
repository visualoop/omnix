MCHORO MAWE DESIGNS — Comprehensive Build Brief
Bespoke interior design, architecture & construction studio · Nairobi
This document is a complete instruction set for an AI coding agent (Cursor, Claude Code, Bolt, v0, Lovable). Read it end-to-end before writing a single line. Do not produce an MVP. Build the production-grade product described here.
__________________________________________________
0. MISSION
Build the website for Mchoro Mawe Designs — a bespoke interior, architectural and construction studio in Nairobi. The studio specialises in office partitioning, frameless glass installations, and gypsum ceilings. They produce hyper-realistic 3D renders for clients before any cut is made. Free site visits, tailored proposals.
The website's job is to convert a client lead into a booked free site visit. Everything on the page funnels toward that single CTA.
The brand voice: considered, quiet, masterful. The product is craft. The audience is offices upgrading their headquarters, residential clients building Karen and Runda homes, and developers shopping for a finishes partner. They have already seen ten generic "interior design Nairobi" Wix sites. They will judge Mchoro Mawe's website on the same axis they will judge Mchoro Mawe's joinery: precision, restraint, intentional choices.
If a section looks like a generic Elementor template, rebuild it. If a screen looks like a SaaS landing page, rebuild it. The reference is architectural-grade editorial design, not B2B SaaS.
Brand contact (visible on contact page): mchoromawe@gmail.com, Nairobi, Kenya. Categories displayed: Interior Design Studio · Architectural Designer · Construction Company.
__________________________________________________
1. SOURCE & APPROACH
There is no source repo to clone. Build from scratch using Payload CMS 3.x as the seed, which scaffolds a Next.js 15 app for you.
This is non-negotiable. Start by running:

pnpm dlx create-payload-app@latest mchoromawe


When prompted, choose:
- Template: website (or blank if you want full control — recommend blank to avoid Payload's default frontend so you control every visual decision)
- Database: Postgres
- Use Payload Cloud: No (we self-host)
Payload 3 will scaffold a Next.js 15 App Router app with Payload mounted at /admin and exposing a REST + GraphQL + local API for content. The Next.js frontend lives in the same project at app/(frontend)/. Do NOT spin up a separate Next.js project — the integrated Payload-Next setup is the correct architecture.
After scaffolding, verify locally:
1. pnpm dev
2. Visit http://localhost:3000/admin → sign up the first admin user
3. Visit http://localhost:3000 → confirm the default frontend renders
4. Only then start customising
__________________________________________________
2. TECH STACK (exact versions, do not substitute)
Runtime: Node 20 LTS
Framework: Next.js 15 App Router (scaffolded by Payload)
CMS / data layer: Payload CMS 3.x — the source of truth for content, images, projects, services, journal posts, settings.
Database: Postgres 15 hosted on Supabase or Neon (free tier sufficient for launch)
ORM: Payload uses Drizzle internally — do not introduce a second ORM
Image optimisation: Payload's built-in image processing + Next.js Image component. Store originals in Supabase Storage or Cloudflare R2 (configure Payload's s3 adapter)
Component library: shadcn/ui — install fresh in the Next.js side. Allowed extensions: Radix UI primitives, Lucide icons, vaul for drawers, sonner for toasts, embla-carousel-react for the project carousel, framer-motion for scroll-triggered transitions on hero and project tiles.
Styling: Tailwind CSS v3 + custom CSS variables for the Mchoro Mawe palette
Fonts: Cormorant Garamond (display, weights 300/400/500/700, both roman and italic) + Inter (body, weights 400/500/600). Self-host via next/font/google with display: swap. No third typeface.
Forms: Payload's @payloadcms/plugin-form-builder for the contact + site-visit forms (the studio can edit fields without code). Email delivery via Resend.
Payments: Not required for this site at launch. If a deposit-collection flow is added later, use Paystack only (cards + M-Pesa via /charge mobile_money) — do NOT integrate Daraja directly.
Hosting: Vercel (Next.js) + Supabase or Neon (Postgres). Cloudflare R2 for media.
Analytics: PostHog
Error tracking: Sentry
Email: Resend (transactional confirmations on contact form, site visit booking)
__________________________________________________
3. UI / VISUAL DIRECTION — non-negotiable
Mchoro Mawe's UI must signal architectural restraint and Italian-luxury craft. Below is the exact palette, type system, and pattern guidance based on three reference sites the AI must visually study before designing.
3.1 Reference websites (the AI must fetch and study these)
These were captured by browser inspection. Treat the third (Visionnaire) as the primary aesthetic anchor; lean Stonehenge for content density and Fine Urban for the dark mode treatment.
1. Visionnaire Home — https://www.visionnaire-home.com — PRIMARY REFERENCE
- Italian super-luxury furniture brand. Tech: Next.js + Tailwind v4. Custom proprietary fonts (Arizona Mix Light + Walter Neue) served from /_next/static/media/. Image CDN: Cloudinary.
- Palette: warm bone background #EDE8E3, charcoal text #43403D, very subtle warm-grey surfaces.
- Hero: full-bleed video with quiet typographic overlay. Editorial generosity. Product pages laid out like magazine spreads.
- What to copy: the warm bone palette, the editorial column rhythm, the large-format photography treatment, the Italianate type voice.
2. Fine Urban — https://fineurban.com
- Premium urban furniture brand. Tech: WordPress + Elementor + Zentrum theme. Self-hosted Chronicle Display serif + AvenirLTStd sans.
- Palette: champagne gold #BF9546 on near-black #040402. Low-key luxury dark.
- Hero: dark, atmospheric, product-as-hero photography.
- What to copy: the dark mode brass/champagne treatment for night-mode sections like the 3D renders showcase.
3. Stonehenge Kenya — https://www.stonehenge-kenya.com
- Kenyan luxury furniture / interiors. Tech: WordPress + WPBakery. Fonts: Neuton, Ubuntu, PT Serif. Background #EEF1F2.
- Hero: Revolution Slider with rotating product hero shots.
- What to copy: the local-Kenyan content density (specific to this market), the "feature category strip" pattern.
- What to NOT copy: the WordPress template-y elements (hovering avatars, plugin bars, generic testimonial sliders).
The downstream AI must visit each URL, screenshot the hero and one inner page, and reference those compositions when laying out Mchoro Mawe's sections.
3.2 The Mchoro Mawe palette (use exactly)
Two modes. Light is default and dominant. Dark is reserved for the 3D renders showcase, the closing CTA band, and any video-led section.
Light mode (default)

--background:        #EDE8E3   /* warm bone, lifted from Visionnaire */
--surface:           #DED7CE   /* aged paper */
--surface-elevated:  #F5F1EB
--border:            #C9C0B5
--border-strong:     #A89E91
--text-primary:      #1F1C18   /* warm near-black */
--text-secondary:    #43403D
--text-muted:        #8A857E
--accent:            #8B6F3E   /* aged bronze */
--accent-hover:      #A28553
--accent-foreground: #EDE8E3
--danger:            #8B2A2A


Dark mode (renders showcase + closing CTA)

--background:        #0E0D0B
--surface:           #18171A
--surface-elevated:  #211F22
--border:            #2C2A28
--border-strong:     #3D3A35
--text-primary:      #F0EBE2
--text-secondary:    #B8B0A4
--text-muted:        #7A7368
--accent:            #BF9546   /* champagne gold, lifted from Fine Urban */
--accent-hover:      #D5A95D
--accent-foreground: #0E0D0B


Forbidden colors anywhere: any green, any blue (no Bootstrap #3B82F6, no teal), any purple, any neon, pure black #000000, pure white #FFFFFF.
Forbidden patterns:
- Gradient buttons, gradient hero overlays
- Drop-shadow cards (box-shadow: 0 2px 4px rgba(0,0,0,0.1))
- Three-column emoji feature grids
- Section titles literally called "Features", "Services" (use evocative naming — "What we make", "The studio's hand", "Spaces we build")
- Stock business photography (men in suits, generic boardrooms)
- 4.9★ avatar-stack social proof
- Placeholder-as-label form inputs
- Badge-style "PREMIUM" or "BESPOKE" pill labels
3.3 Typography
Display headlines (Cormorant Garamond, weight 300, italic optional):
H1 hero: font-size: clamp(56px, 7vw, 112px), line-height: 1.0, letter-spacing: -0.015em. Italic on one keyword for emphasis.
H2 section: font-size: clamp(40px, 4vw, 64px), line-height: 1.05.
H3 sub: font-size: clamp(28px, 2.5vw, 36px), weight 400.
Body (Inter, weight 400):
Large lede: font-size: 22px, line-height: 1.5.
Standard: font-size: 17px, line-height: 1.65.
Caption: font-size: 14px, line-height: 1.5, color: var(--text-muted).
Eyebrows / labels (Inter, weight 600, text-transform: uppercase, letter-spacing: 0.18em, font-size: 12px).
Pull quotes: Cormorant Garamond italic weight 400, font-size: 32px, hung indent.
Cormorant must be loaded with both roman AND italic; the italic carries the brand voice.
3.4 UI patterns
Spacing: 8px base. Section vertical rhythm 120px desktop / 64px mobile (more generous than Trimly/Resumely — luxury reads slow). Card padding 32px minimum. Max content width 1280px with 80px gutters; text columns max 60ch.
Borders not shadows: border: 1px solid var(--border). Shadows reserved for dropdowns and modals only.
Buttons: primary is filled bronze, no border-radius (sharp 0px corners — sharper reads more architectural; alternative is 2px), padding: 14px 32px. Secondary is transparent with a thin underline on hover.
Inputs: transparent background, single bottom border border-bottom: 1px solid var(--border-strong), no full border boxes, no rounded corners. Focus → bottom border bronze.
Navigation: thin 1px border-bottom, transparent background going opaque on scroll. Logo wordmark left, links centered or right, single CTA "Book a site visit" hard right.
Imagery: real photography of completed Mchoro Mawe work. Empty state if photos not yet provided — use commissioned-style architectural photography from Unsplash with explicit attribution + a CMS field marked placeholder: true so the studio can swap them.
Image treatment: subtle warm overlay background: rgba(31, 28, 24, 0.05); mix-blend-mode: multiply to harmonise photos to the palette. Never apply colour filters that change skin tones.
Animation: scroll-triggered fades on heading + photo blocks via Framer Motion whileInView. No scroll-jacking, no parallax. Restraint.
3.5 Anti-patterns (verify against every page before shipping)
No gradient buttons, no gradient hero overlays.
No section titled "Services" or "Features" — use evocative names.
No emoji icons in feature lists. Use thin Lucide line icons set in bronze.
No drop-shadow cards.
No bg-white text-gray-500 Tailwind defaults.
No "Trusted by 50+ companies" strip.
No carousel auto-rotation under 8 seconds.
No video autoplay with sound.
No "Get a quote in 60 seconds" urgency framing — luxury is patient.
__________________________________________________
4. REPOSITORY SETUP STEPS
In order:
pnpm dlx create-payload-app@latest mchoromawe → choose blank template, Postgres database.
cd mchoromawe
Edit .env with DATABASE_URI pointing to Supabase, PAYLOAD_SECRET (generate one), NEXT_PUBLIC_SERVER_URL=http://localhost:3000.
pnpm dev → verify /admin and / boot.
Initialize shadcn at the project root: pnpm dlx shadcn@latest init — pick New York style, base color slate (we override via CSS vars), CSS variables yes.
Install components: pnpm dlx shadcn@latest add button card input label dialog drawer sheet dropdown-menu sonner badge avatar tabs separator skeleton accordion
Replace shadcn's generated globals.css palette with the Mchoro Mawe palette from §3.2.
Wire fonts via next/font/google in app/(frontend)/layout.tsx: Cormorant Garamond (300, 400, 500, 700, italic) + Inter (400, 500, 600).
Install Payload plugins:


        - pnpm add @payloadcms/plugin-form-builder (contact + site-visit forms)


        - pnpm add @payloadcms/plugin-seo (per-page meta titles, OG images)


        - pnpm add @payloadcms/plugin-nested-docs (for hierarchical service pages)


        - pnpm add @payloadcms/storage-s3 (R2/Supabase storage)
Configure payload.config.ts: collections (see §5), plugins, S3 storage, email adapter (Resend).
Generate the first migration: pnpm payload migrate:create initial. Run pnpm payload migrate.
Create app/(frontend)/page.tsx, app/(frontend)/layout.tsx, the section components, and the dynamic routes for projects + services.
Commit at each milestone with conventional commit messages.
__________________________________________________
5. PAYLOAD COLLECTIONS
Define these in src/collections/. Studio admins manage everything via /admin; developers do not edit content in code.
5.1 Services (collection)
Fields:
- title (text, required) — e.g., "Office Partitioning"
- slug (text, required, unique) — e.g., office-partitioning
- summary (textarea, required) — one-line teaser used on listing
- heroImage (upload, required)
- heroVideo (upload, optional)
- body (rich text — Lexical editor, supports headings, images, blockquotes, gallery blocks)
- keyFeatures (array of { label, description, icon })
- materials (array of { name, description, image })
- relatedProjects (relationship → Projects, hasMany)
- seo (group via plugin)
Seed at first deploy:
- Office Partitioning
- Frameless Glass
- Gypsum Ceilings
- Custom Joinery & Finishes
5.2 Projects (collection)
Fields:
- title (text, required)
- slug (text, required, unique)
- client (text — can be private; toggle showClientPublicly)
- location (text — e.g., "Karen, Nairobi")
- year (number)
- category (select: Office, Residential, Hospitality, Mixed-use)
- services (relationship → Services, hasMany)
- heroImage (upload, required)
- gallery (array of { image, caption })
- before3DRenders (array of upload — the renders that were shown to client)
- afterPhotos (array of upload — completed work)
- narrative (rich text — the case-study story)
- pullQuote (textarea — used on the case-study page)
- featured (checkbox — surfaces on home page)
- seo (group via plugin)
5.3 JournalPosts (collection)
Fields:
- title, slug, summary, heroImage, body (rich text), category (select: Process, Materials, Case Studies, Notes), publishedAt (date), author (relationship → Users), seo.
5.4 TeamMembers (collection)
Fields:
- name, role, bio, portrait (upload), linkedIn, order (number for sort).
5.5 Testimonials (collection)
Fields:
- quote (textarea), clientName, clientRole, relatedProject (relationship → Projects, optional).
5.6 SiteVisitRequests (collection — form submissions land here)
Fields:
- name, phone, email, propertyType (select), propertyLocation, interestedServices (relationship → Services, hasMany), desiredVisitWindow (text), briefDescription (textarea), status (select: New, Contacted, Scheduled, Completed, Lost), internalNotes (rich text).
Configure access control: only authenticated admins can read.
5.7 Settings (global, single instance)
Studio name
Tagline
Phone
WhatsApp number (displayed as click-to-chat)
Email
Office address (the studio's own office)
Social links (Instagram, LinkedIn, Pinterest)
Footer copy
Open Graph default image
Brand statement (used in footer + about page)
5.8 Pages (collection — for ad-hoc pages like Privacy, Terms, Careers)
Fields: title, slug, body (rich text), seo.
__________________________________________________
6. PAGE-BY-PAGE SPEC (10 pages)
Each is a Next.js route under app/(frontend)/. Data comes from Payload via the local API (server components).
6.1 / — Home
A long-scroll editorial. Sections in this exact order — every one required:
Header — fixed, transparent until 80px scroll. Logo wordmark left ("Mchoro Mawe" set in Cormorant 500 italic), nav center (The Studio · Services · Projects · Process · Journal · Contact), single bronze "Book a site visit" CTA hard right.
Hero — full-bleed background image (Settings.openGraphImage or first featured project hero). Overlay text in two layers: small eyebrow "Bespoke craftsmanship · Nairobi" in Inter 12px tracked uppercase. Headline in Cormorant Garamond 300 italic, e.g. "Spaces where life settles in." 96px+. Below the headline a single bronze "Book a free site visit" button. NO secondary CTA above the fold. NO scroll-down arrow.
The intro paragraph — 1 column, max 60ch, centered, Cormorant Garamond italic 24px: "Mchoro Mawe transforms offices and homes. We blend hand drawing, hyper-realistic 3D renders, and craft. Every cut is decided before it is made." Pulled directly from the Settings global.
What we make — NOT titled "Services". Eyebrow "What we make". Then 4 services laid out as full-width image-and-text rows alternating left/right: Image (1 col 6/12), text (1 col 5/12 with offset). Each row gets the service hero image, the service title in Cormorant 400 56px, the summary in Inter 17px, and a "Read more →" underline link to /services/[slug].
Featured projects — eyebrow "Recent work". 3 featured projects pulled from Payload Projects where featured = true. Display as full-width tiles in a 1-2-1 layout: first tile full width hero, then two side-by-side, then one full again. Each tile shows hero image with a subtle 5% multiply overlay, project title overlaid bottom-left in Cormorant 400 36px white, location and year in Inter 12px tracked uppercase. Hover: zoom 1.04, image overlay fades.
The 3D render is the proof — NEW dark mode section (palette switches via data-theme="dark" on this section's wrapper). Background #0E0D0B. Show a side-by-side: the 3D render on the left, the finished build photo on the right, with a draggable slider to wipe between them (Radix-based or react-compare-image). Caption in Cormorant italic: "What you see is what we make."
The studio's hand — eyebrow "How we work". 4 numbered steps as a horizontal scroll on desktop, vertical on mobile. Numbers in Cormorant 300 96px bronze. Each step gets a 1-sentence statement (not bulleted) and a tiny line-icon: 1. We listen. 2. We render. 3. We agree the cut. 4. We build.
A note from the studio — full-bleed warm bone, single column max 60ch, centered. A handwritten-feeling editorial paragraph (not the Visionnaire 4-column story; it should read like a personal letter). Signed off "— Mchoro Mawe Designs · Nairobi".
Testimonials — 3 client quotes, no avatars, no star ratings. Each presented as a Cormorant italic 32px pull quote with a thin bronze rule above and below, attribution in Inter 14px tracked uppercase below.
Closing CTA — dark mode again. Full-bleed #0E0D0B. Single line in Cormorant 400 italic 56px: "Your next space is one site visit away." Below: "Book a free site visit" bronze button + small phone/WhatsApp text link.
Footer — wordmark, three small link columns (Studio · Work · Reach), social icons in muted bronze, contact email + phone, "© 2026 Mchoro Mawe Designs · Nairobi" set in Inter 12px tracked.
6.2 /the-studio — About / The Studio
Hero with editorial photography of the studio team / workshop in action.
The mission paragraph, presented as a long-form magazine column (max 60ch, two columns on wide desktop with column-count: 2; column-gap: 64px).
Founder note — portrait left (60% column), text right with quote pull-out.
The team — Payload TeamMembers rendered as a quiet grid: portrait + name + role only. No bio cards by default; click → drawer with full bio.
The studio's beliefs — 5 typographic statements, large, no decoration. Each is one sentence in Cormorant italic 36px.
The workshop — gallery of behind-the-scenes images.
Closing CTA back to /contact.
6.3 /services — Services overview
Hero with eyebrow "What we make" and headline "Four disciplines, one hand."
Long-form intro on the studio's approach to materials.
The 4 services as full-width alternating rows (same pattern as home page #4) but with deeper detail and a "View detail →" link each.
A "By appointment, anywhere in Kenya" band before footer.
6.4 /services/[slug] — Service detail (dynamic, Payload-driven)
Hero — full-bleed heroImage from the service. Eyebrow ("Office Partitioning"), title in Cormorant 300 96px, summary in Cormorant italic 22px.
Body content — render Payload's Lexical editor. The renderer must support: headings, paragraphs, blockquotes, image blocks (single, side-by-side pair, full-bleed), gallery block, materials grid block, video embed.
Key features — 4–6 features each as { icon, label, description } rendered in a 2-column grid with thin Lucide icons in bronze.
Materials — grid of materials this service uses, each with name + image.
Related projects — 3 from Payload's relatedProjects field, rendered as quiet tiles.
CTA: "Get a render for your space" → /contact pre-populated with service.
6.5 /projects — Project portfolio
Hero with eyebrow "Selected work".
Filter strip: All · Office · Residential · Hospitality · Mixed-use. Persist in URL via ?category=....
Masonry grid of project tiles (use react-masonry-css or CSS grid with grid-auto-rows: masonry if browser support is safe by 2026 — fall back to JS masonry). Each tile: hero image with overlay caption (project title + location + year). Click → /projects/[slug].
Pagination at 12 per page or infinite scroll with intersection observer.
6.6 /projects/[slug] — Project case study (dynamic)
Hero — full-bleed heroImage. Title in Cormorant 300 96px. Below the title in Inter 14px tracked uppercase: "Karen, Nairobi · 2025 · Office Partitioning + Gypsum Ceilings".
The narrative — Lexical-rendered long-form content with editorial layout.
Pull quote — Cormorant italic 48px, hung off-grid.
The render-vs-build comparison — slider component showing before3DRenders[0] vs afterPhotos[0]. Caption "From render to space."
Gallery — full-width image rows, captioned in Inter 14px tracked uppercase.
Services applied — 2-column band linking to each service used.
Related projects — 3 quiet tiles.
Closing CTA: "Bring this craftsmanship to your space" → /contact pre-populated.
6.7 /process — How We Work
Hero with eyebrow "The studio's hand".
Long-form columnar essay on the studio's process. Two columns desktop.
The 5 stages of a project, each as a full-bleed row: Listen, Site Visit, Render, Approve & Build, Handover. Each row uses a large numeral (Cormorant 300 200px bronze, on the left), and a 50-word description on the right.
Timeline graphic — a thin horizontal SVG marker showing typical 6-12 week project flow.
FAQ accordion — 6-8 questions including "Are site visits really free?", "How long does a typical office partitioning take?", "Do you provide warranties?".
CTA back to /contact.
6.8 /the-renders — 3D Renders Showcase
This is a dark-mode page by default. Use the §3.2 dark palette. Champagne gold accent.
Hero — single Cormorant italic 96px headline: "Decided before it is made." Below: a paragraph on why hyper-realistic 3D rendering is part of the studio's discipline.
Auto-playing background video of a render rotation (muted, looped, max 4MB).
Render gallery — a curated set of 12-20 renders pulled from Payload Projects' before3DRenders field. Lightbox viewer on click (use yet-another-react-lightbox v3+).
The render-vs-build slider — repeated here in dark mode.
CTA: "See a render for your space" → /contact.
6.9 /journal — Insights / Journal
Hero with eyebrow "From the studio".
Featured post — full-bleed hero treatment.
Posts grid — masonry, 2 columns on desktop, with category filter.
Newsletter signup at the bottom (Resend audience) — single inline email field, no card. Title: "Notes from the workshop, occasionally."
6.9.1 /journal/[slug] — Journal post
Long-form editorial layout: hero image, title in Cormorant 300 80px, dateline + author + reading time in Inter 14px tracked, then long-form Lexical content with image blocks, blockquotes, and pull quotes. Footer of the post: 2 related posts.
6.10 /contact — Contact / Book a Site Visit
Hero — single Cormorant italic 80px line: "Tell us about your space." Below in Cormorant 400 22px: "Free site visit. Honest first proposal."
Two-column layout:


        - Left: the form (Payload form-builder powered). Fields: name, phone, email, property type (select), property location, interested services (multiselect from Services collection), desired visit window (text), brief description (textarea), GDPR checkbox. Submit button bronze.


        - Right: the studio's contact details — phone, WhatsApp click-to-chat (using https://wa.me/254XXXXXXXXX with a pre-filled message), email, office address, opening hours.
After submit: show a Cormorant italic confirmation "Thank you. We will be in touch within 24 hours, with a real person." (NOT auto-message-style).
Form submission writes to SiteVisitRequests collection AND triggers a Resend transactional email both to the studio (mchoromawe@gmail.com) and to the customer (confirmation copy).
On the bottom of the page, embed a Mapbox map (light style) with the studio's office pin.
__________________________________________________
7. FORMS & SITE VISIT BOOKING DETAIL
Use @payloadcms/plugin-form-builder so the studio can edit fields and confirmation messages in /admin without code. Configure:
Form collection: "Site Visit Request" with the field set described in 6.10.
Submission collection: writes to SiteVisitRequests (a custom collection that mirrors the form-builder's submission collection but with extra editable status fields).
Email notifications:
To customer (Resend transactional): subject "Your site visit with Mchoro Mawe", body in editorial copy. From studio@mchoromawe.com (configure custom domain in Resend).
To studio (Resend): subject "New site visit request — {name}", body containing all fields, a CTA "Open in admin".
Optional WhatsApp notification: trigger an outbound WhatsApp message via the studio's number using a click-to-chat link the studio member taps from their email (avoids WhatsApp Business API setup at launch).
Honeypot anti-spam field (hp_field hidden, reject submissions where it's filled).
Rate-limit submissions per IP via Upstash Redis (3 per hour).
__________________________________________________
8. SEO
The site needs to rank for "interior design Nairobi", "office partitioning Nairobi", "gypsum ceiling Nairobi", "frameless glass Nairobi".
@payloadcms/plugin-seo for per-page meta titles, descriptions, OG images managed in /admin.
Dynamic OG image generation per project via @vercel/og: project title + location + year on the warm bone background with Cormorant typography.
Sitemap auto-generated via next-sitemap covering all public routes including dynamic services, projects, journal posts.
Structured data:
LocalBusiness schema on every page
Organization schema on home
Article schema on journal posts
Project (CreativeWork) schema on case studies
Per-service landing pages: ensure each /services/[slug] is canonically the destination for service keywords (no thin pages).
__________________________________________________
9. PERFORMANCE
All hero images served via Next.js <Image> with appropriate sizes and priority only on the LCP image.
Use Cloudflare R2 with Image Resizing transformations for responsive variants.
Defer all non-critical JavaScript (Framer Motion only on scroll-triggered sections).
Target Lighthouse Performance ≥ 90 on a 4G connection from Nairobi.
Total JS budget for the home page route: < 200KB gzipped.
__________________________________________________
10. DEPLOYMENT
Hosting: Vercel (Hobby tier sufficient for launch traffic; upgrade to Pro when first organic traffic spikes).
Postgres: Supabase pooler URL or Neon's serverless driver.
Storage: Cloudflare R2 with public bucket for media.
DNS: mchoromawe.com (or .co.ke) → Vercel. Configure staging.mchoromawe.com for previews.
Email: Resend with verified domain mchoromawe.com.
Environment: separate Vercel projects for staging + production.
__________________________________________________
11. ADMIN HANDOFF
The studio's admins (1-2 people) must be able to:
- Add a new project: upload hero, gallery, narrative, before-renders, after-photos, services, mark featured.
- Add a new journal post.
- Edit any service detail copy and materials.
- Edit the homepage hero image and intro paragraph (via Settings global).
- Update site visit form fields if their intake process evolves.
- Read incoming site visit requests, mark status, add internal notes.
Document this in a /docs/admin-handbook.md with screenshots of /admin.
__________________________________________________
12. TESTING
Playwright E2E covering: home → service → contact form submission → email delivered to studio.
Vitest for: form validation utilities, OG image generation.
Manual QA on every page: iPhone SE (375px), iPad (768px), 1440px desktop. Lighthouse Performance ≥ 90, Accessibility ≥ 95.
Test with the studio admin: have them add a real project end-to-end before launch.
__________________________________________________
13. WHAT GOOD LOOKS LIKE
When the AI agent is done:
- A first-time visitor in Nairobi loads the home page and feels they have walked into a Visionnaire showroom (warm bone, slow type, real photography, no SaaS-template energy).
- A potential client can read about the studio, see 3 case studies, and book a site visit in under 2 minutes.
- The studio admin can add a new project from photos to live in 10 minutes via /admin, with no developer.
- The site never displays the colors #10B981, #3B82F6, #8B5CF6, #FFFFFF, #000000, or any green/teal/purple/blue.
- No section title literally says "Services" or "Features".
- Lighthouse Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95.
- The render-vs-build comparison slider works flawlessly on mobile and desktop.
If any of these are not true, the build is not done.
__________________________________________________
14. REFERENCES (the AI MUST visually study these)
Visual:
- https://www.visionnaire-home.com — primary aesthetic anchor (warm bone, editorial)
- https://fineurban.com — dark mode reference (champagne on near-black)
- https://www.stonehenge-kenya.com — local Kenyan luxury reference
- https://aesop.com — refined product editorial
- https://aman.com — hospitality-grade luxury
- https://www.studiomk27.com.br — architectural studio reference
- https://www.dianekellydesigns.com — interior design studio reference
- https://snohetta.com — architectural studio reference
Technical:
- https://payloadcms.com/docs (Payload 3.x)
- https://payloadcms.com/docs/plugins/form-builder
- https://payloadcms.com/docs/plugins/seo
- https://payloadcms.com/docs/plugins/nested-docs
- https://nextjs.org/docs (Next 15 App Router)
- https://ui.shadcn.com
- https://www.framer.com/motion/
- https://paystack.com/docs (only relevant if deposit collection is added later)
Brand context (Mchoro Mawe's own existing presence):
- Email: mchoromawe@gmail.com
- Categories: Interior Design Studio · Architectural Designer · Construction Company
- Specialisations: office partitioning, frameless glass, gypsum ceilings
- Promise: free site visits, hyper-realistic 3D renders, tailored proposals
__________________________________________________
15. THINGS TO EXPLICITLY NOT DO
Do not build an MVP. Build the whole 10-page site.
Do not build the frontend before installing Payload — Payload scaffolds Next.js 15 for you. Reverse order forces a painful re-architecture.
Do not introduce any second CMS or any second ORM.
Do not use any color outside the §3.2 palette.
Do not install any UI library other than shadcn/ui + the explicit additions.
Do not use stock photography of generic men in suits. If real photography is unavailable at launch, use commissioned-style architectural photography with attribution + a placeholder flag.
Do not auto-play hero video with sound.
Do not titles a section "Services", "Features", or "Why choose us?".
Do not use emoji icons on any page.
Do not add a chat-bubble support widget. The studio's WhatsApp number is enough.
Do not integrate Daraja directly anywhere. If a deposit-collection flow gets added later, use Paystack only.
End of brief. Build it.
__________________________________________________
APPENDIX A — VISUAL BIBLE (the anti-AI-slop reference set)
Why this exists. AI builders default to generic interior-design Wix templates: stock photos of expensive sofas, three-column "Why Choose Us" grid, glittery "luxury" badges, hero carousels with arrow controls, testimonial sliders with five gold stars. To force premium output, the building AI MUST visually study the references below before drafting any UI. Treat each as a teacher — note typography, palette, spacing rhythm, hero composition, image treatment, scroll behavior. Internalize the language. Then write code.
For every section you build, ask: "Does this look like it could exist on Visionnaire / Aman / Snøhetta? Or does it look like an Elementor 'Luxury Interiors' template?" If the latter, rebuild.
A.1 Tier 1 — Primary aesthetic anchors (the visual ceiling)
These ARE the visual standard. Copy the discipline; copy nothing literally.
https://www.visionnaire-home.com — PRIMARY anchor (already named in the brief). Italian super-luxury. Warm bone, editorial type, magazine-grade product pages.
https://www.aesop.com — retail design as brand identity. The reference for restraint.
https://aman.com — hospitality-grade luxury. Slow, cinematic, type that breathes.
https://www.hermes.com — Hermès. Orange used so sparingly it commands. Lesson: one accent, used with discipline.
https://www.studioilse.com — Studioilse (Ilse Crawford). Deeply influential interiors designer's portfolio. Editorial confidence.
https://johnpawson.com — John Pawson. Monastic minimalist. The closest pure-architecture peer to Mchoro Mawe's aesthetic ambition.
https://www.vincentvanduysen.com — Vincent Van Duysen. Belgian architect/interior designer. Refined to the bone.
https://www.axelvervoordt.com — Axel Vervoordt. Belgian wabi-sabi luxury. Atmospheric photography.
https://www.cerealmag.com — Cereal magazine. The single best typographic peer for the Mchoro Mawe brand voice.
A.2 Tier 2 — World-class architectural studios (how serious architecture firms present themselves)
Mchoro Mawe is an architecture + construction studio. Live in this neighborhood.
https://snohetta.com — Snøhetta. Norwegian-American firm. Editorial portfolio web.
https://www.fosterandpartners.com — Foster + Partners. Massive global firm; portfolio web at scale.
https://oma.com — OMA (Rem Koolhaas). Iconic architectural studio.
https://www.bjarkeingels.com (or https://big.dk) — BIG (Bjarke Ingels Group). Studio portfolio with strong narrative architecture.
https://www.davidchipperfield.com — David Chipperfield Architects. Restrained European architectural studio.
https://www.herzogdemeuron.com — Herzog & de Meuron. Swiss firm, refined portfolio.
https://www.zaha-hadid.com — Zaha Hadid Architects. Distinctive form expression.
https://www.adjaye.com — Adjaye Associates (David Adjaye, of Ghanaian heritage). Important reference for African-rooted architectural identity.
https://www.tatianabilbao.com — Tatiana Bilbao. Mexican firm with refined editorial portfolio.
https://www.diller.scofidio.com (or dsrny.com) — Diller Scofidio + Renfro. Major US firm.
A.3 Tier 3 — Italian/European luxury furniture brands
The references the client gave (Visionnaire, Fine Urban) live in this category. The website should belong with them.
https://www.bebitalia.com — B&B Italia. Italian furniture icon.
https://www.cassina.com — Cassina. Heritage Italian furniture brand.
https://www.minotti.com — Minotti. Italian sofa specialist.
https://www.poliform.it — Poliform. Italian living-room and kitchen.
https://www.molteni.it — Molteni&C.
https://www.flexform.it — Flexform.
https://www.boffi.com — Boffi. Italian premium kitchen/bath.
https://www.giorgetti.eu — Giorgetti.
https://www.livingdivani.it — Living Divani.
https://www.knoll.com — Knoll. American modern furniture (Saarinen, Bertoia heritage).
https://www.vitra.com — Vitra. Swiss design icon.
https://www.fritzhansen.com — Fritz Hansen. Danish modern.
https://www.usm.com — USM Modular Furniture. Swiss precision.
https://www.cappellini.com — Cappellini. Italian.
A.4 Tier 4 — Hospitality (study how hotels at the top tier present themselves)
Hospitality web design is the closest analog to Mchoro Mawe's positioning: real spaces, editorial photography, slow narrative.
https://aman.com — Aman (already noted, also explore individual property sites).
https://www.amangiri.com — Amangiri. Single-property Aman web.
https://aman-i-khas.com (or aman.com/resorts/aman-i-khas) — Aman-i-Khas.
https://sixsenses.com — Six Senses Resorts.
https://www.belmond.com — Belmond (LVMH). Heritage luxury hospitality.
https://www.lesirenuse.it — Le Sirenuse Positano. Single-property Italian hotel web.
https://www.thenedhotels.com — The Ned. Soho House Group hotel.
https://sohohouse.com — Soho House. Membership-driven hospitality.
https://www.singita.com — Singita. Luxury safari, refined web design.
A.5 Tier 5 — African luxury / locally relevant
Anchor in the user's local context. The Karen / Runda client base recognizes these.
https://andbeyond.com — andBeyond. Luxury safari pan-Africa.
https://www.singita.com — Singita (already).
https://www.angama.com — Angama Mara. Premium Kenyan safari property.
https://www.olseki.com — Ol Seki Hemingways.
https://www.giraffemanor.com — Giraffe Manor. Kenyan icon.
https://www.sasaab.com — Sasaab.
https://www.adjaye.com — Adjaye Associates (architectural reference, Ghanaian heritage).
A.6 Tier 6 — Editorial / magazine references (set type with confidence)
When your headlines feel templated, return to these.
https://www.cerealmag.com — Cereal magazine. PRIMARY typographic peer.
https://monocle.com — Monocle. Global brand magazine.
https://wallpaper.com — Wallpaper magazine. Architecture + design editorial digital.
https://www.dezeen.com — Dezeen. Architecture/design news.
https://www.archdaily.com — ArchDaily.
https://www.apartamentomagazine.com — Apartamento. Interiors-as-lived-in.
https://www.t-magazine.com (or nytimes.com/section/t-magazine) — NYT T Magazine.
https://www.frameweb.com — Frame magazine. Interior design / spatial design editorial.
A.7 Tier 7 — Galleries / cultural institutions (editorial confidence at scale)
Galleries exhibit work the way Mchoro Mawe exhibits projects. Same job, same standard.
https://gagosian.com — Gagosian Gallery.
https://www.hauserwirth.com — Hauser & Wirth.
https://www.davidzwirner.com — David Zwirner.
https://www.thebroad.org — The Broad (LA museum).
https://www.tate.org.uk — Tate.
https://www.moma.org — MoMA.
https://www.guggenheim.org — Guggenheim.
A.8 Tier 8 — ANTI-references (study them, copy nothing — they are the AI-slop trap)
These exemplify what generic interior-design / construction company sites look like. Mchoro Mawe must outclass them on every dimension.
Generic Wix and Squarespace "interior design" templates. Search "interior design template Wix" — every example uses a stock image of a velvet sofa with a glittery overlay, "WELCOME TO" in a script font, and a "Trusted by 50+ clients" testimonial slider. Mchoro Mawe is the antidote.
Elementor "construction company" templates with a hard-hat icon, blue + orange palette, "GET A FREE QUOTE NOW" urgency banner, and "Why Choose Us" three-column emoji grid.
Generic "luxury home builder" sites that pile decorations: drop-shadow cards, gradient buttons, parallax scrolling, autoplay video with sound, animated counter "1500+ Projects Completed."
Bootstrap-template "architecture" sites with carousels, hover-zoom on every image, and "Featured Projects" sliders.
If your draft uses a hard-hat icon, a velvet-sofa stock photo, "Why Choose Us," or any animated counter, scrap and rebuild.
A.9 How to use this Visual Bible
Before drafting any new page or component:
Open Visionnaire, Aesop, Studioilse, John Pawson, and Cereal in tabs.
Identify the composition technique you're about to use (e.g., "How does Studioilse compose a project case study page?").
Match the spacing, type scale, photography treatment, and scroll rhythm.
Run the Anti-Pattern checklist from §3.5.
If your draft could plausibly live on Visionnaire's site, ship. If it could plausibly live on a Wix template, rebuild.
__________________________________________________
APPENDIX B — AI AGENT SKILLS & MCPs (install BEFORE building)
The downstream AI must install these six skills/MCPs before drafting any UI. They exist for one reason: forcing better output than a vanilla model would produce. Skipping them is the biggest single cause of AI-template results.
Install all six during the "Phase 0 — Tooling" stage of the build, before any application code is written.
B.1 Anthropic frontend-design skill — the design discipline guard
Source: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
Install (Claude Code):


/skills add https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
What it does: Anthropic's own opinionated guidance for producing distinctive, production-grade frontend UIs. Guards against the "centered hero + 3-column emoji feature grid + 4.9★ avatar stack" template trap.
When to invoke: At the start of EVERY new page or component, before drafting markup. Re-invoke if a draft starts feeling generic.
Why it matters here: This single skill, applied disciplined, is the difference between Linear-grade output and Bootstrap-template output. Non-negotiable.
B.2 shadcn/ui MCP server — live component awareness
Source: https://ui.shadcn.com/docs/mcp
Install (one command writes the MCP config for you):


npx shadcn@latest mcp init --client claude   # or --cursor / --vscode
Manual MCP config (.cursor/mcp.json or .claude/mcp.json):


json
  {
    "mcpServers": {
      "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] }
    }
  }
What it does: Gives the AI live awareness of every shadcn/ui component, registry source, and installation command. The AI can browse and add components by name through MCP rather than guessing CLI syntax.
When to invoke: During scaffolding (Phase 1 setup) and any time a new component is needed.
Why it matters here: shadcn/ui is mandated as the sole component library across Trimly, Resumely, and Mchoro Mawe. The MCP eliminates npx shadcn add typos and stale-knowledge mistakes.
B.3 Anthropic webapp-testing skill — automated build verification
Source: https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md
Install:


/skills add https://raw.githubusercontent.com/anthropics/skills/main/skills/webapp-testing/SKILL.md
What it does: Playwright-based Python toolkit for spinning up the local dev server and capturing screenshots, console logs, and accessibility tree from any URL. Lets the AI critique its own output.
When to invoke: After every major page or component is drafted — the AI must screenshot the result and visually compare it to the Visual Bible (Appendix A) before declaring the section done.
Why it matters here: Closes the loop. Without this, an AI generates code that looks reasonable in source but renders broken or template-y in browser — and never finds out.
B.4 Playwright MCP — agent-native browser automation
Source: https://github.com/microsoft/playwright-mcp
Install (Claude Code):


claude mcp add playwright npx @playwright/mcp@latest
Manual MCP config:


json
  {
    "mcpServers": {
      "playwright": {
        "command": "npx",
        "args": ["@playwright/mcp@latest"]
      }
    }
  }
What it does: MCP server exposing Playwright browser automation via accessibility-tree snapshots — no vision model needed. The AI can navigate, click, type, and read the page DOM in a structured form.
When to invoke:
After each page is built — open in headless browser, screenshot, run a Lighthouse audit.
For end-to-end test scaffolding (Trimly: booking flow; Resumely: paywall flow; Mchoro Mawe: site-visit form submission).
To visit Visual Bible reference URLs from Appendix A and study them programmatically when in doubt about a composition.
Why it matters here: All three projects mandate Lighthouse Performance ≥ 90 and Accessibility ≥ 95. Playwright MCP makes those numbers a passive guard rather than a manual checklist item.
B.5 Context7 MCP — live, version-correct library docs
Source: https://github.com/upstash/context7
Install (auto-setup):


npx ctx7 setup --claude   # or --cursor / --opencode
Manual MCP config:


json
  {
    "mcpServers": {
      "context7": {
        "url": "https://mcp.context7.com/mcp",
        "headers": { "Authorization": "Bearer YOUR_CONTEXT7_API_KEY" }
      }
    }
  }
What it does: Fetches real-time, version-specific docs from any library's source repo and injects them into the model's context — kills the "I'm using Tailwind v3 syntax against your v4 project" class of hallucinations.
When to invoke: Append use context7 to any prompt that touches Next.js, Payload, Prisma, NestJS, Vercel AI SDK, Paystack, shadcn, Resend — basically every external library in this build.
Why it matters here: Reactive Resume uses Vercel AI SDK v6 with adapters that change syntax between minor versions. Cal.diy uses Prisma + the Cal.com app-store CLI. Payload 3 has migration patterns that did not exist in v2. Stale doc memory will cost you days. Context7 prevents it.
B.6 awesome-cursorrules .cursorrules file — passive convention enforcement
Source: https://github.com/PatrickJS/awesome-cursorrules
Recommended file (TypeScript + shadcn/ui + Next.js):


https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/typescript-shadcn-ui-nextjs-cursorrules-prompt-fil/.cursorrules
Install (drop in repo root):


curl -o .cursorrules https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/typescript-shadcn-ui-nextjs-cursorrules-prompt-fil/.cursorrules
What it does: A curated .cursorrules file that tells Cursor + compatible agents the stack conventions (TypeScript, shadcn/ui, Next.js) so generated code matches from the first prompt.
When to invoke: Set up once at project initialization; it runs passively on every interaction afterwards.
Why it matters here: Prevents the AI from drifting between TS and JS, between App Router and Pages Router, between shadcn variants — drift is a silent killer of build velocity.
B.7 Skill invocation playbook (the order of operations)
The building AI should follow this sequence:
Phase 0 — Tooling (do this first, no exceptions):
1. Install B.1, B.2, B.3, B.4, B.5, B.6 above
2. Drop the .cursorrules file in repo root
3. Verify all MCP servers respond by asking the AI: "List the shadcn components available" — should return a real list
Phase 1 — Scaffolding:
4. Use shadcn MCP (B.2) to install the base component set
5. Use Context7 (B.5) for any library setup question — pin every doc lookup to it
Phase 2 — Building each page:
6. BEFORE drafting a new page: re-read the relevant Visual Bible tier (Appendix A)
7. BEFORE drafting markup: invoke the frontend-design skill (B.1)
8. AFTER drafting a page: invoke webapp-testing (B.3) + Playwright MCP (B.4) to screenshot and critique
9. If the screenshot looks template-y, scrap and rebuild
Phase 3 — Validation:
10. Use Playwright MCP (B.4) to run Lighthouse on every public route
11. Confirm Performance ≥ 90, Accessibility ≥ 95 before declaring a page done
Phase 4 — Continuous:
12. Every commit triggers an automated Playwright screenshot diff against the previous commit (set up via GitHub Actions; see your CI config)
If any of the six tools is unavailable (e.g., Context7 API key not provisioned), STOP and provision it before continuing. Do not build without the toolset — the resulting output will be measurably worse.

