# PublishProof · Live demo results

Live TinyFish Search and Fetch ran on all three user-selected public homepages on 2 October 2026. No site was edited or redeployed. No browser was launched for these runs.

| Site | Fetch text | Search observation |
|---|---:|---|
| Himas Corner | 702 characters | Exact homepage observed at TinyFish position 1 in this URL-discovery sample |
| Rayan's portfolio | 5283 characters | Unable to verify: eight results retained, others rejected by safety/schema checks |
| The Henna Boutique | 3558 characters | Unable to verify: eight results retained, others rejected by safety/schema checks |

These were US/en searches using the exact homepage URLs as discovery queries, not competitive keyword or Google-ranking checks. Extracted text is TinyFish's cleaned content, not original HTML or proof of every AI tool's understanding.

All three latest raw samples have no confirmed automated repair finding. This is a bounded sample, not a clean bill for every page. Himas Corner's Cloudflare-style email-protection placeholder returned 404 to raw HTTP; the current rule leaves its decoded contact action unknown instead of suggesting removal of a protection. Browser navigation remains untested while Chrome QA is paused.

Rayan and THB baseline/recheck extracts retained the same character counts. Himas Corner's first provider round failed with a generic error; the next round succeeded. The original cause is unverified. The demo consumed at most six Search attempts and six fetched pages total, including that failed round. The documented endpoint price is $0; the user's balance was not independently measured. No Agent/Browser endpoint, purchase, wallet change, site edit, deployment, public post, or bounty submission occurred.

The keyed helper was stopped after the approved allowance was used. The API key was session-only and is not in files or exports. A future run needs a new private key entry and fresh scope approval.

## Reports

- [Himas Corner](himas-corner-review.md) · [review prompt](himas-corner-review-prompt.txt)
- [Rayan's portfolio](rayanbuild-review.md) · [review prompt](rayanbuild-review-prompt.txt)
- [The Henna Boutique](thb-blue-review.md) · [review prompt](thb-blue-review-prompt.txt)

Original baseline/recheck JSON and Markdown files in this directory preserve the live-run history. Current review reports combine refreshed raw checks with timestamped recorded TinyFish evidence; they do not silently replay provider calls as new results. Fixture screenshots remain labeled synthetic. The owner confirmed eligibility/deadline and authorized this public repository. Live installed-extension UI QA and the owner’s video/LinkedIn/Discord materials remain unfinished submission work.

Primary price/access references: https://docs.tinyfish.ai/authentication, https://www.tinyfish.ai/pricing, https://www.tinyfish.ai/blog/best-ai-search-engine. Email-obfuscation behavior: https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/.