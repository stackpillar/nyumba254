#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

matches="$(
  git ls-files -z -- '*.html' '*.js' \
    'nyumba254/about' 'nyumba254/accept-invite' 'nyumba254/admin-chat' \
    'nyumba254/contact' 'nyumba254/dashboard' 'nyumba254/faq' \
    'nyumba254/how-it-works' 'nyumba254/inbox' 'nyumba254/listing' \
    'nyumba254/listings' 'nyumba254/login' 'nyumba254/magic link email' \
    'nyumba254/nk-ctrl-7f3k2x9' 'nyumba254/plans' 'nyumba254/post-listing' \
    'nyumba254/pricing' 'nyumba254/privacy' 'nyumba254/profile' \
    'nyumba254/reset-confirm' 'nyumba254/saved' 'nyumba254/sitevisit' \
    'nyumba254/storefront' 'nyumba254/terms' 'nyumba254/viewing-fee-policy' |
    xargs -0 -r rg -n --no-heading '(target\s*=\s*["\x27]_blank["\x27]|window\.open\s*\()' -- 2>/dev/null || true
)"

if [[ -n "$matches" ]]; then
  printf 'New-tab navigation found in tracked HTML/JS files:\n%s\n' "$matches" >&2
  exit 1
fi

printf 'No new-tab navigation found in tracked HTML/JS files.\n'
