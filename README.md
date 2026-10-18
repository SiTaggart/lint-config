# Lint config

This repo publishes [`@sitaggart/lint-config`](packages/lint-config), a shared oxlint and oxfmt config for TypeScript and React projects. The package README covers install and usage.

## Requirements

- Node.js 24.20.0, from `.nvmrc`. The rule tests run under `node --test`, because oxlint's `RuleTester` refuses to run on Bun. oxlint also loads `oxlint.config.ts` through Node.js.
- Bun 1.4.3, from `packageManager`. Bun installs dependencies and runs every script.

## Develop

```bash
bun install
bun run check
```

`bun run check` is the full gate, and CI runs it on every pull request. First it runs `bun x oxfmt --write --no-error-on-unmatched-pattern` on the package changelog with `dist` moved aside, which is the format command the release workflow runs. Then it typechecks the package, builds `dist`, and runs the rule suites and the oxlint and oxfmt CLI tests. Then it lints this repo with that build and format-checks it from the oxfmt source. It also packs `@sitaggart/lint-config`, installs that tarball with its peers into a temporary consumer, and asserts the consumer diagnostics.

This repo lints itself with the built package, so `lint` and `lint:fix` build first. `oxfmt.config.ts` imports `packages/lint-config/src/oxfmt.ts`, so `format` and `format:check` do not build.

## Vendored anti-slop

`packages/lint-config/src/anti-slop` comes from [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) at commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`. The shared oxlint and oxfmt configs lint that directory. [`UPSTREAM.md`](packages/lint-config/src/anti-slop/UPSTREAM.md) records the source commit, the local adaptations, and how to update the copy.

## Release

Run `bun run changeset` to describe a change. On `main`, the release workflow opens a version pull request. Merging it publishes the package, and `prepack` builds `dist` first.
