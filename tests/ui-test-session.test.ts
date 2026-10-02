import { test } from "node:test";
import assert from "node:assert/strict";
import { uiTestRetrieval, UI_TEST_SITES } from "../src/server/ui-test-session.js";
import type { Report } from "../src/shared/model.js";
const expires = () => new Date(Date.now() + 60000).toISOString();
test("manual live UI session requires explicit approval, key and bounded expiry", () => {
  assert.throws(() => uiTestRetrieval("test-key", expires(), false));
  assert.throws(() => uiTestRetrieval("", expires(), true));
  assert.throws(() => uiTestRetrieval("test-key", "bad", true));
  assert.throws(() => uiTestRetrieval("test-key", new Date(Date.now() + 3600000).toISOString(), true));
});
test("manual live UI session rejects expanded scope/query before any provider call", async () => {
  const service = uiTestRetrieval("test-key-not-real", expires(), true);
  const report = (urls: string[]) => ({ urls, mode: "fixture-demo", pages: [] }) as unknown as Report;
  await assert.rejects(() => service.run(report(["https://other.example/"]), "https://other.example/"));
  await assert.rejects(() => service.run(report([UI_TEST_SITES[0], UI_TEST_SITES[1]]), UI_TEST_SITES[0]));
  await assert.rejects(() => service.run(report([UI_TEST_SITES[0]]), "extra query"));
  // The fixture mode cannot be mistaken for live raw preflight, even in an approved session.
  const evidence = await service.run(report([UI_TEST_SITES[0]]), UI_TEST_SITES[0]);
  assert.equal(evidence.provider, "not-run");
  assert.equal(evidence.searchRequests, 0);
  assert.equal(evidence.fetchUrls, 0);
});
