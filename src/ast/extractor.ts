import { ExportDefaultDeclaration, ExportNamedDeclaration, Node } from "acorn";
import * as walk from "acorn-walk";
import { saveToFile } from "../utils/file.js";
import NodeNotFoundException from "../exceptions/NodeNotFoundException.js";
import {
  isFunctionDeclaration,
  isIdentifier,
  isVariableDeclaration,
} from "../utils/types.js";

export function extractOptions(tree: Node, output?: string): Node {
  let optionsNode: Node | null = null;

  walk.simple(tree, {
    ExportNamedDeclaration(node: ExportNamedDeclaration) {
      if (isVariableDeclaration(node.declaration)) {
        const firstDeclaration = node.declaration.declarations[0];
        if (
          isIdentifier(firstDeclaration.id) &&
          firstDeclaration.id.name == "options"
        ) {
          optionsNode = node;
        }
      }
    },
  });

  if (!optionsNode) {
    throw new NodeNotFoundException("Options variable not found");
  }

  if (output) {
    saveToFile(output + "options.json", JSON.stringify(optionsNode, null, 2));
  }

  return optionsNode;
}

export function extractMainFunction(tree: Node, output?: string): Node {
  let mainFunctionNode: Node | null = null;

  walk.simple(tree, {
    ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
      if (
        isFunctionDeclaration(node.declaration) &&
        node.declaration.id == null
      ) {
        mainFunctionNode = node;
      }
    },
  });

  if (!mainFunctionNode) {
    throw new NodeNotFoundException("Main test function not found");
  }

  if (output) {
    saveToFile(output + "main.json", JSON.stringify(mainFunctionNode, null, 2));
  }

  return mainFunctionNode;
}

type MagicNumberFinding = {
  value: number;
  raw?: string;
  parentType?: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  message: string;
};

type SmellFinding = {
  type: string;
  message: string;
  line: number;
  column: number;
  value?: string;
  context?: string;
};

export function extractMagicNumbers(
  tree: Node,
  output?: string
): MagicNumberFinding[] {
  const findings: MagicNumberFinding[] = [];

  // Collect numeric literals that are likely magic numbers
  walk.ancestor(tree as any, {
    Literal(node: any, ancestors: any[]) {
      if (typeof node.value !== "number") return;

      // Ignore very common sentinel values
      if (node.value === 0 || node.value === 1 || node.value === -1) return;

      const parent =
        ancestors.length > 1 ? ancestors[ancestors.length - 2] : null;

      // Heuristics to ignore some non-problematic cases
      // - Object property keys like { 404: "Not Found" }
      if (parent && parent.type === "Property" && parent.key === node) return;

      // - Exported options duration strings are not numbers; safe
      // - Array lengths and such are still potential magic numbers → keep

      const line = node.loc?.start?.line || 0;
      const column = node.loc?.start?.column || 0;
      const message = `Magic Number detected: ${node.value} at line ${line}, column ${column}. Consider using a named constant to explain what this number represents.`;

      findings.push({
        value: node.value,
        raw: node.raw,
        parentType: parent?.type,
        loc: node.loc,
        message,
      });
    },
  });

  if (output) {
    // Save human-readable messages
    const messages = findings.map((f) => f.message);
    saveToFile(output + "magic-numbers-messages.txt", messages.join("\n\n"));

    // Save detailed JSON for debugging
    saveToFile(
      output + "magic-numbers.json",
      JSON.stringify(findings, null, 2)
    );
  }

  return findings;
}

export function generateSmellsCSV(
  allSmells: SmellFinding[],
  output?: string
): void {
  if (!output) return;

  const csvHeader = "Type,Message,Line,Column,Value,Context\n";
  const csvRows = allSmells
    .map(
      (smell) =>
        `"${smell.type}","${smell.message}","${smell.line}","${
          smell.column
        }","${smell.value || ""}","${smell.context || ""}"`
    )
    .join("\n");

  const csvContent = csvHeader + csvRows;
  saveToFile(output + "smells.csv", csvContent);
}
