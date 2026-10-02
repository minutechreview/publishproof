import { mkdir, writeFile } from "node:fs/promises";
import { scan } from "../src/server/scan.js";
import { exportMarkdown } from "../src/shared/report.js";
const sites = [
  ["himas-corner", "https://www.himascorner.com/"],
  ["rayanbuild", "https://rayanbuild-site.web.app/"],
  ["thb-blue", "https://thb-blue.vercel.app/"],
];
await mkdir("output/selected-sites", { recursive: true });
for (const [name, url] of sites) {
  const report = await scan([url]);
  await writeFile("output/selected-sites/" + name + "-raw.json", JSON.stringify(report, null, 2));
  await writeFile("output/selected-sites/" + name + "-raw.md", exportMarkdown(report));
  console.log(JSON.stringify({
    site: name, url, mode: report.mode, pages: report.pages.map(page => ({
      status: page.status, finalUrl: page.finalUrl, error: page.error, titles: page.metadata?.titles,
    })),
    failures: report.checks.filter(check => check.verdict === "fail").map(check => ({ title: check.title, evidence: check.evidence })),
    requests: report.requestCount, tinyfish: report.tinyfish.status,
  }));
}
