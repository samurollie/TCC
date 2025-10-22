#!/usr/bin/env node
// scripts/scan-repos.js
// Lê k6-scripts/repositorios_k6.csv, clona cada repositório em temp/repos/<owner__repo>,
// executa eslint nos arquivos indicados (relativo ao root do repo), e gera k6-lint-results.csv

import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";
import { parse as csvParse } from "csv-parse/sync";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const csvPath = path.join(workspaceRoot, "k6-scripts", "repositorios_k6.csv");
const tmpDir = path.join(workspaceRoot, "temp", "repos");
const tmpScanDir = path.join(workspaceRoot, "temp", "scan");
const outCsv = path.join(workspaceRoot, "k6-lint-results.csv");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(tmpDir);
ensureDir(tmpScanDir);

let input;
try {
  input = fs.readFileSync(csvPath, "utf8");
} catch (e) {
  console.error(`Falha ao ler CSV ${csvPath}: ${e.message}`);
  process.exit(1);
}
const records = csvParse(input, { columns: true, skip_empty_lines: true });

// build do plugin / workspace para garantir que o plugin está disponível
console.log("Executando build do plugin (npm run build)");
const buildRes = spawnSync("npm", ["run", "build"], {
  cwd: workspaceRoot,
  stdio: "inherit",
});
if (buildRes.status !== 0) {
  console.error("Falha no build. Execute `npm run build` manualmente.");
  process.exit(1);
}

// criar config forçado para aplicar nossas regras sempre
const scanConfigPath = path.join(workspaceRoot, ".scan-eslint-config.json");
const scanConfig = {
  plugins: ["k6-performance"],
  rules: {
    "k6-performance/no-heavy-init-context": "error",
    "k6-performance/require-check": "error",
    "k6-performance/require-tags": "error",
  },
};
try {
  fs.writeFileSync(scanConfigPath, JSON.stringify(scanConfig), "utf8");
} catch (e) {
  console.error(
    "Não foi possível escrever o config temporário para o scan:",
    e.message
  );
  process.exit(1);
}

const rulesOfInterest = [
  "k6-performance/require-tags",
  "k6-performance/require-check",
  "k6-performance/no-heavy-init-context",
];

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [--preview] [--keep-repos] [--limit N]")
  .option("preview", {
    type: "boolean",
    alias: "p",
    description: "Run in preview mode (no cloning, only simulate)",
  })
  .option("limit", {
    type: "number",
    alias: "l",
    description: "Only process first N repositories from the CSV",
  })
  .option("keep-repos", {
    type: "boolean",
    alias: "k",
    description:
      "Preserve cloned repositories under temp/repos AND temp/scan (do not delete at end)",
  })
  .option("verbose", {
    type: "boolean",
    alias: "v",
    description: "Enable verbose logging for file and directory removals",
  })
  .help()
  .alias("h", "help")
  .parseSync();

const PREVIEW = Boolean(
  argv.preview || process.env.PREVIEW === "1" || process.env.PREVIEW === "true"
);
const KEEP_REPOS = Boolean(
  argv["keep-repos"] ||
    process.env.KEEP_REPOS === "1" ||
    process.env.KEEP_REPOS === "true"
);
const VERBOSE = Boolean(
  argv.verbose || process.env.VERBOSE === "1" || process.env.VERBOSE === "true"
);
let LIMIT =
  typeof argv.limit === "number" && !Number.isNaN(argv.limit)
    ? argv.limit
    : undefined;
if ((LIMIT === undefined || LIMIT === null) && process.env.LIMIT)
  LIMIT = Number(process.env.LIMIT);
if (typeof LIMIT !== "undefined") {
  if (!Number.isInteger(LIMIT) || LIMIT < 1) {
    console.error("--limit must be an integer >= 1");
    process.exit(1);
  }
}

// always use local eslint to ensure workspace plugin is used
const localEslintPath = path.join(
  workspaceRoot,
  "node_modules",
  ".bin",
  "eslint"
);

const rows = [];
let processed = 0;
for (const rec of records) {
  if (LIMIT && processed >= LIMIT) break;
  const repo = (rec["repositório"] || rec["repositorio"] || "").trim();
  const url = (rec["url"] || "").trim();
  const arquivosList = (rec["arquivos"] || rec["files"] || "").trim();
  if (!repo || !url) continue;
  const safeName = repo.replace(/\//g, "__");
  const targetDir = path.join(tmpDir, safeName);

  let cloneError = "";
  if (fs.existsSync(targetDir)) {
    console.log(
      `Repositório ${repo} já clonado em ${targetDir}, atualizando...`
    );
    try {
      spawnSync("git", ["-C", targetDir, "pull"], { stdio: "ignore" });
    } catch (e) {
      // ignore
    }
  } else {
    if (PREVIEW) {
      console.log(`[preview] clonaria ${url} -> ${targetDir}`);
    } else {
      console.log(`Clonando ${url} -> ${targetDir}`);
      const res = spawnSync("git", ["clone", "--depth", "1", url, targetDir], {
        stdio: "ignore",
      });
      if (res.status !== 0) {
        cloneError = "clone_failed";
        // register a row indicating clone failed (no specific file)
        const baseRow = {
          repositório: repo,
          url,
          arquivo: "",
          file_exists: false,
          clone_error: cloneError,
        };
        for (const r of rulesOfInterest) baseRow[r] = 0;
        for (const r of rulesOfInterest) baseRow[r + "_loc"] = "";
        rows.push(baseRow);
        continue;
      }
    }
    processed++;
  }

  const arquivos = arquivosList
    ? arquivosList
        .split(/[;|,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (arquivos.length === 0) {
    const baseRow = {
      repositório: repo,
      url,
      arquivo: "",
      file_exists: false,
      clone_error: cloneError,
    };
    for (const r of rulesOfInterest) baseRow[r] = 0;
    for (const r of rulesOfInterest) baseRow[r + "_loc"] = "";
    rows.push(baseRow);
    continue;
  }

  for (const arquivoRel of arquivos) {
    const arquivoPath = path.join(targetDir, arquivoRel);
    const exists = fs.existsSync(arquivoPath);
    if (!exists) {
      const baseRow = {
        repositório: repo,
        url,
        arquivo: arquivoRel,
        file_exists: false,
        clone_error: cloneError,
      };
      for (const r of rulesOfInterest) baseRow[r] = 0;
      for (const r of rulesOfInterest) baseRow[r + "_loc"] = "";
      rows.push(baseRow);
      continue;
    }

    // determine eslint binary
    let eslintBin = fs.existsSync(localEslintPath) ? localEslintPath : "eslint";
    if (!fs.existsSync(eslintBin)) {
      console.error(
        `ESLint não encontrado em ${localEslintPath} nem no PATH. Rode 'npm install' no workspace.`
      );
      process.exit(1);
    }
    if (VERBOSE) console.log(`Usando ESLint: ${eslintBin}`);

    // copy file to tmpScanDir/safeName/... to avoid repo local configs
    const destPath = path.join(tmpScanDir, safeName, arquivoRel);
    ensureDir(path.dirname(destPath));

    try {
      fs.copyFileSync(arquivoPath, destPath);

      const args = [destPath, "--format", "json", "--config", scanConfigPath];
      const res = spawnSync(eslintBin, args, {
        encoding: "utf8",
        cwd: workspaceRoot,
      });
      if (res.error) {
        const baseRow = {
          repositório: repo,
          url,
          arquivo: arquivoRel,
          file_exists: true,
          clone_error: `eslint_error:${res.error.code}`,
        };
        for (const r of rulesOfInterest) baseRow[r] = 0;
        for (const r of rulesOfInterest) baseRow[r + "_loc"] = "";
        rows.push(baseRow);
        continue;
      }
      let json = [];
      try {
        json = JSON.parse(res.stdout || "[]");
      } catch (e) {
        const baseRow = {
          repositório: repo,
          url,
          arquivo: arquivoRel,
          file_exists: true,
          clone_error: `eslint_parse_error`,
        };
        for (const r of rulesOfInterest) baseRow[r] = 0;
        for (const r of rulesOfInterest) baseRow[r + "_loc"] = "";
        rows.push(baseRow);
        continue;
      }

      const ruleFlags = Object.fromEntries(rulesOfInterest.map((r) => [r, 0]));
      const ruleLocs = Object.fromEntries(
        rulesOfInterest.map((r) => [r + "_loc", []])
      );
      for (const fileRes of json) {
        for (const msg of fileRes.messages || []) {
          if (
            msg.ruleId &&
            Object.prototype.hasOwnProperty.call(ruleFlags, msg.ruleId)
          ) {
            ruleFlags[msg.ruleId] = (ruleFlags[msg.ruleId] || 0) + 1;
            const loc = `${msg.line || 0}:${msg.column || 0}`;
            const short = msg.message
              ? `${loc}:${String(msg.message).replace(/\s+/g, " ").trim()}`
              : loc;
            const key = msg.ruleId + "_loc";
            if (ruleLocs[key]) ruleLocs[key].push(short);
          }
        }
      }

      const locStrings = Object.fromEntries(
        Object.keys(ruleLocs).map((k) => [k, ruleLocs[k].join("; ")])
      );
      rows.push({
        repositório: repo,
        url,
        arquivo: arquivoRel,
        file_exists: true,
        clone_error: cloneError,
        ...ruleFlags,
        ...locStrings,
      });
    } finally {
      // remove copied file unless KEEP_REPOS
      try {
        if (!KEEP_REPOS && fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
          if (VERBOSE) console.log(`Removida cópia de arquivo: ${destPath}`);
        }
      } catch (e) {
        console.warn(
          `Falha ao remover cópia de arquivo ${destPath}: ${e.message}`
        );
      }
    }
  }

  // after processing repo files, remove scan repo dir if empty/unused and KEEP_REPOS is false
  try {
    const scanRepoDir = path.join(tmpScanDir, safeName);
    if (!KEEP_REPOS && fs.existsSync(scanRepoDir)) {
      fs.rmSync(scanRepoDir, { recursive: true, force: true });
      if (VERBOSE)
        console.log(`Removido cópia temporária do repo em: ${scanRepoDir}`);
    } else if (KEEP_REPOS && VERBOSE) {
      console.log(`Preservando cópias em: ${scanRepoDir}`);
    }
  } catch (e) {
    console.warn(
      `Falha ao remover cópia temporária do repo ${safeName}: ${e.message}`
    );
  }

  // remove cloned repo unless PREVIEW or KEEP_REPOS
  if (!PREVIEW && !KEEP_REPOS) {
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        if (VERBOSE)
          console.log(`Removido repositório processado: ${targetDir}`);
      }
    } catch (e) {
      console.warn(`Falha ao remover repositório ${targetDir}: ${e.message}`);
    }
  } else if (KEEP_REPOS && VERBOSE) {
    console.log(`Preservando clone em: ${targetDir}`);
  }
}

// escreve CSV
const header = [
  "repositório",
  "url",
  "arquivo",
  "file_exists",
  "clone_error",
  ...rulesOfInterest,
  ...rulesOfInterest.map((r) => r + "_loc"),
];
const out = [header.join(",")];
for (const r of rows) {
  const line = header
    .map((h) => {
      const v = r[h];
      if (typeof v === "number") return String(v);
      if (typeof v === "boolean") return v ? "true" : "false";
      if (v === undefined) return "";
      return `"${String(v).replace(/"/g, '""')}"`;
    })
    .join(",");
  out.push(line);
}
fs.writeFileSync(outCsv, out.join(os.EOL), "utf8");
console.log(`Relatório gerado: ${outCsv}`);

// limpeza de config temporário
try {
  if (fs.existsSync(scanConfigPath)) {
    fs.unlinkSync(scanConfigPath);
    if (VERBOSE) console.log(`Removido config temporário: ${scanConfigPath}`);
  }
} catch (e) {
  console.warn(`Falha ao remover ${scanConfigPath}: ${e.message}`);
}

// remover tmpScanDir somente se KEEP_REPOS false
try {
  if (!KEEP_REPOS && fs.existsSync(tmpScanDir)) {
    fs.rmSync(tmpScanDir, { recursive: true, force: true });
    if (VERBOSE)
      console.log(`Removido diretório de cópias temporárias: ${tmpScanDir}`);
  } else if (KEEP_REPOS && VERBOSE) {
    console.log(`Preservando diretório de cópias temporárias: ${tmpScanDir}`);
  }
} catch (e) {
  console.warn(`Falha ao remover ${tmpScanDir}: ${e.message}`);
}

// remover tmpDir (clones) somente se KEEP_REPOS false
try {
  if (!KEEP_REPOS && fs.existsSync(tmpDir)) {
    // somente remover se estiver vazio ou for seguro
    // optamos por remover inteiro para liberar espaço
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (VERBOSE)
      console.log(`Removido diretório de repositórios clonados: ${tmpDir}`);
  } else if (KEEP_REPOS && VERBOSE) {
    console.log(`Preservando diretório de repositórios clonados: ${tmpDir}`);
  }
} catch (e) {
  console.warn(`Falha ao remover ${tmpDir}: ${e.message}`);
}
