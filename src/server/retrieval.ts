import type { ExtractedPage, Report, RetrievalEvidence, SearchHit } from "../shared/model.js";
import { cleanRemoteText, queryTerms, searchQuery } from "../shared/retrieval.js";
import { safeUrl, selectUrls } from "../shared/urls.js";
import { resolvePublicTarget } from "./network.js";

export const SEARCH_ENDPOINT = "https://api.search.tinyfish.ai";
export const FETCH_ENDPOINT = "https://api.fetch.tinyfish.ai";
export class ProviderHttpError extends Error {
  constructor(readonly status: number) { super("Provider HTTP response failed."); }
}
export function providerFailure(error: unknown): string {
  if (error instanceof ProviderHttpError) {
    const cause = error.status === 401 ? "Check the API key and account."
      : error.status === 402 ? "This account lacks endpoint access. Do not buy access or switch to a paid endpoint automatically."
      : error.status === 403 ? "Endpoint request forbidden; confirm account entitlement and provider restrictions."
      : error.status === 429 ? "Provider rate limit reached."
      : "Check provider endpoint availability.";
    return "HTTP " + error.status + ". " + cause;
  }
  // Never echo provider bodies, arbitrary error messages, request headers, or keys.
  const e = error as { name?: unknown; cause?: { code?: unknown } } | null;
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return "Client deadline exceeded; remote completion is unknown.";
  const code = e?.cause?.code;
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"].includes(String(code)))
    return "Connection failed (" + String(code) + ").";
  return "Request or response could not be verified.";
}
export interface RetrievalApproval {
  exactUrls: string[];
  query: string;
  expiresAt: string;
  searchFetchFreeOnAccountVerified: boolean;
  remoteFetchRiskAccepted: boolean;
  maxSearchRequests: number;
  maxFetchUrls: number;
}
export interface RetrievalService {
  kind: "approved-live" | "fixture";
  run(report: Report, query: string): Promise<RetrievalEvidence>;
}
export interface RetrievalWire {
  search(query: string): Promise<unknown>;
  fetch(urls: string[]): Promise<unknown>;
}
const object = (x: unknown): Record<string, unknown> | undefined =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : undefined;

export function searchRequest(query: string) {
  const url = new URL(SEARCH_ENDPOINT);
  url.search = new URLSearchParams({query, page:"0", location:"US", language:"en"}).toString();
  return {url: url.href, method: "GET" as const};
}
export function fetchPayload(urls: string[]) {
  return {urls, format:"markdown", ttl:0, links:false, image_links:false, per_url_timeout_ms:25000};
}

export function parseSearch(data: unknown, expectedQuery?: string): RetrievalEvidence["search"] {
  const root = object(data);
  if (!root || !Array.isArray(root.results)) return {hits:[],error:"Search response did not contain a results array."};
  if (expectedQuery !== undefined && (root.query !== expectedQuery || root.page !== 0)) return {hits:[],error:"Search response query/page did not match this requested sample."};
  const hits: SearchHit[] = [];
  let invalid = 0;
  for (const raw of root.results.slice(0, 10)) {
    const r = object(raw);
    try {
      if (!r || typeof r.url !== "string" || typeof r.position !== "number" || !Number.isInteger(r.position) || r.position < 1 || typeof r.title !== "string" || typeof r.snippet !== "string") throw new Error();
      const original = new URL(r.url);
      const url = selectUrls([safeUrl(r.url)])[0];
      hits.push({url,position:r.position,title:cleanRemoteText(r.title,200),snippet:cleanRemoteText(r.snippet,500),queryOmitted:!!original.search});
    } catch { invalid++; }
  }
  return {hits, ...(invalid ? {error:"Some returned search results had invalid or unsafe fields; visibility is unable to verify."} : {})};
}

export function parseFetched(data: unknown, urls: string[], query: string, isTarget: boolean): ExtractedPage[] {
  const root = object(data);
  if (!root || !Array.isArray(root.results) || !Array.isArray(root.errors)) return urls.map(url=>({url,error:"Fetch response shape was not recognized."}));
  const results = root.results.slice(0,10).map(object).filter(x=>!!x);
  const errors = root.errors.slice(0,10).map(object).filter(x=>!!x);
  return urls.map(url => {
    // Exact original requested URL association. Extra/duplicate outputs never establish a pass.
    const matches = results.filter(r=>r.url === url);
    const failures = errors.filter(r=>r.url === url);
    if (matches.length !== 1 || failures.length) return {url,error: failures.length ? `Fetch per-URL error: ${cleanRemoteText(failures[0].error,80) || "unrecognized"}. Retry only after reviewing cause.` : "No unique successful Fetch result for this URL."};
    const r = matches[0];
    try {
      if (typeof r.final_url !== "string" || typeof r.text !== "string" || r.format !== "markdown" || (r.title !== null && typeof r.title !== "string")) throw new Error();
      if (new URL(r.final_url).search || new URL(r.final_url).hash || !urls.includes(selectUrls([r.final_url])[0])) return {url,error:"Remote final URL left the exact approved URL list or contained a query; content discarded."};
      if (r.text.length > 256*1024) return {url,error:"Extracted text exceeds the per-page analysis limit; content not assessed."};
      const text = cleanRemoteText(r.text,256*1024);
      const words = new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
      const terms = queryTerms(query,isTarget);
      return {url,finalUrl:safeUrl(r.final_url),title:cleanRemoteText(r.title,200),characters:text.trim().length,excerpt:text.trim().slice(0,800),matchedTerms:terms.filter(t=>words.has(t)),missingTerms:terms.filter(t=>!words.has(t))};
    } catch { return {url,error:"Fetch result fields were malformed; content discarded."}; }
  });
}

export async function collectRetrieval(urls: string[], query: string, wire: RetrievalWire, provider: RetrievalEvidence["provider"]): Promise<RetrievalEvidence> {
  let search: RetrievalEvidence["search"];
  let pages: ExtractedPage[];
  try {search=parseSearch(await wire.search(query),query);} catch (error) {search={hits:[],error:"Search: " + providerFailure(error) + " No automatic retry."};}
  try {pages=parseFetched(await wire.fetch(urls),urls,query,query !== urls[0]);} catch (error) {pages=urls.map(url=>({url,error:"Fetch: " + providerFailure(error) + " No automatic retry."}));}
  return {provider,observedAt:new Date().toISOString(),query,queryKind:query===urls[0]?"url-discovery":"target",location:"US",language:"en",search,pages,searchRequests:1,fetchUrls:urls.length};
}

function skippedRetrieval(urls: string[], query: string, reason: string): RetrievalEvidence {
  return {provider:"not-run",observedAt:new Date().toISOString(),query,queryKind:query===urls[0]?"url-discovery":"target",location:"US",language:"en",search:{hits:[],error:reason},pages:urls.map(url=>({url,error:reason})),searchRequests:0,fetchUrls:0};
}

export function validateRetrievalApproval(approval: RetrievalApproval, input: unknown, query: string, key: string | undefined) {
  const urls = selectUrls(input);
  const approved = selectUrls(approval.exactUrls);
  if (!key || !approval.searchFetchFreeOnAccountVerified || !approval.remoteFetchRiskAccepted)
    throw new Error("TinyFish Search/Fetch needs a server key, verified free account access, and scoped remote-analysis approval.");
  if (!Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt)<=Date.now() || JSON.stringify(urls)!==JSON.stringify(approved) || JSON.stringify(approved)!==JSON.stringify(approval.exactUrls) || query!==searchQuery(approval.query,urls[0]))
    throw new Error("TinyFish approval expired or exact URL/query scope differs.");
  if (!Number.isInteger(approval.maxSearchRequests) || approval.maxSearchRequests<1 || approval.maxSearchRequests>2 || !Number.isInteger(approval.maxFetchUrls) || approval.maxFetchUrls<urls.length || approval.maxFetchUrls>10)
    throw new Error("Approval must bound this test to at most two Search calls and ten fetched URLs.");
  return urls;
}

async function providerJson(url: string, init: RequestInit, key: string, signal: AbortSignal): Promise<unknown> {
  const response=await fetch(url,{...init,credentials:"omit",redirect:"error",signal,headers:{"X-API-Key":key,...init.headers}});
  if (!response.ok) throw new ProviderHttpError(response.status);
  const reader=response.body?.getReader();
  if (!reader) throw new Error("Provider response missing.");
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512*1024){await reader.cancel();throw new Error("Provider response exceeds 512 KiB.");}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Constructed only by the separate approved CLI. A key by itself never activates remote use.
export function retrievalAllowance(approval: RetrievalApproval, key: string) {
  let searchUsed=0,fetchUsed=0;
  return (urls: string[], query: string) => {
    validateRetrievalApproval(approval,urls,query,key);
    if(searchUsed+1>approval.maxSearchRequests || fetchUsed+urls.length>approval.maxFetchUrls)
      throw new Error("TinyFish scoped request allowance exhausted. No automatic renewal.");
    searchUsed++;fetchUsed+=urls.length;
  };
}
export function approvedRetrievalService(approval: RetrievalApproval, key: string): RetrievalService {
  const reserve = retrievalAllowance(approval,key);
  return {kind:"approved-live",async run(report,query){
    const urls=validateRetrievalApproval(approval,report.urls,query,key);
    if (report.mode!=="public-live" || report.pages.length!==urls.length || urls.some(url=>report.pages.filter(p=>p.url===url).length!==1) || report.pages.some(p=>!p.metadata || !p.status || p.status<200 || p.status>=300 || !p.finalUrl || !urls.includes(p.finalUrl)))
      return skippedRetrieval(urls,query,"Remote checks not run: successful anonymous HTML and approved final URLs were not established for the complete sample. Review the raw findings first.");
    // Failed attempts also consume the approval's allowance; no silent retries.
    reserve(urls,query);
    const signal=AbortSignal.timeout(40000);
    try {
      await Promise.all(urls.map(url=>resolvePublicTarget(url)));
      signal.throwIfAborted();
    } catch {
      return skippedRetrieval(urls,query,"Remote checks not run: public DNS preflight failed or timed out. No provider request was made; this attempt's allowance remains reserved.");
    }
    // Reserve the entire round before either request, including failed/partial attempts.
    return collectRetrieval(urls,query,{
      search(q){const req=searchRequest(q);return providerJson(req.url,{method:req.method},key,signal);},
      fetch(list){return providerJson(FETCH_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(fetchPayload(list))},key,signal);}
    },"tinyfish-live");
  }};
}
