import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_licenses_variant" AS ENUM('pro', 'dawa', 'retail', 'hospitality', 'hardware');
  CREATE TYPE "public"."enum_releases_variant" AS ENUM('pro', 'dawa', 'retail', 'hospitality', 'hardware');
  CREATE TYPE "public"."enum_home_content_module_rows_variant" AS ENUM('dawa', 'retail', 'hospitality', 'hardware');
  CREATE TYPE "public"."enum_contact_content_methods_channel" AS ENUM('whatsapp', 'email-support', 'email-sales', 'phone', 'office');
  CREATE TABLE "home_content_ai_samples" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prompt" varchar
  );
  
  CREATE TABLE "home_content_module_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_home_content_module_rows_variant" NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"cta_label" varchar,
  	"cta_href" varchar
  );
  
  CREATE TABLE "home_content_deploy_bullets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" varchar
  );
  
  CREATE TABLE "home_content" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_eyebrow" varchar DEFAULT 'For Kenyan SMEs',
  	"hero_title" varchar NOT NULL,
  	"hero_subtitle" varchar,
  	"hero_primary_cta_label" varchar DEFAULT 'Start free trial',
  	"hero_primary_cta_href" varchar DEFAULT '/signup',
  	"hero_secondary_cta_label" varchar DEFAULT 'See pricing',
  	"hero_secondary_cta_href" varchar DEFAULT '/pricing',
  	"founder_heading" varchar DEFAULT 'Built by an operator, not a software shop.',
  	"founder_name" varchar DEFAULT 'Justine Gachuru',
  	"founder_role" varchar DEFAULT 'Founder, Omnix',
  	"founder_photo_id" integer,
  	"founder_quote" varchar,
  	"founder_body" jsonb,
  	"ai_eyebrow" varchar DEFAULT 'New',
  	"ai_heading" varchar DEFAULT 'Ask your business anything.',
  	"ai_subheading" varchar,
  	"ai_cta_label" varchar DEFAULT 'See AI in action',
  	"ai_cta_href" varchar DEFAULT '/ai',
  	"deploy_heading" varchar DEFAULT 'Built to run on a single Windows PC.',
  	"deploy_subheading" varchar,
  	"closing_heading" varchar,
  	"closing_body" varchar,
  	"closing_primary_cta_label" varchar DEFAULT 'Start free trial',
  	"closing_primary_cta_href" varchar DEFAULT '/signup',
  	"closing_whatsapp_prompt" varchar DEFAULT 'or talk to us on WhatsApp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "contact_content_methods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel" "enum_contact_content_methods_channel" NOT NULL,
  	"label" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "contact_content_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "contact_content" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"page_title" varchar DEFAULT 'Talk to a human.',
  	"page_subtitle" varchar,
  	"methods_heading" varchar DEFAULT 'Pick the fastest channel',
  	"faq_heading" varchar DEFAULT 'Frequently asked',
  	"cta_heading" varchar,
  	"cta_body" varchar,
  	"cta_primary_label" varchar DEFAULT 'Start free trial',
  	"cta_primary_href" varchar DEFAULT '/signup',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "footer_content_product_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content_trade_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content_company_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content_legal_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"branding" varchar,
  	"copyright_line" varchar,
  	"product_heading" varchar DEFAULT 'Product',
  	"trades_heading" varchar DEFAULT 'Trades',
  	"company_heading" varchar DEFAULT 'Company',
  	"legal_heading" varchar DEFAULT 'Legal',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  DROP INDEX "releases_version_idx";
  ALTER TABLE "pricing" ALTER COLUMN "starter_one_time_fee" SET DEFAULT 50000;
  ALTER TABLE "pricing" ALTER COLUMN "starter_maintenance_yearly" SET DEFAULT 0;
  ALTER TABLE "pricing" ALTER COLUMN "business_one_time_fee" SET DEFAULT 150000;
  ALTER TABLE "pricing" ALTER COLUMN "business_maintenance_yearly" SET DEFAULT 0;
  ALTER TABLE "licenses" ADD COLUMN "variant" "enum_licenses_variant" DEFAULT 'pro' NOT NULL;
  ALTER TABLE "releases" ADD COLUMN "variant" "enum_releases_variant" DEFAULT 'pro' NOT NULL;
  ALTER TABLE "media" ADD COLUMN "prefix" varchar DEFAULT 'media';
  ALTER TABLE "home_content_ai_samples" ADD CONSTRAINT "home_content_ai_samples_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_content_module_rows" ADD CONSTRAINT "home_content_module_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_content_deploy_bullets" ADD CONSTRAINT "home_content_deploy_bullets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_content" ADD CONSTRAINT "home_content_founder_photo_id_media_id_fk" FOREIGN KEY ("founder_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_content_methods" ADD CONSTRAINT "contact_content_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact_content_faq" ADD CONSTRAINT "contact_content_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_product_links" ADD CONSTRAINT "footer_content_product_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_trade_links" ADD CONSTRAINT "footer_content_trade_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_company_links" ADD CONSTRAINT "footer_content_company_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_legal_links" ADD CONSTRAINT "footer_content_legal_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "home_content_ai_samples_order_idx" ON "home_content_ai_samples" USING btree ("_order");
  CREATE INDEX "home_content_ai_samples_parent_id_idx" ON "home_content_ai_samples" USING btree ("_parent_id");
  CREATE INDEX "home_content_module_rows_order_idx" ON "home_content_module_rows" USING btree ("_order");
  CREATE INDEX "home_content_module_rows_parent_id_idx" ON "home_content_module_rows" USING btree ("_parent_id");
  CREATE INDEX "home_content_deploy_bullets_order_idx" ON "home_content_deploy_bullets" USING btree ("_order");
  CREATE INDEX "home_content_deploy_bullets_parent_id_idx" ON "home_content_deploy_bullets" USING btree ("_parent_id");
  CREATE INDEX "home_content_founder_photo_idx" ON "home_content" USING btree ("founder_photo_id");
  CREATE INDEX "contact_content_methods_order_idx" ON "contact_content_methods" USING btree ("_order");
  CREATE INDEX "contact_content_methods_parent_id_idx" ON "contact_content_methods" USING btree ("_parent_id");
  CREATE INDEX "contact_content_faq_order_idx" ON "contact_content_faq" USING btree ("_order");
  CREATE INDEX "contact_content_faq_parent_id_idx" ON "contact_content_faq" USING btree ("_parent_id");
  CREATE INDEX "footer_content_product_links_order_idx" ON "footer_content_product_links" USING btree ("_order");
  CREATE INDEX "footer_content_product_links_parent_id_idx" ON "footer_content_product_links" USING btree ("_parent_id");
  CREATE INDEX "footer_content_trade_links_order_idx" ON "footer_content_trade_links" USING btree ("_order");
  CREATE INDEX "footer_content_trade_links_parent_id_idx" ON "footer_content_trade_links" USING btree ("_parent_id");
  CREATE INDEX "footer_content_company_links_order_idx" ON "footer_content_company_links" USING btree ("_order");
  CREATE INDEX "footer_content_company_links_parent_id_idx" ON "footer_content_company_links" USING btree ("_parent_id");
  CREATE INDEX "footer_content_legal_links_order_idx" ON "footer_content_legal_links" USING btree ("_order");
  CREATE INDEX "footer_content_legal_links_parent_id_idx" ON "footer_content_legal_links" USING btree ("_parent_id");
  ALTER TABLE "customers" DROP COLUMN "_verified";
  ALTER TABLE "customers" DROP COLUMN "_verificationtoken";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_content_ai_samples" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_content_module_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_content_deploy_bullets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_content_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_content_faq" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_product_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_trade_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_company_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_legal_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "home_content_ai_samples" CASCADE;
  DROP TABLE "home_content_module_rows" CASCADE;
  DROP TABLE "home_content_deploy_bullets" CASCADE;
  DROP TABLE "home_content" CASCADE;
  DROP TABLE "contact_content_methods" CASCADE;
  DROP TABLE "contact_content_faq" CASCADE;
  DROP TABLE "contact_content" CASCADE;
  DROP TABLE "footer_content_product_links" CASCADE;
  DROP TABLE "footer_content_trade_links" CASCADE;
  DROP TABLE "footer_content_company_links" CASCADE;
  DROP TABLE "footer_content_legal_links" CASCADE;
  DROP TABLE "footer_content" CASCADE;
  ALTER TABLE "pricing" ALTER COLUMN "starter_one_time_fee" SET DEFAULT 100000;
  ALTER TABLE "pricing" ALTER COLUMN "starter_maintenance_yearly" SET DEFAULT 12000;
  ALTER TABLE "pricing" ALTER COLUMN "business_one_time_fee" SET DEFAULT 75000;
  ALTER TABLE "pricing" ALTER COLUMN "business_maintenance_yearly" SET DEFAULT 25000;
  ALTER TABLE "customers" ADD COLUMN "_verified" boolean;
  ALTER TABLE "customers" ADD COLUMN "_verificationtoken" varchar;
  CREATE UNIQUE INDEX "releases_version_idx" ON "releases" USING btree ("version");
  ALTER TABLE "licenses" DROP COLUMN "variant";
  ALTER TABLE "releases" DROP COLUMN "variant";
  ALTER TABLE "media" DROP COLUMN "prefix";
  DROP TYPE "public"."enum_licenses_variant";
  DROP TYPE "public"."enum_releases_variant";
  DROP TYPE "public"."enum_home_content_module_rows_variant";
  DROP TYPE "public"."enum_contact_content_methods_channel";`)
}
