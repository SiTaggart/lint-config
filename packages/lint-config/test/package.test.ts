import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import manifest from "../package.json" with { type: "json" };

type ExportTarget = (typeof manifest.exports)[keyof typeof manifest.exports];

const antiSlopRuleNames = [
  "no-array-filter-map",
  "no-chained-type-assertions",
  "no-conditional-empty-object-spread",
  "no-known-value-widening",
  "no-module-mocking",
  "no-object-parameters",
  "no-reduce-accumulator-copy",
  "no-reflect-apply",
  "no-reflect-get",
  "no-runtime-typeof",
  "no-shape-in-symbol-names",
  "no-unknown-parameters",
  "no-unknown-returns",
  "no-unknown-type-aliases",
  "no-unsafe-dictionary-type",
  "no-widen-then-assert",
  "require-readable-spacing",
  "require-safety-comment-for-type-assertion",
];

function isPath(target: ExportTarget): target is string {
  return typeof target === "string";
}

function hasFiles(value: unknown): value is { readonly files: ReadonlyArray<unknown> } {
  return typeof value === "object" && value !== null && "files" in value && Array.isArray(value.files);
}

function isPackedFile(value: unknown): value is { readonly path: string } {
  return typeof value === "object" && value !== null && "path" in value && typeof value.path === "string";
}

function isPluginModule(value: unknown): value is { readonly default: { readonly rules: object } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "default" in value &&
    typeof value.default === "object" &&
    value.default !== null &&
    "rules" in value.default &&
    typeof value.default.rules === "object" &&
    value.default.rules !== null
  );
}

function packedPaths(stdout: string): ReadonlyArray<string> {
  const output: unknown = JSON.parse(stdout);
  const report: unknown = Array.isArray(output) ? output[0] : undefined;

  if (!hasFiles(report)) {
    throw new Error(`npm pack printed no file list:\n${stdout}`);
  }

  return report.files.map((file) => {
    if (!isPackedFile(file)) {
      throw new Error(`Unexpected npm pack entry: ${JSON.stringify(file)}`);
    }

    return file.path;
  });
}

// npm, not Bun, publishes the package, so its file list is the one that ships.
const packed = packedPaths(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  }),
);

await test("publishes every exports target", () => {
  const targets = Object.values(manifest.exports).flatMap((target) => (isPath(target) ? [target] : Object.values(target)));

  for (const target of targets) {
    assert.ok(packed.includes(target.replace(/^\.\//u, "")), `${target} ships`);
  }
});

await test("publishes JavaScript and declarations, not TypeScript source or tests", () => {
  assert.deepEqual(
    packed.filter((path) => path.endsWith(".ts") && !path.endsWith(".d.ts")),
    [],
  );
  assert.deepEqual(
    packed.filter((path) => path.includes(".test.")),
    [],
  );
});

await test("publishes the vendored licenses", () => {
  assert.ok(packed.includes("dist/anti-slop/LICENSE"));
  assert.ok(packed.includes("dist/anti-slop/vendor/eslint-stylistic/LICENSE"));
});

await test("./anti-slop ships exactly the 18 generic rules", async () => {
  const plugin: unknown = await import(new URL("../dist/anti-slop/index.js", import.meta.url).href);

  assert.ok(isPluginModule(plugin), "dist/anti-slop/index.js default-exports a plugin");
  assert.deepEqual(Object.keys(plugin.default.rules).toSorted(), antiSlopRuleNames);
});
