import { walk as esWalk } from "estree-walker";
import { Node, Token } from "acorn";
import * as walk from "acorn-walk";
import * as esquery from "esquery";

export function walkOnTree(tree: Node) {
  /*   esWalk(tree, {
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
  walk.full(tree, (node, state, type) => {
    console.log(node.type);
    console.log(state);
    console.log(type);
  });
  walk.ancestor(tree, {
    Literal(node, _state, ancestors) {
      console.log(`Found a literal: ${node.value}`);
      console.log(`ancestors:`);
      console.log(ancestors);
    },
  });
}
