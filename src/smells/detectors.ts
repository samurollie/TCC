import { CallExpression, Node } from "acorn";
import * as walk from "acorn-walk";
import {
  Smell,
  isCallExpression,
  isMemberExpression,
  isIdentifier,
  isBinaryExpression,
  isForStatement,
  isWhileStatement,
  isNewExpression,
} from "../utils/types.js";
import { extractFunctionDeclarationByName } from "../ast/extractor.js";

function heavyOperationsOnInitContext(initContext: Node[]): Smell[] | null {
  const heavyOperations: Smell[] = [];

  initContext.forEach((node) =>
    walk.ancestor(node, {
      CallExpression(node: CallExpression, _, ancestors: Node[]) {
        const callee = node.callee;

        // Ignores if the heavy operations are inside a shareArray, cause that is the desired scenario
        if (
          ancestors.find(
            (node) =>
              isNewExpression(node) &&
              isIdentifier(node.callee) &&
              node.callee.name === "SharedArray"
          )
        ) {
          return;
        }

        if (isIdentifier(callee) && callee.name === "open") {
          heavyOperations.push({
            message: "File operation found",
            type: "Heavy Init Context",
          });
        }

        /* if (
        isMemberExpression(callee) &&
        isIdentifier(callee.object) &&
        callee.object.name === "fs" &&
        isIdentifier(callee.property) &&
        (callee.property.name === "readFileSync" ||
          callee.property.name === "readFile")
      ) {
        heavyOperations.push("File reading operation");
      } */

        if (
          isMemberExpression(callee) &&
          isIdentifier(callee.object) &&
          callee.object.name === "JSON" &&
          isIdentifier(callee.property) &&
          callee.property.name === "parse"
        ) {
          heavyOperations.push({
            message: "JSON parsing operation",
            type: "Heavy Init Context",
          });
        }
      },

      // Detectar loops que podem ser custosos
      ForStatement(node: any) {
        if (isForStatement(node)) {
          heavyOperations.push({ message: "Loop operation (for)" });
        }
      },

      WhileStatement(node: any) {
        if (isWhileStatement(node)) {
          heavyOperations.push({ message: "Loop operation (while)" });
        }
      },

      // Detectar operações matemáticas complexas
      BinaryExpression(node: any) {
        if (isBinaryExpression(node) && node.operator === "**") {
          heavyOperations.push({
            message: "Complex mathematical operation (exponentiation)",
          });
        }
      },
    })
  );

  if (heavyOperations.length > 0) {
    /* return {
      message: `Heavy operations detected in initContext: ${heavyOperations.join(
        ", "
      )}`,
      type: "HEAVY_INIT_CONTEXT",
      value: heavyOperations.length,
    }; */
    return heavyOperations;
  }

  return null;
}

const detectors = {
  heavyOperationsOnInitContext,
};

export default detectors;
