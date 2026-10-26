import assert from "node:assert/strict";
import { test } from "node:test";

import { lint, rulesIn } from "./consumer.ts";

const namedEffect = 'import { useEffect } from "react";\n\nuseEffect(() => {}, []);\n';

const effectRule = "react-effect-ban/no-react-effects";

const effectForms = [
  { file: "src/effect/named.ts", source: namedEffect },
  {
    file: "src/effect/aliased.ts",
    source: 'import { useLayoutEffect as ule } from "react";\n\nule(() => {}, []);\n',
  },
  {
    file: "src/effect/reexport.ts",
    source: 'export { useEffect } from "react";\n',
  },
  {
    file: "src/effect/namespace.ts",
    source: 'import * as R from "react";\n\nexport const r = R;\n',
  },
  {
    file: "src/effect/namespace-member.ts",
    source: 'import * as R from "react";\n\nR.useEffect(() => {}, []);\n',
  },
  {
    file: "src/effect/default-member.ts",
    source: 'import React from "react";\n\nReact.useLayoutEffect(() => {}, []);\n',
  },
  {
    file: "src/effect/destructure.ts",
    source: 'import React from "react";\n\nexport const { useEffect } = React;\n',
  },
  {
    file: "src/effect/computed.ts",
    source: 'import React from "react";\n\nReact["useEffect"](() => {}, []);\n',
  },
  {
    file: "src/effect/literal-key.ts",
    source:
      'const source = { useEffect() {} };\n\nexport const { ["useEffect"]: effect } = source;\n',
  },
];

const allowedReact = {
  "src/react/computed-key.ts":
    'const useEffect = "value";\n\nexport const { [useEffect]: value } = { value: 1 };\n',
  "src/react/state-member.ts":
    'import React from "react";\n\nexport const state = React.useState;\n',
  "src/react/state.ts": 'import { useState } from "react";\n\nexport const state = useState;\n',
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
  "src/typeof-guard.ts":
    'export function isText(value: unknown): value is string {\n  return typeof value === "string";\n}\n',
});

await test("bans every React effect import and member form", () => {
  for (const { file } of effectForms) {
    assert.ok(rulesIn(reports, file).includes(effectRule), `${file} reports ${effectRule}`);
  }
});

await test("leaves other React hooks alone", () => {
  for (const file of Object.keys(allowedReact)) {
    assert.ok(!rulesIn(reports, file).includes(effectRule), `${file} has no effect report`);
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
  assert.ok(
    !rulesIn(reports, "src/typeof-guard.ts").includes("anti-slop/no-runtime-typeof"),
    "typeof is allowed in a type guard",
  );
});

await test("runs type-aware rules by default", () => {
  assert.ok(rulesIn(reports, "src/floating.ts").includes("typescript/no-floating-promises"));
});

await test("turns type-aware rules off with typeAware false", () => {
  const untyped = lint("defineConfig({ options: { typeAware: false } })", {
    "src/floating.ts": floating,
  });

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

await test("keeps the React effect ban when the caller sets no-restricted-imports", () => {
  const custom = lint(
    'defineConfig({ rules: { "no-restricted-imports": ["error", { name: "lodash" }] } })',
    {
      "src/lodash.ts": 'import { map } from "lodash";\n\nexport const m = map;\n',
      "src/react.ts": namedEffect,
    },
  );

  assert.ok(rulesIn(custom, "src/lodash.ts").includes("no-restricted-imports"), "lodash is banned");
  assert.ok(rulesIn(custom, "src/react.ts").includes(effectRule), "useEffect is still banned");
});

await test("stylex allows only the StyleX namespace import", () => {
  const files = {
    "src/path.ts": 'import * as path from "node:path";\n\nexport const p = path;\n',
    "src/stylex.ts": 'import * as stylex from "@stylexjs/stylex";\n\nexport const s = stylex;\n',
  };

  const plain = lint("defineConfig()", files);
  const withStylex = lint("defineConfig({ extends: [stylex] })", files);

  assert.ok(rulesIn(plain, "src/stylex.ts").includes("import/no-namespace"), "off by default");
  assert.ok(
    !rulesIn(withStylex, "src/stylex.ts").includes("import/no-namespace"),
    "allowed with stylex",
  );
  assert.ok(
    rulesIn(withStylex, "src/path.ts").includes("import/no-namespace"),
    "other namespaces stay banned",
  );
});
