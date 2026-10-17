import type { OxfmtConfig } from "oxfmt";

import { ignorePatterns } from "./ignore-patterns.ts";

/** oxfmt defaults plus the shared ignore list. No formatting option is restated. */
const config = { ignorePatterns: [...ignorePatterns] } satisfies OxfmtConfig;

export default config;
