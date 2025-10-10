import fs from "fs";
import { openFile } from "./utils/file.js";
import { createTree } from "./ast/tree.js";
import { createTokens } from "./ast/tokens.js";
import {
  extractDefaultTestFunction,
  extractInitContext,
  extractOptions,
  extractSetupFunction,
  extractTeardownFunction,
} from "./ast/extractor.js";

const SCRIPTS_DIR = "./k6-scripts";
const OUTPUT_ROOT = "./src/out/";

function main() {
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

    //Opens input file
    const data = openFile(inputPath);

    //Create tree object
    const tree = createTree(data, outputDir);
    const tokens = createTokens(data, outputDir);

    //Extract test lifecycle functions
    const initContext = extractInitContext(tree, outputDir);
    const options = extractOptions(tree, outputDir);
    const setup = extractSetupFunction(tree, outputDir);
    const teardown = extractTeardownFunction(tree, outputDir);
    const main = extractDefaultTestFunction(tree, outputDir);

    //Smell detections
    // const magicNumbers = magicNumbersDetector({ tree, output: outputDir });

    //Generate report
  }
}

main();
