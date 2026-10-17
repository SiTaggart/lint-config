# OpenCode Context

This file helps OpenCode remember project-specific information.

## Code Style

- Commit messages should follow conventional commit format (enforced by `commitlint`).
- Uses `changeset` for versioning and publishing packages.

## Codebase Structure

- Monorepo managed with bun workspaces.
- Packages are located in the `packages/` directory.
  - `lint-config`: Shared lint configuration.
- Root `package.json` defines workspace-level scripts and dependencies.
- Husky is used for pre-commit hooks (`.husky/`).
- `bun.lock` is the lockfile for bun.
