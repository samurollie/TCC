#!/usr/bin/env python3
import csv
import os
import subprocess
import tempfile
import shutil
import time

# Config
MAX_N = 3
CLONE_TIMEOUT = 5 * 60  # seconds
REPOS_CSV = "repositorios_k6.csv"
# fallback: o CSV às vezes está em `scripts/repositorios_k6.csv`
if not os.path.exists(REPOS_CSV):
    alt = os.path.join(os.path.dirname(__file__), "repositorios_k6.csv")
    if os.path.exists(alt):
        REPOS_CSV = alt
LOG_DIR = "clone_logs"
RESULT_CSV = "clone_test_results.csv"

os.makedirs(LOG_DIR, exist_ok=True)


def count_lines_in_tree(path):
    total = 0
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d != ".git"]
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "rb") as fh:
                    head = fh.read(1024)
                    if b"\x00" in head:
                        continue
                count = 0
                with open(fpath, "rb") as fh:
                    for chunk in iter(lambda: fh.read(8192), b""):
                        count += chunk.count(b"\n")
                total += count
            except Exception:
                continue
    return total


def read_repos(csv_path, n):
    repos = []
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    with open(csv_path, newline="", encoding="utf-8") as fh:
        rdr = csv.DictReader(fh)
        for row in rdr:
            repos.append(row)
            if len(repos) >= n:
                break
    return repos


def sanitize_filename(name):
    return name.replace("/", "__").replace(":", "_")


def main():
    print(f"Reading up to {MAX_N} repos from {REPOS_CSV}...")
    repos = read_repos(REPOS_CSV, MAX_N)
    results = []

    for row in repos:
        repo_full = row.get("repositório") or row.get("repository")
        if not repo_full:
            print(f"Skipping row without 'repositório' field: {row}")
            continue
        owner_repo = repo_full.strip()
        owner, repo_name = owner_repo.split("/")
        clone_url = f"git@github.com:{owner}/{repo_name}.git"
        tmpdir = tempfile.mkdtemp(prefix="repo_clone_")
        logfile = os.path.join(LOG_DIR, sanitize_filename(owner_repo) + ".log")
        start = time.time()
        try:
            print(f"Cloning {owner_repo} -> {tmpdir}")
            proc = subprocess.run(
                ["git", "clone", "--depth", "1", clone_url, tmpdir],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=CLONE_TIMEOUT,
            )
            with open(logfile, "wb") as lf:
                lf.write(b"=== STDOUT ===\n")
                lf.write(proc.stdout or b"")
                lf.write(b"\n=== STDERR ===\n")
                lf.write(proc.stderr or b"")

            elapsed = time.time() - start
            if proc.returncode != 0:
                print(
                    f"Clone failed for {owner_repo} (rc={proc.returncode}). See {logfile}"
                )
                results.append(
                    {
                        "repositório": owner_repo,
                        "status": "clone_failed",
                        "loc": 0,
                        "time_s": round(elapsed, 2),
                        "log": logfile,
                    }
                )
                shutil.rmtree(tmpdir, ignore_errors=True)
                continue

            loc = count_lines_in_tree(tmpdir)
            print(f"Cloned {owner_repo} OK: LOC={loc} time={elapsed:.1f}s")
            results.append(
                {
                    "repositório": owner_repo,
                    "status": "ok",
                    "loc": loc,
                    "time_s": round(elapsed, 2),
                    "log": logfile,
                }
            )
        except subprocess.TimeoutExpired:
            print(f"Clone timed out for {owner_repo} after {CLONE_TIMEOUT}s")
            with open(logfile, "a") as lf:
                lf.write("\nTIMEOUT\n")
            results.append(
                {
                    "repositório": owner_repo,
                    "status": "timeout",
                    "loc": 0,
                    "time_s": CLONE_TIMEOUT,
                    "log": logfile,
                }
            )
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception as e:
            print(f"Exception for {owner_repo}: {e}")
            with open(logfile, "a") as lf:
                lf.write("\nEXCEPTION: " + str(e) + "\n")
            results.append(
                {
                    "repositório": owner_repo,
                    "status": "exception",
                    "loc": 0,
                    "time_s": 0,
                    "log": logfile,
                }
            )
            shutil.rmtree(tmpdir, ignore_errors=True)

    # save results
    keys = ["repositório", "status", "loc", "time_s", "log"]
    with open(RESULT_CSV, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=keys)
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    print(f"Done. Results saved to {RESULT_CSV}. Logs in {LOG_DIR}/")


if __name__ == "__main__":
    main()
