import {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ImportExpression,
  Literal,
  Property,
  Node,
} from "acorn";
import { CallExpression } from "acorn";
import { BinaryExpression } from "acorn";
import { WhileStatement } from "acorn";
import { NewExpression } from "acorn";
import { ObjectExpression } from "acorn";
import { ForStatement } from "acorn";
import { MemberExpression } from "acorn";
import { ExportNamedDeclaration } from "acorn";
import { FunctionDeclaration, Identifier, VariableDeclaration } from "acorn";
import * as walk from "acorn-walk";

export type Smell = {
  message: string;
  type?: string;
  line?: number;
  column?: number;
  value?: string | number;
};

export interface IFunctionWalkerState {
  targetFunctions: Set<string>;
  foundFunctions: Record<string, FunctionDeclaration>;
}

export function isVariableDeclaration(node: any): node is VariableDeclaration {
  return node.type === "VariableDeclaration";
}

export function isFunctionDeclaration(node: any): node is FunctionDeclaration {
  return node.type === "FunctionDeclaration";
}

export function isIdentifier(node: any): node is Identifier {
  return node.type === "Identifier";
}

export function isExportNamedDeclaration(
  node: any
): node is ExportNamedDeclaration {
  return node.type === "ExportNamedDeclaration";
}

export function isExportDefaultDeclaration(
  node: any
): node is ExportDefaultDeclaration {
  return node.type === "ExportDefaultDeclaration";
}

export function isExportAllDeclaration(
  node: any
): node is ExportAllDeclaration {
  return node.type === "ExportAllDeclaration";
}

export function isExportSpecifier(node: any): node is ExportSpecifier {
  return node.type === "ExportSpecifier";
}

export function isImportDeclaration(node: any): node is ImportDeclaration {
  return node.type === "ImportDeclaration";
}

export function isImportExpression(node: any): node is ImportExpression {
  return node.type === "ImportExpression";
}

export function isProperty(node: any): node is Property {
  return node.type === "Property";
}

export function isLiteral(node: any): node is Literal {
  return node.type === "Literal";
}

export function isCallExpression(node: any): node is CallExpression {
  return node.type === "CallExpression";
}

export function isMemberExpression(node: any): node is MemberExpression {
  return node.type === "MemberExpression";
}

export function isBinaryExpression(node: any): node is BinaryExpression {
  return node.type === "BinaryExpression";
}

export function isForStatement(node: any): node is ForStatement {
  return node.type === "ForStatement";
}

export function isWhileStatement(node: any): node is WhileStatement {
  return node.type === "WhileStatement";
}

export function isObjectExpression(node: any): node is ObjectExpression {
  return node.type === "ObjectExpression";
}

export function isNewExpression(node: any): node is NewExpression {
  return node.type === "NewExpression"
}