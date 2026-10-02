import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import type { Report } from "../shared/model.js";
import { scan } from "./scan.js";
import type { RetrievalService } from "./retrieval.js";
import { retrievalChecks, searchQuery } from "../shared/retrieval.js";
const port = 4317;
export function createApp(
  audit: (urls: unknown) => Promise<Report> = scan,
  mode: Report["mode"] = "public-live",
  retrieval?: RetrievalService,
) {
  const token = randomBytes(24).toString("hex");
  let busy = false;
  const starts: number[] = [];
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const boundPort =
      address && typeof address !== "string" ? address.port : port;
    const send = (status: number, body: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    // Host validation prevents browser DNS-rebinding access to a service bound to loopback.
    if (req.headers.host !== `127.0.0.1:${boundPort}`) {
      send(403, { error: "Use the exact loopback host 127.0.0.1:4317." });
      return;
    }
    const origin = req.headers.origin;
    const own = `http://127.0.0.1:${boundPort}`;
    const allowed =
      origin === own || /^chrome-extension:\/\/[a-p]{32}$/.test(origin ?? "");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:4317; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin!);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-PublishProof-Token",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      if (!allowed) send(403, { error: "Origin denied." });
      else {
        res.writeHead(204);
        res.end();
      }
      return;
    }
    const route = new URL(req.url ?? "/", own).pathname;
    if (route.startsWith("/api/")) {
      // Same-origin GET fetches may omit Origin; require browser Fetch Metadata then.
      const sameOriginGet =
        req.method === "GET" && req.headers["sec-fetch-site"] === "same-origin";
      if (!allowed && !sameOriginGet) {
        send(403, {
          error: "Open the local report or the extension to connect.",
        });
        return;
      }
      if (
        route === "/api/session" &&
        (req.method === "GET" || req.method === "POST")
      ) {
        send(200, { token, mode, tinyfish: "inactive", retrieval: retrieval?.kind ?? "inactive" });
        return;
      }
      const supplied = req.headers["x-publishproof-token"];
      if (
        typeof supplied !== "string" ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
      ) {
        send(403, { error: "Reconnect the report to the local helper." });
        return;
      }
      if (route !== "/api/scan" || req.method !== "POST") {
        send(404, { error: "Unknown API route. TinyFish is inactive." });
        return;
      }
      if (busy) {
        send(429, {
          error: "A scan is already running. Wait for it to finish.",
        });
        return;
      }
      const now = Date.now();
      while (starts.length && starts[0] < now - 60000) starts.shift();
      if (starts.length >= 3) {
        send(429, {
          error: "Local limit: three scans per minute. Try again shortly.",
        });
        return;
      }
      let size = 0;
      let body = "";
      try {
        const bodyTimer = setTimeout(() => req.destroy(), 5000);
        bodyTimer.unref();
        try {
          for await (const chunk of req) {
            size += Buffer.byteLength(chunk);
            if (size > 16384) {
              send(413, { error: "Request too large." });
              return;
            }
            body += chunk;
          }
        } finally {
          clearTimeout(bodyTimer);
        }
        const input = JSON.parse(body) as { consent?: boolean; urls?: unknown; tinyfish?: {enabled?: boolean; query?: unknown; remoteConsent?: boolean} };
        if (input.consent !== true) {
          send(400, { error: "Public-site consent is required." });
          return;
        }
        if (input.tinyfish?.enabled && (!retrieval || input.tinyfish.remoteConsent !== true)) {
          send(400, {error: "Search/Fetch is inactive or remote consent is missing. Complete scoped server-side setup or run raw checks only."});
          return;
        }
        busy = true;
        starts.push(Date.now());
        try {
          const report = await audit(input.urls);
          if (input.tinyfish?.enabled && retrieval) {
            const query = searchQuery(input.tinyfish.query, report.urls[0]);
            report.retrieval = await retrieval.run(report, query);
            report.checks.push(...retrievalChecks(report.retrieval, report.urls));
            report.tinyfish = {
              status: report.retrieval.provider === "tinyfish-live" ? "live" : report.retrieval.provider === "contract-fixture" ? "fixture" : "inactive",
              reason: report.retrieval.provider === "tinyfish-live" ? "Live TinyFish Search and Fetch observations. Agent/Browser inactive." : report.retrieval.provider === "contract-fixture" ? "Contract fixtures only. No live TinyFish calls." : "Remote checks not run; no provider requests. Review raw findings.",
            };
          }
          send(200, { report });
        } finally {
          busy = false;
        }
      } catch (e) {
        send(400, {
          error:
            e instanceof Error
              ? e.message
              : "Unable to scan. Check the chosen public URLs.",
        });
      }
      return;
    }
    if (req.method !== "GET") {
      send(405, { error: "Read-only local UI." });
      return;
    }
    // Static allowlist, not user-controlled paths.
    const fileMap: Record<string, string> = {
      "/": "report.html",
      "/report.html": "report.html",
      "/report.js": "report.js",
      "/styles.css": "styles.css",
    };
    if (!fileMap[route]) {
      send(404, { error: "Not found." });
      return;
    }
    try {
      const content = await readFile(resolve("dist/extension", fileMap[route]));
      res.setHeader(
        "Content-Type",
        route.endsWith(".js")
          ? "text/javascript"
          : route.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      res.end(content);
    } catch {
      send(503, { error: "Run npm run build before opening the report." });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return server;
}
