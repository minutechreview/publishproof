import { collectRetrieval, type RetrievalService, type RetrievalWire } from "../src/server/retrieval.js";

// Synthetic API response contracts, NOT TinyFish execution or proof of live-page visibility.
export function retrievalFixtureWire(urls: string[], revised = false): RetrievalWire {
  return {
    async search(query) {return {query,page:0,total_results: revised ? 2 : 1,results:revised ? urls.filter((_,i)=>i!==1).map((url,i)=>({url,position:i+1,title:"Launch pricing",snippet:"Public launch pricing and release guidance."})) : [{url:"https://other.example/launch",position:1,title:"Other launch guide",snippet:"A synthetic competing result; not a Google ranking."}]};},
    async fetch() {return {results:urls.filter((_,i)=>i!==1).map((url,i)=>({url,final_url:url,title:"Extracted OG-style title",format:"markdown",text:revised ? `# Launch pricing\nClear visible launch pricing for public readers on ${new URL(url).pathname}.` : i===0 ? "" : "# Pricing\nPlans for public readers."})),errors:urls.filter((_,i)=>i===1).map(url=>({url,error:"bot_blocked"}))};}
  };
}
export function retrievalFixtureService(): RetrievalService {
  let runs=0;
  return {kind:"fixture",run(report,query){return collectRetrieval(report.urls,query,retrievalFixtureWire(report.urls,runs++>0),"contract-fixture");}};
}
