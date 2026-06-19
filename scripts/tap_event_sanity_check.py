#!/usr/bin/env python3
"""Validate exported CyberCard tap events before analytics/reporting.

Input CSV columns are intentionally simple:
  timestamp_utc,card_id,event_type,utm_source,user_agent_hash,ip_prefix,country

This is a privacy and data-quality helper. It does not deanonymize visitors,
fingerprint users, or enrich records with personal data.
"""
from __future__ import annotations

import argparse
import csv
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REQUIRED = {"timestamp_utc", "card_id", "event_type", "utm_source"}
ALLOWED_EVENTS = {"tap", "qr", "ar", "vcard", "challenge", "redirect"}


def parse_time(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
        return True
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Check CyberCard tap CSV quality and privacy posture.")
    parser.add_argument("csv_path", type=Path)
    args = parser.parse_args()

    rows = list(csv.DictReader(args.csv_path.open("r", encoding="utf-8", newline="")))
    if not rows:
        raise SystemExit("no rows found")

    missing = REQUIRED - set(rows[0].keys())
    if missing:
        raise SystemExit(f"missing required columns: {', '.join(sorted(missing))}")

    warnings: list[str] = []
    event_counts = Counter()
    card_counts = Counter()

    for idx, row in enumerate(rows, start=2):
        if not parse_time(row.get("timestamp_utc", "")):
            warnings.append(f"line {idx}: invalid timestamp_utc")
        event = (row.get("event_type") or "").strip().lower()
        if event not in ALLOWED_EVENTS:
            warnings.append(f"line {idx}: unexpected event_type={event!r}")
        event_counts[event] += 1
        card_counts[row.get("card_id", "unknown")] += 1
        if row.get("ip_address") or row.get("email") or row.get("name"):
            warnings.append(f"line {idx}: raw personal field present; export aggregate/hash-safe fields only")

    print("CyberCard tap event sanity report")
    print(f"rows: {len(rows)}")
    print("events:")
    for key, value in event_counts.most_common():
        print(f"  {key}: {value}")
    print("cards:")
    for key, value in card_counts.most_common(10):
        print(f"  {key}: {value}")
    if warnings:
        print("warnings:")
        for warning in warnings[:50]:
            print(f"  - {warning}")
        raise SystemExit(1)
    print("status: ok")


if __name__ == "__main__":
    main()
