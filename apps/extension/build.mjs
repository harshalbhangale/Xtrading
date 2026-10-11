import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
const url = new URL(
  process.env.CMB_EXTENSION_APP_ORIGIN ?? "http://localhost:3000",
);
if (
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  (url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    ))
)
  throw new Error(
    "Configure an HTTPS app origin or explicit localhost development origin.",
  );
const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
manifest.host_permissions = [`${url.origin}/*`];
await writeFile("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
await build({
  entryPoints: ["src/content.ts", "src/popup.ts", "src/background.ts"],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: true,
  minify: true,
  define: { CMB_APP_ORIGIN: JSON.stringify(url.origin) },
});
