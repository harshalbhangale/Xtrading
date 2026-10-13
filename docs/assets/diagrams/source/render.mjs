// Renders the README diagrams. Usage, from this folder:
//   npm i --no-save puppeteer@23.11.1 && node render.mjs ..
import puppeteer from "puppeteer";

const [, , out] = process.argv;
const browser = await puppeteer.launch({
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 1000, deviceScaleFactor: 2 });
await page.goto("file://" + process.cwd() + "/draw.html");
await page.evaluate(() => document.fonts.ready);
for (const name of ["people", "architecture"]) {
  await page.evaluate((n) => window.render(n), name);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  const el = await page.$("#c");
  await el.screenshot({ path: `${out}/${name}.png` });
}
await browser.close();
