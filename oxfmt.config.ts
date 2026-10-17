import config from "@sitaggart/lint-config/oxfmt";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...config,
  ignorePatterns: [
    ...config.ignorePatterns,
    "packages/lint-config/src/anti-slop/**",
    ".github/workflows/publish.yml",
  ],
});
