import nkzw from "@nkzw/oxlint-config";
import type { AllowWarnDeny, DummyRule, DummyRuleMap, OxlintConfig } from "oxlint";

import antiSlop from "./anti-slop/index.ts";
import { ignorePatterns } from "./ignore-patterns.ts";

type ImportRestriction = NonNullable<DummyRuleMap["no-restricted-imports"]>;

type PropertyRestriction = NonNullable<DummyRuleMap["no-restricted-properties"]>;

type OptionOf<Rule> = Rule extends readonly [AllowWarnDeny, ...infer Options]
  ? Options[number]
  : never;

type ImportOption = OptionOf<ImportRestriction>;

type ImportPath = Extract<ImportOption, { name: string }>;

type ImportGroups = Exclude<ImportOption, ImportPath | string>;

type PropertyOption = OptionOf<PropertyRestriction>;

type ParsedRule<Option> = {
  readonly options: ReadonlyArray<Option>;
  readonly severity: AllowWarnDeny;
};

const effectMessage =
  "Effects are banned. Derive the value during render, handle it in the event, or load it in a loader.";

const effectBan = {
  imports: [
    { importNames: ["useEffect", "useLayoutEffect"], message: effectMessage, name: "react" },
  ],
  properties: [
    { message: effectMessage, property: "useEffect" },
    { message: effectMessage, property: "useLayoutEffect" },
  ],
} satisfies {
  readonly imports: ReadonlyArray<ImportPath>;
  readonly properties: ReadonlyArray<PropertyOption>;
};

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
  ],
  rules: {
    ...antiSlopRules(),
    "no-restricted-imports": ["error", { paths: [...effectBan.imports] }],
    "no-restricted-properties": ["error", ...effectBan.properties],
    "oxc/no-accumulating-spread": "error",
    "typescript/await-thenable": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-unnecessary-condition": "error",
  },
};

function isOff(severity: AllowWarnDeny): boolean {
  return severity === "off" || severity === "allow" || severity === 0;
}

function isModuleName(option: ImportOption): option is string {
  return typeof option === "string";
}

function parseRule<Option>(
  rule: AllowWarnDeny | [AllowWarnDeny, ...Array<Option>],
): ParsedRule<Option> {
  if (Array.isArray(rule)) {
    const [severity, ...options] = rule;

    return { options, severity };
  }

  return { options: [], severity: rule };
}

function foldImports(rule: ImportRestriction): ImportRestriction {
  const { options, severity } = parseRule(rule);

  if (isOff(severity)) {
    return rule;
  }

  const paths: NonNullable<ImportGroups["paths"]> = [];
  const patterns: NonNullable<ImportGroups["patterns"]> = [];

  for (const option of options) {
    if (isModuleName(option) || "name" in option) {
      paths.push(option);
    } else {
      paths.push(...(option.paths ?? []));
      patterns.push(...(option.patterns ?? []));
    }
  }

  return [severity, { paths: [...paths, ...effectBan.imports], patterns }];
}

function foldProperties(rule: PropertyRestriction): PropertyRestriction {
  const { options, severity } = parseRule(rule);

  return isOff(severity) ? rule : [severity, ...options, ...effectBan.properties];
}

function foldRules(rules: DummyRuleMap): DummyRuleMap {
  const next: DummyRuleMap = { ...rules };
  const imports = rules["no-restricted-imports"];
  const properties = rules["no-restricted-properties"];

  if (imports !== undefined) {
    next["no-restricted-imports"] = foldImports(imports);
  }

  if (properties !== undefined) {
    next["no-restricted-properties"] = foldProperties(properties);
  }

  return next;
}

/**
 * Oxlint replaces rule options wholesale, so any config the consumer hands us that sets a
 * restriction rule would otherwise delete the ban.
 */
function keepEffectBan(config: OxlintConfig): OxlintConfig {
  const next: OxlintConfig = { ...config };

  if (config.extends !== undefined) {
    next.extends = config.extends.map(keepEffectBan);
  }

  if (config.overrides !== undefined) {
    next.overrides = config.overrides.map((override) =>
      override.rules === undefined ? override : { ...override, rules: foldRules(override.rules) },
    );
  }

  if (config.rules !== undefined) {
    next.rules = foldRules(config.rules);
  }

  return next;
}

/**
 * Builds a root oxlint config. The shared config comes first in `extends`, so the caller's
 * `rules`, `overrides`, and `extends` win. The caller's `ignorePatterns` are appended to the
 * shared list. `options.typeAware` defaults to true. Restriction rules the caller sets keep the
 * React effect ban unless set to off.
 */
export function defineConfig(config: OxlintConfig = {}): OxlintConfig {
  const {
    extends: extended = [],
    ignorePatterns: extra = [],
    options,
    ...rest
  } = keepEffectBan(config);

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
