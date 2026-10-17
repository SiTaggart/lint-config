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

/** The React effect ban, as entries for the two rules that between them see every import and member form. */
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

/** anti-slop rules that take options. Every other rule the plugin ships runs at plain "error". */
const antiSlopOptions = new Map([["no-runtime-typeof", [{ allowInTypeGuards: true }]]]);

/** `anti-slop/<rule>` at error for every key of the plugin's rule map, with options from `antiSlopOptions`. */
function antiSlopRules(): Record<`anti-slop/${string}`, DummyRule> {
  return Object.fromEntries(
    Object.keys(antiSlop.rules).map((name): [string, DummyRule] => [
      `anti-slop/${name}`,
      ["error", ...(antiSlopOptions.get(name) ?? [])],
    ]),
  );
}

/** Internal. Consumers reach it only through `defineConfig`, which puts it first in `extends`. */
const base: OxlintConfig = {
  extends: [nkzw],
  jsPlugins: [
    // Extended configs reject relative specifiers. tsc emits this file beside dist/anti-slop.
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

/** Oxlint reads "off", "allow", and 0 as the same severity. */
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

/**
 * Normalizes every entry form (module name, path object, `{ paths, patterns }`) into one
 * `{ paths, patterns }` object and appends `effectBan.imports`. The off severity passes through.
 */
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

/** Appends `effectBan.properties` after the consumer's entries. The off severity passes through. */
function foldProperties(rule: PropertyRestriction): PropertyRestriction {
  const { options, severity } = parseRule(rule);

  return isOff(severity) ? rule : [severity, ...options, ...effectBan.properties];
}

/** Folds the ban into whichever of the two rules `rules` sets. Unset rules stay unset. */
function foldRules(rules: DummyRuleMap): DummyRuleMap {
  const { "no-restricted-imports": imports, "no-restricted-properties": properties } = rules;

  return {
    ...rules,
    "no-restricted-imports": imports === undefined ? imports : foldImports(imports),
    "no-restricted-properties": properties === undefined ? properties : foldProperties(properties),
  };
}

/**
 * Applies `foldRules` to the root rules, every override's rules, and every extended config,
 * recursively. Oxlint replaces rule options wholesale, so any config the consumer hands us that sets
 * a restriction rule would otherwise delete the ban. Oxlint serializes the config to JSON, which
 * drops the `undefined` fields this leaves where the consumer set nothing.
 */
function keepEffectBan(config: OxlintConfig): OxlintConfig {
  return {
    ...config,
    extends: config.extends?.map(keepEffectBan),
    overrides: config.overrides?.map((override) => ({
      ...override,
      rules: override.rules && foldRules(override.rules),
    })),
    rules: config.rules && foldRules(config.rules),
  };
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
