import type { Rule } from "eslint";
import { isIdentifier, isMemberExpression } from "../../utils/types.js";
import type {
  Node,
  CallExpression,
  Identifier,
  MemberExpression,
  ImportExpression,
  BinaryExpression,
} from "estree";
import {
  isFetchCall,
  isHttpMemberCall,
  isWithinSharedArrayCallback,
} from "../utils/ast-helpers.js";

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
        "Avoid JSON parsing in k6 init context. Consider parsing inside SharedArray callback on in the setup function.",
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
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"() {
        functionDepth++;
      },
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression:exit"() {
        functionDepth--;
      },

      CallExpression(
        node: CallExpression & {
          parent?: Node;
        }
      ) {
        if (isInFunction()) {
          return;
        }

        // ignore if within SharedArray callback
        if (isWithinSharedArrayCallback(node)) {
          return;
        }

        const callee = node.callee;

        if (isIdentifier(callee) && callee.name === "open") {
          context.report({
            node,
            messageId: "fileOperation",
          });
        }

        // Detect member expressions (obj.method())
        if (isMemberExpression(callee)) {
          const object = callee.object as Identifier;
          const property = callee.property as Identifier;

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
        if (isIdentifier(callee) && callee.name === "fetch") {
          context.report({
            node,
            messageId: "networkOperation",
          });
        }
        // http.* membro
        if (isMemberExpression(callee)) {
          // http.* member
          const property = callee.property as Identifier;
          const object = callee.object as Identifier;
          if (object.name === "http") {
            context.report({ node, messageId: "networkOperation" });
          }
        }

        // Module loading operations
        if (isIdentifier(callee) && callee.name === "require") {
          context.report({
            node,
            messageId: "moduleLoading",
          });
        }
      },

      // Detect dynamic imports
      ImportExpression(node: ImportExpression) {
        if (!isInFunction()) {
          context.report({
            node,
            messageId: "dynamicImport",
          });
        }
      },

      // Detect loops in init context
      "ForStatement, WhileStatement, DoWhileStatement, ForInStatement, ForOfStatement"(
        node: Node
      ) {
        if (!isInFunction()) {
          context.report({
            node,
            messageId: "loopOperation",
          });
        }
      },

      // Detect complex mathematical operations
      BinaryExpression(node: BinaryExpression) {
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
