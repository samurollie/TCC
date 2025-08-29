import * as espree from "espree";
import fs from "fs";
import { saveToFile } from "../utils/file.js";
import { ESPREE_OPTIONS } from "../config/espree.js";

export function createTree(code: string, output?: string) {
  const ast = espree.parse(code, ESPREE_OPTIONS);

  if (output) {
    saveToFile(output + "tree.json", JSON.stringify(ast, null, 2));
  }

  return ast;
}
