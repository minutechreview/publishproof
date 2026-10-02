import http from "node:http";
import { randomBytes } from "node:crypto";

// Local, session-only secret receiver. No secret-reading endpoint, disk storage,
// request logging, external resources, or provider calls from key submission.
export function createKeyEntry(onActivate: (key: string) => Promise<void>, expiresAt: number) {
  const entryPath = `/key/${randomBytes(32).toString("hex")}`;
  let key: string | undefined;
  let active = false;
  let activating = false;
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const port = address && typeof address !== "string" ? address.port : 4318;
    const origin = `http://127.0.0.1:${port}`;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const send = (status: number, body: string, type = "text/plain; charset=utf-8") => {
      res.writeHead(status, { "Content-Type": type }); res.end(body);
    };
    if (req.headers.host !== `127.0.0.1:${port}` || Date.now() >= expiresAt) {
      send(403, "Entry unavailable or expired."); return;
    }
    const path = req.url;
    if (req.method === "GET" && path === `${entryPath}/status`) {
      send(200, JSON.stringify({ keyReceived: !!key, active, expiresAt: new Date(expiresAt).toISOString() }), "application/json"); return;
    }
    if (req.method === "GET" && path === entryPath) {
      send(200, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PublishProof · Private key entry</title><style>body{font:17px system-ui;background:#f5f6f1;color:#20392d;margin:0;padding:28px}main{max-width:540px;margin:8vh auto;background:white;padding:32px;border-radius:18px}h1{font-size:28px}label{display:block;font-weight:650;margin:24px 0 10px}input{box-sizing:border-box;width:100%;padding:14px;font:inherit;border:1px solid #6d8175;border-radius:8px}button{padding:14px 20px;font:inherit;background:#1c6548;color:white;border:0;border-radius:8px;margin:18px 0}small{display:block;line-height:1.6}input:focus,button:focus{outline:3px solid #c29934;outline-offset:3px}</style><main><h1>Private TinyFish key entry</h1><p>This form sends your key directly to PublishProof on this computer. The key stays in the backend's memory for this session; it is not written to a credential file or returned to chat.</p><p><strong>Saving the key does not start an audit or a TinyFish call.</strong></p><form method="post" action="${entryPath}" autocomplete="off"><label for="api-key">TinyFish API key</label><input id="api-key" name="key" type="password" required minlength="8" maxlength="512" autocomplete="off" spellcheck="false" autocapitalize="none"><button type="submit">Use key for this session</button></form><small>Use only the exact 127.0.0.1 address. This is a loopback-only HTTP form, not an encrypted cloud vault. Access assumes this computer and your browser are trusted. Keep this entry link private. Session expires at ${new Date(expiresAt).toISOString()}.</small></main></html>`, "text/html; charset=utf-8"); return;
    }
    if (req.method !== "POST" || (path !== entryPath && path !== `${entryPath}/activate`)) {
      send(404, "Not found."); return;
    }
    if (req.headers.origin !== origin || ![undefined, "same-origin", "none"].includes(req.headers["sec-fetch-site"] as string | undefined)) {
      send(403, "Only the local entry page can submit."); return;
    }
    let body = "";
    try {
      const timer = setTimeout(() => req.destroy(), 5000); timer.unref();
      try {
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 4096) { send(413, "Entry too large."); return; }
        }
      } finally { clearTimeout(timer); }
      if (path === `${entryPath}/activate`) {
        if (!key || active || activating || req.headers["content-type"] !== "application/json" || body !== '{"action":"activate"}') {
          send(409, "Activation unavailable."); return;
        }
        activating = true;
        try { await onActivate(key); active = true; send(200, "Approved helper ready. No provider calls have started."); }
        catch { send(403, "Activation blocked. Check the nonsecret approval scope, account access, expiry, and helper port."); }
        finally { activating = false; }
        return;
      }
      if (key || req.headers["content-type"] !== "application/x-www-form-urlencoded") {
        send(409, "A key was already received, or the form type was invalid."); return;
      }
      const params = new URLSearchParams(body);
      const value = params.get("key");
      if ([...params.keys()].length !== 1 || !value || !/^[\x21-\x7E]{8,512}$/.test(value)) {
        send(400, "Enter a valid key without spaces. The submitted value is never echoed."); return;
      }
      key = value;
      send(200, "<!doctype html><html lang=" + '"en"' + "><meta charset=" + '"utf-8"' + "><title>Key received</title><body><h1>Key received privately</h1><p>No TinyFish call has started. You can close this tab and tell Codex you are done.</p><p>The key is held only for this local session.</p></body></html>", "text/html; charset=utf-8");
    } catch { if (!res.headersSent) send(400, "Entry could not be processed. No secret value is logged."); }
    finally { body = ""; }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  return { server, entryPath, clear: () => { key = undefined; } };
}
