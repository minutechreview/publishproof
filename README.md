# PublishProof

Evidence-backed post-launch checks for people who build websites with coding agents. Audit a public page and up to four chosen same-origin routes, understand each finding, copy a constrained repair prompt, and recheck the same URLs after redeploying. **PublishProof is a provisional name; this is a local prototype.**

![Search and Fetch evidence panel, explicitly labeled synthetic contract fixture](docs/images/search-fetch-fixture.png)

## Try it

Requires Node.js 22+ and npm. Clone this repository and run:

```sh
npm ci
npm run verify
npm run demo
```

Open **http://127.0.0.1:4317**. Keep the seeded sample, confirm consent and click **Check selected pages**. The demo uses local HTTP fixtures and explicitly labeled synthetic TinyFish responses. No API key or external API call is used. **Recheck same URLs** simulates a revised fixture deployment; it does not edit a website.

For real public HTTP checks, stop the demo and run `npm run dev`. For the bounded live TinyFish/manual Chrome test on macOS, follow [the beginner testing guide](docs/START-HERE.md). `npm run test:live` opens a masked key-and-approval dialog, holds the key only in backend memory for 30 minutes, and permits one audit and one recheck of each of the three owner-selected homepages. No browser opens or audit starts automatically.

Load **dist/extension** through Chrome's **Load unpacked** button in a separate signed-out test profile. Alternatively extract [the unpacked build](dist/publishproof-unpacked.zip) first. Leave the local helper running. Never enter an API key into an extension, report, repository or recording.

## What the report establishes

- Exact URLs, timestamps, observed evidence, severity, confidence and plain-English impact; confirmed failures, suggestions and unknowns stay separate. No generic SEO score.
- Raw HTTP status/redirects, noindex and robots restrictions, canonical conflicts, sampled metadata, broken internal links/existing OG assets, malformed existing JSON-LD, missing alt attributes and direct deep-link responses. Current-tab rendered metadata can be compared locally with raw HTML.
- **TinyFish Search** contributes a query/locale-specific discovery sample. **TinyFish Fetch** contributes fresh cleaned text, bounded excerpts and cautious query-word coverage. Raw tags and headers are checked independently; cleaned Fetch content cannot establish exact raw title/canonical/JSON-LD.
- Scoped repair prompts treat evidence as untrusted data, preserve intended policies and design, and include acceptance tests. Recheck compares the same observers and URLs as fixed, still failing or unable to verify.
- Copy, Markdown/JSON export and local report persistence. No automatic site changes, deployments, purchases or form submissions.

Missing analytics, robots.txt, sitemap, llms.txt or special AI schema is not automatically a defect. “Citations” distinguishes content references, directory mentions and links in specific AI answers; there is no imaginary mandatory citation tag. Actual indexing, traffic, analytics event receipt, all AI tools' understanding and rankings are outside this prototype's evidence.

## Verified status

Strict typecheck, **46 tests**, and the unpacked build pass. Rules, security and API tests use deterministic fixtures and temporary local servers; they make no TinyFish calls.

Bounded **live Search and Fetch** backend runs were recorded on three owner-selected public homepages. Himas Corner yielded 702 extracted characters; Rayan's portfolio 5,283; The Henna Boutique 3,558. Partial Search samples remain unknown. [Timestamped live evidence and limitations](output/selected-sites/README.md).

Installed-extension permissions, raw HTTP flow, synthetic Search/Fetch UI, copy, exports, persistence and recheck were previously tested in an isolated Chrome profile. A Chrome extension Blob-download crash was reproduced; bounded data-URL exports then passed isolated QA. **The current installed-extension UI with live TinyFish still needs the manual test.** The new private-dialog launcher has scope/expiry tests and syntax validation; it has not been run with a real key in the latest revision. [Exact verification and remaining gaps](docs/TEST-REPORT.md).

## Security and TinyFish

Click-triggered `activeTab`/`scripting` permissions and one loopback helper host; no history, cookies, broad site permissions or authenticated DOM upload. Explicit public-page and remote-analysis consent. Production HTTP uses public DNS/IP validation, address pinning, redirect checks and crawl/time/size limits. Reports escape page content and prompts reject page-embedded instructions. [Security boundaries](docs/SECURITY.md).

API keys stay server-side. Raw-only startup cannot activate TinyFish from a key alone. Live helpers require short-lived exact scope approval; no retry, paid fallback or automatic renewal. Search/Fetch pricing is documented as free, but actual account access and current pricing must be verified. The optional paid Agent adapter is inactive and has no execution route. [Adapter, API contracts and pricing](docs/TINYFISH.md).

## Bounty and demo

Built for the supplied TinyFish SEO Page Auditor brief: Search and Fetch both contribute, with live-page evidence and specific findings. The owner confirmed eligibility/deadline and is preparing the video and required social posts. No award, ranking improvement or submission is claimed. Safety excludes authenticated/private/token-bearing URLs even though the brief says “any URL.” [Requirement map](docs/BOUNTY.md) · [Demo plan](docs/DEMO.md).

The emphasis is reliable evidence and beginner clarity. Agent prompts and rechecks already exist in competing products; no novelty claim is made.

## Source layout

`src/extension` contains the MV3 popup/report; `src/shared` contains URL guards, rules, prompts and comparisons; `src/server` contains the bounded transport, scanner and TinyFish adapters. `tests` and `scripts` contain fixtures, verification and explicit local launchers. Generated unpacked files are in `dist`. Reports persist in the report's local browser storage until **Forget saved report**; exported files remain on disk.
