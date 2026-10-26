import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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

type Report = { readonly file: string; readonly rule: string };

const failures: Array<string> = [];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDevDependencies(value: unknown): value is Readonly<Record<string, string>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isString)
  );
}

function isManifest(value: unknown): value is { readonly devDependencies: unknown } {
  return typeof value === "object" && value !== null && "devDependencies" in value;
}

function isDiagnostic(
  value: unknown,
): value is { readonly code: string; readonly filename: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    isString(value.code) &&
    "filename" in value &&
    isString(value.filename)
  );
}

function devDependencies(): Readonly<Record<string, string>> {
  const manifest: unknown = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));

  if (!isManifest(manifest) || !isDevDependencies(manifest.devDependencies)) {
    throw new Error("packages/lint-config/package.json has no devDependency versions");
  }

  return manifest.devDependencies;
}

function pinned(dependencies: Readonly<Record<string, string>>, name: string): string {
  const version = dependencies[name];

  if (!isString(version)) {
    throw new Error(`packages/lint-config is missing devDependency ${name}`);
  }

  return version;
}

function ruleKey(code: string): string {
  const groups = /^(?<plugin>[^(]+)\((?<rule>[^)]+)\)$/u.exec(code)?.groups;

  if (groups === undefined) {
    throw new Error(`Unrecognized oxlint diagnostic code: ${code}`);
  }

  return groups.plugin === "eslint" ? groups.rule : `${groups.plugin}/${groups.rule}`;
}

function hasDiagnostics(value: unknown): value is { readonly diagnostics: ReadonlyArray<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "diagnostics" in value &&
    Array.isArray(value.diagnostics)
  );
}

function reportsFrom(stdout: string): ReadonlyArray<Report> {
  const output: unknown = JSON.parse(stdout);

  if (!hasDiagnostics(output)) {
    throw new Error(`oxlint printed no diagnostics:\n${stdout}`);
  }

  return output.diagnostics.map((diagnostic) => {
    if (!isDiagnostic(diagnostic)) {
      throw new Error(`Unexpected oxlint diagnostic: ${JSON.stringify(diagnostic)}`);
    }

    return { file: diagnostic.filename, rule: ruleKey(diagnostic.code) };
  });
}

function hasPair(reports: ReadonlyArray<Report>, file: string, rule: string): boolean {
  return reports.some((report) => report.file === file && report.rule === rule);
}

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

function tarballEntries(tarball: string): ReadonlyArray<string> {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "");
}

function isPackedManifest(value: unknown): value is { readonly exports: object } {
  return (
    typeof value === "object" &&
    value !== null &&
    "exports" in value &&
    typeof value.exports === "object" &&
    value.exports !== null &&
    !Array.isArray(value.exports)
  );
}

function exportKeysFrom(raw: string): ReadonlyArray<string> {
  const manifest: unknown = JSON.parse(raw);

  if (!isPackedManifest(manifest)) {
    throw new Error("packed package.json has no exports");
  }

  return Object.keys(manifest.exports);
}

function run(bin: string, args: ReadonlyArray<string>, cwd: string) {
  const env = { ...process.env };

  delete env.OXLINT_TSGOLINT_PATH;

  const result = spawnSync(bin, args, {
    cwd,
    encoding: "utf8",
    env,
    maxBuffer: 128 * 1024 * 1024,
  });

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
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

  const entries = tarballEntries(tarball);

  const exportKeys = exportKeysFrom(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
  );

  process.stdout.write(`packed tarball\n${entries.join("\n")}\n`);
  process.stdout.write(`packed exports ${exportKeys.join(" ")}\n`);
  expect(
    !entries.some((entry) => entry === "package/biome.json" || entry.endsWith("/biome.json")),
    "tarball has no biome.json",
  );
  expect(!exportKeys.includes("./biome"), "tarball exports have no ./biome");
  expect(!exportKeys.includes("./biome.json"), "tarball exports have no ./biome.json");

  const consumer = join(temp, "consumer");
  const versions = devDependencies();

  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    `${JSON.stringify(
      {
        dependencies: {
          "@nkzw/oxlint-config": pinned(versions, "@nkzw/oxlint-config"),
          "@oxlint/plugins": pinned(versions, "@oxlint/plugins"),
          "@sitaggart/lint-config": `file:${tarball}`,
          "@types/react": "19.2.2",
          oxfmt: pinned(versions, "oxfmt"),
          oxlint: pinned(versions, "oxlint"),
          "oxlint-tsgolint": pinned(versions, "oxlint-tsgolint"),
          react: "19.2.0",
          typescript: pinned(versions, "typescript"),
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
    join(consumer, "oxfmt.config.ts"),
    'export { default } from "@sitaggart/lint-config/oxfmt";\n',
  );
  writeFileSync(
    join(consumer, "oxlint.config.ts"),
    'import { defineConfig } from "@sitaggart/lint-config/oxlint";\n\nexport default defineConfig();\n',
  );
  mkdirSync(join(consumer, "src"));
  writeFileSync(
    join(consumer, "src/effect.ts"),
    'import { useEffect } from "react";\n\nuseEffect(() => {}, []);\n',
  );
  writeFileSync(join(consumer, "src/routeTree.gen.ts"), 'console.log("generated");\n');
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
  const readme = readFileSync(join(packageDir, "README.md"), "utf8");

  expect(readme.includes('"lint": "oxlint"'), "README lint script is bare oxlint");
  expect(!readme.includes("dist/oxlint.js"), "README does not point oxlint at the package file");

  mkdirSync(join(consumer, "node_modules/planted"), { recursive: true });
  writeFileSync(
    join(consumer, "node_modules/planted/violation.ts"),
    'console.log("dependency");\n',
  );

  const lint = run(oxlintBin, ["--format=json"], consumer);
  const reports = reportsFrom(lint.stdout);
  const reportedFiles = [...new Set(reports.map((report) => report.file))];

  const nodeModuleReports = reports.filter((report) => report.file.includes("node_modules")).length;
  const routeReports = reports.filter((report) => report.file === "src/routeTree.gen.ts").length;

  process.stdout.write(
    `packed-consumer oxlint files ${reportedFiles.length} node_modules ${nodeModuleReports} routeTree ${routeReports}\n${reportedFiles.filter((file) => !file.includes("node_modules")).join("\n")}\n${lint.stderr}\n`,
  );
  expect(lint.status !== 0, "oxlint exits non-zero");
  expect(
    reports.every((report) => !report.file.includes("node_modules")),
    "node_modules is not reported",
  );
  expect(
    reports.every((report) => report.file !== "src/routeTree.gen.ts"),
    "src/routeTree.gen.ts is not reported",
  );
  expect(
    hasPair(reports, "src/effect.ts", "react-effect-ban/no-react-effects"),
    "src/effect.ts reports react-effect-ban/no-react-effects",
  );
  expect(
    hasPair(reports, "src/reflect.ts", "anti-slop/no-reflect-get"),
    "src/reflect.ts reports anti-slop/no-reflect-get",
  );
  expect(
    hasPair(reports, "src/float.ts", "typescript/no-floating-promises"),
    "src/float.ts reports typescript/no-floating-promises",
  );
  expect(
    reports.every((report) => report.file !== "src/clean.ts"),
    "src/clean.ts has zero diagnostics",
  );

  const format = run(oxfmtBin, ["--list-different"], consumer);
  const different = format.stdout.split("\n").filter((line) => line !== "");

  process.stdout.write(
    `packed-consumer oxfmt --list-different\n${format.stdout}\n${format.stderr}\n`,
  );
  expect(format.status !== 0, "oxfmt --list-different exits non-zero");
  expect(different.includes("src/messy.ts"), "oxfmt lists src/messy.ts");
  expect(!different.includes("src/clean.ts"), "oxfmt does not list src/clean.ts");
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
