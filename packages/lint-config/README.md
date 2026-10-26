# `@sitaggart/lint-config`

Shared [oxlint](https://oxc.rs/docs/guide/usage/linter), [oxfmt](https://oxc.rs/docs/guide/usage/formatter), and Biome config for TypeScript and React projects. The oxlint config includes a vendored copy of the [anti-slop](https://github.com/dmmulroy/anti-slop) plugin and the `react-effect-ban` plugin.

## Install

```bash
bun add -d @sitaggart/lint-config oxlint oxfmt oxlint-tsgolint @nkzw/oxlint-config @oxlint/plugins
```

All five tools are peer dependencies. Keep `oxlint` and `@oxlint/plugins` on the same version. anti-slop's rules are built against that pairing. `oxlint-tsgolint` stays on `^7.0.2004`, the same major as the version this package develops against.

Bun may warn that `typescript@7` is an incorrect peer of a transitive `@typescript-eslint` package. The install still completes, and this package typechecks with TypeScript 7.

oxlint loads `oxlint.config.ts` through Node.js. TypeScript config files need Node.js `^20.19.0` or `>=22.18.0`.

## Usage

Point oxlint at the shared config file.

```json
{
  "scripts": {
    "lint": "oxlint --config ./node_modules/@sitaggart/lint-config/dist/oxlint.js src",
    "lint:fix": "oxlint --fix --config ./node_modules/@sitaggart/lint-config/dist/oxlint.js src",
    "format": "oxfmt",
    "format:check": "oxfmt --check"
  }
}
```

```ts
// oxfmt.config.ts
export { default } from "@sitaggart/lint-config/oxfmt";
```

The oxlint file extends `@nkzw/oxlint-config` and enables the `react-effect-ban` plugin. `react-effect-ban/no-react-effects` is `error`. It reports `useEffect` and `useLayoutEffect` imported from `react`, including aliases and re-exports. It also reports member forms such as `React.useEffect`, `import * as React from "react"`, and `React["useEffect"]`.

The project needs a `tsconfig.json`. Type-aware rules are on by default.

To add ignores or extra rules, call `defineConfig` from the same module instead of `--config`.

```ts
// oxlint.config.ts
import { defineConfig } from "@sitaggart/lint-config/oxlint";

export default defineConfig();
```

## What the oxlint config enables

- Everything in [`@nkzw/oxlint-config`](https://github.com/nkzw-tech/oxlint-config).
- Every anti-slop rule at `error`. `anti-slop/no-runtime-typeof` still allows `typeof` inside type guards.
- A ban on React's `useEffect` and `useLayoutEffect` through the `react-effect-ban` plugin, at `error`.
- `typescript/await-thenable`, `typescript/no-floating-promises`, `typescript/no-misused-promises`, `typescript/no-unnecessary-condition`, and `oxc/no-accumulating-spread`.

Both configs ignore build output, coverage, framework caches, `node_modules`, `bun.lock`, and generated files such as `worker-configuration.d.ts` and `src/routeTree.gen.ts`. The patterns resolve from the config file's directory, so `dist/**` does not match `packages/app/dist/`.

## Customize

`defineConfig` takes an oxlint config and returns a root config built on the shared one.

```ts
// oxlint.config.ts
import { defineConfig } from "@sitaggart/lint-config/oxlint";

export default defineConfig({
  ignorePatterns: ["public/**"],
  overrides: [{ files: ["scripts/**"], rules: { "no-console": "off" } }],
  rules: {
    "no-restricted-imports": [
      "error",
      { paths: [{ message: "Use the date helpers.", name: "moment" }] },
    ],
  },
});
```

- `ignorePatterns` join the shared list instead of replacing it.
- Root `rules` and `overrides` win over the shared config, as in plain oxlint. So do configs you pass to `extends`.
- A `no-restricted-imports` entry does not remove `react-effect-ban/no-react-effects`.
- Pass `options: { typeAware: false }` to turn type-aware linting off.

### StyleX

`@nkzw/oxlint-config` bans namespace imports. StyleX needs `import * as stylex`. The `stylex` fragment allows that one import.

```ts
import { defineConfig, stylex } from "@sitaggart/lint-config/oxlint";

export default defineConfig({ extends: [stylex] });
```

`import * as stylex from "@stylexjs/stylex"` passes. `import * as path from "node:path"` still fails.

### oxfmt with extra ignores

oxfmt has no `extends`. Spread the shared object and keep its ignore list.

```ts
// oxfmt.config.ts
import config from "@sitaggart/lint-config/oxfmt";
import { defineConfig } from "oxfmt";

export default defineConfig({ ...config, ignorePatterns: [...config.ignorePatterns, "public/**"] });
```

For a JSON-only setup, copy `node_modules/@sitaggart/lint-config/dist/oxfmt.json` to `.oxfmtrc.json` at the project root. Do not point `oxfmt -c` at the file inside `node_modules`. oxfmt resolves ignores from the config file's directory, so none of them would match your project.

### anti-slop without the shared config

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: [
    { name: "anti-slop", specifier: import.meta.resolve("@sitaggart/lint-config/anti-slop") },
  ],
  rules: { "anti-slop/no-reflect-get": "error" },
});
```

## Exports

| Export                              | Contents                                                                |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `@sitaggart/lint-config/oxlint`     | The shared oxlint config, plus `defineConfig` and the `stylex` fragment |
| `@sitaggart/lint-config/oxfmt`      | The oxfmt config object                                                 |
| `@sitaggart/lint-config/oxfmt.json` | The same oxfmt config as JSON                                           |
| `@sitaggart/lint-config/anti-slop`  | The anti-slop oxlint plugin                                             |
| `@sitaggart/lint-config/biome`      | The Biome config                                                        |
| `@sitaggart/lint-config/biome.json` | The same Biome config. Use this path in `extends`.                      |

## Biome

`@biomejs/biome` is an optional peer at `2.5.11`. Extend the JSON path. The `./biome` export is the same file.

```json
{
  "root": true,
  "extends": ["@sitaggart/lint-config/biome.json"]
}
```

The shared file sets `"root": false`, so Biome can load it from a project that already has a root config.

## Editor

Install the [Oxc VS Code extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode) (`oxc.oxc-vscode`). It runs both tools from the project's `node_modules`.

```json
{
  "editor.codeActionsOnSave": { "source.fixAll.oxc": "explicit" },
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "editor.formatOnSave": true
}
```

## anti-slop source

`src/anti-slop` is [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) at commit `c44ef22`, without its Effect rules. It is MIT-licensed, and its license ships at `dist/anti-slop/LICENSE`. [`src/anti-slop/UPSTREAM.md`](src/anti-slop/UPSTREAM.md) records the local adaptations and how to update the copy.
