// scripts/render-splash.mjs
// Regenerates public/splash/*.png at the existing sizes: lavender background
// with the repstr wordmark centred at 45% of the screen width. Uses headless
// Chromium to rasterise the SVG (no extra dependencies).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME =
  "/Users/jiram/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const SIZES = {
  "iphone-11": [828, 1792],
  "iphone-14-plus": [1284, 2778],
  "iphone-14-pro-max": [1290, 2796],
  "iphone-14-pro": [1179, 2556],
  "iphone-14": [1170, 2532],
  "iphone-16-pro-max": [1320, 2868],
  "iphone-16-pro": [1206, 2622],
  "iphone-se": [750, 1334],
  "iphone-x": [1125, 2436],
};

const root = new URL("..", import.meta.url).pathname;
const wordmark = readFileSync(path.join(root, "brand/repstr-wordmark-dark.svg"), "utf8");
const html = `<!doctype html><html><head><meta charset="utf8"></head><body style="margin:0;background:#BAA3D0;display:flex;align-items:center;justify-content:center;height:100vh"><div style="width:45vw">${wordmark.replace("<svg ", '<svg width="100%" ')}</div></body></html>`;
const page = path.join(tmpdir(), "repstr-splash.html");
writeFileSync(page, html);
mkdirSync(path.join(root, "public/splash"), { recursive: true });

for (const [name, [w, h]] of Object.entries(SIZES)) {
  const out = path.join(root, "public/splash", `${name}.png`);
  execFileSync(CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${w},${h}`,
    "--force-device-scale-factor=1",
    `--screenshot=${out}`,
    `file://${page}`,
  ]);
  console.log("wrote", out, `${w}x${h}`);
}
