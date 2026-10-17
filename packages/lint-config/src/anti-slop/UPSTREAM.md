# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`.

Before this repo linted the copy, 50 of the copied files matched that commit's git blobs. `rules/require-readable-spacing-cli.test.ts` was the only content mismatch. `gh api repos/SiTaggart/team-retros/contents/tools/oxlint/anti-slop/index.ts` returned HTTP 404, so the copy was not diffed against team-retros. team-retros PR 26 commit `62f9c3e4a1ee3dda949e9ab821d4e14fdac25c5f` says it vendored that same commit. That is commit text, not a byte diff.

Copied files:

- Everything under upstream `src/` except `src/effect/`.
- Root `LICENSE`, kept as `LICENSE` in this directory.

Left out:

- `src/effect/`, the Effect-specific rules and their shared helpers. This package ships no Effect rules.
- Upstream's `scripts/`, `skills/`, `AGENTS.md`, `README.md`, and package manifests.

The code is MIT-licensed. Keep `LICENSE` with every redistributed copy. `vendor/eslint-stylistic/` carries its own `LICENSE` and `UPSTREAM.md`.

## Local adaptations

The shared oxlint and oxfmt configs lint this directory. The adaptations below are grouped by what changed.

- **Layout.** oxfmt, blank lines from `require-readable-spacing`, braces from `curly`, `Array<T>` and `ReadonlyArray<T>` from `typescript/array-type`, and perfectionist key order. The statement-type objects in `vendor/eslint-stylistic/padding-line-between-statements.ts` are name lookups.
- **Dead conditions.** Comparisons the AST types exclude were removed. Length checks reject a missing call argument, parameter, or type argument when that absence is still possible.
- **`typeof`.** Each flagged `typeof` now sits in a `value is ...` predicate. The shared config sets `allowInTypeGuards` on `anti-slop/no-runtime-typeof`, so a predicate may use `typeof`. A `typeof` outside a predicate stays reported.
- **AST walks.** `shared/lexical-type-parameters.ts` and `shared/type-alias-resolution.ts` read child fields with `Object.entries`. The walk still follows visitor keys.
- **Safety markers.** `configuredSafetyMarkers` takes `SafetyMarkerConfig`. The rule parses `context.options` into that type before the call. Accepted markers are unchanged.
- **Statement testers.** `MaybeMultilineStatementType` and `StatementTypes` are closed object literals. Single-line and multiline variants are explicit properties.
- **Spacing CLI test.** `rules/require-readable-spacing-cli.test.ts` spawns `oxlint` with `process.execPath` and the `bin/oxlint` path from `import.meta.resolve("oxlint/package.json")`. Upstream runs `pnpm exec oxlint`, which needs pnpm on the machine.

## Updating and verification

Fetch an explicit upstream revision, copy its `src/` without `src/effect/` over this directory, and reapply the adaptations above. Update the commit here. Then run `bun run check` from the repository root. The package script typechecks the port and runs every rule suite under `node --test`. The root script then lints this directory and proves a packed consumer.
