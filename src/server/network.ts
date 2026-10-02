import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import ipaddr from "ipaddr.js";
import { safeUrl } from "../shared/urls.js";
import { LIMITS } from "../shared/model.js";
export interface FetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  redirects: string[];
}
export interface Transport {
  request(
    url: string,
    method: "GET" | "HEAD",
    bytes: number,
    deadline: number,
  ): Promise<Omit<FetchResult, "redirects">>;
}
export function isPublicIp(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export async function resolvePublicTarget(
  input: string,
  lookup = dns.lookup,
): Promise<{ url: URL; address: string; family: number }> {
  const url = new URL(safeUrl(input));
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("Only standard public HTTP(S) ports are allowed.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    /\.(?:localhost|local|internal|test)$/.test(hostname) ||
    (!hostname.includes(".") && !net.isIP(hostname))
  )
    throw new Error("Private host blocked.");
  const answers = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some((x) => !isPublicIp(x.address)))
    throw new Error("Private or reserved IP blocked.");
  return { url, ...answers[0] };
}
const transport: Transport = {
  async request(input, method, maxBytes, deadline) {
    const remaining = Math.min(5000, deadline - Date.now());
    if (remaining <= 0) throw new Error("Scan time limit reached.");
    // Bound DNS as well as the HTTP request; pin the vetted address in the socket lookup.
    const target = await Promise.race([
      resolvePublicTarget(input),
      new Promise<never>((_, reject) => {
        const t = setTimeout(
          () => reject(new Error("DNS timed out.")),
          remaining,
        );
        t.unref();
      }),
    ]);
    return new Promise((resolve, reject) => {
      const client = target.url.protocol === "https:" ? https : http;
      const req = client.request(
        target.url,
        {
          method,
          agent: false,
          family: target.family,
          lookup: (_hostname, _options, callback) =>
            callback(null, target.address, target.family),
          headers: {
            "User-Agent": "PublishProof/0.1 public-readiness-audit",
            Accept: "text/html,image/*;q=0.8,*/*;q=0.5",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
        (res) => {
          const headers: Record<string, string> = {};
          for (const [name, value] of Object.entries(res.headers))
            if (
              value !== undefined &&
              [
                "location",
                "content-type",
                "content-length",
                "content-encoding",
                "x-robots-tag",
                "link",
                "cache-control",
                "age",
              ].includes(name)
            )
              headers[name] = Array.isArray(value) ? value.join(", ") : value;
          if (headers.link)
            headers.link = headers.link.replace(
              /<([^>]+)>/g,
              (_match, value: string) => {
                try {
                  if (new URL(value, input).search)
                    return "<[query-dependent URL omitted]>";
                  return `<${safeUrl(value, input)}>`;
                } catch {
                  return "<[unsafe URL omitted]>";
                }
              },
            );
          const finish = (body: string) =>
            resolve({ url: input, status: res.statusCode ?? 0, headers, body });
          if (
            method === "HEAD" ||
            [301, 302, 303, 307, 308].includes(res.statusCode ?? 0)
          ) {
            res.destroy();
            finish("");
            return;
          }
          if (
            headers["content-encoding"] &&
            headers["content-encoding"] !== "identity"
          ) {
            res.destroy();
            reject(new Error("Compressed response not inspected."));
            return;
          }
          if (Number(headers["content-length"]) > maxBytes) {
            res.destroy();
            reject(new Error("Response size limit reached."));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              res.destroy();
              reject(new Error("Response size limit reached."));
            } else chunks.push(chunk);
          });
          res.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
          res.on("error", reject);
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error("Request timed out.")),
        Math.max(1, Math.min(5000, deadline - Date.now())),
      );
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    });
  },
};
export class ScanNetwork {
  count = 0;
  readonly deadline = Date.now() + LIMITS.seconds * 1000;
  constructor(private readonly wire: Transport = transport) {}
  async fetch(
    input: string,
    method: "GET" | "HEAD" = "GET",
    bytes = LIMITS.maxPageBytes,
  ): Promise<FetchResult> {
    let current = safeUrl(input);
    const origin = new URL(current).origin;
    const redirects: string[] = [];
    const seen = new Set<string>();
    for (let hop = 0; hop <= 3; hop++) {
      if (seen.has(current)) throw new Error("Redirect loop.");
      seen.add(current);
      if (++this.count > LIMITS.requests || Date.now() >= this.deadline)
        throw new Error("Scan request/time limit reached.");
      const result = await this.wire.request(
        current,
        method,
        bytes,
        this.deadline,
      );
      if (![301, 302, 303, 307, 308].includes(result.status))
        return { ...result, redirects };
      if (!result.headers.location)
        throw new Error("Redirect has no Location.");
      const next = safeUrl(result.headers.location, current);
      if (new URL(next).origin !== origin)
        throw new Error(
          "Cross-origin redirect blocked. Choose the final public origin.",
        );
      // Every subsequent transport request independently validates DNS and pins its address.
      redirects.push(current);
      current = next;
    }
    throw new Error("More than three redirects.");
  }
}
