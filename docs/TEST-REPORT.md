# Verification report — 2 October 2026

## Latest local verification

- Strict TypeScript check, **46 tests / 0 failures**, and extension build passed.
- Rules/network tests cover HTML head parsing, robots precedence, canonical/header conflicts, metadata, JSON-LD syntax, alt attributes, status/bot-block distinctions, query/token URL guards, public-address classification, DNS selection, redirect and response limits.
- Actual local HTTP fixtures exercise baseline/recheck, missing coverage, report export/prompt/persistence, Cloudflare email-protection placeholder uncertainty, helper Host/Origin/consent/token/rate limits, and private key receiver expiry/disclosure boundaries.
- Search/Fetch contract fixtures exercise schema normalization, scope/query/expiry/account/risk gates, cumulative limits, partial failures, provenance and observer-aware comparisons. The three-homepage manual helper rejects extra URLs, multiple pages and nonblank queries.
- The macOS masked key dialog compiled without execution. The new manual launcher has not been run with a real key/browser in this revision. Tests use dummy credentials and never call TinyFish.

## Earlier installed-extension QA

A separate Chrome 154.0.8037.58 profile exercised actual extension loading, popup/report, `activeTab` grant and revocation, scripting, helper connection, public/raw and current-tab metadata comparison, consent, copy, downloads, persistence, recheck and helper errors. Runtime permissions were exactly activeTab/scripting plus http://127.0.0.1:4317/*. No normal browser profile was changed.

The synthetic Search/Fetch panel, query/consent, unavailable retrieval coverage and 390×844 mobile layout passed. Screenshots in docs/images are explicitly contract fixtures, not live TinyFish proof.

An extension-origin Blob-download SIGSEGV was reproduced. Downloads were changed to bounded data URLs with a DOM-attached anchor; actual JSON/Markdown downloads then passed and the report/browser stayed open. This does not guarantee every Chrome version. Manual testing should stop on the first crash. No Chrome launch was performed for the current publication work.

## Live backend evidence

Search and Fetch ran against three owner-selected homepages. Fetch returned 702 / 5,283 / 3,558 characters. Himas Corner's exact URL appeared in its US/en discovery sample; partial Rayan/THB Search samples remain unknown. At most six Search attempts and six fetched pages included the initial generic failed round; its original cause remains unresolved. No automatic retries or Agent/Browser calls were made.

No site was edited or redeployed. Rechecks are repeat observations, not proof of repair or ranking improvement. Current review reports combine refreshed anonymous raw evidence with timestamped recorded provider evidence; they are not a new provider run. The prior keyed helpers were closed and keys discarded. Search/Fetch has documented zero endpoint cost; no account-ledger balance measurement was made. See ../output/selected-sites/README.md for the retained evidence.

## Remaining limits

Current installed-extension **live** Search/Fetch display and the new one-command launcher end-to-end need owner manual testing. Physical toolbar interaction, manual file-picker installation and other Chrome versions were not verified. No paid remote journey, owner indexing/analytics integration, real repair/deploy, field performance, complete accessibility or external citation verification is claimed.

Production SSRF checks passed classifier/transport tests; controlled live DNS rebinding, every resolver/TLS/CDN edge case and provider subrequest containment were not adversarially verified. Public-site consent and remote-fetch residual-risk acceptance remain required.

The public repository excludes browser profiles, crash diagnostics, local session approvals, credentials, private attachments and tool transcripts. The owner confirmed eligibility/deadline and authorized this repository; the video, social posts and bounty submission are still separate work.
