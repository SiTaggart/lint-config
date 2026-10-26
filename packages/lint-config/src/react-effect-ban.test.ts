import { RuleTester } from "oxlint/plugins-dev";

import { noReactEffectsRule } from "./react-effect-ban.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const error = { messageId: "effect" };

tester.run("react-effect-ban/no-react-effects", noReactEffectsRule, {
  invalid: [
    {
      code: 'const source = { useEffect() {} };\nconst { ["useEffect"]: effect } = source;\n',
      errors: [error],
      name: "string literal key",
    },
  ],
  valid: [
    {
      code: 'const useEffect = "value";\nconst { [useEffect]: value } = { value: 1 };\n',
      name: "computed identifier key",
    },
  ],
});
