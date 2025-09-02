import * as espree from "espree";
import fs from "fs";
import { openFile } from "./utils/file.js";
import { createTree } from "./ast/tree.js";
import { walkOnTree } from "./ast/walker.js";
import { createTokens } from "./ast/tokens.js";
import { extractMainFunction, extractOptions } from "./ast/extractor.js";

const CODE = "./src/code.js";
const OUTPUT_FOLDER = "./src/out/";

const data = openFile(CODE);
const tree = createTree(data, OUTPUT_FOLDER);
const tokens = createTokens(data, OUTPUT_FOLDER);
const options = extractOptions(tree, OUTPUT_FOLDER);
const main = extractMainFunction(tree, OUTPUT_FOLDER);
