#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

matches="$(
  git ls-files -z -- '*.html' '*.js' |
    xargs -0 -r rg -n --no-heading '(target\s*=\s*["\x27]_blank["\x27]|window\.open\s*\()' -- 2>/dev/null || true
)"

if [[ -n "$matches" ]]; then
  printf 'New-tab navigation found in tracked HTML/JS files:\n%s\n' "$matches" >&2
  exit 1
fi

printf 'No new-tab navigation found in tracked HTML/JS files.\n'
