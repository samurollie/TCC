import type { Options as EspreeOptions } from "espree";
import * as espree from "espree";
import fs from "fs";
import { Node, walk } from "estree-walker";
import { Token } from "acorn";

const CODE = "./src/code.js";
const OUTPUT_FOLDER = "./src/out/";
const ESPREE_OPTIONS: EspreeOptions = {
  // Opções do espree
  ecmaVersion: "latest",
  sourceType: "module",
};

function createTree(code: string, output?: string): Node {
  const ast = espree.parse(code, ESPREE_OPTIONS);

  if (output) {
    fs.writeFileSync(output + "tree.json", JSON.stringify(ast, null, 2));
  }

  return ast as Node;
}

function createTokens(code: string, output?: string): Token[] {
  const tokens = espree.tokenize(code);

  if (output) {
    fs.writeFileSync(output + "tokens.json", JSON.stringify(tokens, null, 2));
  }

  return tokens;
}

function walkOnTree(tree: Node) {
  walk(tree, {
    enter(node, parent, prop, index) {
      console.log("entrando em");
      console.log(node.type);
    },
    leave(node, parent, prop, index) {
      console.log("saindo de");
      console.log(node.type);
    },
  });
}

const data = fs.readFileSync(CODE, "utf8");
const tree = createTree(data, OUTPUT_FOLDER);
walkOnTree(tree);
const tokens = createTokens(data, OUTPUT_FOLDER);
