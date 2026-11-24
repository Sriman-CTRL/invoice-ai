import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);

test("index.html links the favicon set and manifest, and every file exists", () => {
  for (const h of ["/favicon.svg", "/favicon.ico", "/apple-touch-icon.png", "/site.webmanifest"]) assert.ok(hrefs.includes(h), h);
  for (const h of hrefs) assert.ok(fs.existsSync(`public${h}`), h);
  assert.match(html, /name="theme-color" content="#070a13"/);
});

test("web manifest points at real icons", () => {
  const m = JSON.parse(fs.readFileSync("public/site.webmanifest", "utf8"));
  assert.equal(m.theme_color, "#070a13");
  assert.ok(m.icons.some((i: any) => i.sizes === "192x192") && m.icons.some((i: any) => i.sizes === "512x512"));
  for (const i of m.icons) assert.ok(fs.existsSync(`public${i.src}`), i.src);
});

test("link preview image is 1200x630 and under 300 KB", () => {
  const png = fs.readFileSync("public/og.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.length < 300 * 1024, `${png.length} bytes`);
});

test("guides use the logo from the site itself (no new external origin)", () => {
  for (const f of fs.readdirSync("public/guides").filter((n) => n.endsWith(".html"))) {
    const t = fs.readFileSync(`public/guides/${f}`, "utf8");
    assert.ok(t.includes('src="/brand/paivo-wordmark-dark.svg"'), f);
  }
  assert.ok(fs.existsSync("public/brand/paivo-wordmark-dark.svg"));
});

test("no source file still shows the old INVOICE.AI wordmark", () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of walk("src").filter((n) => /\.tsx?$/.test(n))) assert.ok(!/INVOICE<span/.test(fs.readFileSync(f, "utf8")), f);
});
