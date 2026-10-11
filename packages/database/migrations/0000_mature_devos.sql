CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"post_id" text NOT NULL,
	"source_url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence" jsonb NOT NULL,
	"methodology_version" text,
	"status" text DEFAULT 'unreviewed' NOT NULL,
	CONSTRAINT "calls_post_id_unique" UNIQUE("post_id")
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"x_user_id" text NOT NULL,
	"handle" text NOT NULL,
	"privy_user_id" text NOT NULL,
	"wallet" text NOT NULL,
	"linked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creators_x_user_id_unique" UNIQUE("x_user_id"),
	CONSTRAINT "creators_privy_user_id_unique" UNIQUE("privy_user_id"),
	CONSTRAINT "creators_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" text PRIMARY KEY NOT NULL,
	"intent_id" uuid,
	"chain_id" integer NOT NULL,
	"market" text NOT NULL,
	"wallet" text NOT NULL,
	"transaction_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"base_amount" numeric(78, 0) NOT NULL,
	"quote_amount" numeric(78, 0) NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stake_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"contract" text NOT NULL,
	"wallet" text NOT NULL,
	"balance" numeric(78, 0) NOT NULL,
	"withdrawable_at" bigint NOT NULL,
	"block_number" bigint NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"privy_user_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"market" text NOT NULL,
	"side" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"source_post_id" text NOT NULL,
	"transaction_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_intent_id_trade_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."trade_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fills_chain_tx_log" ON "fills" USING btree ("chain_id","transaction_hash","log_index");