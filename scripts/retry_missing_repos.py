#!/usr/bin/env python3
import csv
import os
import subprocess
import tempfile
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from dotenv import load_dotenv

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}

# Configuration
MISSING = [
    "Dmitriihub/studyproject2",
    "Guspex/EBAC-QA",
    "MateusNeres26/EBAC-QA",
    "agussyahrilmubarok/course-assignments",
    "farhanlabib/xk6-file-sample-project",
    "logsk85-wq/iagentic",
    "wildananugrah/belajar",
    "zitadel/zitadel",
]
MAX_WORKERS = 2
CLONE_TIMEOUT = 600  # 10 minutes
PROCESSED_CSV = os.path.join("scripts", "processed_k6_repos.csv")


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


def get_stars(repo_full_name):
    if not HEADERS:
        return 0
    owner, repo = repo_full_name.split("/")
    url = f"https://api.github.com/repos/{owner}/{repo}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            return r.json().get("stargazers_count", 0)
    except Exception:
        pass
    return 0


def process(repo_full_name):
    owner, repo = repo_full_name.split("/")
    clone_url = f"git@github.com:{owner}/{repo}.git"
    tmpdir = tempfile.mkdtemp(prefix="repo_retry_")
    start = time.time()
    try:
        proc = subprocess.run(
            ["git", "clone", "--depth", "1", clone_url, tmpdir],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=CLONE_TIMEOUT,
        )
        elapsed = time.time() - start
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or b"").decode("utf-8", errors="replace")
            return {
                "repo": repo_full_name,
                "ok": False,
                "reason": f"clone_failed: {err[:400]}",
            }
        loc = count_lines_in_tree(tmpdir)
        stars = get_stars(repo_full_name)
        return {"repo": repo_full_name, "ok": True, "loc": loc, "stars": stars}
    except subprocess.TimeoutExpired:
        return {
            "repo": repo_full_name,
            "ok": False,
            "reason": f"timeout_after_{CLONE_TIMEOUT}s",
        }
    except Exception as e:
        return {"repo": repo_full_name, "ok": False, "reason": f"exception: {e}"}
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    results = []
    print(
        f"Retrying {len(MISSING)} repos with timeout={CLONE_TIMEOUT}s and workers={MAX_WORKERS}..."
    )
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(process, r): r for r in MISSING}
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            if r["ok"]:
                print(f"OK: {r['repo']} loc={r['loc']} stars={r['stars']}")
            else:
                print(f"FAIL: {r['repo']} reason={r.get('reason')}")

    # Load existing processed CSV
    existing = []
    if os.path.exists(PROCESSED_CSV):
        with open(PROCESSED_CSV, "r", encoding="utf-8") as fh:
            rdr = csv.DictReader(fh)
            for row in rdr:
                existing.append(row)

    # Build a map to avoid duplicates
    seen = {row["repo"] for row in existing}

    # Append successful results
    added = 0
    for r in results:
        if r["ok"]:
            repo_full = r["repo"]
            if repo_full in seen:
                continue
            url = f"https://github.com/{repo_full}"
            existing.append(
                {
                    "repo": repo_full,
                    "url": url,
                    "stars": str(r["stars"]),
                    "loc": str(r["loc"]),
                }
            )
            seen.add(repo_full)
            added += 1

    # Write back CSV (overwrite)
    fieldnames = ["repo", "url", "stars", "loc"]
    with open(PROCESSED_CSV, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in existing:
            writer.writerow(row)

    print(f"Done. Added {added} repos to {PROCESSED_CSV}.")
    # print failures
    fails = [r for r in results if not r["ok"]]
    if fails:
        print("\nFailures:")
        for f in fails:
            print(f"- {f['repo']}: {f.get('reason')}")


if __name__ == "__main__":
    main()
