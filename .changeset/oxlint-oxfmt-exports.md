---
"@sitaggart/lint-config": major
---

Replace the Biome config with oxlint and oxfmt configs and the anti-slop oxlint plugin.

Removed:

- The `./biome` export.
- The `@biomejs/biome` peer dependency.

Added exports:

- `./oxlint`: `defineConfig()` and the `stylex` fragment. It enables `@nkzw/oxlint-config`, every anti-slop rule, a ban on React's `useEffect` and `useLayoutEffect`, and type-aware rules.
- `./oxfmt`: the oxfmt config object.
- `./oxfmt.json`: the same oxfmt config as JSON.
- `./anti-slop`: the anti-slop oxlint plugin, vendored from `dmmulroy/anti-slop`.

Added peer dependencies:

- `oxlint`
- `oxfmt`
- `oxlint-tsgolint`
- `@nkzw/oxlint-config`
- `@oxlint/plugins`

Formatting moves from Biome's single quotes and `es5` trailing commas to oxfmt's double quotes and `all` trailing commas. Line width stays at 100.

To migrate, delete `biome.json` and `@biomejs/biome`. Install the five peers. Add an `oxlint.config.ts` that exports `defineConfig()` and an `oxfmt.config.ts` that re-exports `@sitaggart/lint-config/oxfmt`. Run `oxfmt` once to reformat. The package README has the full setup.
