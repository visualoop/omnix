-- Task 8 hardening: team photos use governed media and proof digests bind the full publication envelope.
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "bio" text,
  "photo_url" text,
  "media_id" text,
  "linkedin_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "media_id" text;
--> statement-breakpoint
UPDATE "team_members" SET "photo_url" = NULL WHERE "photo_url" IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_media_id_platform_media_id_fk"
 FOREIGN KEY ("media_id") REFERENCES "public"."platform_media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_media_idx" ON "team_members" ("media_id");
--> statement-breakpoint
ALTER TABLE "customer_proof_evidence" ADD COLUMN IF NOT EXISTS "asserted_publication_sha256" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_proof_permissions" ADD COLUMN IF NOT EXISTS "authorised_publication_sha256" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "verified_customer_proofs" ADD COLUMN IF NOT EXISTS "publication_sha256" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_proof_evidence" ALTER COLUMN "asserted_content_sha256" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "customer_proof_permissions" ALTER COLUMN "authorised_content_sha256" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "verified_customer_proofs" ALTER COLUMN "content_sha256" SET DEFAULT '';
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verified_customer_proofs" ADD CONSTRAINT "verified_customer_proofs_media_id_platform_media_id_fk"
 FOREIGN KEY ("media_id") REFERENCES "public"."platform_media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
