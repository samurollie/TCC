import * as espree from "espree";
import fs from "fs";
import { openFile } from "./utils/file.js";
import { createTree } from "./ast/tree.js";
import { walkOnTree } from "./ast/walker.js";
import { createTokens } from "./ast/tokens.js";
import { extractMainFunction, extractOptions } from "./ast/extractor.js";

const SCRIPTS_DIR = "./k6-scripts";
const OUTPUT_ROOT = "./src/out/";

const entries = fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true });
const scriptFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name);

for (const filename of scriptFiles) {
  const inputPath = `${SCRIPTS_DIR}/${filename}`;
  const baseName = filename.replace(/\.[^.]+$/, "");
  const outputDir = `${OUTPUT_ROOT}${baseName}/`;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Processing ${filename}`);

  const data = openFile(inputPath);
  const tree = createTree(data, outputDir);
  const tokens = createTokens(data, outputDir);
  const options = extractOptions(tree, outputDir);
  const main = extractMainFunction(tree, outputDir);
}
