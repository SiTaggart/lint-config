# OpenCode Context

This file helps OpenCode remember project-specific information.

## Commands

- `bun install`: install dependencies with Bun 1.4.3. Node.js 24.20.0 must be on `PATH` for tests and linting.
- `bun run check`: typecheck, build, test, then lint and format-check the repo. CI runs this.
- `bun run lint` / `bun run lint:fix`: build, then run oxlint.
- `bun run format` / `bun run format:check`: build, then run oxfmt.
- `bun run --filter @sitaggart/lint-config test`: build and run the package tests under `node --test`. Do not use `bun test`. oxlint's `RuleTester` refuses Bun.

## Code Style

- Formatting is oxfmt defaults. Linting is the package's own `defineConfig()`, built from `dist`.
- Commit messages should follow conventional commit format (enforced by `commitlint`).
- Uses `changeset` for versioning and publishing packages.

## Codebase Structure

- Monorepo managed with bun workspaces.
- Packages are located in the `packages/` directory.
  - `lint-config`: Shared oxlint and oxfmt config, plus the vendored anti-slop plugin in `src/anti-slop`. Keep that directory byte-identical to upstream. See its `UPSTREAM.md`.
- Root `package.json` defines workspace-level scripts and dependencies.
- Husky is used for pre-commit hooks (`.husky/`).
- `bun.lock` is the lockfile for bun.
