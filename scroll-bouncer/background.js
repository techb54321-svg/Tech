// Chrome loads this file alone as a service worker; Firefox loads defaults.js before it.
if (typeof importScripts === 'function' && typeof SB_DEFAULTS === 'undefined') {
  importScripts('defaults.js');
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function countClose() {
  const { stats = {} } = await chrome.storage.local.get('stats');
  const day = today();
  const next = {
    day,
    today: (stats.day === day ? stats.today || 0 : 0) + 1,
    total: (stats.total || 0) + 1
  };
  await chrome.storage.local.set({ stats: next });
}

async function closeTab(tab) {
  await countClose();
  // Closing the only tab would close the whole window, so leave a blank one behind.
  const siblings = await chrome.tabs.query({ windowId: tab.windowId });
  if (siblings.length <= 1) await chrome.tabs.create({ windowId: tab.windowId });
  await chrome.tabs.remove(tab.id);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'sb-close' && sender.tab) {
    closeTab(sender.tab).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  }
});
