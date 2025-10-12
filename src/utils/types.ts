import {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ImportExpression,
  Literal,
  Property,
} from "acorn";
import { ExportNamedDeclaration } from "acorn";
import { FunctionDeclaration, Identifier, VariableDeclaration } from "acorn";
import * as walk from "acorn-walk";

export type Smell = {
  // name: string;
  message: string;

  // Metadados opcionais compartilhados
  type?: string;
  line?: number;
  column?: number;
  value?: string | number;
  context?: string;

  // Detalhes adicionais usados em análises específicas (ex: números mágicos)
  raw?: string;
  parentType?: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
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
  return node.type === "Literal"
}
