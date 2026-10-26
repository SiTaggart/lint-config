import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const renovateChangeset = `---
"@sitaggart/lint-config": patch
---

Update dependencies
`;

const defaultPath = fileURLToPath(
  new URL("../.changeset/renovate-dependencies.md", import.meta.url),
);

export function writeRenovateChangeset(path = defaultPath): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renovateChangeset);
}

const entry = process.argv[1];

if (
  entry !== undefined &&
  (entry.endsWith("write-renovate-changeset.ts") || entry.endsWith("write-renovate-changeset.js"))
) {
  writeRenovateChangeset();
}
