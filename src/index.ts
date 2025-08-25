import type { Options as EspreeOptions } from "espree";
import * as espree from "espree";
import fs from "fs";
// import { walk } from "estree-walker";
import { Node, Token } from "acorn";
import * as walk from "acorn-walk";

const CODE = "./src/code.js";
const OUTPUT_FOLDER = "./src/out/";
const ESPREE_OPTIONS: EspreeOptions = {
  // Opções do espree
  ecmaVersion: "latest",
  sourceType: "module",
};

function createTree(code: string, output?: string) {
  const ast = espree.parse(code, ESPREE_OPTIONS);

  if (output) {
    fs.writeFileSync(output + "tree.json", JSON.stringify(ast, null, 2));
  }

  return ast;
}

function createTokens(code: string, output?: string): Token[] {
  const tokens = espree.tokenize(code);

  if (output) {
    fs.writeFileSync(output + "tokens.json", JSON.stringify(tokens, null, 2));
  }

  return tokens;
}

function walkOnTree(tree: Node) {
  /* esWalk(tree, {
    enter(node, parent, prop, index) {
      console.log("entrando em");
      console.log(node.type);
    },
    leave(node, parent, prop, index) {
      console.log("saindo de");
      console.log(node.type);
    },
  }); */

  walk.simple(tree, {
    Literal(node) {
      console.log(`Found a literal: ${node.value}`);
    },
    BinaryExpression(node) {
      console.log(`Found a BinaryExpression: ${JSON.stringify(node, null, 2)}`);
    },
    
  });
}

const data = fs.readFileSync(CODE, "utf8");
const tree = createTree(data, OUTPUT_FOLDER);
walkOnTree(tree);
const tokens = createTokens(data, OUTPUT_FOLDER);
