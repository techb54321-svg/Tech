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

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
const out = {}
for (const [name, svg] of Object.entries({ tablets: blister, medical: building, shops, home })) {
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${W}px;height:${H}px}</style>${svg}`)
  const buf = await page.screenshot({ type: 'jpeg', quality: 78 })
  out[name] = 'data:image/jpeg;base64,' + buf.toString('base64')
  console.log(name, Math.round(buf.length / 1024) + ' KB')
}
await browser.close()
writeFileSync(
  new URL('../shared/demoMedia.ts', import.meta.url),
  `// Generated by scripts/make-demo-media.mjs: illustrations standing in for the photos a family would take.\n` +
    `export const demoMedia = ${JSON.stringify(out, null, 2)} as const\n`,
)
