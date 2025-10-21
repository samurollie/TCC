import { Rule } from "eslint";
// Função utilitária para extrair chamadas http.get/post/etc
import {
  isHttpMemberCall,
  isK6CheckMember,
  isCheckIdentifier,
  collectScenarioExecNamesFromOptionsExport,
} from "../utils/ast-helpers.js";
import {
  isVariableDeclarator,
  isIdentifier,
  isLiteral as isLit,
} from "../utils/types.js";

/**
 * Regra: feature-envy-tags
 * Detecta múltiplas requisições HTTP distintas sem uso de tags únicas.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Detecta requisições HTTP sem tags únicas (Feature Envy)",
      category: "Best Practices",
      recommended: false,
    },
    messages: {
      missingTags:
        'Requisição HTTP para "{{endpoint}}" sem tag única (name) no parâmetro tags.',
      duplicateTag:
        'Tag "{{tagName}}" usada em múltiplos endpoints. Use tags únicas para cada endpoint.',
    },
    schema: [],
  },
  create(context) {
    const endpointTags: Record<string, string | undefined> = {};
    const usedTags: Record<string, string[]> = {};
    const missingNodes: Array<{
      node: any;
      endpoint: string;
      repeat?: boolean;
    }> = [];
    // dedupe by node identity (so distinct calls to same URL are counted separately)
    const missingNodeSet = new WeakSet<any>();
    const variableToHttpNode: Record<string, any> = {};
    return {
      CallExpression(node) {
        const isHttpCall = isHttpMemberCall(node);

        // detect `check(...)` (identifier) or `k6.check(...)` (member)
        const calleeNode = node.callee;
        const checkNames = new Set(["check"]);
        const isCheckCall =
          isK6CheckMember(calleeNode, new Set(["k6"])) ||
          isCheckIdentifier(calleeNode, checkNames);

        if (!isHttpCall && !isCheckCall) return;

        const args = node.arguments;
        if (!args) return;

        // Extrai endpoint/label
        let endpoint = isHttpCall ? "http" : "check";
        if (
          isHttpCall &&
          args[0] &&
          args[0].type === "Literal" &&
          typeof (args[0] as any).value === "string"
        ) {
          endpoint = (args[0] as any).value;
        }

        // Se for um check(), tente mapear o primeiro argumento (resposta) para o http node
        // correspondente (ex.: check(r1, ...), onde r1 foi atribuído de http.get(...)).
        let httpNodeForThisCall: any = undefined;
        if (!isHttpCall && isCheckCall) {
          const firstArg = args[0];
          if (firstArg && firstArg.type === "Identifier") {
            const name = (firstArg as any).name;
            if (name && variableToHttpNode[name]) {
              httpNodeForThisCall = variableToHttpNode[name];
              // if we can extract endpoint string from the http node, prefer it
              try {
                const first =
                  httpNodeForThisCall.arguments &&
                  httpNodeForThisCall.arguments[0];
                if (
                  first &&
                  first.type === "Literal" &&
                  typeof first.value === "string"
                ) {
                  endpoint = first.value;
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }

        // se chamada http for atribuída a variável, registra mapping var->endpoint
        if (isHttpCall) {
          const parent: any = (node as any).parent;
          if (
            parent &&
            isVariableDeclarator(parent) &&
            parent.id &&
            isIdentifier(parent.id)
          ) {
            variableToHttpNode[parent.id.name] = node;
          }
        }

        // options: http -> args[1], check -> args[2]
        const optionsArg = isHttpCall ? args[1] : args[2];
        let options: any =
          optionsArg && optionsArg.type === "ObjectExpression"
            ? optionsArg
            : undefined;
        let tagName: string | undefined;
        if (options) {
          const tagsProp = options.properties.find(
            (p: any) => p.key && p.key.name === "tags"
          );
          if (
            tagsProp &&
            tagsProp.value &&
            tagsProp.value.type === "ObjectExpression"
          ) {
            const nameProp = tagsProp.value.properties.find(
              (np: any) => np.key && np.key.name === "name"
            );
            if (
              nameProp &&
              nameProp.value &&
              nameProp.value.type === "Literal" &&
              typeof nameProp.value.value === "string"
            ) {
              tagName = nameProp.value.value;
            }
          }
        }

        if (tagName) {
          endpointTags[endpoint] = tagName;
          if (!usedTags[tagName]) usedTags[tagName] = [];
          usedTags[tagName].push(endpoint);
        } else {
          // acumula nós sem tag; evita duplicatas por node (http + check pair)
          const dedupeNode = httpNodeForThisCall || node;
          if (!missingNodeSet.has(dedupeNode)) {
            // detect if this call is inside a loop (for/while/for..in/for..of)
            let p = dedupeNode.parent;
            let inLoop = false;
            while (p) {
              if (
                p.type === "ForStatement" ||
                p.type === "WhileStatement" ||
                p.type === "ForInStatement" ||
                p.type === "ForOfStatement"
              ) {
                inLoop = true;
                break;
              }
              p = p.parent;
            }
            missingNodes.push({ node: dedupeNode, endpoint, repeat: inLoop });
            missingNodeSet.add(dedupeNode);
          }
        }
      },
      "Program:exit"() {
        // agrupa missingNodes por escopo (default/function/global)
        const byScope: Record<
          string,
          Array<{ node: any; endpoint: string; repeat?: boolean }>
        > = {};
        for (const m of missingNodes) {
          // descobrir scope subindo a árvore
          let scope = "global";
          let parent: any = m.node.parent;
          while (parent) {
            if (parent.type === "ExportDefaultDeclaration") {
              scope = "default";
              break;
            }
            if (
              parent.type === "FunctionDeclaration" &&
              parent.id &&
              parent.id.name
            ) {
              scope = parent.id.name;
              break;
            }
            parent = parent.parent;
          }
          if (!byScope[scope]) byScope[scope] = [];
          byScope[scope].push(m);
        }

        // reporta se houver >1 por escopo ou se alguma chamada estiver marcada como repeat (ex.: dentro de loop)
        for (const [scope, arr] of Object.entries(byScope)) {
          const shouldReport = arr.length > 1 || arr.some((x) => x.repeat);
          if (shouldReport) {
            for (const m of arr) {
              context.report({
                node: m.node,
                messageId: "missingTags",
                data: { endpoint: m.endpoint },
              });
            }
          }
        }

        // Verifica tags duplicadas
        (Object.entries(usedTags) as [string, string[]][]).forEach(
          ([tagName, endpoints]) => {
            if (endpoints.length > 1) {
              endpoints.forEach((endpoint: string) => {
                const nodeEntry = Object.entries(endpointTags).find(
                  ([ep, tag]) => ep === endpoint && tag === tagName
                );
                if (nodeEntry) {
                  context.report({
                    node: context.sourceCode.ast,
                    messageId: "duplicateTag",
                    data: { tagName },
                  });
                }
              });
            }
          }
        );
      },
    };
  },
};

export default rule;
