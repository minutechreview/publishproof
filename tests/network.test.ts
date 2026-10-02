import { test } from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import {
  isPublicIp,
  resolvePublicTarget,
  ScanNetwork,
  type Transport,
} from "../src/server/network.js";
import { LIMITS } from "../src/shared/model.js";
test("private, loopback, reserved, link-local, multicast and mapped private IPs are blocked", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.1.1",
    "192.168.1.1",
    "172.20.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.1.1.1",
    "192.0.2.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])
    assert.equal(isPublicIp(address), false, address);
  assert.equal(isPublicIp("93.184.216.34"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});
test("IP spelling variants and private names cannot bypass URL normalization", async () => {
  for (const address of [
    "http://2130706433/",
    "http://0x7f000001/",
    "http://127.1/",
    "http://localhost/",
    "http://service.internal/",
    "http://[::ffff:127.0.0.1]/",
    "https://example.com:444/",
  ])
    await assert.rejects(resolvePublicTarget(address));
});
test("mixed public/private DNS answers fail closed; public address is pinned as returned target", async () => {
  const mixed = (async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ]) as unknown as typeof dns.lookup;
  await assert.rejects(
    resolvePublicTarget("https://example.com/", mixed),
    /Private/,
  );
  const publicOnly = (async () => [
    { address: "93.184.216.34", family: 4 },
  ]) as unknown as typeof dns.lookup;
  assert.equal(
    (await resolvePublicTarget("https://example.com/", publicOnly)).address,
    "93.184.216.34",
  );
});
test("redirects never follow a new origin and URL tokens are stripped", async () => {
  const seen: string[] = [];
  const wire: Transport = {
    request: async (url) => {
      seen.push(url);
      return {
        url,
        status: 302,
        headers: { location: "http://127.0.0.1/" },
        body: "",
      };
    },
  };
  await assert.rejects(
    new ScanNetwork(wire).fetch("https://example.com/?token=SECRET"),
    /Cross-origin/,
  );
  assert.deepEqual(seen, ["https://example.com/"]);
});
test("redirect loop and more than three hops are bounded", async () => {
  let count = 0;
  const loop: Transport = {
    request: async (url) => ({
      url,
      status: 302,
      headers: { location: "/loop" },
      body: "",
    }),
  };
  await assert.rejects(
    new ScanNetwork(loop).fetch("https://example.com/loop"),
    /loop/,
  );
  const chain: Transport = {
    request: async (url) => ({
      url,
      status: 302,
      headers: { location: `/hop-${++count}` },
      body: "",
    }),
  };
  await assert.rejects(
    new ScanNetwork(chain).fetch("https://example.com/"),
    /three redirects/,
  );
  assert.equal(count, 4);
});
test("request and wall-clock budgets stop calls before transport execution", async () => {
  let called = 0;
  const wire: Transport = {
    request: async (url) => {
      called++;
      return { url, status: 200, headers: {}, body: "" };
    },
  };
  const n = new ScanNetwork(wire);
  n.count = LIMITS.requests;
  await assert.rejects(n.fetch("https://example.com/"), /limit/);
  assert.equal(called, 0);
  const timed = new ScanNetwork(wire);
  Object.defineProperty(timed, "deadline", { value: Date.now() - 1 });
  await assert.rejects(timed.fetch("https://example.com/"), /limit/);
  assert.equal(called, 0);
});
