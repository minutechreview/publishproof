# A short beginner demo

## Credential-free rehearsal

Run `npm run build` and `npm run demo`. Show the clearly labeled fixture popup at `http://127.0.0.1:4317/popup.html`. No API key is needed and no external request occurs.

1. Say: “I built this website. What should I fix before I share it?” Confirm public-page permission and choose **Audit this page**.
2. Show the **55 / 100** fixture score and the verification coverage. Explain that it covers selected basics, not rankings or every visual flaw.
3. Choose **View full report**. Show the four plain-English groups. Open one concrete problem, explain its effect, then reveal its exact URL/evidence only if needed.
4. Choose **Copy repair prompt**. Explain that the coding agent gets scoped technical detail and acceptance tests; the owner reviews changes. PublishProof does not edit or deploy the website. Open **Technical details** for exports rather than making them the first screen.
5. Choose **Check again**. The fixture helper simulates revised responses and the one-page score changes to **90**. Remaining unknowns stay visible. Clearly say “simulated repair,” not “we repaired a live website.”
6. Reload/reopen the fixture popup to show the saved result. Optional multi-page/query controls remain tucked away. Demonstrate a narrow mobile report if helpful.

To repeat the original fixture baseline, stop/restart the demo and forget its saved report. Using the multi-page fixture sample changes the observed checklist and score; do not mix it with the one-page 55 → 90 example.

## Live recording

Follow [START-HERE.md](START-HERE.md) in a separate signed-out Chrome test profile. Use only the approved homepage and query scope. Enter the masked key before recording and keep it out of the video.

Start on the real public page, open the toolbar popup, choose **Audit this page**, and then **View full report**. An AI-enabled report must say **Live TinyFish**. Explain the meaningful integrations: **Search** observes the returned discovery sample, **Fetch** observes readable content, and independent raw HTTP/HTML establishes exact tags and restrictions. Partial samples remain unknown. A synthetic fixture does not satisfy the live-page requirement.

Record each of the three approved public homepages separately. Existing backend evidence is in [the live results](../output/selected-sites/README.md). Those earlier runs were live API observations; they do not prove the redesigned native toolbar UI works. Version 0.2's installed toolbar with live results still needs the manual check.

After an independently reviewed/approved repair and redeployment, refresh the original tab, invoke PublishProof again, and use its allowed **Check again**. Without a site repair, show a repeat observation and do not claim improvement. Do not spend extra allowance just to produce a larger number.

The owner is preparing the video and required LinkedIn/Discord posts. The repository is shareable at https://github.com/minutechreview/publishproof. No social post or bounty submission is performed by this demo plan. No award or approval is claimed.
