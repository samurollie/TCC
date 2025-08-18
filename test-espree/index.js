import * as espree from "espree";

const code = `function main() {
  //let i = 0;
  var name = "Samuel"
  console.log("Hello World!" + i + name);
}
`;

const ast = espree.parse(code);
const tokens = espree.tokenize(code);

console.log(code);
console.log(ast);
console.log(tokens);
