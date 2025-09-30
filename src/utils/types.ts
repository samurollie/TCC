import { FunctionDeclaration, Identifier, VariableDeclaration } from "acorn";

// Tipo unificado para achados/ocorrências nas análises
export type Finding = {
  // Campos comuns
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

export function isVariableDeclaration(node: any): node is VariableDeclaration {
  return node.type === "VariableDeclaration";
}

export function isFunctionDeclaration(node: any): node is FunctionDeclaration {
  return node.type === "FunctionDeclaration";
}

export function isIdentifier(node: any): node is Identifier {
  return node.type === "Identifier";
}
