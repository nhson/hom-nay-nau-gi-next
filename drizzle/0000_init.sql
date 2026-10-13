CREATE TABLE "catalog_meta" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_meta_singleton" CHECK ("catalog_meta"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"meal_type" text NOT NULL,
	"category" text,
	"chay" boolean DEFAULT false NOT NULL,
	"region" text,
	"name" text NOT NULL,
	"time_minutes" integer,
	"ingredients" text[] NOT NULL,
	"steps" text[] NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dishes_meal_type_valid" CHECK ("dishes"."meal_type" in ('buacom', 'buatomonuoc')),
	CONSTRAINT "dishes_category_rule" CHECK (("dishes"."meal_type" = 'buacom' and "dishes"."category" is not null and "dishes"."category" in ('xao', 'canh', 'man')) or ("dishes"."meal_type" = 'buatomonuoc' and "dishes"."category" is null)),
	CONSTRAINT "dishes_region_valid" CHECK ("dishes"."region" is null or "dishes"."region" in ('bac', 'trung', 'nam')),
	CONSTRAINT "dishes_ingredients_nonempty" CHECK (cardinality("dishes"."ingredients") > 0),
	CONSTRAINT "dishes_time_positive" CHECK ("dishes"."time_minutes" is null or "dishes"."time_minutes" > 0)
);
