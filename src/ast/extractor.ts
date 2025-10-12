import {
  AnonymousFunctionDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  Identifier,
  Node,
} from "acorn";
import * as walk from "acorn-walk";
import { type FullAncestorWalkerCallback } from "acorn-walk";
import { saveToFile } from "../utils/file.js";
import NodeNotFoundException from "../exceptions/NodeNotFoundException.js";
import {
  IFunctionWalkerState,
  isExportDefaultDeclaration,
  isExportNamedDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportExpression,
  isLiteral,
  isProperty,
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

/**
 * Extracts nodes from the Abstract Syntax Tree that belong to the initialization context in k6.
 * The initialization context includes all top-level statements except imports and exports.
 *
 * @param tree - The root node of the Abstract Syntax Tree to analyze
 * @param output - Optional. If provided, saves the extracted context to a JSON file at the specified path
 * @returns An array of AST nodes that belong to the initialization context
 *
 * @example
 * ```typescript
 * const ast = parse(sourceCode);
 * const initContextNodes = extractInitContext(ast);
 * // or with file output
 * const initContextNodes = extractInitContext(ast, './output/');
 * ```
 */
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

/**
 * Extracts the setup function from an Abstract Syntax Tree (AST).
 *
 * @param tree - The AST node to search for the setup function
 * @param output - Optional file path where the extracted setup function will be saved as JSON
 * @returns The setup function node if found, null otherwise
 *
 * @example
 * const ast = parseCode(sourceCode);
 * const setupFn = extractSetupFunction(ast);
 */
export function extractSetupFunction(tree: Node, output?: string): Node | null {
  let setupNode = extractDefaultFunctionByName(tree, "setup");

  if (output) {
    saveToFile(output + "setup.json", JSON.stringify(setupNode, null, 2));
  }

  return setupNode;
}

/**
 * Extracts the default exported test function from an Abstract Syntax Tree (AST).
 *
 * @param tree - The AST node representing the entire source code
 * @param output - Optional path to save the extracted function as JSON
 * @returns The AST node of the default exported function
 * @throws {NodeNotFoundException} When no default exported function is found
 *
 * @example
 * const ast = parse(sourceCode);
 * const mainFunction = extractDefaultTestFunction(ast);
 */
export function* extractMainTestFunction(tree: Node, output?: string) {
  let nodes: Node[] = [];

  if (hasMultipleScenarions(tree)) {
    const scenarioNodes = extractScenarioFunctions(tree);
    nodes.push(...scenarioNodes);

    if (hasScenarioUsingDefaultFunction(tree)) {
      const defaultFunction = extractDefaultTestFunction(tree);
      if (defaultFunction) {
        nodes.push(defaultFunction);
      }
    }
  } else {
    const mainFunctionNode = extractDefaultTestFunction(tree);

    if (!mainFunctionNode) {
      throw new NodeNotFoundException("Main test function not found");
    }

    nodes.push(mainFunctionNode);
  }

  if (output) {
    saveToFile(output + "main.json", JSON.stringify(nodes, null, 2));
  }

  for (let node of nodes) {
    yield node;
  }
}

/**
 * Extracts the default-exported function named "teardown" from the provided AST and optionally persists it as JSON.
 *
 * If an output path/prefix is supplied, the resulting node (or `null` if not found)
 * is pretty-printed and saved to `${output}teardown.json`.
 *
 * @param tree - The root AST node to search for the "teardown" function.
 * @param output - Optional file path or prefix used to write the serialized result; no file is written if omitted.
 * @returns The AST node representing the "teardown" function if found; otherwise `null`.
 * @remarks This operation is read-only and does not mutate the input AST.
 * @example
 * // Writes './dist/teardown.json' and returns the node (or null)
 * const node = extractTeardownFunction(ast, './dist/');
 */
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

/**
 * Searches the provided AST for a named exported function and returns its export node.
 *
 * Traverses the AST and looks for an `ExportNamedDeclaration` whose `declaration` is a
 * `FunctionDeclaration` with an identifier that matches the given `name`. If found, the
 * corresponding `ExportNamedDeclaration` node is returned; otherwise, `null` is returned.
 *
 * @param tree - The root AST node to search.
 * @param name - The function name to match (e.g., "myFunction").
 * @returns The `ExportNamedDeclaration` node that exports the matching function, or `null` if not found.
 *
 * @remarks
 * - Matches only inline named function declarations exported directly, e.g., `export function foo() {}`.
 * - Does not match default exports, re-exports, specifier-based exports (e.g., `export { foo }`), or function/variable expressions.
 * - The AST is not modified.
 *
 * @example
 * // Returns the export node for `foo`, or null if not present.
 * const node = extractDefaultFunctionByName(ast, "foo");
 */
export function extractDefaultFunctionByName(
  tree: Node,
  name: string
): Node | null {
  let targetNode: Node | null = null;

  walk.simple(tree, {
    ExportNamedDeclaration(node: ExportNamedDeclaration) {
      if (
        isFunctionDeclaration(node.declaration) &&
        node.declaration.id &&
        node.declaration.id.name == name
      ) {
        targetNode = node;
      }
    },
  });

  return targetNode;
}

/**
 * Extracts a function declaration node from an AST by its identifier name.
 *
 * Traverses the provided AST and inspects FunctionDeclaration nodes, returning
 * the one whose identifier exactly matches the given name. If multiple matches
 * exist, the last one encountered during traversal is returned.
 *
 * @param tree - The root AST node to search.
 * @param name - The identifier of the function to locate.
 * @returns The matching function declaration node.
 * @throws NodeNotFoundException If no function with the specified name is found.
 * @example
 * const fnNode = extractFunctionByName(ast, "myFunction");
 * // Use fnNode to inspect parameters, body, etc.
 */
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

export function hasMultipleScenarions(tree: Node): boolean {
  try {
    const optionsNode = extractOptions(tree);
    let hasScenarios = false;

    walk.simple(optionsNode, {
      Property(node) {
        if (isIdentifier(node.key) && node.key.name === "scenarios") {
          hasScenarios = true;
        }
      },
    });

    return hasScenarios;
  } catch (error) {
    console.log("Erro ao extrair options:", error);
    return false;
  }
}

function extractDefaultTestFunction(tree: Node): Node | null {
  let functionNode: Node | null = null;
  walk.simple(tree, {
    ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
      if (
        isFunctionDeclaration(node.declaration) &&
        node.declaration.id == null
      ) {
        functionNode = node;
      }
    },
  });

  return functionNode;
}

function extractScenarioFunctions(tree: Node) {
  const initialState: IFunctionWalkerState = {
    targetFunctions: new Set(),
    foundFunctions: {},
  };

  const walker: FullAncestorWalkerCallback<IFunctionWalkerState> = (
    node,
    state,
    ancestors
  ) => {
    if (
      isProperty(node) &&
      isIdentifier(node.key) &&
      node.key.name == "exec" &&
      isLiteral(node.value)
    ) {
      const name = node.value.value as string;
      state.targetFunctions.add(name);
    }

    if (isFunctionDeclaration(node)) {
      if (node.id && node.id.name) {
        state.foundFunctions[node.id.name] = node;
      }
    }
  };

  walk.fullAncestor(tree, walker, undefined, initialState);

  const resultNodes: Node[] = [];

  for (const name of initialState.targetFunctions) {
    if (initialState.foundFunctions[name]) {
      resultNodes.push(initialState.foundFunctions[name]);
    }
  }

  return resultNodes;
}

/**
 * Verifica se algum cenário não tem executor definido ou usa a função default.
 * Quando um cenário não especifica 'exec', o k6 usa a função default exportada.
 *
 * @param tree - A árvore AST para analisar
 * @returns true se algum cenário usar implicitamente a função default
 */
function hasScenarioUsingDefaultFunction(tree: Node): boolean {
  let hasDefaultScenario = false;

  walk.simple(tree, {
    Property(node) {
      
      if (
        isIdentifier(node.key) &&
        node.key.name === "scenarios" &&
        node.value.type === "ObjectExpression"
      ) {
        for (const scenarioProperty of node.value.properties) {
          if (
            scenarioProperty.type === "Property" &&
            scenarioProperty.value.type === "ObjectExpression"
          ) {
            let hasExecProperty = false;

            for (const prop of scenarioProperty.value.properties) {
              if (
                prop.type === "Property" &&
                isIdentifier(prop.key) &&
                prop.key.name === "exec"
              ) {
                hasExecProperty = true;
                break;
              }
            }

            if (!hasExecProperty) {
              hasDefaultScenario = true;
            }
          }
        }
      }
    },
  });

  return hasDefaultScenario;
}
