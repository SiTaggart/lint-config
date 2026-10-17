import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Files of a throwaway consumer project, keyed by project-relative path. */
export type ProjectFiles = Readonly<Record<string, string>>;

/** One oxlint report, reduced to what a consumer acts on. `rule` is the config key, e.g. "anti-slop/no-reflect-get". */
export type Report = { readonly file: string; readonly rule: string };

type Diagnostic = { readonly code: string; readonly filename: string };

const dist = new URL("../dist/", import.meta.url);

const oxlint = fileURLToPath(new URL("bin/oxlint", import.meta.resolve("oxlint/package.json")));
const oxfmt = fileURLToPath(new URL("bin/oxfmt", import.meta.resolve("oxfmt/package.json")));
const tsgolint = fileURLToPath(
  new URL("bin/tsgolint.js", import.meta.resolve("oxlint-tsgolint/package.json")),
);

const tsconfig = `${JSON.stringify(
  { compilerOptions: { module: "NodeNext", noEmit: true, skipLibCheck: true, strict: true, target: "ES2024" } },
  null,
  2,
)}\n`;

/** The consumer's `oxfmt.config.ts`, re-exporting the built `./oxfmt`. */
export const oxfmtModuleConfig: ProjectFiles = {
  "oxfmt.config.ts": `export { default } from "${new URL("oxfmt.js", dist).href}";\n`,
};

/** The consumer's `.oxfmtrc.json`, copied from the built `./oxfmt.json`. */
export const oxfmtJsonConfig: ProjectFiles = {
  ".oxfmtrc.json": readFileSync(new URL("oxfmt.json", dist), "utf8"),
};

function isDiagnostic(value: unknown): value is Diagnostic {
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
  return typeof value === "object" && value !== null && "diagnostics" in value && Array.isArray(value.diagnostics);
}

/** Oxlint prints `plugin(rule)`, and core rules as `eslint(rule)`. Config keys drop the `eslint` prefix. */
function ruleKey(code: string): string {
  const match = /^(?<plugin>[^(]+)\((?<rule>[^)]+)\)$/u.exec(code);

  if (match?.groups?.plugin === undefined || match.groups.rule === undefined) {
    throw new Error(`Unrecognized oxlint diagnostic code: ${code}`);
  }

  return match.groups.plugin === "eslint" ? match.groups.rule : `${match.groups.plugin}/${match.groups.rule}`;
}

function parseReports(stdout: string, stderr: string): ReadonlyArray<Report> {
  const output: unknown = JSON.parse(stdout);

  if (!hasDiagnostics(output)) {
    throw new Error(`oxlint printed no diagnostics:\n${stdout}\n${stderr}`);
  }

  return output.diagnostics.map((diagnostic) => {
    if (!isDiagnostic(diagnostic)) {
      throw new Error(`Unexpected oxlint diagnostic: ${JSON.stringify(diagnostic)}`);
    }

    return { file: diagnostic.filename, rule: ruleKey(diagnostic.code) };
  });
}

function withProject<Result>(files: ProjectFiles, run: (root: string) => Result): Result {
  const root = mkdtempSync(join(tmpdir(), "lint-config-consumer-"));

  try {
    for (const [path, contents] of Object.entries({ "tsconfig.json": tsconfig, ...files })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), contents);
    }

    return run(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

/**
 * Writes `files`, a tsconfig.json, and an oxlint.config.ts whose default export is `configSource`
 * (with `defineConfig` and `stylex` imported from the built dist by file URL) into a fresh temp
 * directory outside any node_modules. Runs the real oxlint binary with `--format=json` and
 * OXLINT_TSGOLINT_PATH set, then parses its JSON into reports.
 */
export function lint(configSource: string, files: ProjectFiles): ReadonlyArray<Report> {
  const config = `import { defineConfig, stylex } from "${new URL("oxlint.js", dist).href}";\n\nexport default ${configSource};\n`;

  return withProject({ ...files, "oxlint.config.ts": config }, (root) => {
    const result = spawnSync(process.execPath, [oxlint, "--format=json"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OXLINT_TSGOLINT_PATH: tsgolint },
    });

    return parseReports(result.stdout, result.stderr);
  });
}

/** The rules oxlint reported for one project-relative file. */
export function rulesIn(reports: ReadonlyArray<Report>, file: string): ReadonlyArray<string> {
  return reports.flatMap((report) => (report.file === file ? [report.rule] : []));
}

/** Writes `files` and a tsconfig.json into a fresh temp directory. Returns the paths oxfmt would reformat. */
export function formatCheck(files: ProjectFiles): ReadonlyArray<string> {
  return withProject(files, (root) => {
    const result = spawnSync(process.execPath, [oxfmt, "--list-different"], { cwd: root, encoding: "utf8" });

    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`oxfmt failed:\n${result.stdout}\n${result.stderr}`);
    }

    return result.stdout.split("\n").filter((line) => line !== "");
  });
}
