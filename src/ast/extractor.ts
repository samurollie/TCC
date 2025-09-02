import {
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Node,
  VariableDeclarator,
  VariableDeclaration,
  FunctionDeclaration,
} from "acorn";
import * as walk from "acorn-walk";
import { saveToFile } from "../utils/file.js";
import NodeNotFoundException from "../exceptions/NodeNotFoundException.js";
import { Identifier } from "acorn";

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

function isVariableDeclaration(node: any): node is VariableDeclaration {
  return node.type === "VariableDeclaration";
}

function isFunctionDeclaration(node: any): node is FunctionDeclaration {
  return node.type === "FunctionDeclaration";
}

function isIdentifier(node: any): node is Identifier {
  return node.type === "Identifier";
}
