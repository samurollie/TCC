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
  Literal,
  NewExpression,
  VariableDeclarator,
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
  isExportNamedDeclaration,
  isVariableDeclaration,
  isVariableDeclarator,
} from "./types.js";

export type NodeWithParent = Node & { parent?: Node };

export function isFetchCall(node: unknown): node is CallExpression {
  if (!isCallExpression(node)) return false;
  const callee = node.callee;
  return isIdentifier(callee) && callee.name === "fetch";
}

export function isHttpMemberCall(node: unknown): node is CallExpression {
  if (!isCallExpression(node)) return false;
  const callee = node.callee;
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
  const obj = node.object;
  const prop = node.property;
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
    if (!isNewExpression(n)) return false;
    const callee = n.callee;
    return !!callee && isIdentifier(callee) && callee.name === "SharedArray";
  });
  return Boolean(ancestor);
}

export function collectScenarioExecNamesFromOptionsExport(
  node: Node,
  addExecName: (name: string) => void
): void {
  if (!isExportNamedDeclaration(node)) return;
  const en = node as ExportNamedDeclaration;
  // Checks if this is a named export with a variable declaration
  if (!en.declaration) return;
  const decl = en.declaration;
  if (!isVariableDeclaration(decl)) return;

  for (const d of decl.declarations) {
    if (!isVariableDeclarator(d)) continue;
    const declarator = d as VariableDeclarator;
    const id = declarator.id;
    if (!isIdentifier(id) || id.name !== "options") continue;
    const init = declarator.init as Node | null | undefined;
    if (!init || !isObjectExpression(init)) continue;

    for (const p of init.properties ?? []) {
      if (!isProperty(p)) continue;
      if (!isIdentifier(p.key)) continue;
      const keyNode = p.key as Identifier;
      if (keyNode.name !== "scenarios") continue;
      const scenariosValue = p.value;
      if (!isObjectExpression(scenariosValue)) continue;

      for (const s of scenariosValue.properties ?? []) {
        if (!isProperty(s)) continue;
        const scenarioVal = s.value;
        if (!isObjectExpression(scenarioVal)) continue;
        for (const sp of scenarioVal.properties ?? []) {
          if (!isProperty(sp)) continue;
          if (!isIdentifier(sp.key)) continue;
          const skey = sp.key as Identifier;
          if (skey.name !== "exec") continue;
          const sval = sp.value;
          if (isLiteral(sval)) {
            const maybe = sval as Literal;
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
    isLiteral(node.source) &&
    node.source.value === "k6"
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
