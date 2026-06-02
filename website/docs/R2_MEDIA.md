# R2 Media Storage

The website uses **Cloudflare R2** for media uploads (via Payload's `@payloadcms/storage-s3`
plugin against R2's S3-compatible API). Bucket: **`omnix-media`**.

## What's already set up

- ✅ R2 bucket `omnix-media` created (account `c1eaaa292b9dddcb67f9592bb5bc1948`)
- ✅ Public read access enabled at `https://pub-808f3030fbba4752aa645df8faf3b662.r2.dev`
- ✅ CORS configured for `omnix.co.ke`, `www.omnix.co.ke`, the Vercel deployment URL, and `localhost:3000`
- ✅ Payload `s3Storage` plugin wired in `src/payload.config.ts`, gated on `S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY + S3_ENDPOINT + S3_BUCKET` being set
- ✅ Vercel env (production):
  - `S3_ENDPOINT` = `https://c1eaaa292b9dddcb67f9592bb5bc1948.r2.cloudflarestorage.com`
  - `S3_BUCKET` = `omnix-media`
  - `S3_REGION` = `auto`
  - `S3_PUBLIC_URL` = `https://pub-808f3030fbba4752aa645df8faf3b662.r2.dev`

## What you need to add (one-time, dashboard only)

Cloudflare doesn't expose R2 S3-compatible access key creation via API for our token
permissions — they have to be created through the dashboard:

1. Go to **Cloudflare dashboard** → **R2** → **Manage R2 API Tokens** → **Create API Token**.
2. Name: `omnix-media-rw`. Permissions: **Object Read & Write**. Specify bucket: `omnix-media`. TTL: forever.
3. Click **Create API Token**. Copy the **Access Key ID** and **Secret Access Key**.
4. Paste them as Vercel env vars (Production):

   ```bash
   cd website
   printf 'YOUR_ACCESS_KEY_ID' | npx vercel env add S3_ACCESS_KEY_ID production
   printf 'YOUR_SECRET_ACCESS_KEY' | npx vercel env add S3_SECRET_ACCESS_KEY production
   ```

5. Redeploy: `npx vercel redeploy <prod-url>` (or push to main).

After that, media uploads via Payload admin go straight to R2 and get served from `S3_PUBLIC_URL`.

## Branded URL (later, when DNS is active)

Once `omnix.co.ke` nameservers propagate at the registrar, attach `media.omnix.co.ke`
to the bucket:

```
Cloudflare dashboard → R2 → omnix-media → Settings → Custom Domains → Connect Domain
  → media.omnix.co.ke
```

Then update `S3_PUBLIC_URL=https://media.omnix.co.ke` on Vercel and redeploy. All existing
media URLs auto-rewrite (Payload reads the URL fresh on each request).
