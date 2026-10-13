import { appOrigin } from "./config";

export type StatusTone = "ok" | "demo" | "off";
export type StatusRow = { label: string; value: string; tone: StatusTone };

const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
  appOrigin,
);

/** Popup headline. A packaged build is not a development build. */
export function buildLabel(chainId: number | undefined) {
  const network =
    chainId === 143
      ? "Monad mainnet"
      : chainId === 10143
        ? "Monad testnet"
        : "Monad";
  return localOrigin ? `Local build · ${network}` : network;
}

/**
 * Health reports a chain and provider modes. It does not prove a Kuru fill.
 * Perpl "wallet" means each user signs orders for their own account; no server key.
 */
export function connectionRows(health: {
  chainId?: number;
  modes?: Record<string, string>;
}): StatusRow[] {
  const modes = health.modes ?? {};
  const tone = (mode?: string): StatusTone =>
    mode === "live" ? "ok" : mode === "demo" ? "demo" : "off";
  const perpl: StatusRow =
    modes.perpl === "wallet"
      ? { label: "Perpl orders", value: "Your wallet · testnet", tone: "ok" }
      : { label: "Perpl orders", value: "Unavailable", tone: "off" };
  const kuru =
    health.chainId === 143
      ? "Mainnet"
      : health.chainId === 10143
        ? "Testnet"
        : "Unknown network";
  return [
    { label: "App", value: "Connected", tone: "ok" },
    {
      label: "Call extraction",
      value: modes.llm === "live" ? "Groq" : "Rules (demo)",
      tone: tone(modes.llm),
    },
    {
      label: "Nansen checks",
      value: modes.nansen === "live" ? "Live" : "Demo data",
      tone: tone(modes.nansen),
    },
    perpl,
    {
      label: "Kuru spot",
      value: kuru,
      tone: kuru === "Unknown network" ? "off" : "ok",
    },
  ];
}

export function unreachableCopy() {
  return localOrigin ? "Not reachable. Start the local app." : "Not reachable";
}

if (typeof document !== "undefined") {
  const appLink = document.querySelector<HTMLAnchorElement>("#open-app");
  if (appLink) appLink.href = appOrigin;
  const list = document.querySelector<HTMLUListElement>("#status");
  const headline = document.querySelector<HTMLElement>("#build-label");

  function item(row: StatusRow) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = row.label;
    const state = document.createElement("b");
    state.className = row.tone;
    state.textContent = row.value;
    li.append(name, state);
    return li;
  }

  void fetch(`${appOrigin}/api/health`, {
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(8000),
  })
    .then((response) =>
      response.ok ? response.json() : Promise.reject(new Error("down")),
    )
    .then((health: { chainId?: number; modes?: Record<string, string> }) => {
      if (headline) headline.textContent = buildLabel(health.chainId);
      list?.replaceChildren(...connectionRows(health).map(item));
    })
    .catch(() => {
      if (headline)
        headline.textContent = localOrigin
          ? "Local build · app not reachable"
          : "App not reachable";
      list?.replaceChildren(
        item({ label: "App", value: unreachableCopy(), tone: "off" }),
      );
    });
}
