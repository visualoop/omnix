CREATE TABLE IF NOT EXISTS "demo_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "full_name" text NOT NULL,
  "work_email" text NOT NULL,
  "phone" text NOT NULL,
  "business_name" text NOT NULL,
  "product" text NOT NULL,
  "location_count" integer DEFAULT 1 NOT NULL,
  "current_system" text,
  "priorities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "preferred_channel" text NOT NULL,
  "preferred_window" text NOT NULL,
  "locale" text DEFAULT 'ke' NOT NULL,
  "source_path" text NOT NULL,
  "referrer" text,
  "attribution" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "marketing_opt_in" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_requests_status_idx" ON "demo_requests" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_requests_created_idx" ON "demo_requests" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_requests_product_idx" ON "demo_requests" ("product");
