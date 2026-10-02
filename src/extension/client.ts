import type { Report } from "../shared/model.js";
export const isExtension = location.protocol === "chrome-extension:";
export const API = isExtension ? "http://127.0.0.1:4317" : location.origin;
export interface Session {
  token: string;
  mode: Report["mode"];
  retrieval: "inactive" | "approved-live" | "fixture";
  scope?: { urls: string[]; query: string; maxPages: number };
}
export async function connectHelper(): Promise<Session> {
  const response = await fetch(`${API}/api/session`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok)
    throw new Error(
      "The local helper couldn’t connect. Reopen PublishProof after starting the helper.",
    );
  return response.json();
}
export async function requestScan(
  session: Session,
  urls: string[],
  query: string,
  remote: boolean,
): Promise<Report> {
  const response = await fetch(`${API}/api/scan`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      "X-PublishProof-Token": session.token,
    },
    body: JSON.stringify({
      urls,
      consent: true,
      ...(remote
        ? { tinyfish: { enabled: true, query, remoteConsent: true } }
        : {}),
    }),
    signal: AbortSignal.timeout(remote ? 95000 : 50000),
  });
  const data = (await response.json()) as { report?: Report; error?: string };
  if (!response.ok || !data.report)
    throw new Error(
      data.error ??
        "The check didn’t finish. Your previous report is still saved.",
    );
  return data.report;
}
