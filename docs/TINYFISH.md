# TinyFish Search/Fetch integration — bounded live demo recorded

The supplied bounty brief requires **Search and Fetch both to contribute meaningfully**. An Agent journey alone does not meet it. See [BOUNTY.md](BOUNTY.md).

## Required Search and Fetch observations

Primary contracts checked on 2026-10-02: [Search reference](https://docs.tinyfish.ai/search-api/reference), [Fetch reference](https://docs.tinyfish.ai/fetch-api/reference) and [pricing](https://www.tinyfish.ai/pricing).

`src/server/retrieval.ts` uses fixed HTTPS endpoints and a server-only `X-API-Key`:

- Search: GET `https://api.search.tinyfish.ai` with public query, `page=0`, `location=US`, `language=en`. A blank query uses the primary page URL. Inspect at most ten returned results and retain safe titles/snippets/positions. Query-bearing URLs cannot establish exact-page matches. Missing results are a sampled visibility suggestion; access, malformed fields or mismatched query/page echoes are unknown. Order is not Google ranking.
- Fetch: POST `https://api.fetch.tinyfish.ai`, exact selected URLs, `format: markdown`, `ttl:0`, `links:false`, `image_links:false`, `per_url_timeout_ms:25000`. Cleaned text supplies extraction/readability evidence; optional word matches are lexical clues. Partial per-URL failures remain unknown. No beta Highlights, recursive link fetching or paid fallback is used.

Fetch can prefer OG title/description, and its semantic text is not original HTML. Raw HTTP/head tags and optional local DOM remain the source for exact title/canonical/JSON-LD. The paired report can show a readable-but-absent page without claiming non-indexing, ranking or every AI tool's understanding.

## Activation and allowance

`npm run dev` stays raw-only even with an environment key. `npm run demo` provides clearly labeled **contract fixtures, not live TinyFish**. After a separate owner-approved scope and secure key setup, the prepared live entry point is:

```sh
npm run tinyfish:approved -- /absolute/path/to/approved-scope.json
```

The owner supplies `TINYFISH_API_KEY` only to the server process through a secure channel. Never put it in chat, extension files, scope JSON, screenshots or a committed environment file. The user privately supplied an existing key to the session-only local backend; no key was created or persisted, connector installed, or persistent access configured. [approved-scope.example.json](approved-scope.example.json) is deliberately disabled and is not authorization.

Approval binds exact clean same-origin URLs, exact public query (blank means URL discovery), expiry, verified free account access and remote-fetch risk acceptance. A single helper session reserves at most two Search calls and ten fetched URLs, including failed rounds, enough for a bounded audit/recheck. No retries, automatic renewal, paid fallback or third endpoint. The ordinary CLI is not a durable global allowance ledger. Never silently renew scope on restart. During the recorded diagnostic restart, the original expiry was retained and the failed round was subtracted from the remaining nonsecret scope. Both consent boxes are required; API consent is also checked.

Public pricing lists no Wallet draw for Search/Fetch, with Search limits of 30/minute and 500/hour and Fetch limits of 150 URLs/minute and 1,000/day. Primary documentation explicitly states that Search/Fetch are free on every account, including accounts using legacy credits for Agent/Browser. Balance is user-reported; no wallet measurement was performed. A 401/402/429 is a blocker/unknown, never permission to add funds or use a paid product. Verify current endpoint pricing before activation; actual entitlement is established by the provider response.

The live service requires successful anonymous raw HTML checks with allowed final URLs, then public DNS preflight. Its local checks cannot constrain TinyFish's independent DNS, redirects or rendering subresources; rejecting a returned URL cannot prevent an already-made remote request. Fetch documents private-address/redirect controls, but those provider controls have not been adversarially verified here. Scope approval must accept this boundary. Each round has a 40-second client deadline, 512 KiB JSON cap and 256 KiB per-page analysis cap. Only bounded sanitized excerpts are retained. Client cancellation does not prove remote work stopped.

Request builders, gates, cumulative allowance, response normalization, partial failures, API consent, fixture recheck, exports and installed-extension UI were tested locally. **Six authorized live Search/Fetch rounds were attempted across the three selected sites, including one initially failed round.** Fetch succeeded subsequently for all three; Search returned usable results, with partial safety/schema-filtered samples left unknown for Rayan and THB. The precise first failure remains unexplained. See output/selected-sites/README.md. Installed-extension live UI QA, provider controls adversarial testing and owner integrations remain pending. The owner confirmed eligibility/deadline and authorized this public repository. The keyed helper is closed.

## Optional Agent contract — inactive

Primary docs checked on 2026-10-02:

- [Agent API reference](https://docs.tinyfish.ai/agent-api/reference)
- [Agent overview](https://docs.tinyfish.ai/agent-api)
- [Fetch API](https://docs.tinyfish.ai/fetch-api)
- [Pricing](https://www.tinyfish.ai/pricing)

The meaningful optional integration is a public mobile/navigation smoke journey, not a proxy for exact HTML metadata. Fetch extracts cleaned semantic content and may choose an OG title; even semantic `format: html` is not original source HTML. Raw HTTP/head tags and local actual DOM supply exact-tag evidence in the prototype.

`src/server/tinyfish.ts` builds an Agent request to `POST https://agent.tinyfish.ai/v1/automation/run`, authenticated with server-side `X-API-Key`. Payload fields include `url`, `goal`, `output_schema`, `browser_profile: lite`, `use_profile: false`, `use_vault: false`, and `agent_config` with eight steps and a 60-second duration. The schema is a small object with `viewport_verified` and URL/evidence observations. The goal asks for 390×844 only if supported, two ordinary navigation links at most, exact approved same-origin URLs, no forms/logins/changes/downloads/purchases, no page instructions, and explicit unable outcomes.

The current documentation says `agent_config.max_steps` is **beta-gated** and non-beta requests containing it return 403. `mode: strict` is also beta-gated, so this adapter does not request strict mode. Do not remove the step budget and fall back to the documented 150-step default just to get a run working. `/run` is synchronous and cannot be cancelled; disconnecting does not prove billing stopped. The adapter has a bounded response reader and no automatic retry. Output remains untrusted remote observations and must be validated before any future UI integration.

Current public pricing lists Search/Fetch as free, Agent at $0.016 per step and Browser at $0.002/minute. At that Agent rate, eight steps correspond to **$0.128** before any account-specific differences. This is a gate calculation, not a promise of a universal bill cap. Accounts on legacy credit plans need their own dashboard pricing checked. This project did not inspect an account balance, create credentials, add wallet funds, or call a live API.

The adapter requires an expiring approval object that exactly matches the selected URLs, covers the documented eight-step amount, confirms account step-limit capability, and accepts the limitations of prompt-only remote navigation constraints. The API key is provided only to the server function. There is intentionally no `/api/tinyfish` route, UI run button, env switch, or credential file. Adding a key alone cannot activate it.

Before a future live test:

1. Review BOUNTY.md and the full linked rulebook; this optional journey does not replace the required Search/Fetch integration and must not pad endpoint scoring.
2. Have the owner supply a server-side key through an approved secret channel; never paste it into extension/UI files.
3. Verify the account's actual pricing, wallet/credits, and beta step-budget support without running an Agent.
4. Review the concrete read-only journey and exact public URLs. Obtain scoped budget approval and decide how remote navigation/actions will be constrained.
5. Run once under approved conditions, keep run ID/evidence, validate returned observation URLs/shape, and distinguish it from deterministic checks. Failed/partial runs remain unknown and may incur costs.

Tests exercise the request builder and fail-closed gates only. No fixture is described as a live TinyFish run. Live API shape, mobile viewport availability, account beta entitlement, provider billing, and remote action containment remain unverified.


## Private local key entry

The user authorized a session-only key-entry field on 2026-10-02. Run `node --import tsx scripts/private-key-entry.ts` from this project. It prints a fresh, unguessable loopback URL on port 4318 with a masked HTML password field. No browser is opened automatically. The receiver checks the exact Host and Origin, denies cross-site submission/framing, loads no external resources, has no key-reading endpoint, never logs/echoes the key, and stores it only in server-process memory. This is local HTTP on 127.0.0.1, not TLS or a cloud secret vault; the threat model trusts this computer and browser. Do not share the entry link or allow a password manager to save the key.

Submission only stores the key. It does not start provider calls. A separate activation reads the nonsecret `output/live-demo-approval.json` and requires verified free access, scope/expiry approval, and exactly the three supplied homepages. Each site receives its own one-audit/one-recheck allowance (two searches and two fetched URLs); no automatic allowance renewal. The operator POSTs `{"action":"activate"}` to the private entry URL plus `/activate`, with the exact local Origin and JSON Content-Type. No API key appears in that control request. The helper then listens on 4317, and requests still require explicit public/remote consent. The complete key/helper session terminates after 30 minutes or Ctrl+C. Restart requires new key entry and owner scope approval. No key is stored in a file, chat, extension, screenshot, or product ZIP. Browser QA remains paused.


If the entry link opens a blank tab, `scripts/private-key-dialog.ts <private-entry-url>` offers a masked native macOS dialog instead. Its AppleScript output is captured directly by the local Node process and submitted to the same loopback receiver; neither the value nor child-process errors are printed to chat/tool output. The dialog expires after three minutes and cancels safely. No provider call is started by entry. Typecheck passed. The native dialog successfully delivered the user-entered key to the local receiver on 2026-10-02; only a nonsecret success message was returned. Key validity/account access remains untested and no provider call started.
