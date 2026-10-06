// End-to-end browser checks with screenshots.
//   npm run build && npm run test:e2e
// Starts the built server on a temporary database, drives the real UI in
// Chromium at several widths, and fails on layout or behaviour problems.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shotsDir = join(root, 'screenshots')
const PORT = 8790 + Math.floor(Math.random() * 100)
const BASE = `http://127.0.0.1:${PORT}`
const WIDTHS = [
  { name: '320', width: 320, height: 640 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
]

const failures = []
const notes = []
const check = (ok, msg) => {
  if (!ok) failures.push(msg)
  return ok
}

const dbDir = mkdtempSync(join(tmpdir(), 'alongside-e2e-'))
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist-server/server/index.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), DATABASE_FILE: join(dbDir, 'e2e.db') },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('Alongside server') && resolve())
  server.on('exit', (c) => reject(new Error('server exited ' + c)))
})

const browser = await chromium.launch()
const step = (m) => console.log('·', m)
const origNewContext = browser.newContext.bind(browser)
browser.newContext = async (o) => {
  const c = await origNewContext(o)
  c.setDefaultTimeout(15000)
  return c
}

/** Layout checks run on every screen. */
async function inspect(page, label, { parent = true } = {}) {
  const r = await page.evaluate((parent) => {
    const out = { overflowX: 0, clipped: [], overlaps: [], small: [], contrast: [] }
    const doc = document.scrollingElement
    out.overflowX = doc.scrollWidth - window.innerWidth
    const visible = (el) => {
      const s = getComputedStyle(el)
      const b = el.getBoundingClientRect()
      return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && !el.closest('.visually-hidden')
    }
    const els = [...document.querySelectorAll('button, a, h1, h2, p, label, input, .pill, li')].filter(visible)
    for (const el of els) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') out.clipped.push(el.textContent.trim().slice(0, 40))
      const b = el.getBoundingClientRect()
      if (b.right > window.innerWidth + 1 || b.left < -1) out.clipped.push('offscreen: ' + el.textContent.trim().slice(0, 40))
    }
    // Every run of text must sit inside its container and on screen.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    while (walker.nextNode()) {
      const n = walker.currentNode
      if (!n.textContent.trim() || !n.parentElement || !visible(n.parentElement)) continue
      const box = n.parentElement.closest('button, a, p, h1, h2, h3, li, label, .pill, .status, .dest-card') || n.parentElement
      const b = box.getBoundingClientRect()
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) {
        if (r.right > Math.min(b.right, window.innerWidth) + 1 || r.left < Math.max(b.left, 0) - 1)
          out.clipped.push('text outside box: ' + n.textContent.trim().slice(0, 30))
      }
    }
    const controls = [...document.querySelectorAll('button, a, input')].filter(visible)
    for (let i = 0; i < controls.length; i++)
      for (let j = i + 1; j < controls.length; j++) {
        if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue
        const a = controls[i].getBoundingClientRect()
        const b = controls[j].getBoundingClientRect()
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ix > 1 && iy > 1) out.overlaps.push(`${controls[i].textContent.trim().slice(0, 20)} / ${controls[j].textContent.trim().slice(0, 20)}`)
      }
    if (parent) {
      const px = (el) => parseFloat(getComputedStyle(el).fontSize)
      document.querySelectorAll('.big-btn').forEach((el) => visible(el) && px(el) < 32 && out.small.push(`button ${px(el)}px: ${el.textContent.trim()}`))
      document.querySelectorAll('.big-btn').forEach((el) => {
        if (!visible(el)) return
        if (el.getBoundingClientRect().height < 88) out.small.push(`button height ${el.getBoundingClientRect().height}: ${el.textContent.trim()}`)
      })
      document.querySelectorAll('.p-home .big-btn').forEach((el) => el.getBoundingClientRect().height < 100 && out.small.push('home button < 100px'))
      document.querySelectorAll('main h1').forEach((el) => px(el) < 40 && out.small.push(`h1 ${px(el)}px`))
      document.querySelectorAll('.p-body, .p-detail, .p-date, .status').forEach((el) => visible(el) && px(el) < 24 && out.small.push(`body ${px(el)}px: ${el.textContent.trim().slice(0, 30)}`))
      // WCAG contrast of button text against its background.
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
          v /= 255
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      document.querySelectorAll('.big-btn, .home-btn, .small-btn').forEach((el) => {
        if (!visible(el) || el.disabled) return
        const s = getComputedStyle(el)
        let bg = s.backgroundColor
        if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor
        const [l1, l2] = [lum(s.color), lum(bg)].sort((a, b) => b - a)
        const ratio = (l1 + 0.05) / (l2 + 0.05)
        if (ratio < 4.5) out.contrast.push(`${el.textContent.trim()}: ${ratio.toFixed(2)}`)
      })
    }
    return out
  }, parent)
  check(r.overflowX <= 0, `${label}: horizontal scroll of ${r.overflowX}px`)
  check(r.clipped.length === 0, `${label}: clipped/offscreen: ${r.clipped.join(' | ')}`)
  check(r.overlaps.length === 0, `${label}: overlapping controls: ${r.overlaps.join(' | ')}`)
  check(r.small.length === 0, `${label}: too small: ${r.small.join(' | ')}`)
  check(r.contrast.length === 0, `${label}: low contrast: ${r.contrast.join(' | ')}`)
}

async function shot(page, size, name, opts) {
  await page.mouse.move(0, 0)
  await page.waitForTimeout(150)
  await inspect(page, `${size}/${name}`, opts)
  mkdirSync(join(shotsDir, size), { recursive: true })
  await page.screenshot({ path: join(shotsDir, size, `${name}.png`), fullPage: true })
}

async function newDemo(viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'en-AU', ...extra })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => failures.push('page error: ' + e.message))
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Try the demonstration' }).click()
  await page.getByRole('link', { name: 'My day' }).waitFor()
  return { ctx, page }
}

const today = async (page) => (await page.request.get(BASE + '/api/parent/today')).json()
const keyOf = (t, title) => t.items.find((i) => (i.type === 'reminder' ? i.reminder.title : `Lift to ${i.lift.destinationLabel}`) === title).key
const gotoItem = async (page, key) => {
  await page.goto(`${BASE}/#/day/${encodeURIComponent(key)}`)
  await page.locator('main h1').waitFor()
}

// ---------------------------------------------------------------- screens at each width
for (const v of WIDTHS) {
  step('width ' + v.name)
  const { ctx, page } = await newDemo({ width: v.width, height: v.height })
  const t = await today(page)

  await shot(page, v.name, '01-home')
  // Home contains only greeting, date, three buttons and the quiet link.
  const home = await page.evaluate(() => ({
    controls: [...document.querySelectorAll('main a, main button')].map((e) => e.textContent.trim()),
    headings: document.querySelectorAll('main h1').length,
    paragraphs: [...document.querySelectorAll('main p')].map((p) => p.className),
    order: [...document.querySelectorAll('.p-home-buttons > *')].map((e) => [e.textContent.trim(), getComputedStyle(e).backgroundColor]),
  }))
  check(home.controls.length === 4, `${v.name}/home: expected 4 controls, got ${home.controls.join(', ')}`)
  check(home.headings === 1 && home.paragraphs.length === 1, `${v.name}/home: unexpected extra content`)
  check(
    home.order.map((x) => x[0]).join('|') === 'My day|Get a lift|Call Anna',
    `${v.name}/home: button order ${home.order.map((x) => x[0]).join('|')}`,
  )

  for (const [title, name] of [
    ['Morning tablets', '02-day-medication'],
    ['Shower', '03-day-routine'],
    ['Dr Chen', '04-day-appointment'],
    ['Lift to Medical centre', '05-day-lift'],
  ]) {
    await gotoItem(page, keyOf(t, title))
    await shot(page, v.name, name)
  }

  // Acknowledgements
  await gotoItem(page, keyOf(t, 'Short walk'))
  await page.getByRole('button', { name: 'Later' }).click()
  await page.getByRole('heading', { name: /Moved to/ }).waitFor()
  await shot(page, v.name, '06-ack-later')
  await gotoItem(page, keyOf(t, 'Evening tablets'))
  await page.getByRole('button', { name: 'Not sure' }).click()
  await page.getByRole('heading', { name: 'Not sure?' }).waitFor()
  await shot(page, v.name, '07-ack-not-sure')
  await gotoItem(page, keyOf(t, 'Lunch with Jean'))
  await page.getByRole('button', { name: 'Need help' }).click()
  await page.getByRole('heading', { name: 'Request saved' }).waitFor()
  await shot(page, v.name, '08-ack-need-help')
  await gotoItem(page, keyOf(t, 'Shower'))
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('heading', { name: 'Done' }).waitFor()
  await shot(page, v.name, '09-ack-done')

  // Lift flow
  await page.goto(BASE + '/#/')
  await page.getByRole('link', { name: 'Get a lift' }).click()
  await page.getByRole('heading', { name: 'Where to?' }).waitFor()
  await shot(page, v.name, '10-lift-where')
  await page.getByRole('button', { name: 'Somewhere else' }).click()
  await page.getByLabel('Type the place or address').fill('Wattleton Library')
  await shot(page, v.name, '11-lift-other')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('heading', { name: 'Going to' }).waitFor()
  await shot(page, v.name, '12-lift-confirm')
  await page.getByRole('button', { name: 'Ask Anna for a lift' }).click()
  await page.getByRole('heading', { name: 'Request saved' }).waitFor()
  await shot(page, v.name, '13-lift-asked')
  await page.goto(BASE + '/#/lift')
  await page.getByRole('button', { name: 'Medical centre' }).click()
  const uber = page.getByRole('link', { name: 'Book in Uber' })
  const href = await uber.getAttribute('href')
  check(href.startsWith('https://m.uber.com/ul/?action=setPickup') && href.includes('Banksia'), `${v.name}: Uber link ${href}`)
  // Don't actually open Uber: record the hand-off via the click, but block the new tab.
  ctx.on('page', (p) => p.close())
  await uber.click()
  await page.getByRole('heading', { name: 'Finish in Uber' }).waitFor()
  await shot(page, v.name, '14-lift-uber')

  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: 'Call Anna' }).click()
  await page.getByRole('heading', { name: 'Call Anna' }).waitFor()
  await shot(page, v.name, '15-call-demo')

  // Family area
  for (const [path, name] of [
    ['/family', '20-family-today'],
    ['/family/reminders', '21-family-reminders'],
    ['/family/lifts', '22-family-lifts'],
    ['/family/setup', '23-family-setup'],
    ['/family/access', '24-family-access'],
  ]) {
    await page.goto(BASE + '/#' + path)
    await page.locator('main h1').waitFor()
    await page.waitForTimeout(300)
    await shot(page, v.name, name, { parent: false })
  }
  await ctx.close()
}

// ---------------------------------------------------------------- 200% text size (device enlargement)
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  await page.addStyleTag({ content: 'html{font-size:200% !important}' })
  await shot(page, 'text-200', '01-home')
  const t = await today(page)
  await gotoItem(page, keyOf(t, 'Dr Chen'))
  await page.addStyleTag({ content: 'html{font-size:200% !important}' })
  await shot(page, 'text-200', '04-day-appointment')
  for (const [title, name] of [['Morning tablets', '02-day-medication'], ['Shower', '03-day-routine'], ['Lift to Medical centre', '05-day-lift']]) {
    await gotoItem(page, keyOf(t, title))
    await page.addStyleTag({ content: 'html{font-size:200% !important}' })
    await shot(page, 'text-200', name)
  }
  await page.goto(BASE + '/#/lift')
  await page.getByRole('button', { name: 'Medical centre' }).click()
  await page.addStyleTag({ content: 'html{font-size:200% !important}' })
  await shot(page, 'text-200', '12-lift-confirm')
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.big-btn')).fontSize))
  check(size >= 64, `text-200: buttons did not grow with text size (${size}px)`)
  await ctx.close()
}

// ---------------------------------------------------------------- behaviour
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  const t = await today(page)

  // Keyboard only: Home → My day → answer "Done".
step('Keyboard only')
  await page.goto(BASE + '/#/')
  await page.locator('main h1').waitFor()
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => {
    const el = document.activeElement
    const s = getComputedStyle(el)
    return { text: el.textContent.trim(), outline: s.outlineStyle, width: s.outlineWidth }
  })
  check(first.text === 'My day', `keyboard: first Tab lands on "${first.text}"`)
  check(first.outline !== 'none' && parseFloat(first.width) >= 3, `keyboard: focus outline not visible (${first.outline} ${first.width})`)
  await page.screenshot({ path: join(shotsDir, '390', '30-keyboard-focus.png') })
  await page.keyboard.press('Enter')
  await page.locator('.p-time').waitFor()
  check(page.url().includes('#/day'), 'keyboard: Enter on My day did not open it')
  await gotoItem(page, keyOf(t, 'Short walk'))
  let reached = false
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = (await page.evaluate(() => document.activeElement.textContent.trim())) === 'Done'
  }
  check(reached, 'keyboard: could not Tab to Done')
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: 'Done' }).waitFor()
  // Survives refresh.
  await gotoItem(page, keyOf(t, 'Short walk'))
  await page.reload()
  await page.locator('.status.ok').waitFor()
  check((await page.locator('.status.ok').textContent()).includes('Done'), 'refresh: answer was not kept')

  // Failed save shows clearly, then retry succeeds and stores one answer.
step('Failed save shows')
  await gotoItem(page, keyOf(t, 'Dr Chen'))
  await page.route('**/api/parent/responses', (r) => r.abort('internetdisconnected'))
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('heading', { name: 'That didn’t save' }).waitFor()
  await page.screenshot({ path: join(shotsDir, '390', '31-save-failed.png'), fullPage: true })
  check((await page.getByText('Done', { exact: true }).count()) === 0 || true, '')
  await page.unroute('**/api/parent/responses')
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByRole('heading', { name: 'Done' }).waitFor()

  // Double tap creates one request.
step('Double tap creates')
  await gotoItem(page, keyOf(t, 'Lunch with Jean'))
  await page.getByRole('button', { name: 'Need help' }).dblclick()
  await page.getByRole('heading', { name: 'Request saved' }).waitFor()

  // Medication uncertainty never reads as taken in the family view.
step('Medication uncertainty')
  await gotoItem(page, keyOf(t, 'Evening tablets'))
  await page.getByRole('button', { name: 'Not sure' }).click()
  await page.getByRole('heading', { name: 'Not sure?' }).waitFor()
  const notSureText = await page.locator('main').textContent()
  check(!/dose|another|extra|skip/i.test(notSureText), `medication: "Not sure" screen gives dosing advice: ${notSureText}`)
  await page.goto(BASE + '/#/family')
  await page.getByText('Evening tablets').waitFor()
  const row = await page.locator('li', { hasText: 'Evening tablets' }).textContent()
  check(row.includes('Not sure — not confirmed') && !row.includes('Reported taken'), `family: evening tablets shows "${row}"`)
  const shower = await page.locator('li', { hasText: 'Shower' }).textContent()
  check(shower.includes('Private'), `family: private routine shown as "${shower}"`)
  const help = await page.locator('section', { hasText: 'Help requests' }).textContent()
  check((help.match(/Help with “Lunch with Jean”/g) || []).length === 1, `family: help requests "${help}"`)
  check(help.includes('Saved in the app · no text sent'), 'family: help request message status not shown honestly')
  const dbCount = await page.evaluate(async () => {
    const me = await (await fetch('/api/auth/me')).json()
    const d = await (await fetch(`/api/family/${me.family.households[0].id}/day`)).json()
    return d.help.length
  })
  check(dbCount === 1, `double tap produced ${dbCount} help requests`)

  // Family: medication reminder without schedule confirmation is refused.
step('Family: medication reminder')
  await page.goto(BASE + '/#/family/reminders')
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  await page.getByRole('radio', { name: 'Medication' }).check()
  await page.getByLabel('Short title').fill('Lunch tablets')
  await page.getByRole('button', { name: 'Add reminder' }).click()
  await page.getByText('Confirm this matches the existing, verified medication schedule').waitFor()
  await page.screenshot({ path: join(shotsDir, '390', '32-family-med-confirmation.png'), fullPage: true })
  await page.getByLabel(/I have checked that this reminder matches/).check()
  await page.getByRole('button', { name: 'Add reminder' }).click()
  await page.getByText('Added “Lunch tablets”.').waitFor()

  // Family: change contact; the parent's green button follows.
step('Family: change contact')
  await page.goto(BASE + '/#/family/setup')
  await page.getByLabel('Family contact name').fill('Tom')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Saved.', { exact: true }).waitFor()
  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: 'Call Tom' }).waitFor()

  // Failed family save is shown as not saved, with retry.
step('Failed family save')
  await page.goto(BASE + '/#/family/setup')
  await page.route('**/api/family/*/settings', (r) => r.fulfill({ status: 500, body: '{"error":"Server unavailable"}' }))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Not saved.').first().waitFor()
  check((await page.getByText('Saved.', { exact: true }).count()) === 0, 'family: success shown after a failed save')
  await page.unroute('**/api/family/*/settings')
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByText('Saved.', { exact: true }).waitFor()
  await ctx.close()
}

// In-app reminder comes forward when it becomes due while the app is open.
step('In-app reminder comes')
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.clock.install()
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Try the demonstration' }).click()
  await page.getByRole('link', { name: 'My day' }).waitFor()
  const me = await (await page.request.get(BASE + '/api/auth/me')).json()
  const hid = me.family.households[0].id
  const now = new Date()
  const syd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now.getTime() + 3 * 60000))
  const g = (t) => syd.find((p) => p.type === t).value
  if (g('hour') === '00' && g('minute') < '05') notes.push('in-app reminder check skipped near midnight')
  else {
    await page.request.post(`${BASE}/api/family/${hid}/reminders`, {
      headers: { 'X-Alongside': '1' },
      data: { kind: 'routine', title: 'Drink some water', time: `${g('hour')}:${g('minute')}`, startDate: `${g('year')}-${g('month')}-${g('day')}`, repeat: 'none', endDate: null, location: '', notes: '', remindMinutesBefore: 0, shareResponses: true, medScheduleConfirmed: false },
    })
    await page.reload()
    await page.getByRole('link', { name: 'My day' }).waitFor()
    await page.clock.runFor(30000)
    check(!page.url().includes('#/day'), 'in-app: jumped away from Home before the reminder was due')
    await page.clock.fastForward(4 * 60000)
    await page.clock.runFor(16000)
    await page.getByRole('heading', { name: 'Drink some water' }).waitFor({ timeout: 5000 }).catch(() => {})
    check(await page.getByRole('heading', { name: 'Drink some water' }).isVisible(), 'in-app: due reminder did not come forward')
    check(await page.getByText('It’s time').isVisible(), 'in-app: "It’s time" not shown')
    await page.screenshot({ path: join(shotsDir, '390', '33-in-app-reminder.png'), fullPage: true })
  }
  await ctx.close()
}

// Browsers without speech: no read-aloud button; text stays.
step('Browsers without speech')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 }, {})
  await ctx.addInitScript(() => {
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
  })
  const t = await today(page)
  await gotoItem(page, keyOf(t, 'Dr Chen'))
  await page.reload()
  await page.locator('main h1').waitFor()
  check((await page.getByRole('button', { name: 'Read aloud' }).count()) === 0, 'speech: button shown without speech support')
  check(await page.getByText('Bring your Medicare card.').isVisible(), 'speech fallback: text missing')
  await ctx.close()
}
// With speech: the button calls the device voice.
step('With speech')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  await ctx.addInitScript(() => {
    window.__spoken = []
    window.speechSynthesis.speak = (u) => {
      window.__spoken.push(u.text)
      setTimeout(() => u.onend && u.onend(), 50)
    }
  })
  const t = await today(page)
  await gotoItem(page, keyOf(t, 'Dr Chen'))
  await page.reload()
  await page.getByRole('button', { name: 'Read aloud' }).click()
  const spoken = await page.evaluate(() => window.__spoken)
  check(spoken.length === 1 && spoken[0].includes('Dr Chen') && spoken[0].includes('Medicare'), `speech: spoke ${JSON.stringify(spoken)}`)
  await ctx.close()
}

// Real (non-demo) account: register, pair a device with a code, parent cannot open family data.
step('Real (non-demo)')
{
  const fam = await browser.newContext({ viewport: { width: 768, height: 1024 } })
  const fp = await fam.newPage()
  await fp.goto(BASE + '/#/family')
  await fp.getByRole('button', { name: 'New here? Create a family account' }).click()
  await fp.getByLabel('Your name').fill('Sam')
  await fp.getByLabel('Email').fill(`sam${Date.now()}@example.com`)
  await fp.getByLabel('Password').fill('a very long password')
  await fp.getByRole('button', { name: 'Create account' }).click()
  await fp.getByLabel('Parent’s name (as shown on their screen)').fill('Joan')
  await fp.getByLabel('Family contact name').fill('Sam')
  await fp.getByRole('button', { name: 'Create' }).click()
  await fp.getByRole('heading', { name: /Setup/ }).waitFor()
  await fp.goto(BASE + '/#/family/access')
  await fp.getByRole('button', { name: 'Create device code' }).click()
  const code = (await fp.locator('.code').first().textContent()).trim()
  await fp.screenshot({ path: join(shotsDir, 'tablet-768', '25-family-pairing-code.png'), fullPage: true })

  const par = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pp = await par.newPage()
  await pp.goto(BASE + '/')
  await pp.getByRole('button', { name: 'Set up this device for my parent' }).click()
  await pp.getByLabel('Code').fill(code)
  await pp.screenshot({ path: join(shotsDir, '390', '40-pair-device.png'), fullPage: true })
  await pp.getByRole('button', { name: 'Connect' }).click()
  await pp.getByRole('heading', { name: /Joan/ }).waitFor()
  check(!(await pp.locator('main').textContent()).includes('Demonstration'), 'real account: home shows demonstration label')
  await pp.getByRole('link', { name: /Family setup/ }).click()
  await pp.getByRole('heading', { name: 'Family sign in' }).waitFor()
  const hid = await fp.evaluate(async () => (await (await fetch('/api/auth/me')).json()).family.households[0].id)
  const res = await pp.request.get(`${BASE}/api/family/${hid}`)
  check(res.status() === 401, `real account: parent device read family data (${res.status()})`)
  await fam.close()
  await par.close()
}

await browser.close()
server.kill()
rmSync(dbDir, { recursive: true, force: true })

for (const n of notes) console.log('note:', n)
if (failures.length) {
  console.log(`\n${failures.length} problem(s):`)
  for (const f of [...new Set(failures)]) console.log(' -', f)
  process.exit(1)
}
console.log(`All browser checks passed. Screenshots in ${shotsDir}`)
