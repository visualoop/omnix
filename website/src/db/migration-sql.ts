/**
 * Inlined Drizzle migration SQL.
 *
 * Vercel doesn't bundle filesystem files in serverless route handlers,
 * so we inline the migration here as a string. Run via /api/migrate-db
 * (idempotent; tolerates 'already exists').
 *
 * Concatenated from drizzle/migrations/000*.sql.
 */
export const MIGRATION_SQL = String.raw`
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" text,
	"active_team_id" text,
	"impersonated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp,
	"phone_number" text,
	"business_name" text,
	"country" text DEFAULT 'KE' NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"staff_team" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"team_id" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"organization_id" text,
	"license_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"auth_token_hash" text NOT NULL,
	"hostname" text,
	"os" text DEFAULT 'windows',
	"os_version" text,
	"arch" text,
	"current_version" text,
	"active_module" text,
	"branch_name" text,
	"currency" text DEFAULT 'KES',
	"network_mode" text,
	"product_count" integer,
	"employee_count" integer,
	"sales_count_last30d" integer,
	"sales_value_last30d" double precision,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp,
	"first_seen_at" timestamp,
	"last_seen_at" timestamp,
	"last_ip" text,
	"lat" double precision,
	"lng" double precision,
	"city" text,
	"county" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "machines_machine_id_unique" UNIQUE("machine_id")
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"license_key" text NOT NULL,
	"variant" text NOT NULL,
	"tier" text DEFAULT 'starter' NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_branches" integer DEFAULT 1 NOT NULL,
	"max_machines" integer DEFAULT 3 NOT NULL,
	"signed_key" text,
	"trial_started_at" timestamp,
	"trial_ends_at" timestamp,
	"paid_at" timestamp,
	"maintenance_until" timestamp,
	"major_version_cap" integer DEFAULT 1 NOT NULL,
	"cloud_backup_enabled" boolean DEFAULT false NOT NULL,
	"cloud_backup_expires_at" timestamp,
	"price_fee_paid" double precision,
	"currency" text,
	"metadata" jsonb,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "licenses_license_key_unique" UNIQUE("license_key")
);
--> statement-breakpoint
CREATE TABLE "activations" (
	"id" text PRIMARY KEY NOT NULL,
	"license_id" text NOT NULL,
	"machine_id" text,
	"outcome" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"license_id" text,
	"paystack_reference" text NOT NULL,
	"purpose" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"parent_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_paystack_reference_unique" UNIQUE("paystack_reference")
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"assigned_to" text,
	"subject" text NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloud_backups" (
	"id" text PRIMARY KEY NOT NULL,
	"machine_id" text NOT NULL,
	"user_id" text NOT NULL,
	"s3_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"encrypted_sha256" text NOT NULL,
	"metadata" jsonb,
	"taken_at" timestamp NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"channel" text DEFAULT 'stable' NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"msi_url" text,
	"exe_url" text,
	"dmg_url" text,
	"app_image_url" text,
	"signature" text,
	"metadata" jsonb,
	CONSTRAINT "releases_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "telemetry_events" (
	"id" text PRIMARY KEY NOT NULL,
	"machine_id" text NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_impersonated_by_user_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_backups" ADD CONSTRAINT "cloud_backups_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_backups" ADD CONSTRAINT "cloud_backups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "machines_user_idx" ON "machines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "machines_license_idx" ON "machines" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "machines_org_idx" ON "machines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "licenses_user_idx" ON "licenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "licenses_org_idx" ON "licenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "licenses_status_idx" ON "licenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activations_license_idx" ON "activations" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "activations_created_idx" ON "activations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_license_idx" ON "payments" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_messages_ticket_idx" ON "support_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cloud_backups_machine_idx" ON "cloud_backups" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "cloud_backups_user_idx" ON "cloud_backups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "telemetry_machine_idx" ON "telemetry_events" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "telemetry_occurred_idx" ON "telemetry_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"value" text,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);

--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "origin" text DEFAULT 'paystack' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "activations_license_machine_uidx"
  ON "activations" ("license_id", "machine_id")
  WHERE "machine_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_sync_log" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "machine_id" text,
  "license_key" text NOT NULL,
  "status" text NOT NULL,
  "message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_sync_log_user_idx" ON "license_sync_log" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_media" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "url" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "filename" text,
  "alt" text,
  "slot" text,
  "uploaded_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_media_slot_idx" ON "platform_media" ("slot");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_media_created_at_idx" ON "platform_media" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "bio" text,
  "photo_url" text,
  "linkedin_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_active_idx" ON "team_members" ("active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_sort_idx" ON "team_members" ("sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resellers" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "company_name" text NOT NULL,
  "contact_phone" text,
  "contact_email" text,
  "discount_percent" integer DEFAULT 15 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "total_licenses_issued" integer DEFAULT 0 NOT NULL,
  "total_revenue_brought" double precision DEFAULT 0 NOT NULL,
  "total_commission_earned" double precision DEFAULT 0 NOT NULL,
  "unpaid_commission" double precision DEFAULT 0 NOT NULL,
  "commission_currency" text DEFAULT 'KES' NOT NULL,
  "approved_by" text,
  "approved_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resellers" ADD CONSTRAINT "resellers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resellers" ADD CONSTRAINT "resellers_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resellers_status_idx" ON "resellers" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reseller_commissions" (
  "id" text PRIMARY KEY NOT NULL,
  "reseller_id" text NOT NULL,
  "payment_id" text NOT NULL UNIQUE,
  "license_id" text NOT NULL,
  "gross_amount" double precision NOT NULL,
  "commission_amount" double precision NOT NULL,
  "currency" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "paid_out_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reseller_commissions" ADD CONSTRAINT "reseller_commissions_reseller_id_resellers_id_fk" FOREIGN KEY ("reseller_id") REFERENCES "public"."resellers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reseller_commissions_reseller_idx" ON "reseller_commissions" ("reseller_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reseller_commissions_status_idx" ON "reseller_commissions" ("status");
--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "reseller_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_reseller_idx" ON "licenses" ("reseller_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliates" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "ref_code" text NOT NULL UNIQUE,
  "display_name" text,
  "contact_email" text,
  "contact_phone" text,
  "payout_method" text,
  "payout_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "commission_percent" integer DEFAULT 33 NOT NULL,
  "total_referrals_credited" integer DEFAULT 0 NOT NULL,
  "total_commission_earned" double precision DEFAULT 0 NOT NULL,
  "unpaid_balance" double precision DEFAULT 0 NOT NULL,
  "commission_currency" text DEFAULT 'KES' NOT NULL,
  "blocked" boolean DEFAULT false NOT NULL,
  "blocked_reason" text,
  "approved_at" timestamp,
  "credited_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliates_blocked_idx" ON "affiliates" ("blocked");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_credits" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_id" text NOT NULL,
  "payment_id" text NOT NULL UNIQUE,
  "license_id" text,
  "referred_user_id" text NOT NULL,
  "gross_amount" double precision NOT NULL,
  "commission_amount" double precision NOT NULL,
  "currency" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "paid_out_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_credits" ADD CONSTRAINT "affiliate_credits_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_credits_affiliate_idx" ON "affiliate_credits" ("affiliate_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_credits_status_idx" ON "affiliate_credits" ("status");
--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN IF NOT EXISTS "update_channel" text NOT NULL DEFAULT 'stable';
--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN IF NOT EXISTS "auto_update_enabled" text NOT NULL DEFAULT 'true';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "machines_update_channel_idx" ON "machines" ("update_channel");
--> statement-breakpoint
`

/** Split into individual statements (Drizzle generates with statement-breakpoints). */
export function splitStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
