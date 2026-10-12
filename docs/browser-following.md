# Viewed-follow sync and Expand

The extension's profile card and creator dashboard have an **Expand calls & wallet activity** button. It fetches the latest registered-call ledger and the bound wallet's Envio-indexed Kuru swaps only when opened. Ongoing calls have not expired; expired unresolved calls are counted separately. Swaps show chain 10143, index freshness, block and transaction links. They are historical fills, not holdings or open positions. Perpl creator positions are unavailable until creator-owned account mapping exists; the team account must not be presented as a KOL's account.

## Following without a paid X API

X's official API is pay-per-use. This version makes no X API following requests and adds no paid provider. It reads visible X UI after explicit opt-in instead:

1. Load extension 0.4.0 in the same Chrome profile as X and Tradepost; approve its storage permission if Chrome asks. Reload X and `/dashboard/watchlist` after updating.
2. Sign in to Tradepost with X. On Watchlist, choose **Enable viewed-follow sync**. The dashboard verifies the Privy session through `/api/identity` to determine its viewer handle.
3. Visit a followed account's profile or your own `/following` list on X. The extension observes explicit Follow/Following controls; it never treats a generic mention, feed post or another person's following list as your follow.
4. Observed accounts appear in the Watchlist section within 15 seconds while the dashboard is visible. Records are stored only in extension storage, separately for each viewer handle, capped at 500 latest observations. They contain a handle and observation time, not cookies, passwords or Privy tokens.
5. A visible Follow control removes that account from the observed list. **Disable sync & clear observations** stops recording and clears the viewer's browser records.

This is partial, browser-observed state. It cannot import follows never viewed, detect unfollows on other devices or while closed, or prove stable X IDs from the DOM. Handle lookups do not verify identity. Not every followed account is a crypto influencer; every observed account can be opened for evidence, and unavailable records remain honest. Manual saved handles remain separate.

The app bridge is injected only on the configured app origin and handles requests only on `/dashboard/watchlist`. The worker checks the sender tab origin/path and validates bounded payloads. It serializes storage writes; collection is disabled by default. There is no automatic trading, provider proxy or transfer of login tokens across the bridge.

## Verification and remaining limits

DOM tests cover profile-only observation, explicit unfollows, suggestion/feed exclusion, own-list scoping, missing viewer UI, and click-only expansion. Storage tests cover opt-in, account isolation, deduplication, clearing and malformed data. Real-X and production bridge validation still require reloading the installed extension. DOM selectors may change when X updates.

Supported full-list synchronization is separate future work and needs suitable X API access. X prices following/follower reads at $0.010 per returned resource in its [official pricing](https://docs.x.com/x-api/getting-started/pricing), checked 12 October 2026. This feature does not enable that paid path. Existing hosting/database/provider usage retains its own pricing and free-tier limits.
