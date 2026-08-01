-- Signed Android artifacts share the release version row with the existing
-- Windows installers. Every column is nullable so historical desktop-only
-- releases continue to work unchanged.
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_platform" text;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_package_id" text;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_version_code" integer;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_apk_url" text;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_aab_url" text;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_apk_size" integer;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_aab_size" integer;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "sha256_apk" text;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "sha256_aab" text;
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "android_signing_certificate_sha256" text;
