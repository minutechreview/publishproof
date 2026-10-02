import type { RetrievalService } from "./retrieval.js";
import { approvedRetrievalService } from "./retrieval.js";
export const UI_TEST_SITES = [
  "https://www.himascorner.com/",
  "https://rayanbuild-site.web.app/",
  "https://thb-blue.vercel.app/",
] as const;
export function uiTestRetrieval(
  key: string,
  expiresAt: string,
  ownerApproved: boolean,
): RetrievalService {
  if (
    !ownerApproved ||
    !key ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    Date.parse(expiresAt) <= Date.now() ||
    Date.parse(expiresAt) > Date.now() + 30 * 60 * 1000
  )
    throw new Error(
      "A key and explicit owner approval for a valid 30-minute session are required.",
    );
  const services = new Map(
    UI_TEST_SITES.map((url) => [
      url,
      approvedRetrievalService(
        {
          exactUrls: [url],
          query: "",
          expiresAt,
          searchFetchFreeOnAccountVerified: true,
          remoteFetchRiskAccepted: true,
          maxSearchRequests: 2,
          maxFetchUrls: 2,
        },
        key,
      ),
    ]),
  );
  const validate = (urls: string[], query: string) => {
    if (urls.length !== 1)
      throw new Error(
        "For this AI test, check one homepage at a time. Remove any other page paths, or turn off the AI check.",
      );
    if (!UI_TEST_SITES.includes(urls[0] as (typeof UI_TEST_SITES)[number]))
      throw new Error(
        "This AI session uses exact approved addresses: https://www.himascorner.com/, https://rayanbuild-site.web.app/, https://thb-blue.vercel.app/. Use the matching address (including www), or turn off the AI check.",
      );
    if (query !== urls[0])
      throw new Error(
        "Leave the optional search words blank for this AI test. Page-basics checks can use other inputs.",
      );
  };
  return {
    kind: "approved-live",
    scope: { urls: [...UI_TEST_SITES], query: "", maxPages: 1 },
    validate,
    async run(report, query) {
      validate(report.urls, query);
      return services
        .get(report.urls[0] as (typeof UI_TEST_SITES)[number])!
        .run(report, query);
    },
  };
}
