import { defineRule } from "@oxlint/plugins";
import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

import {
  arrayMethodTarget,
  isKnownArrayExpression,
  resolveArrayBinding,
  unwrapArrayExpression,
} from "../shared/array-method.ts";

function enclosingReducer(node: ESTree.Node) {
  let parent = node.parent;

  while (parent !== null) {
    if (parent.type === "FunctionDeclaration") {
      return null;
    }

    if (parent.type === "ArrowFunctionExpression" || parent.type === "FunctionExpression") {
      const callback = parent;
      let owner: ESTree.Node | null = callback.parent;

      while (owner !== null && unwrapArrayExpression(owner) === callback) {
        owner = owner.parent;
      }

      if (owner?.type !== "CallExpression") {
        return null;
      }

      const method = arrayMethodTarget(owner.callee);

      if (
        method === null ||
        (method.name !== "reduce" && method.name !== "reduceRight") ||
        owner.arguments.length === 0 ||
        owner.arguments.length > 2 ||
        unwrapArrayExpression(owner.arguments[0]) !== callback
      ) {
        return null;
      }

      if (callback.params.length === 0) {
        return null;
      }

      const firstParameter = callback.params[0];

      const accumulator =
        firstParameter.type === "AssignmentPattern" ? firstParameter.left : firstParameter;

      if (accumulator.type !== "Identifier") {
        return null;
      }

      return {
        accumulator,
        callback,
        initialValue: owner.arguments.length > 1 ? owner.arguments[1] : null,
      };
    }

    parent = parent.parent;
  }

  return null;
}

function referencesAccumulator(
  sourceCode: SourceCode,
  node: ESTree.Node,
  accumulator: Variable,
  visited = new Set<Variable>(),
): boolean {
  const variable = resolveArrayBinding(sourceCode, node);

  if (variable === null || visited.has(variable)) {
    return false;
  }

  if (variable === accumulator) {
    return true;
  }

  visited.add(variable);

  if (variable.references.some((reference) => reference.isWrite() && !reference.init)) {
    return false;
  }

  for (const definition of variable.defs) {
    if (
      definition.type === "Variable" &&
      definition.node.type === "VariableDeclarator" &&
      definition.node.id.type === "Identifier" &&
      definition.node.init !== null &&
      definition.node.parent.type === "VariableDeclaration" &&
      definition.node.parent.kind === "const"
    ) {
      return referencesAccumulator(sourceCode, definition.node.init, accumulator, visited);
    }
  }

  return false;
}

function isGlobalCopyOwner(sourceCode: SourceCode, node: ESTree.Node, name: string): boolean {
  node = unwrapArrayExpression(node);

  if (node.type !== "Identifier" || node.name !== name) {
    return false;
  }

  const variable = resolveArrayBinding(sourceCode, node);

  return variable === null || variable.defs.length === 0;
}

/** Reject non-spread copies of reducer accumulators; pair with oxc/no-accumulating-spread. */
export const noReduceAccumulatorCopyRule = defineRule({
  createOnce(context) {
    return {
      CallExpression(node) {
        const method = arrayMethodTarget(node.callee);

        if (method === null) {
          return;
        }

        const reducer = enclosingReducer(node);

        if (reducer === null) {
          return;
        }

        const accumulator = context.sourceCode
          .getDeclaredVariables(reducer.callback)
          .find((variable) =>
            variable.identifiers.some(
              (identifier) => identifier.start === reducer.accumulator.start,
            ),
          );

        if (accumulator === undefined) {
          return;
        }

        const isAccumulator = (expression: ESTree.Node) =>
          referencesAccumulator(context.sourceCode, expression, accumulator);

        let copiesAccumulator = false;

        if (
          method.name === "assign" &&
          isGlobalCopyOwner(context.sourceCode, method.object, "Object")
        ) {
          copiesAccumulator =
            node.arguments.length > 0 &&
            unwrapArrayExpression(node.arguments[0]).type === "ObjectExpression" &&
            node.arguments.slice(1).some(isAccumulator);
        } else if (
          method.name === "from" &&
          isGlobalCopyOwner(context.sourceCode, method.object, "Array")
        ) {
          copiesAccumulator = node.arguments.length > 0 && isAccumulator(node.arguments[0]);
        } else if (
          ["concat", "slice", "toSpliced", "toSorted", "toReversed", "with"].includes(method.name)
        ) {
          const arrayAccumulator =
            reducer.initialValue !== null &&
            isKnownArrayExpression(context.sourceCode, reducer.initialValue);

          copiesAccumulator = arrayAccumulator && isAccumulator(method.object);
        }

        if (copiesAccumulator) {
          context.report({ messageId: "accumulatorCopy", node });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow copying growing reducer accumulators with Object.assign, Array.from, or array copy methods.",
    },
    messages: {
      accumulatorCopy:
        "Do not copy the reducer accumulator on every iteration; growing copies can cause quadratic work. Mutate a fresh, locally owned accumulator and return it, or use an iterator pipeline/flatMap.",
    },
    type: "problem",
  },
});
