# Start here

The everyday flow is: **open a public page → PublishProof → Audit this page → View full report**. No routes, search query, or technical settings are required for the default audit.

## 1. Start the local helper

In the project folder, run:

```sh
npm ci
npm run build
npm run dev
```

Keep Terminal open. This option checks public HTTP/HTML without an API key or TinyFish calls.

For the approved live AI test on this Mac, use `npm run test:live` instead of `npm run dev`. It opens a masked Mac dialog for the key and exact scope approval. No browser opens and no audit starts automatically. The key remains in backend memory and expires after 30 minutes. The session allows one audit and one recheck of each named homepage, one at a time with the search query blank:

- `https://www.himascorner.com/`
- `https://rayanbuild-site.web.app/`
- `https://thb-blue.vercel.app/`

Use the exact approved address: `https://himascorner.com/` differs from the approved `www` URL. The extension now hides the optional AI check when the current page is outside the helper's approved scope and explains the permitted URL. If the site redirects to an unapproved origin, stop that AI sample; do not bypass the scope gate.

Only one helper can use port 4317. To switch helpers or load updated server code, stop your existing helper with Ctrl+C first. A new live session requires a new key-and-scope approval. It does not renew the prior allowance automatically. Stop on access/billing errors; do not add funds or switch to a paid endpoint. Enter the key before recording a demo.

## 2. Reload or load PublishProof

Use a separate signed-out Chrome test profile. Keep your normal browser profile untouched.

If PublishProof is already installed, type `chrome://extensions` into the address bar and click its **Reload** button after building. Close old PublishProof report tabs so you open the new interface. The extension version is **0.2.0**.

For a first installation, enable Developer mode, choose **Load unpacked**, and select this project's **dist/extension** folder. If you downloaded the ZIP, extract it first and select the folder containing `manifest.json`. Pin PublishProof from the Extensions puzzle menu if you want it in the toolbar. [Chrome's official installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## 3. Audit from the toolbar

1. Open a public website in this test profile. For the bounded AI session, use one exact approved homepage above.
2. Click PublishProof in the Chrome toolbar.
3. Check **This page is public, and I have permission to check it**. If you want the approved Search/Fetch observations, also select **Include an AI search check**. That choice permits sending only the public URL to TinyFish.
4. Click **Audit this page**. You can close the popup while it runs; its report tab keeps working.
5. Reopen PublishProof on that page to see the saved score, coverage, and counts. Choose **View full report**.

The score covers checked basics. It does not certify every visual issue or predict Google rankings. A helper/provider problem should show an understandable error and preserve your previous report, rather than silently earning points.

## 4. Use the full report

Read **Needs a fix** first, then **Worth a review**, **Not verified**, and **Looking good**. Each observation belongs to an exact page. Details are optional.

Choose **Copy repair prompt** when there is something to repair or review. Paste it into your coding agent, review its proposed changes, and deploy through your usual workflow. PublishProof itself never changes or deploys the website.

**Technical details** contains the evidence, score methodology, AI observations, and **Export report / Export evidence** controls. Copy/export buttons alone do not call TinyFish.

## 5. Check after a repair

Refresh the original website tab, click PublishProof again to grant fresh current-tab access, and choose **Check this page again** in the popup or **Check again** in the report.

The same public page(s) and AI setting are checked with fresh evidence. A verified repair can improve its points; an unchanged site does not deserve an automatic increase. Unknown observations remain unknown. Changing the URLs creates a different sample, rather than a before/after claim. [How scores work](SCORE.md).

For the bounded live session, make only its allowed recheck. To test the other selected sites, open each approved homepage and audit it separately. There is no need to add routes or a query.

## Common messages

- **Local helper unavailable:** start one helper, keep Terminal open, and reopen the popup.
- **AI search check unavailable:** raw-only `npm run dev` is fine for an ordinary audit. The approved AI session needs `npm run test:live` and its separate scope approval.
- **Use the approved homepage:** use the exact displayed URL, with no additional routes or query. The `www` and non-`www` addresses are different scopes.
- **Allowance exhausted / session expired:** stop the live test. Fresh approval is required for another session.
- **Chrome closes or crashes:** stop at the first failure and record the action/time. Do not repeatedly relaunch a failing native test.

When finished with the live helper, press Ctrl+C to discard the in-memory key.

## What has been tested

Version 0.2 passed 55 automated tests, typecheck/build, and fixture report/popup-preview QA. The redesigned installed toolbar with live results remains a **manual check**: an isolated native debugging session closed and was stopped. The fixture preview is not proof of Chrome's native popup/permission behavior. [Test report](TEST-REPORT.md).
