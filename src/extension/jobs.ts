import { safeUrl } from "../shared/urls.js";
export const JOB_KEY = "publishproof.audit.job.v1";
export interface AuditJob {
  id: string;
  url: string;
  tab?: number;
  reportTab?: number;
  createdAt: number;
  publicConsent: true;
  remote: boolean;
  recheck: boolean;
  status: "pending" | "running" | "complete" | "error";
  reportId?: string;
  error?: string;
}
export function readJob(
  storage: Pick<Storage, "getItem">,
): AuditJob | undefined {
  try {
    const job = JSON.parse(storage.getItem(JOB_KEY) ?? "null");
    if (
      !job ||
      !/^[a-f0-9]{32}$/.test(job.id) ||
      safeUrl(job.url) !== job.url ||
      job.publicConsent !== true ||
      typeof job.remote !== "boolean" ||
      typeof job.recheck !== "boolean" ||
      typeof job.createdAt !== "number" ||
      job.createdAt > Date.now() ||
      Date.now() - job.createdAt > 5 * 60 * 1000 ||
      !["pending", "running", "complete", "error"].includes(job.status)
    )
      return;
    return job;
  } catch {
    return;
  }
}
export function writeJob(storage: Pick<Storage, "setItem">, job: AuditJob) {
  storage.setItem(JOB_KEY, JSON.stringify(job));
}
