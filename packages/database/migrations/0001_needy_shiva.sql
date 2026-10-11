CREATE TABLE "wallet_challenges" (
	"privy_user_id" text PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"x_user_id" text NOT NULL,
	"handle" text NOT NULL,
	"wallet" text NOT NULL,
	"chain_id" integer NOT NULL,
	"origin" text NOT NULL,
	"message" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"window_started_at" timestamp with time zone NOT NULL,
	"window_count" integer NOT NULL,
	CONSTRAINT "wallet_challenges_id_unique" UNIQUE("id")
);
