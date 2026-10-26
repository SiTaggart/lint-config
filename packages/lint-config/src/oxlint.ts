import nkzw from "@nkzw/oxlint-config";
import type { DummyRule, OxlintConfig } from "oxlint";

import antiSlop from "./anti-slop/index.ts";
import { ignorePatterns } from "./ignore-patterns.ts";

const antiSlopOptions = new Map([["no-runtime-typeof", [{ allowInTypeGuards: true }]]]);

function antiSlopRules(): Record<`anti-slop/${string}`, DummyRule> {
  return Object.fromEntries(
    Object.keys(antiSlop.rules).map((name): [string, DummyRule] => [
      `anti-slop/${name}`,
      ["error", ...(antiSlopOptions.get(name) ?? [])],
    ]),
  );
}

const base: OxlintConfig = {
  extends: [nkzw],
  jsPlugins: [
    // Extended configs reject relative specifiers.
    { name: "anti-slop", specifier: import.meta.resolve("./anti-slop/index.js") },
    { name: "react-effect-ban", specifier: import.meta.resolve("./react-effect-ban.js") },
  ],
  rules: {
    ...antiSlopRules(),
    "oxc/no-accumulating-spread": "error",
    "react-effect-ban/no-react-effects": "error",
    "typescript/await-thenable": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-unnecessary-condition": "error",
  },
};

/**
 * Builds a root oxlint config. The shared config comes first in `extends`, so the caller's
 * `rules`, `overrides`, and `extends` win. The caller's `ignorePatterns` are appended to the
 * shared list. `options.typeAware` defaults to true. `react-effect-ban/no-react-effects` is its
 * own rule, so a caller `no-restricted-imports` entry does not remove the React effect ban.
 */
export function defineConfig(config: OxlintConfig = {}): OxlintConfig {
  const { extends: extended = [], ignorePatterns: extra = [], options, ...rest } = config;

  return {
    ...rest,
    extends: [base, ...extended],
    ignorePatterns: [...ignorePatterns, ...extra],
    options: { typeAware: true, ...options },
  };
}

/**
 * Opt-in. Allows `import * as stylex from "@stylexjs/stylex"`, which StyleX requires. Every other
 * namespace import stays banned by nkzw's `import-x/no-namespace`. Pass it in `extends`.
 */
export const stylex: OxlintConfig = {
  rules: { "import/no-namespace": ["error", { ignore: ["@stylexjs/stylex"] }] },
};

// `oxlint --config` loads the default export. `defineConfig()` is that config.
export default defineConfig();
