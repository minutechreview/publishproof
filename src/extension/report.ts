import type { Check, Metadata, Report } from "../shared/model.js";
import { findings, renderedChecks } from "../shared/rules.js";
import {
  compareReports,
  exportMarkdown,
  loadState,
  repairPrompt,
  saveState,
  type SavedState,
} from "../shared/report.js";
import { isPublicLookingHost, safeUrl, selectUrls } from "../shared/urls.js";
import { capturePublicMetadata } from "./capture.js";
import { searchQuery } from "../shared/retrieval.js";
const API = "http://127.0.0.1:4317";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const pageInput = $<HTMLInputElement>("page-url");
const routesInput = $<HTMLTextAreaElement>("routes");
const consent = $<HTMLInputElement>("consent");
const auditButton = $<HTMLButtonElement>("audit");
const recheckButton = $<HTMLButtonElement>("recheck");
const targetQuery = $<HTMLInputElement>("target-query");
const retrievalToggle = $<HTMLInputElement>("tinyfish-enable");
const remoteConsent = $<HTMLInputElement>("remote-consent");
let retrievalAvailability: "inactive" | "approved-live" | "fixture" = "inactive";
let state = loadState(localStorage);
let filter = "actionable";
let token = "";
let mode: Report["mode"] = "public-live";
let running = false;
const sourceTab = Number(new URLSearchParams(location.search).get("tab"));
const isExtension = location.protocol === "chrome-extension:";
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function showError(message: string) {
  $("error").textContent = message;
  $("error").hidden = false;
}
function message(text: string) {
  $("status").textContent = text;
}
async function connect() {
  const response = await fetch(`${API}/api/session`, {
    // Chrome extension GETs can omit Origin; POST retains the browser-set Origin.
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok)
    throw new Error(
      "Local helper connection denied. Open http://127.0.0.1:4317 or reload the extension report.",
    );
  const data = (await response.json()) as {
    token: string;
    mode: Report["mode"];
    retrieval?: typeof retrievalAvailability;
  };
  token = data.token;
  mode = data.mode;
  retrievalAvailability = data.retrieval ?? "inactive";
  retrievalToggle.disabled = retrievalAvailability === "inactive";
  $("retrieval-availability").textContent = retrievalAvailability === "fixture"
    ? "Contract fixtures available — NO LIVE TINYFISH. Opt in to preview Search/Fetch evidence."
    : retrievalAvailability === "approved-live"
      ? "Approved-scope Search/Fetch ready. Runs only with both consent boxes. Agent/Browser off."
      : "Search/Fetch inactive: server-side key, free account access and scoped approval needed. Raw checks still work.";
  $("connection").textContent =
    mode === "fixture-demo"
      ? "Fixture demo · no live TinyFish"
      : retrievalAvailability === "approved-live" ? "Local helper · approved Search/Fetch on consent" : "Local helper connected · TinyFish inactive";
  $("demo-notice").hidden = mode !== "fixture-demo";
}
function chosenUrls() {
  const base = safeUrl(pageInput.value.trim());
  const routes = routesInput.value
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  return selectUrls([base, ...routes.map((x) => safeUrl(x, base))]);
}
function requireConsent() {
  if (!consent.checked)
    throw new Error(
      "Confirm these pages are public and you have permission before checking them.",
    );
}
async function capture(url: string): Promise<Metadata | undefined> {
  if (!isExtension || !sourceTab || !isPublicLookingHost(url)) return;
  try {
    const tab = await chrome.tabs.get(sourceTab);
    if (!tab.url || new URL(tab.url).search || safeUrl(tab.url) !== url) {
      $("local-dom").textContent =
        "Local DOM snapshot skipped: the tab changed or has a query string. Raw public HTTP checks still run.";
      return;
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: sourceTab },
      func: capturePublicMetadata,
    });
    if (!result?.result) {
      $("local-dom").textContent =
        "Local DOM snapshot skipped: query string or password field detected. Only credential-free public HTTP is used.";
      return;
    }
    $("local-dom").textContent =
      "A local DOM snapshot was read from the chosen tab. These observations stay on this device and were not sent to the helper.";
    return result.result as Metadata;
  } catch {
    $("local-dom").textContent =
      "Local DOM snapshot unavailable: click the extension again on this page to renew temporary access. Public raw HTTP checks still run.";
  }
}
function renderFinding(item: Check) {
  const card = node("article", undefined, "finding");
  const top = node("div", undefined, "finding-top");
  top.append(
    node(
      "span",
      {
        fail: "Confirmed",
        suggestion: "Review",
        unknown: "Unable to verify",
        pass: "Passed",
      }[item.verdict],
      `pill ${item.verdict}`,
    ),
    node(
      "span",
      `${item.severity} impact · ${item.confidence} confidence · ${item.source}`,
      "tiny",
    ),
  );
  card.append(
    top,
    node("h3", item.title),
    node("span", item.url, "url"),
    node("p", item.impact, "impact"),
  );
  const evidence = node("div", undefined, "evidence");
  evidence.append(
    node("strong", "OBSERVED EVIDENCE"),
    node("span", item.evidence),
  );
  card.append(evidence);
  const details = node("details");
  details.append(
    node(
      "summary",
      item.verdict === "unknown"
        ? "How to verify this"
        : "Repair guidance & acceptance test",
    ),
    node("p", item.repair),
    node("p", `Acceptance: ${item.acceptance}`),
  );
  card.append(details);
  if (item.verdict === "fail" || item.verdict === "suggestion") {
    const button = node("button", "Get targeted repair prompt", "secondary");
    button.addEventListener("click", () => showPrompt(item));
    card.append(button);
  }
  return card;
}
function renderChecks() {
  if (!state) return;
  const list = $("finding-list");
  list.replaceChildren();
  const sorted =
    filter === "pass" ? state.report.checks : findings(state.report);
  const visible = sorted.filter((x) =>
    filter === "actionable"
      ? x.verdict === "fail" || x.verdict === "suggestion"
      : x.verdict === filter,
  );
  if (!visible.length)
    list.append(
      node(
        "p",
        filter === "actionable"
          ? "No confirmed or review findings in this sample. Unknowns still need owner verification."
          : "No checks in this category.",
        "panel",
      ),
    );
  visible.forEach((x) => list.append(renderFinding(x)));
  document
    .querySelectorAll<HTMLButtonElement>("[data-filter]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.filter === filter)),
    );
}
function persist() {
  if (state)
    try {
      saveState(localStorage, state);
    } catch {
      message(
        "Report is visible, but browser storage is full. Export it before closing.",
      );
    }
}
function render() {
  if (!state) return;
  const report = state.report;
  $("empty").hidden = true;
  $("results").hidden = false;
  pageInput.value = report.urls[0];
  routesInput.value = report.urls.slice(1).join("\n");
  pageInput.disabled = true;
  routesInput.disabled = true;
  const sampleRetrieval = report.retrieval ?? state.baseline?.retrieval;
  targetQuery.value = sampleRetrieval?.queryKind === "target" ? sampleRetrieval.query : "";
  targetQuery.disabled = true;
  retrievalToggle.checked = !!report.retrieval;
  auditButton.hidden = true;
  $("new-audit").hidden = false;
  $("report-title").textContent = report.checks.some(
    (x) => x.verdict === "fail",
  )
    ? "These checks need attention"
    : "Review your launch sample";
  $("observed").textContent =
    `${report.urls.length} chosen URLs · ${new Date(report.createdAt).toLocaleString()} · ${report.mode === "fixture-demo" ? "fixture demo" : "fresh public HTTP sample"}`;
  for (const verdict of ["fail", "suggestion", "unknown", "pass"])
    $(`count-${verdict}`).textContent = String(
      report.checks.filter((x) => x.verdict === verdict).length,
    );
  $("recheck-results").hidden = !state.comparisons.length;
  const comparisonList = $("comparison-list");
  comparisonList.replaceChildren();
  for (const comparison of state.comparisons) {
    const row = node("div", undefined, "comparison-row");
    row.append(
      node(
        "span",
        comparison.status.replaceAll("-", " "),
        `pill ${comparison.status}`,
      ),
      node("strong", comparison.check.title),
      node("span", comparison.check.url, "url"),
      node("span", comparison.evidence, "tiny"),
    );
    comparisonList.append(row);
  }
  const coverage = $("coverage");
  coverage.replaceChildren();
  coverage.append(
    node(
      "p",
      `${report.requestCount}/${report.limits.requests} requests · at most ${report.limits.pages} pages · 15 internal links and 5 OG assets across the sample · 45 seconds · 1 MiB per HTML response · 3 same-origin redirects.`,
    ),
  );
  report.pages.forEach((p) =>
    coverage.append(
      node(
        "p",
        `${p.url} → ${p.error ?? `HTTP ${p.status}; final ${p.finalUrl}; ${p.redirects.length} redirects`}`,
      ),
    ),
  );
  coverage.append(
    node(
      "p",
      "Links and assets use HEAD response checks. Raw tags are parsed without executing scripts. A rendered snapshot is available only for the original tab when temporary access remains. Other route rendering, soft 404s, full mobile journeys, field performance, schema eligibility, owner analytics/indexing, and external citations are not verified.",
    ),
  );
  const retrieved = report.retrieval;
  $("retrieval-evidence").hidden = !retrieved;
  const detail = $("retrieval-detail");
  detail.replaceChildren();
  if (retrieved) {
    detail.append(node("p", retrieved.provider === "contract-fixture" ? "CONTRACT FIXTURE — NOT LIVE TINYFISH. These are synthetic provider responses." : retrieved.provider === "not-run" ? "Remote checks not run. Review the raw findings; no provider request was made." : "Live TinyFish Search and Fetch observations."));
    detail.append(node("p", `Query: ${retrieved.query} · US/en · ${new Date(retrieved.observedAt).toLocaleString()} · ${retrieved.searchRequests} Search attempt; ${retrieved.fetchUrls} Fetch URLs.`, "tiny"));
    detail.append(node("p", "Readable text and search visibility are separate observations. Result order is not Google ranking. No result in this sample does not prove non-indexing; word matches are a lexical clue, not semantic understanding.", "tiny"));
    detail.append(node("h3", "Returned search sample"));
    if (retrieved.search.error) detail.append(node("p", retrieved.search.error));
    if (!retrieved.search.hits.length) detail.append(node("p", "No retained results in this sample."));
    for (const hit of retrieved.search.hits) {
      const item=node("div", undefined, "evidence");
      item.append(node("strong", `${hit.position}. ${hit.title}`),node("span", hit.url, "url"),node("span",hit.snippet),node("span",hit.queryOmitted ? "Query removed: exact URL match unknown." : "", "tiny"));
      detail.append(item);
    }
    detail.append(node("h3", "What Fetch extracted"));
    for (const page of retrieved.pages) {
      const item=node("div",undefined,"evidence");
      item.append(node("strong",page.url),node("span",page.error ?? `${page.characters} inspected text characters · extracted title may prefer OG: ${page.title}`),node("span",page.excerpt ?? "No comparable excerpt."));
      detail.append(item);
    }
  }
  renderChecks();
}
async function run(recheck = false) {
  if (running) return;
  $("error").hidden = true;
  try {
    requireConsent();
    const urls = recheck && state ? state.report.urls : chosenUrls();
    const includeRetrieval = retrievalToggle.checked;
    if (includeRetrieval && !remoteConsent.checked) throw new Error("Confirm separate consent for Search/Fetch URLs and query before running remote analysis.");
    const sampleRetrieval = state?.report.retrieval ?? state?.baseline?.retrieval;
    const query = searchQuery(recheck && sampleRetrieval ? sampleRetrieval.query : targetQuery.value, urls[0]);
    running = true;
    auditButton.disabled = true;
    recheckButton.disabled = true;
    message(
      recheck
        ? "Rechecking the exact same URLs with fresh HTTP requests…"
        : "Checking public responses, policies, metadata, and bounded link samples…",
    );
    await connect();
    const local = await capture(urls[0]);
    // Never send local DOM observations. Helper fetches anonymous public content itself.
    const response = await fetch(`${API}/api/scan`, {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        "X-PublishProof-Token": token,
      },
      body: JSON.stringify({ urls, consent: true, ...(includeRetrieval ? {tinyfish:{enabled:true, query,remoteConsent:true}} : {}) }),
      signal: AbortSignal.timeout(includeRetrieval ? 95000 : 50000),
    });
    const data = (await response.json()) as { report?: Report; error?: string };
    if (!response.ok || !data.report)
      throw new Error(data.error ?? `Helper returned HTTP ${response.status}.`);
    const report = data.report;
    if (local) {
      const page = report.pages.find(
        (x) => x.url === urls[0] && x.metadata && x.finalUrl === urls[0],
      );
      if (page) report.checks.push(...renderedChecks(page, local));
    }
    const baseline =
      recheck && state ? (state.baseline ?? state.report) : undefined;
    state = {
      report,
      baseline,
      comparisons: baseline ? compareReports(baseline, report) : [],
    };
    persist();
    render();
    message(
      recheck
        ? "Recheck complete. Compare fixed, still failing, and unable to verify above."
        : "Sample complete. Start with confirmed findings, then review suggestions and unknowns.",
    );
    $("report-title").tabIndex = -1;
    $("report-title").focus();
  } catch (e) {
    showError(
      e instanceof TypeError
        ? "Unable to reach the local helper. Start npm run dev (or npm run demo for fixtures) and try again."
        : e instanceof DOMException && e.name === "TimeoutError"
          ? "The check timed out. The previous report is preserved; try a smaller sample."
          : e instanceof Error
            ? e.message
            : "Unable to check these pages.",
    );
    message(
      "No completed report was replaced. Review the error and try again.",
    );
  } finally {
    running = false;
    auditButton.disabled = false;
    recheckButton.disabled = false;
  }
}
function showPrompt(item?: Check) {
  if (!state) return;
  $<HTMLTextAreaElement>("prompt-text").value = repairPrompt(
    state.report,
    item,
  );
  $("copy-status").textContent = "";
  $<HTMLDialogElement>("prompt-dialog").showModal();
  $<HTMLTextAreaElement>("prompt-text").focus();
}
function download(format: "md" | "json") {
  if (!state) return;
  const content =
    format === "md"
      ? exportMarkdown(state.report, state.comparisons)
      : JSON.stringify(state, null, 2);
  const blob = new Blob([content], {
    type: format === "md" ? "text/markdown" : "application/json",
  });
  // Avoid extension-origin blob downloads: Chrome 154 crashed in installed-profile QA.
  // Reports contain bounded observations, not full HTML; data URLs also need no new permission.
  const url = isExtension
    ? `data:${format === "md" ? "text/markdown" : "application/json"};charset=utf-8,${encodeURIComponent(content)}`
    : URL.createObjectURL(blob);
  const link = node("a");
  link.href = url;
  link.download = `publishproof-${state.report.createdAt.slice(0, 10)}.${format}`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  if (!isExtension) setTimeout(() => URL.revokeObjectURL(url), 1000);
  message(`Exported ${format === "md" ? "report" : "evidence"} locally.`);
}
auditButton.addEventListener("click", () => void run());
recheckButton.addEventListener("click", () => void run(true));
$("copy-all").addEventListener("click", () => showPrompt());
$("export-md").addEventListener("click", () => download("md"));
$("export-json").addEventListener("click", () => download("json"));
$("close-prompt").addEventListener("click", () =>
  $<HTMLDialogElement>("prompt-dialog").close(),
);
$("copy-prompt").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      $<HTMLTextAreaElement>("prompt-text").value,
    );
    $("copy-status").textContent =
      "Copied. Review the changes before deploying.";
  } catch {
    $<HTMLTextAreaElement>("prompt-text").select();
    $("copy-status").textContent =
      "Clipboard unavailable. The prompt is selected; press Ctrl+C or Cmd+C.";
  }
});
$("new-audit").addEventListener("click", () => {
  pageInput.disabled = false;
  routesInput.disabled = false;
  targetQuery.disabled = false;
  auditButton.hidden = false;
  $("new-audit").hidden = true;
  consent.checked = false;
  remoteConsent.checked = false;
  message(
    "Choose a new public sample. The prior report stays saved until the next successful scan.",
  );
});
$("clear").addEventListener("click", () => {
  localStorage.removeItem("publishproof.report.v1");
  state = undefined;
  $("results").hidden = true;
  $("empty").hidden = false;
  pageInput.disabled = false;
  routesInput.disabled = false;
  targetQuery.disabled = false;
  targetQuery.value = "";
  retrievalToggle.checked = false;
  auditButton.hidden = false;
  $("new-audit").hidden = true;
  consent.checked = false;
  remoteConsent.checked = false;
  message("Saved report forgotten on this device.");
});
document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    filter = b.dataset.filter!;
    renderChecks();
  }),
);
$("discover").addEventListener("click", async () => {
  try {
    requireConsent();
    const url = safeUrl(pageInput.value.trim());
    const meta = await capture(url);
    if (!meta)
      throw new Error(
        "Local links unavailable. Type up to four same-origin routes instead.",
      );
    const box = $("suggested");
    box.replaceChildren(
      node("p", "Choose a route to add (up to four):", "tiny"),
    );
    box.hidden = false;
    meta.links
      .filter((x) => x !== url)
      .slice(0, 12)
      .forEach((link) => {
        const button = node("button", new URL(link).pathname, "secondary");
        button.addEventListener("click", () => {
          if (routesInput.disabled) {
            showError("Start a new sample before changing routes.");
            return;
          }
          const existing = routesInput.value.split(/\r?\n/).filter(Boolean);
          if (existing.length >= 4) {
            showError("Choose at most four additional routes.");
            return;
          }
          if (!existing.includes(link))
            routesInput.value = [...existing, link].join("\n");
        });
        box.append(button);
      });
  } catch (e) {
    showError(e instanceof Error ? e.message : "Unable to read public links.");
  }
});
async function initialize() {
  if (isExtension && sourceTab) {
    try {
      const tab = await chrome.tabs.get(sourceTab);
      if (tab.url) {
        const current = safeUrl(tab.url);
        if (!state || state.report.urls[0] !== current) {
          state = undefined;
          pageInput.value = current;
          message(
            "A new public page is selected. The prior saved sample is kept until a successful new scan.",
          );
        }
      }
      $("discover").hidden = false;
    } catch {
      message(
        "The original tab is unavailable. Enter its public URL to scan raw responses.",
      );
    }
  }
  if (state) render();
  try {
    await connect();
    if (mode === "fixture-demo" && !state) {
      pageInput.value = "https://launch.example/";
      routesInput.value = "/guide\n/pricing";
      targetQuery.value = "launch pricing";
    }
  } catch {
    $("connection").textContent = "Local helper unavailable";
    showError(
      "Start the local helper with npm run dev in the PublishProof folder, then click Check or Recheck to reconnect. For a safe fixture demo use npm run demo.",
    );
  }
}
void initialize();
