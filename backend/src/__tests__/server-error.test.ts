import { test, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { reporter, serverError } from "../lib/monitoring";

async function withApp(handler: express.RequestHandler, fn: (url: string) => Promise<void>) {
  const app = express();
  app.get("/boom", handler);
  const server = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/boom`);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
}

test("a route that throws inside its own catch reports once and answers exactly as before", async () => {
  const capture = mock.method(reporter, "capture", () => {});
  const quiet = mock.method(console, "error", () => {});
  try {
    await withApp(
      async (_req, res) => {
        try {
          throw new Error("db exploded for ravi@fakemail.in");
        } catch (error) {
          console.error(error);
          return serverError(res, error, "Failed to fetch customers");
        }
      },
      async (url) => {
        const r = await fetch(url);
        const body = await r.text();
        assert.equal(r.status, 500);
        assert.equal(body, JSON.stringify({ error: "Failed to fetch customers" }));
        assert.ok(!body.includes("exploded"));
      },
    );
    assert.equal(capture.mock.callCount(), 1);
    assert.match(String((capture.mock.calls[0].arguments[0] as Error).message), /db exploded/);
  } finally {
    capture.mock.restore();
    quiet.mock.restore();
  }
});

test("serverError defaults to the generic message", async () => {
  const capture = mock.method(reporter, "capture", () => {});
  try {
    await withApp(
      (_req, res) => serverError(res, new Error("x")) as unknown as void,
      async (url) => {
        const r = await fetch(url);
        assert.equal(r.status, 500);
        assert.deepEqual(await r.json(), { error: "Internal server error" });
      },
    );
    assert.equal(capture.mock.callCount(), 1);
  } finally {
    capture.mock.restore();
  }
});

test("a 4xx answer does not report to Sentry", async () => {
  const capture = mock.method(reporter, "capture", () => {});
  try {
    await withApp(
      (_req, res) => void res.status(404).json({ error: "Not found" }),
      async (url) => {
        assert.equal((await fetch(url)).status, 404);
      },
    );
    assert.equal(capture.mock.callCount(), 0);
  } finally {
    capture.mock.restore();
  }
});

test("a thrown error with a secret-looking message is not in the response body", async () => {
  const capture = mock.method(reporter, "capture", () => {});
  const quiet = mock.method(console, "error", () => {});
  try {
    await withApp(
      async (_req, res) => {
        try {
          throw new Error('relation "payments" does not exist; connection string password=x');
        } catch (error) {
          return serverError(res, error, "Failed to verify payment proof");
        }
      },
      async (url) => {
        const r = await fetch(url);
        const body = await r.text();
        assert.equal(r.status, 500);
        assert.equal(body, JSON.stringify({ error: "Failed to verify payment proof" }));
        assert.ok(!/password|relation|payments"/.test(body));
      },
    );
    assert.equal(capture.mock.callCount(), 1);
  } finally {
    capture.mock.restore();
    quiet.mock.restore();
  }
});

test("no route passes an error's message to the client through serverError", () => {
  const dir = path.join(__dirname, "..", "routes");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/serverError\(res,\s*(\w+),([^;]*)\);/g)) {
      assert.ok(!/\.message|String\(|\$\{/.test(m[2]), `${f}: serverError must use a fixed message, got ${m[0]}`);
    }
  }
});
