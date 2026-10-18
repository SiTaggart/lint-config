import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const packageDir = join(repoRoot, "packages/lint-config");

const dist = join(packageDir, "dist");

const parked = join(packageDir, "dist.release-format-parked");

const changelog = join(packageDir, "CHANGELOG.md");

function hideDist(): boolean {
  if (!existsSync(dist)) {
    return false;
  }

  renameSync(dist, parked);

  return true;
}

const original = readFileSync(changelog);

let hidDist = false;

try {
  hidDist = hideDist();

  const result = spawnSync(
    process.execPath,
    ["x", "oxfmt", "--write", "--no-error-on-unmatched-pattern", changelog],
    { cwd: repoRoot, encoding: "utf8" },
  );

  if (result.status === 0) {
    process.stdout.write("release format oxfmt exited 0 with dist hidden\n");
  } else {
    const detail = result.stderr.length > 0 ? result.stderr : (result.error?.message ?? "");

    if (detail.length > 0) {
      process.stderr.write(detail.endsWith("\n") ? detail : `${detail}\n`);
    }

    process.stderr.write(`release format failed with status ${String(result.status)}\n`);
    process.exitCode = 1;
  }
} finally {
  writeFileSync(changelog, original);

  if (hidDist) {
    renameSync(parked, dist);
  }
}
