import { FunctionDeclaration, Identifier, VariableDeclaration } from "acorn";

export function isVariableDeclaration(node: any): node is VariableDeclaration {
  return node.type === "VariableDeclaration";
}

export function isFunctionDeclaration(node: any): node is FunctionDeclaration {
  return node.type === "FunctionDeclaration";
}

export function isIdentifier(node: any): node is Identifier {
  return node.type === "Identifier";
}
