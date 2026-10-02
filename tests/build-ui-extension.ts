// Fixture-only QA bundle. Production builds never import this module or allow this port.
import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
const out = "output/extension-qa-fixture";
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["src/extension/popup.ts", "src/extension/report.ts"],
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome120",
  platform: "browser",
  plugins: [
    {
      name: "isolated-fixture-helper",
      setup(builder) {
        builder.onLoad(
          { filter: /\/extension\/client\.ts$/ },
          async (args) => ({
            contents: (await readFile(args.path, "utf8")).replace(
              '"http://127.0.0.1:4317"',
              '"http://127.0.0.1:4319"',
            ),
            loader: "ts",
          }),
        );
      },
    },
  ],
});
for (const file of ["popup.html", "report.html", "styles.css"])
  await copyFile("src/extension/" + file, out + "/" + file);
const manifest = JSON.parse(
  await readFile("src/extension/manifest.json", "utf8"),
);
manifest.host_permissions = ["http://127.0.0.1:4319/*"];
manifest.content_security_policy.extension_pages =
  manifest.content_security_policy.extension_pages.replaceAll(
    "http://127.0.0.1:4317",
    "http://127.0.0.1:4319",
  );
manifest.name = "PublishProof · FIXTURE QA ONLY";
await writeFile(out + "/manifest.json", JSON.stringify(manifest, null, 2));
console.log(
  "Built fixture-only QA extension; production permissions and port unchanged.",
);
