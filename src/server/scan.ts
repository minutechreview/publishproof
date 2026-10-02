import { randomUUID } from "node:crypto";
import {
  LIMITS,
  type Check,
  type PageResult,
  type Report,
} from "../shared/model.js";
import { check, duplicateChecks, pageChecks } from "../shared/rules.js";
import { selectUrls } from "../shared/urls.js";
import { parseMetadata } from "./html.js";
import { ScanNetwork } from "./network.js";
import { evaluateRobots } from "./robots.js";
export async function scan(
  input: unknown,
  network = new ScanNetwork(),
  mode: Report["mode"] = "public-live",
): Promise<Report> {
  const urls = selectUrls(input);
  const pages: PageResult[] = [];
  const checks: Check[] = [];
  let robots: Awaited<ReturnType<ScanNetwork["fetch"]>> | undefined;
  let robotsError = "";
  try {
    robots = await network.fetch(
      new URL("/robots.txt", urls[0]).href,
      "GET",
      128 * 1024,
    );
  } catch (e) {
    robotsError = e instanceof Error ? e.message : "Robots unavailable.";
  }
  for (const url of urls) {
    let page: PageResult;
    try {
      const fetched = await network.fetch(url);
      const html = /\btext\/html\b|application\/xhtml\+xml/i.test(
        fetched.headers["content-type"] ?? "",
      );
      page = {
        url,
        finalUrl: fetched.url,
        status: fetched.status,
        redirects: fetched.redirects,
        headers: fetched.headers,
      };
      if (fetched.status >= 200 && fetched.status < 300 && html)
        page.metadata = parseMetadata(fetched.body, fetched.url);
      else if (!html && fetched.status >= 200 && fetched.status < 300)
        page.error = "Response is not declared HTML; tag checks skipped.";
    } catch (e) {
      page = {
        url,
        redirects: [],
        error: e instanceof Error ? e.message : "Page unavailable.",
      };
    }
    pages.push(page);
    checks.push(...pageChecks(page));
    const known =
      robots &&
      ((robots.status === 200 &&
        /text\/plain/i.test(robots.headers["content-type"] ?? "")) ||
        [404, 410].includes(robots.status));
    const policy =
      known && robots?.status === 200
        ? evaluateRobots(robots.body, new URL(page.finalUrl ?? url).pathname)
        : {
            blocked: false,
            evidence:
              "No robots.txt at this origin (404/410); this is allowed.",
          };
    checks.push(
      check(
        "robots",
        url,
        known ? (policy.blocked ? "fail" : "pass") : "unknown",
        "Crawler access policy",
        known
          ? policy.evidence
          : robotsError ||
              `robots.txt HTTP ${robots?.status}; plain-text policy not established.`,
        "A matching robots.txt restriction prevents compliant crawling; it does not guarantee exclusion from indexing. Restrictions may be intentional.",
        "Confirm the public route should be crawled before changing only its matching Googlebot/* rule. Preserve deliberate restrictions.",
        "The intended public route is allowed by the applicable robots policy; no robots file is required.",
        "http",
        "high",
      ),
    );
  }
  // One global sample of 15 links; separate deterministic check IDs make missing recheck coverage unknown.
  const links = [...new Set(pages.flatMap((p) => p.metadata?.links ?? []))]
    .filter((x) => !urls.includes(x))
    .slice(0, 15);
  const assets = [
    ...new Set(pages.flatMap((p) => p.metadata?.ogImages ?? [])),
  ].slice(0, 5);
  for (const [kind, targets] of [
    ["internal-link", links],
    ["og-asset", assets],
  ] as const) {
    for (const target of targets) {
      let verdict: Check["verdict"] = "unknown";
      let evidence = "";
      try {
        let result = await network.fetch(target, "HEAD");
        let method = "HEAD";
        if ([404, 410].includes(result.status)) {
          result = await network.fetch(target, "GET", 64 * 1024);
          method = "GET (after failing HEAD)";
        }
        verdict = [404, 410].includes(result.status)
          ? "fail"
          : result.status >= 200 &&
              result.status < 300 &&
              (kind === "internal-link" ||
                /image\//i.test(result.headers["content-type"] ?? ""))
            ? "pass"
            : "unknown";
        evidence = `${method} ${target}: HTTP ${result.status}; Content-Type ${result.headers["content-type"] ?? "not provided"}.`;
      } catch (e) {
        evidence = e instanceof Error ? e.message : "Resource unavailable.";
      }
      const emailPlaceholder = kind === "internal-link" && new URL(target).pathname === "/cdn-cgi/l/email-protection";
      if (emailPlaceholder) {
        verdict = "unknown";
        evidence += " This is a Cloudflare-style email-obfuscation placeholder. Its raw HTTP response does not establish whether the decoded contact link works in a browser.";
      }
      for (const p of pages.filter((p) =>
        (kind === "internal-link"
          ? p.metadata?.links
          : p.metadata?.ogImages
        )?.includes(target),
      ))
        checks.push(
          check(
            kind,
            p.url,
            verdict,
            kind === "og-asset"
              ? "Social preview image response"
              : emailPlaceholder ? "Verify the decoded contact link"
              : "Sampled internal link response",
            evidence,
            kind === "og-asset"
              ? "A missing OG image can break shared previews. HEAD success does not prove image pixels or preview appearance."
              : emailPlaceholder ? "Email obfuscation may intentionally replace this placeholder in a browser. The raw scanner cannot verify the final contact action."
              : "A missing destination interrupts navigation. HEAD is only a bounded response check, not a user journey.",
            kind === "og-asset"
              ? "Correct the existing OG image URL or restore its public asset. Preserve intended branding."
              : emailPlaceholder ? "Verify the visible contact link in a signed-out browser with normal scripts. Preserve intentional email protection; change only a demonstrated user-facing failure."
              : "Repair the exact broken internal destination or link. Do not mask real 404s with universal success.",
            kind === "og-asset"
              ? "This image URL returns 2xx with image Content-Type; visually verify a real preview."
              : emailPlaceholder ? "The decoded contact link opens the intended action. No message or form is sent during verification."
              : "A fresh direct GET opens the intended linked page; manually verify navigation.",
            "http",
            "medium",
            target,
          ),
        );
    }
  }
  checks.push(...duplicateChecks(pages));
  checks.push(
    check(
      "indexing",
      urls[0],
      "unknown",
      "Actual indexing needs Search Console",
      "No owner Search Console integration is connected.",
      "No directive or response check can establish actual search indexing, rankings, or traffic.",
      "Use the owner’s Search Console URL Inspection and performance reports.",
      "Owner verifies the selected URLs and intended search presence.",
      "owner-integration",
      "low",
    ),
  );
  checks.push(
    check(
      "citations",
      urls[0],
      "unknown",
      "Citations are three different questions",
      "Content sources, local business mentions, and AI answer citations are not verified in this sample.",
      "Source links support content claims; business citations refer to directory mentions; AI citations refer to attribution in specific answers. There is no universal citation tag.",
      "Clarify the desired citation concept. Review source quality, directory consistency, or observed AI answers separately. Do not fabricate endorsements or citations.",
      "Owner selects a citation goal and verifies it with relevant external evidence.",
      "owner-integration",
      "low",
    ),
  );
  return {
    version: 1,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    mode,
    urls,
    pages,
    checks,
    requestCount: network.count,
    limits: LIMITS,
    tinyfish: {
      status: "inactive",
      reason:
        "Search/Fetch not selected or scoped service inactive. Agent/Browser inactive. No live TinyFish calls in this raw HTTP report.",
    },
  };
}
