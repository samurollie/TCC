import { Token } from "acorn";
import * as espree from "espree";
import { saveToFile } from "../utils/file.js";

/**
 * Tokenizes a JavaScript source string using espree and optionally writes the tokens to a JSON file.
 *
 * @param code - The JavaScript source code to tokenize.
 * @param output - Optional path or prefix used when writing the token list to disk.
 *   When provided, a file named `tokens.json` is written to `${output}tokens.json`
 *   containing the pretty-printed JSON representation of the tokens.
 *
 * @returns An array of tokens produced by espree.
 *
 * @remarks
 * - Relies on `espree.tokenize` to produce the tokens.
 * - If `output` is provided, this function has the side effect of writing to the filesystem via `saveToFile`.
 */
export function createTokens(code: string, output?: string): Token[] {
  const tokens = espree.tokenize(code);

  if (output) {
    saveToFile(output + "tokens.json", JSON.stringify(tokens, null, 2));
  }

  return tokens;
}
