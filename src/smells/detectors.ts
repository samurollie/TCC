import { Node, Literal } from "acorn";
import * as walk from "acorn-walk";
import { saveToFile } from "../utils/file.js";
import { Smell } from "../utils/types.js";

export function magicNumbersDetector({
  tree,
  output,
}: {
  tree: Node;
  output?: string;
}): Smell[] {
  const findings: Smell[] = [];

  // Collect numeric literals that are likely magic numbers
  walk.ancestor(tree, {
    Literal(node: Literal, _, ancestors: any[]) {
      if (typeof node.value !== "number") return;

      // Ignore very common sentinel values
      if (node.value === 0 || node.value === 1 || node.value === -1) return;

      const parent =
        ancestors.length > 1 ? ancestors[ancestors.length - 2] : null;

      // Heuristics to ignore some non-problematic cases
      // - Object property keys like { 404: "Not Found" }
      if (parent && parent.type === "Property" && parent.key === node) return;

      // - Exported options duration strings are not numbers; safe
      // - Array lengths and such are still potential magic numbers → keep
      const line = node.loc?.start?.line || 0;
      const column = node.loc?.start?.column || 0;
      const message = `Magic Number detected: '${node.value}' at line ${line}, column ${column}. Consider using a named constant to explain what this number represents.`;

      findings.push({
        value: node.value,
        raw: node.raw,
        parentType: parent?.type,
        // loc: node.loc,
        message,
      });
    },
  });

  if (output) {
    // Save human-readable messages
    const messages = findings.map((f) => f.message);
    saveToFile(output + "magic-numbers-messages.txt", messages.join("\n\n"));

    // Save detailed JSON for debugging
    saveToFile(
      output + "magic-numbers.json",
      JSON.stringify(findings, null, 2)
    );
  }

  return findings;
}
