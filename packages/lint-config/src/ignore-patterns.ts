/**
 * The ignore list for both oxlint and oxfmt. Gitignore-style and rooted at the directory of
 * the consumer's config file, so `dist/**` matches `<root>/dist` only. Oxlint drops this field
 * from extended configs, so it must sit on a root config.
 */
export const ignorePatterns: ReadonlyArray<string> = [
  "dist/**",
  "coverage/**",
  ".wrangler/**",
  ".output/**",
  ".tanstack/**",
  ".ai/**",
  "node_modules/**",
  "bun.lock",
  "worker-configuration.d.ts",
  "src/routeTree.gen.ts",
];
