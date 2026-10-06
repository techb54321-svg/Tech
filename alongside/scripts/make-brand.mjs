// Draws the Hazel app icons and logo files from src/brand/hazel.json.
//   node scripts/make-brand.mjs
// Writes public/icons/* (favicon, PWA and Apple icons) and docs/brand/* (logo files).
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const g = JSON.parse(readFileSync(new URL('src/brand/hazel.json', root), 'utf8'))
const c = g.colours

const shapes = (id) => `<defs><clipPath id="${id}"><path d="${g.nut}"/></clipPath></defs>
<path d="${g.stem}" stroke="${c.stem}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="${g.leaf}" fill="${c.leaf}"/><path d="${g.leafShade}" fill="${c.leafShade}"/>
<path d="${g.nut}" fill="${c.nut}"/>
<g clip-path="url(#${id})"><path d="${g.nutShade}" fill="${c.nutShade}"/><path d="${g.base}" fill="${c.base}"/></g>`

// The mark's drawing spans x 26–110, y 3–104; centre it in a 120 square at the given scale.
const centred = (scale, id) => `<g transform="translate(${(60 - 68 * scale).toFixed(2)} ${(60 - 53.5 * scale).toFixed(2)}) scale(${scale})">${shapes(id)}</g>`
const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`

const appIcon = svg('0 0 120 120', `<rect width="120" height="120" rx="27" fill="${c.room}"/>${centred(0.82, 'a')}`)
const fullBleed = (scale) => svg('0 0 120 120', `<rect width="120" height="120" fill="${c.room}"/>${centred(scale, 'f')}`)
const markOnly = svg('20 0 96 108', shapes('m'))
const lockup = (text) => svg('0 0 344 120', `<g transform="translate(-20 6)">${shapes('l')}</g>
<path transform="translate(118 103) scale(${g.wordScale})" fill="${text}" d="${g.word}"/>`)

const icons = new URL('public/icons/', root)
const brand = new URL('docs/brand/', root)
mkdirSync(icons, { recursive: true })
mkdirSync(brand, { recursive: true })
const files = {
  [new URL('icon.svg', icons)]: appIcon,
  [new URL('hazel-app-icon.svg', brand)]: appIcon,
  [new URL('hazel-mark.svg', brand)]: markOnly,
  [new URL('hazel-logo-on-dark.svg', brand)]: lockup(c.ivory),
  [new URL('hazel-logo-on-light.svg', brand)]: lockup(c.ink),
}
for (const [file, text] of Object.entries(files)) writeFileSync(new URL(file), text)

const browser = await chromium.launch()
const page = await browser.newPage()
async function png(markup, w, h, file, transparent = true) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${markup}`)
  writeFileSync(file, await page.screenshot({ omitBackground: transparent }))
  console.log('wrote', file.pathname.replace(root.pathname, ''))
}
await png(appIcon, 192, 192, new URL('icon-192.png', icons))
await png(appIcon, 512, 512, new URL('icon-512.png', icons))
// Maskable: full bleed, mark inside the central safe zone.
await png(fullBleed(0.6), 512, 512, new URL('icon-maskable-512.png', icons), false)
// Apple touch icon: square, iOS rounds the corners itself.
await png(fullBleed(0.78), 180, 180, new URL('apple-touch-icon.png', icons), false)
await png(appIcon, 1024, 1024, new URL('hazel-app-icon.png', brand))
await png(lockup(c.ivory), 1376, 480, new URL('hazel-logo-on-dark.png', brand))
await png(lockup(c.ink), 1376, 480, new URL('hazel-logo-on-light.png', brand))
await browser.close()
