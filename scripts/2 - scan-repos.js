#!/usr/bin/env node
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { spawnSync } from "child_process";
import { parse } from "csv-parse/sync";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { ESLint } from "eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

function ensureDir(dir) {
  try {
    fsSync.mkdirSync(dir, { recursive: true });
  } catch (e) {}
}
function safeName(s) {
  return String(s || "")
    .replace(/[:@/\\.]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("preview", { alias: "p", type: "boolean" })
    .option("limit", { alias: "l", type: "number" })
    .option("keep-repos", { alias: "k", type: "boolean" })
    .option("verbose", { alias: "v", type: "boolean" })
    .option("summary", { type: "boolean" })
    .option("debug", { type: "boolean" })
    .help()
    .parse();
  const PREVIEW = Boolean(argv.preview);
  const LIMIT =
    argv.limit && Number.isInteger(argv.limit) && argv.limit > 0
      ? argv.limit
      : undefined;
  const DEBUG = Boolean(argv.debug);
  const VERBOSE = Boolean(argv.verbose) || DEBUG;
  const SUMMARY = Boolean(argv.summary);
  const KEEP_REPOS = Boolean(argv["keep-repos"]);

  const csvPath = path.join(
    workspaceRoot,
    "scripts",
    "output",
    "repositorios_k6.csv"
  );
  const tempRoot = path.join(workspaceRoot, "temp");
  const tempRepos = path.join(tempRoot, "repos");
  const tempScan = path.join(tempRoot, "scan");
  ensureDir(tempRepos);
  ensureDir(tempScan);

  // logging helpers with local timezone ISO-like timestamp (with offset)
  function formatLocalISO(d = new Date()) {
    const pad = (n, z = 2) => String(n).padStart(z, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    const offsetMin = -d.getTimezoneOffset(); // minutes ahead of UTC
    const sign = offsetMin >= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMin);
    const offH = pad(Math.floor(absMin / 60));
    const offM = pad(absMin % 60);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${offH}:${offM}`;
  }
  const timePrefix = () => `[${formatLocalISO()}]`;
  const log = (...args) => console.log(timePrefix(), ...args);
  const error = (...args) => console.error(timePrefix(), ...args);
  const warn = (...args) => console.warn(timePrefix(), ...args);
  const dump = (obj, opts) =>
    console.dir(obj, { ...(opts || {}), depth: opts?.depth ?? 2 });

  if (VERBOSE) log("workspaceRoot", workspaceRoot);
  if (VERBOSE) log("building plugin");
  spawnSync("npm", ["run", "build"], {
    cwd: workspaceRoot,
    stdio: VERBOSE ? "inherit" : "ignore",
  });
  const distPlugin = path.join(workspaceRoot, "dist", "index.js");
  if (!fsSync.existsSync(distPlugin)) {
    error("plugin dist missing");
    process.exit(1);
  }
  const pluginModule = await import(pathToFileURL(distPlugin).href);
  const plugin = pluginModule.default || pluginModule;

  const csvRaw = await fs.readFile(csvPath, "utf8");
  const records = parse(csvRaw, { columns: true, skip_empty_lines: true });
  if (VERBOSE) log("rows", records.length);

  // detect rules from the compiled plugin automatically
  const pluginName = "k6-performance";
  const pluginRuleKeys =
    plugin && plugin.rules ? Object.keys(plugin.rules) : [];
  const rules = pluginRuleKeys.map((r) => `${pluginName}/${r}`);
  if (rules.length === 0) {
    // fallback to none and warn
    if (VERBOSE)
      warn(
        "No rules detected in plugin; scanner will still run but report no rule columns."
      );
  }
  const eslint = new ESLint({
    overrideConfig: {
      plugins: { [pluginName]: plugin },
      rules: Object.fromEntries(rules.map((r) => [r, "error"])),
    },
  });

  const limit = LIMIT || records.length;
  const outRows = [];

  for (let i = 0; i < Math.min(limit, records.length); i++) {
    const rec = records[i];
    const repoName = rec.repositório || rec.repositorio || rec.repo || "";
    const url = rec.url || rec.URL || rec.link || "";
    const arquivos = String(rec.arquivos || rec.files || "")
      .split(/\s*;\s*|\s*,\s*/)
      .filter(Boolean);
    const safe = safeName(url || repoName || `repo_${i}`);
    const repoPath = path.join(tempRepos, safe);

    if (VERBOSE) log(`\n[${i + 1}/${limit}] ${repoName} ${url} -> ${safe}`);

    let cloneError = "";
    try {
      if (!PREVIEW) {
        if (fsSync.existsSync(path.join(repoPath, ".git"))) {
          if (VERBOSE) log("Repo exists, pulling", repoPath);
          const pull = spawnSync("git", ["-C", repoPath, "pull"], {
            stdio: VERBOSE ? "inherit" : "ignore",
          });
          if (pull.status !== 0) {
            cloneError = `git pull failed (status ${pull.status})`;
            if (VERBOSE) console.error(cloneError);
          }
        } else {
          if (VERBOSE) log("Cloning", url, "->", repoPath);
          const res = spawnSync(
            "git",
            ["clone", "--depth", "1", url, repoPath],
            { stdio: VERBOSE ? "inherit" : "ignore" }
          );
          if (res.status !== 0) {
            cloneError = `git clone failed (status ${res.status})`;
            if (VERBOSE) error(cloneError);
          } else if (VERBOSE) log("Clone completed for", url || repoName);
        }
      } else if (VERBOSE) log("[preview] skip clone");
    } catch (e) {
      cloneError = String(e && e.message ? e.message : e);
      if (VERBOSE) error("Clone error", cloneError);
    }

    if (arquivos.length === 0) {
      const empty = {
        repositório: repoName,
        url,
        arquivo: "",
        file_exists: "no",
        clone_error: cloneError,
      };
      for (const r of rules) {
        empty[r] = 0;
        empty[`${r}_loc`] = "";
      }
      outRows.push(empty);
      continue;
    }

    for (const arquivoRel of arquivos) {
      const src = path.join(repoPath, arquivoRel);
      const exists = fsSync.existsSync(src);
      const row = {
        repositório: repoName,
        url,
        arquivo: arquivoRel,
        file_exists: exists ? "yes" : "no",
        clone_error: cloneError,
      };
      for (const r of rules) {
        row[r] = 0;
        row[`${r}_loc`] = "";
      }
      if (!exists) {
        outRows.push(row);
        continue;
      }

      const destDir = path.join(tempScan, safe);
      ensureDir(destDir);
      const dest = path.join(destDir, path.basename(arquivoRel));
      if (VERBOSE) log("Copying", src, "->", dest);
      try {
        await fs.copyFile(src, dest);
      } catch (e) {
        if (VERBOSE) error("copy failed", e);
        outRows.push(row);
        continue;
      }

      try {
        if (VERBOSE) log("Linting", dest);
        const results = await eslint.lintFiles([dest]);
        if (VERBOSE)
          log(`ESLint returned ${results.length} result(s) for ${dest}`);
        for (const res of results) {
          if (VERBOSE)
            log(
              `  file: ${res.filePath} - ${res.errorCount || 0} errors, ${
                res.warningCount || 0
              } warnings`
            );
          for (const msg of res.messages || []) {
            const rid = msg.ruleId || null;
            const loc = `${msg.line || 0}:${msg.column || 0}`;
            if (rid && rules.includes(rid)) {
              row[rid] = (row[rid] || 0) + 1;
              row[`${rid}_loc`] = row[`${rid}_loc`]
                ? `${row[`${rid}_loc`]}; ${loc}`
                : loc;
              if (VERBOSE) log(`    ${rid} at ${loc}: ${msg.message}`);
            } else if (VERBOSE)
              log(`    ${msg.ruleId || "<no-rule>"} at ${loc}: ${msg.message}`);
          }
        }
        if (DEBUG) dump(results, { depth: null });
      } catch (e) {
        if (VERBOSE || DEBUG) error("ESLint error", e);
      } finally {
        if (SUMMARY) {
          const issues =
            rules
              .filter((r) => row[r] > 0)
              .map(
                (r) =>
                  `${r}=${row[r]}${
                    row[`${r}_loc`] ? `(${row[`${r}_loc`]})` : ""
                  }`
              )
              .join("; ") || "none";
          log(
            `[${i + 1}/${limit}] ${repoName} ${arquivoRel} exists=${
              exists ? "yes" : "no"
            } issues=${issues}`
          );
        }
        if (!KEEP_REPOS) {
          try {
            await fs.unlink(dest);
          } catch (e) {
            if (VERBOSE) warn("unlink failed", dest, e);
          }
        } else if (VERBOSE) console.log("Preserving scan copy at", dest);
      }

      outRows.push(row);
    }

    if (!KEEP_REPOS && !PREVIEW) {
      try {
        fsSync.rmSync(repoPath, { recursive: true, force: true });
        if (VERBOSE) log("Removed repo", repoPath);
      } catch (e) {
        if (VERBOSE) error("rm failed", e);
      }
    } else if (VERBOSE && KEEP_REPOS) log("Preserving repo", repoPath);
  }

  const header = [
    "repositório",
    "url",
    "arquivo",
    "file_exists",
    "clone_error",
    ...rules.flatMap((r) => [r, `${r}_loc`]),
  ];
  const lines = [header.join(",")];
  for (const r of outRows) {
    lines.push(
      header
        .map((h) => {
          const v = r[h];
          if (v === undefined || v === null) return "";
          const s = String(v);
          if (s.includes(",") || s.includes('"'))
            return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    );
  }
  const outCsv = path.join(workspaceRoot, "k6-lint-results.csv");
  await fs.writeFile(outCsv, lines.join("\n"), "utf8");
  log("Wrote", outCsv);

  if (!KEEP_REPOS) {
    try {
      fsSync.rmSync(tempRoot, { recursive: true, force: true });
      if (VERBOSE) log("Removed temp root", tempRoot);
    } catch (e) {
      if (VERBOSE) error("cleanup failed", e);
    }
  } else if (VERBOSE) {
    log("Preserved temp at", tempRoot);
    log("Preserved repos at", tempRepos);
    log("Preserved scans at", tempScan);
  }
}

main().catch((e) => {
  // 'error' is defined inside main(); use console.error here to avoid ReferenceError
  console.error("Fatal", e);
  process.exit(2);
});
