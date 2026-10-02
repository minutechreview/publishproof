import { execFile } from "node:child_process";

const url = process.argv[2];
if (!url || !/^http:\/\/127\.0\.0\.1:4318\/key\/[a-f0-9]{64}$/.test(url)) {
  console.log("Private entry address is missing or invalid."); process.exit(1);
}
const origin = "http://127.0.0.1:4318";
const status = await fetch(url + "/status", { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : undefined).catch(() => undefined);
if (!status || status.keyReceived) {
  console.log(status?.keyReceived ? "A key is already held by this local session. No dialog needed." : "Private entry session is unavailable. No key requested.");
  process.exit(status?.keyReceived ? 0 : 1);
}
let secret = "";
try {
  secret = await new Promise<string>((resolve, reject) => {
    execFile("/usr/bin/osascript", ["-e",
      'set resultDialog to display dialog "Enter your TinyFish API key for PublishProof. It will go directly to the local backend memory for this session. No audit or provider call will start." with title "PublishProof · Private key entry" default answer "" with hidden answer buttons {"Cancel", "Use key"} default button "Use key" cancel button "Cancel" giving up after 180',
      "-e", 'if gave up of resultDialog then error "Entry timed out" number -128',
      "-e", "text returned of resultDialog"
    ], { timeout: 190000, maxBuffer: 4096 }, (error, stdout) => {
      // Never log the child output, errors, or secret value.
      if (error) reject(new Error("Private entry cancelled or unavailable."));
      else resolve(stdout.replace(/\r?\n$/, ""));
    });
  });
  if (!/^[\x21-\x7E]{8,512}$/.test(secret)) throw new Error("Invalid key format.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: secret }).toString(),
    signal: AbortSignal.timeout(5000),
  });
  console.log(response.ok ? "Private key received by the local backend. No TinyFish calls started." : "Local receiver did not accept the key. No value was logged.");
  if (!response.ok) process.exitCode = 1;
} catch {
  console.log("Private entry was cancelled, timed out, or could not reach the local receiver. No key value was logged.");
  process.exitCode = 1;
} finally { secret = ""; }
