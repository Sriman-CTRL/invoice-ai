// Renders public/og.png (1200x630) from an SVG. Run: node scripts/make-og.mjs
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#070a13"/>
  <circle cx="1050" cy="80" r="260" fill="#6366f1" opacity="0.18"/>
  <rect x="80" y="84" width="64" height="64" rx="16" fill="url(#g)"/>
  <path d="M100 132 V100 H116 A12 12 0 0 1 116 124 H108" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="164" y="132" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#ffffff">Paivo</text>
  <text x="80" y="300" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700" fill="#ffffff">Get paid for your work.</text>
  <text x="80" y="384" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700" fill="#a5b4fc">Every time, without chasing.</text>
  <rect x="80" y="456" width="560" height="4" rx="2" fill="url(#g)"/>
  <text x="80" y="520" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#cbd5e1">UPI invoices · files unlock after payment</text>
  <text x="80" y="580" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#64748b">paivo.in</text>
</svg>`;

const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Arial" } }).render().asPng();
mkdirSync(resolve(root, "public"), { recursive: true });
writeFileSync(resolve(root, "public/og.png"), png);
console.log(`public/og.png written (${Math.round(png.length / 1024)} KB)`);
