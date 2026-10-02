import { writeFile } from "node:fs/promises";
import { scan } from "../src/server/scan.js";
import { exportMarkdown } from "../src/shared/report.js";
const report = await scan(["https://example.com/"]);
await writeFile("output/public-smoke.json", JSON.stringify(report, null, 2));
await writeFile("output/public-smoke.md", exportMarkdown(report));
console.log(
  JSON.stringify(
    {
      mode: report.mode,
      pages: report.pages.map((p) => ({
        url: p.url,
        status: p.status,
        error: p.error,
        title: p.metadata?.titles,
      })),
      requests: report.requestCount,
      tinyfish: report.tinyfish.status,
    },
    null,
    2,
  ),
);
if (!report.pages[0]?.metadata) process.exitCode = 1;
