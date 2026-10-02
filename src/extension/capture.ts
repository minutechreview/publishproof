import type { Metadata } from "../shared/model.js";
// This function is serialized by Chrome: keep it self-contained. No cookies, storage, body text,
// form values, login state or full HTML are read. Returned observations stay on this device.
export function capturePublicMetadata(): Metadata | null {
  if (document.querySelector('input[type="password"]') || location.search)
    return null;
  const short = (s: string) => s.trim().slice(0, 1000);
  const elements = (selector: string) =>
    Array.from(document.querySelectorAll(selector));
  const content = (selector: string) =>
    elements(selector).map((x) => short(x.getAttribute("content") ?? ""));
  const safeRef = (value: string) => {
    try {
      const u = new URL(value, document.baseURI);
      if (
        !["http:", "https:"].includes(u.protocol) ||
        u.username ||
        u.password ||
        /(?:token|secret|session|auth|password|account|admin|logout|checkout)/i.test(
          u.pathname,
        ) ||
        /[A-Za-z0-9_-]{40,}/.test(u.pathname)
      )
        return "";
      u.search = "";
      u.hash = "";
      return u.href;
    } catch {
      return "";
    }
  };
  const images = elements("img");
  const jsonLd = elements("script").filter(
    (x) =>
      x.getAttribute("type")?.trim().toLowerCase() === "application/ld+json",
  );
  return {
    titles: elements("head title")
      .map((x) => short(x.textContent ?? ""))
      .slice(0, 10),
    descriptions: content('head meta[name="description" i]').slice(0, 10),
    canonicals: elements('head link[rel~="canonical" i]')
      .map((x) => {
        const value = x.getAttribute("href");
        if (value === null) return "[invalid canonical omitted]";
        try {
          if (new URL(value, document.baseURI).search)
            return "[query-dependent canonical omitted]";
        } catch {
          return "[invalid canonical omitted]";
        }
        return safeRef(value) || "[unsafe canonical omitted]";
      })
      .slice(0, 10),
    robots: elements('head meta[name="robots" i],head meta[name="googlebot" i]')
      .map(
        (x) =>
          `${x.getAttribute("name")?.toLowerCase()}: ${short(x.getAttribute("content") ?? "")}`,
      )
      .slice(0, 10),
    ogImages: content('head meta[property="og:image" i]')
      .map(safeRef)
      .filter(Boolean)
      .slice(0, 5),
    links: [
      ...new Set(
        elements("a[href]")
          .map((x) => safeRef(x.getAttribute("href") ?? ""))
          .filter((x) => x && new URL(x).origin === location.origin),
      ),
    ].slice(0, 30),
    missingAlt: images.filter((x) => !x.hasAttribute("alt")).length,
    imageCount: images.length,
    jsonLdCount: jsonLd.length,
    jsonLdErrors: jsonLd.filter((x) => {
      try {
        JSON.parse(x.textContent ?? "");
        return false;
      } catch {
        return true;
      }
    }).length,
    skippedQueryReferences: 0,
    viewport: !!document.querySelector('head meta[name="viewport" i]'),
    analyticsHint: elements("script[src]").some((x) =>
      /googletagmanager\.com|google-analytics\.com|plausible\.io|umami/i.test(
        x.getAttribute("src") ?? "",
      ),
    ),
  };
}
