-- Task 34: admin-managed YouTube module demo videos for the five product pages.
-- One row per product; we persist only the normalised 11-char YouTube video ID
-- (never embed HTML or a raw admin URL). Idempotent so /api/migrate-db and the
-- self-migrate path can re-run it safely.
CREATE TABLE IF NOT EXISTS "module_demo_videos" (
  "id" text PRIMARY KEY NOT NULL,
  "product" text NOT NULL,
  "video_id" text DEFAULT '' NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "updated_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "module_demo_videos" ADD CONSTRAINT "module_demo_videos_updated_by_user_id_fk"
 FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "module_demo_videos_product_uidx" ON "module_demo_videos" ("product");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_demo_videos_published_idx" ON "module_demo_videos" ("published");
