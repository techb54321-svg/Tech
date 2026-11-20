// Shared by the background worker, the content script and the popup.
const SB_DEFAULTS = {
  enabled: true,
  snoozeUntil: 0,
  sites: [
    'instagram.com',
    'tiktok.com',
    'facebook.com',
    'x.com',
    'twitter.com',
    'reddit.com',
    'threads.net',
    'snapchat.com',
    'youtube.com/shorts'
  ]
};

// An entry is a domain with an optional path prefix: "reddit.com", "youtube.com/shorts".
function sbNormalize(entry) {
  return String(entry)
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

function sbMatches(url, sites) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const path = u.pathname.toLowerCase();
  return sites.some((raw) => {
    const entry = sbNormalize(raw);
    if (!entry) return false;
    const slash = entry.indexOf('/');
    const domain = slash === -1 ? entry : entry.slice(0, slash);
    const prefix = slash === -1 ? '' : entry.slice(slash);
    if (host !== domain && !host.endsWith('.' + domain)) return false;
    return !prefix || path === prefix || path.startsWith(prefix + '/');
  });
}
