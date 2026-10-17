# `@sitaggart/lint-config`

Shared [oxlint](https://oxc.rs/docs/guide/usage/linter) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter) config for TypeScript and React projects. It includes a vendored copy of the [anti-slop](https://github.com/dmmulroy/anti-slop) oxlint plugin.

## Install

```bash
bun add -d @sitaggart/lint-config oxlint oxfmt oxlint-tsgolint @nkzw/oxlint-config @oxlint/plugins
```

All five tools are peer dependencies. Keep `oxlint` and `@oxlint/plugins` on the same version. anti-slop's rules are built against that pairing.

oxlint loads `oxlint.config.ts` through Node.js. TypeScript config files need Node.js `^20.19.0` or `>=22.18.0`.

## Usage

```ts
// oxlint.config.ts
import { defineConfig } from "@sitaggart/lint-config/oxlint";

export default defineConfig();
```

```ts
// oxfmt.config.ts
export { default } from "@sitaggart/lint-config/oxfmt";
```

```json
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "oxfmt",
    "format:check": "oxfmt --check"
  }
}
```

The project needs a `tsconfig.json`. Type-aware rules are on by default.

## What the oxlint config enables

- Everything in [`@nkzw/oxlint-config`](https://github.com/nkzw-tech/oxlint-config).
- Every anti-slop rule at `error`. `anti-slop/no-runtime-typeof` still allows `typeof` inside type guards.
- A ban on React's `useEffect` and `useLayoutEffect`. `no-restricted-imports` catches named, aliased, re-exported, and namespace imports. `no-restricted-properties` catches member access such as `React.useEffect`.
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
- A `no-restricted-imports` or `no-restricted-properties` entry joins the React effect ban instead of replacing it. This holds in root `rules`, in `overrides`, and in configs passed to `extends`.
- Setting `no-restricted-imports` to `"off"` drops the import half of the ban. `no-restricted-properties` still reports `React.useEffect`.
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

| Export                              | Contents                                 |
| ----------------------------------- | ---------------------------------------- |
| `@sitaggart/lint-config/oxlint`     | `defineConfig` and the `stylex` fragment |
| `@sitaggart/lint-config/oxfmt`      | The oxfmt config object                  |
| `@sitaggart/lint-config/oxfmt.json` | The same oxfmt config as JSON            |
| `@sitaggart/lint-config/anti-slop`  | The anti-slop oxlint plugin              |

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

`src/anti-slop` is [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) at commit `c44ef22`, without its Effect rules. It is MIT-licensed, and its license ships at `dist/anti-slop/LICENSE`. [`src/anti-slop/UPSTREAM.md`](src/anti-slop/UPSTREAM.md) records the one local change and how to update the copy.
