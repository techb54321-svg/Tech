// Builds the browser-only demonstration as one self-contained HTML file
// (dist-static/hazel-preview.html) that needs no server.
//   npm run build:preview
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
execSync('npx vite build', { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_STATIC_DEMO: '1' } })
const out = join(root, 'dist-static')
const css = readdirSync(out).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(out, f), 'utf8')).join('\n')
const js = readFileSync(join(out, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script')
const icon = readFileSync(join(root, 'public', 'icons', 'icon.svg')).toString('base64')
const html = `<meta charset="utf-8">
<title>Hazel</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${icon}">
<meta name="theme-color" content="#111318">
<meta name="description" content="Hazel: a simple daily helper for an older person, with family support behind the scenes. Browser-only demonstration.">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
writeFileSync(join(out, 'hazel-preview.html'), html)
console.log(`Wrote dist-static/hazel-preview.html (${(html.length / 1024).toFixed(0)} KB)`)
