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

// Photographic-style scenes standing in for family photos: soft gradients,
// haze, grain and a vignette; no people and no writing.
const PW = 1100, PH = 733
const grain = (id) => `
  <filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.09 0"/>
  </filter>`
const vignette = `<radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.38"/></radialGradient>`
/** A smooth ridge line from a few sine waves, closed down to the bottom of the frame. */
function ridge(baseY, amp, seed, w = PW, h = PH) {
  const pts = []
  for (let x = 0; x <= w; x += 10) {
    const y = baseY
      - amp * (0.55 * Math.sin(x / 210 + seed) + 0.3 * Math.sin(x / 97 + seed * 2.3) + 0.15 * Math.sin(x / 41 + seed * 4.1))
    pts.push(`${x},${y.toFixed(1)}`)
  }
  return `M0,${h} L${pts.join(' L')} L${w},${h} Z`
}
const beach = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26335c"/><stop offset="0.35" stop-color="#5d5a8f"/>
      <stop offset="0.58" stop-color="#d98b74"/><stop offset="0.68" stop-color="#f6c48a"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.64" r="0.45"><stop offset="0" stop-color="#ffe7b8" stop-opacity="0.9"/><stop offset="1" stop-color="#ffe7b8" stop-opacity="0"/></radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e2a587"/><stop offset="0.25" stop-color="#9b7b92"/><stop offset="1" stop-color="#34436d"/>
    </linearGradient>
    <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a77f78"/><stop offset="1" stop-color="#5f4a52"/>
    </linearGradient>
    <radialGradient id="streakFade" cx="0.5" cy="0" r="1" gradientTransform="translate(0.5 0) scale(0.5 1) translate(-0.5 0)">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.85" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="streakMask"><rect x="700" y="470" width="185" height="170" fill="url(#streakFade)"/></mask>
    <filter id="clouds" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.012" numOctaves="5" seed="3" result="t"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 0.78  0 0 0 0 0.72  0 0 0 2.4 -1.25"/>
      <feGaussianBlur stdDeviation="1.5"/>
    </filter>
    <filter id="glitter" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.35" numOctaves="2" seed="11" result="t"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 4 -2"/>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="mblurB" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
    ${grain('grain')}
    ${vignette}
  </defs>
  <rect width="${PW}" height="${PH}" fill="url(#sky)"/>
  <rect width="${PW}" height="470" filter="url(#clouds)" opacity="0.55"/>
  <rect width="${PW}" height="${PH}" fill="url(#glow)"/>
  <circle cx="792" cy="452" r="30" fill="#fff4dc"/>
  <path d="${ridge(462, 38, 1.2, 520)}" fill="#3d3456" opacity="0.92"/>
  <path d="${ridge(470, 16, 3.4)}" fill="#6a5574" opacity="0.35" filter="url(#soft)"/>
  <rect y="470" width="${PW}" height="200" fill="url(#sea)"/>
  <rect x="700" y="470" width="185" height="170" filter="url(#glitter)" mask="url(#streakMask)" opacity="0.9"/>
  <path d="M0 640 C220 622 420 646 640 630 C820 618 960 634 ${PW} 624 L${PW} ${PH} L0 ${PH} Z" fill="url(#sand)"/>
  <path d="M0 640 C220 622 420 646 640 630 C820 618 960 634 ${PW} 624" stroke="#fde8d4" stroke-width="3" fill="none" opacity="0.75" filter="url(#soft)"/>
  <ellipse cx="792" cy="660" rx="120" ry="22" fill="#f3c08f" opacity="0.16" filter="url(#mblurB)"/>
  <rect width="${PW}" height="${PH}" filter="url(#grain)"/>
  <rect width="${PW}" height="${PH}" fill="url(#vig)"/>
</svg>`
const mountainLayers = [
  { y: 330, amp: 60, seed: 0.4, fill: '#b9c6d6' },
  { y: 400, amp: 70, seed: 2.1, fill: '#93a7bd' },
  { y: 470, amp: 60, seed: 4.0, fill: '#6f87a0' },
  { y: 560, amp: 55, seed: 5.7, fill: '#4b6279' },
  { y: 650, amp: 45, seed: 7.9, fill: '#2d3f51' },
]
const garden = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}">
  <defs>
    <linearGradient id="msky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fb0cf"/><stop offset="0.55" stop-color="#e9d6c3"/><stop offset="0.75" stop-color="#f6e2c8"/>
    </linearGradient>
    <radialGradient id="msun" cx="0.78" cy="0.36" r="0.4"><stop offset="0" stop-color="#fff6e2" stop-opacity="0.95"/><stop offset="1" stop-color="#fff6e2" stop-opacity="0"/></radialGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ece4" stop-opacity="0"/><stop offset="0.6" stop-color="#f4ece4" stop-opacity="0.75"/><stop offset="1" stop-color="#f4ece4" stop-opacity="0"/></linearGradient>
    <filter id="haze"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="mblur"><feGaussianBlur stdDeviation="14"/></filter>
    ${grain('mgrain')}
    ${vignette}
  </defs>
  <rect width="${PW}" height="${PH}" fill="url(#msky)"/>
  <rect width="${PW}" height="${PH}" fill="url(#msun)"/>
  ${mountainLayers.map((l, i) => `<path d="${ridge(l.y, l.amp, l.seed)}" fill="${l.fill}" filter="url(#haze)"/>
  <rect y="${l.y - 10}" width="${PW}" height="${70 + i * 8}" fill="url(#mist)" filter="url(#mblur)" opacity="${0.75 - i * 0.12}"/>`).join('\n  ')}
  <rect width="${PW}" height="${PH}" filter="url(#mgrain)"/>
  <rect width="${PW}" height="${PH}" fill="url(#vig)"/>
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
  const photo = name === 'beach' || name === 'garden'
  const [w, h] = photo ? [PW, PH] : [W, H]
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`)
  const buf = await page.screenshot({ type: 'jpeg', quality: photo ? 80 : 78 })
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
