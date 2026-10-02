import { createApp } from "./app.js";
createApp().listen(4317, "127.0.0.1", () =>
  console.log(
    "PublishProof local helper: http://127.0.0.1:4317 — public HTTP checks only; TinyFish inactive.",
  ),
);
