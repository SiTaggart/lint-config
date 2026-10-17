import type { OxfmtConfig } from "oxfmt";

import { ignorePatterns } from "./ignore-patterns.ts";

/** oxfmt defaults plus the shared ignore list. */
const config = { ignorePatterns: [...ignorePatterns] } satisfies OxfmtConfig;

export default config;
