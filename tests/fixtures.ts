import http from "node:http";
import type { Transport } from "../src/server/network.js";
export const FIXTURE_ORIGIN = "https://launch.example";
export const FIXTURE_URLS = [
  `${FIXTURE_ORIGIN}/`,
  `${FIXTURE_ORIGIN}/guide`,
  `${FIXTURE_ORIGIN}/pricing`,
];
export function fixtureHtml(path: string, fixed = false): string {
  const title =
    path === "/pricing" && !fixed
      ? ""
      : `<title>${path === "/" ? "Launch Studio" : path === "/guide" ? "Launch Guide" : "Pricing"} &amp; Tools</title>`;
  const robots =
    path === "/" && !fixed
      ? '<meta name="robots" content="noindex, follow">'
      : "";
  const canonical =
    path === "/guide"
      ? `<link rel="canonical" href="${FIXTURE_ORIGIN}/guide"><link rel="canonical" href="${FIXTURE_ORIGIN}/">`
      : `<link rel="canonical" href="${FIXTURE_ORIGIN}${path}">`;
  const json =
    path === "/guide"
      ? '<script type="application/ld+json">{"@context":"https://schema.org", bad}</script>'
      : '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Launch Studio"}</script>';
  return `<!doctype html><html lang="en"><head>${title}<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${fixed ? "An intentional public launch page." : "A shared launch description."}">${robots}${canonical}<meta property="og:image" content="${FIXTURE_ORIGIN}/preview.png">${json}</head><body><h1>Launch Studio</h1><nav><a href="/">Home</a><a href="/guide">Guide</a><a href="/pricing">Pricing</a><a href="/missing">Examples</a><a href="/account">Private account</a><a href="/guide?token=DO_NOT_SEND">Guide tracking</a></nav><img src="/logo.png" ${fixed ? 'alt=""' : ""}><p>A public seeded fixture, not a live customer site.</p></body></html>`;
}
export async function startFixtureServer() {
  let fixed = false;
  const server = http.createServer((req, res) => {
    const path = new URL(req.url ?? "/", FIXTURE_ORIGIN).pathname;
    res.setHeader("Cache-Control", "no-store");
    if (path === "/robots.txt") {
      res.setHeader("Content-Type", "text/plain");
      res.end(
        `User-agent: *\nDisallow: /private\n${fixed ? "" : "Disallow: /pricing\n"}Allow: /pricing/public\n`,
      );
      return;
    }
    if (path === "/email-obfuscated") {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><title>Public contact</title><a href="/cdn-cgi/l/email-protection#encoded">Email</a><a href="/missing">Missing page</a>');
      return;
    }
    if (path === "/loop") {
      res.writeHead(302, { Location: "/loop" });
      res.end();
      return;
    }
    if (path === "/external") {
      res.writeHead(302, { Location: "http://127.0.0.1/" });
      res.end();
      return;
    }
    if (path === "/redirect") {
      res.writeHead(301, { Location: "/guide" });
      res.end();
      return;
    }
    if (path === "/oversize") {
      res.setHeader("Content-Type", "text/html");
      res.end("x".repeat(2 * 1024 * 1024));
      return;
    }
    if (path === "/preview.png") {
      res.writeHead(fixed ? 200 : 404, { "Content-Type": "image/png" });
      res.end();
      return;
    }
    if (path === "/missing") {
      res.writeHead(fixed ? 200 : 404, { "Content-Type": "text/html" });
      res.end(fixed ? fixtureHtml(path, true) : "Not found");
      return;
    }
    if (path === "/pricing" && fixed) {
      res.writeHead(503, { "Content-Type": "text/html" });
      res.end("Temporary fixture outage");
      return;
    }
    if (["/", "/guide", "/pricing"].includes(path)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(fixtureHtml(path, fixed));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture server address unavailable.");
  // Test-only transport maps exactly one inert origin to a server we created. No environment flag,
  // production import, or user-controlled allow-private toggle can select this transport.
  const wire: Transport = {
    request: async (url, method, bytes, deadline) => {
      const parsed = new URL(url);
      if (parsed.origin !== FIXTURE_ORIGIN)
        throw new Error("Test transport origin denied.");
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: address.port,
            path: parsed.pathname,
            method,
            headers: { "Cache-Control": "no-cache" },
          },
          (res) => {
            const headers: Record<string, string> = {};
            for (const [name, value] of Object.entries(res.headers))
              if (typeof value === "string") headers[name] = value;
            let size = 0;
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > bytes) {
                res.destroy();
                reject(new Error("Response size limit reached."));
              } else chunks.push(chunk);
            });
            res.on("end", () =>
              resolve({
                url,
                status: res.statusCode ?? 0,
                headers,
                body: Buffer.concat(chunks).toString("utf8"),
              }),
            );
            res.on("error", reject);
          },
        );
        req.setTimeout(Math.max(1, Math.min(5000, deadline - Date.now())), () =>
          req.destroy(new Error("Fixture timeout.")),
        );
        req.on("error", reject);
        req.end();
      });
    },
  };
  return {
    server,
    wire,
    redeploy: () => {
      fixed = true;
    },
    reset: () => {
      fixed = false;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
