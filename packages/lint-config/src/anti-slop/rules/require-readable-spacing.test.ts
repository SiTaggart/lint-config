import { RuleTester } from "oxlint/plugins-dev";

import { requireReadableSpacingRule } from "./require-readable-spacing.ts";
import createPaddingLineRule from "../vendor/eslint-stylistic/padding-line-between-statements.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const error = { messageId: "expectedBlankLine" };

tester.run("anti-slop/require-readable-spacing", requireReadableSpacingRule, {
  invalid: [
    { code: "const a = 1;\nconst b = 2;", errors: [error], output: "const a = 1;\n\nconst b = 2;" },
    {
      code: "export const a = 1;\n/** B docs. */\nexport type B = number;",
      errors: [error],
      output: "export const a = 1;\n\n/** B docs. */\nexport type B = number;",
    },
    {
      code: "const a = 1; // trailing\n// leading\nconst b = 2;",
      errors: [error],
      output: "const a = 1; // trailing\n\n// leading\nconst b = 2;",
    },
    { code: "const a = 1; const b = 2;", errors: [error], output: "const a = 1;\n\n const b = 2;" },
    {
      code: "import { a } from 'a';\nconst b = a;",
      errors: [error],
      output: "import { a } from 'a';\n\nconst b = a;",
    },
    {
      code: "function f() {\nconst a = 1;\nreturn a;\n}",
      errors: [error],
      output: "function f() {\nconst a = 1;\n\nreturn a;\n}",
    },
    {
      code: "function f() {\nconst a = 1;\nif (a) go();\n}",
      errors: [error],
      output: "function f() {\nconst a = 1;\n\nif (a) go();\n}",
    },
    {
      code: "function f() {\nif (ok) { go(); }\nstop();\n}",
      errors: [error],
      output: "function f() {\nif (ok) { go(); }\n\nstop();\n}",
    },
    {
      code: "const f = Effect.gen(function* () {\nconst a = yield* A;\nconst b = yield* B;\nconst dispatch = Effect.fn('dispatch')(function* () {\nyield* a;\n});\nreturn dispatch;\n});",
      errors: [error, error],
      output:
        "const f = Effect.gen(function* () {\nconst a = yield* A;\nconst b = yield* B;\n\nconst dispatch = Effect.fn('dispatch')(function* () {\nyield* a;\n});\n\nreturn dispatch;\n});",
    },
    {
      code: "export interface A {}\nexport class B {}",
      errors: [error],
      output: "export interface A {}\n\nexport class B {}",
    },
    {
      code: "const a = 1\n;[1].forEach(f)",
      errors: [error],
      output: "const a = 1\n\n;[1].forEach(f)",
    },
    {
      code: "function f() {\nfoo();\nwhile (ok) go();\n}",
      errors: [error],
      output: "function f() {\nfoo();\n\nwhile (ok) go();\n}",
    },
  ],
  valid: [
    "import { a } from 'a';\nimport { b } from 'b';\n\nexport const c = a + b;",
    "function f() {\nconst a = 1;\nconst b = 2;\n\nreturn a + b;\n}",
    "function f() { return 1; }",
    "function f(a: string): string;\nfunction f(a: number): number;\nfunction f(a: string | number) { return a; }",
    "export function f(a: string): string;\nexport function f(a: number): number;\nexport function f(a: string | number) { return a; }",
    "const f = Effect.gen(function* () {\nconst a = yield* A;\nconst b = yield* B;\n\nreturn a + b;\n});",
    "export type A = string;\n\n/** B documentation. */\nexport type B = number;",
    "function f() { if (ok) { go(); } else { stop(); } }",
    "function f() {\n// return docs\nreturn 1;\n}",
    "const a = 1;\n\n\nconst b = 2;",
    "switch (x) { case 1: case 2: go(); break; default: stop(); }",
  ],
});

// Exercise upstream options that the opinionated public rule does not enable.
tester.run(
  "vendored padding removal",
  createPaddingLineRule([{ blankLine: "never", next: "*", prev: "*" }]),
  {
    invalid: [
      {
        code: "foo();\n\nbar();",
        errors: [{ messageId: "unexpectedBlankLine" }],
        output: "foo();\nbar();",
      },
      {
        code: "foo();\n\n// comment\n\nbar();",
        errors: [{ messageId: "unexpectedBlankLine" }],
        output: null,
      },
    ],
    valid: ["foo();\nbar();"],
  },
);
