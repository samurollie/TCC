import type { Rule } from "eslint";
import {
  isIdentifier,
  isMemberExpression,
  isObjectExpression,
} from "../../utils/types.js";
import type { Node, CallExpression } from "estree";

type FuncNode = any; // Relax typing to align with ESLint NodeListener expectations

interface FuncState {
  name?: string;
  isTarget: boolean;
  hasCheck: boolean;
  hasHttp: boolean;
}

function isFunctionLike(node: Node | null | undefined): node is FuncNode {
  return (
    !!node &&
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression")
  );
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the use of check() in k6 test functions that perform HTTP requests",
      category: "Best Practices",
      recommended: true,
      url: "https://k6.io/docs/using-k6/http-requests/#checks",
    },
    schema: [],
    messages: {
      missingCheckDefault:
        "Test default function performs HTTP requests without any check(). Add checks to validate responses and avoid false positives.",
      missingCheckFunction:
        "Function '{{name}}' performs HTTP requests without any check(). Add checks to validate responses and avoid false positives.",
    },
  },

  create(context: Rule.RuleContext) {
    // Targets
    let defaultFunction: FuncNode | null = null;
    const scenarioExecNames = new Set<string>();
    const checkNames = new Set<string>(["check"]); // local names valid for check()
    const k6NamespaceNames = new Set<string>(); // local names for import * as k6 from 'k6'

    // Function state tracking
    const funcStack: FuncNode[] = [];
    const stateByFunc = new WeakMap<FuncNode, FuncState>();
    const funcByName = new Map<string, FuncNode>();

    function ensureFuncState(fn: FuncNode): FuncState {
      let st = stateByFunc.get(fn);
      if (!st) {
        st = { isTarget: false, hasCheck: false, hasHttp: false };
        stateByFunc.set(fn, st);
      }
      return st;
    }

    function markTarget(fn: FuncNode, name?: string) {
      const st = ensureFuncState(fn);
      st.isTarget = true;
      if (name) st.name = name;
    }

    function getCurrentFunc(): FuncNode | undefined {
      return funcStack[funcStack.length - 1];
    }

    function isHttpCall(node: CallExpression): boolean {
      const callee = node.callee;
      // http.get/post/... => MemberExpression with object Identifier 'http'
      if (isMemberExpression(callee)) {
        const obj: any = (callee as any).object;
        if (obj && isIdentifier(obj) && obj.name === "http") {
          return true;
        }
      }
      // fetch(...)
      if (isIdentifier(callee) && (callee as any).name === "fetch") {
        return true;
      }
      return false;
    }

    function isCheckCall(node: CallExpression): boolean {
      const callee = node.callee;
      // check(...) or check alias
      if (isIdentifier(callee) && checkNames.has((callee as any).name)) {
        return true;
      }
      // k6.check(...)
      if (isMemberExpression(callee)) {
        const obj: any = (callee as any).object;
        const prop: any = (callee as any).property;
        if (
          isIdentifier(obj) &&
          k6NamespaceNames.has(obj.name) &&
          isIdentifier(prop) &&
          prop.name === "check"
        ) {
          return true;
        }
      }
      return false;
    }

    function collectScenarioExecNamesFromOptions(node: any) {
      // export const/let options = { scenarios: { name: { exec: "foo" } } };
      const decl = node.declaration;
      if (!decl || decl.type !== "VariableDeclaration") return;
      const first: any = decl.declarations[0];
      if (
        !first ||
        first.id?.type !== "Identifier" ||
        first.id.name !== "options"
      )
        return;
      const init: any = first.init;
      if (!init || !isObjectExpression(init)) return;

      for (const p of init.properties || []) {
        if (p.type !== "Property") continue;
        const prop: any = p;
        const key: any = prop.key;
        if (
          key &&
          key.type === "Identifier" &&
          key.name === "scenarios" &&
          prop.value &&
          isObjectExpression(prop.value)
        ) {
          const scenariosObj: any = prop.value;
          for (const s of scenariosObj.properties || []) {
            if (s.type !== "Property") continue;
            const scenarioVal: any = (s as any).value;
            if (!isObjectExpression(scenarioVal)) continue;
            for (const sp of scenarioVal.properties || []) {
              if (sp.type !== "Property") continue;
              const skey: any = (sp as any).key;
              if (skey && skey.type === "Identifier" && skey.name === "exec") {
                const sval: any = (sp as any).value;
                if (
                  sval &&
                  sval.type === "Literal" &&
                  typeof sval.value === "string"
                ) {
                  scenarioExecNames.add(String(sval.value));
                }
              }
            }
          }
        }
      }
    }

    return {
      Program(_node: any) {
        // nothing here; initialized above
      },

      // Detect imports from 'k6' to resolve check alias and namespace usage
      ImportDeclaration(node: any) {
        if (!node || node.type !== "ImportDeclaration") return;
        const source = node.source?.value;
        if (source !== "k6") return;
        for (const spec of node.specifiers || []) {
          if (spec.type === "ImportSpecifier") {
            const importedName = spec.imported?.name;
            const localName = spec.local?.name;
            if (importedName === "check" && localName) {
              checkNames.add(localName);
            }
          } else if (spec.type === "ImportNamespaceSpecifier") {
            if (spec.local?.name) {
              k6NamespaceNames.add(spec.local.name);
            }
          }
        }
      },

      // Identify default export function node
      ExportDefaultDeclaration(node: any) {
        const decl = node.declaration as Node;
        if (isFunctionLike(decl)) {
          defaultFunction = decl as FuncNode;
          markTarget(defaultFunction);
        }
      },

      // Collect scenario exec names from options
      ExportNamedDeclaration(node: any) {
        collectScenarioExecNamesFromOptions(node);
      },

      // Track named function declarations
      FunctionDeclaration(node: any) {
        funcStack.push(node);
        const st = ensureFuncState(node);
        const name = node.id?.name;
        if (name) {
          funcByName.set(name, node);
          if (scenarioExecNames.has(name)) {
            markTarget(node, name);
          }
        }
        // defaultFunction may be a FunctionDeclaration with id null; object equality also works
        if (defaultFunction === node) {
          markTarget(node);
        }
      },
      "FunctionDeclaration:exit"() {
        funcStack.pop();
      },

      // Track function expressions (possibly assigned to variables used in exec)
      FunctionExpression(node: any) {
        funcStack.push(node);
        ensureFuncState(node);
        if (defaultFunction === node) {
          markTarget(node);
        }
      },
      "FunctionExpression:exit"() {
        funcStack.pop();
      },
      ArrowFunctionExpression(node: any) {
        funcStack.push(node);
        ensureFuncState(node);
        if (defaultFunction === node) {
          markTarget(node);
        }
      },
      "ArrowFunctionExpression:exit"() {
        funcStack.pop();
      },

      // Map variable name to function expressions
      VariableDeclarator(node: any) {
        if (
          node.id?.type === "Identifier" &&
          node.init &&
          isFunctionLike(node.init)
        ) {
          const fn = node.init as FuncNode;
          funcByName.set(node.id.name, fn);
          if (scenarioExecNames.has(node.id.name)) {
            markTarget(fn, node.id.name);
          }
        }
      },

      // Detect calls inside functions
      CallExpression(node: CallExpression) {
        const current = getCurrentFunc();
        if (!current) return;
        const st = ensureFuncState(current);
        if (isHttpCall(node)) st.hasHttp = true;
        if (isCheckCall(node)) st.hasCheck = true;
      },

      // At the end, report targets that have HTTP but no checks
      "Program:exit"() {
        // Default function
        if (defaultFunction) {
          const st = stateByFunc.get(defaultFunction);
          if (st && st.isTarget && st.hasHttp && !st.hasCheck) {
            // Report on the export default node for clarity
            context.report({
              node:
                (defaultFunction as unknown as { parent?: Node }).parent ||
                (defaultFunction as Node),
              messageId: "missingCheckDefault",
            });
          }
        }

        // Scenario functions
        for (const name of scenarioExecNames) {
          const fn = funcByName.get(name);
          if (!fn) continue;
          const st = stateByFunc.get(fn);
          if (st && st.isTarget && st.hasHttp && !st.hasCheck) {
            // Prefer reporting on the function id if present
            const reportNode =
              fn.type === "FunctionDeclaration" && fn.id ? fn.id : (fn as Node);
            context.report({
              node: reportNode,
              messageId: "missingCheckFunction",
              data: { name },
            });
          }
        }
      },
    };
  },
};

export default rule;
