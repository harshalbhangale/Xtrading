CREATE TABLE "post_signals" (
	"post_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"text_hash" text NOT NULL,
	"is_call" boolean NOT NULL,
	"asset" text,
	"direction" text,
	"instrument" text,
	"signal" jsonb NOT NULL,
	"source" text NOT NULL,
	"methodology_version" text NOT NULL,
	"classified_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "post_signals_handle" ON "post_signals" USING btree ("handle","classified_at");