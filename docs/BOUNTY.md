# SEO Page Auditor — supplied brief and requirement map

Source: the bounty screenshots and all seven rulebook sections supplied directly by the user on 2026-10-02. No login/account was accessed. Eligibility and the absolute deadline are not independently verified.

The visible brief asks for an auditor that connects a page's readability to AI retrieval/search visibility, using **TinyFish Search and Fetch** and reporting what is missing with actionable fixes. Visible submission requirements are: URL input with optional target query; both endpoints; report on what AI tools can/cannot read, visibility gaps and fixes; demo several real pages; short explanation of TinyFish usage. Approval criteria additionally require meaningful endpoint contributions, live pages rather than saved copies, specific findings, broad URL support and a connection between readability and search visibility.

| Requirement | Current implementation/evidence | Remaining gap |
|---|---|---|
| URL and optional query | Public URL input, up to four chosen same-origin routes, query input; blank query uses URL discovery | Query-routed/private/IP-literal/nonstandard-port URLs are intentionally excluded |
| Meaningful Search | Returned result titles/snippets/positions, exact page presence and same-origin presence, timestamp and US/en locale | Live result samples recorded for all three homepages; Rayan/THB partial samples remain unknown |
| Meaningful Fetch | Fresh `ttl:0` extraction, readable text excerpt, per-URL failures, cautious query-word review | Live extraction recorded: Himas 702 characters, Rayan 5,283, THB 3,558 |
| Readability tied to visibility | Side-by-side independent observations: readable-but-absent, empty extraction, sampled query mismatch; targeted evidence checks | No Google-ranking or universal AI-understanding claim; live backend demonstration recorded; live installed-extension UI QA pending |
| Concrete fixes | Existing raw/DOM issues and extraction-specific guidance, intent constraints, acceptance tests and copyable prompt | Provider absence alone cannot justify speculative website edits |
| Live pages, several examples | Production raw transport smoke-tested on example.com; approved Search/Fetch server path implemented | Live Search/Fetch now exercised three owner-selected homepages; no site repair/deploy or current live UI recording was performed |
| Short usage explanation | TINYFISH.md and revised DEMO.md | Live run artifacts recorded in output/selected-sites; retain observer timestamps and partial/failed-run caveats |
| Works for any URL | No production domain allowlist; any supported public HTML hostname can be chosen | Literal “any URL” cannot safely include credentials/private networks/authentication; clarify this safety boundary with the bounty reviewers |

The scoring table in the screenshots lists 50 points for one endpoint, 100 for two, and 200 for three or more, with meaningful contribution required. The proposed core uses **two meaningful endpoints**. This is a design target, not awarded points. A paid Agent journey is optional and is not added just to reach a tier.

The footer shows “18 days to build”, individual entries and top three builds approved. The screenshot does not establish the absolute deadline or the user's program registration. The supplied rulebook has now been reviewed, and the user selected https://www.himascorner.com/, https://rayanbuild-site.web.app/, and https://thb-blue.vercel.app/. Live Search/Fetch evidence and temporary server-key access are now recorded. The owner confirmed eligibility/deadline and authorized this public repository. Live installed-extension UI QA and owner video/social materials remain unfinished. No submission or duplicate Job Portal entry has been made.


## Rulebook received and reviewed

Source: user-supplied screenshots and accessibility text of the Rulebook dialog at https://tinybounties.com/crm?view=board, 2026-10-02. This records the supplied content; no authenticated browser was accessed.

- Entrants must be registered in the Students or Ambassadors program. Individual entries only, one submission per person per bounty; claiming does not reserve a bounty. The user has confirmed eligibility and that the deadline is valid; this is owner confirmation, not independent portal verification.
- Each bounty is open for 18 days from launch. New bounties drop on the first Monday each month. The user confirmed the deadline is valid; the absolute date was not independently read from the portal.
- Submit a working-build link (repo, live demo, or cookbook PR) with behavior/TinyFish notes. A LinkedIn post tagging TinyFish is required, plus sharing in TinyFish Discord #showcase. X is optional. The SEO-specific requirements also apply. The owner separately authorized this repository and is handling the video and social posts.
- Every bounty approval criterion must pass. TinyFish must do meaningful live-web work; the build must work end to end for different inputs and be original work built for this bounty. Review is by TinyFish (jointly with partners for partner bounties).
- The top three builds are approved. Approved builds earn gift cards and leaderboard points; three approved builds promote a participant to Student Builder. Displayed reward amounts are not announced. No approval, reward, or awarded score is claimed.
- Other submissions receive feedback in My claims. Submissions are final for that bounty, so evidence and behavior must be checked before any eventual submission.
- No copied/recycled work, fake sources, or padding TinyFish calls for scoring. Never include passwords, API keys, or other people's personal data in the build/demo. Violations may lead to disqualification.

The core remains Search plus Fetch. No paid third endpoint is necessary to prove the core flow. Chrome QA is paused after the supplied crash diagnosis. The three selected homepages will be audited separately to preserve the same-origin boundary. Planned TinyFish allowance: one baseline and one recheck per homepage, at most six searches and six fetched pages total, subject to verified account access and remote-analysis scope. Key entry alone does not authorize or trigger calls.


The owner authorized creating a shareable repository on 2026-10-02 and will produce the demo video and handle LinkedIn/Discord posts. This authorizes publishing the clean project source, not automatically posting, deploying a public helper, or submitting the bounty.
