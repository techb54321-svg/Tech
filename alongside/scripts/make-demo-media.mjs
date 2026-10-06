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

// Calm scenes standing in for family photos: no cartoon people, no writing on them.
const beach = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec5de"/><stop offset="1" stop-color="#e9dfcf"/></linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f7896"/><stop offset="1" stop-color="#6fa3b5"/></linearGradient>
    <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c29c"/><stop offset="1" stop-color="#bfa47a"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <path d="M0 200 C90 150 170 140 250 175 C290 192 320 196 360 200 L0 200 Z" fill="#5d7a5a"/>
  <rect y="198" width="${W}" height="110" fill="url(#sea)"/>
  <path d="M0 300 C120 286 220 296 340 288 C460 280 560 292 ${W} 284 L${W} ${H} L0 ${H} Z" fill="url(#sand)"/>
  <path d="M0 300 C120 286 220 296 340 288 C460 280 560 292 ${W} 284" stroke="#f4efe6" stroke-width="5" fill="none" opacity="0.8"/>
  <path d="M40 250 C140 244 240 252 340 246 C440 240 540 250 ${W} 244" stroke="#cfe2ea" stroke-width="2" fill="none" opacity="0.6"/>
</svg>`
const garden = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d9c4"/><stop offset="1" stop-color="#8fae7f"/></linearGradient>
    <radialGradient id="rose" cx="0.4" cy="0.4" r="0.7"><stop offset="0" stop-color="#e7a1a6"/><stop offset="1" stop-color="#a8424f"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g-sky)"/>
  <rect y="300" width="${W}" height="120" fill="#5f7d4d"/>
  <ellipse cx="320" cy="300" rx="300" ry="120" fill="#4e6b3f"/>
  ${[[150, 210, 34], [230, 170, 40], [320, 215, 36], [410, 175, 42], [490, 225, 32], [280, 270, 30], [370, 265, 34]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#rose)"/><circle cx="${x - r / 4}" cy="${y - r / 4}" r="${r / 3}" fill="#f1c4c6" opacity="0.5"/>`).join('')}
</svg>`

/** A short, quiet, original piano piece (C – Am – F – G arpeggios), synthesised as a small WAV. */
function pianoWav() {
  const rate = 11025
  const chords = [[130.81, 196.0, 261.63, 329.63], [110.0, 164.81, 220.0, 261.63], [87.31, 174.61, 220.0, 261.63], [98.0, 146.83, 196.0, 246.94]]
  const step = 0.36
  const samples = []
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar % 4]
    for (const n of [0, 1, 2, 3, 2, 1]) {
      const f = chord[n]
      const count = Math.floor(step * rate)
      for (let i = 0; i < count; i++) {
        const t = i / rate
        const env = Math.min(1, t / 0.015) * Math.exp(-3 * t) // soft piano-like decay
        const v = env * (0.6 * Math.sin(2 * Math.PI * f * t) + 0.2 * Math.sin(4 * Math.PI * f * t) + 0.08 * Math.sin(6 * Math.PI * f * t))
        samples.push(Math.round(128 + 70 * v))
      }
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
  beach,
  garden,
})) {
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${W}px;height:${H}px}</style>${svg}`)
  const buf = await page.screenshot({ type: 'jpeg', quality: 78 })
  out[name] = 'data:image/jpeg;base64,' + buf.toString('base64')
  console.log(name, Math.round(buf.length / 1024) + ' KB')
}
await browser.close()
out.song = pianoWav()
console.log('song', Math.round((out.song.length * 0.75) / 1024) + ' KB')
writeFileSync(
  new URL('../shared/demoMedia.ts', import.meta.url),
  `// Generated by scripts/make-demo-media.mjs: illustrations standing in for the photos a family would take.\n` +
    `export const demoMedia = ${JSON.stringify(out, null, 2)} as const\n`,
)
