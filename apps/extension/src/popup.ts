import { appOrigin } from "./config";

const appLink = document.querySelector<HTMLAnchorElement>("#open-app");
if (appLink) appLink.href = appOrigin;
const list = document.querySelector<HTMLUListElement>("#status");

function item(label: string, value: string, tone: "ok" | "demo" | "off") {
  const li = document.createElement("li");
  const name = document.createElement("span");
  name.textContent = label;
  const state = document.createElement("b");
  state.className = tone;
  state.textContent = value;
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
  .then((health: { modes?: Record<string, string> }) => {
    const modes = health.modes ?? {};
    const tone = (mode?: string) =>
      mode === "live" ? "ok" : mode === "demo" ? "demo" : "off";
    list?.replaceChildren(
      item("App", "Connected", "ok"),
      item(
        "Call extraction",
        modes.llm === "live" ? "Groq" : "Rules (demo)",
        tone(modes.llm),
      ),
      item(
        "Nansen checks",
        modes.nansen === "live" ? "Live" : "Demo data",
        tone(modes.nansen),
      ),
      item(
        "Perpl orders",
        modes.perpl === "live" ? "Live" : "Demo (not sent)",
        tone(modes.perpl),
      ),
      item("Kuru spot", "Live testnet", "ok"),
    );
  })
  .catch(() => {
    list?.replaceChildren(item("App", "Not reachable — run pnpm dev", "off"));
  });
