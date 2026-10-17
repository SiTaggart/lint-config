import type { CreateRule } from "@oxlint/plugins";

import createPaddingLineRule from "../vendor/eslint-stylistic/padding-line-between-statements.ts";

const paddingRule = createPaddingLineRule([
  { blankLine: "always", next: "*", prev: "import" },
  { blankLine: "always", next: { selector: "Program > :not(ImportDeclaration)" }, prev: "*" },
  { blankLine: "always", next: "*", prev: { selector: "Program > :not(ImportDeclaration)" } },
  { blankLine: "always", next: ["function", "class", "interface", "type"], prev: "*" },
  { blankLine: "always", next: "*", prev: ["function", "class", "interface", "type"] },
  {
    blankLine: "always",
    next: ["multiline-const", "multiline-let", "multiline-var", "multiline-using"],
    prev: "*",
  },
  {
    blankLine: "always",
    next: "*",
    prev: ["multiline-const", "multiline-let", "multiline-var", "multiline-using"],
  },
  { blankLine: "always", next: ["return", "if", "switch", "try", "for", "while", "do"], prev: "*" },
  { blankLine: "always", next: "*", prev: "block-like" },
  { blankLine: "any", next: "import", prev: "import" },
  {
    blankLine: "any",
    next: {
      selector:
        ':matches(TSDeclareFunction, FunctionDeclaration, ExportNamedDeclaration[declaration.type="TSDeclareFunction"], ExportNamedDeclaration[declaration.type="FunctionDeclaration"])',
    },
    prev: {
      selector:
        ':matches(TSDeclareFunction, ExportNamedDeclaration[declaration.type="TSDeclareFunction"])',
    },
  },
]);

/** Restore structural blank lines with whitespace-only fixes; keep local short bindings and overloads grouped. */
export const requireReadableSpacingRule: CreateRule = {
  ...paddingRule,
  meta: {
    ...paddingRule.meta,
    docs: {
      description: "Require readable spacing between declarations and logical statement groups.",
    },
    schema: [],
  },
};
