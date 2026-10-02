import { execFile } from "node:child_process";
import { createApp } from "../src/server/app.js";
import { UI_TEST_SITES, uiTestRetrieval } from "../src/server/ui-test-session.js";

if (process.platform !== "darwin") {
  console.log("This private dialog launcher requires macOS. Other systems can use the explicit scope CLI in docs/TINYFISH.md.");
  process.exit(1);
}
console.log("This command opens only a masked Mac key dialog. It does not open Chrome or change a browser profile.");
console.log("Scope: " + UI_TEST_SITES.join(", ") + ". One audit and one recheck per homepage; maximum 6 Search attempts and 6 fetched pages. Agent/Browser off.");
console.log("Current Search/Fetch price is $0 per TinyFish documentation. Continue only if that pricing and public-page consent apply. https://www.tinyfish.ai/pricing");
let key = "";
try {
  key = await new Promise<string>((resolve, reject) => {
    execFile("/usr/bin/osascript", ["-e",
      'set resultDialog to display dialog "Approve a 30-minute PublishProof UI test of ONLY himascorner.com, rayanbuild-site.web.app and thb-blue.vercel.app. Maximum: one audit and one recheck per homepage (6 Search attempts, 6 fetched pages). Search/Fetch only; no Agent/Browser. Continue only if current Search/Fetch pricing is free and you consent to remote checks of these public pages. Enter the TinyFish key below; it stays in backend memory. Starting the helper makes no provider call. You run each check manually in the extension." with title "PublishProof · Approve live UI test" default answer "" with hidden answer buttons {"Cancel", "Approve session"} default button "Approve session" cancel button "Cancel" giving up after 180',
      "-e", 'if gave up of resultDialog then error "Entry expired" number -128',
      "-e", "text returned of resultDialog"
    ], { timeout: 190000, maxBuffer: 4096 }, (error, stdout) => {
      if (error) reject(new Error("Private entry was cancelled or unavailable."));
      else resolve(stdout.replace(/\r?\n$/, ""));
    });
  });
  if (!/^[\x21-\x7E]{8,512}$/.test(key)) throw new Error("Invalid key format.");
  const expires = Date.now() + 30 * 60 * 1000;
  const service = uiTestRetrieval(key, new Date(expires).toISOString(), true);
  const app = createApp(undefined, "public-live", service);
  app.once("error", () => { console.log("The local helper port is already in use or unavailable. No key was logged."); process.exit(1); });
  app.listen(4317, "127.0.0.1", () => {
    console.log("Live helper ready. Leave this terminal running. Open PublishProof manually in a separate signed-out Chrome test profile.");
    console.log("Open ONE approved homepage, click PublishProof, tick public-page permission and Include an AI search check, then click Audit this page. Leave optional routes/search words blank.");
    console.log("Reopen the popup and choose View full report. Check again runs the same public page and AI setting; one recheck per homepage is allowed.");
    console.log("No call has started automatically. Copy prompt and export JSON/Markdown. Stop at the first browser crash or API access error; no retry or paid fallback.");
    console.log("Session ends at " + new Date(expires).toLocaleString() + ". Ctrl+C stops it and discards the session key.");
  });
  const stop = () => { key = ""; app.close(); setTimeout(() => process.exit(0), 100).unref(); };
  setTimeout(stop, expires - Date.now());
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
} catch {
  key = "";
  console.log("Private session was cancelled or could not start. No key was logged, saved, or sent to chat.");
  process.exitCode = 1;
}
