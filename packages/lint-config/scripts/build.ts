import { execFileSync } from "node:child_process";
import { cpSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import config from "../src/oxfmt.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

const dist = new URL("../dist/", import.meta.url);

const tsc = fileURLToPath(new URL("bin/tsc", import.meta.resolve("typescript/package.json")));

rmSync(dist, { force: true, recursive: true });

execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { cwd: root, stdio: "inherit" });

// tsc emits no copy of LICENSE, UPSTREAM.md, or hand-written .d.ts inputs, and emitted
// declarations import padding-line-options.d.ts.
cpSync(new URL("../src/anti-slop/", import.meta.url), new URL("anti-slop/", dist), {
  filter: (source) => !source.endsWith(".ts") || source.endsWith(".d.ts"),
  recursive: true,
});

writeFileSync(new URL("oxfmt.json", dist), `${JSON.stringify(config, null, 2)}\n`);
