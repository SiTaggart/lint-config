import assert from "node:assert/strict";
import { test } from "node:test";

import { formatCheck, oxfmtJsonConfig, oxfmtModuleConfig } from "./consumer.ts";

const unformatted = "export const a = 'x'\n";

const ignoredFiles = [
  "dist/x.ts",
  "coverage/x.ts",
  ".wrangler/x.ts",
  ".output/x.ts",
  ".tanstack/x.ts",
  ".ai/x.ts",
  "worker-configuration.d.ts",
  "src/routeTree.gen.ts",
];

const fixtures = {
  ...Object.fromEntries(ignoredFiles.map((file) => [file, unformatted])),
  "src/formatted.ts": 'export const a = "x";\n',
  "src/unformatted.ts": unformatted,
};

const configs = [
  { config: oxfmtModuleConfig, name: "oxfmt.config.ts re-exporting ./oxfmt" },
  { config: oxfmtJsonConfig, name: ".oxfmtrc.json copied from ./oxfmt.json" },
];

for (const { config, name } of configs) {
  await test(`${name} keeps oxfmt defaults and skips every shared ignore pattern`, () => {
    const rejected = formatCheck({ ...fixtures, ...config });

    assert.ok(rejected.includes("src/unformatted.ts"), "single quotes and a missing semicolon are rejected");
    assert.ok(!rejected.includes("src/formatted.ts"), "double quotes pass");

    for (const file of ignoredFiles) {
      assert.ok(!rejected.includes(file), `${file} is ignored`);
    }
  });
}

await test("without the shared config, the ignored files are checked", () => {
  const rejected = formatCheck(fixtures);

  for (const file of ignoredFiles) {
    assert.ok(rejected.includes(file), `${file} is checked`);
  }
});
