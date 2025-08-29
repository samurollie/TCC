import { Token } from "acorn";
import * as espree from "espree";
import { saveToFile } from "../utils/file.js";

export function createTokens(code: string, output?: string): Token[] {
  const tokens = espree.tokenize(code);

  if (output) {
    saveToFile(output + "tokens.json", JSON.stringify(tokens, null, 2));
  }

  return tokens;
}
