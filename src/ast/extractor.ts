import {
  AnonymousFunctionDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  Node,
} from "acorn";
import * as walk from "acorn-walk";
import { saveToFile } from "../utils/file.js";
import NodeNotFoundException from "../exceptions/NodeNotFoundException.js";
import {
  isExportDefaultDeclaration,
  isExportNamedDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportExpression,
  isVariableDeclaration,
} from "../utils/types.js";

/**
 * Extracts the options variable from the AST by finding the named export declaration containing the 'options' variable.
 *
 * @param tree - The root node of the AST to search in
 * @param output - Optional file path to save the extracted options as JSON
 * @returns The extracted options node from the AST
 * @throws {NodeNotFoundException} If the options variable declaration is not found in the AST
 *
 * @example
 * ```typescript
 * const ast = parse(code);
 * const options = extractOptions(ast);
 * ```
 */
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

export function extractInitContext(tree: Node, output?: string): Node[] {
  let initContext: Node[] = [];

  // Pega tudo que não é importação e exportação e que está fora de uma função (ou seja, no initContext do k6)
  walk.fullAncestor(tree, (node, _, ancestors) => {
    if (
      !isExportDefaultDeclaration(node) &&
      !isExportNamedDeclaration(node) &&
      !isImportDeclaration(node) &&
      !isImportExpression(node) &&
      ancestors.length == 2
    ) {
      initContext.push(node);
    }
  });

  if (output) {
    saveToFile(
      output + "initContext.json",
      JSON.stringify(initContext, null, 2)
    );
  }

  return initContext;
}

export function extractSetupFunction(tree: Node, output?: string): Node | null {
  let setupNode = extractDefaultFunctionByName(tree, "setup");

  if (output) {
    saveToFile(output + "setup.json", JSON.stringify(setupNode, null, 2));
  }

  return setupNode;
}

export function extractDefaultTestFunction(tree: Node, output?: string): Node {
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

export function extractTeardownFunction(
  tree: Node,
  output?: string
): Node | null {
  let teardownNode = extractDefaultFunctionByName(tree, "teardown");

  if (output) {
    saveToFile(output + "teardown.json", JSON.stringify(teardownNode, null, 2));
  }

  return teardownNode;
}

export function extractDefaultFunctionByName(
  tree: Node,
  name: string
): Node | null {
  let targetNode: Node | null = null;

  walk.simple(tree, {
    ExportNamedDeclaration(node: ExportNamedDeclaration) {
      if (
        isFunctionDeclaration(node.declaration) &&
        node.declaration.id.name == name
      ) {
        targetNode = node;
      }
    },
  });

  return targetNode;
}

export function extractFunctionByName(tree: Node, name: string): Node {
  let targetNode: Node | null = null;

  walk.simple(tree, {
    FunctionDeclaration(
      node: FunctionDeclaration | AnonymousFunctionDeclaration
    ) {
      if (node.id && node.id.name === name) {
        targetNode = node;
      }
    },
  });

  if (!targetNode) {
    throw new NodeNotFoundException("Request function not found");
  }

  return targetNode;
}
