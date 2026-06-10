import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "trade_landings_pro_who_for_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_pro_signature_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_pro_compliance" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_dawa_who_for_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_dawa_signature_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_dawa_compliance" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_retail_who_for_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_retail_signature_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_retail_compliance" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hospitality_who_for_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hospitality_signature_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hospitality_compliance" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hardware_who_for_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hardware_signature_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings_hardware_compliance" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL
  );
  
  CREATE TABLE "trade_landings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"pro_product_name" varchar NOT NULL,
  	"pro_tagline" varchar,
  	"pro_meta_title" varchar,
  	"pro_meta_description" varchar,
  	"pro_hero_eyebrow" varchar,
  	"pro_hero_title_prefix" varchar,
  	"pro_hero_title_emphasis" varchar,
  	"pro_hero_title_suffix" varchar,
  	"pro_hero_description" varchar,
  	"pro_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"pro_pricing_note" varchar,
  	"pro_cta_buy_href" varchar DEFAULT '/buy?variant=pro',
  	"pro_cta_download_href" varchar DEFAULT '/signup?variant=pro',
  	"pro_cta_buy_label" varchar DEFAULT 'Buy now',
  	"pro_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"dawa_product_name" varchar NOT NULL,
  	"dawa_tagline" varchar,
  	"dawa_meta_title" varchar,
  	"dawa_meta_description" varchar,
  	"dawa_hero_eyebrow" varchar,
  	"dawa_hero_title_prefix" varchar,
  	"dawa_hero_title_emphasis" varchar,
  	"dawa_hero_title_suffix" varchar,
  	"dawa_hero_description" varchar,
  	"dawa_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"dawa_pricing_note" varchar,
  	"dawa_cta_buy_href" varchar DEFAULT '/buy?variant=dawa',
  	"dawa_cta_download_href" varchar DEFAULT '/signup?variant=dawa',
  	"dawa_cta_buy_label" varchar DEFAULT 'Buy now',
  	"dawa_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"retail_product_name" varchar NOT NULL,
  	"retail_tagline" varchar,
  	"retail_meta_title" varchar,
  	"retail_meta_description" varchar,
  	"retail_hero_eyebrow" varchar,
  	"retail_hero_title_prefix" varchar,
  	"retail_hero_title_emphasis" varchar,
  	"retail_hero_title_suffix" varchar,
  	"retail_hero_description" varchar,
  	"retail_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"retail_pricing_note" varchar,
  	"retail_cta_buy_href" varchar DEFAULT '/buy?variant=retail',
  	"retail_cta_download_href" varchar DEFAULT '/signup?variant=retail',
  	"retail_cta_buy_label" varchar DEFAULT 'Buy now',
  	"retail_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"hospitality_product_name" varchar NOT NULL,
  	"hospitality_tagline" varchar,
  	"hospitality_meta_title" varchar,
  	"hospitality_meta_description" varchar,
  	"hospitality_hero_eyebrow" varchar,
  	"hospitality_hero_title_prefix" varchar,
  	"hospitality_hero_title_emphasis" varchar,
  	"hospitality_hero_title_suffix" varchar,
  	"hospitality_hero_description" varchar,
  	"hospitality_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"hospitality_pricing_note" varchar,
  	"hospitality_cta_buy_href" varchar DEFAULT '/buy?variant=hospitality',
  	"hospitality_cta_download_href" varchar DEFAULT '/signup?variant=hospitality',
  	"hospitality_cta_buy_label" varchar DEFAULT 'Buy now',
  	"hospitality_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"hardware_product_name" varchar NOT NULL,
  	"hardware_tagline" varchar,
  	"hardware_meta_title" varchar,
  	"hardware_meta_description" varchar,
  	"hardware_hero_eyebrow" varchar,
  	"hardware_hero_title_prefix" varchar,
  	"hardware_hero_title_emphasis" varchar,
  	"hardware_hero_title_suffix" varchar,
  	"hardware_hero_description" varchar,
  	"hardware_who_for_eyebrow" varchar DEFAULT 'Built for',
  	"hardware_pricing_note" varchar,
  	"hardware_cta_buy_href" varchar DEFAULT '/buy?variant=hardware',
  	"hardware_cta_download_href" varchar DEFAULT '/signup?variant=hardware',
  	"hardware_cta_buy_label" varchar DEFAULT 'Buy now',
  	"hardware_cta_trial_label" varchar DEFAULT 'Start 30-day free trial',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "trade_landings_pro_who_for_items" ADD CONSTRAINT "trade_landings_pro_who_for_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_pro_signature_features" ADD CONSTRAINT "trade_landings_pro_signature_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_pro_compliance" ADD CONSTRAINT "trade_landings_pro_compliance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_dawa_who_for_items" ADD CONSTRAINT "trade_landings_dawa_who_for_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_dawa_signature_features" ADD CONSTRAINT "trade_landings_dawa_signature_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_dawa_compliance" ADD CONSTRAINT "trade_landings_dawa_compliance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_retail_who_for_items" ADD CONSTRAINT "trade_landings_retail_who_for_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_retail_signature_features" ADD CONSTRAINT "trade_landings_retail_signature_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_retail_compliance" ADD CONSTRAINT "trade_landings_retail_compliance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hospitality_who_for_items" ADD CONSTRAINT "trade_landings_hospitality_who_for_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hospitality_signature_features" ADD CONSTRAINT "trade_landings_hospitality_signature_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hospitality_compliance" ADD CONSTRAINT "trade_landings_hospitality_compliance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hardware_who_for_items" ADD CONSTRAINT "trade_landings_hardware_who_for_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hardware_signature_features" ADD CONSTRAINT "trade_landings_hardware_signature_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_landings_hardware_compliance" ADD CONSTRAINT "trade_landings_hardware_compliance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_landings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "trade_landings_pro_who_for_items_order_idx" ON "trade_landings_pro_who_for_items" USING btree ("_order");
  CREATE INDEX "trade_landings_pro_who_for_items_parent_id_idx" ON "trade_landings_pro_who_for_items" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_pro_signature_features_order_idx" ON "trade_landings_pro_signature_features" USING btree ("_order");
  CREATE INDEX "trade_landings_pro_signature_features_parent_id_idx" ON "trade_landings_pro_signature_features" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_pro_compliance_order_idx" ON "trade_landings_pro_compliance" USING btree ("_order");
  CREATE INDEX "trade_landings_pro_compliance_parent_id_idx" ON "trade_landings_pro_compliance" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_dawa_who_for_items_order_idx" ON "trade_landings_dawa_who_for_items" USING btree ("_order");
  CREATE INDEX "trade_landings_dawa_who_for_items_parent_id_idx" ON "trade_landings_dawa_who_for_items" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_dawa_signature_features_order_idx" ON "trade_landings_dawa_signature_features" USING btree ("_order");
  CREATE INDEX "trade_landings_dawa_signature_features_parent_id_idx" ON "trade_landings_dawa_signature_features" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_dawa_compliance_order_idx" ON "trade_landings_dawa_compliance" USING btree ("_order");
  CREATE INDEX "trade_landings_dawa_compliance_parent_id_idx" ON "trade_landings_dawa_compliance" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_retail_who_for_items_order_idx" ON "trade_landings_retail_who_for_items" USING btree ("_order");
  CREATE INDEX "trade_landings_retail_who_for_items_parent_id_idx" ON "trade_landings_retail_who_for_items" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_retail_signature_features_order_idx" ON "trade_landings_retail_signature_features" USING btree ("_order");
  CREATE INDEX "trade_landings_retail_signature_features_parent_id_idx" ON "trade_landings_retail_signature_features" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_retail_compliance_order_idx" ON "trade_landings_retail_compliance" USING btree ("_order");
  CREATE INDEX "trade_landings_retail_compliance_parent_id_idx" ON "trade_landings_retail_compliance" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_hospitality_who_for_items_order_idx" ON "trade_landings_hospitality_who_for_items" USING btree ("_order");
  CREATE INDEX "trade_landings_hospitality_who_for_items_parent_id_idx" ON "trade_landings_hospitality_who_for_items" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_hospitality_signature_features_order_idx" ON "trade_landings_hospitality_signature_features" USING btree ("_order");
  CREATE INDEX "trade_landings_hospitality_signature_features_parent_id_idx" ON "trade_landings_hospitality_signature_features" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_hospitality_compliance_order_idx" ON "trade_landings_hospitality_compliance" USING btree ("_order");
  CREATE INDEX "trade_landings_hospitality_compliance_parent_id_idx" ON "trade_landings_hospitality_compliance" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_hardware_who_for_items_order_idx" ON "trade_landings_hardware_who_for_items" USING btree ("_order");
  CREATE INDEX "trade_landings_hardware_who_for_items_parent_id_idx" ON "trade_landings_hardware_who_for_items" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_hardware_signature_features_order_idx" ON "trade_landings_hardware_signature_features" USING btree ("_order");
  CREATE INDEX "trade_landings_hardware_signature_features_parent_id_idx" ON "trade_landings_hardware_signature_features" USING btree ("_parent_id");
  CREATE INDEX "trade_landings_hardware_compliance_order_idx" ON "trade_landings_hardware_compliance" USING btree ("_order");
  CREATE INDEX "trade_landings_hardware_compliance_parent_id_idx" ON "trade_landings_hardware_compliance" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "trade_landings_pro_who_for_items" CASCADE;
  DROP TABLE "trade_landings_pro_signature_features" CASCADE;
  DROP TABLE "trade_landings_pro_compliance" CASCADE;
  DROP TABLE "trade_landings_dawa_who_for_items" CASCADE;
  DROP TABLE "trade_landings_dawa_signature_features" CASCADE;
  DROP TABLE "trade_landings_dawa_compliance" CASCADE;
  DROP TABLE "trade_landings_retail_who_for_items" CASCADE;
  DROP TABLE "trade_landings_retail_signature_features" CASCADE;
  DROP TABLE "trade_landings_retail_compliance" CASCADE;
  DROP TABLE "trade_landings_hospitality_who_for_items" CASCADE;
  DROP TABLE "trade_landings_hospitality_signature_features" CASCADE;
  DROP TABLE "trade_landings_hospitality_compliance" CASCADE;
  DROP TABLE "trade_landings_hardware_who_for_items" CASCADE;
  DROP TABLE "trade_landings_hardware_signature_features" CASCADE;
  DROP TABLE "trade_landings_hardware_compliance" CASCADE;
  DROP TABLE "trade_landings" CASCADE;`)
}
