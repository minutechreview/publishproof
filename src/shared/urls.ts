// Query strings/fragments are never sent or retained. Conservative path screening is intentional.
export function safeUrl(input: string, base?: string): string {
  if (typeof input !== "string" || input.length > 2048)
    throw new Error("Use a URL shorter than 2,048 characters.");
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    throw new Error(
      "Enter a valid public URL beginning with http:// or https://.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Only credential-free HTTP(S) pages are supported.");
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    throw new Error("Invalid URL encoding.");
  }
  if (
    /(?:^|\/)(?:login|logout|sign-?in|sign-?out|admin|dashboard|account|checkout|cart|auth|oauth|api|reset|verify|private)(?:\/|$)/i.test(
      path,
    ) ||
    /(?:token|secret|session|password|credential)[=/:_-]/i.test(path) ||
    /[A-Za-z0-9_-]{40,}/.test(path) ||
    /[\u0000-\u001f]/.test(path)
  ) {
    throw new Error(
      "This path may be private or contain a token. Choose a public content page.",
    );
  }
  url.search = "";
  url.hash = "";
  return url.href;
}
export function selectUrls(input: unknown): string[] {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > 5 ||
    !input.every((x) => typeof x === "string")
  )
    throw new Error("Choose 1–5 public URLs.");
  const urls = [...new Set(input.map((x) => safeUrl(x)))];
  if (
    urls.some(
      (x) =>
        !isPublicLookingHost(x) ||
        (new URL(x).port && !["80", "443"].includes(new URL(x).port)),
    )
  )
    throw new Error(
      "Choose a public hostname on a standard HTTP(S) port; private hosts and IP-literal sites are unsupported.",
    );
  const origin = new URL(urls[0]).origin;
  if (urls.some((x) => new URL(x).origin !== origin))
    throw new Error("All chosen pages must use the same origin.");
  return urls;
}
export function resolvePublicReference(
  value: string,
  base: string,
): string | undefined {
  try {
    return safeUrl(value, base);
  } catch {
    return undefined;
  }
}
export function isPublicLookingHost(url: string): boolean {
  const host = new URL(url).hostname.toLowerCase();
  return (
    !/^[0-9.]+$/.test(host) &&
    !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|.*\.(local|localhost|internal|test)$)/.test(
      host,
    ) &&
    host.includes(".")
  );
}
