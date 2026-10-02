import { safeUrl } from "../shared/urls.js";
import { loadStateForPage, type SavedState } from "../shared/report.js";
import {
  scoreReport,
  scoreChange,
  scoreLabel,
  groupChecks,
} from "../shared/score.js";
import { connectHelper, isExtension, API, type Session } from "./client.js";
import { readJob, writeJob, type AuditJob } from "./jobs.js";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let url = "",
  tab: number | undefined,
  session: Session | undefined,
  reportState: SavedState | undefined;
let visibleJob = "";
const audit = $<HTMLButtonElement>("audit-page");
function error(message: string) {
  $("popup-error").textContent = message;
  $("popup-error").hidden = false;
}
function render() {
  const job = readJob(localStorage),
    busy =
      job?.url === url &&
      (job.status === "pending" || job.status === "running");
  $("popup-progress").hidden = !busy;
  $("popup-controls").hidden = !!busy || !!reportState;
  $("popup-result").hidden = !!busy || !reportState;
  $("popup-start").hidden = !!busy || !!reportState;
  if (job?.url === url && job.status === "error" && job.id !== visibleJob) {
    visibleJob = job.id;
    error(
      job.error ??
        "This check couldn’t finish. Your earlier report is still saved.",
    );
  }
  if (!reportState) return;
  const score = scoreReport(reportState.report);
  $("popup-score").textContent = String(score.value ?? "—");
  $("popup-orbit").style.setProperty("--value", String(score.value ?? 0));
  $("popup-heading").textContent = scoreLabel(score);
  $("popup-coverage").textContent =
    `${score.coverage}% of this checklist verified`;
  const counts = $("popup-counts");
  counts.replaceChildren();
  for (const [verdict, label] of [
    ["fail", "need a fix"],
    ["unknown", "not verified"],
    ["pass", "looking good"],
  ] as const) {
    const span = document.createElement("span");
    const count = groupChecks(reportState.report).filter(
      (items) => items[0].verdict === verdict,
    ).length;
    span.textContent = `${count} ${label}`;
    counts.append(span);
  }
  $("popup-change").hidden = !reportState.baseline;
  if (reportState.baseline) {
    const change = scoreChange(reportState.baseline, reportState.report);
    $("popup-change").textContent =
      change.delta === null
        ? "Score comparison isn’t available."
        : `${change.delta > 0 ? "+" : ""}${change.delta} verified points since your first check${change.coverageLost ? " · some checks not verified" : ""}`;
  }
  audit.textContent = "Check this page again ↻";
}
function refresh() {
  const current = loadStateForPage(localStorage, url);
  const job = readJob(localStorage);
  if (
    current &&
    (!job ||
      job.url !== url ||
      job.status === "complete" ||
      job.status === "error")
  )
    reportState = current;
  render();
}
async function start() {
  $("popup-error").hidden = true;
  try {
    if (!$<HTMLInputElement>("popup-consent").checked)
      throw new Error(
        "Confirm this page is public and you have permission to check it.",
      );
    session = await connectHelper();
    const remote = $<HTMLInputElement>("popup-remote").checked;
    if (remote && session.scope && !session.scope.urls.includes(url))
      throw new Error(
        "The AI test session doesn’t include this exact address. Turn off the AI check to audit this page’s basics.",
      );
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(
      "",
    );
    const job: AuditJob = {
      id,
      url,
      tab,
      createdAt: Date.now(),
      publicConsent: true,
      remote,
      recheck:
        !!reportState && reportState.report.retrieval?.queryKind !== "target",
      status: "pending",
    };
    writeJob(localStorage, job);
    render();
    const destination = isExtension
      ? chrome.runtime.getURL(`report.html?run=${id}&tab=${tab ?? ""}`)
      : `${API}/report.html?run=${id}`;
    if (isExtension) {
      const reportTab = await chrome.tabs.create({
        url: destination,
        active: false,
      });
      const current = readJob(localStorage);
      if (current?.id === id)
        writeJob(localStorage, { ...current, reportTab: reportTab.id });
    } else if (session.mode === "fixture-demo")
      window.open(destination, "_blank");
    else
      throw new Error(
        "Open PublishProof from your Chrome toolbar to audit the current page.",
      );
  } catch (e) {
    const job = readJob(localStorage);
    if (job?.url === url && job.status === "pending")
      writeJob(localStorage, {
        ...job,
        status: "error",
        error: e instanceof Error ? e.message : "Unable to start this check.",
      });
    error(e instanceof Error ? e.message : "Unable to start this check.");
    render();
  }
}
audit.addEventListener("click", () => void start());
$("popup-recheck").addEventListener("click", () => {
  $<HTMLInputElement>("popup-consent").checked = true;
  $<HTMLInputElement>("popup-remote").checked =
    !!reportState?.report.retrieval &&
    session?.retrieval !== "inactive" &&
    (!session?.scope || session.scope.urls.includes(url));
  void start();
});
$("view-report").addEventListener("click", async () => {
  const job = readJob(localStorage);
  if (isExtension) {
    if (job?.url === url && job.reportTab) {
      try {
        await chrome.tabs.update(job.reportTab, { active: true });
        window.close();
        return;
      } catch {
        /* Reopen a closed report. */
      }
    }
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`report.html?tab=${tab ?? ""}`),
    });
    window.close();
  } else window.open(`${API}/report.html`, "_blank");
});
window.addEventListener("storage", refresh);
async function initialize() {
  try {
    if (isExtension) {
      const [current] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!current?.id || !current.url)
        throw new Error("Open a public website, then click PublishProof.");
      url = safeUrl(current.url);
      tab = current.id;
    } else {
      session = await connectHelper();
      if (session.mode !== "fixture-demo")
        throw new Error("Open this extension from the Chrome toolbar.");
      url = "https://launch.example/";
      $("popup-note").textContent =
        "Sample demo · synthetic evidence, not live TinyFish.";
    }
    $("popup-site").textContent = new URL(url).hostname;
    reportState = loadStateForPage(localStorage, url);
    render();
    session ??= await connectHelper();
    const remoteAvailable =
      session.retrieval !== "inactive" &&
      (!session.scope || session.scope.urls.includes(url));
    $("popup-remote-row").hidden = !remoteAvailable;
    if (session.scope && !session.scope.urls.includes(url)) {
      const approved = session.scope.urls.find(
        (allowed) =>
          new URL(allowed).hostname.replace(/^www\./, "") ===
          new URL(url).hostname.replace(/^www\./, ""),
      );
      $("popup-note").textContent = approved
        ? `For the AI check, open ${approved} exactly. This address can still use page-basics checks.`
        : "This address can use page-basics checks. The approved AI session is limited to its exact URLs.";
    }
    if (session.retrieval === "fixture")
      $("popup-note").textContent =
        "Sample demo · synthetic evidence, not live TinyFish.";
    setInterval(refresh, 500);
  } catch (e) {
    audit.disabled = true;
    $("popup-help").hidden = false;
    error(
      e instanceof TypeError
        ? "Start the local helper once, then reopen this popup."
        : e instanceof Error
          ? e.message
          : "This page isn’t available to check.",
    );
  }
}
void initialize();
