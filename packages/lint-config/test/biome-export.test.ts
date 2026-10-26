import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("..", import.meta.url));

const bun = process.env.BUN_BIN ?? "bun";

function consumer(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "biome-export-"));

  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        dependencies: {
          "@biomejs/biome": "2.5.11",
          "@sitaggart/lint-config": `file:${packageDir}`,
        },
        name: "biome-consumer",
        private: true,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(root, "biome.json"),
    '{\n  "extends": ["@sitaggart/lint-config/biome.json"],\n  "root": true\n}\n',
  );
  mkdirSync(join(root, "src"));

  for (const [path, contents] of Object.entries(files)) {
    writeFileSync(join(root, path), contents);
  }

  execFileSync(bun, ["install"], { cwd: root, stdio: "inherit" });

  const result = spawnSync(join(root, "node_modules/.bin/biome"), ["ci", "."], {
    cwd: root,
    encoding: "utf8",
  });

  return { root, status: result.status ?? 1, stderr: result.stderr };
}

await test("biome.json export lints a consumer", () => {
  const clean = consumer({ "src/ok.ts": "export const value = 1;\n" });

  try {
    assert.equal(clean.status, 0, clean.stderr);
  } finally {
    rmSync(clean.root, { force: true, recursive: true });
  }

  const dirty = consumer({ "src/bad.ts": "export const bad = 1 == 2;\n" });

  try {
    assert.notEqual(dirty.status, 0, "a Biome violation exits non-zero");
  } finally {
    rmSync(dirty.root, { force: true, recursive: true });
  }
});
