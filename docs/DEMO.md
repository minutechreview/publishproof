# Demo plan

## Live recording

Follow [START-HERE.md](START-HERE.md). Enter the API key privately before recording. Use a separate signed-out Chrome profile and keep the local helper running.

1. Open one owner-approved homepage and click PublishProof. Show the exact sample URL, public-page consent and separate Search/Fetch consent.
2. Click **Check selected pages**. Show fresh timestamps and **Live TinyFish** provenance. Explain that Search observes a query/locale-specific discovery sample while Fetch observes cleaned readable text. Raw HTTP evidence is independent.
3. Open a concrete finding or unknown, showing URL, evidence, severity/confidence and targeted acceptance tests. Do not invent a repair if the page has none in this limited sample. Partial/failed observations stay unknown.
4. Show the copyable scoped prompt and export Markdown/JSON. Do not apply changes as part of a button demonstration.
5. Refresh the site tab and **Recheck same URLs**. Without a real edit/deployment, describe this as a fresh check, not a fixed website. A real repair demonstration requires a separately reviewed site change/deploy.
6. Repeat with the other two approved homepages as separate samples. End with the bounded-sample limitations and the meaningful contribution of each endpoint.

The helper permits one audit and one recheck per homepage for 30 minutes. Stop on a crash/access/billing error; no automatic retries or paid fallback. Ctrl+C closes the helper. Never include key-entry UI or private browser tabs in the video.

## Credential-free walkthrough

`npm run demo` serves local HTTP fixtures. Show synthetic provenance, prioritized findings, narrow repair prompt, export, persistence and fixture recheck statuses. This is development evidence and does not satisfy the live-page requirement. Product screenshots in docs/images are labeled synthetic.

The owner is making the video and will post to LinkedIn (tagging TinyFish) and Discord #showcase. Repository publication does not submit the bounty or publish social posts. See [BOUNTY.md](BOUNTY.md).
