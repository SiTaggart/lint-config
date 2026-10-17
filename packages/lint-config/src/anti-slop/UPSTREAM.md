# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`.

Copied files:

- Everything under upstream `src/` except `src/effect/`.
- Root `LICENSE`, retained verbatim as `LICENSE` in this directory.

Left out:

- `src/effect/`, the Effect-specific rules and their shared helpers. This package ships no Effect rules.
- Upstream's `scripts/`, `skills/`, `AGENTS.md`, `README.md`, and package manifests.

The code is MIT-licensed. Keep `LICENSE` with every redistributed copy. `vendor/eslint-stylistic/` carries its own `LICENSE` and `UPSTREAM.md`.

## Local adaptations

- `rules/require-readable-spacing-cli.test.ts` spawns `oxlint` with `process.execPath` and the `bin/oxlint` path resolved from `import.meta.resolve("oxlint/package.json")`. Upstream runs `pnpm exec oxlint`, which needs pnpm on the machine.

Every other file is unchanged. This repo's oxlint and oxfmt configs ignore this directory so the files stay byte-identical to upstream.

## Updating and verification

Fetch an explicit upstream revision, copy its `src/` without `src/effect/` over this directory, and reapply the adaptations above. Update the commit here. Then run `bun run check` in `packages/lint-config`. It typechecks the port and runs every rule suite under `node --test`.
