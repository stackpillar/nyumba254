const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('D:/Projects/nyumba254/nyumba254/sw.js', 'utf8');
const handlers = {};
const store = new Map([['/offline.html', 'WEB-OFFLINE'], ['/offline-app.html', 'APP-OFFLINE']]);
const self_ = {
  location: { origin: 'https://nyumba254.com' },
  addEventListener: (t, f) => { handlers[t] = f; },
  skipWaiting() {}, clients: { claim() {} },
};
const ctx = { self: self_, URL, Response, Map,
  caches: { match: async (k) => { const v = store.get(typeof k === 'string' ? k : new URL(k.url).pathname); return v ? { body: v } : undefined; }, open: async () => ({}), keys: async () => [] },
  fetch: async () => { throw new Error('offline'); }, console };
vm.createContext(ctx); vm.runInContext(src, ctx);
async function nav(url, { referrer = '', clientId = '' } = {}) {
  let result;
  await handlers.fetch({ clientId, request: { method: 'GET', url, mode: 'navigate', referrer, headers: { has: () => false }, destination: 'document' }, respondWith: (p) => { result = p; } });
  return (await result).body;
}
(async () => {
  const r = {};
  r.web = await nav('https://nyumba254.com/saved');
  r.appParam = await nav('https://nyumba254.com/saved?source=app');
  r.appReferrer = await nav('https://nyumba254.com/saved', { referrer: 'android-app://com.nyumba254.app' });
  await handlers.message({ data: { type: 'nk-ctx', ctx: 'app' }, source: { id: 'c1' } });
  r.appAnnounced = await nav('https://nyumba254.com/saved', { clientId: 'c1' });
  r.otherClientStaysWeb = await nav('https://nyumba254.com/saved', { clientId: 'c2' });
  console.log(r);
  const ok = r.web === 'WEB-OFFLINE' && r.appParam === 'APP-OFFLINE' && r.appReferrer === 'APP-OFFLINE' && r.appAnnounced === 'APP-OFFLINE' && r.otherClientStaysWeb === 'WEB-OFFLINE';
  console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
})();
