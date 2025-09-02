import { ExportDefaultDeclaration, Node, VariableDeclarator } from "acorn";
import * as walk from "acorn-walk";
import { saveToFile } from "../utils/file.js";
import { FunctionDeclaration } from "acorn";
import NodeNotFoundException from "../exceptions/NodeNotFoundException.js";

export function extractOptions(tree: Node, output?: string): Node {
  let optionsNode: Node | null = null;

  walk.simple(tree, {
    VariableDeclarator(node: VariableDeclarator) {
      if ("name" in node.id && node.id.name === "options") {
        optionsNode = node;
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
      if ("id" in node.declaration && node.declaration.id === null) {
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
