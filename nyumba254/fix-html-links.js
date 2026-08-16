// fix-favicon-links.js
// Run with: node fix-favicon-links.js
//
// Replaces the old favicon <link> tags:
//   <link rel="icon" type="image/png" href="/favicon.png"/>
//   <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
//
// with the new set:
//   <link rel="icon" href="/favicon.ico" sizes="any">
//   <link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">
//   <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
//
// Across every .html file in this folder (recursive).
// Requires Node.js. Run this from inside your project root
// (the folder that contains index.html).

const fs = require('fs');
const path = require('path');

const skipDirs = new Set(['node_modules', '.git']);

// Same exclusion as your link-fixer: raw email templates should never
// be touched by site-wide find/replace scripts.
const emailTemplateFiles = new Set([
  'change email address.html',
  'magic link email.html',
  'reset password email.html',
  'invite user email.html',
  'email-verification.html', // adjust if the real filename differs
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name), files);
    } else if (
      path.extname(entry.name) === '.html' &&
      !emailTemplateFiles.has(entry.name)
    ) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

// Matches the old favicon <link> tag, allowing for attribute order/spacing
// variations and both self-closing and non-self-closing forms.
const OLD_FAVICON_RE =
  /<link\s+rel=["']icon["']\s+type=["']image\/png["']\s+href=["']\/favicon\.png["']\s*\/?>/i;

const NEW_FAVICON_BLOCK =
  '<link rel="icon" href="/favicon.ico" sizes="any">\n' +
  '  <link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">';

const APPLE_TOUCH_RE =
  /<link\s+rel=["']apple-touch-icon["']\s+href=["']\/apple-touch-icon\.png["']\s*\/?>/i;

let changedFiles = 0;

for (const file of walk(process.cwd())) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Replace the old favicon.png link with the two new icon links.
  if (OLD_FAVICON_RE.test(content)) {
    content = content.replace(OLD_FAVICON_RE, NEW_FAVICON_BLOCK);
  }

  // apple-touch-icon tag stays as-is (same filename, new file contents
  // are swapped separately) — left untouched, matched only for reporting.
  const hasAppleTouch = APPLE_TOUCH_RE.test(content);

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log(
      'Updated:',
      path.relative(process.cwd(), file),
      hasAppleTouch ? '' : '(no apple-touch-icon tag found — check manually)'
    );
  }
}

console.log(`\nDone. ${changedFiles} file(s) updated.`);
console.log('Review the diffs (git diff) before committing.');
console.log(
  '\nDon\'t forget to also upload the actual icon files to your site root:'
);
console.log('  favicon.ico, favicon-96.png, apple-touch-icon.png');