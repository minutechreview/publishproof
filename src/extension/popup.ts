const button = document.querySelector<HTMLButtonElement>("#open")!;
button.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url?.startsWith("http"))
      throw new Error("Open a public HTTP(S) website first.");
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`report.html?tab=${tab.id}`),
    });
    window.close();
  } catch (e) {
    document.querySelector("#message")!.textContent =
      e instanceof Error ? e.message : "Unable to open page auditor.";
  }
});
