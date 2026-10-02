# Security and trust boundaries

## Extension

Click-triggered `activeTab` access and `scripting` only. No background worker, content-script auto-injection, browser history, cookies, login-state APIs, user storage reads, or broad host permissions. The popup reads the clicked tab's URL, strips URL queries/fragments for the chosen sample, and opens a local extension report. Tab IDs are local references, not browser history.

Public-site consent is explicit before scanning or local link discovery. Use a signed-out public tab. The serialized capture function reads bounded head metadata, selected link URLs, image attribute counts, and JSON-LD syntax counts. It never reads form values, body text, cookies, user storage, or full HTML. Query-bearing tabs/password fields skip capture. Token/private paths are screened, but this is not a detector of every authentication mechanism. Crucially, **no local rendered observations are uploaded**: raw-only API payloads contain cleaned chosen URLs and consent; optional Search/Fetch adds only the public query and separate consent. Rendered comparisons happen on-device.

Untrusted report content is inserted using DOM `textContent`, never `innerHTML`. Dialogs use native keyboard focus trapping and Escape dismissal. Exported Markdown escapes active HTML and Markdown delimiters. Repair prompts delimit evidence as untrusted data and instruct the coding agent to independently verify it, preserve intended policies/design, avoid page-embedded instructions, and make no deployment, purchase, login, form submission, or unrelated changes.

## Helper

Bound only to `127.0.0.1:4317`. Host header must match the actual bound loopback port, resisting browser DNS rebinding. API origin must be the exact local UI or a valid Chrome extension origin; same-origin browser GET Fetch Metadata is accepted for the session endpoint. The extension/report handshake uses an empty POST because Chrome omits Origin on privileged extension GETs but supplies it on POSTs. Origin-less `Sec-Fetch-Site: none` requests remain denied. No wildcard CORS. An in-memory ephemeral pairing token protects scans; it is not an API key and is never put in the extension bundle. Third-party websites cannot read it under browser same-origin rules. Local processes and other privileged installed extensions are outside this trust boundary. Three scans/minute; one active scan; request body limit 16 KiB; five-second body-read timeout.

The production transport accepts HTTP(S), standard ports, credential-free URLs and public hostnames. It resolves all DNS answers, rejects any non-public/reserved address (including IPv4-mapped IPv6), and pins the chosen vetted address in the socket lookup while retaining HTTPS host verification. Each redirect is independently revalidated; cross-origin redirects are blocked and at most three hops are followed. Users can choose the final public origin themselves. No proxy, cookie jar, authorization header, authenticated browser state, ambient credentials, or website script execution is used.

Public link/OG probes undergo the same production DNS/redirect validation. No automatic recursive crawl. Robots wildcard matching uses bounded string searches rather than a backtracking regex. Limits: five chosen pages, 15 sampled internal link URLs, five OG assets, 60 total transport requests, 45-second scan budget, five-second per-request/DNS time budget, 1 MiB HTML, 128 KiB robots, and 64 KiB confirmation GET. Response encoding unsupported by the scanner is unknown. Responses are streamed and bounded; page scripts are parsed as text, never executed. Ordinary failures become unknown observations where evidence is insufficient. GETs request no-cache, but origin/CDN compliance cannot be guaranteed; timestamp is observation time, not a cache purge claim.

All queries/fragments are removed from chosen requests and stored URLs. Query-dependent link/OG references are omitted from probing and reported as unknown; their stripped URLs cannot create false broken-resource findings. Query-dependent canonicals are unknown. Private/auth/action/token-like paths and long opaque path segments are rejected. Legitimate query-routed, signed-asset, nonstandard-port, IP-literal, and some slug-based sites will be unsupported or require manual review. Header link URLs are sanitized before retention. This reduces risk, not a guarantee that every conceivable secret-shaped public path can be identified. Choose intentionally public content URLs only.

The helper writes no report database, HTML logs, browser state or API credential file. The optional approved Search/Fetch process holds its owner-supplied key only server-side in process memory/environment; it never exposes the key to the extension or response. At most ten explicitly audited reports/observations are persisted on-device in localStorage. This is chosen-page report history, not collection of browsing history. **Forget this saved report** removes the selected report; other audited reports remain. Explicit exports remain on disk until the user removes them. No telemetry.

## Test boundary

`tests/fixtures.ts` creates its own loopback server and exposes a test-only transport mapping exactly `https://launch.example` to it. Tests use actual HTTP responses through this transport; the demo labels them `fixture-demo`. Production `src/server/index.ts` imports none of that code and has no allow-private environment switch. Helper API tests use an ephemeral local port so they can run alongside the demo.

## Remote Agent boundary

The Agent adapter has no exposed execution route. Local URL/DNS checks cannot enforce remote browser subrequests or navigation. A natural-language Agent goal is not a network firewall or hard ban on actions. A future approved activation must either provide enforceable remote browser controls or explicitly accept this residual limitation for a bounded smoke check. No vault/profile is used. Live credentials, budget, account capability, and navigation-risk acceptance are required together; see TINYFISH.md.

## Remote Search/Fetch boundary

Raw-only startup cannot activate Search/Fetch from a key alone. The separate approved CLI requires an exact clean URL list, query, expiry, verified free account access and remote-risk acceptance. The installed UI requests remote observations only after explicit opt-in and a second consent checkbox. Keys remain server-side. Endpoints are fixed HTTPS provider hosts, redirects are errors, no cookies are sent, and no automatic retry/Agent/Browser fallback exists. A helper session reserves at most two Search calls and ten fetched URLs including failed rounds; restarting requires fresh owner approval and is not a global durable quota ledger.

The live service first requires successful anonymous raw HTML checks and allowed final URLs, then validates public DNS again. That preflight is **not** a firewall for TinyFish's independent DNS resolution, redirects or rendering subresources. Its documentation states Fetch rejects private addresses/invalid redirects; those provider controls have not been adversarially verified here. The operator must accept this boundary. Returned out-of-scope, query-bearing, malformed, duplicate or missing results are discarded or unknown; returned links are never followed locally. Each round has a 40-second client deadline and 512 KiB response limit; stopping local waiting does not prove remote work was cancelled. Extraction analysis caps each text field at 256 KiB, keeps only bounded sanitized excerpts and does not execute page/provider instructions.

Search snippets/text are escaped as data. Query-bearing result URLs are stripped and cannot establish an exact URL match. Query/page echoes must match the requested sample. Locale and query are explicit; changing them or switching fixture/live observers cannot make a previous retrieval finding silently fixed. The fixture service lives only under `tests/` and is labeled synthetic throughout UI, prompts and exports.

Do not deploy this local helper as a public service without a new security review, authentication, ownership/consent controls and operational limits.

## Version 0.2 popup and score

An explicit popup click creates a short-lived local job with a random 32-character identifier, one sanitized public URL, consent flags, and local tab references. The extension creates an inactive report tab so a scan can finish when the popup closes. The job contains no API credential, pairing token, authenticated DOM, or browsing history. It can start only once while pending, within 30 seconds, and expires after five minutes. No background worker or new permission is added. Rechecks require an explicit button click for the same public pages/AI setting.

The helper exposes only nonsecret approved scope metadata and validates a live AI request's exact URL/query/page limit before raw audit or provider work. A rejected scope starts neither. The popup offers raw page-basics checks when optional AI scope does not match; it never expands provider approval itself.

The fixed weighted score consumes observed checks, not page-embedded instructions, paid search positions, or duplicated passes. Missing expected checks and lost rendered evidence cannot silently count as repaired. Methodology/coverage remain visible, and the original evidence remains in technical details and exports. Score and report persistence do not cause automatic requests.

For isolated QA, `tests/build-ui-extension.ts` creates a separate fixture-only bundle under ignored `output/extension-qa-fixture/` using port 4319. It does not edit the production manifest/bundle or permit private targets in production. The ordinary shipped host remains exactly `http://127.0.0.1:4317/*`.
