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
