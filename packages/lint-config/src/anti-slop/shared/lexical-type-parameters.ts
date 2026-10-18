import type { ESTree } from "@oxlint/plugins";

type VisitorKeys = Readonly<Record<string, ReadonlyArray<string>>>;

function isNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

type AstField =
  | { readonly children: ReadonlyArray<unknown>; readonly kind: "list" }
  | { readonly kind: "node"; readonly node: ESTree.Node };

function fieldValue(node: ESTree.Node, key: string): AstField | undefined {
  for (const [field, value] of Object.entries(node)) {
    if (field !== key) {
      continue;
    }

    if (isNode(value)) {
      return { kind: "node", node: value };
    }

    if (Array.isArray(value)) {
      return { children: value, kind: "list" };
    }

    return undefined;
  }

  return undefined;
}

function collectInferTypeParameterNames(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
  names: Set<string>,
): void {
  if (node.type === "TSInferType") {
    names.add(node.typeParameter.name.name);
  }

  for (const key of visitorKeys[node.type] ?? []) {
    const value = fieldValue(node, key);

    if (value === undefined) {
      continue;
    }

    if (value.kind === "node") {
      collectInferTypeParameterNames(value.node, visitorKeys, names);
      continue;
    }

    for (const child of value.children) {
      if (isNode(child)) {
        collectInferTypeParameterNames(child, visitorKeys, names);
      }
    }
  }
}

/** Collect type binders that are in scope at a node and can shadow module aliases. */
export function lexicalTypeParameterNames(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
): ReadonlySet<string> {
  const names = new Set<string>();
  let descendant: ESTree.Node = node;
  let current: ESTree.Node = node;

  while (current.type !== "Program") {
    if ("typeParameters" in current) {
      for (const parameter of current.typeParameters?.params ?? []) {
        names.add(parameter.name.name);
      }
    }

    if (
      current.type === "TSMappedType" &&
      (descendant === current.nameType || descendant === current.typeAnnotation)
    ) {
      names.add(current.key.name);
    }

    if (current.type === "TSConditionalType" && descendant === current.trueType) {
      collectInferTypeParameterNames(current.extendsType, visitorKeys, names);
    }

    descendant = current;
    current = current.parent;
  }

  return names;
}
