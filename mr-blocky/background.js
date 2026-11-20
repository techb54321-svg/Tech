// Chrome loads this file alone as a service worker; Firefox loads defaults.js before it.
if (typeof importScripts === 'function' && typeof SB_DEFAULTS === 'undefined') {
  importScripts('defaults.js');
}

// Firefox and Safari call the extension API `browser`; Chrome calls it `chrome`.
const api = globalThis.browser ?? globalThis.chrome;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function countClose() {
  const { stats = {} } = await api.storage.local.get('stats');
  const day = today();
  const next = {
    day,
    today: (stats.day === day ? stats.today || 0 : 0) + 1,
    total: (stats.total || 0) + 1
  };
  await api.storage.local.set({ stats: next });
}

async function closeTab(tab) {
  await countClose();
  // Closing the only tab would close the whole window, so leave a blank one behind.
  // Phones have no windows to keep open, so if this part fails just carry on.
  try {
    const siblings = await api.tabs.query({ windowId: tab.windowId });
    if (siblings.length <= 1) await api.tabs.create({ windowId: tab.windowId });
  } catch { /* nothing to keep open */ }
  await api.tabs.remove(tab.id);
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'sb-close' && sender.tab) {
    closeTab(sender.tab).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  }
});
