import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rulesIn } from "./consumer.ts";

import type { ProjectFiles } from "./consumer.ts";

const effectRule = "react-effect-ban/no-react-effects";

const configPath = fileURLToPath(import.meta.resolve("@sitaggart/lint-config/oxlint"));

const oxlint = fileURLToPath(new URL("bin/oxlint", import.meta.resolve("oxlint/package.json")));

const tsgolint = fileURLToPath(
  new URL("bin/tsgolint.js", import.meta.resolve("oxlint-tsgolint/package.json")),
);

const tsconfig = `${JSON.stringify(
  {
    compilerOptions: {
      module: "NodeNext",
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: "ES2024",
    },
  },
  null,
  2,
)}\n`;

const dirty = {
  "src/effect-import.ts": 'import { useEffect } from "react";\n\nuseEffect(() => {}, []);\n',
  "src/namespace-member.ts": 'import * as React from "react";\n\nReact.useEffect(() => {}, []);\n',
  "src/nkzw.ts": 'console.log("nkzw");\n',
  "src/react-member.ts": 'import React from "react";\n\nReact.useEffect(() => {}, []);\n',
} satisfies ProjectFiles;

const clean = {
  "src/ok.ts": "export const value = 1;\n",
} satisfies ProjectFiles;

function isDiagnostic(
  value: unknown,
): value is { readonly code: string; readonly filename: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    "filename" in value &&
    typeof value.filename === "string"
  );
}

function hasDiagnostics(value: unknown): value is { readonly diagnostics: ReadonlyArray<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "diagnostics" in value &&
    Array.isArray(value.diagnostics)
  );
}

function ruleKey(code: string): string {
  const groups = /^(?<plugin>[^(]+)\((?<rule>[^)]+)\)$/u.exec(code)?.groups;

  if (groups === undefined) {
    throw new Error(`Unrecognized oxlint diagnostic code: ${code}`);
  }

  return groups.plugin === "eslint" ? groups.rule : `${groups.plugin}/${groups.rule}`;
}

function lintConfig(files: ProjectFiles) {
  const root = mkdtempSync(join(tmpdir(), "oxlint-config-cli-"));

  try {
    for (const [path, contents] of Object.entries({ "tsconfig.json": tsconfig, ...files })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), contents);
    }

    const result = spawnSync(process.execPath, [oxlint, "--config", configPath, "--format=json"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OXLINT_TSGOLINT_PATH: tsgolint },
    });

    const output: unknown = JSON.parse(result.stdout);

    if (!hasDiagnostics(output)) {
      throw new Error(`oxlint printed no diagnostics:\n${result.stdout}\n${result.stderr}`);
    }

    const reports = output.diagnostics.map((diagnostic) => {
      if (!isDiagnostic(diagnostic)) {
        throw new Error(`Unexpected oxlint diagnostic: ${JSON.stringify(diagnostic)}`);
      }

      return { file: diagnostic.filename, rule: ruleKey(diagnostic.code) };
    });

    return { reports, status: result.status ?? 1 };
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

await test("oxlint --config fails the dirty fixture", () => {
  const { reports, status } = lintConfig(dirty);

  assert.notEqual(status, 0, "dirty fixture exits non-zero");
  assert.ok(rulesIn(reports, "src/effect-import.ts").includes(effectRule), "named useEffect");
  assert.ok(rulesIn(reports, "src/react-member.ts").includes(effectRule), "React.useEffect");
  assert.ok(
    rulesIn(reports, "src/namespace-member.ts").includes(effectRule),
    "namespace member useEffect",
  );
  assert.ok(rulesIn(reports, "src/nkzw.ts").includes("no-console"), "nkzw no-console");
});

await test("oxlint --config passes the clean fixture", () => {
  const { reports, status } = lintConfig(clean);

  assert.equal(status, 0, "clean fixture exits zero");
  assert.deepEqual(reports, []);
});
