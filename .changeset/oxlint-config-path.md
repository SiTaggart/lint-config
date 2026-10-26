---
"@sitaggart/lint-config": minor
---

Load the shared oxlint config from the project's `oxlint.config.ts` by exporting `defineConfig()`, then run `oxlint`. The shared ignore patterns then apply from the project root. The React `useEffect` and `useLayoutEffect` ban is the `react-effect-ban` plugin, at error.
