# OpenCode Context

This file helps OpenCode remember project-specific information.

## Commands

Commonly used commands:

- Lint: `bun run lint` (Uses Biome to check the codebase)
- Format: `bun run prettier` (Uses Biome to format the codebase)
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
  - `eslint-config`: Base ESLint configuration.
  - `eslint-config-react`: ESLint configuration for React projects.
  - `eslint-config-ts`: ESLint configuration for TypeScript projects.
  - `prettier-config`: Prettier configuration (though Biome is used for formatting).
- Root `package.json` defines workspace-level scripts and dependencies.
- Husky is used for pre-commit hooks (`.husky/`).
- `bun.lock` is the lockfile for bun.
