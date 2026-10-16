(() => {
  const allowedPaths = new Set([
    '/viewing-fee-policy',
    '/terms',
    '/terms.html',
    '/privacy',
    '/privacy.html'
  ]);
  let dialog, frame;

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Policy document');
    dialog.style.cssText = 'width:min(900px,calc(100vw - 24px));height:min(88vh,900px);padding:0;border:0;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.35);';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #d8dedb;background:#fff;font:600 14px system-ui,sans-serif;';
    const title = document.createElement('span');
    title.textContent = 'Policy document';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.setAttribute('aria-label', 'Close policy document');
    close.style.cssText = 'min-height:40px;padding:6px 12px;border:1px solid #cbd5d1;border-radius:8px;background:#fff;font:inherit;cursor:pointer;';
    close.addEventListener('click', () => dialog.close());
    frame = document.createElement('iframe');
    frame.title = 'Policy document content';
    frame.sandbox = 'allow-same-origin';
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'display:block;width:100%;height:calc(100% - 62px);border:0;background:#fff;';
    header.append(title, close);
    dialog.append(header, frame);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => { frame.src = 'about:blank'; });
    document.body.append(dialog);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-policy-viewer]');
    if (!link) return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin || !allowedPaths.has(url.pathname)) return;
    event.preventDefault();
    ensureDialog();
    dialog.querySelector('span').textContent = link.textContent.trim() || 'Policy document';
    frame.src = `${url.pathname}${url.search}${url.hash}`;
    if (!dialog.open) dialog.showModal();
  });
})();
