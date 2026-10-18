import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ProjectFiles = Readonly<Record<string, string>>;

export type Report = { readonly file: string; readonly rule: string };

type Diagnostic = { readonly code: string; readonly filename: string };

const dist = new URL("../dist/", import.meta.url);

const oxlint = fileURLToPath(new URL("bin/oxlint", import.meta.resolve("oxlint/package.json")));

const oxfmt = fileURLToPath(new URL("bin/oxfmt", import.meta.resolve("oxfmt/package.json")));

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

export const oxfmtModuleConfig = {
  "oxfmt.config.ts": `export { default } from "${new URL("oxfmt.js", dist).href}";\n`,
} satisfies ProjectFiles;

export const oxfmtJsonConfig = {
  ".oxfmtrc.json": readFileSync(new URL("oxfmt.json", dist), "utf8"),
} satisfies ProjectFiles;

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

export function rulesIn(reports: ReadonlyArray<Report>, file: string): ReadonlyArray<string> {
  return reports.flatMap((report) => (report.file === file ? [report.rule] : []));
}

export function formatCheck(files: ProjectFiles): ReadonlyArray<string> {
  return withProject(files, (root) => {
    const result = spawnSync(process.execPath, [oxfmt, "--list-different"], {
      cwd: root,
      encoding: "utf8",
    });

    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`oxfmt failed:\n${result.stdout}\n${result.stderr}`);
    }

    return result.stdout.split("\n").filter((line) => line !== "");
  });
}
