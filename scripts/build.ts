import { build } from "esbuild";
import { mkdir, copyFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("dist/extension", { recursive: true });
await build({
  entryPoints: ["src/extension/popup.ts", "src/extension/report.ts"],
  outdir: "dist/extension",
  bundle: true,
  format: "iife",
  target: "chrome120",
  platform: "browser",
  sourcemap: true,
});
for (const file of ["manifest.json", "popup.html", "report.html", "styles.css"])
  await copyFile(`src/extension/${file}`, `dist/extension/${file}`);
const manifest = JSON.parse(
  await readFile("dist/extension/manifest.json", "utf8"),
);
if (
  manifest.manifest_version !== 3 ||
  JSON.stringify(manifest.permissions) !==
    JSON.stringify(["activeTab", "scripting"])
)
  throw new Error("Manifest permission regression.");
execFileSync("zip", ["-q", "-r", "../publishproof-unpacked.zip", "."], {
  cwd: "dist/extension",
});
console.log(
  "Built dist/extension and dist/publishproof-unpacked.zip (no API secrets).",
);
