import { readFile } from "node:fs/promises";
import type http from "node:http";
import { createKeyEntry } from "../src/server/key-entry.js";
import { createApp } from "../src/server/app.js";
import { approvedRetrievalService, validateRetrievalApproval, type RetrievalApproval } from "../src/server/retrieval.js";
import { searchQuery } from "../src/shared/retrieval.js";

const sites = ["https://www.himascorner.com/", "https://rayanbuild-site.web.app/", "https://thb-blue.vercel.app/"];
const approvalPath = "output/live-demo-approval.json";
// Reuse an existing approval deadline rather than silently renewing it on restart.
const prior = JSON.parse(await readFile(approvalPath, "utf8").catch(() => '{"scopes":[]}')) as { scopes?: RetrievalApproval[] };
const approvedDeadline = Math.min(...(prior.scopes ?? []).map(scope => Date.parse(scope.expiresAt)));
const expiresAt = Number.isFinite(approvedDeadline) ? Math.min(approvedDeadline, Date.now() + 30 * 60 * 1000) : Date.now() + 30 * 60 * 1000;
if (expiresAt <= Date.now()) throw new Error("The owner-approved session expired. New scope approval is required.");
let helper: http.Server | undefined;
const entry = createKeyEntry(async key => {
  const input = JSON.parse(await readFile(approvalPath, "utf8")) as { scopes: RetrievalApproval[] };
  if (!Array.isArray(input.scopes) || input.scopes.length !== 3) throw new Error("Invalid scope count.");
  const services = new Map();
  for (let i = 0; i < sites.length; i++) {
    const scope = input.scopes[i];
    if (JSON.stringify(scope.exactUrls) !== JSON.stringify([sites[i]]) || scope.query !== "" || ![1, 2].includes(scope.maxSearchRequests) || scope.maxFetchUrls !== scope.maxSearchRequests || Date.parse(scope.expiresAt) > expiresAt) throw new Error("Scope exceeds this demo.");
    validateRetrievalApproval(scope, scope.exactUrls, searchQuery(scope.query, sites[i]), key);
    services.set(sites[i], approvedRetrievalService(scope, key));
  }
  helper = createApp(undefined, "public-live", { kind: "approved-live", async run(report, query) {
    if (report.urls.length !== 1) throw new Error("Demo scope: one supplied homepage at a time.");
    const service = services.get(report.urls[0]);
    if (!service) throw new Error("URL outside the approved demo scope.");
    return service.run(report, query);
  } });
  await new Promise<void>((resolve, reject) => {
    helper!.once("error", reject);
    helper!.listen(4317, "127.0.0.1", () => resolve());
  });
}, expiresAt);
entry.server.listen(4318, "127.0.0.1", () => console.log(JSON.stringify({
  entryUrl: `http://127.0.0.1:4318${entry.entryPath}`,
  expiresAt: new Date(expiresAt).toISOString(),
  keyStorage: "session memory only", callsStarted: false,
})));
const stop = () => { entry.clear(); helper?.close(); entry.server.close(); setTimeout(() => process.exit(0), 100).unref(); };
setTimeout(stop, expiresAt - Date.now());
process.on("SIGINT", stop); process.on("SIGTERM", stop);
