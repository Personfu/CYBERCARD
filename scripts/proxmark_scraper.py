#!/usr/bin/env python3
"""
proxmark_scraper.py - recursive mirror of proxmark.org/files/Documents/
Furulie LLC / CyberFlipper Research Archive

Usage:
    pip install requests beautifulsoup4 tqdm
    python scripts/proxmark_scraper.py --out ~/Downloads/proxmark_docs --workers 6

Options:
    --out       output directory (default: ./proxmark_docs)
    --base-url  source root     (default: http://proxmark.org/files/Documents/)
    --workers   parallel dl     (default: 4)
    --resume    skip existing files (default: True)
    --manifest  path to write manifest JSON (default: <out>/manifest.json)
    --dry-run   enumerate only, do not download
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, unquote, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
    from tqdm import tqdm
except ImportError:
    sys.exit(
        "Missing deps - run:  pip install requests beautifulsoup4 tqdm"
    )

# ── known directory structure (pre-seeded from live crawl 2026-04-28) ──────────
KNOWN_DIRS = [
    "125 kHz - HID/",
    "125 kHz - Hitag/",
    "125 kHz - Indala/",
    "125 kHz - Q5B/",
    "125 kHz - T55x7/",
    "13.56 MHz - ASK CST/",
    "13.56 MHz - Calypso/",
    "13.56 MHz - CryptoRF/",
    "13.56 MHz - FeliCa/",
    "13.56 MHz - Legic Prime/",
    "13.56 MHz - MIFARE Classic/",
    "13.56 MHz - MIFARE Classic/MIFARE Classic clones/",
    "13.56 MHz - MIFARE DESFire/",
    "13.56 MHz - MIFARE Plus/",
    "13.56 MHz - MIFARE Ultralight/",
    "13.56 MHz - MIFARE Ultralight C/",
    "13.56 MHz - PIV/",
    "13.56 MHz - SRIX4K/",
    "13.56 MHz - Tag-it/",
    "13.56 MHz - Topaz/",
    "13.56 MHz - iClass/",
    "134 kHz - DST/",
    "Antennas/",
    "Cryptography/",
    "HOWTOs/",
    "NFC/",
]

# ── priority reading list for CyberCard threat model ─────────────────────────
PRIORITY_FILES = {
    "125 kHz - Hitag/HT1protocol.pdf":                        "Hitag1 full protocol spec",
    "125 kHz - Hitag/HT2protocol.pdf":                        "Hitag2 full protocol spec",
    "125 kHz - Hitag/HitagS.V11.pdf":                        "HitagS spec",
    "125 kHz - Hitag/Gone_in_360_Seconds_Hijacking_with_Hitag2-USENIX_2012.pdf": "USENIX 2012 - car key relay attack",
    "125 kHz - Hitag/Breaking_Hitag_2_Revisited.pdf":         "Crypto-1 break on Hitag2",
    "125 kHz - Hitag/2006.07.18-HITAGS-PS(079231).pdf":       "NXP Hitag S product spec",
    "125 kHz - HID/HID_format_example.pdf":                   "HID wiegand format reference",
    "125 kHz - Indala/HID.Indala.FlexSecur.Technology.pdf":   "HID Indala FlexSecur whitepaper",
    "125 kHz - Q5B/Q5B.pdf":                                  "EM Micro Q5/T5577 datasheet",
    "13.56 MHz - MIFARE Classic/Reverse-Engineering.a.Cryptographic.RFID.Tag-USENIX.2008.pdf": "Original MIFARE Classic crack - USENIX 2008",
    "13.56 MHz - MIFARE Classic/Dismantling.MIFARE.Classic-ESORICS.2008.pdf":     "Dismantling MIFARE - ESORICS 2008",
    "13.56 MHz - MIFARE Classic/A.Practical.Attack.on.the.MIFARE.Classic-CARDIS.2008.pdf": "Practical attack - CARDIS 2008",
    "13.56 MHz - MIFARE Classic/The_MIFARE_Hack.pdf":         "The MIFARE Hack",
    "13.56 MHz - MIFARE Classic/Design_Weaknesses_in_MIFARE_Classic.pdf":         "Design weaknesses analysis",
    "13.56 MHz - MIFARE Classic/Practical_Attacks_on_the_MIFARE Classic.pdf":     "Practical Attacks (3.4 MB - comprehensive)",
    "13.56 MHz - MIFARE Classic/Cryptanalysis.of.Crypto-1.pdf":                   "Crypto-1 cryptanalysis",
    "NFC/BH_US_12_Miller_NFC_attack_surface_WP.pdf":          "Black Hat 2012 - NFC attack surface (5.6 MB)",
    "NFC/Potential_misuse_of_NFC_enabled_mobile_phones_with_embedded_security_elements_as_contactless_attack_platforms.pdf": "NFC phone as attack platform",
    "NFC/Practical_attacks_on_NFC_enabled_cell_phones-NFC_2011.pdf":              "Practical NFC phone attacks",
    "NFC/ECMA-373.pdf":                                       "ECMA 373 - NFC standard",
    "NFC/ECMA-390.pdf":                                       "ECMA 390 - NFC standard",
    "SSTIC2021-Article-eeprom_it_will_all_end_in_tears-herrmann_teuwen.pdf":      "SSTIC 2021 - EEPROM side-channel",
}

# ── category tags for manifest ────────────────────────────────────────────────
CATEGORY_MAP = {
    "125 kHz - HID":            "lf-hid",
    "125 kHz - Hitag":          "lf-hitag",
    "125 kHz - Indala":         "lf-indala",
    "125 kHz - Q5B":            "lf-q5b",
    "125 kHz - T55x7":          "lf-t55x7",
    "13.56 MHz - MIFARE Classic": "hf-mifare-classic",
    "13.56 MHz - MIFARE DESFire": "hf-mifare-desfire",
    "13.56 MHz - MIFARE Plus":  "hf-mifare-plus",
    "13.56 MHz - MIFARE Ultralight": "hf-mifare-ul",
    "13.56 MHz - iClass":       "hf-iclass",
    "13.56 MHz - FeliCa":       "hf-felica",
    "13.56 MHz - PIV":          "hf-piv",
    "13.56 MHz - Legic Prime":  "hf-legic",
    "13.56 MHz - Calypso":      "hf-calypso",
    "13.56 MHz - CryptoRF":     "hf-cryptorf",
    "134 kHz - DST":            "lf-dst",
    "NFC":                      "nfc",
    "Antennas":                 "antennas",
    "Cryptography":             "cryptography",
    "HOWTOs":                   "howtos",
}

BASE_URL = "http://proxmark.org/files/Documents/"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "CyberFlipper-ResearchArchiver/1.0 (+research)"})


def get_listing(url: str) -> list[dict]:
    """Fetch an Apache directory listing and return files + subdirs."""
    try:
        r = SESSION.get(url, timeout=20)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"[WARN] fetch failed {url}: {e}")
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    items = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href in ("../", "/files/", "/files/Documents/", "?C=N;O=D", "?C=M;O=A", "?C=S;O=A", "?C=D;O=A"):
            continue
        full = urljoin(url, href)
        if href.endswith("/"):
            items.append({"type": "dir", "url": full, "name": unquote(href.rstrip("/"))})
        elif "." in href.split("/")[-1]:
            items.append({"type": "file", "url": full, "name": unquote(href.split("/")[-1])})
    return items


def crawl(base_url: str) -> list[dict]:
    """Recursively crawl the document archive and return a flat file list."""
    all_files = []
    queue = [base_url]
    seen = set()

    while queue:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)

        items = get_listing(url)
        for item in items:
            if item["type"] == "dir":
                queue.append(item["url"])
            else:
                # Derive relative path from base
                rel = unquote(item["url"].replace(base_url, ""))
                cat = _categorize(rel)
                all_files.append({
                    "url": item["url"],
                    "rel_path": rel,
                    "filename": item["name"],
                    "category": cat,
                    "priority": rel in PRIORITY_FILES,
                    "priority_note": PRIORITY_FILES.get(rel, ""),
                })
    return all_files


def _categorize(rel_path: str) -> str:
    for key, tag in CATEGORY_MAP.items():
        if key in rel_path:
            return tag
    return "misc"


def download_file(file_info: dict, out_dir: Path, resume: bool, max_retries: int) -> dict:
    """Download a single file. Returns status dict."""
    dest = out_dir / file_info["rel_path"]
    dest.parent.mkdir(parents=True, exist_ok=True)

    if resume and dest.exists() and dest.stat().st_size > 0:
        return {**file_info, "status": "skipped"}

    last_error = ""
    for attempt in range(max_retries + 1):
        try:
            r = SESSION.get(file_info["url"], timeout=60, stream=True)
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    f.write(chunk)
            return {
                **file_info,
                "status": "ok",
                "bytes": dest.stat().st_size,
                "attempts": attempt + 1,
            }
        except requests.RequestException as e:
            last_error = str(e)
            # Exponential backoff helps with transient remote resets.
            if attempt < max_retries:
                time.sleep(min(8, 2 ** attempt))

    return {
        **file_info,
        "status": "error",
        "error": last_error,
        "attempts": max_retries + 1,
    }


def write_manifest(files: list[dict], out_dir: Path, manifest_path: Path):
    """Write manifest.json and a categorized study guide."""
    categories: dict[str, list] = {}
    for f in files:
        categories.setdefault(f["category"], []).append(f)

    manifest = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": BASE_URL,
        "total_files": len(files),
        "categories": {k: len(v) for k, v in categories.items()},
        "files": files,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[manifest] written -> {manifest_path}")

    # Also write a human-readable study guide
    guide_path = out_dir / "STUDY_GUIDE.md"
    lines = [
        "# Proxmark Research Archive - CyberFlipper Study Guide",
        f"_Generated {manifest['generated']} / {len(files)} documents_",
        "",
        "## Priority Reading (CyberCard threat model relevance)",
        "",
    ]
    for rel, note in PRIORITY_FILES.items():
        lines.append(f"- **{note}**  \n  `{rel}`")
    lines += ["", "---", "", "## Full Index by Category", ""]
    for cat, cat_files in sorted(categories.items()):
        lines.append(f"### {cat}  ({len(cat_files)} files)")
        for f in cat_files:
            tag = " *PRIORITY*" if f["priority"] else ""
            lines.append(f"- [{f['filename']}]({f['rel_path']}){tag}")
        lines.append("")

    guide_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[guide]    written -> {guide_path}")


def main():
    ap = argparse.ArgumentParser(description="proxmark.org document archive mirror")
    ap.add_argument("--out",      default="proxmark_docs",  help="output directory")
    ap.add_argument("--base-url", default=BASE_URL,         help="archive root URL")
    ap.add_argument("--workers",  type=int, default=4,      help="parallel download workers")
    ap.add_argument("--resume",   action="store_true",      default=True, help="skip existing files")
    ap.add_argument("--no-resume",action="store_true",      default=False)
    ap.add_argument("--manifest", default="",               help="manifest output path (default: <out>/manifest.json)")
    ap.add_argument("--dry-run",  action="store_true",      help="enumerate only, no download")
    ap.add_argument("--max-retries", type=int, default=3,    help="retry attempts per file")
    args = ap.parse_args()

    resume = not args.no_resume
    out_dir = Path(args.out).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = Path(args.manifest) if args.manifest else out_dir / "manifest.json"

    print(f"[crawl] enumerating {args.base_url} ...")
    files = crawl(args.base_url)
    print(f"[crawl] found {len(files)} files across {len(set(f['category'] for f in files))} categories")

    if args.dry_run:
        write_manifest(files, out_dir, manifest_path)
        for f in files:
            flag = " *PRIORITY*" if f["priority"] else ""
            print(f"  [{f['category']:25s}] {f['rel_path']}{flag}")
        return

    print(f"[dl]    downloading -> {out_dir}  workers={args.workers}  resume={resume}")
    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(download_file, f, out_dir, resume, args.max_retries): f
            for f in files
        }
        with tqdm(total=len(futures), unit="file") as bar:
            for fut in as_completed(futures):
                r = fut.result()
                results.append(r)
                status = r.get("status", "?")
                bar.set_postfix_str(f"{status}: {r['filename'][:40]}")
                bar.update(1)

    ok      = sum(1 for r in results if r.get("status") == "ok")
    skipped = sum(1 for r in results if r.get("status") == "skipped")
    errors  = [r for r in results if r.get("status") == "error"]

    print(f"\n[done] ok={ok}  skipped={skipped}  errors={len(errors)}")
    if errors:
        print("[errors]")
        for e in errors:
            print(f"  {e['rel_path']}: {e.get('error')}")

    write_manifest(results, out_dir, manifest_path)
    print(f"\n[ready] archive at: {out_dir}")
    print("[ready] priority papers:")
    for rel in PRIORITY_FILES:
        dest = out_dir / rel
        status = "OK" if dest.exists() else "MISSING"
        print(f"  {status}  {rel}")


if __name__ == "__main__":
    main()
