import { createApp } from "../src/server/app.js";
import { scan } from "../src/server/scan.js";
import { ScanNetwork } from "../src/server/network.js";
import { FIXTURE_ORIGIN, startFixtureServer } from "./fixtures.js";
import { retrievalFixtureService } from "./retrieval-fixtures.js";
const fixture = await startFixtureServer();
let scans = 0;
const app = createApp(
  async (urls) => {
    if (
      !Array.isArray(urls) ||
      urls.some(
        (x) => typeof x !== "string" || new URL(x).origin !== FIXTURE_ORIGIN,
      )
    )
      throw new Error(
        "Fixture demo accepts only https://launch.example routes. Use npm run dev for public sites.",
      );
    if (scans > 0) fixture.redeploy();
    const report = await scan(
      urls,
      new ScanNetwork(fixture.wire),
      "fixture-demo",
    );
    scans++;
    return report;
  },
  "fixture-demo",
  retrievalFixtureService(),
);
const port = Number(
  process.argv.find((x) => x.startsWith("--port="))?.slice(7) ?? 4317,
);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Use a valid loopback demo port.");
app.listen(port, "127.0.0.1", () =>
  console.log(
    `PublishProof FIXTURE DEMO: http://127.0.0.1:${port} — first scan has seeded defects; recheck uses revised fixtures. No external requests; no TinyFish.`,
  ),
);
const stop = () =>
  app.close(() => void fixture.close().then(() => process.exit(0)));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
