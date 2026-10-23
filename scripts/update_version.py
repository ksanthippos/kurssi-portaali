#!/usr/bin/env python3
"""
update_version.py
Laskee ja päivittää sovelluksen versionumeron Git-committien määrän perusteella.
Aloitusversio on 0.11. Jokainen uusi commit kasvattaa versionumeron sadasosia yhdellä:
0.11 -> 0.12 -> 0.13 ... -> 0.99 -> 1.00 -> 1.01 ...
"""

import os
import sys
import json
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
REPO_NAME = os.path.basename(ROOT_DIR)

# Pohjakommittien määrä ennen versionumeroinnin käyttöönottoa (0.11)
# kurssisivusto-new: 34 committia ennestään -> commit #35 on 0.11
# kurssi-portaali: 49 committia ennestään -> commit #50 on 0.11
BASE_COMMIT_COUNT = 50 if REPO_NAME == "kurssi-portaali" else 35
BASE_HUNDREDTHS = 11

def get_commit_count():
    try:
        res = subprocess.check_output(
            ["git", "-C", ROOT_DIR, "rev-list", "--count", "HEAD"],
            stderr=subprocess.DEVNULL
        )
        return int(res.decode().strip())
    except Exception:
        return BASE_COMMIT_COUNT - 1

def compute_version(offset_commit=1):
    current = get_commit_count()
    target_count = current + offset_commit
    diff = max(0, target_count - BASE_COMMIT_COUNT)
    total_hundredths = BASE_HUNDREDTHS + diff
    major = total_hundredths // 100
    minor = total_hundredths % 100
    return f"{major}.{minor:02d}"

def write_version(version):
    # 1. src/version.js
    version_js = os.path.join(ROOT_DIR, "src", "version.js")
    with open(version_js, "w", encoding="utf-8") as f:
        f.write(f'// Automaattisesti päivittyvä versiotieto\nwindow.APP_VERSION = "{version}";\n')

    # 2. src/data/version.json
    version_json = os.path.join(ROOT_DIR, "src", "data", "version.json")
    os.makedirs(os.path.dirname(version_json), exist_ok=True)
    with open(version_json, "w", encoding="utf-8") as f:
        json.dump({"version": version}, f, indent=2)
        f.write("\n")

    return version

if __name__ == "__main__":
    # Oletus: pre-commit hookissa offset_commit=1 (uusi commit on tekeillä)
    # Jos kutsutaan lipukkeella --current: offset_commit=0
    offset = 0 if "--current" in sys.argv else 1
    v = compute_version(offset)
    write_version(v)
    print(f"[{REPO_NAME}] Versio asetettu: {v}")
