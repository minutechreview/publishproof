import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saveState,
  loadStateForPage,
  type SavedState,
} from "../src/shared/report.js";
import { readJob, writeJob } from "../src/extension/jobs.js";
import { scan } from "../src/server/scan.js";
import { ScanNetwork } from "../src/server/network.js";
import { startFixtureServer, FIXTURE_ORIGIN } from "./fixtures.js";
test("only audited reports persist; switching pages retains a comparable baseline without a history permission", async () => {
  const fixture = await startFixtureServer();
  try {
    const map = new Map<string, string>();
    const store = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const first = await scan(
      [FIXTURE_ORIGIN + "/"],
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    const second = await scan(
      [FIXTURE_ORIGIN + "/guide"],
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    saveState(store, { report: first, comparisons: [] });
    saveState(store, { report: second, comparisons: [] });
    assert.equal(loadStateForPage(store, first.urls[0])?.report.id, first.id);
    assert.equal(loadStateForPage(store, second.urls[0])?.report.id, second.id);
    assert.equal(
      loadStateForPage(store, FIXTURE_ORIGIN + "/unvisited"),
      undefined,
    );
    for (let i = 0; i < 12; i++)
      saveState(store, {
        report: { ...first, urls: [FIXTURE_ORIGIN + `/chosen-${i}`] },
        comparisons: [],
      });
    assert.equal(JSON.parse(map.get("publishproof.reports.v2")!).length, 10);
  } finally {
    await fixture.close();
  }
});
test("popup runner jobs require an explicit public-page choice, sanitized URL and recent one-use ID", () => {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
  const job = {
    id: "a".repeat(32),
    url: "https://launch.example/",
    createdAt: Date.now(),
    publicConsent: true as const,
    remote: false,
    recheck: false,
    status: "pending" as const,
  };
  writeJob(store, job);
  assert.equal(readJob(store)?.id, job.id);
  writeJob(store, { ...job, url: job.url + "?token=secret" });
  assert.equal(readJob(store), undefined);
  writeJob(store, { ...job, createdAt: Date.now() - 6 * 60 * 1000 });
  assert.equal(readJob(store), undefined);
  writeJob(store, { ...job, publicConsent: false } as unknown as typeof job);
  assert.equal(readJob(store), undefined);
});
