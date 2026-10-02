import type { Check, Metadata, Report } from "../shared/model.js";
import { findings, renderedChecks } from "../shared/rules.js";
import {
  compareReports,
  exportMarkdown,
  loadState,
  loadStateForPage,
  repairPrompt,
  saveState,
  type SavedState,
} from "../shared/report.js";
import {
  scoreReport,
  scoreChange,
  scoreLabel,
  plainCheck,
  scoreRequirements,
  groupChecks,
} from "../shared/score.js";
import { isPublicLookingHost, safeUrl, selectUrls } from "../shared/urls.js";
import { capturePublicMetadata } from "./capture.js";
import { searchQuery } from "../shared/retrieval.js";
import {
  connectHelper,
  requestScan,
  isExtension,
  type Session,
} from "./client.js";
import { readJob, writeJob } from "./jobs.js";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const pageInput = $<HTMLInputElement>("page-url"),
  routesInput = $<HTMLTextAreaElement>("routes"),
  consent = $<HTMLInputElement>("consent"),
  auditButton = $<HTMLButtonElement>("audit"),
  recheckButton = $<HTMLButtonElement>("recheck"),
  targetQuery = $<HTMLInputElement>("target-query"),
  retrievalToggle = $<HTMLInputElement>("tinyfish-enable"),
  remoteConsent = $<HTMLInputElement>("remote-consent");
let state = loadState(localStorage),
  filter = "fail",
  running = false,
  session: Session | undefined;
const parameters = new URLSearchParams(location.search);
const sourceTab = Number(parameters.get("tab"));
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
function showError(text: string) {
  $("error").textContent = text;
  $("error").hidden = false;
}
function message(text: string) {
  $("status").textContent = text;
}
async function connect() {
  session = await connectHelper();
  retrievalToggle.disabled = session.retrieval === "inactive";
  $("retrieval-availability").textContent =
    session.retrieval === "fixture"
      ? "Demo only: synthetic Search & Fetch, not live TinyFish."
      : session.retrieval === "approved-live"
        ? "Checks search visibility and readable text with TinyFish."
        : "AI checks aren’t connected. Your page basics still work.";
  $("connection").textContent =
    session.mode === "fixture-demo"
      ? "Sample demo"
      : session.retrieval === "approved-live"
        ? "Ready · AI check available"
        : "Ready · page basics";
  $("demo-notice").hidden = session.mode !== "fixture-demo";
}
function chosenUrls() {
  const base = safeUrl(pageInput.value.trim());
  return selectUrls([
    base,
    ...routesInput.value
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => safeUrl(x, base)),
  ]);
}
async function capture(url: string): Promise<Metadata | undefined> {
  if (!isExtension || !sourceTab || !isPublicLookingHost(url)) return;
  try {
    const tab = await chrome.tabs.get(sourceTab);
    if (!tab.url || new URL(tab.url).search || safeUrl(tab.url) !== url) {
      $("local-dom").textContent =
        "Browser comparison skipped: the original tab changed or has URL parameters. Public HTTP checks still ran.";
      return;
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: sourceTab },
      func: capturePublicMetadata,
    });
    if (!result?.result) {
      $("local-dom").textContent =
        "Browser comparison skipped: URL parameters or a password field were detected.";
      return;
    }
    $("local-dom").textContent =
      "Current-tab metadata was compared only on this device. No local page content was sent to the helper or TinyFish.";
    return result.result as Metadata;
  } catch {
    $("local-dom").textContent =
      "Browser comparison unavailable. Click the extension on the public page again to renew access. Public HTTP checks still ran.";
  }
}
function technicalFinding(items: Check[]) {
  const section = node("div", undefined, "technical-finding");
  for (const item of items) {
    section.append(
      node("h3", item.title),
      node(
        "p",
        `${item.verdict} · ${item.severity} impact · ${item.confidence} confidence · ${item.source}`,
        "tiny",
      ),
      node("span", item.url, "url"),
      node("p", item.evidence, "evidence-text"),
      node("p", item.repair),
      node("p", `Acceptance: ${item.acceptance}`, "tiny"),
    );
  }
  return section;
}
function renderFinding(items: Check[]) {
  const item = items[0],
    copy = plainCheck(item),
    card = node("article", undefined, "finding");
  const top = node("div", undefined, "finding-top");
  top.append(
    node(
      "span",
      {
        fail: "Needs a fix",
        suggestion: "Worth a review",
        unknown: "Not verified",
        pass: "Looking good",
      }[item.verdict],
      `pill ${item.verdict}`,
    ),
    node(
      "span",
      item.verdict === "fail" && item.severity === "high" ? "Start here" : "",
      "tiny",
    ),
  );
  card.append(
    top,
    node("h3", copy.title),
    node("p", copy.why, "impact"),
    node("span", item.url, "url"),
  );
  const details = node("details", undefined, "finding-detail");
  details.append(
    node(
      "summary",
      item.verdict === "unknown"
        ? "How to check this"
        : "Why we say this & how to fix it",
    ),
    technicalFinding(items),
  );
  card.append(details);
  if (item.verdict === "fail" || item.verdict === "suggestion") {
    const button = node("button", "Get a prompt for this fix ↗", "text-button");
    button.addEventListener("click", () => showPrompt(item));
    card.append(button);
  }
  return card;
}
function renderChecks() {
  if (!state) return;
  const list = $("finding-list");
  list.replaceChildren();
  const visible = groupChecks(state.report).filter(
    (items) => items[0].verdict === filter,
  );
  if (!visible.length) {
    const empty = node("div", undefined, "category-empty");
    empty.append(
      node("span", filter === "fail" ? "✓" : "—", "simple-icon"),
      node(
        "h3",
        filter === "fail"
          ? "No confirmed fix in this sample."
          : "Nothing in this category.",
      ),
      node(
        "p",
        filter === "fail"
          ? "That’s a good start. Take a look at the reviews and unverified items before calling your launch complete."
          : "Choose another category to see the rest of your report.",
      ),
    );
    list.append(empty);
  }
  visible.forEach((items) => list.append(renderFinding(items)));
  document
    .querySelectorAll<HTMLButtonElement>("[data-filter]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.filter === filter)),
    );
}
function selectTab(which: "overview" | "technical", focus = false) {
  for (const id of ["overview", "technical"]) {
    const button = $<HTMLButtonElement>(`${id}-tab`);
    button.setAttribute("aria-selected", String(id === which));
    button.tabIndex = id === which ? 0 : -1;
    $(`${id}-panel`).hidden = id !== which;
    if (focus && id === which) button.focus();
  }
}
function showTechnical(id?: string) {
  selectTab("technical");
  if (id) {
    const details = $<HTMLDetailsElement>(id);
    details.open = true;
    details.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
}
function persist() {
  if (state)
    try {
      saveState(localStorage, state);
    } catch {
      message(
        "Your report is ready. Device storage is full, so export it before closing.",
      );
    }
}
function render() {
  if (!state) return;
  const report = state.report,
    score = scoreReport(report),
    grouped = groupChecks(report);
  document.body.dataset.view = "report";
  $("intro").hidden = true;
  $("empty").hidden = true;
  $("results").hidden = false;
  $("setup-options").hidden = true;
  pageInput.value = report.urls[0];
  routesInput.value = report.urls.slice(1).join("\n");
  pageInput.disabled = true;
  routesInput.disabled = true;
  targetQuery.disabled = true;
  const retrieval = report.retrieval ?? state.baseline?.retrieval;
  targetQuery.value = retrieval?.queryKind === "target" ? retrieval.query : "";
  retrievalToggle.checked = !!report.retrieval;
  auditButton.hidden = true;
  $("new-audit").hidden = false;
  $("report-title").textContent = scoreLabel(score);
  $("observed").textContent =
    `${report.urls.length === 1 ? new URL(report.urls[0]).hostname : `${report.urls.length} chosen pages`} · Checked ${new Date(report.createdAt).toLocaleString()}${report.mode === "fixture-demo" ? " · Sample demo" : ""}`;
  $("health-score").textContent = String(score.value ?? "—");
  $("score-orbit").style.setProperty("--value", String(score.value ?? 0));
  $("score-orbit").dataset.level =
    score.value !== null && score.value >= 80 ? "good" : "care";
  $("health-label").textContent =
    score.value === null
      ? "We couldn’t give this page a reliable score."
      : score.value >= 90
        ? "A good foundation to build on."
        : score.value >= 70
          ? "You’re on the right track."
          : "A few basics need your attention.";
  $("score-coverage").textContent =
    score.coverage === 100
      ? "All scored basics have a known result."
      : `${score.coverage}% of the checklist verified. Some checks need a closer look.`;
  $("search-score").textContent =
    score.categories.search === null
      ? "Not verified"
      : `${score.categories.search}/100`;
  $("visitor-score").textContent =
    score.categories.visitors === null
      ? "Not verified"
      : `${score.categories.visitors}/100`;
  $("score-change").hidden = !state.baseline;
  if (state.baseline) {
    const change = scoreChange(state.baseline, report);
    const previous = scoreReport(state.baseline);
    $("score-change").textContent =
      change.delta === null
        ? "The score cannot be compared with this earlier sample."
        : `${previous.value} → ${score.value} · ${change.delta > 0 ? "+" : ""}${change.delta} verified points${change.coverageLost ? ". Some checks are unavailable." : "."}`;
  }
  for (const verdict of ["fail", "suggestion", "unknown", "pass"]) {
    const count = grouped.filter(
      (items) => items[0].verdict === verdict,
    ).length;
    $(`count-${verdict}`).textContent = String(count);
    document
      .querySelector(`[data-filter="${verdict}"]`)
      ?.setAttribute(
        "aria-label",
        `${{ fail: "Needs a fix", suggestion: "Worth a review", unknown: "Not verified", pass: "Looking good" }[verdict]} (${count})`,
      );
  }
  const needsFix = grouped.some((items) => items[0].verdict === "fail"),
    hasReview = grouped.some((items) => items[0].verdict === "suggestion");
  $("next-title").textContent = needsFix
    ? "Small fixes. Real progress."
    : hasReview
      ? "A little review goes a long way."
      : "Keep the good foundation.";
  $("next-description").textContent = needsFix
    ? "Your coding agent can handle the details. This prompt includes the exact problems and checks to run."
    : hasReview
      ? "Some suggestions depend on your goals. Your prompt asks the coding agent to review intent before changing anything."
      : "No repair is requested. Copy a review prompt for the unknowns, or check again after your next update.";
  $("copy-all").textContent = needsFix
    ? "Get my fix prompt →"
    : "Get my review prompt →";
  $("recheck-results").hidden = !state.comparisons.length;
  const comparisonList = $("comparison-list");
  comparisonList.replaceChildren();
  const counts = { fixed: 0, "still-failing": 0, "unable-to-verify": 0 };
  for (const comparison of state.comparisons) {
    counts[comparison.status]++;
    const row = node("div", undefined, "comparison-row");
    row.append(
      node(
        "span",
        {
          fixed: "Fixed",
          "still-failing": "Still needs attention",
          "unable-to-verify": "Not verified",
        }[comparison.status],
        `pill ${comparison.status}`,
      ),
      node("div", plainCheck(comparison.check).title),
      node("span", comparison.check.url, "url"),
    );
    comparisonList.append(row);
  }
  $("recheck-summary").textContent =
    `${counts.fixed} checks now pass · ${counts["still-failing"]} still need attention · ${counts["unable-to-verify"]} couldn’t be verified. A fix means fresh passing evidence, not just a missing finding.`;
  const methodology = $("score-method-detail");
  methodology.replaceChildren(
    node(
      "p",
      "A fixed 100-point checklist per chosen page. Only verified passing criteria earn points. A failed or unverified criterion earns none; missing evidence cannot make the score better. More verified points can also come from new coverage, without a website repair.",
    ),
    node(
      "p",
      "Raw response and available local browser checks share the same criteria, without extra points. If a previous browser check is unavailable on recheck, that criterion stays unverified. Optional descriptions, preferred URLs and structured data are not requirements to add. Intent-dependent review suggestions do not lose points. Missing mobile sizing is left unverified rather than called broken. Analytics, rankings and TinyFish search positions do not enter this score.",
    ),
  );
  const table = node("table");
  const header = node("tr");
  for (const text of ["Page", "Check", "Points", "Result"])
    header.append(node("th", text));
  const thead = node("thead");
  thead.append(header);
  table.append(thead);
  const tbody = node("tbody");
  for (const item of score.items) {
    const row = node("tr");
    for (const text of [
      new URL(item.url).pathname,
      item.label,
      String(item.weight),
      item.state,
    ])
      row.append(node("td", text));
    tbody.append(row);
  }
  table.append(tbody);
  methodology.append(table);
  const technical = $("technical-findings");
  technical.replaceChildren(...grouped.map(technicalFinding));
  const coverage = $("coverage");
  coverage.replaceChildren(
    node(
      "p",
      `${report.requestCount}/${report.limits.requests} public HTTP requests · ${report.urls.length} chosen URLs · max ${report.limits.seconds}s · max 1 MiB per HTML response. At most 15 internal links and 5 existing share images are probed.`,
    ),
  );
  for (const p of report.pages)
    coverage.append(
      node(
        "p",
        `${p.url} → ${p.error ?? `HTTP ${p.status}; final ${p.finalUrl}; ${p.redirects.length} redirects`}`,
      ),
    );
  coverage.append(
    node(
      "p",
      "Response checks don’t prove image pixels, social preview appearance, full navigation, soft 404 behavior or phone usability. Local rendered metadata covers only the original tab. Browser data, cookies and local page contents are never uploaded.",
    ),
  );
  renderRetrieval(report);
  renderChecks();
}
function renderRetrieval(report: Report) {
  const retrieval = report.retrieval;
  $("retrieval-evidence").hidden = !retrieval;
  $("ai-summary").hidden = !retrieval;
  const detail = $("retrieval-detail");
  detail.replaceChildren();
  if (!retrieval) return;
  const provenance =
    retrieval.provider === "contract-fixture"
      ? "CONTRACT FIXTURE — NOT LIVE TINYFISH"
      : retrieval.provider === "not-run"
        ? "Remote check not run"
        : "Live TinyFish";
  $("ai-provenance").textContent = provenance;
  const readable = retrieval.pages.filter(
    (p) => !p.error && !!p.characters,
  ).length;
  $("ai-summary-text").textContent =
    `${readable} of ${report.urls.length} pages returned readable text. ${retrieval.search.error ? "Search visibility is not verified." : "The search result sample is available."} Readability and visibility are separate observations; neither guarantees rankings.`;
  detail.append(
    node("p", provenance),
    node(
      "p",
      `Query: ${retrieval.query} · US/en · ${new Date(retrieval.observedAt).toLocaleString()} · ${retrieval.searchRequests} Search attempts; ${retrieval.fetchUrls} Fetch URLs.`,
      "tiny",
    ),
    node(
      "p",
      "Search positions belong to this TinyFish sample, not Google rankings. Fetch returns cleaned text, not exact raw HTML. A missing result does not prove non-indexing.",
    ),
    node("h3", "Returned search sample"),
  );
  if (retrieval.search.error) detail.append(node("p", retrieval.search.error));
  for (const hit of retrieval.search.hits) {
    const item = node("div", undefined, "evidence");
    item.append(
      node("strong", `${hit.position}. ${hit.title}`),
      node("span", hit.url, "url"),
      node("p", hit.snippet),
      node(
        "p",
        hit.queryOmitted
          ? "URL parameters removed; exact URL match remains unknown."
          : "",
        "tiny",
      ),
    );
    detail.append(item);
  }
  detail.append(node("h3", "What Fetch extracted"));
  for (const page of retrieval.pages) {
    const item = node("div", undefined, "evidence");
    item.append(
      node("strong", page.url),
      node(
        "p",
        page.error ??
          `${page.characters} inspected characters · extracted title may prefer OG: ${page.title}`,
      ),
      node("p", page.excerpt ?? "No comparable excerpt."),
    );
    detail.append(item);
  }
}
async function run(recheck = false): Promise<boolean> {
  if (running) return false;
  $("error").hidden = true;
  try {
    if (!consent.checked)
      throw new Error(
        "Please confirm this page is public and you have permission to check it.",
      );
    const urls = recheck && state ? state.report.urls : chosenUrls(),
      remote = retrievalToggle.checked;
    if (remote && !remoteConsent.checked)
      throw new Error(
        "Please agree to send only the selected public URLs and search words to TinyFish.",
      );
    const prior = state?.report.retrieval ?? state?.baseline?.retrieval;
    const query = searchQuery(
      recheck && prior ? prior.query : targetQuery.value,
      urls[0],
    );
    running = true;
    auditButton.disabled = true;
    recheckButton.disabled = true;
    $("running-panel").hidden = false;
    $("empty").hidden = true;
    message(
      recheck
        ? "Checking the same pages again…"
        : "Checking the page you chose…",
    );
    await connect();
    const local = await capture(urls[0]);
    const report = await requestScan(session!, urls, query, remote);
    if (local) {
      const page = report.pages.find(
        (p) => p.url === urls[0] && p.metadata && p.finalUrl === urls[0],
      );
      if (page) report.checks.push(...renderedChecks(page, local));
    }
    // A repeat of a saved single-page sample is a real recheck, even after reopening the app.
    const baseline =
      recheck && state ? (state.baseline ?? state.report) : undefined;
    if (baseline)
      report.scoreRequirements = scoreRequirements(baseline, state!.report);
    state = {
      report,
      baseline,
      comparisons: baseline ? compareReports(baseline, report) : [],
    };
    persist();
    filter = report.checks.some((c) => c.verdict === "fail")
      ? "fail"
      : report.checks.some((c) => c.verdict === "suggestion")
        ? "suggestion"
        : "pass";
    render();
    message(
      recheck
        ? "Fresh check complete. Here’s what changed."
        : "Your report is ready.",
    );
    $("report-title").tabIndex = -1;
    $("report-title").focus({ preventScroll: true });
    window.scrollTo(0, 0);
    return true;
  } catch (error) {
    showError(
      error instanceof TypeError
        ? "The local helper isn’t reachable. Start it in Terminal, then reconnect. Your previous report is still saved."
        : error instanceof DOMException && error.name === "TimeoutError"
          ? "The check took too long. Your previous report is still saved; no improvement was assumed."
          : error instanceof Error
            ? error.message
            : "This page couldn’t be checked.",
    );
    message("No previous report was replaced.");
    return false;
  } finally {
    running = false;
    auditButton.disabled = false;
    recheckButton.disabled = false;
    $("running-panel").hidden = true;
    if (!state) $("empty").hidden = false;
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
  $("copy-prompt").focus();
}
function download(format: "md" | "json") {
  if (!state) return;
  const content =
    format === "md"
      ? exportMarkdown(state.report, state.comparisons)
      : JSON.stringify({ ...state, score: scoreReport(state.report) }, null, 2);
  const url = isExtension
    ? `data:${format === "md" ? "text/markdown" : "application/json"};charset=utf-8,${encodeURIComponent(content)}`
    : URL.createObjectURL(
        new Blob([content], {
          type: format === "md" ? "text/markdown" : "application/json",
        }),
      );
  const link = node("a");
  link.href = url;
  link.download = `publishproof-${state.report.createdAt.slice(0, 10)}.${format}`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  if (!isExtension) setTimeout(() => URL.revokeObjectURL(url), 1000);
  message("Report exported to your device.");
}
$("audit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const urls = chosenUrls();
    const previous = loadStateForPage(localStorage, urls[0]);
    const comparable =
      previous &&
      JSON.stringify(previous.report.urls) === JSON.stringify(urls) &&
      searchQuery(previous.report.retrieval?.query ?? "", urls[0]) ===
        searchQuery(targetQuery.value, urls[0]);
    if (comparable) state = previous;
    void run(!!comparable);
  } catch (e) {
    showError(e instanceof Error ? e.message : "Enter a public page address.");
  }
});
function safeInput() {
  try {
    return safeUrl(pageInput.value);
  } catch {
    return "";
  }
}
recheckButton.addEventListener("click", () => {
  consent.checked = true;
  remoteConsent.checked = retrievalToggle.checked;
  void run(true);
});
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
      "Copied. Paste it into your coding agent, then review the changes.";
  } catch {
    const details =
      document.querySelector<HTMLDetailsElement>(".prompt-details")!;
    details.open = true;
    $<HTMLTextAreaElement>("prompt-text").select();
    $("copy-status").textContent =
      "Select the prompt and press Cmd+C or Ctrl+C.";
  }
});
retrievalToggle.addEventListener("change", () => {
  $("remote-consent-row").hidden = !retrievalToggle.checked;
  if (!retrievalToggle.checked) remoteConsent.checked = false;
});
$("new-audit").addEventListener("click", () => {
  document.body.dataset.view = "setup";
  pageInput.disabled = false;
  routesInput.disabled = false;
  routesInput.value = "";
  targetQuery.disabled = false;
  targetQuery.value = "";
  auditButton.hidden = false;
  $("new-audit").hidden = true;
  $("setup-options").hidden = false;
  consent.checked = false;
  remoteConsent.checked = false;
  pageInput.focus();
  message("Choose another public page. Your previous report stays saved.");
});
$("clear").addEventListener("click", () => {
  const forgotten = state?.report.urls;
  localStorage.removeItem("publishproof.report.v1");
  try {
    const history = JSON.parse(
      localStorage.getItem("publishproof.reports.v2") ?? "[]",
    );
    localStorage.setItem(
      "publishproof.reports.v2",
      JSON.stringify(
        history.filter(
          (s: SavedState) =>
            JSON.stringify(s.report.urls) !== JSON.stringify(forgotten),
        ),
      ),
    );
  } catch {
    localStorage.removeItem("publishproof.reports.v2");
  }
  state = undefined;
  document.body.dataset.view = "setup";
  $("results").hidden = true;
  $("intro").hidden = false;
  $("empty").hidden = false;
  $("setup-options").hidden = false;
  pageInput.disabled = false;
  routesInput.disabled = false;
  targetQuery.disabled = false;
  auditButton.hidden = false;
  $("new-audit").hidden = true;
  consent.checked = false;
  remoteConsent.checked = false;
  message("This saved report was forgotten on this device.");
});
for (const id of ["overview", "technical"]) {
  $(`${id}-tab`).addEventListener("click", () =>
    selectTab(id as "overview" | "technical"),
  );
  $(`${id}-tab`).addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      selectTab(
        event.key === "Home"
          ? "overview"
          : event.key === "End"
            ? "technical"
            : id === "overview"
              ? "technical"
              : "overview",
        true,
      );
    }
  });
}
$("score-explainer").addEventListener("click", () =>
  showTechnical("score-method"),
);
$("ai-details").addEventListener("click", () =>
  showTechnical("retrieval-evidence"),
);
document
  .querySelectorAll<HTMLButtonElement>("[data-filter]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter!;
      renderChecks();
    }),
  );
$("discover").addEventListener("click", async () => {
  try {
    if (!consent.checked)
      throw new Error(
        "Confirm this is a public page before reading its links.",
      );
    const meta = await capture(safeUrl(pageInput.value));
    if (!meta)
      throw new Error(
        "We couldn’t read links in this tab. You can type other page paths above.",
      );
    const box = $("suggested");
    box.replaceChildren();
    box.hidden = false;
    for (const link of meta.links
      .filter((x) => x !== safeInput())
      .slice(0, 12)) {
      const button = node("button", new URL(link).pathname, "secondary");
      button.type = "button";
      button.addEventListener("click", () => {
        const existing = routesInput.value.split(/\r?\n/).filter(Boolean);
        if (existing.length >= 4) {
          showError("Choose up to four other pages.");
          return;
        }
        if (!existing.includes(link))
          routesInput.value = [...existing, link].join("\n");
      });
      box.append(button);
    }
  } catch (e) {
    showError(e instanceof Error ? e.message : "Links couldn’t be read.");
  }
});
async function initialize() {
  const job = readJob(localStorage),
    requested = parameters.get("run");
  if (
    job &&
    requested === job.id &&
    job.status === "pending" &&
    Date.now() - job.createdAt < 30000
  ) {
    if (isExtension && job.tab !== sourceTab) {
      showError(
        "This audit’s original tab doesn’t match. Open the extension on the page again.",
      );
      return;
    }
    writeJob(localStorage, { ...job, status: "running" });
    state = job.recheck ? loadStateForPage(localStorage, job.url) : undefined;
    pageInput.value = job.url;
    routesInput.value = "";
    targetQuery.value = "";
    consent.checked = true;
    retrievalToggle.checked = job.remote;
    remoteConsent.checked = job.remote;
    if (state) render();
    retrievalToggle.checked = job.remote;
    const success = await run(!!state);
    const current = readJob(localStorage);
    if (current?.id === job.id)
      writeJob(localStorage, {
        ...current,
        status: success ? "complete" : "error",
        reportId: success ? state?.report.id : undefined,
        error: success
          ? undefined
          : ($("error").textContent ?? "The page check didn’t finish."),
      });
    return;
  }
  if (isExtension && sourceTab) {
    try {
      const tab = await chrome.tabs.get(sourceTab);
      if (tab.url) {
        const current = safeUrl(tab.url);
        state = loadStateForPage(localStorage, current);
        pageInput.value = current;
      }
      $("discover").hidden = false;
    } catch {
      message(
        "The original tab isn’t available. You can enter its public address.",
      );
    }
  }
  if (state) render();
  try {
    await connect();
    if (session?.mode === "fixture-demo" && !state) {
      pageInput.value = "https://launch.example/";
      routesInput.value = "";
      targetQuery.value = "";
    }
  } catch {
    $("connection").textContent = "Helper not connected";
    showError(
      "This local prototype needs its helper running. Start npm run dev in Terminal, then audit your page. For a sample demo, use npm run demo.",
    );
  }
}
void initialize();
