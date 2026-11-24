import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dir = "public/guides";
const guides = fs.readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "index.html");
const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");

test("five guides plus an index exist and are in the sitemap", () => {
  assert.equal(guides.length, 5);
  assert.ok(fs.existsSync(`${dir}/index.html`) && fs.existsSync(`${dir}/guides.css`));
  assert.ok(sitemap.includes("https://paivo.in/guides/"));
  for (const g of guides) assert.ok(sitemap.includes(`https://paivo.in/guides/${g}`), g);
});

test("each guide is static, CSP-safe, complete and honest", () => {
  for (const g of guides) {
    const html = fs.readFileSync(`${dir}/${g}`, "utf8");
    assert.ok(!/<script|\sstyle=|\son[a-z]+=/i.test(html), `${g}: no inline script or style (CSP)`);
    assert.match(html, /<title>[^<]{10,80}<\/title>/, g);
    assert.match(html, /<meta name="description" content="[^"]{60,}"/, g);
    assert.ok(html.includes(`<link rel="canonical" href="https://paivo.in/guides/${g}">`), `${g}: canonical`);
    assert.match(html, /og:title/, g);
    assert.match(html, /Updated 24 Nov 2026/, g);
    assert.match(html, /Sources and where to check/, g);
    assert.match(html, /not tax or legal advice/i, g);
    assert.match(html, /href="https:\/\/paivo\.in\/register\?utm_source=guide/, `${g}: sign-up CTA`);
    const text = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    assert.ok(text >= 800 && text <= 1500, `${g}: ${text} words`);
    assert.ok(!/escrow(?! service| agent)|256-bit|bank-grade|guaranteed/i.test(html.replace(/It is not escrow\./g, "")), `${g}: banned claim`);
  }
});

test("guides print no tax or UPI figure we could not verify", () => {
  const all = guides.map((g) => fs.readFileSync(`${dir}/${g}`, "utf8")).join("\n");
  assert.ok(!/(?:₹|rs\.?\s?)\s?\d+(?:,\d+)*\s*(?:lakh|crore)/i.test(all), "no lakh/crore limits");
  assert.ok(!/\b(?:20|40|10)\s*lakh/i.test(all), "no registration thresholds");
});
