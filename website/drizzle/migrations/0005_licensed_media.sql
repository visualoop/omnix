-- Task 8: governed marketing media and verified customer proof.
-- Legacy media remains non-publishable. New uploads begin in a private bucket.
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "rights_basis" text DEFAULT 'unverified' NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "rights_holder" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "rights_source" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "approval_state" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "approved_by" text;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "approval_audit_id" text;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "quarantine_key" text;
--> statement-breakpoint
ALTER TABLE "platform_media" ADD COLUMN IF NOT EXISTS "object_state" text DEFAULT 'quarantine' NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_media" ALTER COLUMN "key" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "platform_media" ALTER COLUMN "url" SET DEFAULT '';
--> statement-breakpoint
UPDATE "platform_media" SET "alt" = '' WHERE "alt" IS NULL;
--> statement-breakpoint
ALTER TABLE "platform_media" ALTER COLUMN "alt" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "platform_media" ALTER COLUMN "alt" SET NOT NULL;
--> statement-breakpoint
UPDATE "platform_media"
SET "object_state" = 'legacy-public', "approval_state" = 'pending',
    "approved_by" = NULL, "approval_audit_id" = NULL, "approved_at" = NULL
WHERE "quarantine_key" IS NULL AND "key" <> '' AND "object_state" = 'quarantine';
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_media" ADD CONSTRAINT "platform_media_approved_by_user_id_fk"
 FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_media" ADD CONSTRAINT "platform_media_approval_audit_id_audit_log_id_fk"
 FOREIGN KEY ("approval_audit_id") REFERENCES "public"."audit_log"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_media_approval_slot_idx"
  ON "platform_media" ("approval_state", "object_state", "slot", "approved_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_proof_evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "reference" text NOT NULL UNIQUE,
  "source_type" text NOT NULL,
  "source_location" text NOT NULL,
  "asserted_content_sha256" text NOT NULL,
  "verification_state" text DEFAULT 'pending' NOT NULL,
  "verified_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_proof_evidence_state_idx" ON "customer_proof_evidence" ("verification_state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_proof_permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_name" text NOT NULL,
  "grantor_name" text NOT NULL,
  "document_reference" text NOT NULL UNIQUE,
  "authorised_content_sha256" text NOT NULL,
  "permission_state" text DEFAULT 'pending' NOT NULL,
  "granted_at" timestamp,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_proof_permissions_state_idx" ON "customer_proof_permissions" ("permission_state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verified_customer_proofs" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "product" text NOT NULL,
  "customer_name" text NOT NULL,
  "content" jsonb NOT NULL,
  "content_sha256" text NOT NULL,
  "evidence_id" text NOT NULL REFERENCES "customer_proof_evidence"("id") ON DELETE RESTRICT,
  "public_permission_id" text NOT NULL REFERENCES "customer_proof_permissions"("id") ON DELETE RESTRICT,
  "media_id" text,
  "approval_state" text DEFAULT 'pending' NOT NULL,
  "approved_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "approval_audit_id" text REFERENCES "audit_log"("id") ON DELETE SET NULL,
  "approved_at" timestamp,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verified_customer_proofs_publication_idx" ON "verified_customer_proofs" ("approval_state", "kind", "display_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verified_customer_proofs_evidence_idx" ON "verified_customer_proofs" ("evidence_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verified_customer_proofs_permission_idx" ON "verified_customer_proofs" ("public_permission_id");
