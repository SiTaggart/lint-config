// Vendored from ESLint Stylistic; see UPSTREAM.md and LICENSE in this directory.
import type {
  ESTree,
  Context as RuleContext,
  SourceCode,
  Token as SyntaxToken,
  Comment,
  CreateRule,
  Location,
} from "@oxlint/plugins";

type ASTNode = ESTree.Node;

type Token = SyntaxToken | Comment;

import type { RuleOptions, SelectorOption, StatementOption } from "./padding-line-options.d.ts";
import {
  isClosingBraceToken,
  isFunction,
  isNotSemicolonToken,
  isParenthesized,
  isSemicolonToken,
  isSingleLine,
  isTokenOnSameLine,
  isTopLevelExpressionStatement,
  LINEBREAKS,
  skipChainExpression,
} from "./padding-line-ast.ts";

const CJS_EXPORT = /^(?:module\s*\.\s*)?exports(?:\s*\.|\s*\[|$)/u;

const CJS_IMPORT = /^require\(/u;

/**
 * This rule is a replica of padding-line-between-statements.
 *
 * Ideally we would want to extend the rule support typescript specific support.
 * But since not all the state is exposed by the eslint and eslint has frozen stylistic rules,
 * (see - https://eslint.org/blog/2020/05/changes-to-rules-policies for details.)
 * we are forced to re-implement the rule here.
 *
 * We have tried to keep the implementation as close as possible to the eslint implementation, to make
 * patching easier for future contributors.
 *
 * Reference rule - https://github.com/eslint/eslint/blob/main/lib/rules/padding-line-between-statements.js
 */

type NodeTest = (node: ASTNode, sourceCode: SourceCode) => boolean;

interface NodeTestObject {
  test: NodeTest;
}

function whenSingleLine(test: NodeTest): NodeTestObject {
  return {
    test: (node, sourceCode) => test(node, sourceCode) && isSingleLine(node),
  };
}

function whenMultiLine(test: NodeTest): NodeTestObject {
  return {
    test: (node, sourceCode) => test(node, sourceCode) && !isSingleLine(node),
  };
}

const LT = `[${Array.from(LINEBREAKS).join("")}]`;

const PADDING_LINE_SEQUENCE = new RegExp(String.raw`^(\s*?${LT})\s*${LT}(\s*;?)$`, "u");

function isSelectorOption(option: StatementOption): option is SelectorOption {
  return typeof option === "object" && !Array.isArray(option);
}

/**
 * Creates tester which check if a node starts with specific keyword with the
 * appropriate AST_NODE_TYPES.
 * @param keyword The keyword to test.
 * @returns the created tester.
 * @private
 */
function newKeywordTester(type: string | Array<string>, keyword: string): NodeTestObject {
  return {
    test(node, sourceCode): boolean {
      const isSameKeyword = sourceCode.getFirstToken(node)?.value === keyword;

      const isSameType = Array.isArray(type) ? type.includes(node.type) : type === node.type;

      return isSameKeyword && isSameType;
    },
  };
}

/**
 * Creates tester which check if a node is specific type.
 * @param type The node type to test.
 * @returns the created tester.
 * @private
 */
function newNodeTypeTester(type: string): NodeTestObject {
  return {
    test: (node): boolean => node.type === type,
  };
}

/**
 * Checks the given node is an expression statement of IIFE.
 * @param node The node to check.
 * @returns `true` if the node is an expression statement of IIFE.
 * @private
 */
function isIIFEStatement(node: ASTNode): boolean {
  if (node.type === "ExpressionStatement") {
    let expression = skipChainExpression(node.expression);

    if (expression.type === "UnaryExpression") {
      expression = skipChainExpression(expression.argument);
    }

    if (expression.type === "CallExpression") {
      let node: ASTNode = expression.callee;

      while (node.type === "SequenceExpression") {
        const lastExpression = node.expressions.at(-1);

        if (lastExpression === undefined) {
          throw new Error("Padding rule invariant: sequence expression is empty");
        }

        node = lastExpression;
      }

      return isFunction(node);
    }
  }

  return false;
}

/**
 * Checks the given node is a CommonJS require statement
 * @param node The node to check.
 * @returns `true` if the node is a CommonJS require statement.
 * @private
 */
function isCJSRequire(node: ASTNode): boolean {
  if (node.type === "VariableDeclaration") {
    const declaration = node.declarations[0];

    if (declaration.init) {
      let call = declaration.init;

      while (call.type === "MemberExpression") {
        call = call.object;
      }

      if (call.type === "CallExpression" && call.callee.type === "Identifier") {
        return call.callee.name === "require";
      }
    }
  }

  return false;
}

/**
 * Checks whether the given node is a block-like statement.
 * This checks the last token of the node is the closing brace of a block.
 * @param sourceCode The source code to get tokens.
 * @param node The node to check.
 * @returns `true` if the node is a block-like statement.
 * @private
 */
function isBlockLikeStatement(node: ASTNode, sourceCode: SourceCode): boolean {
  // do-while with a block is a block-like statement.
  if (node.type === "DoWhileStatement" && node.body.type === "BlockStatement") {
    return true;
  }

  /**
   * IIFE is a block-like statement specially from
   * JSCS#disallowPaddingNewLinesAfterBlocks.
   */
  if (isIIFEStatement(node)) {
    return true;
  }

  // Checks the last token is a closing brace of blocks.
  const lastToken = sourceCode.getLastToken(node, isNotSemicolonToken);

  const belongingNode =
    lastToken && isClosingBraceToken(lastToken)
      ? sourceCode.getNodeByRangeIndex(lastToken.range[0])
      : null;

  return (
    !!belongingNode &&
    (belongingNode.type === "BlockStatement" || belongingNode.type === "SwitchStatement")
  );
}

/**
 * Check whether the given node is a directive or not.
 * @param node The node to check.
 * @param sourceCode The source code object to get tokens.
 * @returns `true` if the node is a directive.
 */
function isStringValue(value: unknown): value is string {
  return typeof value === "string";
}

function isDirective(node: ASTNode, sourceCode: SourceCode): boolean {
  return (
    isTopLevelExpressionStatement(node) &&
    node.expression.type === "Literal" &&
    isStringValue(node.expression.value) &&
    !isParenthesized(node.expression, sourceCode)
  );
}

/**
 * Check whether the given node is a part of directive prologue or not.
 * @param node The node to check.
 * @param sourceCode The source code object to get tokens.
 * @returns `true` if the node is a part of directive prologue.
 */
function isDirectivePrologue(node: ASTNode, sourceCode: SourceCode): boolean {
  if (
    isDirective(node, sourceCode) &&
    node.parent &&
    "body" in node.parent &&
    Array.isArray(node.parent.body)
  ) {
    for (const sibling of node.parent.body) {
      if (sibling === node) {
        break;
      }

      if (!isDirective(sibling, sourceCode)) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Checks the given node is a CommonJS export statement
 * @param node The node to check.
 * @returns `true` if the node is a CommonJS export statement.
 * @private
 */
function isCJSExport(node: ASTNode): boolean {
  if (node.type === "ExpressionStatement") {
    const expression = node.expression;

    if (expression.type === "AssignmentExpression") {
      let left = expression.left;

      if (left.type === "MemberExpression") {
        while (left.object.type === "MemberExpression") {
          left = left.object;
        }

        return (
          left.object.type === "Identifier" &&
          (left.object.name === "exports" ||
            (left.object.name === "module" &&
              left.property.type === "Identifier" &&
              left.property.name === "exports"))
        );
      }
    }
  }

  return false;
}

/**
 * Check whether the given node is an expression
 * @param node The node to check.
 * @param sourceCode The source code object to get tokens.
 * @returns `true` if the node is an expression
 */
function isExpression(node: ASTNode, sourceCode: SourceCode): boolean {
  return node.type === "ExpressionStatement" && !isDirectivePrologue(node, sourceCode);
}

/**
 * Gets the actual last token.
 *
 * If a semicolon is semicolon-less style's semicolon, this ignores it.
 * For example:
 *
 *     foo()
 *     ;[1, 2, 3].forEach(bar)
 * @param sourceCode The source code to get tokens.
 * @param node The node to get.
 * @returns The actual last token.
 * @private
 */
function getActualLastToken(node: ASTNode, sourceCode: SourceCode): Token | null {
  const semiToken = sourceCode.getLastToken(node)!;
  const prevToken = sourceCode.getTokenBefore(semiToken);
  const nextToken = sourceCode.getTokenAfter(semiToken);

  const isSemicolonLessStyle =
    prevToken &&
    nextToken &&
    prevToken.range[0] >= node.range[0] &&
    isSemicolonToken(semiToken) &&
    !isTokenOnSameLine(prevToken, semiToken) &&
    isTokenOnSameLine(semiToken, nextToken);

  return isSemicolonLessStyle ? prevToken : semiToken;
}

/**
 * This returns the concatenation of the first 2 captured strings.
 * @param _ Unused. Whole matched string.
 * @param trailingSpaces The trailing spaces of the first line.
 * @param indentSpaces The indentation spaces of the last line.
 * @returns The concatenation of trailingSpaces and indentSpaces.
 * @private
 */
function replacerToRemovePaddingLines(
  _: string,
  trailingSpaces: string,
  indentSpaces: string,
): string {
  return trailingSpaces + indentSpaces;
}

function getReportLoc(node: ASTNode, sourceCode: SourceCode): Location {
  if (isSingleLine(node)) {
    return node.loc;
  }

  const line = node.loc.start.line;
  const sourceLine = sourceCode.lines[line - 1];

  return {
    end: {
      column: sourceLine.length,
      line,
    },
    start: node.loc.start,
  };
}

/**
 * Check and report statements for `any` configuration.
 * It does nothing.
 *
 * @private
 */
function verifyForAny(): void {
  // Empty
}

/**
 * Check and report statements for `never` configuration.
 * This autofix removes blank lines between the given 2 statements.
 * However, if comments exist between 2 blank lines, it does not remove those
 * blank lines automatically.
 * @param context The rule context to report.
 * @param _ Unused. The previous node to check.
 * @param nextNode The next node to check.
 * @param paddingLines The array of token pairs that blank
 * lines exist between the pair.
 *
 * @private
 */
function verifyForNever(
  context: RuleContext,
  _: ASTNode,
  nextNode: ASTNode,
  paddingLines: Array<[Token, Token]>,
): void {
  if (paddingLines.length === 0) {
    return;
  }

  context.report({
    fix(fixer) {
      if (paddingLines.length >= 2) {
        return null;
      }

      const [prevToken, nextToken] = paddingLines[0];
      const start = prevToken.range[1];
      const end = nextToken.range[0];

      const text = context.sourceCode.text
        .slice(start, end)
        .replace(PADDING_LINE_SEQUENCE, replacerToRemovePaddingLines);

      return fixer.replaceTextRange([start, end], text);
    },
    loc: getReportLoc(nextNode, context.sourceCode),
    messageId: "unexpectedBlankLine",
    node: nextNode,
  });
}

/**
 * Check and report statements for `always` configuration.
 * This autofix inserts a blank line between the given 2 statements.
 * If the `prevNode` has trailing comments, it inserts a blank line after the
 * trailing comments.
 * @param context The rule context to report.
 * @param prevNode The previous node to check.
 * @param nextNode The next node to check.
 * @param paddingLines The array of token pairs that blank
 * lines exist between the pair.
 *
 * @private
 */
function verifyForAlways(
  context: RuleContext,
  prevNode: ASTNode,
  nextNode: ASTNode,
  paddingLines: Array<[Token, Token]>,
): void {
  if (paddingLines.length > 0) {
    return;
  }

  context.report({
    fix(fixer) {
      const sourceCode = context.sourceCode;
      let prevToken = getActualLastToken(prevNode, sourceCode)!;

      const nextToken =
        sourceCode.getFirstTokenBetween(prevToken, nextNode, {
          includeComments: true,

          /**
           * Skip the trailing comments of the previous node.
           * This inserts a blank line after the last trailing comment.
           *
           * For example:
           *
           *     foo(); // trailing comment.
           *     // comment.
           *     bar();
           *
           * Get fixed to:
           *
           *     foo(); // trailing comment.
           *
           *     // comment.
           *     bar();
           * @param token The token to check.
           * @returns `true` if the token is not a trailing comment.
           * @private
           */
          filter(token) {
            if (isTokenOnSameLine(prevToken, token)) {
              prevToken = token;

              return false;
            }

            return true;
          },
        }) ?? nextNode;

      const insertText = isTokenOnSameLine(prevToken, nextToken) ? "\n\n" : "\n";

      return fixer.insertTextAfter(prevToken, insertText);
    },
    loc: getReportLoc(nextNode, context.sourceCode),
    messageId: "expectedBlankLine",
    node: nextNode,
  });
}

/**
 * Types of blank lines.
 * `any`, `never`, and `always` are defined.
 * Those have `verify` method to check and report statements.
 * @private
 */
const PaddingTypes = {
  always: { verify: verifyForAlways },
  any: { verify: verifyForAny },
  never: { verify: verifyForNever },
};

const MaybeMultilineStatementType = {
  "block-like": { test: isBlockLikeStatement },
  const: newKeywordTester("VariableDeclaration", "const"),
  export: newKeywordTester(
    ["ExportAllDeclaration", "ExportDefaultDeclaration", "ExportNamedDeclaration"],
    "export",
  ),
  expression: { test: isExpression },
  let: newKeywordTester("VariableDeclaration", "let"),
  return: newKeywordTester("ReturnStatement", "return"),
  type: newKeywordTester("TSTypeAliasDeclaration", "type"),
  using: {
    test: (node: ASTNode) =>
      node.type === "VariableDeclaration" && (node.kind === "using" || node.kind === "await using"),
  },
  var: newKeywordTester("VariableDeclaration", "var"),
};

/**
 * Types of statements.
 * Those have `test` method to check it matches to the given statement.
 * @private
 */
const StatementTypes = {
  "*": { test: (): boolean => true },
  block: newNodeTypeTester("BlockStatement"),
  "block-like": MaybeMultilineStatementType["block-like"],
  break: newKeywordTester("BreakStatement", "break"),
  case: newKeywordTester("SwitchCase", "case"),

  "cjs-export": {
    test: (node: ASTNode, sourceCode: SourceCode) =>
      node.type === "ExpressionStatement" &&
      node.expression.type === "AssignmentExpression" &&
      CJS_EXPORT.test(sourceCode.getText(node.expression.left)),
  },
  "cjs-import": {
    test: (node: ASTNode, sourceCode: SourceCode) =>
      node.type === "VariableDeclaration" &&
      node.declarations.length > 0 &&
      node.declarations[0]?.init != null &&
      CJS_IMPORT.test(sourceCode.getText(node.declarations[0].init)),
  },
  class: newKeywordTester("ClassDeclaration", "class"),
  const: MaybeMultilineStatementType.const,

  continue: newKeywordTester("ContinueStatement", "continue"),
  debugger: newKeywordTester("DebuggerStatement", "debugger"),
  default: newKeywordTester(["SwitchCase", "ExportDefaultDeclaration"], "default"),
  directive: { test: isDirectivePrologue },
  do: newKeywordTester("DoWhileStatement", "do"),
  empty: newNodeTypeTester("EmptyStatement"),
  enum: newKeywordTester("TSEnumDeclaration", "enum"),
  export: MaybeMultilineStatementType.export,
  exports: { test: isCJSExport },
  expression: MaybeMultilineStatementType.expression,
  for: newKeywordTester(["ForStatement", "ForInStatement", "ForOfStatement"], "for"),
  function: newNodeTypeTester("FunctionDeclaration"),
  "function-overload": newNodeTypeTester("TSDeclareFunction"),
  if: newKeywordTester("IfStatement", "if"),
  iife: { test: isIIFEStatement },

  import: newKeywordTester("ImportDeclaration", "import"),
  interface: newKeywordTester("TSInterfaceDeclaration", "interface"),

  let: MaybeMultilineStatementType.let,
  "multiline-block-like": whenMultiLine(MaybeMultilineStatementType["block-like"].test),
  "multiline-const": whenMultiLine(MaybeMultilineStatementType.const.test),
  "multiline-export": whenMultiLine(MaybeMultilineStatementType.export.test),
  "multiline-expression": whenMultiLine(MaybeMultilineStatementType.expression.test),
  "multiline-let": whenMultiLine(MaybeMultilineStatementType.let.test),
  "multiline-return": whenMultiLine(MaybeMultilineStatementType.return.test),
  "multiline-type": whenMultiLine(MaybeMultilineStatementType.type.test),
  "multiline-using": whenMultiLine(MaybeMultilineStatementType.using.test),
  "multiline-var": whenMultiLine(MaybeMultilineStatementType.var.test),
  require: { test: isCJSRequire },
  return: MaybeMultilineStatementType.return,
  "singleline-block-like": whenSingleLine(MaybeMultilineStatementType["block-like"].test),
  "singleline-const": whenSingleLine(MaybeMultilineStatementType.const.test),
  "singleline-export": whenSingleLine(MaybeMultilineStatementType.export.test),
  "singleline-expression": whenSingleLine(MaybeMultilineStatementType.expression.test),
  "singleline-let": whenSingleLine(MaybeMultilineStatementType.let.test),
  "singleline-return": whenSingleLine(MaybeMultilineStatementType.return.test),
  "singleline-type": whenSingleLine(MaybeMultilineStatementType.type.test),
  "singleline-using": whenSingleLine(MaybeMultilineStatementType.using.test),
  "singleline-var": whenSingleLine(MaybeMultilineStatementType.var.test),
  switch: newKeywordTester("SwitchStatement", "switch"),
  throw: newKeywordTester("ThrowStatement", "throw"),
  try: newKeywordTester("TryStatement", "try"),
  "ts-method": newNodeTypeTester("TSMethodSignature"),
  type: MaybeMultilineStatementType.type,
  using: MaybeMultilineStatementType.using,
  var: MaybeMultilineStatementType.var,
  while: newKeywordTester(["WhileStatement", "DoWhileStatement"], "while"),
  with: newKeywordTester("WithStatement", "with"),
};

/** Build the vendored padding rule with caller-owned, typed policy options. */
export default function createPaddingLineRule(options: RuleOptions): CreateRule {
  return {
    create(context) {
      const sourceCode = context.sourceCode;

      const selectorMatchedNodes = new Map<string, Set<ASTNode>>();
      const pendingPairs: Array<{ nextNode: ASTNode; prevNode: ASTNode }> = [];

      function collectSelectorOption(option: StatementOption): void {
        if (Array.isArray(option)) {
          for (const item of option) {
            collectSelectorOption(item);
          }

          return;
        }

        if (!isSelectorOption(option)) {
          return;
        }

        selectorMatchedNodes.set(option.selector, new Set());
      }

      for (const configure of options) {
        collectSelectorOption(configure.prev);
        collectSelectorOption(configure.next);
      }

      type Scope = {
        prevNode: ASTNode | null;
        upper: Scope;
      } | null;

      let scopeInfo: Scope = null;

      /**
       * Processes to enter to new scope.
       * This manages the current previous statement.
       *
       * @private
       */
      function enterScope(): void {
        scopeInfo = {
          prevNode: null,
          upper: scopeInfo,
        };
      }

      /**
       * Processes to exit from the current scope.
       *
       * @private
       */
      function exitScope(): void {
        if (scopeInfo) {
          scopeInfo = scopeInfo.upper;
        }
      }

      /**
       * Checks whether the given node matches the given type.
       * @param node The statement node to check.
       * @param type The statement type to check.
       * @returns `true` if the statement node matched the type.
       * @private
       */
      function match(node: ASTNode, type: StatementOption): boolean {
        let innerStatementNode = node;

        while (innerStatementNode.type === "LabeledStatement") {
          innerStatementNode = innerStatementNode.body;
        }

        if (Array.isArray(type)) {
          return type.some(match.bind(null, innerStatementNode));
        }

        if (isSelectorOption(type)) {
          const matchedNodes = selectorMatchedNodes.get(type.selector);

          if (!matchedNodes?.has(innerStatementNode)) {
            return false;
          }

          const lineMode = type.lineMode;

          if (lineMode === "singleline") {
            return isSingleLine(innerStatementNode);
          } else if (lineMode === "multiline") {
            return !isSingleLine(innerStatementNode);
          }

          return true;
        } else {
          return StatementTypes[type].test(innerStatementNode, sourceCode);
        }
      }

      /**
       * Finds the last matched configure from options.
       * @param prevNode The previous statement to match.
       * @param nextNode The current statement to match.
       * @returns The tester of the last matched configure.
       * @private
       */
      function getPaddingType(
        prevNode: ASTNode,
        nextNode: ASTNode,
      ): (typeof PaddingTypes)[keyof typeof PaddingTypes] {
        for (const configure of options.toReversed()) {
          if (match(prevNode, configure.prev) && match(nextNode, configure.next)) {
            return PaddingTypes[configure.blankLine];
          }
        }

        return PaddingTypes.any;
      }

      /**
       * Gets padding line sequences between the given 2 statements.
       * Comments are separators of the padding line sequences.
       * @param prevNode The previous statement to count.
       * @param nextNode The current statement to count.
       * @returns The array of token pairs.
       * @private
       */
      function getPaddingLineSequences(
        prevNode: ASTNode,
        nextNode: ASTNode,
      ): Array<[Token, Token]> {
        const pairs: Array<[Token, Token]> = [];
        let prevToken: Token = getActualLastToken(prevNode, sourceCode)!;

        if (nextNode.loc.start.line - prevToken.loc.end.line >= 2) {
          do {
            const token: Token = sourceCode.getTokenAfter(prevToken, {
              includeComments: true,
            })!;

            if (token.loc.start.line - prevToken.loc.end.line >= 2) {
              pairs.push([prevToken, token]);
            }

            prevToken = token;
          } while (prevToken.range[0] < nextNode.range[0]);
        }

        return pairs;
      }

      /**
       * Verify padding lines between the given node and the previous node.
       * @param node The node to verify.
       *
       * @private
       */
      function verify(node: ASTNode): void {
        if (
          !node.parent ||
          ![
            "BlockStatement",
            "Program",
            "StaticBlock",
            "SwitchCase",
            "SwitchStatement",
            "TSInterfaceBody",
            "TSModuleBlock",
            "TSTypeLiteral",
          ].includes(node.parent.type)
        ) {
          return;
        }

        // Save this node as the current previous statement.
        const prevNode = scopeInfo!.prevNode;

        // Verify.
        if (prevNode) {
          pendingPairs.push({ nextNode: node, prevNode });
        }

        scopeInfo!.prevNode = node;
      }

      function verifyPendingPairs(): void {
        for (const { nextNode, prevNode } of pendingPairs) {
          const type = getPaddingType(prevNode, nextNode);
          const paddingLines = getPaddingLineSequences(prevNode, nextNode);

          type.verify(context, prevNode, nextNode, paddingLines);
        }
      }

      /**
       * Verify padding lines between the given node and the previous node.
       * Then process to enter to new scope.
       * @param node The node to verify.
       *
       * @private
       */
      function verifyThenEnterScope(node: ASTNode): void {
        verify(node);
        enterScope();
      }

      const selectorMatchListeners = Object.fromEntries(
        Array.from(selectorMatchedNodes.keys(), (selector) => [
          selector,
          (node: ASTNode): void => {
            selectorMatchedNodes.get(selector)?.add(node);
          },
        ]),
      );

      return {
        ":statement": verify,
        BlockStatement: enterScope,
        "BlockStatement:exit": exitScope,
        Program: enterScope,
        "Program:exit": () => {
          verifyPendingPairs();
          exitScope();
        },
        StaticBlock: enterScope,
        "StaticBlock:exit": exitScope,
        SwitchCase: verifyThenEnterScope,
        "SwitchCase:exit": exitScope,
        SwitchStatement: enterScope,

        "SwitchStatement:exit": exitScope,
        TSDeclareFunction: verifyThenEnterScope,
        "TSDeclareFunction:exit": exitScope,
        TSInterfaceBody: enterScope,
        "TSInterfaceBody:exit": exitScope,
        TSMethodSignature: verifyThenEnterScope,
        "TSMethodSignature:exit": exitScope,
        TSModuleBlock: enterScope,
        "TSModuleBlock:exit": exitScope,
        TSTypeLiteral: enterScope,

        "TSTypeLiteral:exit": exitScope,
        ...selectorMatchListeners,
      };
    },
    meta: {
      docs: {
        description: "Require or disallow padding lines between statements",
      },
      fixable: "whitespace",
      hasSuggestions: false,
      type: "layout",
      // This is intentionally an array schema as you can pass 0..n config objects
      messages: {
        expectedBlankLine: "Expected blank line before this statement.",
        unexpectedBlankLine: "Unexpected blank line before this statement.",
      },
      schema: {
        $defs: {
          paddingType: {
            enum: Object.keys(PaddingTypes),
            type: "string",
          },
          selectorOption: {
            additionalProperties: false,
            properties: {
              lineMode: {
                enum: ["any", "singleline", "multiline"],
                type: "string",
              },
              selector: {
                type: "string",
              },
            },
            required: ["selector"],
            type: "object",
          },
          statementMatcher: {
            anyOf: [{ $ref: "#/$defs/statementType" }, { $ref: "#/$defs/selectorOption" }],
          },
          statementOption: {
            anyOf: [
              { $ref: "#/$defs/statementMatcher" },
              {
                additionalItems: false,
                items: { $ref: "#/$defs/statementMatcher" },
                minItems: 1,
                type: "array",
                uniqueItems: true,
              },
            ],
          },
          statementType: {
            enum: Object.keys(StatementTypes),
            type: "string",
          },
        },
        additionalItems: false,
        items: {
          additionalProperties: false,
          properties: {
            blankLine: { $ref: "#/$defs/paddingType" },
            next: { $ref: "#/$defs/statementOption" },
            prev: { $ref: "#/$defs/statementOption" },
          },
          required: ["blankLine", "prev", "next"],
          type: "object",
        },
        type: "array",
      },
    },
  };
}
