import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreReport,
  scoreChange,
  scoreRequirements,
} from "../src/shared/score.js";
import { scan } from "../src/server/scan.js";
import { ScanNetwork } from "../src/server/network.js";
import { startFixtureServer, FIXTURE_ORIGIN } from "./fixtures.js";
import type { Report } from "../src/shared/model.js";

test("a verified fixture repair raises fixed-rubric points while unavailable checks stay unearned", async () => {
  const fixture = await startFixtureServer();
  try {
    const before = await scan(
      [FIXTURE_ORIGIN, FIXTURE_ORIGIN + "/guide", FIXTURE_ORIGIN + "/pricing"],
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    fixture.redeploy();
    const after = await scan(
      before.urls,
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    const a = scoreReport(before),
      b = scoreReport(after);
    assert.equal(
      a.items.reduce((sum, x) => sum + x.weight, 0),
      300,
    );
    assert.ok(a.value !== null && b.value !== null);
    assert.ok(b.value! > a.value!);
    assert.ok(b.coverage < 100); // Revised pricing is unavailable, never a pass.
    assert.ok(scoreChange(before, after).delta! > 0);
  } finally {
    await fixture.close();
  }
});
test("lost failure coverage and duplicate passes cannot inflate the score", async () => {
  const fixture = await startFixtureServer();
  try {
    const report = await scan(
      [FIXTURE_ORIGIN],
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    const previous = scoreReport(report);
    const missing = structuredClone(report);
    missing.checks = missing.checks.filter((c) => c.verdict !== "fail");
    assert.ok(scoreReport(missing).value! <= previous.value!);
    const duplicated = {
      ...report,
      checks: [...report.checks, ...report.checks],
    } as Report;
    assert.equal(scoreReport(duplicated).value, previous.value);
    const changed = { ...report, urls: [FIXTURE_ORIGIN + "/different"] };
    assert.equal(scoreChange(report, changed).delta, null);
  } finally {
    await fixture.close();
  }
});
test("optional descriptions/canonicals/schema and owner tracking are not mandatory points", async () => {
  const fixture = await startFixtureServer();
  try {
    const report = await scan(
      [FIXTURE_ORIGIN + "/pricing"],
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    const copy = structuredClone(report);
    copy.checks = copy.checks.map((c) =>
      ["description", "canonical"].includes(c.rule)
        ? { ...c, verdict: "suggestion" as const }
        : c,
    );
    assert.equal(scoreReport(copy).value, scoreReport(report).value);
    assert.ok(scoreReport(copy).items.every((x) => x.label !== "Analytics"));
    const unavailable = { ...report, pages: [], checks: [] } as Report;
    assert.equal(scoreReport(unavailable).value, null);
    assert.equal(scoreReport(unavailable).coverage, 0);
  } finally {
    await fixture.close();
  }
});
test("losing a browser-only failure cannot raise the score; fresh comparable browser evidence can", async () => {
  const fixture = await startFixtureServer();
  try {
    fixture.redeploy();
    const report = await scan(
      [FIXTURE_ORIGIN + "/"],
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    const raw = report.checks.find((c) => c.rule === "noindex")!;
    const rendered = {
      ...raw,
      id: JSON.stringify(["rendered.noindex", raw.url, "page"]),
      rule: "rendered.noindex",
      source: "rendered-dom" as const,
      verdict: "fail" as const,
    };
    report.checks.push(rendered);
    const first = scoreReport(report);
    const absent = {
      ...report,
      checks: report.checks.filter((c) => c.id !== rendered.id),
      scoreRequirements: [rendered.id],
    };
    assert.equal(scoreReport(absent).value, first.value);
    assert.ok(scoreReport(absent).coverage < first.coverage);
    const fixed = {
      ...absent,
      checks: [...absent.checks, { ...rendered, verdict: "pass" as const }],
    };
    assert.equal(scoreReport(fixed).value! - first.value!, 20);
  } finally {
    await fixture.close();
  }
});

test("browser requirements first seen in a later recheck survive further coverage loss", async () => {
  const fixture = await startFixtureServer();
  try {
    fixture.redeploy();
    const original = await scan(
      [FIXTURE_ORIGIN + "/"],
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    const raw = original.checks.find((c) => c.rule === "noindex")!;
    const browser = {
      ...raw,
      id: JSON.stringify(["rendered.noindex", raw.url, "page"]),
      rule: "rendered.noindex",
      source: "rendered-dom" as const,
      verdict: "fail" as const,
    };
    const later = {
      ...original,
      checks: [...original.checks, browser],
    };
    const lost = {
      ...original,
      scoreRequirements: scoreRequirements(original, later),
    };
    assert.equal(scoreReport(lost).value, scoreReport(later).value);
    assert.ok(scoreReport(lost).coverage < scoreReport(later).coverage);
    const lostAgain = {
      ...original,
      scoreRequirements: scoreRequirements(original, lost),
    };
    assert.deepEqual(lostAgain.scoreRequirements, lost.scoreRequirements);
    assert.equal(scoreReport(lostAgain).value, scoreReport(later).value);
  } finally {
    await fixture.close();
  }
});
