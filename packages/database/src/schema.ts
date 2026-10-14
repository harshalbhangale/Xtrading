import {
  bigint,
  boolean,
  index,
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

// One current challenge per session owner; row locks serialize issuance and consumption.
export const walletChallenges = pgTable("wallet_challenges", {
  privyUserId: text("privy_user_id").primaryKey(),
  id: uuid("id").notNull().unique(),
  xUserId: text("x_user_id").notNull(),
  handle: text("handle").notNull(),
  wallet: text("wallet").notNull(),
  chainId: integer("chain_id").notNull(),
  origin: text("origin").notNull(),
  message: text("message").notNull(),
  issuedAt: time("issued_at").notNull(),
  expiresAt: time("expires_at").notNull(),
  consumedAt: time("consumed_at"),
  windowStartedAt: time("window_started_at").notNull(),
  windowCount: integer("window_count").notNull(),
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

// Extracted post signals for any author. A handle is a lookup hint, not a verified identity;
// classifications are versioned and never represent an evaluated outcome.
export const postSignals = pgTable(
  "post_signals",
  {
    postId: text("post_id").primaryKey(),
    handle: text("handle").notNull(),
    textHash: text("text_hash").notNull(),
    isCall: boolean("is_call").notNull(),
    asset: text("asset"),
    direction: text("direction", { enum: ["bullish", "bearish"] }),
    instrument: text("instrument", { enum: ["spot", "perp"] }),
    signal: jsonb("signal").notNull(),
    source: text("source", { enum: ["llm", "heuristic"] }).notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    classifiedAt: time("classified_at").notNull(),
  },
  (table) => [
    index("post_signals_handle").on(table.handle, table.classifiedAt),
  ],
);

// Opt-in payouts are keyed by immutable X ID. Wallet must match a nonce-verified binding.
export const creatorPayouts = pgTable("creator_payouts", {
  xUserId: text("x_user_id")
    .primaryKey()
    .references(() => creators.xUserId),
  wallet: text("wallet").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  version: integer("version").notNull().default(1),
  updatedAt: time("updated_at").defaultNow().notNull(),
});

// Last MCP use per Privy user, so the portal can show an agent is connected. No tokens stored.
export const agentConnections = pgTable("agent_connections", {
  privyUserId: text("privy_user_id").primaryKey(),
  client: text("client"),
  lastTool: text("last_tool"),
  calls: integer("calls").notNull().default(0),
  firstSeenAt: time("first_seen_at").defaultNow().notNull(),
  lastSeenAt: time("last_seen_at").defaultNow().notNull(),
});

// OAuth for the MCP connector (claude.ai custom connectors). Codes and tokens are
// stored only as SHA-256 hashes; an access token is accepted on the MCP endpoint only.
export const oauthClients = pgTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  clientName: text("client_name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
});

export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.clientId),
  privyUserId: text("privy_user_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scope: text("scope").notNull(),
  expiresAt: time("expires_at").notNull(),
  usedAt: time("used_at"),
});

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    kind: text("kind", { enum: ["access", "refresh"] }).notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId),
    privyUserId: text("privy_user_id").notNull(),
    scope: text("scope").notNull(),
    expiresAt: time("expires_at").notNull(),
    revokedAt: time("revoked_at"),
    createdAt: time("created_at").defaultNow().notNull(),
  },
  (table) => [index("oauth_tokens_user").on(table.privyUserId)],
);
