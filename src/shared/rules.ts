import { safeUrl } from "./urls.js";
import type {
  Check,
  Metadata,
  PageResult,
  Report,
  Verdict,
  Severity,
} from "./model.js";
export function check(
  rule: string,
  url: string,
  verdict: Verdict,
  title: string,
  evidence: string,
  impact: string,
  repair: string,
  acceptance: string,
  source: Check["source"] = "raw-html",
  severity: Severity = "medium",
  subject = "page",
): Check {
  return {
    id: JSON.stringify([rule, url, subject]),
    rule,
    url,
    subject,
    verdict,
    title,
    evidence,
    impact,
    repair,
    acceptance,
    source,
    severity,
    confidence: verdict === "suggestion" ? "medium" : "high",
  };
}
export function metadataChecks(
  url: string,
  meta: Metadata,
  source: "raw-html" | "rendered-dom" = "raw-html",
): Check[] {
  const prefix = source === "rendered-dom" ? "rendered." : "";
  const emit = (
    rule: string,
    verdict: Verdict,
    title: string,
    evidence: string,
    impact: string,
    repair: string,
    acceptance: string,
    severity: Severity = "medium",
  ) =>
    check(
      prefix + rule,
      url,
      verdict,
      title,
      evidence,
      impact,
      repair,
      acceptance,
      source,
      severity,
    );
  const noindex = meta.robots.some((x) =>
    /(?:^|[\s,:])(?:noindex|none)(?:$|[\s,])/i.test(x),
  );
  const canonicalValues = [...new Set(meta.canonicals)];
  return [
    emit(
      "title",
      meta.titles.filter((x) => x.trim()).length === 1 &&
        meta.titles.length === 1
        ? "pass"
        : "fail",
      "Page title needs one clear value",
      JSON.stringify(meta.titles),
      "The page title helps people and search engines identify this page.",
      "Set exactly one descriptive title for this route. Preserve the brand and page purpose.",
      "Fresh page has exactly one nonempty <title>.",
    ),
    emit(
      "description",
      meta.descriptions.length === 1 && !!meta.descriptions[0].trim()
        ? "pass"
        : meta.descriptions.length > 1
          ? "fail"
          : "suggestion",
      "Review the search description",
      JSON.stringify(meta.descriptions),
      "A description can influence search snippets; search engines may choose other text.",
      "If useful for this page, add one truthful route-specific description.",
      "At most one description; any supplied value accurately describes this page.",
      "low",
    ),
    emit(
      "noindex",
      noindex ? "fail" : "pass",
      "Indexing is explicitly discouraged",
      meta.robots.join("; ") || "No robots/googlebot meta directive found.",
      "A noindex directive asks compliant search engines to exclude the page. It may be intentional.",
      "Confirm this page should be searchable before removing only the unintended noindex/none directive. Preserve intentional exclusions.",
      "Approved public route has no unintended noindex/none in raw and rendered meta.",
      "high",
    ),
    emit(
      "nofollow",
      meta.robots.some((x) =>
        /(?:^|[\s,:])(?:nofollow|none)(?:$|[\s,])/i.test(x),
      )
        ? "suggestion"
        : "pass",
      "Review link-following restriction",
      meta.robots.join("; ") || "No page-level restriction found.",
      "This asks crawlers not to follow page links; it does not by itself exclude the page from search.",
      "Confirm whether page-level nofollow is intentional; keep deliberate policy controls.",
      "Document the intended page-level link policy.",
      "low",
    ),
    emit(
      "canonical",
      canonicalValues.some((x) => x.startsWith("["))
        ? "unknown"
        : canonicalValues.length > 1
          ? "fail"
          : canonicalValues.length === 0
            ? "suggestion"
            : canonicalValues[0] !== url
              ? "suggestion"
              : "pass",
      "Review the preferred page URL",
      JSON.stringify(meta.canonicals),
      "Conflicting canonical URLs provide inconsistent consolidation signals. A canonical to another page may be deliberate.",
      "Resolve contradictory canonical declarations. Confirm intended duplicate grouping before changing a canonical target.",
      "All existing HTML and HTTP canonical declarations agree with the intended preferred public URL.",
    ),
    emit(
      "jsonld",
      meta.jsonLdErrors ? "fail" : "pass",
      "Existing structured data must parse",
      `${meta.jsonLdCount} JSON-LD blocks; ${meta.jsonLdErrors} JSON parse errors.`,
      "Malformed JSON cannot be interpreted as the intended structured data. Syntax checks do not validate schema eligibility.",
      "Repair syntax in existing JSON-LD only; do not invent ratings, facts, citations, or new schema types.",
      "All existing application/ld+json blocks parse with JSON.parse; validate applicable types separately.",
    ),
    emit(
      "alt",
      meta.missingAlt ? "fail" : "pass",
      "Images need an alt attribute",
      `${meta.missingAlt} of ${meta.imageCount} images omit alt. Empty alt is accepted for decorative images.`,
      "Screen readers need a text alternative or an explicit decorative choice.",
      'Add meaningful alt for informative images and alt="" for decorative images. Do not infer hidden image contents.',
      "Every img has an alt attribute; manually review whether alternatives suit image purpose.",
      "low",
    ),
    emit(
      "viewport",
      meta.viewport ? "pass" : "suggestion",
      "Review mobile viewport",
      meta.viewport
        ? "A viewport meta tag is present."
        : "No viewport meta tag found.",
      "Mobile browsers may show a scaled desktop layout. Presence alone does not prove mobile usability.",
      "Review the mobile layout and add a viewport declaration if required by the design.",
      "At 390px width, intended content and navigation remain usable.",
      "low",
    ),
  ];
}
export function pageChecks(page: PageResult): Check[] {
  const url = page.url;
  const readable =
    page.status !== undefined &&
    page.status >= 200 &&
    page.status < 300 &&
    !!page.metadata;
  const definitiveError =
    /Redirect loop/.test(page.error ?? "") ||
    [404, 410].includes(page.status ?? 0) ||
    (page.status ?? 0) >= 500;
  const status = check(
    "http",
    url,
    readable ? "pass" : definitiveError ? "fail" : "unknown",
    "Direct page load / deep-link refresh",
    page.error ??
      `GET ${page.finalUrl ?? url} returned HTTP ${page.status}; ${page.redirects.length} redirects.`,
    "A chosen URL should open directly for visitors. A bot block or login response cannot prove a broken website.",
    "Fix the route response or deployment rewrite for this exact public URL. Preserve real 404 behavior for nonexistent routes.",
    "A fresh credential-free GET of this exact public URL returns intended HTML with HTTP 2xx. Verify rendered content manually.",
    "http",
    "high",
  );
  const results = [status];
  if (!readable || !page.metadata) return results;
  const metadata = { ...page.metadata };
  const httpCanonicals = (page.headers?.link ?? "")
    .split(/,\s*(?=<)/)
    .flatMap((entry) => {
      const target = entry.match(/^\s*<([^>]+)>/);
      const rel = entry.match(/;\s*rel\s*=\s*(?:"([^"]*)"|([^;,\s]+))/i);
      if (
        !target ||
        !rel ||
        !(rel[1] ?? rel[2]).toLowerCase().split(/\s+/).includes("canonical")
      )
        return [];
      try {
        if (
          target[1].startsWith("[") ||
          new URL(target[1], page.finalUrl).search
        )
          return ["[uninspectable canonical omitted]"];
        return [safeUrl(target[1], page.finalUrl)];
      } catch {
        return ["[unsafe canonical omitted]"];
      }
    });
  metadata.canonicals = [...metadata.canonicals, ...httpCanonicals];
  results.push(...metadataChecks(url, metadata));
  results.push(
    check(
      "redirect",
      url,
      page.redirects.length > 1 ? "suggestion" : "pass",
      "Review redirects",
      `${page.redirects.length} hops; final URL: ${page.finalUrl}.`,
      "Extra hops add requests. Some redirects are intentional.",
      "Link directly to the intended final public URL and simplify unnecessary same-origin redirect chains.",
      "Chosen links reach the intended final URL with at most one intentional redirect.",
      "http",
      "low",
    ),
  );
  const xRobots = page.headers?.["x-robots-tag"] ?? "";
  // Only generic and Googlebot-specific directives are relevant to this report.
  const sections = xRobots.split(",");
  let agent = "*";
  const relevant: string[] = [];
  for (const section of sections) {
    const scoped = section.match(/^\s*([\w*-]+)\s*:\s*(.*)$/);
    if (scoped) {
      agent = scoped[1].toLowerCase();
      if (["*", "googlebot"].includes(agent)) relevant.push(scoped[2]);
    } else if (["*", "googlebot"].includes(agent)) relevant.push(section);
  }
  results.push(
    check(
      "header-noindex",
      url,
      relevant.some((x) => /\b(noindex|none)\b/i.test(x)) ? "fail" : "pass",
      "HTTP indexing restriction",
      xRobots || "No X-Robots-Tag header observed.",
      "An HTTP noindex directive can exclude this page even if its HTML looks correct. It may be deliberate.",
      "Confirm intended indexing policy; remove only unintended header noindex/none for this route.",
      "Fresh GET headers have no unintended generic/Googlebot noindex/none.",
      "http",
      "high",
    ),
  );
  results.push(
    check(
      "query-references",
      url,
      metadata.skippedQueryReferences ? "unknown" : "pass",
      "Query-dependent references are outside this sample",
      `${metadata.skippedQueryReferences} link/OG references with query strings were omitted before probing.`,
      "Removing a signed or query-dependent URL can change its destination or asset. This sample does not test those references.",
      "Verify query-dependent destinations and signed assets manually without sharing token-bearing URLs.",
      "Owner checks original intended public links/assets through an appropriate safe workflow.",
      "raw-html",
      "low",
    ),
  );
  results.push(
    check(
      "analytics",
      url,
      "unknown",
      "Analytics receipt needs owner access",
      metadata.analyticsHint
        ? "A known analytics script hint was found; event delivery was not checked."
        : "No known script hint was found. Analytics may be absent, consent-gated, server-side, or use another vendor.",
      "A script is not proof that visits or events reached an analytics account. Analytics is optional.",
      "If analytics is wanted, use the owner’s vendor debug view and consent-aware test journey. Do not add a vendor without approval.",
      "Owner verifies expected test event receipt and consent behavior in the chosen analytics tool.",
      "owner-integration",
      "low",
    ),
  );
  return results;
}
export function duplicateChecks(pages: PageResult[]): Check[] {
  const complete = pages.every(
    (x) => !!x.metadata && (x.status ?? 0) >= 200 && (x.status ?? 0) < 300,
  );
  return pages.flatMap((page) =>
    (["titles", "descriptions"] as const).map((field) => {
      const value = page.metadata?.[field]?.[0]?.trim();
      const duplicates = value
        ? pages
            .filter(
              (p) =>
                p.url !== page.url &&
                p.finalUrl !== page.finalUrl &&
                p.metadata?.[field]?.[0]?.trim() === value,
            )
            .map((p) => p.url)
        : [];
      return check(
        "duplicate-" + field,
        page.url,
        duplicates.length ? "suggestion" : complete ? "pass" : "unknown",
        `Review repeated ${field === "titles" ? "titles" : "descriptions"}`,
        duplicates.length
          ? `The same sampled value appears at ${duplicates.join(", ")}.`
          : complete
            ? "No same value found across distinct sampled final URLs."
            : "Sample incomplete; uniqueness not established.",
        "Repeated metadata may make distinct pages harder to tell apart; deliberate duplicates can be valid.",
        "Review page intent and give distinct pages truthful, distinct metadata. Preserve intentional duplicate grouping.",
        "Recheck the same complete sample and manually confirm titles/descriptions suit each page.",
        "sample",
        "low",
      );
    }),
  );
}
export function renderedChecks(page: PageResult, metadata: Metadata): Check[] {
  const checks = metadataChecks(page.url, metadata, "rendered-dom");
  if (!page.metadata) return checks;
  for (const field of [
    "titles",
    "descriptions",
    "canonicals",
    "robots",
    "jsonLdCount",
    "jsonLdErrors",
  ] as const) {
    const raw = JSON.stringify(page.metadata[field]);
    const rendered = JSON.stringify(metadata[field]);
    checks.push(
      check(
        "render-diff." + field,
        page.url,
        raw === rendered ? "pass" : "suggestion",
        "Raw and rendered page differ",
        `${field}: raw ${raw}; rendered ${rendered}.`,
        "JavaScript can change metadata. This is a snapshot from your current tab, not Googlebot rendering or a fresh anonymous browser.",
        "Review intentional hydration changes. Keep metadata consistent where possible; use Search Console URL Inspection for Google’s view.",
        "Fresh direct load and rendered view expose the intended metadata. Document intentional differences.",
        "rendered-dom",
        "low",
      ),
    );
  }
  return checks;
}
export function findings(report: Report): Check[] {
  return report.checks
    .filter((x) => x.verdict !== "pass")
    .sort(
      (a, b) =>
        ({ fail: 0, suggestion: 1, unknown: 2, pass: 3 })[a.verdict] -
          { fail: 0, suggestion: 1, unknown: 2, pass: 3 }[b.verdict] ||
        { high: 0, medium: 1, low: 2 }[a.severity] -
          { high: 0, medium: 1, low: 2 }[b.severity],
    );
}
