import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const effectNames = new Set(["useEffect", "useLayoutEffect"]);

const effectMessage =
  "Effects are banned. Derive the value during render, handle it in the event, or load it in a loader.";

function isStringValue(value: unknown): value is string {
  return typeof value === "string";
}

function isEffectName(name: string | null): boolean {
  return name !== null && effectNames.has(name);
}

function moduleExportName(name: ESTree.ModuleExportName): string | null {
  if (name.type === "Literal") {
    return name.value;
  }

  return name.name;
}

function memberName(node: ESTree.MemberExpression): string | null {
  if (node.property.type === "PrivateIdentifier") {
    return null;
  }

  if (node.computed) {
    return node.property.type === "Literal" && isStringValue(node.property.value)
      ? node.property.value
      : null;
  }

  return node.property.name;
}

function propertyKeyName(key: ESTree.PropertyKey | ESTree.IdentifierReference): string | null {
  if (key.type === "PrivateIdentifier") {
    return null;
  }

  if (key.type === "Literal") {
    return isStringValue(key.value) ? key.value : null;
  }

  if (key.type === "Identifier") {
    return key.name;
  }

  return null;
}

function isReactSource(source: ESTree.StringLiteral | null): boolean {
  return source?.value === "react";
}

/**
 * Bans React `useEffect` and `useLayoutEffect` at import and at member access.
 * A distinct rule name keeps a caller's `no-restricted-imports` entry from deleting the ban.
 */
export const noReactEffectsRule = defineRule({
  createOnce(context) {
    return {
      ExportAllDeclaration(node) {
        if (isReactSource(node.source)) {
          context.report({ messageId: "effect", node });
        }
      },
      ExportNamedDeclaration(node) {
        if (!isReactSource(node.source)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (isEffectName(moduleExportName(specifier.local))) {
            context.report({ messageId: "effect", node: specifier });
          }
        }
      },
      ImportDeclaration(node) {
        if (!isReactSource(node.source)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            context.report({ messageId: "effect", node: specifier });
            continue;
          }

          if (
            specifier.type === "ImportSpecifier" &&
            isEffectName(moduleExportName(specifier.imported))
          ) {
            context.report({ messageId: "effect", node: specifier });
          }
        }
      },
      // `.useEffect` on any object stays banned. That matches the old no-restricted-properties rule.
      MemberExpression(node) {
        if (isEffectName(memberName(node))) {
          context.report({ messageId: "effect", node });
        }
      },
      Property(node) {
        if (node.parent.type !== "ObjectPattern") {
          return;
        }

        // `const { [useEffect]: value }` names the variable, not the property.
        // A string key such as `{ ["useEffect"]: value }` is still the property name.
        if (node.computed && node.key.type !== "Literal") {
          return;
        }

        if (isEffectName(propertyKeyName(node.key))) {
          context.report({ messageId: "effect", node });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow React useEffect and useLayoutEffect.",
    },
    messages: { effect: effectMessage },
    type: "problem",
  },
});

const reactEffectBan = eslintCompatPlugin({
  meta: { name: "react-effect-ban" },
  rules: { "no-react-effects": noReactEffectsRule },
});

export default reactEffectBan;
