import { Rule } from "eslint";
// Função utilitária para extrair chamadas http.get/post/etc
import { isHttpMemberCall } from "../utils/ast-helpers.js";

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

    return {
      CallExpression(node) {
        // Detecta chamadas http.get/post/etc
        if (!isHttpMemberCall(node)) return;

        const args = node.arguments;
        if (!args || args.length < 1) return;
        // Extrai endpoint
        let endpoint = "";
        if (args[0].type === "Literal" && typeof args[0].value === "string") {
          endpoint = args[0].value;
        }
        // Extrai options
        let options: any =
          args[1] && args[1].type === "ObjectExpression" ? args[1] : undefined;
        let tagName: string | undefined;
        if (options) {
          const tagsProp = options.properties.find(
            (p: any) => p.key && p.key.name === "tags"
          );
          if (tagsProp && tagsProp.value.type === "ObjectExpression") {
            const nameProp = tagsProp.value.properties.find(
              (np: any) => np.key && np.key.name === "name"
            );
            if (
              nameProp &&
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
          context.report({
            node,
            messageId: "missingTags",
            data: { endpoint },
          });
        }
      },
      "Program:exit"() {
        // Verifica tags duplicadas
        (Object.entries(usedTags) as [string, string[]][]).forEach(
          ([tagName, endpoints]) => {
            if (endpoints.length > 1) {
              endpoints.forEach((endpoint: string) => {
                // Reporta no primeiro nó encontrado para o endpoint
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
