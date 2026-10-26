---
"@sitaggart/lint-config": minor
---

Add oxlint and oxfmt configs and the anti-slop oxlint plugin. The Biome export stays.

Added exports:

- `./oxlint`: `defineConfig()` and the `stylex` fragment. It enables `@nkzw/oxlint-config`, every anti-slop rule, a ban on React's `useEffect` and `useLayoutEffect`, and type-aware rules.
- `./oxfmt`: the oxfmt config object.
- `./oxfmt.json`: the same oxfmt config as JSON.
- `./anti-slop`: the anti-slop oxlint plugin, vendored from `dmmulroy/anti-slop`. `defineConfig()` enables `anti-slop/no-runtime-typeof` with `allowInTypeGuards: true`. The rule's own default is `false`.

Added peer dependencies:

- `oxlint`
- `oxfmt`
- `oxlint-tsgolint`
- `@nkzw/oxlint-config`
- `@oxlint/plugins`

This repo formats with oxfmt. Quotes are double, trailing commas are `all`, and the line width stays at 100.

The Biome export remains for projects that still extend it. To add oxlint, install the five oxlint peers. The package README has the setup.
