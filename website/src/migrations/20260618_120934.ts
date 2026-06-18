import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'sw', 'fr', 'pt', 'es', 'ar');
  CREATE TABLE "pages_locales" (
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "blog_posts_locales" (
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "modules_locales" (
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "home_content_ai_samples_locales" (
  	"prompt" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_content_module_rows_locales" (
  	"title" varchar,
  	"body" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_content_deploy_bullets_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_content_locales" (
  	"hero_eyebrow" varchar DEFAULT 'For Kenyan SMEs',
  	"hero_title" varchar NOT NULL,
  	"hero_subtitle" varchar,
  	"hero_primary_cta_label" varchar DEFAULT 'Start free trial',
  	"hero_secondary_cta_label" varchar DEFAULT 'See pricing',
  	"founder_heading" varchar DEFAULT 'Built by an operator, not a software shop.',
  	"founder_name" varchar DEFAULT 'Justine Gachuru',
  	"founder_role" varchar DEFAULT 'Founder, Omnix',
  	"founder_quote" varchar,
  	"founder_body" jsonb,
  	"ai_eyebrow" varchar DEFAULT 'New',
  	"ai_heading" varchar DEFAULT 'Ask your business anything.',
  	"ai_subheading" varchar,
  	"ai_cta_label" varchar DEFAULT 'See AI in action',
  	"deploy_heading" varchar DEFAULT 'Built to run on a single Windows PC.',
  	"deploy_subheading" varchar,
  	"closing_heading" varchar,
  	"closing_body" varchar,
  	"closing_primary_cta_label" varchar DEFAULT 'Start free trial',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "contact_content_methods_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "contact_content_faq_locales" (
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "contact_content_locales" (
  	"page_title" varchar DEFAULT 'Talk to a human.',
  	"page_subtitle" varchar,
  	"methods_heading" varchar DEFAULT 'Pick the fastest channel',
  	"faq_heading" varchar DEFAULT 'Frequently asked',
  	"cta_heading" varchar,
  	"cta_body" varchar,
  	"cta_primary_label" varchar DEFAULT 'Start free trial',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "footer_content_product_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content_trade_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content_company_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content_legal_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "footer_content_locales" (
  	"branding" varchar,
  	"copyright_line" varchar,
  	"product_heading" varchar DEFAULT 'Product',
  	"trades_heading" varchar DEFAULT 'Trades',
  	"company_heading" varchar DEFAULT 'Company',
  	"legal_heading" varchar DEFAULT 'Legal',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "trade_landings_pro_who_for_items_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_pro_signature_features_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_pro_compliance_locales" (
  	"item" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_dawa_who_for_items_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_dawa_signature_features_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_dawa_compliance_locales" (
  	"item" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_retail_who_for_items_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_retail_signature_features_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_retail_compliance_locales" (
  	"item" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hospitality_who_for_items_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hospitality_signature_features_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hospitality_compliance_locales" (
  	"item" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hardware_who_for_items_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hardware_signature_features_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hardware_compliance_locales" (
  	"item" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_locales" (
  	"pro_tagline" varchar,
  	"pro_hero_eyebrow" varchar,
  	"pro_hero_description" varchar,
  	"pro_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"pro_pricing_note" varchar,
  	"pro_cta_buy_label" varchar DEFAULT 'Buy now',
  	"pro_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"dawa_tagline" varchar,
  	"dawa_hero_eyebrow" varchar,
  	"dawa_hero_description" varchar,
  	"dawa_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"dawa_pricing_note" varchar,
  	"dawa_cta_buy_label" varchar DEFAULT 'Buy now',
  	"dawa_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"retail_tagline" varchar,
  	"retail_hero_eyebrow" varchar,
  	"retail_hero_description" varchar,
  	"retail_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"retail_pricing_note" varchar,
  	"retail_cta_buy_label" varchar DEFAULT 'Buy now',
  	"retail_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"hospitality_tagline" varchar,
  	"hospitality_hero_eyebrow" varchar,
  	"hospitality_hero_description" varchar,
  	"hospitality_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"hospitality_pricing_note" varchar,
  	"hospitality_cta_buy_label" varchar DEFAULT 'Buy now',
  	"hospitality_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"hardware_tagline" varchar,
  	"hardware_hero_eyebrow" varchar,
  	"hardware_hero_description" varchar,
  	"hardware_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"hardware_pricing_note" varchar,
  	"hardware_cta_buy_label" varchar DEFAULT 'Buy now',
  	"hardware_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_media_id_fk";
  
  ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_meta_image_id_media_id_fk";
  
  ALTER TABLE "modules" DROP CONSTRAINT "modules_meta_image_id_media_id_fk";
  
  DROP INDEX "pages_meta_meta_image_idx";
  DROP INDEX "blog_posts_meta_meta_image_idx";
  DROP INDEX "modules_meta_meta_image_idx";
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_posts_locales" ADD CONSTRAINT "blog_posts_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts_locales" ADD CONSTRAINT "blog_posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "modules_locales" ADD CONSTRAINT "modules_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "modules_locales" ADD CONSTRAINT "modules_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_content_ai_samples_locales" ADD CONSTRAINT "home_content_ai_samples_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content_ai_samples"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_content_module_rows_locales" ADD CONSTRAINT "home_content_module_rows_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content_module_rows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_content_deploy_bullets_locales" ADD CONSTRAINT "home_content_deploy_bullets_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content_deploy_bullets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_content_locales" ADD CONSTRAINT "home_content_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact_content_methods_locales" ADD CONSTRAINT "contact_content_methods_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_content_methods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact_content_faq_locales" ADD CONSTRAINT "contact_content_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_content_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact_content_locales" ADD CONSTRAINT "contact_content_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_product_links_locales" ADD CONSTRAINT "footer_content_product_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content_product_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_trade_links_locales" ADD CONSTRAINT "footer_content_trade_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content_trade_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_company_links_locales" ADD CONSTRAINT "footer_content_company_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content_company_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_legal_links_locales" ADD CONSTRAINT "footer_content_legal_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content_legal_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_content_locales" ADD CONSTRAINT "footer_content_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_pro_who_for_items_locales" ADD CONSTRAINT "trade_landings_pro_who_for_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_pro_who_for_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_pro_signature_features_locales" ADD CONSTRAINT "trade_landings_pro_signature_features_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_pro_signature_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_pro_compliance_locales" ADD CONSTRAINT "trade_landings_pro_compliance_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_pro_compliance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_dawa_who_for_items_locales" ADD CONSTRAINT "trade_landings_dawa_who_for_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_dawa_who_for_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_dawa_signature_features_locales" ADD CONSTRAINT "trade_landings_dawa_signature_features_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_dawa_signature_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_dawa_compliance_locales" ADD CONSTRAINT "trade_landings_dawa_compliance_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_dawa_compliance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_retail_who_for_items_locales" ADD CONSTRAINT "trade_landings_retail_who_for_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_retail_who_for_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_retail_signature_features_locales" ADD CONSTRAINT "trade_landings_retail_signature_features_locales_parent_i_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_retail_signature_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_retail_compliance_locales" ADD CONSTRAINT "trade_landings_retail_compliance_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_retail_compliance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hospitality_who_for_items_locales" ADD CONSTRAINT "trade_landings_hospitality_who_for_items_locales_parent_i_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_hospitality_who_for_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hospitality_signature_features_locales" ADD CONSTRAINT "trade_landings_hospitality_signature_features_locales_par_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_hospitality_signature_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hospitality_compliance_locales" ADD CONSTRAINT "trade_landings_hospitality_compliance_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_hospitality_compliance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hardware_who_for_items_locales" ADD CONSTRAINT "trade_landings_hardware_who_for_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_hardware_who_for_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hardware_signature_features_locales" ADD CONSTRAINT "trade_landings_hardware_signature_features_locales_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_hardware_signature_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hardware_compliance_locales" ADD CONSTRAINT "trade_landings_hardware_compliance_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings_hardware_compliance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_locales" ADD CONSTRAINT "trade_landings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "blog_posts_meta_meta_image_idx" ON "blog_posts_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "blog_posts_locales_locale_parent_id_unique" ON "blog_posts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "modules_meta_meta_image_idx" ON "modules_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "modules_locales_locale_parent_id_unique" ON "modules_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "home_content_ai_samples_locales_locale_parent_id_unique" ON "home_content_ai_samples_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "home_content_module_rows_locales_locale_parent_id_unique" ON "home_content_module_rows_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "home_content_deploy_bullets_locales_locale_parent_id_unique" ON "home_content_deploy_bullets_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "home_content_locales_locale_parent_id_unique" ON "home_content_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "contact_content_methods_locales_locale_parent_id_unique" ON "contact_content_methods_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "contact_content_faq_locales_locale_parent_id_unique" ON "contact_content_faq_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "contact_content_locales_locale_parent_id_unique" ON "contact_content_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "footer_content_product_links_locales_locale_parent_id_unique" ON "footer_content_product_links_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "footer_content_trade_links_locales_locale_parent_id_unique" ON "footer_content_trade_links_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "footer_content_company_links_locales_locale_parent_id_unique" ON "footer_content_company_links_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "footer_content_legal_links_locales_locale_parent_id_unique" ON "footer_content_legal_links_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "footer_content_locales_locale_parent_id_unique" ON "footer_content_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_pro_who_for_items_locales_locale_parent_id_un" ON "trade_landings_pro_who_for_items_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_pro_signature_features_locales_locale_parent_" ON "trade_landings_pro_signature_features_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_pro_compliance_locales_locale_parent_id_uniqu" ON "trade_landings_pro_compliance_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_dawa_who_for_items_locales_locale_parent_id_u" ON "trade_landings_dawa_who_for_items_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_dawa_signature_features_locales_locale_parent" ON "trade_landings_dawa_signature_features_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_dawa_compliance_locales_locale_parent_id_uniq" ON "trade_landings_dawa_compliance_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_retail_who_for_items_locales_locale_parent_id" ON "trade_landings_retail_who_for_items_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_retail_signature_features_locales_locale_pare" ON "trade_landings_retail_signature_features_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_retail_compliance_locales_locale_parent_id_un" ON "trade_landings_retail_compliance_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_hospitality_who_for_items_locales_locale_pare" ON "trade_landings_hospitality_who_for_items_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_hospitality_signature_features_locales_locale" ON "trade_landings_hospitality_signature_features_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_hospitality_compliance_locales_locale_parent_" ON "trade_landings_hospitality_compliance_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_hardware_who_for_items_locales_locale_parent_" ON "trade_landings_hardware_who_for_items_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_hardware_signature_features_locales_locale_pa" ON "trade_landings_hardware_signature_features_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_hardware_compliance_locales_locale_parent_id_" ON "trade_landings_hardware_compliance_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "trade_landings_locales_locale_parent_id_unique" ON "trade_landings_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "pages" DROP COLUMN "meta_title";
  ALTER TABLE "pages" DROP COLUMN "meta_description";
  ALTER TABLE "pages" DROP COLUMN "meta_image_id";
  ALTER TABLE "blog_posts" DROP COLUMN "meta_title";
  ALTER TABLE "blog_posts" DROP COLUMN "meta_description";
  ALTER TABLE "blog_posts" DROP COLUMN "meta_image_id";
  ALTER TABLE "modules" DROP COLUMN "meta_title";
  ALTER TABLE "modules" DROP COLUMN "meta_description";
  ALTER TABLE "modules" DROP COLUMN "meta_image_id";
  ALTER TABLE "home_content_ai_samples" DROP COLUMN "prompt";
  ALTER TABLE "home_content_module_rows" DROP COLUMN "title";
  ALTER TABLE "home_content_module_rows" DROP COLUMN "body";
  ALTER TABLE "home_content_module_rows" DROP COLUMN "cta_label";
  ALTER TABLE "home_content_deploy_bullets" DROP COLUMN "title";
  ALTER TABLE "home_content_deploy_bullets" DROP COLUMN "body";
  ALTER TABLE "home_content" DROP COLUMN "hero_eyebrow";
  ALTER TABLE "home_content" DROP COLUMN "hero_title";
  ALTER TABLE "home_content" DROP COLUMN "hero_subtitle";
  ALTER TABLE "home_content" DROP COLUMN "hero_primary_cta_label";
  ALTER TABLE "home_content" DROP COLUMN "hero_secondary_cta_label";
  ALTER TABLE "home_content" DROP COLUMN "founder_heading";
  ALTER TABLE "home_content" DROP COLUMN "founder_name";
  ALTER TABLE "home_content" DROP COLUMN "founder_role";
  ALTER TABLE "home_content" DROP COLUMN "founder_quote";
  ALTER TABLE "home_content" DROP COLUMN "founder_body";
  ALTER TABLE "home_content" DROP COLUMN "ai_eyebrow";
  ALTER TABLE "home_content" DROP COLUMN "ai_heading";
  ALTER TABLE "home_content" DROP COLUMN "ai_subheading";
  ALTER TABLE "home_content" DROP COLUMN "ai_cta_label";
  ALTER TABLE "home_content" DROP COLUMN "deploy_heading";
  ALTER TABLE "home_content" DROP COLUMN "deploy_subheading";
  ALTER TABLE "home_content" DROP COLUMN "closing_heading";
  ALTER TABLE "home_content" DROP COLUMN "closing_body";
  ALTER TABLE "home_content" DROP COLUMN "closing_primary_cta_label";
  ALTER TABLE "contact_content_methods" DROP COLUMN "label";
  ALTER TABLE "contact_content_methods" DROP COLUMN "description";
  ALTER TABLE "contact_content_faq" DROP COLUMN "question";
  ALTER TABLE "contact_content_faq" DROP COLUMN "answer";
  ALTER TABLE "contact_content" DROP COLUMN "page_title";
  ALTER TABLE "contact_content" DROP COLUMN "page_subtitle";
  ALTER TABLE "contact_content" DROP COLUMN "methods_heading";
  ALTER TABLE "contact_content" DROP COLUMN "faq_heading";
  ALTER TABLE "contact_content" DROP COLUMN "cta_heading";
  ALTER TABLE "contact_content" DROP COLUMN "cta_body";
  ALTER TABLE "contact_content" DROP COLUMN "cta_primary_label";
  ALTER TABLE "footer_content_product_links" DROP COLUMN "label";
  ALTER TABLE "footer_content_trade_links" DROP COLUMN "label";
  ALTER TABLE "footer_content_company_links" DROP COLUMN "label";
  ALTER TABLE "footer_content_legal_links" DROP COLUMN "label";
  ALTER TABLE "footer_content" DROP COLUMN "branding";
  ALTER TABLE "footer_content" DROP COLUMN "copyright_line";
  ALTER TABLE "footer_content" DROP COLUMN "product_heading";
  ALTER TABLE "footer_content" DROP COLUMN "trades_heading";
  ALTER TABLE "footer_content" DROP COLUMN "company_heading";
  ALTER TABLE "footer_content" DROP COLUMN "legal_heading";
  ALTER TABLE "trade_landings_pro_who_for_items" DROP COLUMN "label";
  ALTER TABLE "trade_landings_pro_signature_features" DROP COLUMN "title";
  ALTER TABLE "trade_landings_pro_signature_features" DROP COLUMN "description";
  ALTER TABLE "trade_landings_pro_compliance" DROP COLUMN "item";
  ALTER TABLE "trade_landings_dawa_who_for_items" DROP COLUMN "label";
  ALTER TABLE "trade_landings_dawa_signature_features" DROP COLUMN "title";
  ALTER TABLE "trade_landings_dawa_signature_features" DROP COLUMN "description";
  ALTER TABLE "trade_landings_dawa_compliance" DROP COLUMN "item";
  ALTER TABLE "trade_landings_retail_who_for_items" DROP COLUMN "label";
  ALTER TABLE "trade_landings_retail_signature_features" DROP COLUMN "title";
  ALTER TABLE "trade_landings_retail_signature_features" DROP COLUMN "description";
  ALTER TABLE "trade_landings_retail_compliance" DROP COLUMN "item";
  ALTER TABLE "trade_landings_hospitality_who_for_items" DROP COLUMN "label";
  ALTER TABLE "trade_landings_hospitality_signature_features" DROP COLUMN "title";
  ALTER TABLE "trade_landings_hospitality_signature_features" DROP COLUMN "description";
  ALTER TABLE "trade_landings_hospitality_compliance" DROP COLUMN "item";
  ALTER TABLE "trade_landings_hardware_who_for_items" DROP COLUMN "label";
  ALTER TABLE "trade_landings_hardware_signature_features" DROP COLUMN "title";
  ALTER TABLE "trade_landings_hardware_signature_features" DROP COLUMN "description";
  ALTER TABLE "trade_landings_hardware_compliance" DROP COLUMN "item";
  ALTER TABLE "trade_landings" DROP COLUMN "pro_tagline";
  ALTER TABLE "trade_landings" DROP COLUMN "pro_hero_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "pro_hero_description";
  ALTER TABLE "trade_landings" DROP COLUMN "pro_who_for_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "pro_pricing_note";
  ALTER TABLE "trade_landings" DROP COLUMN "pro_cta_buy_label";
  ALTER TABLE "trade_landings" DROP COLUMN "pro_cta_trial_label";
  ALTER TABLE "trade_landings" DROP COLUMN "dawa_tagline";
  ALTER TABLE "trade_landings" DROP COLUMN "dawa_hero_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "dawa_hero_description";
  ALTER TABLE "trade_landings" DROP COLUMN "dawa_who_for_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "dawa_pricing_note";
  ALTER TABLE "trade_landings" DROP COLUMN "dawa_cta_buy_label";
  ALTER TABLE "trade_landings" DROP COLUMN "dawa_cta_trial_label";
  ALTER TABLE "trade_landings" DROP COLUMN "retail_tagline";
  ALTER TABLE "trade_landings" DROP COLUMN "retail_hero_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "retail_hero_description";
  ALTER TABLE "trade_landings" DROP COLUMN "retail_who_for_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "retail_pricing_note";
  ALTER TABLE "trade_landings" DROP COLUMN "retail_cta_buy_label";
  ALTER TABLE "trade_landings" DROP COLUMN "retail_cta_trial_label";
  ALTER TABLE "trade_landings" DROP COLUMN "hospitality_tagline";
  ALTER TABLE "trade_landings" DROP COLUMN "hospitality_hero_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "hospitality_hero_description";
  ALTER TABLE "trade_landings" DROP COLUMN "hospitality_who_for_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "hospitality_pricing_note";
  ALTER TABLE "trade_landings" DROP COLUMN "hospitality_cta_buy_label";
  ALTER TABLE "trade_landings" DROP COLUMN "hospitality_cta_trial_label";
  ALTER TABLE "trade_landings" DROP COLUMN "hardware_tagline";
  ALTER TABLE "trade_landings" DROP COLUMN "hardware_hero_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "hardware_hero_description";
  ALTER TABLE "trade_landings" DROP COLUMN "hardware_who_for_eyebrow";
  ALTER TABLE "trade_landings" DROP COLUMN "hardware_pricing_note";
  ALTER TABLE "trade_landings" DROP COLUMN "hardware_cta_buy_label";
  ALTER TABLE "trade_landings" DROP COLUMN "hardware_cta_trial_label";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "blog_posts_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "modules_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_content_ai_samples_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_content_module_rows_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_content_deploy_bullets_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_content_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_content_methods_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_content_faq_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_content_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_product_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_trade_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_company_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_legal_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_content_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_pro_who_for_items_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_pro_signature_features_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_pro_compliance_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_dawa_who_for_items_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_dawa_signature_features_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_dawa_compliance_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_retail_who_for_items_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_retail_signature_features_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_retail_compliance_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_hospitality_who_for_items_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_hospitality_signature_features_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_hospitality_compliance_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_hardware_who_for_items_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_hardware_signature_features_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_hardware_compliance_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_landings_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "blog_posts_locales" CASCADE;
  DROP TABLE "modules_locales" CASCADE;
  DROP TABLE "home_content_ai_samples_locales" CASCADE;
  DROP TABLE "home_content_module_rows_locales" CASCADE;
  DROP TABLE "home_content_deploy_bullets_locales" CASCADE;
  DROP TABLE "home_content_locales" CASCADE;
  DROP TABLE "contact_content_methods_locales" CASCADE;
  DROP TABLE "contact_content_faq_locales" CASCADE;
  DROP TABLE "contact_content_locales" CASCADE;
  DROP TABLE "footer_content_product_links_locales" CASCADE;
  DROP TABLE "footer_content_trade_links_locales" CASCADE;
  DROP TABLE "footer_content_company_links_locales" CASCADE;
  DROP TABLE "footer_content_legal_links_locales" CASCADE;
  DROP TABLE "footer_content_locales" CASCADE;
  DROP TABLE "trade_landings_pro_who_for_items_locales" CASCADE;
  DROP TABLE "trade_landings_pro_signature_features_locales" CASCADE;
  DROP TABLE "trade_landings_pro_compliance_locales" CASCADE;
  DROP TABLE "trade_landings_dawa_who_for_items_locales" CASCADE;
  DROP TABLE "trade_landings_dawa_signature_features_locales" CASCADE;
  DROP TABLE "trade_landings_dawa_compliance_locales" CASCADE;
  DROP TABLE "trade_landings_retail_who_for_items_locales" CASCADE;
  DROP TABLE "trade_landings_retail_signature_features_locales" CASCADE;
  DROP TABLE "trade_landings_retail_compliance_locales" CASCADE;
  DROP TABLE "trade_landings_hospitality_who_for_items_locales" CASCADE;
  DROP TABLE "trade_landings_hospitality_signature_features_locales" CASCADE;
  DROP TABLE "trade_landings_hospitality_compliance_locales" CASCADE;
  DROP TABLE "trade_landings_hardware_who_for_items_locales" CASCADE;
  DROP TABLE "trade_landings_hardware_signature_features_locales" CASCADE;
  DROP TABLE "trade_landings_hardware_compliance_locales" CASCADE;
  DROP TABLE "trade_landings_locales" CASCADE;
  ALTER TABLE "pages" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "blog_posts" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "blog_posts" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "blog_posts" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "modules" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "modules" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "modules" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "home_content_ai_samples" ADD COLUMN "prompt" varchar;
  ALTER TABLE "home_content_module_rows" ADD COLUMN "title" varchar;
  ALTER TABLE "home_content_module_rows" ADD COLUMN "body" varchar;
  ALTER TABLE "home_content_module_rows" ADD COLUMN "cta_label" varchar;
  ALTER TABLE "home_content_deploy_bullets" ADD COLUMN "title" varchar;
  ALTER TABLE "home_content_deploy_bullets" ADD COLUMN "body" varchar;
  ALTER TABLE "home_content" ADD COLUMN "hero_eyebrow" varchar DEFAULT 'For Kenyan SMEs';
  ALTER TABLE "home_content" ADD COLUMN "hero_title" varchar NOT NULL;
  ALTER TABLE "home_content" ADD COLUMN "hero_subtitle" varchar;
  ALTER TABLE "home_content" ADD COLUMN "hero_primary_cta_label" varchar DEFAULT 'Start free trial';
  ALTER TABLE "home_content" ADD COLUMN "hero_secondary_cta_label" varchar DEFAULT 'See pricing';
  ALTER TABLE "home_content" ADD COLUMN "founder_heading" varchar DEFAULT 'Built by an operator, not a software shop.';
  ALTER TABLE "home_content" ADD COLUMN "founder_name" varchar DEFAULT 'Justine Gachuru';
  ALTER TABLE "home_content" ADD COLUMN "founder_role" varchar DEFAULT 'Founder, Omnix';
  ALTER TABLE "home_content" ADD COLUMN "founder_quote" varchar;
  ALTER TABLE "home_content" ADD COLUMN "founder_body" jsonb;
  ALTER TABLE "home_content" ADD COLUMN "ai_eyebrow" varchar DEFAULT 'New';
  ALTER TABLE "home_content" ADD COLUMN "ai_heading" varchar DEFAULT 'Ask your business anything.';
  ALTER TABLE "home_content" ADD COLUMN "ai_subheading" varchar;
  ALTER TABLE "home_content" ADD COLUMN "ai_cta_label" varchar DEFAULT 'See AI in action';
  ALTER TABLE "home_content" ADD COLUMN "deploy_heading" varchar DEFAULT 'Built to run on a single Windows PC.';
  ALTER TABLE "home_content" ADD COLUMN "deploy_subheading" varchar;
  ALTER TABLE "home_content" ADD COLUMN "closing_heading" varchar;
  ALTER TABLE "home_content" ADD COLUMN "closing_body" varchar;
  ALTER TABLE "home_content" ADD COLUMN "closing_primary_cta_label" varchar DEFAULT 'Start free trial';
  ALTER TABLE "contact_content_methods" ADD COLUMN "label" varchar;
  ALTER TABLE "contact_content_methods" ADD COLUMN "description" varchar;
  ALTER TABLE "contact_content_faq" ADD COLUMN "question" varchar NOT NULL;
  ALTER TABLE "contact_content_faq" ADD COLUMN "answer" varchar NOT NULL;
  ALTER TABLE "contact_content" ADD COLUMN "page_title" varchar DEFAULT 'Talk to a human.';
  ALTER TABLE "contact_content" ADD COLUMN "page_subtitle" varchar;
  ALTER TABLE "contact_content" ADD COLUMN "methods_heading" varchar DEFAULT 'Pick the fastest channel';
  ALTER TABLE "contact_content" ADD COLUMN "faq_heading" varchar DEFAULT 'Frequently asked';
  ALTER TABLE "contact_content" ADD COLUMN "cta_heading" varchar;
  ALTER TABLE "contact_content" ADD COLUMN "cta_body" varchar;
  ALTER TABLE "contact_content" ADD COLUMN "cta_primary_label" varchar DEFAULT 'Start free trial';
  ALTER TABLE "footer_content_product_links" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "footer_content_trade_links" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "footer_content_company_links" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "footer_content_legal_links" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "footer_content" ADD COLUMN "branding" varchar;
  ALTER TABLE "footer_content" ADD COLUMN "copyright_line" varchar;
  ALTER TABLE "footer_content" ADD COLUMN "product_heading" varchar DEFAULT 'Product';
  ALTER TABLE "footer_content" ADD COLUMN "trades_heading" varchar DEFAULT 'Trades';
  ALTER TABLE "footer_content" ADD COLUMN "company_heading" varchar DEFAULT 'Company';
  ALTER TABLE "footer_content" ADD COLUMN "legal_heading" varchar DEFAULT 'Legal';
  ALTER TABLE "trade_landings_pro_who_for_items" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "trade_landings_pro_signature_features" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "trade_landings_pro_signature_features" ADD COLUMN "description" varchar NOT NULL;
  ALTER TABLE "trade_landings_pro_compliance" ADD COLUMN "item" varchar NOT NULL;
  ALTER TABLE "trade_landings_dawa_who_for_items" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "trade_landings_dawa_signature_features" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "trade_landings_dawa_signature_features" ADD COLUMN "description" varchar NOT NULL;
  ALTER TABLE "trade_landings_dawa_compliance" ADD COLUMN "item" varchar NOT NULL;
  ALTER TABLE "trade_landings_retail_who_for_items" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "trade_landings_retail_signature_features" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "trade_landings_retail_signature_features" ADD COLUMN "description" varchar NOT NULL;
  ALTER TABLE "trade_landings_retail_compliance" ADD COLUMN "item" varchar NOT NULL;
  ALTER TABLE "trade_landings_hospitality_who_for_items" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "trade_landings_hospitality_signature_features" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "trade_landings_hospitality_signature_features" ADD COLUMN "description" varchar NOT NULL;
  ALTER TABLE "trade_landings_hospitality_compliance" ADD COLUMN "item" varchar NOT NULL;
  ALTER TABLE "trade_landings_hardware_who_for_items" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "trade_landings_hardware_signature_features" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "trade_landings_hardware_signature_features" ADD COLUMN "description" varchar NOT NULL;
  ALTER TABLE "trade_landings_hardware_compliance" ADD COLUMN "item" varchar NOT NULL;
  ALTER TABLE "trade_landings" ADD COLUMN "pro_tagline" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "pro_hero_eyebrow" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "pro_hero_description" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "pro_who_for_eyebrow" varchar DEFAULT 'Built for';
  ALTER TABLE "trade_landings" ADD COLUMN "pro_pricing_note" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "pro_cta_buy_label" varchar DEFAULT 'Buy now';
  ALTER TABLE "trade_landings" ADD COLUMN "pro_cta_trial_label" varchar DEFAULT 'Start 30-day free trial';
  ALTER TABLE "trade_landings" ADD COLUMN "dawa_tagline" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "dawa_hero_eyebrow" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "dawa_hero_description" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "dawa_who_for_eyebrow" varchar DEFAULT 'Built for';
  ALTER TABLE "trade_landings" ADD COLUMN "dawa_pricing_note" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "dawa_cta_buy_label" varchar DEFAULT 'Buy now';
  ALTER TABLE "trade_landings" ADD COLUMN "dawa_cta_trial_label" varchar DEFAULT 'Start 30-day free trial';
  ALTER TABLE "trade_landings" ADD COLUMN "retail_tagline" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "retail_hero_eyebrow" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "retail_hero_description" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "retail_who_for_eyebrow" varchar DEFAULT 'Built for';
  ALTER TABLE "trade_landings" ADD COLUMN "retail_pricing_note" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "retail_cta_buy_label" varchar DEFAULT 'Buy now';
  ALTER TABLE "trade_landings" ADD COLUMN "retail_cta_trial_label" varchar DEFAULT 'Start 30-day free trial';
  ALTER TABLE "trade_landings" ADD COLUMN "hospitality_tagline" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hospitality_hero_eyebrow" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hospitality_hero_description" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hospitality_who_for_eyebrow" varchar DEFAULT 'Built for';
  ALTER TABLE "trade_landings" ADD COLUMN "hospitality_pricing_note" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hospitality_cta_buy_label" varchar DEFAULT 'Buy now';
  ALTER TABLE "trade_landings" ADD COLUMN "hospitality_cta_trial_label" varchar DEFAULT 'Start 30-day free trial';
  ALTER TABLE "trade_landings" ADD COLUMN "hardware_tagline" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hardware_hero_eyebrow" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hardware_hero_description" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hardware_who_for_eyebrow" varchar DEFAULT 'Built for';
  ALTER TABLE "trade_landings" ADD COLUMN "hardware_pricing_note" varchar;
  ALTER TABLE "trade_landings" ADD COLUMN "hardware_cta_buy_label" varchar DEFAULT 'Buy now';
  ALTER TABLE "trade_landings" ADD COLUMN "hardware_cta_trial_label" varchar DEFAULT 'Start 30-day free trial';
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "modules" ADD CONSTRAINT "modules_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE INDEX "blog_posts_meta_meta_image_idx" ON "blog_posts" USING btree ("meta_image_id");
  CREATE INDEX "modules_meta_meta_image_idx" ON "modules" USING btree ("meta_image_id");
  DROP TYPE "public"."_locales";`)
}
