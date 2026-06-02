import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('owner', 'support');
  CREATE TYPE "public"."enum_customers_county" AS ENUM('baringo', 'bomet', 'bungoma', 'busia', 'elgeyo-marakwet', 'embu', 'garissa', 'homa-bay', 'isiolo', 'kajiado', 'kakamega', 'kericho', 'kiambu', 'kilifi', 'kirinyaga', 'kisii', 'kisumu', 'kitui', 'kwale', 'laikipia', 'lamu', 'machakos', 'makueni', 'mandera', 'marsabit', 'meru', 'migori', 'mombasa', 'muranga', 'nairobi', 'nakuru', 'nandi', 'narok', 'nyamira', 'nyandarua', 'nyeri', 'samburu', 'siaya', 'taita-taveta', 'tana-river', 'tharaka-nithi', 'trans-nzoia', 'turkana', 'uasin-gishu', 'vihiga', 'wajir', 'west-pokot');
  CREATE TYPE "public"."enum_customers_business_type" AS ENUM('pharmacy', 'mini_mart', 'duka', 'restaurant', 'hardware', 'other');
  CREATE TYPE "public"."enum_customers_employee_count" AS ENUM('1', '2-5', '6-15', '16-50', '50+');
  CREATE TYPE "public"."enum_customers_how_did_you_hear" AS ENUM('google', 'friend', 'social', 'reseller', 'other');
  CREATE TYPE "public"."enum_customers_status" AS ENUM('active', 'suspended', 'banned');
  CREATE TYPE "public"."enum_licenses_modules" AS ENUM('core', 'dawa', 'retail', 'hardware', 'hospitality');
  CREATE TYPE "public"."enum_licenses_tier" AS ENUM('trial', 'starter', 'business', 'enterprise');
  CREATE TYPE "public"."enum_licenses_status" AS ENUM('trial', 'active', 'lapsed', 'maintenance_expired', 'suspended', 'cancelled');
  CREATE TYPE "public"."enum_machines_lan_peers_role" AS ENUM('master', 'client');
  CREATE TYPE "public"."enum_machines_os" AS ENUM('windows', 'linux', 'macos');
  CREATE TYPE "public"."enum_machines_arch" AS ENUM('x86_64', 'aarch64');
  CREATE TYPE "public"."enum_machines_active_module" AS ENUM('core', 'dawa', 'retail');
  CREATE TYPE "public"."enum_machines_network_mode" AS ENUM('standalone', 'lan_master', 'lan_client');
  CREATE TYPE "public"."enum_machines_status" AS ENUM('active', 'idle', 'offline', 'deactivated');
  CREATE TYPE "public"."enum_machines_deactivation_reason" AS ENUM('user_initiated', 'license_revoked', 'replaced');
  CREATE TYPE "public"."enum_activations_event" AS ENUM('activate', 'validate', 'rebind', 'deactivate');
  CREATE TYPE "public"."enum_activations_outcome" AS ENUM('success', 'rejected_seats', 'rejected_cooldown', 'rejected_invalid', 'rejected_revoked');
  CREATE TYPE "public"."enum_releases_channel" AS ENUM('stable', 'beta', 'alpha');
  CREATE TYPE "public"."enum_releases_status" AS ENUM('draft', 'published', 'rolled_back', 'archived');
  CREATE TYPE "public"."enum_telemetry_events_event_type" AS ENUM('app_started', 'app_closed', 'heartbeat', 'sync_completed', 'sale_completed', 'license_validated', 'license_invalid', 'license_expired', 'crash', 'panic', 'db_error', 'migration_error', 'integration_error', 'updater_check', 'updater_download', 'updater_installed', 'manual_diagnostic', 'feedback_submitted');
  CREATE TYPE "public"."enum_telemetry_events_severity" AS ENUM('debug', 'info', 'warn', 'error', 'fatal');
  CREATE TYPE "public"."enum_payments_channel" AS ENUM('card', 'mpesa', 'bank_transfer', 'apple_pay', 'mobile_money');
  CREATE TYPE "public"."enum_payments_purpose" AS ENUM('license_fee', 'maintenance_renewal', 'major_upgrade', 'cloud_backup', 'extra_branch', 'extra_machine');
  CREATE TYPE "public"."enum_payments_status" AS ENUM('pending', 'success', 'failed', 'reversed', 'refunded');
  CREATE TYPE "public"."enum_support_tickets_thread_sender" AS ENUM('customer', 'support', 'owner', 'system');
  CREATE TYPE "public"."enum_support_tickets_category" AS ENUM('bug', 'feature_request', 'question', 'billing', 'data_recovery', 'install_help', 'other');
  CREATE TYPE "public"."enum_support_tickets_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_support_tickets_status" AS ENUM('new', 'in_progress', 'awaiting_customer', 'resolved', 'closed');
  CREATE TYPE "public"."enum_pages_kind" AS ENUM('legal', 'help', 'about', 'compare');
  CREATE TYPE "public"."enum_blog_posts_category" AS ENUM('product', 'industry', 'tutorial', 'announcement');
  CREATE TYPE "public"."enum_blog_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_modules_module_id" AS ENUM('core', 'dawa', 'retail', 'hardware', 'hospitality');
  CREATE TYPE "public"."enum_modules_available" AS ENUM('live', 'beta', 'planned');
  CREATE TYPE "public"."enum_modules_gradient" AS ENUM('amber', 'teal', 'orange', 'blue', 'pink');
  CREATE TYPE "public"."enum_settings_trial_lockout_mode" AS ENUM('soft', 'readonly', 'hard');
  CREATE TYPE "public"."enum_landing_page_features_bento_span" AS ENUM('1', '2', '3');
  CREATE TYPE "public"."enum_landing_page_hero_screenshot_position" AS ENUM('below', 'right', 'bento');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'support' NOT NULL,
  	"phone" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"full_name" varchar NOT NULL,
  	"business_name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"whatsapp" varchar,
  	"kra_pin" varchar,
  	"country" varchar DEFAULT 'Kenya',
  	"county" "enum_customers_county",
  	"town" varchar,
  	"physical_address" varchar,
  	"business_type" "enum_customers_business_type",
  	"employee_count" "enum_customers_employee_count",
  	"how_did_you_hear" "enum_customers_how_did_you_hear",
  	"newsletter_opt_in" boolean DEFAULT true,
  	"last_seen_at" timestamp(3) with time zone,
  	"status" "enum_customers_status" DEFAULT 'active',
  	"internal_notes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"_verified" boolean,
  	"_verificationtoken" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "licenses_modules" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_licenses_modules",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "licenses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"license_key" varchar,
  	"customer_id" integer NOT NULL,
  	"tier" "enum_licenses_tier" DEFAULT 'trial' NOT NULL,
  	"max_branches" numeric DEFAULT 1,
  	"max_machines" numeric DEFAULT 3,
  	"rebind_limit_per_window" numeric DEFAULT 2,
  	"rebind_window_days" numeric DEFAULT 30,
  	"rebind_count_in_window" numeric DEFAULT 0,
  	"rebind_window_started_at" timestamp(3) with time zone,
  	"status" "enum_licenses_status" DEFAULT 'trial' NOT NULL,
  	"trial_started_at" timestamp(3) with time zone,
  	"trial_ends_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"maintenance_until" timestamp(3) with time zone,
  	"major_version_cap" numeric DEFAULT 1,
  	"price_fee_paid" numeric,
  	"price_maintenance_paid" numeric,
  	"currency" varchar DEFAULT 'KES',
  	"cloud_backup_enabled" boolean DEFAULT false,
  	"cloud_backup_expires_at" timestamp(3) with time zone,
  	"issued_by_id" integer,
  	"internal_notes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "machines_lan_peers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"peer_machine_id" varchar,
  	"role" "enum_machines_lan_peers_role"
  );
  
  CREATE TABLE "machines" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"machine_id" varchar NOT NULL,
  	"auth_token" varchar NOT NULL,
  	"license_id" integer NOT NULL,
  	"hostname" varchar,
  	"os" "enum_machines_os" DEFAULT 'windows',
  	"os_version" varchar,
  	"arch" "enum_machines_arch",
  	"current_version" varchar,
  	"active_module" "enum_machines_active_module",
  	"branch_name" varchar,
  	"product_count" numeric,
  	"employee_count" numeric,
  	"sales_count_last30d" numeric,
  	"sales_value_last30d" numeric,
  	"last_sync_at" timestamp(3) with time zone,
  	"first_seen_at" timestamp(3) with time zone,
  	"last_seen_at" timestamp(3) with time zone,
  	"last_ip" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"city" varchar,
  	"county" varchar,
  	"network_mode" "enum_machines_network_mode",
  	"integrations_etims_configured" boolean,
  	"integrations_mpesa_configured" boolean,
  	"integrations_paystack_configured" boolean,
  	"integrations_sha_configured" boolean,
  	"status" "enum_machines_status" DEFAULT 'active',
  	"deactivated_at" timestamp(3) with time zone,
  	"deactivation_reason" "enum_machines_deactivation_reason",
  	"request_diagnostic" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"license_id" integer,
  	"machine_id" integer,
  	"fingerprint" varchar,
  	"event" "enum_activations_event" NOT NULL,
  	"outcome" "enum_activations_outcome" NOT NULL,
  	"detail" varchar,
  	"ip" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "releases_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon" varchar,
  	"screenshot_id" integer
  );
  
  CREATE TABLE "releases_breaking" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "releases" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version" varchar NOT NULL,
  	"major_version" numeric NOT NULL,
  	"channel" "enum_releases_channel" DEFAULT 'stable',
  	"git_tag" varchar,
  	"status" "enum_releases_status" DEFAULT 'draft' NOT NULL,
  	"windows_msi_url" varchar,
  	"windows_nsis_url" varchar,
  	"windows_msi_size" numeric,
  	"windows_nsis_size" numeric,
  	"updater_signature" varchar,
  	"sha256_msi" varchar,
  	"sha256_nsis" varchar,
  	"title" varchar,
  	"summary" varchar,
  	"changelog" jsonb,
  	"requires_migration" boolean,
  	"migration_notes" varchar,
  	"min_major_version_to_upgrade" numeric,
  	"requires_paid_license" boolean DEFAULT false,
  	"download_count" numeric DEFAULT 0,
  	"install_count" numeric DEFAULT 0,
  	"published_at" timestamp(3) with time zone,
  	"published_by_id" integer,
  	"rolled_back_at" timestamp(3) with time zone,
  	"rolled_back_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "telemetry_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"machine_id" integer NOT NULL,
  	"event_type" "enum_telemetry_events_event_type" NOT NULL,
  	"severity" "enum_telemetry_events_severity" DEFAULT 'info',
  	"app_version" varchar,
  	"message" varchar,
  	"stack_trace" varchar,
  	"metadata" jsonb,
  	"session_id" varchar,
  	"ip_address" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"paystack_reference" varchar NOT NULL,
  	"paystack_transaction_id" varchar,
  	"customer_id" integer NOT NULL,
  	"license_id" integer,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'KES',
  	"paystack_fees" numeric,
  	"net_amount" numeric,
  	"channel" "enum_payments_channel",
  	"mpesa_receipt_number" varchar,
  	"card_last4" varchar,
  	"card_brand" varchar,
  	"purpose" "enum_payments_purpose" NOT NULL,
  	"status" "enum_payments_status" DEFAULT 'pending' NOT NULL,
  	"failure_reason" varchar,
  	"refunded_at" timestamp(3) with time zone,
  	"refund_reason" varchar,
  	"refunded_by_id" integer,
  	"paid_at" timestamp(3) with time zone,
  	"raw_webhook_payload" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "support_tickets_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"file_id" integer
  );
  
  CREATE TABLE "support_tickets_thread_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"file_id" integer
  );
  
  CREATE TABLE "support_tickets_thread" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sender" "enum_support_tickets_thread_sender",
  	"sender_name" varchar,
  	"body" jsonb,
  	"sent_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "support_tickets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ticket_number" varchar,
  	"customer_id" integer NOT NULL,
  	"license_id" integer,
  	"machine_id" integer,
  	"subject" varchar NOT NULL,
  	"category" "enum_support_tickets_category",
  	"priority" "enum_support_tickets_priority" DEFAULT 'normal',
  	"status" "enum_support_tickets_status" DEFAULT 'new',
  	"description" jsonb,
  	"attached_diagnostic_id_id" integer,
  	"assigned_to_id" integer,
  	"resolved_at" timestamp(3) with time zone,
  	"satisfaction_rating" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_pages_kind",
  	"body" jsonb,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"last_reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "blog_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"excerpt" varchar,
  	"hero_image_id" integer,
  	"body" jsonb,
  	"category" "enum_blog_posts_category",
  	"author_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"status" "enum_blog_posts_status" DEFAULT 'draft',
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "modules_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon" varchar,
  	"screenshot_id" integer
  );
  
  CREATE TABLE "modules_screenshots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "modules_target_customers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "modules_compliance" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"module_id" "enum_modules_module_id" NOT NULL,
  	"name" varchar NOT NULL,
  	"short_name" varchar NOT NULL,
  	"tagline" varchar NOT NULL,
  	"available" "enum_modules_available" DEFAULT 'planned',
  	"priority" numeric DEFAULT 100,
  	"gradient" "enum_modules_gradient",
  	"short_description" varchar NOT NULL,
  	"long_description" jsonb,
  	"pricing_starter_fee" numeric,
  	"pricing_business_fee" numeric,
  	"pricing_maintenance_yearly" numeric,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_feature_url" varchar,
  	"sizes_feature_width" numeric,
  	"sizes_feature_height" numeric,
  	"sizes_feature_mime_type" varchar,
  	"sizes_feature_filesize" numeric,
  	"sizes_feature_filename" varchar,
  	"sizes_og_url" varchar,
  	"sizes_og_width" numeric,
  	"sizes_og_height" numeric,
  	"sizes_og_mime_type" varchar,
  	"sizes_og_filesize" numeric,
  	"sizes_og_filename" varchar
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"customers_id" integer,
  	"licenses_id" integer,
  	"machines_id" integer,
  	"activations_id" integer,
  	"releases_id" integer,
  	"telemetry_events_id" integer,
  	"payments_id" integer,
  	"support_tickets_id" integer,
  	"pages_id" integer,
  	"blog_posts_id" integer,
  	"modules_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"customers_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"brand_name" varchar DEFAULT 'Omnix',
  	"tagline" varchar DEFAULT 'ERP for Kenyan SMEs',
  	"support_email" varchar DEFAULT 'support@omnix.co.ke',
  	"sales_email" varchar,
  	"whatsapp_number" varchar,
  	"phone_number" varchar,
  	"office_address" varchar,
  	"office_map_embed_url" varchar,
  	"office_working_hours" varchar,
  	"social_twitter" varchar,
  	"social_linkedin" varchar,
  	"social_youtube" varchar,
  	"social_github" varchar,
  	"default_meta_title" varchar,
  	"default_meta_description" varchar,
  	"default_og_image_id" integer,
  	"footer_copy" jsonb,
  	"kra_pin" varchar,
  	"flags_allow_self_signup" boolean DEFAULT true,
  	"flags_allow_self_serve_checkout" boolean DEFAULT true,
  	"flags_show_beta_modules" boolean DEFAULT false,
  	"flags_show_pricing" boolean DEFAULT true,
  	"flags_maintenance_mode" boolean DEFAULT false,
  	"flags_auto_publish_releases" boolean DEFAULT true,
  	"trial_lockout_mode" "enum_settings_trial_lockout_mode" DEFAULT 'soft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "pricing_starter_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "pricing_business_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "pricing_enterprise_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "pricing_compare_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar,
  	"starter" varchar,
  	"business" varchar,
  	"enterprise" varchar
  );
  
  CREATE TABLE "pricing" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"currency" varchar DEFAULT 'KES',
  	"trial_days" numeric DEFAULT 30,
  	"starter_one_time_fee" numeric DEFAULT 100000,
  	"starter_maintenance_yearly" numeric DEFAULT 12000,
  	"starter_max_branches" numeric DEFAULT 1,
  	"starter_max_machines" numeric DEFAULT 3,
  	"business_one_time_fee" numeric DEFAULT 75000,
  	"business_maintenance_yearly" numeric DEFAULT 25000,
  	"business_max_branches" numeric DEFAULT 5,
  	"business_max_machines" numeric DEFAULT 10,
  	"enterprise_price_label" varchar DEFAULT 'Contact us',
  	"cloud_backup_monthly" numeric DEFAULT 500,
  	"extra_branch_one_time" numeric DEFAULT 15000,
  	"extra_machine_one_time" numeric DEFAULT 5000,
  	"major_upgrade_discount" numeric DEFAULT 50,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "landing_page_logo_cloud" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"logo_id" integer
  );
  
  CREATE TABLE "landing_page_features_bento" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"image_id" integer,
  	"span" "enum_landing_page_features_bento_span" DEFAULT '1'
  );
  
  CREATE TABLE "landing_page_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar,
  	"name" varchar,
  	"role" varchar,
  	"business_name" varchar,
  	"photo_id" integer
  );
  
  CREATE TABLE "landing_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_eyebrow" varchar DEFAULT 'NEW · v0.2.0 — Banking & Recurring Invoices',
  	"hero_headline" varchar DEFAULT 'Run your duka. Pay yourself.' NOT NULL,
  	"hero_subheadline" varchar DEFAULT 'All-in-one ERP for Kenyan pharmacies, mini-marts, hardware shops, restaurants, and hotels. Works offline. Costs less than your rent. No subscription forever.',
  	"hero_primary_cta_label" varchar DEFAULT 'Download free trial',
  	"hero_primary_cta_href" varchar DEFAULT '/downloads',
  	"hero_secondary_cta_label" varchar DEFAULT 'See it in action',
  	"hero_secondary_cta_href" varchar DEFAULT '/modules',
  	"hero_screenshot_position" "enum_landing_page_hero_screenshot_position" DEFAULT 'below',
  	"hero_screenshot_id" integer,
  	"modules_section_eyebrow" varchar DEFAULT 'Built for your trade',
  	"modules_section_headline" varchar DEFAULT 'One installer. Every kind of business.',
  	"modules_section_description" varchar DEFAULT 'Pick the module that fits your trade. Every Omnix licence includes Core ERP plus the modules you choose.',
  	"closing_cta_headline" varchar DEFAULT 'Stop juggling spreadsheets.',
  	"closing_cta_subheadline" varchar DEFAULT 'Run your duka properly.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_sessions" ADD CONSTRAINT "customers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "licenses_modules" ADD CONSTRAINT "licenses_modules_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "licenses" ADD CONSTRAINT "licenses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "licenses" ADD CONSTRAINT "licenses_issued_by_id_users_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "machines_lan_peers" ADD CONSTRAINT "machines_lan_peers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "machines" ADD CONSTRAINT "machines_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activations" ADD CONSTRAINT "activations_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activations" ADD CONSTRAINT "activations_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "releases_highlights" ADD CONSTRAINT "releases_highlights_screenshot_id_media_id_fk" FOREIGN KEY ("screenshot_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "releases_highlights" ADD CONSTRAINT "releases_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "releases_breaking" ADD CONSTRAINT "releases_breaking_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "releases" ADD CONSTRAINT "releases_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_by_id_users_id_fk" FOREIGN KEY ("refunded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets_attachments" ADD CONSTRAINT "support_tickets_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets_attachments" ADD CONSTRAINT "support_tickets_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets_thread_attachments" ADD CONSTRAINT "support_tickets_thread_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets_thread_attachments" ADD CONSTRAINT "support_tickets_thread_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."support_tickets_thread"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets_thread" ADD CONSTRAINT "support_tickets_thread_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_attached_diagnostic_id_id_telemetry_events_id_fk" FOREIGN KEY ("attached_diagnostic_id_id") REFERENCES "public"."telemetry_events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "modules_features" ADD CONSTRAINT "modules_features_screenshot_id_media_id_fk" FOREIGN KEY ("screenshot_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "modules_features" ADD CONSTRAINT "modules_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "modules_screenshots" ADD CONSTRAINT "modules_screenshots_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "modules_screenshots" ADD CONSTRAINT "modules_screenshots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "modules_target_customers" ADD CONSTRAINT "modules_target_customers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "modules_compliance" ADD CONSTRAINT "modules_compliance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "modules" ADD CONSTRAINT "modules_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_licenses_fk" FOREIGN KEY ("licenses_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_machines_fk" FOREIGN KEY ("machines_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activations_fk" FOREIGN KEY ("activations_id") REFERENCES "public"."activations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_releases_fk" FOREIGN KEY ("releases_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_telemetry_events_fk" FOREIGN KEY ("telemetry_events_id") REFERENCES "public"."telemetry_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_tickets_fk" FOREIGN KEY ("support_tickets_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_posts_fk" FOREIGN KEY ("blog_posts_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_modules_fk" FOREIGN KEY ("modules_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings" ADD CONSTRAINT "settings_default_og_image_id_media_id_fk" FOREIGN KEY ("default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pricing_starter_features" ADD CONSTRAINT "pricing_starter_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pricing_business_features" ADD CONSTRAINT "pricing_business_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pricing_enterprise_features" ADD CONSTRAINT "pricing_enterprise_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pricing_compare_table" ADD CONSTRAINT "pricing_compare_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_page_logo_cloud" ADD CONSTRAINT "landing_page_logo_cloud_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_page_logo_cloud" ADD CONSTRAINT "landing_page_logo_cloud_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_page_features_bento" ADD CONSTRAINT "landing_page_features_bento_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_page_features_bento" ADD CONSTRAINT "landing_page_features_bento_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_page_testimonials" ADD CONSTRAINT "landing_page_testimonials_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_page_testimonials" ADD CONSTRAINT "landing_page_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_page" ADD CONSTRAINT "landing_page_hero_screenshot_id_media_id_fk" FOREIGN KEY ("hero_screenshot_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "customers_sessions_order_idx" ON "customers_sessions" USING btree ("_order");
  CREATE INDEX "customers_sessions_parent_id_idx" ON "customers_sessions" USING btree ("_parent_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "licenses_modules_order_idx" ON "licenses_modules" USING btree ("order");
  CREATE INDEX "licenses_modules_parent_idx" ON "licenses_modules" USING btree ("parent_id");
  CREATE UNIQUE INDEX "licenses_license_key_idx" ON "licenses" USING btree ("license_key");
  CREATE INDEX "licenses_customer_idx" ON "licenses" USING btree ("customer_id");
  CREATE INDEX "licenses_issued_by_idx" ON "licenses" USING btree ("issued_by_id");
  CREATE INDEX "licenses_updated_at_idx" ON "licenses" USING btree ("updated_at");
  CREATE INDEX "licenses_created_at_idx" ON "licenses" USING btree ("created_at");
  CREATE INDEX "machines_lan_peers_order_idx" ON "machines_lan_peers" USING btree ("_order");
  CREATE INDEX "machines_lan_peers_parent_id_idx" ON "machines_lan_peers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "machines_machine_id_idx" ON "machines" USING btree ("machine_id");
  CREATE INDEX "machines_license_idx" ON "machines" USING btree ("license_id");
  CREATE INDEX "machines_updated_at_idx" ON "machines" USING btree ("updated_at");
  CREATE INDEX "machines_created_at_idx" ON "machines" USING btree ("created_at");
  CREATE INDEX "activations_license_idx" ON "activations" USING btree ("license_id");
  CREATE INDEX "activations_machine_idx" ON "activations" USING btree ("machine_id");
  CREATE INDEX "activations_updated_at_idx" ON "activations" USING btree ("updated_at");
  CREATE INDEX "activations_created_at_idx" ON "activations" USING btree ("created_at");
  CREATE INDEX "releases_highlights_order_idx" ON "releases_highlights" USING btree ("_order");
  CREATE INDEX "releases_highlights_parent_id_idx" ON "releases_highlights" USING btree ("_parent_id");
  CREATE INDEX "releases_highlights_screenshot_idx" ON "releases_highlights" USING btree ("screenshot_id");
  CREATE INDEX "releases_breaking_order_idx" ON "releases_breaking" USING btree ("_order");
  CREATE INDEX "releases_breaking_parent_id_idx" ON "releases_breaking" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "releases_version_idx" ON "releases" USING btree ("version");
  CREATE INDEX "releases_published_by_idx" ON "releases" USING btree ("published_by_id");
  CREATE INDEX "releases_updated_at_idx" ON "releases" USING btree ("updated_at");
  CREATE INDEX "releases_created_at_idx" ON "releases" USING btree ("created_at");
  CREATE INDEX "telemetry_events_machine_idx" ON "telemetry_events" USING btree ("machine_id");
  CREATE INDEX "telemetry_events_updated_at_idx" ON "telemetry_events" USING btree ("updated_at");
  CREATE INDEX "telemetry_events_created_at_idx" ON "telemetry_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "payments_paystack_reference_idx" ON "payments" USING btree ("paystack_reference");
  CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_id");
  CREATE INDEX "payments_license_idx" ON "payments" USING btree ("license_id");
  CREATE INDEX "payments_refunded_by_idx" ON "payments" USING btree ("refunded_by_id");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE INDEX "support_tickets_attachments_order_idx" ON "support_tickets_attachments" USING btree ("_order");
  CREATE INDEX "support_tickets_attachments_parent_id_idx" ON "support_tickets_attachments" USING btree ("_parent_id");
  CREATE INDEX "support_tickets_attachments_file_idx" ON "support_tickets_attachments" USING btree ("file_id");
  CREATE INDEX "support_tickets_thread_attachments_order_idx" ON "support_tickets_thread_attachments" USING btree ("_order");
  CREATE INDEX "support_tickets_thread_attachments_parent_id_idx" ON "support_tickets_thread_attachments" USING btree ("_parent_id");
  CREATE INDEX "support_tickets_thread_attachments_file_idx" ON "support_tickets_thread_attachments" USING btree ("file_id");
  CREATE INDEX "support_tickets_thread_order_idx" ON "support_tickets_thread" USING btree ("_order");
  CREATE INDEX "support_tickets_thread_parent_id_idx" ON "support_tickets_thread" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "support_tickets_ticket_number_idx" ON "support_tickets" USING btree ("ticket_number");
  CREATE INDEX "support_tickets_customer_idx" ON "support_tickets" USING btree ("customer_id");
  CREATE INDEX "support_tickets_license_idx" ON "support_tickets" USING btree ("license_id");
  CREATE INDEX "support_tickets_machine_idx" ON "support_tickets" USING btree ("machine_id");
  CREATE INDEX "support_tickets_attached_diagnostic_id_idx" ON "support_tickets" USING btree ("attached_diagnostic_id_id");
  CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets" USING btree ("assigned_to_id");
  CREATE INDEX "support_tickets_updated_at_idx" ON "support_tickets" USING btree ("updated_at");
  CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets" USING btree ("created_at");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");
  CREATE INDEX "blog_posts_hero_image_idx" ON "blog_posts" USING btree ("hero_image_id");
  CREATE INDEX "blog_posts_author_idx" ON "blog_posts" USING btree ("author_id");
  CREATE INDEX "blog_posts_seo_seo_og_image_idx" ON "blog_posts" USING btree ("seo_og_image_id");
  CREATE INDEX "blog_posts_updated_at_idx" ON "blog_posts" USING btree ("updated_at");
  CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("created_at");
  CREATE INDEX "modules_features_order_idx" ON "modules_features" USING btree ("_order");
  CREATE INDEX "modules_features_parent_id_idx" ON "modules_features" USING btree ("_parent_id");
  CREATE INDEX "modules_features_screenshot_idx" ON "modules_features" USING btree ("screenshot_id");
  CREATE INDEX "modules_screenshots_order_idx" ON "modules_screenshots" USING btree ("_order");
  CREATE INDEX "modules_screenshots_parent_id_idx" ON "modules_screenshots" USING btree ("_parent_id");
  CREATE INDEX "modules_screenshots_image_idx" ON "modules_screenshots" USING btree ("image_id");
  CREATE INDEX "modules_target_customers_order_idx" ON "modules_target_customers" USING btree ("_order");
  CREATE INDEX "modules_target_customers_parent_id_idx" ON "modules_target_customers" USING btree ("_parent_id");
  CREATE INDEX "modules_compliance_order_idx" ON "modules_compliance" USING btree ("_order");
  CREATE INDEX "modules_compliance_parent_id_idx" ON "modules_compliance" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "modules_module_id_idx" ON "modules" USING btree ("module_id");
  CREATE INDEX "modules_seo_seo_og_image_idx" ON "modules" USING btree ("seo_og_image_id");
  CREATE INDEX "modules_updated_at_idx" ON "modules" USING btree ("updated_at");
  CREATE INDEX "modules_created_at_idx" ON "modules" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_feature_sizes_feature_filename_idx" ON "media" USING btree ("sizes_feature_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_licenses_id_idx" ON "payload_locked_documents_rels" USING btree ("licenses_id");
  CREATE INDEX "payload_locked_documents_rels_machines_id_idx" ON "payload_locked_documents_rels" USING btree ("machines_id");
  CREATE INDEX "payload_locked_documents_rels_activations_id_idx" ON "payload_locked_documents_rels" USING btree ("activations_id");
  CREATE INDEX "payload_locked_documents_rels_releases_id_idx" ON "payload_locked_documents_rels" USING btree ("releases_id");
  CREATE INDEX "payload_locked_documents_rels_telemetry_events_id_idx" ON "payload_locked_documents_rels" USING btree ("telemetry_events_id");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");
  CREATE INDEX "payload_locked_documents_rels_support_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("support_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_blog_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_posts_id");
  CREATE INDEX "payload_locked_documents_rels_modules_id_idx" ON "payload_locked_documents_rels" USING btree ("modules_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "settings_default_og_image_idx" ON "settings" USING btree ("default_og_image_id");
  CREATE INDEX "pricing_starter_features_order_idx" ON "pricing_starter_features" USING btree ("_order");
  CREATE INDEX "pricing_starter_features_parent_id_idx" ON "pricing_starter_features" USING btree ("_parent_id");
  CREATE INDEX "pricing_business_features_order_idx" ON "pricing_business_features" USING btree ("_order");
  CREATE INDEX "pricing_business_features_parent_id_idx" ON "pricing_business_features" USING btree ("_parent_id");
  CREATE INDEX "pricing_enterprise_features_order_idx" ON "pricing_enterprise_features" USING btree ("_order");
  CREATE INDEX "pricing_enterprise_features_parent_id_idx" ON "pricing_enterprise_features" USING btree ("_parent_id");
  CREATE INDEX "pricing_compare_table_order_idx" ON "pricing_compare_table" USING btree ("_order");
  CREATE INDEX "pricing_compare_table_parent_id_idx" ON "pricing_compare_table" USING btree ("_parent_id");
  CREATE INDEX "landing_page_logo_cloud_order_idx" ON "landing_page_logo_cloud" USING btree ("_order");
  CREATE INDEX "landing_page_logo_cloud_parent_id_idx" ON "landing_page_logo_cloud" USING btree ("_parent_id");
  CREATE INDEX "landing_page_logo_cloud_logo_idx" ON "landing_page_logo_cloud" USING btree ("logo_id");
  CREATE INDEX "landing_page_features_bento_order_idx" ON "landing_page_features_bento" USING btree ("_order");
  CREATE INDEX "landing_page_features_bento_parent_id_idx" ON "landing_page_features_bento" USING btree ("_parent_id");
  CREATE INDEX "landing_page_features_bento_image_idx" ON "landing_page_features_bento" USING btree ("image_id");
  CREATE INDEX "landing_page_testimonials_order_idx" ON "landing_page_testimonials" USING btree ("_order");
  CREATE INDEX "landing_page_testimonials_parent_id_idx" ON "landing_page_testimonials" USING btree ("_parent_id");
  CREATE INDEX "landing_page_testimonials_photo_idx" ON "landing_page_testimonials" USING btree ("photo_id");
  CREATE INDEX "landing_page_hero_hero_screenshot_idx" ON "landing_page" USING btree ("hero_screenshot_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "customers_sessions" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "licenses_modules" CASCADE;
  DROP TABLE "licenses" CASCADE;
  DROP TABLE "machines_lan_peers" CASCADE;
  DROP TABLE "machines" CASCADE;
  DROP TABLE "activations" CASCADE;
  DROP TABLE "releases_highlights" CASCADE;
  DROP TABLE "releases_breaking" CASCADE;
  DROP TABLE "releases" CASCADE;
  DROP TABLE "telemetry_events" CASCADE;
  DROP TABLE "payments" CASCADE;
  DROP TABLE "support_tickets_attachments" CASCADE;
  DROP TABLE "support_tickets_thread_attachments" CASCADE;
  DROP TABLE "support_tickets_thread" CASCADE;
  DROP TABLE "support_tickets" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "blog_posts" CASCADE;
  DROP TABLE "modules_features" CASCADE;
  DROP TABLE "modules_screenshots" CASCADE;
  DROP TABLE "modules_target_customers" CASCADE;
  DROP TABLE "modules_compliance" CASCADE;
  DROP TABLE "modules" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TABLE "pricing_starter_features" CASCADE;
  DROP TABLE "pricing_business_features" CASCADE;
  DROP TABLE "pricing_enterprise_features" CASCADE;
  DROP TABLE "pricing_compare_table" CASCADE;
  DROP TABLE "pricing" CASCADE;
  DROP TABLE "landing_page_logo_cloud" CASCADE;
  DROP TABLE "landing_page_features_bento" CASCADE;
  DROP TABLE "landing_page_testimonials" CASCADE;
  DROP TABLE "landing_page" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_customers_county";
  DROP TYPE "public"."enum_customers_business_type";
  DROP TYPE "public"."enum_customers_employee_count";
  DROP TYPE "public"."enum_customers_how_did_you_hear";
  DROP TYPE "public"."enum_customers_status";
  DROP TYPE "public"."enum_licenses_modules";
  DROP TYPE "public"."enum_licenses_tier";
  DROP TYPE "public"."enum_licenses_status";
  DROP TYPE "public"."enum_machines_lan_peers_role";
  DROP TYPE "public"."enum_machines_os";
  DROP TYPE "public"."enum_machines_arch";
  DROP TYPE "public"."enum_machines_active_module";
  DROP TYPE "public"."enum_machines_network_mode";
  DROP TYPE "public"."enum_machines_status";
  DROP TYPE "public"."enum_machines_deactivation_reason";
  DROP TYPE "public"."enum_activations_event";
  DROP TYPE "public"."enum_activations_outcome";
  DROP TYPE "public"."enum_releases_channel";
  DROP TYPE "public"."enum_releases_status";
  DROP TYPE "public"."enum_telemetry_events_event_type";
  DROP TYPE "public"."enum_telemetry_events_severity";
  DROP TYPE "public"."enum_payments_channel";
  DROP TYPE "public"."enum_payments_purpose";
  DROP TYPE "public"."enum_payments_status";
  DROP TYPE "public"."enum_support_tickets_thread_sender";
  DROP TYPE "public"."enum_support_tickets_category";
  DROP TYPE "public"."enum_support_tickets_priority";
  DROP TYPE "public"."enum_support_tickets_status";
  DROP TYPE "public"."enum_pages_kind";
  DROP TYPE "public"."enum_blog_posts_category";
  DROP TYPE "public"."enum_blog_posts_status";
  DROP TYPE "public"."enum_modules_module_id";
  DROP TYPE "public"."enum_modules_available";
  DROP TYPE "public"."enum_modules_gradient";
  DROP TYPE "public"."enum_settings_trial_lockout_mode";
  DROP TYPE "public"."enum_landing_page_features_bento_span";
  DROP TYPE "public"."enum_landing_page_hero_screenshot_position";`)
}
