import type {
  CallExpression,
  ExportNamedDeclaration,
  Identifier,
  ImportDeclaration,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  MemberExpression,
  Node,
  ObjectExpression,
  Property,
} from "estree";
import {
  isCallExpression,
  isIdentifier,
  isNewExpression,
  isImportDeclaration,
  isLiteral,
  isMemberExpression,
  isObjectExpression,
  isProperty,
} from "../../utils/types.js";

export type NodeWithParent = Node & { parent?: Node };

export function isFetchCall(node: unknown): node is CallExpression {
  if (!isCallExpression(node)) return false;
  const callee = node.callee;
  return isIdentifier(callee) && callee.name === "fetch";
}

export function isHttpMemberCall(node: unknown): node is CallExpression {
  if (!isCallExpression(node)) return false;
  const callee = node.callee as MemberExpression;
  if (!isMemberExpression(callee)) return false;
  const obj = callee.object;
  return isIdentifier(obj) && obj.name === "http";
}

export function isCheckIdentifier(
  node: unknown,
  checkNames: ReadonlySet<string>
): node is Identifier {
  return isIdentifier(node) && checkNames.has(node.name);
}

export function isK6CheckMember(
  node: unknown,
  namespaces: ReadonlySet<string>
): node is MemberExpression {
  if (!isMemberExpression(node)) return false;
  const obj = (node as MemberExpression).object;
  const prop = (node as MemberExpression).property;
  return (
    isIdentifier(obj) &&
    namespaces.has(obj.name) &&
    isIdentifier(prop) &&
    prop.name === "check"
  );
}

export function findAncestor(
  node: NodeWithParent | undefined,
  predicate: (n: NodeWithParent) => boolean
): NodeWithParent | undefined {
  let current = node?.parent as NodeWithParent | undefined;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent as NodeWithParent | undefined;
  }
  return undefined;
}

export function isWithinSharedArrayCallback(node: NodeWithParent): boolean {
  // Checks if there is an ancestor NewExpression with callee Identifier 'SharedArray'
  const ancestor = findAncestor(node, (n) => {
    if ((n as { type: string }).type !== "NewExpression") return false;
    const maybeNew = n as unknown as { callee?: Node };
    const callee = maybeNew.callee;
    return (
      !!callee &&
      isIdentifier(callee) &&
      callee.name === "SharedArray"
    );
  });
  return Boolean(ancestor);
}

export function collectScenarioExecNamesFromOptionsExport(
  node: Node,
  addExecName: (name: string) => void
): void {
  const en = node as ExportNamedDeclaration;
  // Checks if this is a named export with a variable declaration
  if (!("declaration" in en) || !en.declaration) return;
  const decl = en.declaration;
  if (decl.type !== "VariableDeclaration") return;

  for (const d of decl.declarations) {
    const id = d.id as Node;
    if (!isIdentifier(id) || id.name !== "options") continue;
    const init = d.init as Node | null | undefined;
    if (!init || !isObjectExpression(init)) continue;

    for (const p of init.properties ?? []) {
      if (!isProperty(p)) continue;
      const keyNode = p.key as Node;
      if (!isIdentifier(keyNode) || keyNode.name !== "scenarios") continue;
      const scenariosValue = p.value as Node;
      if (!isObjectExpression(scenariosValue)) continue;

      for (const s of scenariosValue.properties ?? []) {
        if (!isProperty(s)) continue;
        const scenarioVal = s.value as Node;
        if (!isObjectExpression(scenarioVal)) continue;
        for (const sp of scenarioVal.properties ?? []) {
          if (!isProperty(sp)) continue;
          const skey = sp.key as Node;
          if (!isIdentifier(skey) || skey.name !== "exec") continue;
          const sval = sp.value as Node;
          if ((sval as { type?: string }).type === "Literal") {
            const maybe = sval as unknown as { value?: unknown };
            if (typeof maybe.value === "string" && maybe.value.length > 0) {
              addExecName(maybe.value);
            }
          }
        }
      }
    }
  }
}

export function isImportFromK6(node: unknown): node is ImportDeclaration {
  if (!isImportDeclaration(node)) return false;
  return (
    node.source &&
    typeof node.source === "object" &&
    "value" in node.source &&
    (node.source as { value?: unknown }).value === "k6"
  );
}

export function forEachImportSpecifier(
  node: ImportDeclaration,
  cb: (spec: ImportSpecifier | ImportNamespaceSpecifier) => void
): void {
  for (const spec of node.specifiers) {
    if (
      spec.type === "ImportSpecifier" ||
      spec.type === "ImportNamespaceSpecifier"
    ) {
      cb(spec);
    }
  }
}
