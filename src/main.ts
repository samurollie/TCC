import * as espree from "espree";
import fs from "fs";
import { openFile } from "./utils/file.js";
import { createTree } from "./ast/tree.js";
import { walkOnTree } from "./ast/walker.js";
import { createTokens } from "./ast/tokens.js";
import {
  extractMainFunction,
  extractOptions,
  extractMagicNumbers,
  generateSmellsCSV,
} from "./ast/extractor.js";

const SCRIPTS_DIR = "./k6-scripts";
const OUTPUT_ROOT = "./src/out/";

const entries = fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true });
const scriptFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name);

// Collect all smells across all files
const allSmells: any[] = [];

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
  const magicNumbers = extractMagicNumbers(tree, outputDir);

  // Convert magic numbers to smell findings for CSV
  magicNumbers.forEach((finding) => {
    allSmells.push({
      type: "Magic Number",
      message: finding.message,
      line: finding.loc?.start?.line || 0,
      column: finding.loc?.start?.column || 0,
      value: finding.value.toString(),
      context: `File: ${filename}, Parent: ${finding.parentType}`,
    });
  });
}

// Generate CSV with all smells found
generateSmellsCSV(allSmells, OUTPUT_ROOT);
