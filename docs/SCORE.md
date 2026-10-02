# Verified page health

The number answers: **How many of our page-basics points are supported by passing evidence?** It is not an overall quality certificate, an accessibility audit, or a Google ranking score.

The same ten criteria are worth 100 points per chosen page. Adding duplicate observations cannot add points. Multiple chosen pages contribute equally; the number is the average verified points across that sample.

| Criterion                  | Points | Passing evidence                                                                                                                  |
| -------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------- |
| Page opens                 |     20 | A successful direct public HTML response.                                                                                         |
| Search access              |     20 | No observed indexing restriction, relevant blocking response header, or matching robots restriction.                              |
| Clear page title           |     10 | A nonempty, unambiguous title. This does not grade writing quality.                                                               |
| Consistent description     |      5 | No contradictory description tags. Optional absence/review suggestions do not lose points.                                        |
| Consistent preferred URL   |     10 | No conflicting canonical declarations. Missing or intentional non-self canonical is a review, not a required addition.            |
| Sampled links work         |     10 | Every expected link probe in the bounded sample passes. No existing applicable links is neutral.                                  |
| Existing share image works |      5 | Existing sampled OG image URLs respond successfully. No image is required. Image pixels/actual social rendering are not verified. |
| Image text alternatives    |     10 | No missing `alt` attribute. Empty decorative alt is allowed; text quality requires review.                                        |
| Existing page data parses  |      5 | Existing JSON-LD parses as JSON. None is required; schema correctness/rich-result eligibility are outside this check.             |
| Mobile sizing hint         |      5 | A viewport tag is observed. This is not proof that the mobile layout works.                                                       |

## Unknowns and coverage

A confirmed failed criterion earns zero points. An unknown criterion also earns no **verified** points, but is displayed as **Not verified**, not as a confirmed defect. Coverage is the percentage of the weighted checklist with known pass/fail evidence. An unreadable page has no meaningful score, so the UI shows an unavailable result rather than inventing a number.

For example, **90 / 100 with 90% verified** means the known checklist passed; ten points still lack evidence. It does not mean the remaining criteria failed. Technical details show each criterion, weight, and evidence state. Suggestions about optional features are separate from confirmed failures.

Analytics, Google indexing/traffic, citations, AI search positions, extraction word counts, sitemap, llms.txt, and special AI schema never contribute invented score requirements. TinyFish observations are useful independent evidence, not ranking points.

## Reliable rechecks

Checks use fresh bounded HTTP observations. When permission is available, local current-tab metadata can add rendered evidence. Raw tags and rendered observations belong to the same criteria, rather than earning extra bonus points. A previously required rendered observation that disappears leaves that criterion unverified; it cannot silently improve the score. The same rule applies when an expected resource probe is missing.

Scores are compared only for matching selected URL lists and the same live/fixture mode. The report also marks lost coverage. Search/Fetch comparisons independently preserve query, locale, and provider identity. A change in sampling/provider is not treated as a fixed retrieval finding.

A repair can improve the number only when its criterion earns new verified passing points. Unscored review suggestions may be worthwhile without changing the number. Changing evidence, blockers, CDN responses, or lost permissions can affect an observation; the report preserves the limitation instead of assuming the owner repaired the site.

The fixture single-page example is **55 → 90** after its simulated response repairs. Those are deterministic test results, not a promise about a real site. Automated tests cover duplicate observations, missing checks, optional-feature absence, lost rendered evidence, and genuine fixes.
