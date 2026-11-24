import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * AGENTS.md rule 7: every claim must be true. Paivo is not an escrow, does not hold money, and cannot back
 * certificate-style security claims, so these phrases must not come back into user-facing code.
 */
const BANNED = [
  "256-bit", "aes-256", "tls 1.3", "bank-grade", "bank grade", "military", "escrow charter", "held in escrow",
  "deliverable escrow", "deliverable vault", "secure deliverables vault", "quiet hours", "cryptographically",
];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

test("no banned security or escrow claims in src/", () => {
  const hits: string[] = [];
  for (const f of files("src")) {
    const text = fs.readFileSync(f, "utf8").toLowerCase();
    for (const phrase of BANNED) if (text.includes(phrase)) hits.push(`${f}: "${phrase}"`);
  }
  assert.deepEqual(hits, []);
});

test("the word escrow only appears to say Paivo is NOT one", () => {
  const bad: string[] = [];
  for (const f of files("src")) {
    const lines = fs.readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/escrow/i.test(line) && !/not an escrow|escrow service|escrow agent|escrow or/i.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});
