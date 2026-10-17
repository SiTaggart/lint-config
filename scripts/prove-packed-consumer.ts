import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const packageDir = join(repoRoot, "packages/lint-config");

const failures: Array<string> = [];

function expect(condition: boolean, message: string): void {
  if (!condition) {
    failures.push(message);
  }
}

function tarballsIn(directory: string): Array<string> {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".tgz"))
    .map((name) => join(directory, name));
}

function run(bin: string, args: ReadonlyArray<string>, cwd: string) {
  const env = { ...process.env };

  delete env.OXLINT_TSGOLINT_PATH;

  const result = spawnSync(bin, args, { cwd, encoding: "utf8", env });

  return {
    output: `${result.stdout}\n${result.stderr}`,
    status: result.status,
  };
}

const temp = mkdtempSync(join(tmpdir(), "lint-config-consumer-"));

const packedInRepo: Array<string> = [];

try {
  const before = new Set([...tarballsIn(packageDir), ...tarballsIn(repoRoot)]);

  execFileSync("bun", ["pm", "pack"], { cwd: packageDir, stdio: "inherit" });

  const created = [...tarballsIn(packageDir), ...tarballsIn(repoRoot)].filter(
    (path) => !before.has(path),
  );

  packedInRepo.push(...created);
  expect(created.length === 1, `bun pm pack produced ${created.length} tarballs`);

  if (created.length !== 1) {
    throw new Error("packed tarball was not found");
  }

  const tarball = join(temp, "lint-config.tgz");

  renameSync(created[0], tarball);

  const consumer = join(temp, "consumer");

  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    `${JSON.stringify(
      {
        dependencies: {
          "@nkzw/oxlint-config": "2.0.1",
          "@oxlint/plugins": "1.88.0",
          "@sitaggart/lint-config": `file:${tarball}`,
          "@types/react": "19.2.2",
          oxfmt: "0.73.0",
          oxlint: "1.88.0",
          "oxlint-tsgolint": "7.0.2004",
          react: "19.2.0",
          typescript: "7.0.2",
        },
        name: "packed-consumer",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumer, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: "ES2024",
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumer, "oxlint.config.ts"),
    'import { defineConfig } from "@sitaggart/lint-config/oxlint";\n\nexport default defineConfig();\n',
  );
  writeFileSync(
    join(consumer, "oxfmt.config.ts"),
    'export { default } from "@sitaggart/lint-config/oxfmt";\n',
  );
  mkdirSync(join(consumer, "src"));
  writeFileSync(
    join(consumer, "src/effect.ts"),
    'import { useEffect } from "react";\n\nuseEffect(() => {}, []);\n',
  );
  writeFileSync(
    join(consumer, "src/reflect.ts"),
    'export const value = Reflect.get({ a: 1 }, "a");\n',
  );
  writeFileSync(
    join(consumer, "src/float.ts"),
    "async function load(): Promise<number> {\n  return 1;\n}\n\nload();\n",
  );
  writeFileSync(join(consumer, "src/clean.ts"), "export const value = 1;\n");
  writeFileSync(join(consumer, "src/messy.ts"), "export const value=1\n");

  execFileSync("bun", ["install"], { cwd: consumer, stdio: "inherit" });

  const installed = realpathSync(join(consumer, "node_modules/@sitaggart/lint-config"));

  process.stdout.write(`packed-consumer package ${installed}\n`);
  expect(
    installed !== realpathSync(packageDir),
    "consumer resolves the tarball, not the workspace package",
  );

  const oxfmtBin = join(consumer, "node_modules/.bin/oxfmt");

  const prepared = run(oxfmtBin, ["package.json", "tsconfig.json"], consumer);

  expect(prepared.status === 0, "oxfmt formats the generated package.json and tsconfig.json");

  const oxlintBin = join(consumer, "node_modules/.bin/oxlint");

  const lint = run(oxlintBin, ["--format=json"], consumer);

  process.stdout.write(`packed-consumer oxlint\n${lint.output}\n`);

  const format = run(oxfmtBin, ["--check"], consumer);

  process.stdout.write(`packed-consumer oxfmt --check\n${format.output}\n`);

  expect(lint.status !== 0, "oxlint exits non-zero");
  expect(lint.output.includes("src/effect.ts"), "oxlint names src/effect.ts");
  expect(lint.output.includes("no-restricted-imports"), "oxlint reports no-restricted-imports");
  expect(
    lint.output.includes("anti-slop/no-reflect-get") ||
      lint.output.includes("anti-slop(no-reflect-get)"),
    "oxlint reports anti-slop/no-reflect-get",
  );
  expect(
    lint.output.includes("typescript/no-floating-promises") ||
      lint.output.includes("typescript(no-floating-promises)"),
    "oxlint reports typescript/no-floating-promises",
  );
  expect(format.status !== 0, "oxfmt --check exits non-zero");
  expect(format.output.includes("src/messy.ts"), "oxfmt names src/messy.ts");
  expect(!format.output.includes("src/clean.ts"), "oxfmt does not name src/clean.ts");
} finally {
  for (const path of packedInRepo) {
    if (existsSync(path)) {
      rmSync(path);
    }
  }

  rmSync(temp, { force: true, recursive: true });
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
}
