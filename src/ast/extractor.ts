import { Node } from "acorn";
import * as walk from "acorn-walk";
import { saveToFile } from "../utils/file.js";

export function extractOptions(tree: Node, output?: string) {
  let optionsNode: Node | null = null;

  walk.simple(tree, {
    VariableDeclarator(node: any) {
      if (node.id.name === "options") {
        optionsNode = node;
      }
    },
  });

  if (output) {
    saveToFile(output + "options.json", JSON.stringify(optionsNode, null, 2));
  }

  return optionsNode;
}
