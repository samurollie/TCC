import * as espree from "espree";

function create_tree(code) {
  const options = {
    ecmaVersion: "latest",
  };
  const ast = espree.parse(code, options);
  const tokens = espree.tokenize(code, options);
  return JSON.stringify({ tokens, ast }, null, 2);
}

function hello(name = "Samuel") {
  return "Hello " + name + " from JavaScript! 😀";
}

const code = process.argv[2] || "Samuel";
console.log(create_tree(code));
