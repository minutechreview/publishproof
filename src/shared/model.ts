export type Verdict = "pass" | "fail" | "suggestion" | "unknown";
export type Severity = "high" | "medium" | "low";
export interface Check {
  id: string;
  rule: string;
  url: string;
  subject: string;
  verdict: Verdict;
  severity: Severity;
  confidence: "high" | "medium";
  title: string;
  evidence: string;
  impact: string;
  repair: string;
  acceptance: string;
  source:
    | "http"
    | "raw-html"
    | "rendered-dom"
    | "sample"
    | "owner-integration"
    | "tinyfish-search"
    | "tinyfish-fetch";
}
export interface Metadata {
  titles: string[];
  descriptions: string[];
  canonicals: string[];
  robots: string[];
  ogImages: string[];
  links: string[];
  missingAlt: number;
  imageCount: number;
  jsonLdErrors: number;
  jsonLdCount: number;
  viewport: boolean;
  analyticsHint: boolean;
  skippedQueryReferences: number;
}
export interface PageResult {
  url: string;
  finalUrl?: string;
  status?: number;
  redirects: string[];
  error?: string;
  metadata?: Metadata;
  headers?: Record<string, string>;
}
export interface Report {
  version: 1;
  id: string;
  createdAt: string;
  mode: "public-live" | "fixture-demo";
  urls: string[];
  pages: PageResult[];
  checks: Check[];
  requestCount: number;
  limits: {
    pages: number;
    requests: number;
    seconds: number;
    maxPageBytes: number;
  };
  tinyfish: { status: "inactive" | "live" | "fixture"; reason: string };
  retrieval?: RetrievalEvidence;
  scoreRequirements?: string[]; // Local recheck observer IDs, never sent in a scan request.
}
export interface SearchHit {
  url: string;
  position: number;
  title: string;
  snippet: string;
  queryOmitted: boolean;
}
export interface ExtractedPage {
  url: string;
  finalUrl?: string;
  title?: string;
  characters?: number;
  excerpt?: string;
  matchedTerms?: string[];
  missingTerms?: string[];
  error?: string;
}
export interface RetrievalEvidence {
  provider: "tinyfish-live" | "contract-fixture" | "not-run";
  observedAt: string;
  query: string;
  queryKind: "target" | "url-discovery";
  location: "US";
  language: "en";
  search: { hits: SearchHit[]; error?: string };
  pages: ExtractedPage[];
  searchRequests: number;
  fetchUrls: number;
}
export interface Comparison {
  check: Check;
  status: "fixed" | "still-failing" | "unable-to-verify";
  evidence: string;
}
export const LIMITS = {
  pages: 5,
  requests: 60,
  seconds: 45,
  maxPageBytes: 1024 * 1024,
};
