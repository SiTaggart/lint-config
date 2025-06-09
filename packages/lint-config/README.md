# `@sitaggart/lint-config`

A comprehensive Biome configuration for JavaScript, TypeScript, and React projects.

## Features

This configuration includes:
- **Linting**: Comprehensive rules for JavaScript, TypeScript, and React
- **Formatting**: Code formatting rules (replaces Prettier)
- **Accessibility**: A11y rules for web applications
- **Import Organization**: Automatic import sorting and organization
- **Security**: Security-focused linting rules
- **Correctness**: Rules to catch common mistakes and bugs

## Install

```bash
bun install --save-dev @biomejs/biome @sitaggart/lint-config
```

## Usage

Create a `biome.json` file in your project root:

```json
{
  "extends": ["@sitaggart/lint-config/biome"]
}
```

### Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --apply .",
    "format": "biome format --write ."
  }
}
```

### VS Code Integration

Install the [Biome VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) for editor integration.
