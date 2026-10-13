CREATE TABLE "creator_payouts" (
	"x_user_id" text PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_payouts" ADD CONSTRAINT "creator_payouts_x_user_id_creators_x_user_id_fk" FOREIGN KEY ("x_user_id") REFERENCES "public"."creators"("x_user_id") ON DELETE no action ON UPDATE no action;