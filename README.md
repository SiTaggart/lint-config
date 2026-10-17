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

`bun run check` is the full gate, and CI runs it on every pull request. It typechecks the package, builds `dist`, and runs the rule suites and the oxlint and oxfmt CLI tests. Then it lints and format-checks this repo with the fresh build.

This repo lints and formats itself with the built package, so `lint`, `lint:fix`, `format`, and `format:check` each build first.

## Vendored anti-slop

`packages/lint-config/src/anti-slop` is a verbatim copy of [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop). Both root configs ignore it so it stays byte-identical to upstream. Its own tests and `tsc` still cover it. [`UPSTREAM.md`](packages/lint-config/src/anti-slop/UPSTREAM.md) records the source commit, the one local change, and how to update the copy.

## Release

Run `bun run changeset` to describe a change. On `main`, the release workflow opens a version pull request. Merging it publishes the package, and `prepack` builds `dist` first.
