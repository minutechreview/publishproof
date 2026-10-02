# PublishProof public-page report

Observed 2026-10-02T03:31:40.088Z · public-live

URLs: https://www.himascorner.com/

Raw HTTP requests: 9/60. TinyFish: inactive. Search/Fetch not selected or scoped service inactive. Agent/Browser inactive. No live TinyFish calls in this raw HTTP report.

## Verify the decoded contact link

unknown · medium · high confidence · http

URL: https://www.himascorner.com/

Evidence: GET (after failing HEAD) https://www.himascorner.com/cdn-cgi/l/email-protection: HTTP 404; Content-Type text/html. This is a Cloudflare-style email-obfuscation placeholder. Its raw HTTP response does not establish whether the decoded contact link works in a browser.

Impact: Email obfuscation may intentionally replace this placeholder in a browser. The raw scanner cannot verify the final contact action.

Repair: Verify the visible contact link in a signed-out browser with normal scripts. Preserve intentional email protection; change only a demonstrated user-facing failure.

Acceptance: The decoded contact link opens the intended action. No message or form is sent during verification.

## Query-dependent references are outside this sample

unknown · low · high confidence · raw-html

URL: https://www.himascorner.com/

Evidence: 11 link/OG references with query strings were omitted before probing.

Impact: Removing a signed or query-dependent URL can change its destination or asset. This sample does not test those references.

Repair: Verify query-dependent destinations and signed assets manually without sharing token-bearing URLs.

Acceptance: Owner checks original intended public links/assets through an appropriate safe workflow.

## Analytics receipt needs owner access

unknown · low · high confidence · owner-integration

URL: https://www.himascorner.com/

Evidence: A known analytics script hint was found; event delivery was not checked.

Impact: A script is not proof that visits or events reached an analytics account. Analytics is optional.

Repair: If analytics is wanted, use the owner’s vendor debug view and consent-aware test journey. Do not add a vendor without approval.

Acceptance: Owner verifies expected test event receipt and consent behavior in the chosen analytics tool.

## Actual indexing needs Search Console

unknown · low · high confidence · owner-integration

URL: https://www.himascorner.com/

Evidence: No owner Search Console integration is connected.

Impact: No directive or response check can establish actual search indexing, rankings, or traffic.

Repair: Use the owner’s Search Console URL Inspection and performance reports.

Acceptance: Owner verifies the selected URLs and intended search presence.

## Citations are three different questions

unknown · low · high confidence · owner-integration

URL: https://www.himascorner.com/

Evidence: Content sources, local business mentions, and AI answer citations are not verified in this sample.

Impact: Source links support content claims; business citations refer to directory mentions; AI citations refer to attribution in specific answers. There is no universal citation tag.

Repair: Clarify the desired citation concept. Review source quality, directory consistency, or observed AI answers separately. Do not fabricate endorsements or citations.

Acceptance: Owner selects a citation goal and verifies it with relevant external evidence.

## Limits

Sampled public URLs only. Raw HTTP and optional local rendered snapshot are different observers. Indexing, traffic, event delivery, full accessibility, performance, citations from other sites, and AI citations are not verified. No guarantee of ranking or complete release readiness.