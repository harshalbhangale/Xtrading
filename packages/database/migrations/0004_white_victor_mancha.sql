CREATE TABLE "agent_connections" (
	"privy_user_id" text PRIMARY KEY NOT NULL,
	"client" text,
	"last_tool" text,
	"calls" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
