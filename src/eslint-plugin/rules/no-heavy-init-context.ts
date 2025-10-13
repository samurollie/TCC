import type { Rule } from "eslint";
import { isNewExpression } from "../../utils/types.js";

// Helper para acessar parent de um nó estree
function getParent(
  node: import("estree").Node
): import("estree").Node | undefined {
  return (node as unknown as { parent?: import("estree").Node }).parent;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow heavy operations in k6 init context",
      category: "Performance",
      recommended: true,
      url: "https://k6.io/docs/using-k6/test-life-cycle/",
    },
    fixable: undefined,
    schema: [],
    messages: {
      fileOperation:
        "Avoid file operations in k6 init context. Consider using SharedArray for shared data.",
      jsonParsing:
        "Avoid JSON parsing in k6 init context. Consider parsing inside SharedArray callback.",
      networkOperation:
        "Avoid network/HTTP operations in k6 init context. This should be done in the test function.",
      dynamicImport:
        "Avoid dynamic imports in k6 init context. Use static imports instead.",
      moduleLoading:
        "Avoid heavy module loading operations in k6 init context.",
      loopOperation:
        "Avoid loops in k6 init context. Move heavy processing to SharedArray callback.",
      complexMath: "Avoid complex mathematical operations in k6 init context.",
    },
  },

  create(context: Rule.RuleContext) {
    let functionDepth = 0;

    function isInFunction(): boolean {
      return functionDepth > 0;
    }

    return {
      // Track function depth to know if we're in init context
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"() {
        functionDepth++;
      },
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression:exit"() {
        functionDepth--;
      },

      CallExpression(
        node: import("estree").CallExpression & {
          parent?: import("estree").Node;
        }
      ) {
        // Only check operations in init context (not inside functions)
        if (isInFunction()) {
          return;
        }

        // Check if we're inside a SharedArray - this is allowed
        let parent = node.parent;
        while (parent) {
          if (
            isNewExpression(parent) &&
            (parent as unknown as { callee?: { name?: string } }).callee
              ?.name === "SharedArray"
          ) {
            return;
          }
          parent = getParent(parent);
        }

        const callee = node.callee;

        // Detect file operations
        if (
          callee.type === "Identifier" &&
          (callee as import("estree").Identifier).name === "open"
        ) {
          context.report({
            node,
            messageId: "fileOperation",
          });
        }

        // Detect member expressions (obj.method())
        if (callee.type === "MemberExpression") {
          const member = callee as import("estree").MemberExpression;
          const object = member.object as import("estree").Identifier;
          const property = member.property as import("estree").Identifier;

          // File system operations
          if (
            object.name === "fs" &&
            (property.name === "readFileSync" || property.name === "readFile")
          ) {
            context.report({
              node,
              messageId: "fileOperation",
            });
          }

          // JSON parsing
          if (object.name === "JSON" && property.name === "parse") {
            context.report({
              node,
              messageId: "jsonParsing",
            });
          }
        }

        // Network operations
        if (
          callee.type === "Identifier" &&
          ((callee as import("estree").Identifier).name === "fetch" ||
            (callee as import("estree").Identifier).name === "http")
        ) {
          context.report({
            node,
            messageId: "networkOperation",
          });
        }

        // Module loading operations
        if (
          callee.type === "Identifier" &&
          (callee as import("estree").Identifier).name === "require"
        ) {
          context.report({
            node,
            messageId: "moduleLoading",
          });
        }
      },

      // Detect dynamic imports
      ImportExpression(node: import("estree").ImportExpression) {
        if (!isInFunction()) {
          context.report({
            node,
            messageId: "dynamicImport",
          });
        }
      },

      // Detect loops in init context
      "ForStatement, WhileStatement, DoWhileStatement, ForInStatement, ForOfStatement"(
        node: import("estree").Node
      ) {
        if (!isInFunction()) {
          context.report({
            node,
            messageId: "loopOperation",
          });
        }
      },

      // Detect complex mathematical operations
      BinaryExpression(node: import("estree").BinaryExpression) {
        if (!isInFunction() && node.operator === "**") {
          context.report({
            node,
            messageId: "complexMath",
          });
        }
      },
    };
  },
};

export default rule;
