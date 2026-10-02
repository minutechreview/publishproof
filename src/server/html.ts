import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { Metadata } from "../shared/model.js";
import { resolvePublicReference } from "../shared/urls.js";
type Node = DefaultTreeAdapterMap["node"];
export function parseMetadata(html: string, pageUrl: string): Metadata {
  const root = parse(html);
  const all: DefaultTreeAdapterMap["element"][] = [];
  function walk(node: Node) {
    if ("tagName" in node) all.push(node);
    if ("childNodes" in node) node.childNodes.forEach(walk);
  }
  walk(root);
  const attrs = (node: DefaultTreeAdapterMap["element"]) =>
    Object.fromEntries(node.attrs.map((a) => [a.name.toLowerCase(), a.value]));
  const text = (node: Node): string =>
    "value" in node
      ? node.value
      : "childNodes" in node
        ? node.childNodes.map(text).join("")
        : "";
  const head = all.find((x) => x.tagName === "head");
  const inHead: DefaultTreeAdapterMap["element"][] = [];
  function collect(node: Node) {
    if ("tagName" in node) inHead.push(node);
    if ("childNodes" in node) node.childNodes.forEach(collect);
  }
  if (head) collect(head);
  const baseTag = inHead.find((x) => x.tagName === "base" && attrs(x).href);
  const base = baseTag
    ? (resolvePublicReference(attrs(baseTag).href, pageUrl) ?? pageUrl)
    : pageUrl;
  const metas = inHead.filter((x) => x.tagName === "meta").map(attrs);
  const scripts = all.filter((x) => x.tagName === "script");
  const jsonLd = scripts.filter(
    (x) => attrs(x).type?.trim().toLowerCase() === "application/ld+json",
  );
  let skippedQueryReferences = 0;
  const probeRef = (value: string) => {
    try {
      if (new URL(value, base).search) {
        skippedQueryReferences++;
        return undefined;
      }
    } catch {
      return undefined;
    }
    return resolvePublicReference(value, base);
  };
  const refs = (tag: string, attr: string) =>
    all
      .filter((x) => x.tagName === tag && attrs(x)[attr])
      .map((x) => probeRef(attrs(x)[attr]))
      .filter((x): x is string => !!x);
  const images = all.filter((x) => x.tagName === "img");
  return {
    titles: inHead
      .filter((x) => x.tagName === "title")
      .map((x) => text(x).trim().slice(0, 500)),
    descriptions: metas
      .filter((x) => x.name?.toLowerCase() === "description")
      .map((x) => (x.content ?? "").slice(0, 1000)),
    canonicals: inHead
      .filter(
        (x) =>
          x.tagName === "link" &&
          attrs(x).rel?.toLowerCase().split(/\s+/).includes("canonical"),
      )
      .map((x) =>
        (() => {
          const value = attrs(x).href;
          if (value === undefined) return "[invalid canonical omitted]";
          try {
            if (new URL(value, base).search)
              return "[query-dependent canonical omitted]";
          } catch {
            return "[invalid canonical omitted]";
          }
          return (
            resolvePublicReference(value, base) ?? "[unsafe canonical omitted]"
          );
        })(),
      ),
    robots: metas
      .filter((x) => ["robots", "googlebot"].includes(x.name?.toLowerCase()))
      .map((x) => `${x.name.toLowerCase()}: ${x.content ?? ""}`.slice(0, 500)),
    ogImages: metas
      .filter((x) => x.property?.toLowerCase() === "og:image")
      .map((x) => probeRef(x.content ?? ""))
      .filter((x): x is string => !!x),
    links: [
      ...new Set(
        refs("a", "href").filter(
          (x) => new URL(x).origin === new URL(pageUrl).origin,
        ),
      ),
    ].slice(0, 100),
    missingAlt: images.filter((x) => !x.attrs.some((a) => a.name === "alt"))
      .length,
    imageCount: images.length,
    jsonLdErrors: jsonLd.filter((x) => {
      try {
        JSON.parse(text(x));
        return false;
      } catch {
        return true;
      }
    }).length,
    jsonLdCount: jsonLd.length,
    viewport: metas.some((x) => x.name?.toLowerCase() === "viewport"),
    skippedQueryReferences,
    analyticsHint: scripts.some((x) =>
      /googletagmanager\.com|google-analytics\.com|plausible\.io|umami|gtag\s*\(/i.test(
        (attrs(x).src ?? "") + text(x),
      ),
    ),
  };
}
