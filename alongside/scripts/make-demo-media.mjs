// Renders the demonstration's illustrations (stand-ins for the photos a
// family would take) to small JPEGs and writes shared/demoMedia.ts.
//   node scripts/make-demo-media.mjs
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const W = 640, H = 420
const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const blister = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#e8eef6"/>
  <rect x="40" y="40" width="560" height="340" rx="22" fill="#f8fafc" stroke="#94a3b8" stroke-width="4"/>
  <text x="320" y="78" text-anchor="middle" font-family="Arial" font-weight="700" font-size="22" fill="#334155">BANKSIA PHARMACY · MARGARET</text>
  ${days.map((d, i) => `<text x="${110 + i * 70}" y="112" text-anchor="middle" font-family="Arial" font-weight="700" font-size="18" fill="#475569">${d}</text>`).join('')}
  ${['MORNING', 'EVENING'].map((row, r) => `
    <rect x="58" y="${128 + r * 120}" width="526" height="104" rx="14" fill="${r === 0 ? '#fef3c7' : '#e0e7ff'}" stroke="${r === 0 ? '#d97706' : '#6366f1'}" stroke-width="3"/>
    <text x="72" y="${150 + r * 120}" font-family="Arial" font-weight="700" font-size="15" fill="${r === 0 ? '#92400e' : '#3730a3'}">${row}</text>
    ${days.map((_, i) => `
      <rect x="${84 + i * 70}" y="${158 + r * 120}" width="52" height="62" rx="12" fill="#fff" stroke="#cbd5e1" stroke-width="3"/>
      <ellipse cx="${104 + i * 70}" cy="${180 + r * 120}" rx="11" ry="8" fill="${r === 0 ? '#f59e0b' : '#818cf8'}"/>
      <ellipse cx="${118 + i * 70}" cy="${200 + r * 120}" rx="9" ry="9" fill="#fff" stroke="#94a3b8" stroke-width="2"/>`).join('')}`).join('')}
</svg>`
const building = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#bfdbfe"/>
  <circle cx="540" cy="80" r="44" fill="#fde68a"/>
  <rect y="330" width="${W}" height="90" fill="#86efac"/>
  <rect x="120" y="120" width="400" height="230" fill="#f8fafc" stroke="#475569" stroke-width="4"/>
  <rect x="100" y="100" width="440" height="34" fill="#0f766e"/>
  <text x="320" y="124" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="#fff">BANKSIA ROAD MEDICAL CENTRE</text>
  <rect x="290" y="150" width="60" height="60" rx="8" fill="#16a34a"/>
  <rect x="312" y="158" width="16" height="44" fill="#fff"/><rect x="298" y="172" width="44" height="16" fill="#fff"/>
  <rect x="150" y="160" width="90" height="70" fill="#93c5fd" stroke="#475569" stroke-width="3"/>
  <rect x="400" y="160" width="90" height="70" fill="#93c5fd" stroke="#475569" stroke-width="3"/>
  <rect x="280" y="240" width="80" height="110" fill="#7dd3fc" stroke="#475569" stroke-width="4"/>
  <text x="320" y="300" text-anchor="middle" font-family="Arial" font-weight="700" font-size="16" fill="#0f172a">12</text>
  <rect x="260" y="350" width="120" height="12" fill="#cbd5e1"/>
</svg>`
const shops = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fde68a"/>
  <rect y="340" width="${W}" height="80" fill="#d6d3d1"/>
  ${[0, 1, 2].map((i) => `
    <rect x="${40 + i * 190}" y="130" width="180" height="210" fill="#fff7ed" stroke="#78350f" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5].map((s) => `<rect x="${40 + i * 190 + s * 30}" y="110" width="30" height="40" fill="${s % 2 ? '#fff' : ['#dc2626', '#2563eb', '#16a34a'][i]}"/>`).join('')}
    <rect x="${60 + i * 190}" y="180" width="140" height="80" fill="#bae6fd" stroke="#78350f" stroke-width="3"/>
    <rect x="${105 + i * 190}" y="270" width="50" height="70" fill="#a16207"/>`).join('')}
  <text x="320" y="80" text-anchor="middle" font-family="Arial" font-weight="700" font-size="30" fill="#78350f">WATTLETON VILLAGE SHOPS</text>
</svg>`
const home = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#cffafe"/>
  <rect y="320" width="${W}" height="100" fill="#4ade80"/>
  <polygon points="150,190 320,70 490,190" fill="#b91c1c"/>
  <rect x="180" y="190" width="280" height="160" fill="#fef3c7" stroke="#78350f" stroke-width="4"/>
  <rect x="295" y="250" width="56" height="100" fill="#1d4ed8"/>
  <circle cx="340" cy="302" r="4" fill="#fde68a"/>
  <rect x="205" y="225" width="64" height="56" fill="#bae6fd" stroke="#78350f" stroke-width="3"/>
  <rect x="380" y="225" width="64" height="56" fill="#bae6fd" stroke="#78350f" stroke-width="3"/>
  <rect x="470" y="300" width="70" height="50" rx="6" fill="#fff" stroke="#334155" stroke-width="3"/>
  <text x="505" y="335" text-anchor="middle" font-family="Arial" font-weight="700" font-size="28" fill="#334155">7</text>
  <circle cx="110" cy="290" r="40" fill="#16a34a"/><rect x="104" y="300" width="12" height="50" fill="#78350f"/>
</svg>`

// Friendly illustrated portraits stand in for family photos.
const portrait = (bg, skin, hair, top, longHair) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <circle cx="540" cy="70" r="90" fill="#ffffff" opacity="0.25"/>
  <circle cx="90" cy="380" r="120" fill="#ffffff" opacity="0.2"/>
  <path d="M170 420 C170 320 240 280 320 280 C400 280 470 320 470 420 Z" fill="${top}"/>
  ${longHair ? `<path d="M222 190 C215 110 260 70 320 70 C380 70 425 110 418 190 L430 300 L210 300 Z" fill="${hair}"/>` : ''}
  <rect x="295" y="235" width="50" height="50" rx="16" fill="${skin}"/>
  <ellipse cx="320" cy="180" rx="82" ry="95" fill="${skin}"/>
  <path d="M238 165 C236 100 280 78 320 78 C368 78 406 104 402 165 C380 128 340 118 300 128 C276 134 252 146 238 165 Z" fill="${hair}"/>
  <circle cx="290" cy="185" r="8" fill="#1f2937"/><circle cx="350" cy="185" r="8" fill="#1f2937"/>
  <path d="M290 222 Q320 248 350 222" stroke="#9f1239" stroke-width="7" fill="none" stroke-linecap="round"/>
  <circle cx="268" cy="212" r="12" fill="#fb7185" opacity="0.35"/><circle cx="372" cy="212" r="12" fill="#fb7185" opacity="0.35"/>
</svg>`
const gym = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ccfbf1"/>
  <rect y="330" width="${W}" height="90" fill="#fcd34d"/>
  <text x="320" y="70" text-anchor="middle" font-family="Arial" font-weight="700" font-size="30" fill="#115e59">GENTLE EXERCISE CLASS</text>
  ${[0, 1, 2].map((i) => {
    const x = 160 + i * 160
    const c = ['#db2777', '#2563eb', '#7c3aed'][i]
    return `<circle cx="${x}" cy="140" r="30" fill="#f2c9a0"/>
      <rect x="${x - 30}" y="175" width="60" height="90" rx="22" fill="${c}"/>
      <path d="M${x - 28} 190 L${x - 75} 125" stroke="${c}" stroke-width="18" stroke-linecap="round"/>
      <path d="M${x + 28} 190 L${x + 75} 125" stroke="${c}" stroke-width="18" stroke-linecap="round"/>
      <path d="M${x - 15} 262 L${x - 25} 330" stroke="#334155" stroke-width="18" stroke-linecap="round"/>
      <path d="M${x + 15} 262 L${x + 25} 330" stroke="#334155" stroke-width="18" stroke-linecap="round"/>`
  }).join('')}
  <rect x="40" y="290" width="70" height="40" rx="8" fill="#0f766e"/><rect x="530" y="290" width="70" height="40" rx="8" fill="#0f766e"/>
</svg>`

const coffee = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fde7c8"/>
  <rect y="300" width="${W}" height="120" fill="#a16207"/>
  <text x="320" y="70" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="40" fill="#7c2d12">The Feathers Café</text>
  <ellipse cx="320" cy="300" rx="170" ry="26" fill="#fff" stroke="#78350f" stroke-width="4"/>
  <path d="M220 160 L420 160 L400 290 Q320 312 240 290 Z" fill="#fff" stroke="#78350f" stroke-width="5"/>
  <path d="M420 190 Q480 190 470 235 Q460 270 405 262" fill="none" stroke="#78350f" stroke-width="12"/>
  <ellipse cx="320" cy="162" rx="100" ry="14" fill="#92400e"/>
  <path d="M280 130 Q270 105 285 85 M320 125 Q308 100 322 78 M360 130 Q350 105 365 85" stroke="#a8a29e" stroke-width="6" fill="none" stroke-linecap="round"/>
</svg>`
const lily = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#7dd3fc"/>
  <circle cx="530" cy="80" r="50" fill="#fde047"/>
  <rect y="220" width="${W}" height="70" fill="#0ea5e9"/>
  <path d="M0 230 Q80 215 160 230 T320 230 T480 230 T640 230" stroke="#fff" stroke-width="6" fill="none"/>
  <rect y="280" width="${W}" height="140" fill="#fde68a"/>
  <circle cx="300" cy="190" r="40" fill="#f2c9a0"/>
  <path d="M258 180 Q262 140 300 140 Q340 140 342 180 Q330 160 300 160 Q272 160 258 180 Z" fill="#facc15"/>
  <circle cx="287" cy="192" r="5" fill="#1f2937"/><circle cx="313" cy="192" r="5" fill="#1f2937"/>
  <path d="M287 208 Q300 220 313 208" stroke="#9f1239" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M260 235 L340 235 L360 330 L240 330 Z" fill="#ec4899"/>
  <path d="M262 245 L215 205" stroke="#f2c9a0" stroke-width="14" stroke-linecap="round"/>
  <path d="M338 245 L380 290" stroke="#f2c9a0" stroke-width="14" stroke-linecap="round"/>
  <path d="M380 290 L420 250 L440 300 Z" fill="#ef4444"/>
  <rect x="420" y="320" width="60" height="40" fill="#f97316"/><path d="M415 320 L485 320 L475 300 L425 300 Z" fill="#fb923c"/>
</svg>`
const garden = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#e0f2fe"/>
  <rect y="250" width="${W}" height="170" fill="#86efac"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${70 + i * 100} 330 L${70 + i * 100} 240" stroke="#15803d" stroke-width="8"/>
    <circle cx="${70 + i * 100}" cy="225" r="34" fill="${['#f43f5e', '#f59e0b', '#a855f7', '#ec4899', '#ef4444', '#facc15'][i]}"/>
    <circle cx="${70 + i * 100}" cy="225" r="12" fill="#fef9c3"/>`).join('')}
  <text x="320" y="70" text-anchor="middle" font-family="Arial" font-weight="700" font-size="34" fill="#166534">Anna’s roses are out</text>
</svg>`

/** "Twinkle, Twinkle, Little Star" (traditional), synthesised as a small WAV. */
function twinkleWav() {
  const rate = 11025
  const notes = 'C C G G A A G- F F E E D D C- G G F F E E D- G G F F E E D- C C G G A A G- F F E E D D C-'.split(' ')
  const freq = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0 }
  const beat = 0.42
  const samples = []
  for (const n of notes) {
    const len = (n.endsWith('-') ? 2 : 1) * beat
    const f = freq[n[0]]
    const count = Math.floor(len * rate)
    for (let i = 0; i < count; i++) {
      const t = i / rate
      const env = Math.min(1, t / 0.02) * Math.exp(-2.2 * t) // soft piano-like decay
      const v = env * (0.6 * Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t) + 0.1 * Math.sin(6 * Math.PI * f * t))
      samples.push(Math.round(128 + 90 * v))
    }
  }
  const data = Buffer.from(samples)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return 'data:audio/wav;base64,' + Buffer.concat([h, data]).toString('base64')
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
const out = {}
for (const [name, svg] of Object.entries({
  medical: building,
  shops,
  home,
  anna: portrait('#fde68a', '#f2c9a0', '#7c2d12', '#2563eb', true),
  sarah: portrait('#c7d2fe', '#d9a37a', '#e5e7eb', '#db2777', false),
  gym,
  coffee,
  lily,
  garden,
})) {
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${W}px;height:${H}px}</style>${svg}`)
  const buf = await page.screenshot({ type: 'jpeg', quality: 78 })
  out[name] = 'data:image/jpeg;base64,' + buf.toString('base64')
  console.log(name, Math.round(buf.length / 1024) + ' KB')
}
await browser.close()
out.song = twinkleWav()
console.log('song', Math.round((out.song.length * 0.75) / 1024) + ' KB')
writeFileSync(
  new URL('../shared/demoMedia.ts', import.meta.url),
  `// Generated by scripts/make-demo-media.mjs: illustrations standing in for the photos a family would take.\n` +
    `export const demoMedia = ${JSON.stringify(out, null, 2)} as const\n`,
)
