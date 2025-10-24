import { Rule } from "eslint";
import { isExportNamedDeclaration } from "../utils/types.js";
import { findAncestor } from "../utils/ast-helpers.js";

/**
 * Regra: require-thresholds
 * Verifica se existe export named `options` com propriedade `thresholds` definida.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Garante que 'options' export contenha a seção 'thresholds'",
      category: "Best Practices",
      recommended: false,
    },
    messages: {
      missingThresholds:
        "Export 'options' não contém uma seção 'thresholds'. Defina thresholds para que o k6 possa falhar quando SLOs não forem atendidos.",
    },
    schema: [],
  },
  create(context) {
    // helpers
    const isIdentifier = (n: any, name: string) =>
      n && n.type === "Identifier" && n.name === name;
    const propKeyName = (p: any) => {
      try {
        if (!p || !p.key) return null;
        return p.key.name || p.key.value || null;
      } catch (e) {
        return null;
      }
    };
    const findVarDeclarator = (root: any, name: string) => {
      const body = root.body || [];
      for (const node of body) {
        if (node.type === "VariableDeclaration") {
          for (const d of node.declarations || []) {
            if (d.id && d.id.type === "Identifier" && d.id.name === name)
              return d;
          }
        }
        // also handle export declarations that re-export variables: export { options }
        if (node.type === "ExportNamedDeclaration" && node.specifiers) {
          for (const s of node.specifiers || []) {
            if (s.exported && s.exported.name === name) {
              // try to find the original declarator
              for (const n2 of body) {
                if (n2.type === "VariableDeclaration") {
                  for (const d of n2.declarations || [])
                    if (d.id && d.id.name === name) return d;
                }
              }
            }
          }
        }
      }
      return null;
    };

    const thresholdsIsNonEmpty = (thNode: any) => {
      if (!thNode) return false;
      if (thNode.type !== "ObjectExpression") return false;
      const props = thNode.properties || [];
      if (props.length === 0) return false;
      // if every prop's value is an ArrayExpression with zero elements, treat as empty
      const hasNonEmpty = props.some((p: any) => {
        const v = p.value;
        if (!v) return true; // if value not array literal, consider non-empty
        if (v.type === "ArrayExpression") return (v.elements || []).length > 0;
        return true;
      });
      return hasNonEmpty;
    };

    const inspectObjectForThresholds = (objNode: any) => {
      if (!objNode || objNode.type !== "ObjectExpression") return false;
      for (const p of objNode.properties || []) {
        const key = propKeyName(p);
        if (key === "thresholds") {
          return thresholdsIsNonEmpty(p.value);
        }
        // also support nested options: module.exports = { options: { thresholds: ... } }
        if (
          key === "options" &&
          p.value &&
          p.value.type === "ObjectExpression"
        ) {
          for (const p2 of p.value.properties || []) {
            if (propKeyName(p2) === "thresholds")
              return thresholdsIsNonEmpty(p2.value);
          }
        }
      }
      return false;
    };

    return {
      Program(programNode: any) {
        // On program exit we can inspect top-level declarations
        // Check for export named declaration of options with literal
        const root = programNode;
        // 1) export const options = { ... }
        for (const node of root.body || []) {
          if (
            node.type === "ExportNamedDeclaration" &&
            node.declaration &&
            node.declaration.type === "VariableDeclaration"
          ) {
            for (const d of node.declaration.declarations || []) {
              if (
                d.id &&
                d.id.type === "Identifier" &&
                d.id.name === "options"
              ) {
                if (
                  !d.init ||
                  d.init.type !== "ObjectExpression" ||
                  !inspectObjectForThresholds(d.init)
                ) {
                  context.report({ node: d, messageId: "missingThresholds" });
                }
              }
            }
          }
        }
      },

      AssignmentExpression(node: any) {
        try {
          const left = node.left;
          const right = node.right;
          // module.exports = {...}
          if (
            left &&
            left.type === "MemberExpression" &&
            left.object &&
            left.object.name === "module" &&
            left.property &&
            left.property.name === "exports"
          ) {
            if (right && right.type === "ObjectExpression") {
              // check right for thresholds or options.thresholds
              if (!inspectObjectForThresholds(right)) {
                context.report({ node: right, messageId: "missingThresholds" });
              }
            }
          }
          // module.exports.options = {...} or exports.options = {...}
          if (
            left &&
            left.type === "MemberExpression" &&
            left.property &&
            left.property.name === "options"
          ) {
            if (right && right.type === "ObjectExpression") {
              if (!inspectObjectForThresholds(right)) {
                context.report({ node: right, messageId: "missingThresholds" });
              }
            }
          }
        } catch (e) {
          /* ignore */
        }
      },

      // handle export { options } and variable later declared
      ExportNamedDeclaration(node: any) {
        if (node.specifiers && node.specifiers.length > 0) {
          for (const s of node.specifiers) {
            if (s.exported && s.exported.name === "options") {
              // find variable declarator
              const prog = context.getSourceCode().ast as any;
              const d = findVarDeclarator(prog, "options");
              if (d) {
                if (
                  !d.init ||
                  d.init.type !== "ObjectExpression" ||
                  !inspectObjectForThresholds(d.init)
                ) {
                  context.report({ node: d, messageId: "missingThresholds" });
                }
              }
            }
          }
        }
      },
    };
  },
};

export default rule;
