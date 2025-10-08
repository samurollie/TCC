import * as espree from "espree";
import fs from "fs";
import { saveToFile } from "../utils/file.js";
import { ESPREE_OPTIONS } from "../config/espree.js";
import { Node } from "acorn";

/**
 * Parses the provided JavaScript source code into an ESTree-compatible AST.
 *
 * This function uses espree with predefined parsing options to produce the AST.
 * If an output path prefix is provided, a pretty-printed JSON representation of
 * the AST is written to `${output}tree.json`.
 *
 * @param code - The JavaScript source code to parse.
 * @param output - Optional file path prefix or directory where the AST JSON file
 *   should be written. The filename `tree.json` is appended automatically.
 * @returns The root AST node representing the parsed source.
 * @throws {SyntaxError} If the source code cannot be parsed by espree.
 * @throws {Error} If saving the AST JSON to disk fails.
 * @example
 * ```ts
 * const ast = createTree('const x = 1;', './out/');
 * // Writes ./out/tree.json and returns the AST
 * ```
 */
export function createTree(code: string, output?: string): Node {
  const ast = espree.parse(code, ESPREE_OPTIONS);

  if (output) {
    saveToFile(output + "tree.json", JSON.stringify(ast, null, 2));
  }

  return ast;
}
