import type { RetrievalService } from "./retrieval.js";
import { approvedRetrievalService } from "./retrieval.js";
export const UI_TEST_SITES = [
  "https://www.himascorner.com/",
  "https://rayanbuild-site.web.app/",
  "https://thb-blue.vercel.app/",
] as const;
export function uiTestRetrieval(key: string, expiresAt: string, ownerApproved: boolean): RetrievalService {
  if (!ownerApproved || !key || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now() || Date.parse(expiresAt) > Date.now() + 30 * 60 * 1000)
    throw new Error("A key and explicit owner approval for a valid 30-minute session are required.");
  const services = new Map(UI_TEST_SITES.map(url => [url, approvedRetrievalService({
    exactUrls: [url], query: "", expiresAt,
    searchFetchFreeOnAccountVerified: true,
    remoteFetchRiskAccepted: true,
    maxSearchRequests: 2, maxFetchUrls: 2,
  }, key)]));
  return { kind: "approved-live", async run(report, query) {
    const site = UI_TEST_SITES.find(url => url === report.urls[0]);
    if (report.urls.length !== 1 || !site || query !== site)
      throw new Error("This live UI test permits one approved homepage at a time with the target query blank.");
    return services.get(site)!.run(report, query);
  } };
}
