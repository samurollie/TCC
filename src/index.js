import * as espree from "espree";
import fs from "fs";

const CODE = "./src/code.js";
const OUTPUT_FILE = "./src/output.json";
const ESPREE_OPTIONS = { // Opções do espree
  ecmaVersion: "latest",
};

function create_tree(code, output = undefined) {
  const ast = espree.parse(code, ESPREE_OPTIONS);

  if (output) {
    fs.writeFileSync(output, JSON.stringify(ast, null, 2));
  }

  return ast;
}

const data = fs.readFileSync(CODE, "utf8");
create_tree(data, OUTPUT_FILE);
