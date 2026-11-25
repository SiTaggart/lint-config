---
"@sitaggart/lint-config": major
---

Raise the `@nkzw/oxlint-config` peer from `^2.0.1` to `^4.0.0`. v4 requires `oxlint` `>=1.94.0`, so the `oxlint` and `@oxlint/plugins` peers move from `^1.88.0` to `^1.94.0`.

v4 enables the overlapping anti-slop checks as `quality/` rules. `defineConfig()` keeps those `quality/` rules and does not also enable the vendored copies. Overrides and disable comments for those checks use the `quality/` name, for example `quality/no-unknown-type-aliases`. Anti-slop rules the preset does not ship stay on, including `anti-slop/no-runtime-typeof` with `allowInTypeGuards: true`.
