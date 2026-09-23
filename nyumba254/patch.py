#!/usr/bin/env python3
"""
patch.py — applies the recommended UI/UX improvements to the
Nyumba254 admin dashboard (nk-ctrl-7f3k2x9.html).

Usage:
    python3 patch.py nk-ctrl-7f3k2x9.html

What it does:
  - Makes a timestamped backup before touching anything
  - Applies each patch independently (whitespace-tolerant matching)
  - Reports exactly which patches applied, which were skipped, and why
  - Only writes the file if at least one patch applied; never partially
    corrupts the file — each patch either fully applies or is skipped.

Safe to re-run: if a patch was already applied, it will report
"already applied / not found" and skip it harmlessly.
"""

import re
import sys
import shutil
import datetime
import pathlib

def build_pattern(old: str) -> re.Pattern:
    """Turn a CSS snippet into a whitespace-tolerant regex so minor
    formatting differences (indentation, line breaks) don't cause a
    false non-match."""
    tokens = old.strip().split()
    pattern = r"\s+".join(re.escape(t) for t in tokens)
    return re.compile(pattern)

PATCHES = [
    ("Card elevation (shadow so panels lift off the page)",
     '.card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 20px; }',
     '.card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 1px 10px rgba(0,0,0,0.035); }'),

    ("Tab bar spacing between tabs",
     '.tab-bar { display: flex; border-bottom: 1px solid var(--border); padding: 0 22px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }',
     '.tab-bar { display: flex; gap: 4px; border-bottom: 1px solid var(--border); padding: 0 22px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }'),

    ("Tab button hover + rounded top corners",
     '.tab-btn { padding: 12px 16px; font-size: 13px; font-weight: 500; color: var(--text-3); background: none; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s; white-space: nowrap; }',
     '.tab-btn { padding: 12px 16px; font-size: 13px; font-weight: 500; color: var(--text-3); background: none; border-bottom: 2px solid transparent; border-radius: 8px 8px 0 0; margin-bottom: -1px; transition: all .15s; white-space: nowrap; } .tab-btn:hover { background: var(--surface); color: var(--text-2); }'),

    ("Active tab gets a filled background (clearer current-tab signal)",
     '.tab-btn.active { color: var(--green); border-bottom-color: var(--green); }',
     '.tab-btn.active { color: var(--green); border-bottom-color: var(--green); background: var(--green-light); }'),

    ("Filters row visually separated from table (own background + border)",
     '.filters-row { display: flex; align-items: center; gap: 8px; padding: 14px 22px; flex-wrap: wrap; }',
     '.filters-row { display: flex; align-items: center; gap: 12px; padding: 14px 22px; flex-wrap: wrap; background: var(--surface); border-bottom: 1px solid var(--border); }'),

    ("Table header: stronger contrast against body rows",
     'th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--border); background: var(--surface); white-space: nowrap; }',
     'th { padding: 14px 18px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: .06em; border-bottom: 2px solid var(--border); background: var(--surface); white-space: nowrap; }'),

    ("Table cells: more breathing room per row",
     'td { padding: 13px 16px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-2); vertical-align: middle; white-space: nowrap; }',
     'td { padding: 16px 18px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-2); vertical-align: middle; white-space: nowrap; transition: background .12s; }'),

    ("Zebra striping + stronger hover highlight (fixes the 'clamped together' look)",
     'tr:last-child td { border-bottom: none; } tr:hover td { background: var(--surface); }',
     'tr:last-child td { border-bottom: none; } tr:nth-child(even) td { background: var(--surface); } tr:hover td { background: var(--green-light); }'),

    ("Icon action buttons get a subtle border so they read as distinct buttons",
     '.action-btns .action-btn.icon { width: 30px; height: 30px; padding: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0; }',
     '.action-btns .action-btn.icon { width: 30px; height: 30px; padding: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.07); }'),

    ("Badges: slightly larger padding/text so they don't feel cramped",
     '.badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; white-space: nowrap; }',
     '.badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 20px; white-space: nowrap; }'),

    ("Bulk-action bar animates in instead of snapping into view",
     '.bulk-bar.show { display: flex; }',
     '.bulk-bar.show { display: flex; animation: bulkBarIn .18s ease; } @keyframes bulkBarIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }'),

    ("Sticky Actions column: clearer 'more columns' fade instead of a faint 1px line",
     'box-shadow: -1px 0 0 var(--border);',
     'box-shadow: -10px 0 14px -10px rgba(0,0,0,0.18);'),

    ("Keyboard focus outlines on buttons/tabs/checkboxes (accessibility)",
     '.action-btn { padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; transition: all .15s; white-space: nowrap; border: none; cursor: pointer; min-height: 30px; }',
     '.action-btn { padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; transition: all .15s; white-space: nowrap; border: none; cursor: pointer; min-height: 30px; } .action-btn:focus-visible, .tab-btn:focus-visible, input[type="checkbox"]:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }'),

    ("Adds a ready-to-use '.row-urgent' CSS hook (attach via JS later to flag pending/expiring rows)",
     ".badge::before  { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }",
     ".badge::before  { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; } tr.row-urgent td:first-child { box-shadow: inset 3px 0 0 var(--red); }"),
]

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 patch.py <path-to-html-file>")
        sys.exit(1)

    path = pathlib.Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    content = path.read_text(encoding="utf-8")
    original_content = content

    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".bak-{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"Backup saved: {backup_path}\n")

    applied, skipped = [], []

    for label, old, new in PATCHES:
        pattern = build_pattern(old)
        matches = pattern.findall(content)
        if len(matches) == 0:
            skipped.append((label, "not found (already applied, or file differs from expected)"))
            continue
        if len(matches) > 1:
            skipped.append((label, f"skipped — matched {len(matches)} times, needs a unique anchor"))
            continue
        content = pattern.sub(new.replace("\\", "\\\\"), content, count=1)
        applied.append(label)

    if content == original_content:
        print("No changes were applied — nothing to write.")
        sys.exit(0)

    path.write_text(content, encoding="utf-8")

    print(f"Applied {len(applied)} patch(es):")
    for label in applied:
        print(f"  [x] {label}")

    if skipped:
        print(f"\nSkipped {len(skipped)} patch(es):")
        for label, reason in skipped:
            print(f"  [ ] {label} — {reason}")

    print(f"\nDone. Original file backed up at: {backup_path}")

if __name__ == "__main__":
    main()
