CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"skipped" text,
	"stopped_by" text,
	"pages_read" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	CONSTRAINT "agent_runs_trigger_valid" CHECK ("agent_runs"."trigger" in ('cron', 'manual')),
	CONSTRAINT "agent_runs_status_valid" CHECK ("agent_runs"."status" in ('ok', 'skipped', 'partial', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "agent_seen_sources" (
	"url" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"outcome" text NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"first_processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_seen_sources_outcome_valid" CHECK ("agent_seen_sources"."outcome" in ('proposed', 'approved', 'discarded', 'not_a_recipe', 'duplicate', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "agent_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"dishes_per_day" integer DEFAULT 3 NOT NULL,
	"pause_at" integer DEFAULT 15 NOT NULL,
	"pages_per_run" integer DEFAULT 10 NOT NULL,
	"running_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_settings_singleton" CHECK ("agent_settings"."id" = 1)
);
