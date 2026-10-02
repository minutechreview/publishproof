"use strict";
(() => {
  // src/shared/urls.ts
  function safeUrl(input, base) {
    if (typeof input !== "string" || input.length > 2048)
      throw new Error("Use a URL shorter than 2,048 characters.");
    let url2;
    try {
      url2 = new URL(input, base);
    } catch {
      throw new Error(
        "Enter a valid public URL beginning with http:// or https://."
      );
    }
    if (!["http:", "https:"].includes(url2.protocol) || url2.username || url2.password)
      throw new Error("Only credential-free HTTP(S) pages are supported.");
    let path;
    try {
      path = decodeURIComponent(url2.pathname);
    } catch {
      throw new Error("Invalid URL encoding.");
    }
    if (/(?:^|\/)(?:login|logout|sign-?in|sign-?out|admin|dashboard|account|checkout|cart|auth|oauth|api|reset|verify|private)(?:\/|$)/i.test(
      path
    ) || /(?:token|secret|session|password|credential)[=/:_-]/i.test(path) || /[A-Za-z0-9_-]{40,}/.test(path) || /[\u0000-\u001f]/.test(path)) {
      throw new Error(
        "This path may be private or contain a token. Choose a public content page."
      );
    }
    url2.search = "";
    url2.hash = "";
    return url2.href;
  }

  // src/shared/score.ts
  var SCORE_VERSION = 1;
  var SCORE_ITEMS = [
    {
      key: "load",
      label: "Page opens",
      weight: 20,
      category: "visitors",
      rules: ["http"]
    },
    {
      key: "access",
      label: "Search access",
      weight: 20,
      category: "search",
      rules: ["noindex", "header-noindex", "robots"]
    },
    {
      key: "title",
      label: "Clear page title",
      weight: 10,
      category: "search",
      rules: ["title"]
    },
    {
      key: "description",
      label: "Consistent description",
      weight: 5,
      category: "search",
      rules: ["description"]
    },
    {
      key: "canonical",
      label: "Consistent preferred URL",
      weight: 10,
      category: "search",
      rules: ["canonical"]
    },
    {
      key: "links",
      label: "Sampled links work",
      weight: 10,
      category: "visitors",
      rules: ["internal-link"]
    },
    {
      key: "preview",
      label: "Existing share image works",
      weight: 5,
      category: "visitors",
      rules: ["og-asset"]
    },
    {
      key: "images",
      label: "Image text alternatives",
      weight: 10,
      category: "visitors",
      rules: ["alt"]
    },
    {
      key: "data",
      label: "Existing page data parses",
      weight: 5,
      category: "search",
      rules: ["jsonld"]
    },
    {
      key: "mobile",
      label: "Mobile sizing hint",
      weight: 5,
      category: "visitors",
      rules: ["viewport"]
    }
  ];
  function scoreReport(report) {
    const items = [];
    const totals = {
      search: { earned: 0, max: 0, known: 0 },
      visitors: { earned: 0, max: 0, known: 0 }
    };
    let earned = 0, known = 0, max = 0;
    for (const url2 of report.urls) {
      const page = report.pages.find((p) => p.url === url2);
      for (const rubric of SCORE_ITEMS) {
        const checks = report.checks.filter(
          (c) => c.url === url2 && rubric.rules.includes(c.rule.replace(/^rendered\./, ""))
        );
        let status;
        if (checks.some((c) => c.verdict === "fail")) status = "fail";
        else if (checks.some((c) => c.verdict === "unknown") || (report.scoreRequirements ?? []).some((id) => {
          try {
            const [rule, requiredUrl] = JSON.parse(id);
            return requiredUrl === url2 && rubric.rules.includes(String(rule).replace(/^rendered\./, "")) && !checks.some((c) => c.id === id);
          } catch {
            return true;
          }
        }))
          status = "unknown";
        else if (rubric.key === "links" || rubric.key === "preview") {
          const candidates = rubric.key === "links" ? [...new Set(report.pages.flatMap((p) => p.metadata?.links ?? []))].filter((target) => !report.urls.includes(target)).slice(0, 15) : [
            ...new Set(
              report.pages.flatMap((p) => p.metadata?.ogImages ?? [])
            )
          ].slice(0, 5);
          const expected = candidates.filter(
            (target) => (rubric.key === "links" ? page?.metadata?.links : page?.metadata?.ogImages)?.includes(target)
          );
          status = page?.metadata && expected.every(
            (target) => checks.some((c) => c.subject === target && c.verdict === "pass")
          ) ? "pass" : "unknown";
        } else if (rubric.rules.some((rule) => !checks.some((c) => c.rule === rule)))
          status = "unknown";
        else if (rubric.key === "mobile" && checks.some((c) => c.verdict === "suggestion"))
          status = "unknown";
        else status = "pass";
        items.push({
          url: url2,
          label: rubric.label,
          weight: rubric.weight,
          state: status
        });
        const total = totals[rubric.category];
        max += rubric.weight;
        total.max += rubric.weight;
        if (status !== "unknown") {
          known += rubric.weight;
          total.known += rubric.weight;
        }
        if (status === "pass") {
          earned += rubric.weight;
          total.earned += rubric.weight;
        }
      }
    }
    const hasReadablePage = report.pages.some(
      (p) => p.metadata && p.status && p.status >= 200 && p.status < 300
    );
    return {
      version: SCORE_VERSION,
      value: max && hasReadablePage ? Math.floor(100 * earned / max) : null,
      coverage: max ? Math.floor(100 * known / max) : 0,
      possible: max ? Math.floor(100 * (earned + max - known) / max) : 0,
      categories: {
        search: hasReadablePage && totals.search.max ? Math.floor(100 * totals.search.earned / totals.search.max) : null,
        visitors: hasReadablePage && totals.visitors.max ? Math.floor(100 * totals.visitors.earned / totals.visitors.max) : null
      },
      items
    };
  }
  function scoreChange(before, after) {
    const previous = scoreReport(before), current = scoreReport(after);
    const comparable = JSON.stringify(before.urls) === JSON.stringify(after.urls) && before.mode === after.mode;
    return {
      delta: comparable && previous.value !== null && current.value !== null ? current.value - previous.value : null,
      coverageLost: comparable && current.coverage < previous.coverage
    };
  }
  function scoreLabel(score) {
    if (score.value === null) return "We need a readable page first";
    if (score.coverage < 80) return "Some checks still need a closer look";
    return score.value >= 90 ? "Your page basics look good" : score.value >= 70 ? "A few improvements will help" : "Let\u2019s give this page some care";
  }
  function groupChecks(report) {
    const result = /* @__PURE__ */ new Map();
    for (const item of report.checks) {
      const key = JSON.stringify([
        item.rule.replace(/^rendered\./, ""),
        item.url,
        item.subject
      ]);
      result.set(key, [...result.get(key) ?? [], item]);
    }
    const order = { fail: 0, suggestion: 1, unknown: 2, pass: 3 };
    return [...result.values()].map((items) => items.sort((a, b) => order[a.verdict] - order[b.verdict])).sort(
      (a, b) => order[a[0].verdict] - order[b[0].verdict] || { high: 0, medium: 1, low: 2 }[a[0].severity] - { high: 0, medium: 1, low: 2 }[b[0].severity]
    );
  }

  // src/shared/report.ts
  function loadState(storage) {
    try {
      const parsed = JSON.parse(
        storage.getItem("publishproof.report.v1") ?? "null"
      );
      if (parsed?.report?.version === 1 && Array.isArray(parsed.report.urls) && Array.isArray(parsed.report.checks) && Array.isArray(parsed.report.pages) && Array.isArray(parsed.comparisons))
        return parsed;
    } catch {
    }
    return void 0;
  }
  function loadStateForPage(storage, url2) {
    const current = loadState(storage);
    if (current?.report.urls.length === 1 && current.report.urls[0] === url2)
      return current;
    try {
      const history = JSON.parse(
        storage.getItem("publishproof.reports.v2") ?? "[]"
      );
      if (Array.isArray(history))
        return history.find(
          (s) => s?.report?.version === 1 && s.report.urls?.length === 1 && s.report.urls[0] === url2 && Array.isArray(s.report.checks) && Array.isArray(s.report.pages) && Array.isArray(s.comparisons)
        );
    } catch {
    }
  }

  // src/extension/client.ts
  var isExtension = location.protocol === "chrome-extension:";
  var API = isExtension ? "http://127.0.0.1:4317" : location.origin;
  async function connectHelper() {
    const response = await fetch(`${API}/api/session`, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(4e3)
    });
    if (!response.ok)
      throw new Error(
        "The local helper couldn\u2019t connect. Reopen PublishProof after starting the helper."
      );
    return response.json();
  }

  // src/extension/jobs.ts
  var JOB_KEY = "publishproof.audit.job.v1";
  function readJob(storage) {
    try {
      const job = JSON.parse(storage.getItem(JOB_KEY) ?? "null");
      if (!job || !/^[a-f0-9]{32}$/.test(job.id) || safeUrl(job.url) !== job.url || job.publicConsent !== true || typeof job.remote !== "boolean" || typeof job.recheck !== "boolean" || typeof job.createdAt !== "number" || job.createdAt > Date.now() || Date.now() - job.createdAt > 5 * 60 * 1e3 || !["pending", "running", "complete", "error"].includes(job.status))
        return;
      return job;
    } catch {
      return;
    }
  }
  function writeJob(storage, job) {
    storage.setItem(JOB_KEY, JSON.stringify(job));
  }

  // src/extension/popup.ts
  var $ = (id) => document.getElementById(id);
  var url = "";
  var tab;
  var session;
  var reportState;
  var visibleJob = "";
  var audit = $("audit-page");
  function error(message) {
    $("popup-error").textContent = message;
    $("popup-error").hidden = false;
  }
  function render() {
    const job = readJob(localStorage), busy = job?.url === url && (job.status === "pending" || job.status === "running");
    $("popup-progress").hidden = !busy;
    $("popup-controls").hidden = !!busy || !!reportState;
    $("popup-result").hidden = !!busy || !reportState;
    $("popup-start").hidden = !!busy || !!reportState;
    if (job?.url === url && job.status === "error" && job.id !== visibleJob) {
      visibleJob = job.id;
      error(
        job.error ?? "This check couldn\u2019t finish. Your earlier report is still saved."
      );
    }
    if (!reportState) return;
    const score = scoreReport(reportState.report);
    $("popup-score").textContent = String(score.value ?? "\u2014");
    $("popup-orbit").style.setProperty("--value", String(score.value ?? 0));
    $("popup-heading").textContent = scoreLabel(score);
    $("popup-coverage").textContent = `${score.coverage}% of this checklist verified`;
    const counts = $("popup-counts");
    counts.replaceChildren();
    for (const [verdict, label] of [
      ["fail", "need a fix"],
      ["unknown", "not verified"],
      ["pass", "looking good"]
    ]) {
      const span = document.createElement("span");
      const count = groupChecks(reportState.report).filter(
        (items) => items[0].verdict === verdict
      ).length;
      span.textContent = `${count} ${label}`;
      counts.append(span);
    }
    $("popup-change").hidden = !reportState.baseline;
    if (reportState.baseline) {
      const change = scoreChange(reportState.baseline, reportState.report);
      $("popup-change").textContent = change.delta === null ? "Score comparison isn\u2019t available." : `${change.delta > 0 ? "+" : ""}${change.delta} verified points since your first check${change.coverageLost ? " \xB7 some checks not verified" : ""}`;
    }
    audit.textContent = "Check this page again \u21BB";
  }
  function refresh() {
    const current = loadStateForPage(localStorage, url);
    const job = readJob(localStorage);
    if (current && (!job || job.url !== url || job.status === "complete" || job.status === "error"))
      reportState = current;
    render();
  }
  async function start() {
    $("popup-error").hidden = true;
    try {
      if (!$("popup-consent").checked)
        throw new Error(
          "Confirm this page is public and you have permission to check it."
        );
      session = await connectHelper();
      const remote = $("popup-remote").checked;
      if (remote && session.scope && !session.scope.urls.includes(url))
        throw new Error(
          "The AI test session doesn\u2019t include this exact address. Turn off the AI check to audit this page\u2019s basics."
        );
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const id = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(
        ""
      );
      const job = {
        id,
        url,
        tab,
        createdAt: Date.now(),
        publicConsent: true,
        remote,
        recheck: !!reportState && reportState.report.retrieval?.queryKind !== "target",
        status: "pending"
      };
      writeJob(localStorage, job);
      render();
      const destination = isExtension ? chrome.runtime.getURL(`report.html?run=${id}&tab=${tab ?? ""}`) : `${API}/report.html?run=${id}`;
      if (isExtension) {
        const reportTab = await chrome.tabs.create({
          url: destination,
          active: false
        });
        const current = readJob(localStorage);
        if (current?.id === id)
          writeJob(localStorage, { ...current, reportTab: reportTab.id });
      } else if (session.mode === "fixture-demo")
        window.open(destination, "_blank");
      else
        throw new Error(
          "Open PublishProof from your Chrome toolbar to audit the current page."
        );
    } catch (e) {
      const job = readJob(localStorage);
      if (job?.url === url && job.status === "pending")
        writeJob(localStorage, {
          ...job,
          status: "error",
          error: e instanceof Error ? e.message : "Unable to start this check."
        });
      error(e instanceof Error ? e.message : "Unable to start this check.");
      render();
    }
  }
  audit.addEventListener("click", () => void start());
  $("popup-recheck").addEventListener("click", () => {
    $("popup-consent").checked = true;
    $("popup-remote").checked = !!reportState?.report.retrieval && session?.retrieval !== "inactive" && (!session?.scope || session.scope.urls.includes(url));
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
        }
      }
      await chrome.tabs.create({
        url: chrome.runtime.getURL(`report.html?tab=${tab ?? ""}`)
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
          currentWindow: true
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
        $("popup-note").textContent = "Sample demo \xB7 synthetic evidence, not live TinyFish.";
      }
      $("popup-site").textContent = new URL(url).hostname;
      reportState = loadStateForPage(localStorage, url);
      render();
      session ??= await connectHelper();
      const remoteAvailable = session.retrieval !== "inactive" && (!session.scope || session.scope.urls.includes(url));
      $("popup-remote-row").hidden = !remoteAvailable;
      if (session.scope && !session.scope.urls.includes(url)) {
        const approved = session.scope.urls.find(
          (allowed) => new URL(allowed).hostname.replace(/^www\./, "") === new URL(url).hostname.replace(/^www\./, "")
        );
        $("popup-note").textContent = approved ? `For the AI check, open ${approved} exactly. This address can still use page-basics checks.` : "This address can use page-basics checks. The approved AI session is limited to its exact URLs.";
      }
      if (session.retrieval === "fixture")
        $("popup-note").textContent = "Sample demo \xB7 synthetic evidence, not live TinyFish.";
      setInterval(refresh, 500);
    } catch (e) {
      audit.disabled = true;
      $("popup-help").hidden = false;
      error(
        e instanceof TypeError ? "Start the local helper once, then reopen this popup." : e instanceof Error ? e.message : "This page isn\u2019t available to check."
      );
    }
  }
  void initialize();
})();
//# sourceMappingURL=popup.js.map
