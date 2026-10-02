import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Report } from "../src/shared/model.js";
import { compareReports, exportMarkdown, repairPrompt } from "../src/shared/report.js";

// This client never receives the API key. The private backend owns exact scopes
// and cumulative provider allowances; this script cannot renew either.
const origin = "http://127.0.0.1:4317";
const sites = [
  ["himas-corner", "https://www.himascorner.com/"],
  ["rayanbuild", "https://rayanbuild-site.web.app/"],
  ["thb-blue", "https://thb-blue.vercel.app/"],
];
const session = await fetch(origin + "/api/session", { method: "POST", headers: { Origin: origin } }).then(r => r.json());
if (session.retrieval !== "approved-live" || typeof session.token !== "string") throw new Error("An approved live helper is required.");
await mkdir("output/selected-sites", { recursive: true });
const baseline = new Map<string, Report>();
let lastStart = 0;
const resume = process.argv.includes("--resume");
const continuation = process.argv.includes("--continue");
const previous = resume || continuation ? JSON.parse(await readFile("output/selected-sites/live-demo-summary.json", "utf8")) : { rounds: [] };
const summary: unknown[] = previous.rounds;
if (resume || continuation) baseline.set("himas-corner", JSON.parse(await readFile("output/selected-sites/himas-corner-live-baseline.json", "utf8")).report);
if (continuation) baseline.set("rayanbuild", JSON.parse(await readFile("output/selected-sites/rayanbuild-live-baseline.json", "utf8")).report);
const queue = continuation
  ? [["baseline", ...sites[2]], ["recheck", ...sites[1]], ["recheck", ...sites[2]]]
  : resume
  ? [["recheck", ...sites[0]], ["baseline", ...sites[1]], ["baseline", ...sites[2]], ["recheck", ...sites[1]], ["recheck", ...sites[2]]]
  : ["baseline", "recheck"].flatMap(phase => sites.map(site => [phase, ...site]));
for (const [phase, name, url] of queue) {
    // Avoid the helper's three-scans/minute limit without retrying any audit.
    const pause = Math.max(0, lastStart + 23000 - Date.now());
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
    lastStart = Date.now();
    const response = await fetch(origin + "/api/scan", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "X-PublishProof-Token": session.token },
      body: JSON.stringify({ consent: true, urls: [url], tinyfish: { enabled: true, query: "", remoteConsent: true } }),
      signal: AbortSignal.timeout(95000),
    });
    const body = await response.json();
    if (!response.ok || !body.report) throw new Error("Approved demo stopped: local scan failed; no automatic retry.");
    const report = body.report as Report;
    if (phase === "baseline") baseline.set(name, report);
    const comparisons = phase === "recheck" ? compareReports(baseline.get(name)!, report) : [];
    await writeFile("output/selected-sites/" + name + "-live-" + phase + ".json", JSON.stringify({ report, comparisons }, null, 2));
    await writeFile("output/selected-sites/" + name + "-live-" + phase + ".md", exportMarkdown(report, comparisons));
    await writeFile("output/selected-sites/" + name + "-live-" + phase + "-prompt.txt", repairPrompt(report));
    const entry = {
      name, url, phase, observedAt: report.createdAt,
      provider: report.retrieval?.provider,
      searchResults: report.retrieval?.search.hits.length,
      searchError: report.retrieval?.search.error,
      fetchedPages: report.retrieval?.pages.map(page => ({ url: page.url, characters: page.characters, error: page.error })),
      failedChecks: report.checks.filter(check => check.verdict === "fail").map(check => check.title),
      reviewSuggestions: report.checks.filter(check => check.verdict === "suggestion").map(check => check.title),
      comparisonCounts: comparisons.reduce<Record<string, number>>((counts, item) => { counts[item.status] = (counts[item.status] ?? 0) + 1; return counts; }, {}),
    };
    summary.push(entry);
    await writeFile("output/selected-sites/live-demo-summary.json", JSON.stringify({
      noSiteChangesOrRedeployment: true,
      noChromeLaunched: true,
      documentedProviderCostUsd: 0,
      balanceNotIndependentlyMeasured: true,
      rounds: summary,
    }, null, 2));
    console.log(JSON.stringify(entry));
    // A safety-filtered external result is partial evidence, not an access failure.
    // Preserve unknown visibility in the report and continue distinct approved inputs.
    const partialSearch = report.retrieval?.search.error?.startsWith("Some returned search results");
    if (report.retrieval?.provider !== "tinyfish-live" || (report.retrieval.search.error && !partialSearch) || report.retrieval.pages.some(page => page.error)) {
      console.log("Stopped on unavailable or incomplete provider evidence. No retry, paid fallback, or extra calls.");
      process.exitCode = 1; process.exit();
    }
}
console.log("Bounded live demo complete: six Search attempts and six fetched pages maximum. Repeat observation only; no repair or deployment claimed.");
