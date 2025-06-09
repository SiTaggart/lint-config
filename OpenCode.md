# OpenCode Context

This file helps OpenCode remember project-specific information.

## Commands

Commonly used commands:

- Lint: `bun run check` (Uses Biome to check the codebase)
- Format: `biome format --write .` (Uses Biome to format the codebase)
- Test: `echo "No test command specified"` (No test script found in package.json)
- Build: `echo "No build command specified"` (No build script found in package.json)
- Typecheck: `echo "No typecheck command specified"` (No typecheck script found)

## Code Style

- This project uses Biome for linting and formatting. Configuration is in `biome.json` and per-package `biome.json` files.
- Commit messages should follow conventional commit format (enforced by `commitlint`).
- Uses `changeset` for versioning and publishing packages.

## Codebase Structure

- Monorepo managed with bun workspaces.
- Packages are located in the `packages/` directory.
  - `lint-config`: Comprehensive Biome configuration for JavaScript, TypeScript, and React projects.
- Root `package.json` defines workspace-level scripts and dependencies.
- Husky is used for pre-commit hooks (`.husky/`).
- `bun.lock` is the lockfile for bun.
