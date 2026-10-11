import {
  bigint,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Monetary values are integer token units, never JavaScript floating-point numbers.
const units = (name: string) => numeric(name, { precision: 78, scale: 0 });
const time = (name: string) => timestamp(name, { withTimezone: true });

export const creators = pgTable("creators", {
  id: uuid("id").defaultRandom().primaryKey(),
  xUserId: text("x_user_id").notNull().unique(),
  handle: text("handle").notNull(),
  privyUserId: text("privy_user_id").notNull().unique(),
  wallet: text("wallet").notNull().unique(),
  linkedAt: time("linked_at").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
});

export const calls = pgTable("calls", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creators.id),
  postId: text("post_id").notNull().unique(),
  sourceUrl: text("source_url").notNull(),
  publishedAt: time("published_at").notNull(),
  capturedAt: time("captured_at").defaultNow().notNull(),
  evidence: jsonb("evidence").notNull(),
  methodologyVersion: text("methodology_version"),
  status: text("status", {
    enum: ["unreviewed", "eligible", "resolved", "excluded"],
  })
    .notNull()
    .default("unreviewed"),
});

export const tradeIntents = pgTable("trade_intents", {
  id: uuid("id").defaultRandom().primaryKey(),
  privyUserId: text("privy_user_id").notNull(),
  chainId: integer("chain_id").notNull(),
  market: text("market").notNull(),
  side: text("side", { enum: ["buy", "sell"] }).notNull(),
  amount: units("amount").notNull(),
  sourcePostId: text("source_post_id").notNull(),
  transactionHash: text("transaction_hash"),
  createdAt: time("created_at").defaultNow().notNull(),
});

// Fill IDs include chain, tx hash and log index; repeated event delivery is idempotent.
export const fills = pgTable(
  "fills",
  {
    id: text("id").primaryKey(),
    intentId: uuid("intent_id").references(() => tradeIntents.id),
    chainId: integer("chain_id").notNull(),
    market: text("market").notNull(),
    wallet: text("wallet").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    baseAmount: units("base_amount").notNull(),
    quoteAmount: units("quote_amount").notNull(),
    confirmedAt: time("confirmed_at").notNull(),
  },
  (table) => [
    uniqueIndex("fills_chain_tx_log").on(
      table.chainId,
      table.transactionHash,
      table.logIndex,
    ),
  ],
);

export const stakeSnapshots = pgTable("stake_snapshots", {
  id: text("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  contract: text("contract").notNull(),
  wallet: text("wallet").notNull(),
  balance: units("balance").notNull(),
  withdrawableAt: bigint("withdrawable_at", { mode: "bigint" }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  updatedAt: time("updated_at").notNull(),
});
