import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createKeyEntry } from "../src/server/key-entry.js";

test("key entry rejects foreign origins and keeps the secret out of responses", async () => {
  let activations = 0;
  const secret = "test-only-not-a-real-provider-key";
  const entry = createKeyEntry(async key => { assert.equal(key, secret); activations++; }, Date.now() + 60000);
  await new Promise<void>(resolve => entry.server.listen(0, "127.0.0.1", resolve));
  const address = entry.server.address(); assert(address && typeof address !== "string");
  const origin = "http://127.0.0.1:" + address.port;
  const url = origin + entry.entryPath;
  const post = (headers: Record<string, string>, body: string, target = url) => fetch(target, { method: "POST", headers, body });
  try {
    const page = await fetch(url);
    assert((await page.text()).includes('type="password"'));
    assert(page.headers.get("content-security-policy")!.includes("frame-ancestors 'none'"));
    assert.equal(page.headers.get("cache-control"), "no-store");
    const formHeaders = { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" };
    assert.equal((await post({ ...formHeaders, Origin: "https://evil.example" }, "key=" + secret)).status, 403);
    assert.equal((await post({ ...formHeaders, "Sec-Fetch-Site": "cross-site" }, "key=" + secret)).status, 403);
    const badHost = await new Promise<number | undefined>((resolve, reject) => {
      http.get(url, { headers: { Host: "evil.example" } }, res => { res.resume(); resolve(res.statusCode); }).on("error", reject);
    });
    assert.equal(badHost, 403);
    assert.equal((await fetch(origin + "/key/guessed/status")).status, 404);
    const response = await post(formHeaders, new URLSearchParams({ key: secret }).toString());
    assert.equal(response.status, 200); assert(!(await response.text()).includes(secret));
    assert.equal(activations, 0);
    const status = await (await fetch(url + "/status")).text();
    assert(!status.includes(secret)); assert.equal(JSON.parse(status).keyReceived, true);
    assert(!(await (await fetch(url)).text()).includes(secret));
    const activateHeaders = { Origin: origin, "Content-Type": "application/json" };
    assert.equal((await post(activateHeaders, '{"action":"activate"}', url + "/activate")).status, 200);
    assert.equal(activations, 1);
    assert.equal((await post(activateHeaders, '{"action":"activate"}', url + "/activate")).status, 409);
    entry.clear(); assert.equal((await (await fetch(url + "/status")).json()).keyReceived, false);
  } finally { await new Promise<void>(resolve => entry.server.close(() => resolve())); }
});

test("expired entry and failed activation are closed without secret disclosure", async () => {
  const expired = createKeyEntry(async () => { throw new Error("Should not activate"); }, Date.now() - 1);
  await new Promise<void>(resolve => expired.server.listen(0, "127.0.0.1", resolve));
  const address = expired.server.address(); assert(address && typeof address !== "string");
  try { assert.equal((await fetch("http://127.0.0.1:" + address.port + expired.entryPath)).status, 403); }
  finally { await new Promise<void>(resolve => expired.server.close(() => resolve())); }
  const entry = createKeyEntry(async key => { throw new Error(key); }, Date.now() + 60000);
  await new Promise<void>(resolve => entry.server.listen(0, "127.0.0.1", resolve));
  const address2 = entry.server.address(); assert(address2 && typeof address2 !== "string");
  const origin = "http://127.0.0.1:" + address2.port; const url = origin + entry.entryPath;
  try {
    const headers = { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" };
    assert.equal((await fetch(url, { method: "POST", headers, body: "key=bad+space" })).status, 400);
    assert.equal((await fetch(url, { method: "POST", headers, body: "key=test-secret-123" })).status, 200);
    const result = await fetch(url + "/activate", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: '{"action":"activate"}' });
    assert.equal(result.status, 403); assert(!(await result.text()).includes("test-secret-123"));
  } finally { entry.clear(); await new Promise<void>(resolve => entry.server.close(() => resolve())); }
});
