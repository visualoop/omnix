#!/usr/bin/env node
/**
 * seed-marketing-images.mjs
 *
 * Populate every marketing media slot with a licensable image found via
 * the Serper Google-Images API, uploaded to Cloudflare R2, and recorded
 * in the platform_media table. After this runs, the marketing site
 * looks complete out of the box; the admin can swap any slot later from
 * /admin/media.
 *
 * IMAGES COME FROM SERPER ONLY (per product decision) — never Unsplash
 * or other stock libraries, and always filtered to licensable results
 * (tbs=il:cl) so we don't ship images we can't use.
 *
 * USAGE (requires real credentials; nothing is committed):
 *   SERPER_API_KEY=xxxxx \
 *   DATABASE_URL=postgres://… \
 *   S3_ENDPOINT=https://<acct>.r2.cloudflarestorage.com \
 *   S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… \
 *   S3_MEDIA_BUCKET=omnix-media \
 *   S3_PUBLIC_URL=https://pub-xxxx.r2.dev \
 *   node scripts/seed-marketing-images.mjs [--force]
 *
 * --force re-seeds slots that already have an image. Without it, slots
 * that already have a platform_media row are skipped (idempotent).
 *
 * SECURITY: the Serper key + R2 creds are read from the environment
 * only. Do NOT hardcode them or commit them.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// ── Slot catalogue (kept in sync with website/src/lib/media-slots.ts) ──
const SLOTS = [
  { slot: "hero.background", query: "Kenyan small shop counter point of sale modern" },
  { slot: "hero.product_shot", query: "POS software dashboard screen tablet" },
  { slot: "module.dawa.hero", query: "pharmacy counter Kenya pharmacist dispensing" },
  { slot: "module.retail.hero", query: "retail shop minimart Kenya checkout counter" },
  { slot: "module.hardware.hero", query: "hardware store building materials shop counter" },
  { slot: "module.hospitality.hero", query: "restaurant bar counter cashier Kenya" },
  { slot: "pricing.hero", query: "small business owner Kenya shop using laptop" },
  { slot: "about.team_photo", query: "African software team office working" },
  { slot: "og.default", query: "point of sale M-Pesa payment Kenya shop" },
];

const FORCE = process.argv.includes("--force");

function reqEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const SERPER_API_KEY = reqEnv("SERPER_API_KEY");
const DATABASE_URL = reqEnv("DATABASE_URL");
const S3_ENDPOINT = reqEnv("S3_ENDPOINT");
const S3_ACCESS_KEY_ID = reqEnv("S3_ACCESS_KEY_ID");
const S3_SECRET_ACCESS_KEY = reqEnv("S3_SECRET_ACCESS_KEY");
const S3_MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET || "omnix-media";
const S3_PUBLIC_URL = reqEnv("S3_PUBLIC_URL").replace(/\/$/, "");

const sql = postgres(DATABASE_URL, { ssl: "require" });
const s3 = new S3Client({
  region: "auto",
  endpoint: S3_ENDPOINT,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

/** Search Serper images, licensable only, return the first usable URL. */
async function findImage(query) {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
    // tbs=il:cl → "usage rights: Creative Commons licences"
    body: JSON.stringify({ q: query, tbs: "il:cl", num: 10, gl: "ke" }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const images = data.images || [];
  // Prefer reasonably large, directly-fetchable images.
  for (const img of images) {
    const u = img.imageUrl;
    if (!u) continue;
    if (!/^https?:\/\//.test(u)) continue;
    if (/\.svg($|\?)/i.test(u)) continue;
    return { url: u, title: img.title || query, source: img.source };
  }
  return null;
}

/** Download an image, return {bytes, contentType}. */
async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const ct = res.headers.get("content-type") || "image/jpeg";
  if (!ct.startsWith("image/")) throw new Error(`not an image: ${ct}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4096) throw new Error("image too small");
  return { bytes: buf, contentType: ct };
}

function extFor(ct) {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function slotHasImage(slot) {
  const rows = await sql`SELECT id FROM platform_media WHERE slot = ${slot} LIMIT 1`;
  return rows.length > 0;
}

async function seedSlot({ slot, query }) {
  if (!FORCE && (await slotHasImage(slot))) {
    console.log(`• ${slot} — already seeded, skipping`);
    return;
  }
  console.log(`→ ${slot} — searching "${query}"`);
  const found = await findImage(query);
  if (!found) {
    console.warn(`  ! no licensable image found for ${slot}`);
    return;
  }
  let dl;
  try {
    dl = await download(found.url);
  } catch (e) {
    console.warn(`  ! download failed (${e.message}) — trying next is not implemented; skipping ${slot}`);
    return;
  }
  const ext = extFor(dl.contentType);
  const key = `media/${slot.replace(/\./g, "-")}-${Date.now()}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_MEDIA_BUCKET,
    Key: key,
    Body: dl.bytes,
    ContentType: dl.contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const publicUrl = `${S3_PUBLIC_URL}/${key}`;
  const id = randomUUID();
  await sql`
    INSERT INTO platform_media (id, key, url, mime_type, size_bytes, filename, alt, slot, uploaded_by, created_at)
    VALUES (${id}, ${key}, ${publicUrl}, ${dl.contentType}, ${dl.bytes.length},
            ${slot + "." + ext}, ${found.title}, ${slot}, ${"seed-script"}, now())
  `;
  console.log(`  ✓ ${slot} → ${publicUrl}`);
}

console.log(`Seeding ${SLOTS.length} marketing media slots via Serper${FORCE ? " (force)" : ""}…\n`);
for (const s of SLOTS) {
  try {
    await seedSlot(s);
  } catch (e) {
    console.error(`  ✗ ${s.slot}: ${e.message}`);
  }
}
await sql.end();
console.log("\nDone. Review at /admin/media and swap any slot you don't like.");
