# Test and record PublishProof

Use the installed version 0.2 in a separate signed-out Chrome test profile. Complete key entry before starting a recording.

## Prepare

From your local PublishProof project folder, run:

```sh
npm run test:live
```

Enter your existing TinyFish key in the masked Mac dialog and choose **Approve session**. Leave Terminal running. This starts only the local helper; audits require your later clicks. The approved session lasts 30 minutes and permits one audit and one recheck for each homepage:

- `https://www.himascorner.com/`
- `https://rayanbuild-site.web.app/`
- `https://thb-blue.vercel.app/`

Current primary [Search documentation](https://docs.tinyfish.ai/search-api) and [Fetch documentation](https://docs.tinyfish.ai/fetch-api) state that these endpoints do not draw from the wallet. Paid Agent/Browser is inactive.

In your Chrome test profile, type `chrome://extensions` and reload PublishProof. Check that its version is **0.2.0**. If it is not installed, use **Load unpacked** and choose the project's `dist/extension` folder. Close old report tabs and pin PublishProof through the Extensions puzzle menu. [Official Chrome instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

If you want a fresh initial-screen recording but already have a saved score, open that full report, select **Technical details**, and choose **Forget this saved report**. Export it first if you want to retain it. Then return to the actual public website and reopen PublishProof. Forgetting a report does not replenish API allowance.

## Test while recording

1. Open one exact approved homepage in the test profile; Rayan's homepage is a straightforward first choice. Keep additional pages and search words blank.
2. Click the toolbar extension. Select **This page is public, and I have permission to check it** and **Include an AI search check**.
3. Click **Audit this page** once. Wait for the score. If the popup closes, reopen it on the original website; do not start another audit while one is running.
4. Choose **View full report**. Try all four categories: **Needs a fix**, **Worth a review**, **Not verified**, and **Looking good**.
5. Choose **Get my fix prompt** (or **Get my review prompt** if there are no confirmed fixes), then **Copy repair prompt**. Test-paste into an empty text document. Escape closes the prompt dialog.
6. Scroll to **The AI search check**. It should show **Live TinyFish**. Choose **See the evidence**, expand **Search & extracted text evidence**, and show both the returned Search observations and what Fetch extracted. A fixture label is not live evidence.
7. In **Technical details**, try **Export report .md** and **Export evidence .json**. Open the downloaded files to confirm they contain your chosen URL. Refresh the report to confirm the result persists; refreshing does not itself call TinyFish.
8. After a separately reviewed repair/deployment, refresh the original website tab, invoke PublishProof there, and choose **Check this page again** or **Check again** in the report. Without a repair, this is a repeat observation; the score need not increase.
9. Open the next two approved homepages in the same test profile and audit them individually, with the AI option enabled. You do not need to recheck unchanged pages for the video.

Stop on a browser crash or API error and share the exact action/message without your key. Do not repeatedly restart a failing native test. When finished, stop Terminal with Ctrl+C to discard the session key.

## Recording

Press **Shift–Command–5**, choose **Record Selected Portion**, and frame the Chrome toolbar plus webpage. In **Options**, select a microphone if narrating. Keep Terminal and key dashboards outside the recording. Stop with **Command–Control–Esc**. [Apple's recording instructions](https://support.apple.com/en-us/102618).

Aim for a 3–5 minute walkthrough:

- 0:00–0:20: “I built a website with a coding agent. PublishProof helps me understand what to check before sharing it.”
- 0:20–1:00: Show the live popup audit, score, and coverage.
- 1:00–2:00: Show a plain-English finding and copy the scoped prompt.
- 2:00–3:00: Show live Search and Fetch evidence and briefly show the other two real pages.
- 3:00–4:00: Show exports/persistence and, if a real repair was deployed, its permitted fresh recheck.

Say: “The score covers checked page basics. Unknowns remain unknown. Search shows a discovery sample, Fetch shows readable text, and a score improves only when fresh evidence verifies a repair.” Do not claim Google ranking gains, a live repair from fixtures, or universal AI understanding.

The current native toolbar/live-result flow remains the owner's manual check. Fixture preview and backend tests do not replace it.
