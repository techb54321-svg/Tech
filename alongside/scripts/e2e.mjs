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

// A fake microphone lets the voice recorder run for real in headless Chromium.
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
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
    // Scrolled out of view inside a scrolling list: not on screen, so not part of the layout check.
    const scrolledAway = (el) => {
      const b = el.getBoundingClientRect()
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if (o === 'auto' || o === 'scroll' || o === 'hidden') {
          const r = p.getBoundingClientRect()
          if (b.bottom <= r.top + 1 || b.top >= r.bottom - 1) return true
        }
      }
      return false
    }
    const visible = (el) => {
      const s = getComputedStyle(el)
      const b = el.getBoundingClientRect()
      return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && !el.closest('.visually-hidden') && !scrolledAway(el)
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
      if (n.parentElement.closest('.table-scroll')) continue // wide tables scroll inside their own box
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
      document.querySelectorAll('.tile').forEach((el) => el.getBoundingClientRect().height < 140 && out.small.push('home tile < 140px'))
      document.querySelectorAll('.tile-label').forEach((el) => px(el) < 32 && out.small.push(`tile label ${px(el)}px`))
      document.querySelectorAll('main h1').forEach((el) => px(el) < 40 && out.small.push(`h1 ${px(el)}px`))
      // The day and time, in big letters, on every parent screen.
      const day = document.querySelector('.clock-day')
      const time = document.querySelector('.clock-time')
      if (!day || !time) out.small.push('no day and time shown')
      else if (px(day) < 32 || px(time) < 40) out.small.push(`day/time too small: ${px(day)}/${px(time)}`)
      document.querySelectorAll('.p-body, .p-detail, .p-date, .status').forEach((el) => visible(el) && px(el) < 24 && out.small.push(`body ${px(el)}px: ${el.textContent.trim().slice(0, 30)}`))
      // WCAG contrast of button text against its background.
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
          v /= 255
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      document.querySelectorAll('.big-btn, .home-btn, .small-btn, .tile, .song-btn, .yn').forEach((el) => {
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
const householdId = async (page) => (await (await page.request.get(BASE + '/api/auth/me')).json()).family.households[0].id

/** Sydney wall-clock date and time, `minutes` from now. */
function sydney(minutes) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + minutes * 60000))
  const g = (t) => parts.find((p) => p.type === t).value
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` }
}
// Tests create their own reminders that are due right now, so they behave the same at any time of day.
const nearMidnight = sydney(-10).date !== sydney(40).date
if (nearMidnight) {
  console.log('Too close to midnight in Sydney for the timed checks; run again after 00:10.')
  process.exit(2)
}
let made = 0
async function addDue(page, { kind = 'routine', title, question = '', location = '', notes = '', share = true, minutes = -3 }) {
  const hid = await householdId(page)
  // Small stagger for items due now, so their order is stable; future items keep their exact offset.
  const at = sydney(kind === 'appointment' || kind === 'social' ? 30 : minutes < 0 ? minutes - (made++ % 10) / 10 : minutes)
  const r = await page.request.post(`${BASE}/api/family/${hid}/reminders`, {
    headers: { 'X-Alongside': '1' },
    data: {
      kind, title, time: at.time, startDate: at.date, repeat: 'none', endDate: null, location, notes, question,
      remindMinutesBefore: kind === 'appointment' || kind === 'social' ? 60 : 0, shareResponses: share,
    },
  })
  const { id } = await r.json()
  return `${id}:${at.date}`
}
/** Answer everything that is due, so My day has nothing left for now. */
async function answerAllDue(page) {
  const t = await today(page)
  for (const i of t.items) {
    if (i.type !== 'reminder') continue
    const due = i.status === 'due' || i.status === 'upcoming' && Date.parse(i.dueAt) <= Date.now() || i.status === 'snoozed' && Date.parse(i.snoozeUntil) <= Date.now()
    if (!due) continue
    await page.request.post(BASE + '/api/parent/responses', {
      headers: { 'X-Alongside': '1' },
      data: { clientRequestId: crypto.randomUUID(), reminderId: i.reminder.id, occurrenceDate: i.occurrenceDate, action: i.reminder.ask ? 'yes' : 'done' },
    })
  }
}

/** Find each word across or down in the grid and tap its letters, checking the found-word feedback. */
async function solveWordSearch(page) {
  const words = (await page.locator('.ws-words li').allTextContents()).map((w) => w.replace(/[^A-Z]/g, ''))
  for (const word of words) {
    const letters = (await page.locator('.ws-cell').allTextContents()).map((l) => l.trim())
    const n = 6
    let cells = null
    for (let r = 0; r < n && !cells; r++)
      for (let c = 0; c < n && !cells; c++)
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const idx = [...word].map((_, i) => (r + dr * i) * n + (c + dc * i))
          if (r + dr * (word.length - 1) < n && c + dc * (word.length - 1) < n && idx.every((x, i) => letters[x] === word[i])) {
            cells = idx
            break
          }
        }
    check(!!cells, `puzzle: could not find ${word}`)
    if (!cells) return
    // Tap in a scrambled order: any order works.
    for (const x of [...cells].reverse()) await page.locator('.ws-cell').nth(x).click()
    if (words.indexOf(word) < words.length - 1) await page.getByText(`Yes! You found ${word}.`).waitFor()
  }
}

// ---------------------------------------------------------------- screens at each width
for (const v of WIDTHS) {
  step('width ' + v.name)
  const { ctx, page } = await newDemo({ width: v.width, height: v.height })

  await shot(page, v.name, '01-home')
  // Home: the day and time, a greeting, picture tiles and the quiet family link.
  const tiles = await page.locator('.tiles .tile-label').allTextContents()
  for (const want of ['My day', 'Call Anna', 'Call Sarah', 'Taxi', 'Puzzles', 'Photos', 'Music']) check(tiles.includes(want), `${v.name}/home: no "${want}" tile (${tiles.join(', ')})`)
  check((await page.locator('.tiles .tile .tile-pic').count()) === tiles.length, `${v.name}/home: a tile has no picture`)

  const kettle = await addDue(page, { title: 'Cup of tea', question: 'Have you had a cup of tea?', notes: 'The kettle is on the bench.' })
  const routine = await addDue(page, { title: 'Water the plants', question: 'Have you watered the plants?' })
  const appt = await addDue(page, { kind: 'appointment', title: 'Hairdresser', location: 'Wattleton Hair, 5 Main Street', notes: 'Anna will drive you.' })
  const routine2 = await addDue(page, { title: 'Feed the cat', question: 'Have you fed the cat?' })

  await gotoItem(page, kettle)
  check(await page.getByText('Have you had a cup of tea?').isVisible(), `${v.name}: routine question missing`)
  const answers = await page.locator('.answers button').allTextContents()
  check(answers.join('|') === 'Yes|Not yet|No, not today', `${v.name}: routine answers are ${answers.join('|')}`)
  check((await page.getByText(/of \d+$/).count()) === 0 && (await page.getByRole('button', { name: /Previous/ }).count()) === 0, `${v.name}: counters or browsing still shown`)
  check(!/medication|tablet|dose/i.test(await page.locator('body').textContent()), `${v.name}: medication still mentioned`)
  await shot(page, v.name, '02-day-question')
  await gotoItem(page, routine)
  check(await page.getByText('Have you watered the plants?').isVisible(), `${v.name}: routine question missing`)
  await shot(page, v.name, '03-day-routine')
  await gotoItem(page, appt)
  check((await page.locator('.answers button').allTextContents()).join('|') === 'Okay', `${v.name}: appointment should only offer Okay`)
  await shot(page, v.name, '04-day-appointment')

  await page.goto(BASE + '/#/day/plan')
  await page.getByRole('heading', { name: 'Today’s plan' }).waitFor()
  await shot(page, v.name, '05-day-plan')

  // Answers and their gentle replies
  await gotoItem(page, routine)
  await page.getByRole('button', { name: 'Not yet' }).click()
  await page.getByText('I’ll ask you again soon.').waitFor()
  await shot(page, v.name, '06-ack-not-yet')
  await gotoItem(page, kettle)
  await page.getByRole('button', { name: 'No, not today' }).click()
  await page.getByText('Not today. That’s fine.').waitFor()
  await shot(page, v.name, '07-ack-not-today')
  await gotoItem(page, appt)
  await page.getByRole('button', { name: 'I need help' }).click()
  await page.getByRole('heading', { name: 'Your message is saved for Anna' }).waitFor()
  await shot(page, v.name, '08-ack-need-help')
  await gotoItem(page, routine2)
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByRole('heading', { name: 'Thank you, Margaret' }).waitFor()
  await shot(page, v.name, '09-ack-yes')

  await answerAllDue(page)
  await page.goto(BASE + '/#/day')
  await page.reload()
  await page.locator('main h1').waitFor()
  await page.waitForTimeout(300)
  const h1 = await page.locator('main h1').textContent()
  check(['Nothing to do right now', 'That’s everything for today'].includes(h1), `${v.name}: nothing-due screen shows "${h1}"`)
  await shot(page, v.name, '09b-nothing-now')

  // Lift flow
  await page.goto(BASE + '/#/')
  await page.getByRole('link', { name: 'Taxi' }).click()
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
  ctx.on('page', (p) => p.close())
  await uber.click()
  await page.getByRole('heading', { name: 'Finish in Uber' }).waitFor()
  await shot(page, v.name, '14-lift-uber')

  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: 'Call Anna' }).click()
  await page.getByRole('heading', { name: 'Call Anna' }).waitFor()
  await shot(page, v.name, '15-call-demo')

  // Today's outing cards open what and when, with nothing to answer yet.
  await page.goto(BASE + '/#/')
  const eventCard = page.locator('.event-card a.event-main').first()
  if (await eventCard.count()) {
    const label = (await eventCard.locator('.event-title').textContent()).trim()
    await eventCard.click()
    await page.getByRole('heading', { name: label }).waitFor()
    await shot(page, v.name, '16-event-preview')
  } else notes.push(`${v.name}: no outing later today, so the outing cards were not checked`)

  // Puzzles: solve a word search by tapping letters.
  await page.goto(BASE + '/#/')
  await page.getByRole('link', { name: 'Puzzles' }).click()
  await page.getByRole('heading', { name: 'Word search' }).waitFor()
  await shot(page, v.name, '17-puzzle')
  await solveWordSearch(page)
  await page.getByRole('heading', { name: 'Well done, Margaret!' }).waitFor()
  await shot(page, v.name, '18-puzzle-done')

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
step('Text at 200%')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  const big = () => page.addStyleTag({ content: 'html{font-size:200% !important}' })
  await big()
  await shot(page, 'text-200', '01-home')
  for (const [opts, name] of [
    [{ title: 'Cup of tea', question: 'Have you had a cup of tea?' }, '02-day-question'],
    [{ title: 'Water the plants', question: 'Have you watered the plants?' }, '03-day-routine'],
    [{ kind: 'appointment', title: 'Hairdresser', location: 'Wattleton Hair, 5 Main Street' }, '04-day-appointment'],
  ]) {
    await gotoItem(page, await addDue(page, opts))
    await big()
    await shot(page, 'text-200', name)
  }
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.big-btn')).fontSize))
  check(size >= 64, `text-200: buttons did not grow with text size (${size}px)`)
  await page.goto(BASE + '/#/day/plan')
  await page.locator('main h1').waitFor()
  await big()
  await shot(page, 'text-200', '05-day-plan')
  await ctx.close()
}

// ---------------------------------------------------------------- behaviour
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })

  step('Keyboard only')
  const kb = await addDue(page, { title: 'Water the plants', question: 'Have you watered the plants?' })
  await page.goto(BASE + '/#/')
  await page.locator('main h1').waitFor()
  // Tab through today's outing cards to the "My day" tile.
  let first = { text: '' }
  for (let i = 0; i < 12 && first.text !== 'My day'; i++) {
    await page.keyboard.press('Tab')
    first = await page.evaluate(() => {
      const el = document.activeElement
      const s = getComputedStyle(el)
      return { text: el.textContent.trim(), outline: s.outlineStyle, width: s.outlineWidth }
    })
  }
  check(first.text === 'My day', `keyboard: could not Tab to "My day" (last: "${first.text}")`)
  check(first.outline !== 'none' && parseFloat(first.width) >= 3, `keyboard: focus outline not visible (${first.outline} ${first.width})`)
  await page.screenshot({ path: join(shotsDir, '390', '30-keyboard-focus.png') })
  await page.keyboard.press('Enter')
  await page.locator('main h1').waitFor()
  check(page.url().includes('#/day'), 'keyboard: Enter on My day did not open it')
  await gotoItem(page, kb)
  let reached = false
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = (await page.evaluate(() => document.activeElement.textContent.trim())) === 'Yes'
  }
  check(reached, 'keyboard: could not Tab to Yes')
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: 'Thank you, Margaret' }).waitFor()
  // Survives refresh: the plan shows it as done.
  await page.goto(BASE + '/#/day/plan')
  await page.reload()
  await page.locator('li', { hasText: 'Water the plants' }).getByText('Done').waitFor()

  step('Failed save shows')
  const fs = await addDue(page, { kind: 'appointment', title: 'Hairdresser' })
  await gotoItem(page, fs)
  await page.route('**/api/parent/responses', (r) => r.abort('internetdisconnected'))
  await page.getByRole('button', { name: 'Okay' }).click()
  await page.getByRole('heading', { name: 'That didn’t save' }).waitFor()
  await page.screenshot({ path: join(shotsDir, '390', '31-save-failed.png'), fullPage: true })
  await page.unroute('**/api/parent/responses')
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByRole('heading', { name: 'Thank you, Margaret' }).waitFor()

  step('Double tap creates one request')
  const dt = await addDue(page, { title: 'Feed the cat', question: 'Have you fed the cat?' })
  await gotoItem(page, dt)
  await page.getByRole('button', { name: 'I need help' }).dblclick()
  await page.getByRole('heading', { name: 'Your message is saved for Anna' }).waitFor()

  step('Family view: answers and privacy')
  const fv = await addDue(page, { title: 'Cup of tea', question: 'Have you had a cup of tea?' })
  await gotoItem(page, fv)
  await page.getByRole('button', { name: 'Not yet' }).click()
  await page.getByText('I’ll ask you again soon.').waitFor()
  await page.goto(BASE + '/#/family')
  await page.locator('li', { hasText: 'Cup of tea' }).waitFor()
  const row = await page.locator('li', { hasText: 'Cup of tea' }).first().textContent()
  check(row.includes('Postponed'), `family: cup of tea shows "${row}"`)
  const shower = await page.locator('li', { hasText: 'Shower' }).first().textContent()
  check(shower.includes('Private'), `family: private routine shown as "${shower}"`)
  const help = await page.locator('section', { hasText: 'Help requests' }).first().textContent()
  check((help.match(/Help with “Feed the cat”/g) || []).length === 1, `family: help requests "${help}"`)
  check(help.includes('Saved in the app · no text sent'), 'family: help request message status not shown honestly')

  step('Family: no medication')
  await page.goto(BASE + '/#/family/reminders')
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  check((await page.getByRole('radio', { name: 'Medication' }).count()) === 0, 'family: medication can still be chosen')
  check(!/medication|tablet|pharmac/i.test(await page.locator('main').textContent()), 'family: medication still mentioned in reminders')

  step('Family: change contact')
  await page.goto(BASE + '/#/family/setup')
  await page.getByLabel('Family contact name').fill('Tom')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Saved.', { exact: true }).waitFor()
  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: 'Call Tom' }).waitFor()

  step('Family: add someone to call')
  await page.goto(BASE + '/#/family/setup')
  await page.getByRole('button', { name: 'Add someone to call' }).click()
  await page.getByLabel('Name on the button').fill('Ruth')
  await page.getByLabel('Phone number').fill('0491 570 159')
  await page.locator('section', { hasText: 'People to call' }).getByRole('button', { name: 'Save', exact: true }).click()
  await page.locator('li', { hasText: 'Ruth' }).waitFor()
  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: 'Call Ruth' }).waitFor()

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
step('In-app reminder comes forward')
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  ctx.setDefaultTimeout(15000)
  const page = await ctx.newPage()
  await page.clock.install()
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Try the demonstration' }).click()
  await page.getByRole('link', { name: 'My day' }).waitFor()
  // Only this test's reminder: demo items that happen to fall due now would make the check depend on the time of day.
  const hidIn = await householdId(page)
  const all = (await (await page.request.get(`${BASE}/api/family/${hidIn}`)).json()).reminders
  for (const r of all) await page.request.delete(`${BASE}/api/family/${hidIn}/reminders/${r.id}`, { headers: { 'X-Alongside': '1' } })
  await addDue(page, { title: 'Drink some water', question: 'Have you had a glass of water?', minutes: 3 })
  await page.reload()
  await page.getByRole('link', { name: 'My day' }).waitFor()
  await page.clock.runFor(30000)
  check(!page.url().includes('#/day'), `in-app: jumped away from Home before the reminder was due (${decodeURIComponent(page.url())}: ${await page.locator('main h1').textContent()})`)
  await page.clock.fastForward(4 * 60000)
  await page.clock.runFor(16000)
  await page.getByText('Have you had a glass of water?').waitFor({ timeout: 5000 }).catch(() => {})
  check(await page.getByText('Have you had a glass of water?').isVisible(), 'in-app: due reminder did not come forward')
  await page.screenshot({ path: join(shotsDir, '390', '33-in-app-reminder.png'), fullPage: true })
  await ctx.close()
}

// After answering, "Next" names the next thing due; an idle screen returns Home.
step('Next label and idle return')
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  ctx.setDefaultTimeout(15000)
  const page = await ctx.newPage()
  await page.clock.install()
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Try the demonstration' }).click()
  await page.getByRole('link', { name: 'My day' }).waitFor()
  await answerAllDue(page)
  const a = await addDue(page, { title: 'Water the plants', question: 'Have you watered the plants?', minutes: -4 })
  await addDue(page, { title: 'Feed the cat', question: 'Have you fed the cat?', minutes: -2 })
  await gotoItem(page, a)
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByRole('heading', { name: 'Thank you, Margaret' }).waitFor()
  check(await page.getByRole('button', { name: 'Next: Feed the cat' }).isVisible(), 'ack: next button does not name "Feed the cat"')
  await page.screenshot({ path: join(shotsDir, '390', '57-ack-yes-next.png'), fullPage: true })
  await page.clock.runFor(4 * 60000)
  check(page.url().includes('#/day'), 'idle: returned Home too early')
  await page.clock.runFor(2 * 60000)
  await page.getByRole('link', { name: 'My day' }).waitFor({ timeout: 5000 }).catch(() => {})
  check(!page.url().includes('#/day'), 'idle: did not return Home after 5 minutes')
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
  const k = await addDue(page, { kind: 'appointment', title: 'Hairdresser', notes: 'Bring your glasses.' })
  await gotoItem(page, k)
  await page.reload()
  await page.locator('main h1').waitFor()
  check((await page.getByRole('button', { name: 'Read aloud' }).count()) === 0, 'speech: button shown without speech support')
  check(await page.getByText('Bring your glasses.').isVisible(), 'speech fallback: text missing')
  await ctx.close()
}
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
  const k = await addDue(page, { title: 'Cup of tea', question: 'Have you had a cup of tea?', notes: 'The kettle is on the bench.' })
  await gotoItem(page, k)
  await page.reload()
  await page.getByRole('button', { name: 'Read aloud' }).click()
  const spoken = await page.evaluate(() => window.__spoken)
  check(spoken.length === 1 && spoken[0].includes('Have you had a cup of tea?') && spoken[0].includes('kettle'), `speech: spoke ${JSON.stringify(spoken)}`)
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


// ---------------------------------------------------------------- outings, YES / NO, photos, music
step('Outings, YES / NO, photos and music')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  const hid = await householdId(page)
  // An invitation and a class with transport, due later today whatever the time.
  const later = sydney(60)
  for (const data of [
    { kind: 'social', title: 'Coffee with Jean', ask: true, notes: 'At the Feathers.', pickupTime: later.time, carColour: 'red', carNote: 'Sue the carer' },
    { kind: 'social', title: 'Swimming', subtitle: 'Aqua aerobics', notes: 'Bring a towel.', pickupTime: later.time, returnTime: later.time, carColour: 'green', carNote: 'Anna is driving' },
  ]) {
    await page.request.post(`${BASE}/api/family/${hid}/reminders`, {
      headers: { 'X-Alongside': '1' },
      data: { time: sydney(75).time, startDate: later.date, repeat: 'none', endDate: null, location: '', question: '', remindMinutesBefore: 30, shareResponses: true, medScheduleConfirmed: false, ...data },
    })
  }
  await page.reload()
  const swim = page.locator('.event-card', { hasText: 'Swimming' })
  await swim.waitFor()
  check(await swim.getByText('Aqua aerobics').isVisible(), 'outing: detail not shown on the card')
  check(await swim.getByText('Green car · Anna is driving').isVisible(), 'outing: car colour and driver not written on the card')
  check(await swim.getByText(/^Pick up /).isVisible() && await swim.getByText(/^Home /).isVisible(), 'outing: pick-up and home times missing')
  const coffee = page.locator('.event-card', { hasText: 'Coffee with Jean today?' })
  await coffee.getByRole('button', { name: 'YES' }).click()
  await coffee.getByText('You said YES.').waitFor()
  await shot(page, '390', '60-home-outings')
  await page.goto(BASE + '/#/family')
  const row = await page.locator('li', { hasText: 'Coffee with Jean' }).first().textContent()
  check(row.includes('Said yes'), `family: invitation answer shown as "${row}"`)

  // Photos: today's photo with its caption.
  await page.goto(BASE + '/#/')
  await page.getByRole('link', { name: /Photos/ }).click()
  await page.getByRole('heading', { name: 'Today’s photo' }).waitFor()
  check(await page.locator('img.day-photo').evaluate((i) => i.complete && i.naturalWidth > 0), 'photos: photo did not load')
  check(await page.getByText('Lily at the beach on Sunday').isVisible(), 'photos: caption missing')
  await shot(page, '390', '61-photo')
  await page.getByRole('button', { name: 'Another photo' }).click()
  await page.getByRole('heading', { name: 'Yesterday’s photo' }).waitFor()

  // Music: a big button per song, with the singer.
  await page.goto(BASE + '/#/')
  await page.getByRole('link', { name: 'Music' }).click()
  const songBtn = page.getByRole('button', { name: /Twinkle, Twinkle, Little Star/ })
  await songBtn.waitFor()
  check(await songBtn.getByText('Traditional').isVisible(), 'music: singer not shown')
  await shot(page, '390', '62-music')
  await songBtn.click()
  await page.getByText('Playing · tap to stop').or(page.getByText('This device could not play the song.')).first().waitFor()
  check(await page.getByText('Playing · tap to stop').isVisible(), 'music: the song did not start')

  // Family: choose an Elvis song from the 1960s list and attach a file.
  await page.goto(BASE + '/#/family/media')
  await page.getByLabel('Search songs or singers').fill('elvis')
  await page.locator('.catalogue li', { hasText: 'Can’t Help Falling in Love' }).getByRole('button', { name: 'Choose' }).click()
  check((await page.getByLabel('Song', { exact: true }).inputValue()) === 'Can’t Help Falling in Love', 'songs: title not filled from the list')
  check((await page.getByLabel('Singer or band').inputValue()) === 'Elvis Presley', 'songs: singer not filled from the list')
  const wav = Buffer.concat([Buffer.from('RIFF0000WAVEfmt '), Buffer.alloc(2000, 128)])
  await page.locator('#so-file').setInputFiles({ name: 'my-copy.wav', mimeType: 'audio/wav', buffer: wav })
  await page.getByRole('button', { name: 'Add song' }).click()
  await page.getByText('Added “Can’t Help Falling in Love”.').waitFor()
  await shot(page, '390', '65-family-song-picker', { parent: false })
  await page.goto(BASE + '/#/music')
  await page.getByRole('button', { name: /Can’t Help Falling in Love/ }).waitFor()

  // Family: add a photo of the day, and see the outing fields.
  const bytes = await (await page.request.get(BASE + (await today(page)).photos[0].url)).body()
  await page.goto(BASE + '/#/family/media')
  await page.locator('#ph-file').setInputFiles({ name: 'grandkids.jpg', mimeType: 'image/jpeg', buffer: bytes })
  await page.getByLabel('A few words about it').fill('The grandchildren')
  await page.getByRole('button', { name: 'Add photo' }).click()
  await page.getByText('Photo added for today.').waitFor()
  await shot(page, '390', '63-family-photos-music', { parent: false })
  await page.goto(BASE + '/#/family/reminders')
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  await page.getByRole('button', { name: 'Gym class' }).click()
  await page.getByLabel('Detail in big letters (optional)').fill('Pilates')
  await page.getByText('Blue', { exact: true }).click()
  await shot(page, '390', '64-family-outing-form', { parent: false })
  await ctx.close()
}

// ---------------------------------------------------------------- photos, voice, templates, week
step('Photos, voice and week')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 }, { permissions: ['microphone'] })
  const hid = await householdId(page)
  const t = await today(page)
  // Give a due reminder the demo's medical-centre picture.
  const doctor = t.items.find((i) => i.type === 'reminder' && i.reminder.title === 'Dr Chen')
  const bytes = await (await page.request.get(BASE + doctor.reminder.photoUrl)).body()
  const k = await addDue(page, { title: 'Walk to the shops', question: 'Have you been for your walk?' })
  await page.request.put(`${BASE}/api/family/${hid}/media/reminder/${k.split(':')[0]}/photo`, {
    headers: { 'X-Alongside': '1' },
    data: { dataUrl: 'data:image/jpeg;base64,' + bytes.toString('base64') },
  })
  await gotoItem(page, k)
  const photoOk = await page.locator('img.p-photo').evaluate((img) => img.complete && img.naturalWidth > 0)
  check(photoOk, 'photo: reminder photo did not load')
  await shot(page, '390', '50-reminder-with-photo')
  await page.goto(BASE + '/#/lift')
  await page.getByRole('heading', { name: 'Where to?' }).waitFor()
  check((await page.locator('.big-btn img.thumb').count()) === 3, 'photo: place thumbnails missing')
  await shot(page, '390', '51-lift-with-photos')
  await page.getByRole('button', { name: 'Medical centre' }).click()
  await shot(page, '390', '52-lift-confirm-photo')

  // Family records a voice message with the (fake) microphone.
  const v = await addDue(page, { title: 'Water the plants', question: 'Have you watered the plants?' })
  await page.goto(BASE + '/#/family/reminders')
  await page.locator('li', { hasText: 'Water the plants' }).getByRole('button', { name: 'Edit' }).click()
  check((await page.getByLabel('Question to ask (optional)').inputValue()) === 'Have you watered the plants?', 'question: not shown in the family form')
  await page.getByRole('button', { name: 'Record a message' }).click()
  await page.getByText('Recording… speak now.').waitFor()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /Stop recording/ }).click()
  await page.getByRole('button', { name: 'Remove message' }).waitFor()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText('Saved changes to “Water the plants”.').waitFor()
  await gotoItem(page, v)
  check((await page.getByRole('button', { name: 'Hear Anna' }).count()) === 1, 'voice: parent has no "Hear Anna" button')
  await shot(page, '390', '53-reminder-with-voice')

  // Quick-start templates fill the form, including the question.
  await page.goto(BASE + '/#/family/reminders')
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  await page.getByRole('button', { name: 'Drink a glass of water' }).click()
  check((await page.getByLabel('Short title').inputValue()) === 'Drink a glass of water', 'templates: title not filled')
  check((await page.getByLabel('Question to ask (optional)').inputValue()) === 'Have you had a glass of water?', 'templates: question not filled')
  await shot(page, '390', '54-family-templates', { parent: false })

  // Week grid renders, also on a narrow phone.
  await page.goto(BASE + '/#/family')
  await page.locator('table.week tbody tr').first().waitFor()
  check((await page.locator('table.week tbody tr').count()) >= 5, 'week: rows missing')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.locator('table.week').scrollIntoViewIfNeeded()
  await shot(page, '320', '55-family-week', { parent: false })
  await ctx.close()
}

// ---------------------------------------------------------------- side-by-side, live
step('Side by side')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  ctx.setDefaultTimeout(15000)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => failures.push('page error: ' + e.message))
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'See both screens side by side' }).click()
  const phone = page.getByRole('region', { name: 'Margaret’s phone' })
  const fam = page.getByRole('region', { name: 'Anna’s family area' })
  await phone.getByRole('link', { name: 'Taxi' }).click()
  await phone.getByRole('button', { name: 'Shops' }).click()
  await phone.getByRole('button', { name: 'Ask Anna for a lift' }).click()
  await phone.getByRole('heading', { name: 'Request saved' }).waitFor()
  const t0 = Date.now()
  await fam.getByText('Lift to Shops').first().waitFor({ timeout: 5000 })
  notes.push(`side by side: family view updated ${Date.now() - t0} ms after the request was saved`)
  check(page.url().endsWith('#/both'), 'side by side: panes changed the page address')
  await page.mouse.move(0, 0)
  await page.screenshot({ path: join(shotsDir, 'showcase.png') })
  await ctx.close()
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
