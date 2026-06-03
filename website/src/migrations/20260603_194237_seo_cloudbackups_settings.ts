import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_cloud_backups_status" AS ENUM('pending', 'uploaded', 'pruned', 'quarantined');
  CREATE TABLE "cloud_backups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"license_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"machine_id" integer,
  	"object_key" varchar NOT NULL,
  	"bucket" varchar DEFAULT 'omnix-backups',
  	"size_bytes" numeric,
  	"sha256" varchar,
  	"client_key_hint" varchar,
  	"status" "enum_cloud_backups_status" DEFAULT 'pending',
  	"prune_after" timestamp(3) with time zone,
  	"finalized_at" timestamp(3) with time zone,
  	"desktop_version" varchar,
  	"source_rows" numeric,
  	"source_size_bytes" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pages" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "blog_posts" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "blog_posts" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "blog_posts" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "modules" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "modules" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "modules" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "cloud_backups_id" integer;
  ALTER TABLE "settings" ADD COLUMN "integrations_paystack_public_key" varchar;
  ALTER TABLE "settings" ADD COLUMN "integrations_paystack_secret_key" varchar;
  ALTER TABLE "settings" ADD COLUMN "integrations_paystack_webhook_secret" varchar;
  ALTER TABLE "settings" ADD COLUMN "integrations_resend_api_key" varchar;
  ALTER TABLE "settings" ADD COLUMN "integrations_resend_from_email" varchar;
  ALTER TABLE "settings" ADD COLUMN "integrations_google_analytics_id" varchar;
  ALTER TABLE "settings" ADD COLUMN "integrations_cloud_backup_enabled" boolean DEFAULT false;
  ALTER TABLE "settings" ADD COLUMN "integrations_cloud_backup_price_monthly" numeric DEFAULT 500;
  ALTER TABLE "settings" ADD COLUMN "integrations_cloud_backup_retention_days" numeric DEFAULT 30;
  ALTER TABLE "cloud_backups" ADD CONSTRAINT "cloud_backups_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cloud_backups" ADD CONSTRAINT "cloud_backups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cloud_backups" ADD CONSTRAINT "cloud_backups_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cloud_backups_license_idx" ON "cloud_backups" USING btree ("license_id");
  CREATE INDEX "cloud_backups_customer_idx" ON "cloud_backups" USING btree ("customer_id");
  CREATE INDEX "cloud_backups_machine_id_idx" ON "cloud_backups" USING btree ("machine_id");
  CREATE INDEX "cloud_backups_machine_idx" ON "cloud_backups" USING btree ("machine_id");
  CREATE UNIQUE INDEX "cloud_backups_object_key_idx" ON "cloud_backups" USING btree ("object_key");
  CREATE INDEX "cloud_backups_status_idx" ON "cloud_backups" USING btree ("status");
  CREATE INDEX "cloud_backups_updated_at_idx" ON "cloud_backups" USING btree ("updated_at");
  CREATE INDEX "cloud_backups_created_at_idx" ON "cloud_backups" USING btree ("created_at");
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "modules" ADD CONSTRAINT "modules_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cloud_backups_fk" FOREIGN KEY ("cloud_backups_id") REFERENCES "public"."cloud_backups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE INDEX "blog_posts_meta_meta_image_idx" ON "blog_posts" USING btree ("meta_image_id");
  CREATE INDEX "modules_meta_meta_image_idx" ON "modules" USING btree ("meta_image_id");
  CREATE INDEX "payload_locked_documents_rels_cloud_backups_id_idx" ON "payload_locked_documents_rels" USING btree ("cloud_backups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cloud_backups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cloud_backups" CASCADE;
  ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_media_id_fk";
  
  ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_meta_image_id_media_id_fk";
  
  ALTER TABLE "modules" DROP CONSTRAINT "modules_meta_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_cloud_backups_fk";
  
  DROP INDEX "pages_meta_meta_image_idx";
  DROP INDEX "blog_posts_meta_meta_image_idx";
  DROP INDEX "modules_meta_meta_image_idx";
  DROP INDEX "payload_locked_documents_rels_cloud_backups_id_idx";
  ALTER TABLE "pages" DROP COLUMN "meta_title";
  ALTER TABLE "pages" DROP COLUMN "meta_description";
  ALTER TABLE "pages" DROP COLUMN "meta_image_id";
  ALTER TABLE "blog_posts" DROP COLUMN "meta_title";
  ALTER TABLE "blog_posts" DROP COLUMN "meta_description";
  ALTER TABLE "blog_posts" DROP COLUMN "meta_image_id";
  ALTER TABLE "modules" DROP COLUMN "meta_title";
  ALTER TABLE "modules" DROP COLUMN "meta_description";
  ALTER TABLE "modules" DROP COLUMN "meta_image_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "cloud_backups_id";
  ALTER TABLE "settings" DROP COLUMN "integrations_paystack_public_key";
  ALTER TABLE "settings" DROP COLUMN "integrations_paystack_secret_key";
  ALTER TABLE "settings" DROP COLUMN "integrations_paystack_webhook_secret";
  ALTER TABLE "settings" DROP COLUMN "integrations_resend_api_key";
  ALTER TABLE "settings" DROP COLUMN "integrations_resend_from_email";
  ALTER TABLE "settings" DROP COLUMN "integrations_google_analytics_id";
  ALTER TABLE "settings" DROP COLUMN "integrations_cloud_backup_enabled";
  ALTER TABLE "settings" DROP COLUMN "integrations_cloud_backup_price_monthly";
  ALTER TABLE "settings" DROP COLUMN "integrations_cloud_backup_retention_days";
  DROP TYPE "public"."enum_cloud_backups_status";`)
}
