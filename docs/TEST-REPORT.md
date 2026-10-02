# Verification report — version 0.2, 2 October 2026

## Executed checks

**55 tests / 0 failures**, strict TypeScript checking, and the production unpacked extension build passed. Tests use deterministic fixtures and temporary loopback servers; no TinyFish request is made by `npm run verify`.

The suite covers raw parsing/rules, robots precedence, canonical/header conflicts, status/bot-block distinctions, JSON-LD syntax, missing alt attributes, metadata, URL/token guards, public-address/DNS/redirect/time/response limits, helper Host/Origin/consent/token limits, private receiver expiry/disclosure boundaries, and TinyFish contract/scope/allowance/provenance handling.

New redesign regressions cover:

- A fresh simulated repair earns more points with a fixed 100-point-per-page rubric.
- Duplicate passes and missing failed checks cannot inflate the score.
- Optional descriptions/canonicals/schema and owner analytics are not invented requirements.
- Losing a rendered failure keeps its criterion unverified. Requirements first observed in a later recheck survive further coverage loss.
- Bounded chosen-page report history preserves per-page baselines without collecting browser history.
- Popup jobs require a recent random identifier, a sanitized public URL, and explicit public-page consent.
- The bounded live helper advertises only nonsecret exact scope. An unapproved AI URL/query is rejected before any raw audit or provider work.

## Version 0.2 browser QA

The local report and fixture popup preview were exercised in an isolated headless testing browser against a separate **4319** fixture helper. The owner's existing **4317** helper and normal browser profile were not changed.

Verified:

- Public-page consent blocks an unauthorised audit; the AI option has a separate explicit consent boundary.
- Fixture popup **Audit this page** creates a report runner. Closing the fixture popup during a delayed scan does not stop that runner; reopening recovers the completed result.
- **View full report** matches the popup's result. The fixture one-page score is **55 → 90** after the helper's simulated repairs.
- Saved reports and baseline/recheck results survive reload. Unknown/lost coverage remains visible; no real site repair is claimed.
- The report groups fixes/reviews/unknowns/passes in plain English. Detailed evidence and technical prompts are optional.
- Actual repair-prompt clipboard copy, native-dialog Escape dismissal, and Markdown/JSON downloads succeeded in the fixture report.
- Keyboard navigation between report tabs works. At **390 × 844**, there is no horizontal overflow. Reduced-motion emulation disables the report animation.
- Final fixture preview console check reported no errors or warnings. Tool invocation mistakes were corrected and are not app pass claims.

Screenshots in [images](images/) are product-only fixture captures, explicitly labeled synthetic/sample data. They are not a live TinyFish demonstration. Full-page local captures and actual fixture exports are retained locally; the publication includes selected readable viewport images and [the QA summary](ui-qa.json).

## Native toolbar limitation

The redesigned **installed Chrome toolbar action with live results remains unverified**. A separate native extension debugging session closed while the toolbar action was being triggered. Its cause was not established. That test was stopped and was not retried. No claim is made that the extension caused the closure or that native action QA passed.

The web fixture popup shares application code, but does not prove Chrome's native popup lifecycle, temporary permission grant, or physical toolbar behavior. Use [the manual guide](START-HERE.md) for that remaining check, stopping at the first crash.

## Historical evidence

Earlier version 0.1 isolated Chrome QA exercised extension loading, popup/report, `activeTab` grant/revocation, scripting, helper connection, raw/current-tab metadata comparisons, consent, copy/exports, persistence, recheck, and helper errors. Runtime permissions were exactly `activeTab`/`scripting` plus `http://127.0.0.1:4317/*`. An extension-origin Blob-download failure was reproduced then; data-URL exports subsequently passed isolated QA. This is historical evidence and does not establish the new toolbar flow.

Bounded live Search/Fetch backend observations were recorded earlier on three owner-selected homepages. Fetch returned 702 / 5,283 / 3,558 characters. Himas Corner appeared in its US/en discovery sample; partial Rayan/THB samples remain unknown. At most six Search attempts and six fetched pages included the initial generic failed round. That initial failure's cause remains unresolved. No site was edited/redeployed, so those rechecks are repeat observations. [Timestamped evidence and assembly limitations](../output/selected-sites/README.md).

The redesign made **no new TinyFish calls**, no paid Agent/Browser requests, and no real website changes/deployments. Pricing was documented as free for the recorded Search/Fetch endpoints; no account-ledger balance measurement was made.

## Remaining limits

The current native toolbar/live UI and macOS private-session launcher end to end need manual testing. Other browser versions and manual file-picker/permission-warning interactions are unverified. No hosted public service, real repair/deploy, remote mobile journey, owner indexing/analytics integration, ranking improvement, field performance, complete accessibility, or external citation verification is claimed.

Controlled live DNS rebinding, every resolver/TLS/CDN edge case, and provider subrequest containment have not been adversarially verified. Production has no test-only private-network toggle.

The shareable source excludes credentials, session approvals, crash diagnostics, private attachments, browser profiles, and tool transcripts. The owner confirmed eligibility/deadline and authorized the repository; the video, social posts, and bounty submission remain owner work.
