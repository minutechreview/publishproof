import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMetadata } from "../src/server/html.js";
import {
  pageChecks,
  metadataChecks,
  renderedChecks,
  duplicateChecks,
} from "../src/shared/rules.js";
import { evaluateRobots } from "../src/server/robots.js";
import { safeUrl, selectUrls } from "../src/shared/urls.js";
import { fixtureHtml, FIXTURE_ORIGIN } from "./fixtures.js";
const url = FIXTURE_ORIGIN + "/";
const metadata = parseMetadata(fixtureHtml("/"), url);
const page = {
  url,
  finalUrl: url,
  status: 200,
  redirects: [],
  metadata,
  headers: {},
};
const find = (rule: string) => pageChecks(page).find((x) => x.rule === rule)!;
test("raw parsing decodes entities and does not use OG title", () => {
  const m = parseMetadata(
    '<title>Actual &amp; Raw</title><meta property="og:title" content="Social">',
    url,
  );
  assert.deepEqual(m.titles, ["Actual & Raw"]);
});
test("head tags respect HTML parser context and ignore fake tags in scripts/comments", () => {
  const m = parseMetadata(
    '<head><title>Real</title><!-- <title>Fake</title> --><script>let x="<title>Fake</title>";</script></head><body><meta name="robots" content="noindex">',
    url,
  );
  assert.deepEqual(m.titles, ["Real"]);
  assert.deepEqual(m.robots, []);
});
test("existing malformed JSON-LD and missing alt produce concrete failures", () => {
  const m = parseMetadata(fixtureHtml("/guide"), FIXTURE_ORIGIN + "/guide");
  assert.equal(
    metadataChecks(url, m).find((x) => x.rule === "jsonld")?.verdict,
    "fail",
  );
  assert.equal(find("alt").verdict, "fail");
  assert.equal(
    metadataChecks(url, { ...m, missingAlt: 0 }).find((x) => x.rule === "alt")
      ?.verdict,
    "pass",
  );
});
test("noindex is not a substring test; none is restrictive; nofollow is review", () => {
  assert.equal(find("noindex").verdict, "fail");
  const m = { ...metadata, robots: ["robots: noindexing, nofollow"] };
  assert.equal(
    metadataChecks(url, m).find((x) => x.rule === "noindex")?.verdict,
    "pass",
  );
  assert.equal(
    metadataChecks(url, m).find((x) => x.rule === "nofollow")?.verdict,
    "suggestion",
  );
  assert.equal(
    metadataChecks(url, { ...m, robots: ["robots: none"] }).find(
      (x) => x.rule === "noindex",
    )?.verdict,
    "fail",
  );
});
test("generic and Googlebot HTTP noindex are failures; other-agent scope is not", () => {
  for (const [header, verdict] of [
    ["noindex", "fail"],
    ["googlebot: noindex", "fail"],
    ["bingbot: noindex", "pass"],
  ])
    assert.equal(
      pageChecks({ ...page, headers: { "x-robots-tag": header } }).find(
        (x) => x.rule === "header-noindex",
      )?.verdict,
      verdict,
    );
});
test("HTML and HTTP canonical contradictions are checked together", () => {
  const checks = pageChecks({
    ...page,
    headers: { link: `<${url}other>; rel="canonical"` },
  });
  assert.equal(checks.find((x) => x.rule === "canonical")?.verdict, "fail");
});
test("missing canonical and description are review; absent schema is not a failure", () => {
  const checks = metadataChecks(url, parseMetadata("<title>Page</title>", url));
  assert.equal(
    checks.find((x) => x.rule === "canonical")?.verdict,
    "suggestion",
  );
  assert.equal(
    checks.find((x) => x.rule === "description")?.verdict,
    "suggestion",
  );
  assert.equal(checks.find((x) => x.rule === "jsonld")?.verdict, "pass");
});
test("HTTP bot blocks are unknown while 404 and 503 are response failures", () => {
  for (const [status, verdict] of [
    [403, "unknown"],
    [401, "unknown"],
    [429, "unknown"],
    [404, "fail"],
    [503, "fail"],
  ] as const)
    assert.equal(
      pageChecks({ ...page, status, metadata: undefined })[0].verdict,
      verdict,
    );
});
test("robots evaluates longest matching rule, allow tie, wildcard end, and specific group override", () => {
  const body =
    "User-agent: *\nDisallow: /\nUser-agent: Googlebot\nDisallow: /docs\nAllow: /docs/open\nDisallow: /*.pdf$\n";
  assert.equal(evaluateRobots(body, "/home").blocked, false);
  assert.equal(evaluateRobots(body, "/docs").blocked, true);
  assert.equal(evaluateRobots(body, "/docs/open").blocked, false);
  assert.equal(evaluateRobots(body, "/file.pdf").blocked, true);
  assert.equal(
    evaluateRobots("User-agent: *\nDisallow: /x\nAllow: /x\n", "/x").blocked,
    false,
  );
});
test("robots merges repeated applicable groups and empty disallow allows", () => {
  assert.equal(
    evaluateRobots("User-agent: *\nDisallow:\n", "/").blocked,
    false,
  );
  assert.equal(
    evaluateRobots(
      "User-agent: Googlebot\nDisallow: /a\nUser-agent: Googlebot\nDisallow: /b\n",
      "/b",
    ).blocked,
    true,
  );
});
test("duplicates are sample suggestions and incomplete sample cannot pass uniqueness", () => {
  const second = { ...page, url: url + "guide", finalUrl: url + "guide" };
  assert.equal(duplicateChecks([page, second])[0].verdict, "suggestion");
  assert.equal(
    duplicateChecks([page, { url: url + "unavailable", redirects: [] }])[0]
      .verdict,
    "unknown",
  );
});
test("raw versus rendered difference is a qualified suggestion, not indexing failure", () => {
  const checks = renderedChecks(page, {
    ...metadata,
    titles: ["Hydrated title"],
  });
  assert.equal(
    checks.find((x) => x.rule === "render-diff.titles")?.verdict,
    "suggestion",
  );
  assert.match(
    checks.find((x) => x.rule === "render-diff.titles")!.impact,
    /not Googlebot/,
  );
});
test("URL redaction strips every query and fragment and rejects private/token paths", () => {
  assert.equal(safeUrl(url + "guide?token=secret#private"), url + "guide");
  for (const path of [
    "account",
    "logout",
    "checkout",
    "api/key",
    "reset/token",
    "foo/token-secret",
    "x".repeat(45),
  ])
    assert.throws(() => safeUrl(url + path));
  assert.throws(() => safeUrl("https://user:secret@example.com"));
  assert.throws(() => safeUrl("javascript:alert(1)"));
});
test("route selection deduplicates cleaned paths and enforces origin and count", () => {
  assert.deepEqual(selectUrls([url, url + "?utm=one"]), [url]);
  assert.throws(() => selectUrls([url, "https://other.example/"]));
  assert.throws(() => selectUrls(Array(6).fill(url)));
});
test("query-dependent link and asset references are omitted without false failure claims", () => {
  const m = parseMetadata(
    '<head><meta property="og:image" content="/image.png?sig=SECRET"></head><body><a href="/guide?token=SECRET">guide</a><a href="/logout">logout</a>',
    url,
  );
  assert.deepEqual(m.links, []);
  assert.deepEqual(m.ogImages, []);
  assert.equal(m.skippedQueryReferences, 2);
});

test("robots normalizes encoded unreserved and UTF-8 paths but keeps encoded slashes distinct", () => {
  assert.equal(
    evaluateRobots("User-agent: *\nDisallow: /café\n", "/caf%C3%A9").blocked,
    true,
  );
  assert.equal(
    evaluateRobots("User-agent: *\nDisallow: /~page\n", "/%7Epage").blocked,
    true,
  );
  assert.equal(
    evaluateRobots("User-agent: *\nDisallow: /a/b\n", "/a%2Fb").blocked,
    false,
  );
});
test("selected targets reject literal IPs, private names, and nonstandard ports before scanning", () => {
  for (const target of [
    "http://127.0.0.1/",
    "http://172.16.0.1/",
    "http://[::1]/",
    "http://local.internal/",
    "http://localhost/",
    "https://example.com:8888/",
  ])
    assert.throws(() => selectUrls([target]));
});

test("query-dependent canonical is unknown instead of a false contradiction", () => {
  const m = parseMetadata(
    '<link rel="canonical" href="/?id=1"><link rel="canonical" href="/">',
    url,
  );
  assert.equal(
    metadataChecks(url, m).find((x) => x.rule === "canonical")?.verdict,
    "unknown",
  );
  assert.ok(!JSON.stringify(m).includes("?id="));
});
test("long robots wildcard patterns do not invoke exponential regex matching", () => {
  const body = "User-agent: *\nDisallow: /" + "*a".repeat(2000) + "z$\n";
  assert.equal(
    evaluateRobots(body, "/" + "a".repeat(2000) + "b").blocked,
    false,
  );
});

test("HTTP canonical relation accepts parameter order and relation lists", () => {
  const checks = pageChecks({
    ...page,
    headers: {
      link: `<${url}other>; type="text/html"; rel="alternate canonical", <${url}>; rel=canonical`,
    },
  });
  assert.equal(checks.find((x) => x.rule === "canonical")?.verdict, "fail");
});
