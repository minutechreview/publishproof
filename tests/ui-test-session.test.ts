import { test } from "node:test";
import assert from "node:assert/strict";
import {
  uiTestRetrieval,
  UI_TEST_SITES,
} from "../src/server/ui-test-session.js";
import type { Report } from "../src/shared/model.js";
const expires = () => new Date(Date.now() + 60000).toISOString();
test("manual live UI session requires explicit approval, key and bounded expiry", () => {
  assert.throws(() => uiTestRetrieval("test-key", expires(), false));
  assert.throws(() => uiTestRetrieval("", expires(), true));
  assert.throws(() => uiTestRetrieval("test-key", "bad", true));
  assert.throws(() =>
    uiTestRetrieval(
      "test-key",
      new Date(Date.now() + 3600000).toISOString(),
      true,
    ),
  );
});
test("manual live UI session rejects expanded scope/query before any provider call", async () => {
  const service = uiTestRetrieval("test-key-not-real", expires(), true);
  const report = (urls: string[]) =>
    ({ urls, mode: "fixture-demo", pages: [] }) as unknown as Report;
  await assert.rejects(() =>
    service.run(report(["https://other.example/"]), "https://other.example/"),
  );
  await assert.rejects(() =>
    service.run(report([UI_TEST_SITES[0], UI_TEST_SITES[1]]), UI_TEST_SITES[0]),
  );
  await assert.rejects(() =>
    service.run(report([UI_TEST_SITES[0]]), "extra query"),
  );
  // The fixture mode cannot be mistaken for live raw preflight, even in an approved session.
  const evidence = await service.run(
    report([UI_TEST_SITES[0]]),
    UI_TEST_SITES[0],
  );
  assert.equal(evidence.provider, "not-run");
  assert.equal(evidence.searchRequests, 0);
  assert.equal(evidence.fetchUrls, 0);
});
test("session advertises only its exact approved scope and gives a useful www error", () => {
  const service = uiTestRetrieval("fake-not-real", expires(), true);
  assert.deepEqual(service.scope?.urls, [...UI_TEST_SITES]);
  assert.equal(service.scope?.maxPages, 1);
  assert.throws(
    () =>
      service.validate?.(
        ["https://himascorner.com/"],
        "https://himascorner.com/",
      ),
    /including www/,
  );
  assert.throws(
    () => service.validate?.([UI_TEST_SITES[0]], "topic"),
    /search words blank/,
  );
});
test("an unapproved AI URL is rejected before any raw audit or provider work", async () => {
  const { createApp } = await import("../src/server/app.js");
  let audits = 0;
  const service = uiTestRetrieval("fake-not-real", expires(), true);
  const app = createApp(
    async () => {
      audits++;
      throw Error("Audit should not run");
    },
    "public-live",
    service,
  );
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const address = app.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const session = await fetch(origin + "/api/session", {
      method: "POST",
      headers: { Origin: origin },
    }).then((r) => r.json());
    const response = await fetch(origin + "/api/scan", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-PublishProof-Token": session.token,
      },
      body: JSON.stringify({
        consent: true,
        urls: ["https://himascorner.com/"],
        tinyfish: { enabled: true, query: "", remoteConsent: true },
      }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /including www/);
    assert.equal(audits, 0);
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }
});
