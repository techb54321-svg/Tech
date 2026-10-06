// Renders the SVG icon to the PNG sizes the web app manifest needs.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [size, maskable] of [[192, false], [512, false], [512, true]]) {
  await page.setViewportSize({ width: size, height: size })
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#1d4ed8;display:grid;place-items:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg.replace('rx="96"', 'rx="0"')}</div></div>`
    : svg
  await page.setContent(`<style>html,body{margin:0}svg{width:100%;height:100%;display:block}</style>${inner}`)
  const name = maskable ? `icon-maskable-${size}.png` : `icon-${size}.png`
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: !maskable })
}
await browser.close()
