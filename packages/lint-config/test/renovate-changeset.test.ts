import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  renovateChangeset,
  writeRenovateChangeset,
} from "../../../scripts/write-renovate-changeset.ts";

const renovatePath = fileURLToPath(new URL("../../../.github/renovate.json", import.meta.url));

await test("renovate runs the changeset script once per branch", () => {
  const config: unknown = JSON.parse(readFileSync(renovatePath, "utf8"));

  assert.ok(isRenovateConfig(config));
  assert.deepEqual(config.postUpgradeTasks.commands, ["bun scripts/write-renovate-changeset.ts"]);
  assert.equal(config.postUpgradeTasks.executionMode, "branch");
  assert.deepEqual(config.postUpgradeTasks.fileFilters, [".changeset/renovate-dependencies.md"]);
});

await test("the renovate changeset names this package and stays stable", () => {
  const root = mkdtempSync(join(tmpdir(), "renovate-changeset-"));
  const path = join(root, ".changeset", "renovate-dependencies.md");

  try {
    writeRenovateChangeset(path);
    writeRenovateChangeset(path);
    assert.equal(readFileSync(path, "utf8"), renovateChangeset);
    assert.match(renovateChangeset, /"@sitaggart\/lint-config": patch/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

function isRenovateConfig(value: unknown): value is {
  readonly postUpgradeTasks: {
    readonly commands: ReadonlyArray<string>;
    readonly executionMode: string;
    readonly fileFilters: ReadonlyArray<string>;
  };
} {
  if (typeof value !== "object" || value === null || !("postUpgradeTasks" in value)) {
    return false;
  }

  const tasks: unknown = value.postUpgradeTasks;

  if (typeof tasks !== "object" || tasks === null) {
    return false;
  }

  return (
    "commands" in tasks &&
    Array.isArray(tasks.commands) &&
    "executionMode" in tasks &&
    typeof tasks.executionMode === "string" &&
    "fileFilters" in tasks &&
    Array.isArray(tasks.fileFilters)
  );
}
