import assert from "node:assert/strict";
import { test } from "node:test";

import { lint, rulesIn } from "./consumer.ts";

const namedEffect = 'import { useEffect } from "react";\n\nuseEffect(() => {}, []);\n';

const effectForms = [
  { file: "src/effect/named.ts", rule: "no-restricted-imports", source: namedEffect },
  { file: "src/effect/aliased.ts", rule: "no-restricted-imports", source: 'import { useLayoutEffect as ule } from "react";\n\nule(() => {}, []);\n' },
  { file: "src/effect/reexport.ts", rule: "no-restricted-imports", source: 'export { useEffect } from "react";\n' },
  { file: "src/effect/namespace.ts", rule: "no-restricted-imports", source: 'import * as R from "react";\n\nexport const r = R;\n' },
  { file: "src/effect/namespace-member.ts", rule: "no-restricted-properties", source: 'import * as R from "react";\n\nR.useEffect(() => {}, []);\n' },
  { file: "src/effect/default-member.ts", rule: "no-restricted-properties", source: 'import React from "react";\n\nReact.useLayoutEffect(() => {}, []);\n' },
  { file: "src/effect/destructure.ts", rule: "no-restricted-properties", source: 'import React from "react";\n\nexport const { useEffect } = React;\n' },
  { file: "src/effect/computed.ts", rule: "no-restricted-properties", source: 'import React from "react";\n\nReact["useEffect"](() => {}, []);\n' },
];

const allowedReact = {
  "src/react/state.ts": 'import { useState } from "react";\n\nexport const state = useState;\n',
  "src/react/state-member.ts": 'import React from "react";\n\nexport const state = React.useState;\n',
};

const unknownAlias = "export type Value = unknown;\n";

const ignoredFiles = [
  "dist/x.ts",
  "coverage/x.ts",
  ".wrangler/x.ts",
  ".output/x.ts",
  ".tanstack/x.ts",
  ".ai/x.ts",
  "node_modules/x/x.ts",
  "worker-configuration.d.ts",
  "src/routeTree.gen.ts",
];

const floating = "async function load(): Promise<number> {\n  return 1;\n}\n\nload();\n";

const reports = lint("defineConfig()", {
  ...Object.fromEntries(effectForms.map(({ file, source }) => [file, source])),
  ...allowedReact,
  ...Object.fromEntries(ignoredFiles.map((file) => [file, unknownAlias])),
  "src/control.ts": unknownAlias,
  "src/floating.ts": floating,
  "src/reflect.ts": 'export const value = Reflect.get({ a: 1 }, "a");\n',
  "src/typeof-bare.ts":
    'export function size(value: string | number): number {\n  if (typeof value === "string") {\n    return value.length;\n  }\n\n  return value;\n}\n',
  "src/typeof-guard.ts": 'export function isText(value: unknown): value is string {\n  return typeof value === "string";\n}\n',
});

await test("bans every React effect import and member form", () => {
  for (const { file, rule } of effectForms) {
    assert.ok(rulesIn(reports, file).includes(rule), `${file} reports ${rule}`);
  }
});

await test("leaves other React hooks alone", () => {
  for (const file of Object.keys(allowedReact)) {
    const rules = rulesIn(reports, file);

    assert.ok(!rules.includes("no-restricted-imports"), `${file} has no import report`);
    assert.ok(!rules.includes("no-restricted-properties"), `${file} has no property report`);
  }
});

await test("skips every shared ignore pattern", () => {
  assert.deepEqual(rulesIn(reports, "src/control.ts"), ["anti-slop/no-unknown-type-aliases"]);

  for (const file of ignoredFiles) {
    assert.deepEqual(rulesIn(reports, file), [], `${file} is ignored`);
  }
});

await test("runs anti-slop rules", () => {
  assert.ok(rulesIn(reports, "src/reflect.ts").includes("anti-slop/no-reflect-get"));
  assert.ok(rulesIn(reports, "src/typeof-bare.ts").includes("anti-slop/no-runtime-typeof"));
  assert.ok(!rulesIn(reports, "src/typeof-guard.ts").includes("anti-slop/no-runtime-typeof"), "typeof is allowed in a type guard");
});

await test("runs type-aware rules by default", () => {
  assert.ok(rulesIn(reports, "src/floating.ts").includes("typescript/no-floating-promises"));
});

await test("turns type-aware rules off with typeAware false", () => {
  const untyped = lint("defineConfig({ options: { typeAware: false } })", { "src/floating.ts": floating });

  assert.ok(!rulesIn(untyped, "src/floating.ts").includes("typescript/no-floating-promises"));
});

await test("appends caller ignore patterns to the shared list", () => {
  const custom = lint('defineConfig({ ignorePatterns: ["public/**"] })', {
    "dist/x.ts": unknownAlias,
    "public/x.ts": unknownAlias,
    "src/control.ts": unknownAlias,
  });

  assert.deepEqual(rulesIn(custom, "public/x.ts"), []);
  assert.deepEqual(rulesIn(custom, "dist/x.ts"), []);
  assert.deepEqual(rulesIn(custom, "src/control.ts"), ["anti-slop/no-unknown-type-aliases"]);
});

const importEntryForms = [
  { entry: '"lodash"', name: "module name" },
  { entry: '{ message: "Use the helpers.", name: "lodash" }', name: "path object" },
  { entry: '{ paths: ["lodash"], patterns: [{ group: ["lodash/*"] }] }', name: "paths and patterns object" },
];

for (const { entry, name } of importEntryForms) {
  await test(`keeps the React ban when the caller adds a ${name}`, () => {
    const custom = lint(`defineConfig({ rules: { "no-restricted-imports": ["error", ${entry}] } })`, {
      "src/lodash.ts": 'import { map } from "lodash";\n\nexport const m = map;\n',
      "src/react.ts": namedEffect,
    });

    assert.ok(rulesIn(custom, "src/lodash.ts").includes("no-restricted-imports"), "lodash is banned");
    assert.ok(rulesIn(custom, "src/react.ts").includes("no-restricted-imports"), "useEffect is still banned");
  });
}

await test("keeps the patterns of a paths and patterns object", () => {
  const custom = lint('defineConfig({ rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["lodash/*"] }] }] } })', {
    "src/lodash.ts": 'import map from "lodash/map";\n\nexport const m = map;\n',
  });

  assert.ok(rulesIn(custom, "src/lodash.ts").includes("no-restricted-imports"));
});

await test("keeps the React ban when the caller adds a property restriction", () => {
  const custom = lint(
    'defineConfig({ rules: { "no-restricted-properties": ["error", { object: "Math", property: "random" }] } })',
    {
      "src/random.ts": "export const n = Math.random();\n",
      "src/react.ts": 'import React from "react";\n\nReact.useEffect(() => {}, []);\n',
    },
  );

  assert.ok(rulesIn(custom, "src/random.ts").includes("no-restricted-properties"), "Math.random is banned");
  assert.ok(rulesIn(custom, "src/react.ts").includes("no-restricted-properties"), "React.useEffect is still banned");
});

await test("off disables only the rule the caller turns off", () => {
  const custom = lint('defineConfig({ rules: { "no-restricted-imports": "off" } })', {
    "src/member.ts": 'import * as R from "react";\n\nR.useEffect(() => {}, []);\n',
    "src/named.ts": namedEffect,
  });

  assert.ok(!rulesIn(custom, "src/named.ts").includes("no-restricted-imports"), "the import half is off");
  assert.ok(rulesIn(custom, "src/member.ts").includes("no-restricted-properties"), "the property half still runs");
});

await test("keeps the React ban in overrides and extended configs that set the rules", () => {
  const custom = lint(
    `defineConfig({
      extends: [{ rules: { "no-restricted-properties": ["error", { object: "Math", property: "random" }] } }],
      overrides: [{ files: ["src/**"], rules: { "no-restricted-imports": ["error", "lodash"] } }],
    })`,
    {
      "src/member.ts": 'import React from "react";\n\nReact.useEffect(() => {}, []);\n',
      "src/named.ts": namedEffect,
    },
  );

  assert.ok(rulesIn(custom, "src/named.ts").includes("no-restricted-imports"), "override keeps the import ban");
  assert.ok(rulesIn(custom, "src/member.ts").includes("no-restricted-properties"), "extended config keeps the property ban");
});

await test("stylex allows only the StyleX namespace import", () => {
  const files = {
    "src/path.ts": 'import * as path from "node:path";\n\nexport const p = path;\n',
    "src/stylex.ts": 'import * as stylex from "@stylexjs/stylex";\n\nexport const s = stylex;\n',
  };
  const plain = lint("defineConfig()", files);
  const withStylex = lint("defineConfig({ extends: [stylex] })", files);

  assert.ok(rulesIn(plain, "src/stylex.ts").includes("import/no-namespace"), "off by default");
  assert.ok(!rulesIn(withStylex, "src/stylex.ts").includes("import/no-namespace"), "allowed with stylex");
  assert.ok(rulesIn(withStylex, "src/path.ts").includes("import/no-namespace"), "other namespaces stay banned");
});
