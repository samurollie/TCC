import type { Rule } from "eslint";
import {
  isIdentifier,
  isMemberExpression,
  isObjectExpression,
  isImportDeclaration,
  isExportNamedDeclaration,
  isExportDefaultDeclaration,
  isVariableDeclaration,
  isProperty,
  isLiteral,
  isVariableDeclarator,
  isFunctionDeclaration,
} from "../utils/types.js";
import type {
  Node,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  ArrowFunctionExpression,
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  VariableDeclaration,
  VariableDeclarator,
} from "estree";

type FuncNode =
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunctionExpression;

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
    let exportDefaultNode: ExportDefaultDeclaration | null = null;
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

    function collectScenarioExecNamesFromOptions(node: Node) {
      if (!isExportNamedDeclaration(node)) return;
      const decl = (node as ExportNamedDeclaration)
        .declaration as VariableDeclaration | null;
      if (!decl || decl.type !== "VariableDeclaration") return;
      const first = decl.declarations[0];
      if (!first || !isVariableDeclarator(first)) return;
      if (
        !first.id ||
        (first.id as any).type !== "Identifier" ||
        (first.id as any).name !== "options"
      )
        return;
      const init = first.init as Node | null;
      if (!init || !isObjectExpression(init)) return;

      for (const p of init.properties || []) {
        if (!isProperty(p)) continue;
        const prop = p as any;
        const key = prop.key as Node | null;
        if (
          key &&
          key.type === "Identifier" &&
          key.name === "scenarios" &&
          prop.value &&
          isObjectExpression(prop.value)
        ) {
          const scenariosObj = prop.value;
          for (const s of scenariosObj.properties || []) {
            if (!isProperty(s)) continue;
            const scenarioVal = (s as any).value as Node | null;
            if (!scenarioVal || !isObjectExpression(scenarioVal)) continue;
            for (const sp of scenarioVal.properties || []) {
              if (!isProperty(sp)) continue;
              const skey = (sp as any).key as Node | null;
              if (
                skey &&
                skey.type === "Identifier" &&
                (skey as any).name === "exec"
              ) {
                const sval = (sp as any).value as Node | null;
                if (sval && isLiteral(sval) && typeof sval.value === "string") {
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
      ImportDeclaration(node: Node) {
        if (!isImportDeclaration(node)) return;
        const id = node as ImportDeclaration;
        const source = id.source?.value;
        if (source !== "k6") return;
        for (const spec of id.specifiers || []) {
          if (spec.type === "ImportSpecifier") {
            const importedName = (spec as any).imported?.name;
            const localName = (spec as any).local?.name;
            if (importedName === "check" && localName) {
              checkNames.add(localName);
            }
          } else if (spec.type === "ImportNamespaceSpecifier") {
            if ((spec as any).local?.name) {
              k6NamespaceNames.add((spec as any).local.name);
            }
          }
        }
      },

      // Identify default export function node
      ExportDefaultDeclaration(node: Node) {
        if (!isExportDefaultDeclaration(node)) return;
        const decl = (node as ExportDefaultDeclaration)
          .declaration as Node | null;
        if (isFunctionLike(decl)) {
          defaultFunction = decl;
          exportDefaultNode = node as ExportDefaultDeclaration;
          markTarget(defaultFunction);
        }
      },

      // Collect scenario exec names from options
      ExportNamedDeclaration(node: Node) {
        collectScenarioExecNamesFromOptions(node);
      },

      // Track named function declarations
      FunctionDeclaration(node: FunctionDeclaration) {
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
      FunctionExpression(node: FunctionExpression) {
        funcStack.push(node);
        ensureFuncState(node);
        if (defaultFunction === node) {
          markTarget(node);
        }
      },
      "FunctionExpression:exit"() {
        funcStack.pop();
      },
      ArrowFunctionExpression(node: ArrowFunctionExpression) {
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
      VariableDeclarator(node: VariableDeclarator) {
        if (!isVariableDeclarator(node)) return;
        if (
          (node.id as any)?.type === "Identifier" &&
          node.init &&
          isFunctionLike(node.init)
        ) {
          const fn = node.init as FuncNode;
          funcByName.set((node.id as any).name, fn);
          if (scenarioExecNames.has((node.id as any).name)) {
            markTarget(fn, (node.id as any).name);
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
              node: exportDefaultNode || (defaultFunction as Node),
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
              isFunctionDeclaration(fn) && (fn as FunctionDeclaration).id
                ? (fn as FunctionDeclaration).id
                : (fn as Node);
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
