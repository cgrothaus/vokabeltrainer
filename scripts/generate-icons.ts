// Erzeugt die PNG-Icons aus public/icons/icon.svg mit dem Chromium aus Playwright (keine weitere Abhängigkeit).
// Aufruf nach Änderungen am SVG: `npm run icons`; die PNGs werden eingecheckt.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const dir = new URL("../public/icons/", import.meta.url);
const svg = readFileSync(new URL("icon.svg", dir));
const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;

// 180: apple-touch-icon (iOS nutzt keine Manifest-Icons), 192 und 512: Manifest.
const sizes = [180, 192, 512];

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0}img{display:block}</style><img src="${src}" width="${size}" height="${size}">`,
    );
    await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
    const path = new URL(`icon-${size}.png`, dir);
    await page.screenshot({ path: path.pathname });
    await page.close();
    console.log(`icon-${size}.png`);
  }
} finally {
  await browser.close();
}
