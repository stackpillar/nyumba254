# Dashboard smoke checks

## Status

This checklist is incomplete. One authenticated dashboard session was
available, but test accounts for each role and plan were not.

## Checked

- Static review: initial page restoration, Lister Page social editor, public
  social-link RPC usage and legacy storefront rendering.
- Live baseline: Settings and Lister Page opened in the available account;
  no duplicate IDs were found on that loaded page. Social links were visible.
  Realtime channel errors and aborted profile HEAD requests were observed.
  This baseline used the deployed code, not the local changes.
- Local automated check: `node --test tests\social-links.test.cjs`.
- `node --check dashboard.js` and `node --check nk-social.js`.

## Still required

- At 360 px, 768 px and desktop in all three themes, exercise every navigation
  page, modal and settings section for owner, agent, company, caretaker, team
  member and buyer across applicable Free, Premium and Elite accounts.
- Capture console errors, failed HTTP requests, RLS denials, duplicate IDs,
  missing elements, stale copy, and nonfunctional buttons.
- Verify feature-off states and use Back/Forward and refresh on Settings.
- Save and remove social links with an authorized account, then verify the
  handle page and legacy storefront as an anonymous visitor.
- Record before/after Performance API timings and screenshots using the same
  network, account and device conditions.
