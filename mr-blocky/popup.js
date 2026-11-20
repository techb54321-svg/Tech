// Firefox and Safari call the extension API `browser`; Chrome calls it `chrome`.
const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);
let cfg;

function render() {
  $('enabled').checked = cfg.enabled;
  const list = $('sites');
  list.textContent = '';
  for (const site of cfg.sites) {
    const li = document.createElement('li');
    li.append(site);
    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.setAttribute('aria-label', `Remove ${site}`);
    rm.onclick = () => save({ sites: cfg.sites.filter((s) => s !== site) });
    li.append(rm);
    list.append(li);
  }
  const left = cfg.snoozeUntil - Date.now();
  const snoozing = left > 0;
  $('snooze').textContent = snoozing ? 'End break now' : 'Let me in for 5 minutes';
  $('snoozeNote').textContent = snoozing ? `On a break for ${Math.ceil(left / 60000)} more min` : '';
}

async function save(patch) {
  cfg = { ...cfg, ...patch };
  await api.storage.sync.set(patch);
  render();
}

$('enabled').onchange = (e) => save({ enabled: e.target.checked });

$('add').onsubmit = (e) => {
  e.preventDefault();
  const site = sbNormalize($('site').value);
  $('site').value = '';
  if (!site || !site.includes('.') || cfg.sites.includes(site)) return;
  save({ sites: [...cfg.sites, site] });
};

$('snooze').onclick = () =>
  save({ snoozeUntil: cfg.snoozeUntil > Date.now() ? 0 : Date.now() + 5 * 60 * 1000 });

(async () => {
  cfg = await api.storage.sync.get(SB_DEFAULTS);
  const { stats = {} } = await api.storage.local.get('stats');
  const d = new Date();
  const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  $('today').textContent = stats.day === day ? stats.today || 0 : 0;
  $('total').textContent = stats.total || 0;
  render();
})();
