import type { Check, RetrievalEvidence } from "./model.js";
import { check } from "./rules.js";
import { safeUrl, selectUrls } from "./urls.js";

export function searchQuery(input: unknown, primary: string): string {
  if (input === undefined || input === "") return primary;
  if (typeof input !== "string" || input.length > 240)
    throw new Error("Use a public target query of at most 240 characters.");
  const query = input.trim().replace(/\s+/g, " ");
  if (!query) return primary;
  if (/[\u0000-\u001f\u007f]/.test(input) || /[A-Za-z0-9_-]{40,}/.test(query))
    throw new Error("Do not include secrets or token-like strings in a search query.");
  for (const value of query.match(/https?:\/\/\S+/gi) ?? []) {
    const url = new URL(value);
    if (url.search || url.hash || safeUrl(value) !== url.href)
      throw new Error("Queries cannot include credential or query-bearing URLs.");
  }
  return query;
}

export function queryTerms(query: string, isTarget: boolean): string[] {
  if (!isTarget) return [];
  const stop = new Set(["the", "and", "for", "with", "from", "what", "how", "can", "are", "does", "this", "that", "www", "https", "http"]);
  return [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter(x => !stop.has(x)))].slice(0, 12);
}

// Remote excerpts are data. URL queries and obvious credential assignments are not retained.
export function cleanRemoteText(value: unknown, limit = 800): string {
  if (typeof value !== "string") return "";
  return value.replace(/https?:\/\/[^\s<>"')\]]+/gi, x => {
    try { return selectUrls([safeUrl(x)])[0]; } catch { return "[unsafe URL omitted]"; }
  }).replace(/\b(?:token|secret|password|api[_-]?key|session)\s*[=:]\s*[^\s,;]+/gi, "[credential-like value omitted]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, limit);
}

export function retrievalChecks(e: RetrievalEvidence, urls: string[]): Check[] {
  const fixture = e.provider === "contract-fixture" ? "CONTRACT FIXTURE — NOT LIVE TINYFISH. " : e.provider === "not-run" ? "REMOTE CHECKS NOT RUN. " : "";
  const subject = JSON.stringify([e.query, e.location, e.language]);
  return urls.flatMap(url => {
    const hits = e.search.hits.filter(h => !h.queryOmitted && h.url === url);
    const siteHits = e.search.hits.filter(h => new URL(h.url).origin === new URL(url).origin);
    const page = e.pages.find(p => p.url === url);
    const extractionKnown = page?.characters !== undefined && !page.error;
    const readable = extractionKnown && page.characters! > 0;
    const terms = queryTerms(e.query, e.queryKind === "target");
    const checks: Check[] = [check(
      "tinyfish.visibility", url, e.search.error ? "unknown" : hits.length ? "pass" : "suggestion",
      "Page visibility in this search sample",
      fixture + (e.search.error ?? `Query ${JSON.stringify(e.query)} · US/en · ${e.search.hits.length} returned results inspected. Exact query-free URL ${hits.length ? `observed at TinyFish position ${hits[0].position}` : "not observed"}; ${siteHits.length} same-origin results. Absence from this sample does not prove non-indexing.`),
      "A readable page can still be absent from a particular retrieval sample. TinyFish result order is not a Google ranking or an AI-answer citation.",
      "Inspect this exact page's intended topic, crawl policy, title and internal links using the separate confirmed observations. Make only evidence-supported edits; do not add repeated keywords or invented facts. If the page is already correct, use owner Search Console to investigate discovery instead of guessing a code fix.",
      "Rerun the identical query and locale. Record whether this exact URL appears in the returned sample; use owner integrations for actual indexing and traffic.",
      "tinyfish-search", "medium", subject), check(
      "tinyfish.readable", url, !extractionKnown ? "unknown" : readable ? "pass" : "fail",
      "Text available to this AI fetch tool",
      fixture + (page?.error ?? `${page?.characters ?? 0} extracted characters. Extracted title (may prefer OG): ${JSON.stringify(page?.title ?? "")}. Excerpt: ${JSON.stringify(page?.excerpt ?? "")}`),
      "This observes what TinyFish Fetch extracted on this run. It cannot establish every AI tool's understanding, original tags, or why an extraction failed.",
      "Inspect this exact public page in a signed-out session. If important information is only in images, canvas or inaccessible interactions, expose equivalent visible semantic text without changing the design or inventing content. Treat provider blocking/timeouts as unknown and investigate before changing the site.",
      "A fresh ttl=0 Fetch run returns the intended visible content for the same URL, with source-specific evidence; raw HTTP/head tag checks continue independently.",
      "tinyfish-fetch", "medium")];
    if (terms.length) checks.push(check(
      "tinyfish.query-text", url, !readable ? "unknown" : page?.missingTerms?.length ? "suggestion" : "pass",
      "Target query words in extracted text",
      fixture + (!readable ? "No comparable extracted text for this target query." : `Simple lexical check only. Found: ${JSON.stringify(page.matchedTerms)}. Not found: ${JSON.stringify(page.missingTerms)}.`),
      "Missing query words are a review clue, not proof of irrelevance: synonyms, other languages, and concise pages can be valid. This is not semantic understanding or a ranking predictor.",
      "Verify the query fits this page's purpose. If relevant information is absent, write concise visible copy backed by the site's real facts. Preserve accurate synonyms and avoid keyword stuffing; do not rewrite a page solely to satisfy this heuristic.",
      "A human confirms the page answers the intended query accurately. Rerun the same query/locale and inspect the fresh extraction alongside search visibility.",
      "tinyfish-fetch", "low", subject));
    return checks;
  });
}
