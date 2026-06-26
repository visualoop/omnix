#!/usr/bin/env node
/**
 * seed-r2-images.mjs — one-shot: find licensable images via Serper,
 * upload to the omnix-media R2 bucket, and print a slot→public-URL map
 * to wire as built-in defaults in media-slots.ts.
 *
 * Uses R2_* env vars (already in the shell) + SERPER_API_KEY.
 * Public base: https://media.omnix.co.ke (verified serving omnix-media).
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const PUBLIC_BASE = "https://media.omnix.co.ke";
const BUCKET = "omnix-media";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const SLOTS = [
  { slot: "hero.background", query: "modern retail shop interior Kenya counter bright" },
  { slot: "hero.product_shot", query: "point of sale software dashboard screen laptop" },
  { slot: "module.dawa.hero", query: "pharmacy shelves medicine counter pharmacist" },
  { slot: "module.retail.hero", query: "supermarket minimart shop shelves checkout Kenya" },
  { slot: "module.hardware.hero", query: "hardware store building materials shop interior" },
  { slot: "module.hospitality.hero", query: "restaurant bar counter interior modern" },
  { slot: "pricing.hero", query: "small business owner shop laptop working Africa" },
  { slot: "about.team_photo", query: "diverse software team working office laptops" },
  { slot: "og.default", query: "retail shop checkout payment mobile money Africa" },
  // Homepage "Four trades" rows (modules-rows-section ModulePlaceholder).
  { slot: "module-row.dawa-pharmacy", query: "pharmacy counter pharmacist dispensing medicine bright" },
  { slot: "module-row.soko-retail", query: "minimart grocery shop shelves products checkout counter" },
  { slot: "module-row.hardware", query: "hardware store tools building materials showroom interior" },
  { slot: "module-row.hospitality", query: "restaurant bar dining counter interior warm" },
];

async function findImages(query) {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, tbs: "il:cl", num: 25, gl: "ke" }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json();
  const imgs = (data.images || []).filter((i) => i.imageUrl);

  // Stock sites that slap watermarks on their "licensable" previews — skip.
  const WATERMARKED = /123rf|shutterstock|alamy|dreamstime|istockphoto|gettyimages|depositphotos|stock\.adobe|123 rf|bigstock|canstockphoto|vecteezy|freepik|stockphoto|watermark/i;
  // Sources that serve clean, genuinely free images — prefer these first.
  const CLEAN = /wikimedia|wikipedia|pexels|pixabay|unsplash|openverse|flickr|staticflickr|publicdomain|rawpixel|burst\.shopify|stocksnap/i;

  const clean = imgs.filter((i) => !WATERMARKED.test(i.imageUrl) && !WATERMARKED.test(i.source || "") && !WATERMARKED.test(i.title || ""));
  const preferred = clean.filter((i) => CLEAN.test(i.imageUrl) || CLEAN.test(i.source || ""));
  // Preferred clean sources first, then any other non-watermarked, then give up.
  return [...preferred, ...clean].map((i) => i.imageUrl);
}

async function download(url) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`dl ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) throw new Error(`not image: ${ct}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8000) throw new Error("too small");
  if (buf.length > 6_000_000) throw new Error("too big");
  return { bytes: buf, ct };
}

function ext(ct) {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "jpg";
}

const result = {};
for (const { slot, query } of SLOTS) {
  process.stdout.write(`→ ${slot} … `);
  let done = false;
  try {
    const candidates = await findImages(query);
    for (const url of candidates) {
      if (/\.svg($|\?)/i.test(url)) continue;
      try {
        const { bytes, ct } = await download(url);
        const key = `marketing/${slot.replace(/\./g, "-")}.${ext(ct)}`;
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET, Key: key, Body: bytes, ContentType: ct,
          CacheControl: "public, max-age=31536000, immutable",
        }));
        result[slot] = `${PUBLIC_BASE}/${key}`;
        console.log(`✓ ${(bytes.length / 1024).toFixed(0)}KB`);
        done = true;
        break;
      } catch {
        // try next candidate
      }
    }
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }
  if (!done && !result[slot]) console.log("✗ no usable image");
}

console.log("\n=== SLOT DEFAULTS (paste into media-slots.ts) ===");
console.log(JSON.stringify(result, null, 2));
