import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/server/app.js";
import { scan } from "../src/server/scan.js";
import { ScanNetwork } from "../src/server/network.js";
import { startFixtureServer, FIXTURE_URLS } from "./fixtures.js";
import { retrievalFixtureService } from "./retrieval-fixtures.js";
let origin = "http://127.0.0.1:4317";
function request(
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
  body = "",
) {
  return new Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const req = http.request(origin + path, { method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: data,
        }),
      );
    });
    req.on("error", reject);
    req.end(body);
  });
}
test("local API validates host, browser origin, ephemeral pairing token, consent, limits, and no TinyFish route", async () => {
  const fixtures = await startFixtureServer();
  const app = createApp(
    (urls) => scan(urls, new ScanNetwork(fixtures.wire), "fixture-demo"),
    "fixture-demo",
  );
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  const address = app.address();
  if (!address || typeof address === "string")
    throw new Error("App address unavailable.");
  origin = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await request("/api/session")).status, 403);
    assert.equal(
      (
        await request("/api/session", "GET", {
          Origin: "https://malicious.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/session", "GET", {
          Origin: origin,
          Host: "evil.example:4317",
        })
      ).status,
      403,
    );
    const session = await request("/api/session", "GET", { Origin: origin });
    assert.equal(session.status, 200);
    const token = JSON.parse(session.body).token;
    assert.equal(
      (
        await request("/api/session", "GET", {
          "Sec-Fetch-Site": "same-origin",
        })
      ).status,
      200,
    );
    const extension = "chrome-extension://" + "a".repeat(32);
    const extensionSession = await request("/api/session", "POST", {
      Origin: extension,
      "Sec-Fetch-Site": "none",
    });
    assert.equal(extensionSession.status, 200);
    assert.equal(extensionSession.headers["access-control-allow-origin"], extension);
    assert.equal(JSON.parse(extensionSession.body).token, token);
    assert.equal(
      (await request("/api/session", "POST", {"Sec-Fetch-Site": "none"})).status,
      403,
    );
    assert.equal(
      (await request("/api/session", "POST", {Origin: "https://malicious.example"})).status,
      403,
    );
    assert.equal(
      (await request("/api/session", "GET", { Origin: extension })).status,
      200,
    );
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      "X-PublishProof-Token": token,
    };
    assert.equal(
      (
        await request(
          "/api/scan",
          "POST",
          { ...headers, "X-PublishProof-Token": "wrong" },
          "{}",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "/api/scan",
          "POST",
          headers,
          JSON.stringify({ urls: FIXTURE_URLS }),
        )
      ).status,
      400,
    );
    assert.equal(
      (await request("/api/scan", "POST", headers, "x".repeat(17000))).status,
      413,
    );
    assert.equal(
      (await request("/api/tinyfish", "POST", headers, "{}")).status,
      404,
    );
    assert.equal(
      (await request("/api/scan","POST",headers,JSON.stringify({consent:true,urls:FIXTURE_URLS,tinyfish:{enabled:true,query:"launch pricing",remoteConsent:true}}))).status,
      400,
    );
    const result = await request(
      "/api/scan",
      "POST",
      headers,
      JSON.stringify({ consent: true, urls: FIXTURE_URLS }),
    );
    assert.equal(result.status, 200);
    assert.equal(JSON.parse(result.body).report.mode, "fixture-demo");
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.headers["access-control-allow-origin"], origin);
    const bad = await request(
      "/api/scan",
      "POST",
      headers,
      JSON.stringify({
        consent: true,
        urls: ["https://launch.example/", "https://other.example/"],
      }),
    );
    assert.equal(bad.status, 400);
    await request(
      "/api/scan",
      "POST",
      headers,
      JSON.stringify({ consent: true, urls: FIXTURE_URLS }),
    );
    assert.equal(
      (
        await request(
          "/api/scan",
          "POST",
          headers,
          JSON.stringify({ consent: true, urls: FIXTURE_URLS }),
        )
      ).status,
      429,
    );
    assert.equal((await request("/../../.env")).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      app.close((e) => (e ? reject(e) : resolve())),
    );
    await fixtures.close();
  }
});

test("Search/Fetch API opt-in enforces separate consent, fixture provenance, optional query and raw-only recheck coverage",async()=>{
  const fixtures=await startFixtureServer();
  const app=createApp(urls=>scan(urls,new ScanNetwork(fixtures.wire),"fixture-demo"),"fixture-demo",retrievalFixtureService());
  await new Promise<void>(resolve=>app.listen(0,"127.0.0.1",resolve));
  const address=app.address();if(!address||typeof address==="string")throw Error("address missing");
  origin=`http://127.0.0.1:${address.port}`;
  try {
    const session=JSON.parse((await request("/api/session","POST",{Origin:origin})).body);
    assert.equal(session.retrieval,"fixture");
    const headers={Origin:origin,"Content-Type":"application/json","X-PublishProof-Token":session.token};
    const input={consent:true,urls:FIXTURE_URLS,tinyfish:{enabled:true,query:"launch pricing",remoteConsent:false}};
    assert.equal((await request("/api/scan","POST",headers,JSON.stringify(input))).status,400);
    const first=JSON.parse((await request("/api/scan","POST",headers,JSON.stringify({...input,tinyfish:{...input.tinyfish,remoteConsent:true}}))).body).report;
    assert.equal(first.retrieval.provider,"contract-fixture");assert.equal(first.retrieval.query,"launch pricing");assert.equal(first.tinyfish.status,"fixture");assert.ok(first.checks.some((c:{source:string})=>c.source==="tinyfish-search"));
    const discovered=JSON.parse((await request("/api/scan","POST",headers,JSON.stringify({...input,tinyfish:{enabled:true,remoteConsent:true}}))).body).report;
    assert.equal(discovered.retrieval.query, FIXTURE_URLS[0]);assert.equal(discovered.retrieval.queryKind,"url-discovery");
    const raw=JSON.parse((await request("/api/scan","POST",headers,JSON.stringify({urls:FIXTURE_URLS,consent:true}))).body).report;
    assert.equal(raw.retrieval,undefined);assert.equal(raw.tinyfish.status,"inactive");
  }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));await fixtures.close();}
});
