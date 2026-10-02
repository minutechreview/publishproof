import type { Check, Report } from "./model.js";

export const SCORE_VERSION = 1;
export interface ScoreItem {
  key: string;
  label: string;
  weight: number;
  category: "search" | "visitors";
  rules: string[];
}
// Fixed points per chosen page. Optional files/vendors/schema are never requirements.
export const SCORE_ITEMS: ScoreItem[] = [
  {
    key: "load",
    label: "Page opens",
    weight: 20,
    category: "visitors",
    rules: ["http"],
  },
  {
    key: "access",
    label: "Search access",
    weight: 20,
    category: "search",
    rules: ["noindex", "header-noindex", "robots"],
  },
  {
    key: "title",
    label: "Clear page title",
    weight: 10,
    category: "search",
    rules: ["title"],
  },
  {
    key: "description",
    label: "Consistent description",
    weight: 5,
    category: "search",
    rules: ["description"],
  },
  {
    key: "canonical",
    label: "Consistent preferred URL",
    weight: 10,
    category: "search",
    rules: ["canonical"],
  },
  {
    key: "links",
    label: "Sampled links work",
    weight: 10,
    category: "visitors",
    rules: ["internal-link"],
  },
  {
    key: "preview",
    label: "Existing share image works",
    weight: 5,
    category: "visitors",
    rules: ["og-asset"],
  },
  {
    key: "images",
    label: "Image text alternatives",
    weight: 10,
    category: "visitors",
    rules: ["alt"],
  },
  {
    key: "data",
    label: "Existing page data parses",
    weight: 5,
    category: "search",
    rules: ["jsonld"],
  },
  {
    key: "mobile",
    label: "Mobile sizing hint",
    weight: 5,
    category: "visitors",
    rules: ["viewport"],
  },
];
export interface ScoreResult {
  version: number;
  value: number | null;
  coverage: number;
  possible: number;
  categories: { search: number | null; visitors: number | null };
  items: {
    url: string;
    label: string;
    weight: number;
    state: "pass" | "fail" | "unknown";
  }[];
}
export function scoreReport(report: Report): ScoreResult {
  const items: ScoreResult["items"] = [];
  const totals = {
    search: { earned: 0, max: 0, known: 0 },
    visitors: { earned: 0, max: 0, known: 0 },
  };
  let earned = 0,
    known = 0,
    max = 0;
  for (const url of report.urls) {
    const page = report.pages.find((p) => p.url === url);
    for (const rubric of SCORE_ITEMS) {
      const checks = report.checks.filter(
        (c) =>
          c.url === url &&
          rubric.rules.includes(c.rule.replace(/^rendered\./, "")),
      );
      let status: "pass" | "fail" | "unknown";
      if (checks.some((c) => c.verdict === "fail")) status = "fail";
      else if (
        checks.some((c) => c.verdict === "unknown") ||
        (report.scoreRequirements ?? []).some((id) => {
          try {
            const [rule, requiredUrl] = JSON.parse(id);
            return (
              requiredUrl === url &&
              rubric.rules.includes(String(rule).replace(/^rendered\./, "")) &&
              !checks.some((c) => c.id === id)
            );
          } catch {
            return true;
          }
        })
      )
        status = "unknown";
      else if (rubric.key === "links" || rubric.key === "preview") {
        // No existing links/assets is a neutral check, never a requirement to add them.
        const candidates =
          rubric.key === "links"
            ? [...new Set(report.pages.flatMap((p) => p.metadata?.links ?? []))]
                .filter((target) => !report.urls.includes(target))
                .slice(0, 15)
            : [
                ...new Set(
                  report.pages.flatMap((p) => p.metadata?.ogImages ?? []),
                ),
              ].slice(0, 5);
        const expected = candidates.filter((target) =>
          (rubric.key === "links"
            ? page?.metadata?.links
            : page?.metadata?.ogImages
          )?.includes(target),
        );
        status =
          page?.metadata &&
          expected.every((target) =>
            checks.some((c) => c.subject === target && c.verdict === "pass"),
          )
            ? "pass"
            : "unknown";
      } else if (
        rubric.rules.some((rule) => !checks.some((c) => c.rule === rule))
      )
        status = "unknown";
      else if (
        rubric.key === "mobile" &&
        checks.some((c) => c.verdict === "suggestion")
      )
        status = "unknown";
      else status = "pass"; // Intent-dependent/optional suggestions do not lose points.
      items.push({
        url,
        label: rubric.label,
        weight: rubric.weight,
        state: status,
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
    (p) => p.metadata && p.status && p.status >= 200 && p.status < 300,
  );
  return {
    version: SCORE_VERSION,
    value: max && hasReadablePage ? Math.floor((100 * earned) / max) : null,
    coverage: max ? Math.floor((100 * known) / max) : 0,
    possible: max ? Math.floor((100 * (earned + max - known)) / max) : 0,
    categories: {
      search:
        hasReadablePage && totals.search.max
          ? Math.floor((100 * totals.search.earned) / totals.search.max)
          : null,
      visitors:
        hasReadablePage && totals.visitors.max
          ? Math.floor((100 * totals.visitors.earned) / totals.visitors.max)
          : null,
    },
    items,
  };
}
export function scoreChange(
  before: Report,
  after: Report,
): { delta: number | null; coverageLost: boolean } {
  const previous = scoreReport(before),
    current = scoreReport(after);
  const comparable =
    JSON.stringify(before.urls) === JSON.stringify(after.urls) &&
    before.mode === after.mode;
  return {
    delta:
      comparable && previous.value !== null && current.value !== null
        ? current.value - previous.value
        : null,
    coverageLost: comparable && current.coverage < previous.coverage,
  };
}
export function scoreLabel(score: ScoreResult): string {
  if (score.value === null) return "We need a readable page first";
  if (score.coverage < 80) return "Some checks still need a closer look";
  return score.value >= 90
    ? "Your page basics look good"
    : score.value >= 70
      ? "A few improvements will help"
      : "Let’s give this page some care";
}
const COPY: Record<
  string,
  {
    fail: string;
    pass: string;
    suggestion: string;
    unknown: string;
    why: string;
  }
> = {
  http: {
    fail: "This page didn’t open correctly",
    pass: "Your page opens directly",
    suggestion: "Review how this page opens",
    unknown: "We couldn’t check the page response",
    why: "Visitors should be able to open this address without a broken-page error.",
  },
  title: {
    fail: "Give this page one clear title",
    pass: "Your page has a clear title",
    suggestion: "Review your page title",
    unknown: "We couldn’t check your page title",
    why: "A clear title helps people recognize your page in browser tabs and search.",
  },
  description: {
    fail: "Your page has conflicting descriptions",
    pass: "Your page description is consistent",
    suggestion: "Consider a short page description",
    unknown: "We couldn’t check the description",
    why: "A useful description helps explain your page. Search tools may choose their own summary.",
  },
  noindex: {
    fail: "Your page asks search tools to skip it",
    pass: "No page-level search exclusion found",
    suggestion: "Review your search settings",
    unknown: "We couldn’t verify this search setting",
    why: "Keep this setting if the page should be private from search. Change it only if the exclusion is unintended.",
  },
  "header-noindex": {
    fail: "Your server asks search tools to skip this page",
    pass: "No server-level search exclusion found",
    suggestion: "Review the server’s search settings",
    unknown: "We couldn’t verify the server setting",
    why: "A server setting can hide a page from search even when the page itself looks fine.",
  },
  robots: {
    fail: "Your site blocks crawling of this page",
    pass: "No crawl restriction found for this page",
    suggestion: "Review crawler access",
    unknown: "We couldn’t confirm crawler access",
    why: "Search tools need permission to crawl a public page. Keep any restrictions you intended.",
  },
  canonical: {
    fail: "Search tools get conflicting page addresses",
    pass: "Your preferred page address is consistent",
    suggestion: "Review your preferred page address",
    unknown: "We couldn’t check the preferred address",
    why: "This setting helps search tools choose the main version of a page. A different preferred address may be intentional.",
  },
  alt: {
    fail: "Some images are missing text alternatives",
    pass: "Images have text-alternative attributes",
    suggestion: "Review your image descriptions",
    unknown: "We couldn’t check image alternatives",
    why: "Text alternatives help people using screen readers. Decorative images can have an empty alternative.",
  },
  jsonld: {
    fail: "Some existing page data is broken",
    pass: "Existing page data has valid syntax",
    suggestion: "Review the existing page data",
    unknown: "We couldn’t check the page data",
    why: "Search tools can’t use data with broken syntax. Extra structured data is optional; this checks only what already exists.",
  },
  viewport: {
    fail: "Review the mobile sizing setting",
    pass: "A mobile sizing setting is present",
    suggestion: "Check how your page looks on a phone",
    unknown: "We couldn’t verify mobile sizing",
    why: "This small setting helps phones size your page. A real phone-layout check is still needed.",
  },
  "internal-link": {
    fail: "A link leads to a missing page",
    pass: "A sampled link responds correctly",
    suggestion: "Review this page link",
    unknown: "We couldn’t verify this link",
    why: "A working link should take visitors to the intended page. This is a sample, not a full navigation test.",
  },
  "og-asset": {
    fail: "Your existing share image is unavailable",
    pass: "Your existing share image responds correctly",
    suggestion: "Review your share image",
    unknown: "We couldn’t verify the share image",
    why: "An unavailable image can spoil the preview when someone shares your page.",
  },
  "tinyfish.visibility": {
    fail: "Review your search sample",
    pass: "Your page appears in this search sample",
    suggestion: "Your page wasn’t found in this search sample",
    unknown: "We couldn’t confirm search visibility",
    why: "This is one TinyFish result sample. Missing from it does not prove your page is absent from Google.",
  },
  "tinyfish.readable": {
    fail: "TinyFish couldn’t extract readable page text",
    pass: "TinyFish can extract text from your page",
    suggestion: "Review the extracted page text",
    unknown: "We couldn’t verify AI-readable text",
    why: "Readable text gives retrieval tools something useful to extract. It doesn’t prove every AI tool understands the page.",
  },
  "tinyfish.query-text": {
    fail: "Review the text for your search topic",
    pass: "The extracted text mentions your search words",
    suggestion: "Some search words are missing from extracted text",
    unknown: "We couldn’t check your search topic",
    why: "This is a word-match clue, not a ranking prediction. Add content only when it is truthful and useful.",
  },
  indexing: {
    fail: "Review search indexing with your owner account",
    pass: "Search indexing was verified",
    suggestion: "Check whether this page appears in search",
    unknown: "Actual search indexing needs an owner check",
    why: "This public check can’t confirm whether Google has indexed your page. Use your website owner’s search account to verify that.",
  },
  citations: {
    fail: "Review the references behind your content",
    pass: "References were verified",
    suggestion: "Review your content references",
    unknown: "External references need a separate review",
    why: "Source links, business listings and links in AI answers are different things. This sample doesn’t verify those external references.",
  },
  analytics: {
    fail: "Review your visitor measurement",
    pass: "Visitor measurement verified",
    suggestion: "Visitor measurement is optional",
    unknown: "Visitor tracking needs your account access",
    why: "A public page cannot show whether visits reach your analytics account. Tracking is optional.",
  },
};
export function plainCheck(check: Check): { title: string; why: string } {
  const rule = check.rule.replace(/^rendered\./, "");
  const copy = COPY[rule];
  if (copy) return { title: copy[check.verdict], why: copy.why };
  if (rule.startsWith("render-diff."))
    return {
      title: "The page changes after it loads",
      why: "The browser version differs from the first response. Your coding agent can check whether that change is intended.",
    };
  if (rule.startsWith("duplicate-"))
    return {
      title:
        check.verdict === "pass"
          ? "Sampled page descriptions stay distinct"
          : "Some sampled pages use the same wording",
      why: "Distinct pages should be easy to tell apart. Shared wording can also be intentional.",
    };
  if (rule === "redirect")
    return {
      title:
        check.verdict === "pass"
          ? "Your page address opens without extra hops"
          : "Your page takes an extra step to open",
      why: "Some redirects are intended. Unnecessary ones can slow the trip to your page.",
    };
  if (rule === "nofollow")
    return {
      title:
        check.verdict === "pass"
          ? "No page-wide link-following restriction found"
          : "Review how search tools follow your links",
      why: "This is a search setting to review, not proof that your page is excluded from search.",
    };
  if (rule === "query-references")
    return {
      title:
        check.verdict === "pass"
          ? "Sampled link addresses can be checked safely"
          : "Some links need a manual check",
      why: "Links with extra parameters can need a signed-in or owner check. They were left out of this public sample.",
    };
  return { title: check.title, why: check.impact };
}

export function scoreRequirements(...reports: Report[]): string[] {
  return [
    ...new Set([
      ...reports.flatMap((report) => [
        ...(report.scoreRequirements ?? []),
        ...report.checks
          .filter(
            (c) =>
              c.source === "rendered-dom" &&
              SCORE_ITEMS.some((item) =>
                item.rules.includes(c.rule.replace(/^rendered\./, "")),
              ),
          )
          .map((c) => c.id),
      ]),
    ]),
  ];
}

export function groupChecks(report: Report): Check[][] {
  const result = new Map<string, Check[]>();
  for (const item of report.checks) {
    const key = JSON.stringify([
      item.rule.replace(/^rendered\./, ""),
      item.url,
      item.subject,
    ]);
    result.set(key, [...(result.get(key) ?? []), item]);
  }
  const order = { fail: 0, suggestion: 1, unknown: 2, pass: 3 };
  return [...result.values()]
    .map((items) => items.sort((a, b) => order[a.verdict] - order[b.verdict]))
    .sort(
      (a, b) =>
        order[a[0].verdict] - order[b[0].verdict] ||
        { high: 0, medium: 1, low: 2 }[a[0].severity] -
          { high: 0, medium: 1, low: 2 }[b[0].severity],
    );
}
