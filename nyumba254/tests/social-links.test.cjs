const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function socialModule() {
  const context = {
    URL,
    window: {},
    document: {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild() {} },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'nk-social.js'), 'utf8'), context);
  return context.window.NKSocial;
}

test('social links normalize handles and reject unsafe URLs', () => {
  const social = socialModule();
  assert.equal(social.extract('instagram', '@Example').url, 'https://www.instagram.com/example/');
  assert.equal(social.extract('website', 'https://example.com/contact?ref=home').url, 'https://example.com/contact?ref=home');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/']) {
    assert.equal(social.extract('website', value), null);
  }
  assert.equal(social.extract('instagram', 'https://example.com/handle'), null);
});

test('public social links escape text, reject unsafe links and use the same tab', () => {
  const social = socialModule();
  const html = social.renderRow([
    { platform: 'instagram', url: 'https://www.instagram.com/example/', handle: '<example>' },
    { platform: 'website', url: 'javascript:alert(1)', handle: 'bad' },
  ]);
  assert.match(html, /&lt;example&gt;/);
  assert.doesNotMatch(html, /javascript:|target="_blank"/);
});

test('editor preserves a website path when loading and saving', async () => {
  const social = socialModule();
  const listeners = {};
  const host = {
    classList: { add() {} },
    addEventListener(type, fn) { listeners[type] = fn; },
    querySelector() { return null; },
    innerHTML: '',
  };
  let saved;
  const db = { rpc(name, args) {
    if (name === 'get_my_social_links') return Promise.resolve({ data: [{ platform: 'website', handle: 'example.com', url: 'https://example.com/contact', is_visible: true }] });
    if (name === 'get_my_social_click_totals') return Promise.resolve({ data: [] });
    if (name === 'set_lister_social_links') {
      saved = args.links;
      return Promise.resolve({ data: [] });
    }
    throw new Error('Unexpected RPC ' + name);
  } };
  await social.mountEditor(host, { db });
  assert.match(host.innerHTML, /value="https:\/\/example\.com\/contact"/);
  listeners.click({ target: { closest() { return { matches: name => name === '[data-save]', closest: () => null }; } } });
  assert.equal(saved[0].handle, 'https://example.com/contact');
});
