import * as espree from "espree";
import fs from "fs";
import { Node, walk } from "estree-walker";

const CODE = "./src/code.js";
const OUTPUT_FOLDER = "./src/out/";
const ESPREE_OPTIONS: espree.Options = {
  // Opções do espree
  ecmaVersion: "latest",
  sourceType: "module",
};

function create_tree(code: string, output?: string) {
  const ast = espree.parse(code, ESPREE_OPTIONS);

  walk(ast as Node, {
    enter(node, parent, prop, index) {
      console.log("entrando em");
      console.log(node.type);
    },
    leave(node, parent, prop, index) {
      console.log("saindo de");
      console.log(node.type);
    },
  });

  if (output) {
    fs.writeFileSync(output + "tree.json", JSON.stringify(ast, null, 2));
  }

  return ast;
}

const data = fs.readFileSync(CODE, "utf8");
create_tree(data, OUTPUT_FOLDER);
