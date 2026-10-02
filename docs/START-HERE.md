# Test PublishProof manually

The helper and API key from the earlier live run have been stopped/discarded. A new live UI session needs a private key entry. These steps let you test without an automated Chrome launch.

## Start the helper on this Mac

In Terminal, open this project folder and run:

```sh
npm ci
npm run build
npm run test:live
```

The last command displays a masked Mac dialog. Read the scope, enter the TinyFish key, and click **Approve session**. This authorizes only the three named public homepages, one audit and one recheck each (maximum six searches and six fetched pages), for 30 minutes. The key stays in backend memory. No provider call starts automatically; no browser opens. Leave Terminal running. Current provider documentation lists Search/Fetch as free; proceed only if that pricing applies. No paid Agent/Browser call is available.

For a key-free button test instead, run `npm run dev`. It scans real public pages but the Search/Fetch checkbox stays inactive. `npm run demo` uses labeled synthetic fixtures and is not a live bounty demo. Do not run these helpers at the same time; they share port 4317.

## Load the extension in a separate test profile

1. Open a separate signed-out Chrome test profile. Keep your normal profile untouched.
2. In that profile, type `chrome://extensions` into the address bar. Enable Developer mode and click **Load unpacked**. Select the `dist/extension` folder inside this project, not its ZIP. If PublishProof is already loaded, click its reload button after rebuilding. [Chrome's official instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).
3. Open `https://www.himascorner.com/`. Click the Extensions puzzle icon, choose PublishProof, then **Open page auditor**.
4. Check the Current public page URL. Leave additional routes and target query blank for this bounded live session. If an older report is displayed, choose **Start a new sample** and set the new URL.
5. Tick public-page consent, **Add Search & Fetch observations**, and remote-analysis consent. Click **Check selected pages**.

## Check the buttons and evidence

- A report should appear with exact page URLs and evidence. The Search/Fetch panel should say **Live TinyFish**, not contract fixture. A provider error or partial sample must stay unknown rather than becoming a pass.
- Try the findings filters and **Copy repair prompt**. Copy only after reviewing the evidence; do not apply or deploy changes just to test this button. A report with no confirmed repair does not need an invented code change.
- Try **Export Markdown** and **Export JSON**. The corrected extension uses data-URL downloads. If Chrome crashes again, stop the test after that first crash and report the time/action; do not repeat it. The earlier workaround passed isolated QA, but it is not a guarantee for every Chrome version.
- Refresh the public site tab, then click **Recheck same URLs** in the report. Without a site edit/deployment, this is a fresh observation and should not be presented as a repair. If the source-tab permission expired, click PublishProof on the public page again.
- Start a new sample and repeat once for `https://rayanbuild-site.web.app/` and `https://thb-blue.vercel.app/`. Each site is audited alone because they are different origins. If the helper reports a minute rate limit, wait a minute before beginning the next distinct sample; do not repeat failed API calls automatically. Stop on API access/billing errors instead of adding funds or switching endpoints.

When finished, press Ctrl+C in Terminal to stop the helper and discard the session key. If recording a video, enter the key before starting the recording. Share only public pages and bounded reports. No emails/forms/purchases/site edits/deployments/posts/submissions are part of the UI test.

## Common messages

- **Local helper unavailable:** start exactly one helper and keep its Terminal window running, then reload the report.
- **Search/Fetch inactive:** `npm run dev` is raw-only. For the real three-site UI test use `npm run test:live` and approve its masked dialog.
- **Scope differs:** the live UI test allows one named homepage at a time, routes blank, query blank. Broader custom live scopes use the explicit CLI in TINYFISH.md.
- **Allowance exhausted or session expired:** stop. A new session requires new explicit scope approval; restarting is not an automatic renewal of the prior allowance.

The new one-command launcher passed scope/expiry tests and native dialog syntax compilation. It has not yet been exercised through a new installed-extension live UI session; that is the manual test described here.
