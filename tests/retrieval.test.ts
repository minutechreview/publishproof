import { test } from "node:test";
import assert from "node:assert/strict";
import { approvedRetrievalService, collectRetrieval, fetchPayload, parseFetched, parseSearch, retrievalAllowance, searchRequest, validateRetrievalApproval, type RetrievalApproval } from "../src/server/retrieval.js";
import { cleanRemoteText, retrievalChecks, searchQuery } from "../src/shared/retrieval.js";
import { compareReports, exportMarkdown, loadState, repairPrompt, saveState } from "../src/shared/report.js";
import { FIXTURE_URLS, startFixtureServer } from "./fixtures.js";
import { retrievalFixtureWire } from "./retrieval-fixtures.js";
import { scan } from "../src/server/scan.js";
import { ScanNetwork } from "../src/server/network.js";
import { ProviderHttpError, providerFailure } from "../src/server/retrieval.js";

test("provider diagnostics preserve safe status/categories and never echo keys or provider bodies", () => {
  assert.match(providerFailure(new ProviderHttpError(401)), /HTTP 401/);
  assert.match(providerFailure(new ProviderHttpError(402)), /lacks endpoint access/);
  assert.match(providerFailure(new ProviderHttpError(403)), /forbidden/);
  assert.match(providerFailure(new ProviderHttpError(429)), /rate limit/);
  assert.match(providerFailure({ name: "TimeoutError" }), /deadline/);
  assert.match(providerFailure({ cause: { code: "ENOTFOUND" } }), /ENOTFOUND/);
  const secret = "private-key-must-not-appear";
  assert(!providerFailure(new Error(secret)).includes(secret));
  assert(!providerFailure({ cause: { code: secret } }).includes(secret));
});

const query="launch pricing";
const approval=():RetrievalApproval=>({exactUrls:FIXTURE_URLS,query,expiresAt:new Date(Date.now()+60000).toISOString(),searchFetchFreeOnAccountVerified:true,remoteFetchRiskAccepted:true,maxSearchRequests:2,maxFetchUrls:6});
test("Search/Fetch requests use documented endpoints, locale, exact bounded URLs and live ttl without Agent fields",()=>{
  const req=searchRequest(query);const url=new URL(req.url);
  assert.equal(url.origin,"https://api.search.tinyfish.ai");assert.equal(url.searchParams.get("query"),query);assert.equal(url.searchParams.get("page"),"0");assert.equal(url.searchParams.get("location"),"US");
  assert.deepEqual(fetchPayload(FIXTURE_URLS),{urls:FIXTURE_URLS,format:"markdown",ttl:0,links:false,image_links:false,per_url_timeout_ms:25000});
  assert.ok(!JSON.stringify(fetchPayload(FIXTURE_URLS)).includes("vault"));
});
test("Search/Fetch approval binds exact URLs/query/expiry, free account access, remote risk and cumulative attempts",()=>{
  const a=approval();assert.deepEqual(validateRetrievalApproval(a,FIXTURE_URLS,query,"not-a-real-key"),FIXTURE_URLS);
  for(const patch of [{searchFetchFreeOnAccountVerified:false},{remoteFetchRiskAccepted:false},{expiresAt:"bad"},{maxSearchRequests:3},{maxFetchUrls:11}]) assert.throws(()=>validateRetrievalApproval({...a,...patch},FIXTURE_URLS,query,"fake"));
  assert.throws(()=>validateRetrievalApproval(a,FIXTURE_URLS,query,undefined));
  assert.throws(()=>validateRetrievalApproval(a,[FIXTURE_URLS[0]],query,"fake"),/scope/);
  assert.throws(()=>validateRetrievalApproval(a,FIXTURE_URLS,"different query","fake"),/scope/);
  const reserve=retrievalAllowance(a,"fake");reserve(FIXTURE_URLS,query);reserve(FIXTURE_URLS,query);assert.throws(()=>reserve(FIXTURE_URLS,query),/exhausted/);
});
test("target queries default to URL discovery and reject secret-bearing URLs/control strings",()=>{
  assert.equal(searchQuery("",FIXTURE_URLS[0]),FIXTURE_URLS[0]);assert.equal(searchQuery("  launch   pricing ",FIXTURE_URLS[0]),query);
  for(const x of ["a".repeat(241),"https://example.com/?token=123","https://user:pass@example.com/","hello\nworld","token "+"a".repeat(40)]) assert.throws(()=>searchQuery(x,FIXTURE_URLS[0]));
  assert.ok(!cleanRemoteText("https://example.com/?token=private token=private").includes("private"));
});
test("search absence is a bounded suggestion, query-dependent hits do not establish exact visibility, malformed results remain unknown",()=>{
  assert.equal(parseSearch({results:[{url:FIXTURE_URLS[0]+"?token=private",position:1,title:"Title",snippet:"safe"}]}).hits[0].queryOmitted,true);
  assert.ok(parseSearch({results:[{url:"http://127.0.0.1/",position:1,title:"x",snippet:"x"}]}).error);
  assert.ok(parseSearch({query:"different",page:0,results:[]},query).error);
  assert.ok(parseSearch({results:[{url:FIXTURE_URLS[0],position:"1"}]}).error);
});
test("Fetch cleaned title stays distinct from raw tags; malformed, duplicate, failed and out-of-scope results never pass",()=>{
  const url=FIXTURE_URLS[0];const r={url,final_url:url,title:"OG title",format:"markdown",text:"Launch pricing text"};
  const good=parseFetched({results:[r],errors:[]},[url],query,true)[0];assert.equal(good.title,"OG title");assert.deepEqual(good.missingTerms,[]);
  for(const data of [{results:[{...r,final_url:"http://127.0.0.1/"}],errors:[]},{results:[{...r,final_url:url+"?secret=yes"}],errors:[]},{results:[r,r],errors:[]},{results:[r],errors:[{url,error:"timeout"}]},{results:[{...r,text:null}],errors:[]},{results:[],errors:[]}]) assert.ok(parseFetched(data,[url],query,true)[0].error);
});
test("partial provider failures preserve the independent observer and do not retry or invent AI comprehension",async()=>{
  let searchCalls=0,fetchCalls=0;
  const e=await collectRetrieval([FIXTURE_URLS[0]],query,{async search(){searchCalls++;throw Error("key should never appear in report");},async fetch(){fetchCalls++;return {results:[{url:FIXTURE_URLS[0],final_url:FIXTURE_URLS[0],title:null,format:"markdown",text:"Concise accurate synonyms"}],errors:[]};}},"contract-fixture");
  const checks=retrievalChecks(e,[FIXTURE_URLS[0]]);assert.equal(searchCalls,1);assert.equal(fetchCalls,1);assert.equal(checks[0].verdict,"unknown");assert.equal(checks[1].verdict,"pass");assert.equal(checks[2].verdict,"suggestion");assert.match(checks[2].impact,/synonyms/);assert.ok(!JSON.stringify(e).includes("key should"));
});
test("fresh response fixtures give evidence-specific fixed/still-failing comparisons, exports and saved state; scope/observer changes stay unknown",async()=>{
  const fixture=await startFixtureServer();
  try {
    const before=await scan(FIXTURE_URLS,new ScanNetwork(fixture.wire),"fixture-demo");
    before.retrieval=await collectRetrieval(FIXTURE_URLS,query,retrievalFixtureWire(FIXTURE_URLS),"contract-fixture");before.tinyfish={status:"fixture",reason:"not live"};before.checks.push(...retrievalChecks(before.retrieval,FIXTURE_URLS));
    const after={...before,checks:before.checks.filter(c=>!c.source.startsWith("tinyfish-")),retrieval:await collectRetrieval(FIXTURE_URLS,query,retrievalFixtureWire(FIXTURE_URLS,true),"contract-fixture")};after.checks.push(...retrievalChecks(after.retrieval,FIXTURE_URLS));
    const comparisons=compareReports(before,after).filter(c=>c.check.source.startsWith("tinyfish-"));assert.ok(comparisons.some(c=>c.status==="fixed"));assert.ok(comparisons.some(c=>c.status==="still-failing"));
    const changedQuery={...after,retrieval:{...after.retrieval,query:"other words"},checks:after.checks.filter(c=>!c.source.startsWith("tinyfish-"))};changedQuery.checks.push(...retrievalChecks(changedQuery.retrieval,FIXTURE_URLS));
    assert.ok(compareReports(before,changedQuery).filter(c=>c.check.rule==="tinyfish.visibility"||c.check.rule==="tinyfish.query-text").every(c=>c.status==="unable-to-verify"));
    assert.ok(compareReports(before,{...after,retrieval:{...after.retrieval,provider:"tinyfish-live"}}).filter(c=>c.check.source.startsWith("tinyfish-")).every(c=>c.status==="unable-to-verify"));
    assert.match(repairPrompt(before),/CONTRACT FIXTURE/);assert.match(repairPrompt(before),/not Google rankings/);assert.match(exportMarkdown(before),/TinyFish: fixture/);
    let value="";saveState({setItem(_k,v){value=v}},{report:after,baseline:before,comparisons});const restored=loadState({getItem(){return value}});assert.equal(restored?.report.retrieval?.query,query);assert.equal(restored?.comparisons.length,comparisons.length);
    const skipped=await approvedRetrievalService(approval(),"fake").run(before,query);
    assert.equal(skipped.provider,"not-run");assert.equal(skipped.searchRequests,0);assert.equal(skipped.fetchUrls,0);
    assert.ok(retrievalChecks(skipped,FIXTURE_URLS).every(c=>c.verdict==="unknown"));
  }finally{await fixture.close();}
});
