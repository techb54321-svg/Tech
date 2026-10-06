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
  server.stdout.on('data', (d) => String(d).includes('Hazel server') && resolve())
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
      // The board: flat tiles with big capitals, buttons big enough to press.
      document.querySelectorAll('.ftile').forEach((el) => visible(el) && el.getBoundingClientRect().height < 140 && out.small.push('tile < 140px'))
      // Tile words: big, and never split across two lines ("PUZZLE / S").
      document.querySelectorAll('.tlabel').forEach((el) => {
        if (!visible(el)) return
        if (px(el) < 24 || (px(el) < 32 && el.closest('.ftile').getBoundingClientRect().width > 220)) out.small.push(`tile label ${px(el)}px: ${el.textContent.trim().slice(0, 20)}`)
      })
      document.querySelectorAll('.tlabel, .tile-btn, .tsub, .tdetail, .board-bar').forEach((el) => {
        if (!visible(el)) return
        const words = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        const rg = document.createRange()
        while (words.nextNode()) {
          const n = words.currentNode
          for (const m of n.textContent.matchAll(/\S+/g)) {
            rg.setStart(n, m.index)
            rg.setEnd(n, m.index + m[0].length)
            const tops = new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))
            if (tops.size > 1) out.clipped.push(`word split over lines: ${m[0]}`)
          }
        }
      })
      document.querySelectorAll('.tile-btn:not(.small)').forEach((el) => {
        if (!visible(el)) return
        if (px(el) < 20 || (px(el) < 28 && el.closest('.ftile').getBoundingClientRect().width > 300)) out.small.push(`tile button ${px(el)}px: ${el.textContent.trim()}`)
        if (el.getBoundingClientRect().height < 60) out.small.push(`tile button height ${el.getBoundingClientRect().height}: ${el.textContent.trim()}`)
      })
      document.querySelectorAll('main h1').forEach((el) => px(el) < 40 && out.small.push(`h1 ${px(el)}px`))
      // The day and time, in big letters, on every parent screen.
      const day = document.querySelector('.clock-day')
      const time = document.querySelector('.clock-time')
      if (!day || !time) out.small.push('no day and time shown')
      else if (px(day) < 32 || px(time) < 40) out.small.push(`day/time too small: ${px(day)}/${px(time)}`)
      document.querySelectorAll('.p-body, .p-detail, .p-date, .status, .tsub, .tchip, .ws-intro').forEach((el) => visible(el) && px(el) < (el.closest('.ftile:not(.wide)') || el.matches('.tchip') ? 20 : 24) && out.small.push(`body ${px(el)}px: ${el.textContent.trim().slice(0, 30)}`))
      // WCAG contrast of button text against its background.
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
          v /= 255
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      // The nearest painted background behind an element.
      const backdrop = (el) => {
        for (let p = el; p; p = p.parentElement) {
          const bg = getComputedStyle(p).backgroundColor
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
        }
        return getComputedStyle(document.body).backgroundColor
      }
      document.querySelectorAll('.big-btn, .small-btn, .tile-btn, .ftile:not(.photo-tile), .tlabel, .tsub, .tile-close, .board-bar').forEach((el) => {
        if (!visible(el) || el.disabled) return
        const s = getComputedStyle(el)
        const bg = backdrop(el)
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
  await page.getByRole('heading', { name: 'Hazel' }).waitFor()
  await page.getByRole('button', { name: 'Try the demonstration' }).click()
  await page.getByRole('button', { name: 'Puzzles' }).waitFor()
  return { ctx, page }
}

const today = async (page) => (await page.request.get(BASE + '/api/parent/today')).json()
const householdId = async (page) => (await (await page.request.get(BASE + '/api/auth/me')).json()).family.households[0].id
/** The parent never leaves the board: the address stays on Home. */
const onHome = (page) => {
  const hash = new URL(page.url()).hash
  return hash === '' || hash === '#/' || hash === '#'
}
/** The tile for a routine that is due now. */
const dueTile = (page, question) => page.locator('.reminder-tile', { hasText: question })
const homeAgain = async (page) => {
  await page.goto(BASE + '/#/')
  await page.reload()
  await page.getByRole('button', { name: 'Puzzles' }).waitFor()
}

/** Sydney wall-clock date and time, `minutes` from now. */
function sydney(minutes) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + minutes * 60000))
  const g = (t) => parts.find((p) => p.type === t).value
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` }
}
// Tests create their own reminders that are due right now, so they behave the same at any time of day.
const nearMidnight = sydney(-10).date !== sydney(150).date
if (nearMidnight) {
  console.log('Too close to midnight in Sydney for the timed checks; run again after 00:10.')
  process.exit(2)
}
let made = 0
async function addDue(page, { kind = 'routine', title, question = '', location = '', notes = '', share = true, minutes = -3, extra = {} }) {
  const hid = await householdId(page)
  // Small stagger for items due now, so their order is stable; future items keep their exact offset.
  const at = sydney(kind === 'appointment' || kind === 'social' ? 30 : minutes < 0 ? minutes - (made++ % 10) / 10 : minutes)
  const r = await page.request.post(`${BASE}/api/family/${hid}/reminders`, {
    headers: { 'X-Hazel': '1' },
    data: {
      kind, title, time: at.time, startDate: at.date, repeat: 'none', endDate: null, location, notes, question,
      remindMinutesBefore: kind === 'appointment' || kind === 'social' ? 60 : 0, shareResponses: share, ...extra,
    },
  })
  const { id } = await r.json()
  return `${id}:${at.date}`
}
/** Answer everything that is due, so the board has nothing to ask for now. */
async function answerAllDue(page) {
  const t = await today(page)
  for (const i of t.items) {
    if (i.type !== 'reminder') continue
    const due = i.status === 'due' || i.status === 'upcoming' && Date.parse(i.dueAt) <= Date.now() || i.status === 'snoozed' && Date.parse(i.snoozeUntil) <= Date.now()
    if (!due) continue
    await page.request.post(BASE + '/api/parent/responses', {
      headers: { 'X-Hazel': '1' },
      data: { clientRequestId: crypto.randomUUID(), reminderId: i.reminder.id, occurrenceDate: i.occurrenceDate, action: i.reminder.ask ? 'yes' : 'done' },
    })
  }
}

/** Find each word across, down or diagonally in the 8 × 8 grid and tap its letters. */
async function solveWordSearch(page) {
  const words = (await page.locator('.ws-words li').allTextContents()).map((w) => w.replace(/[^A-Z]/g, ''))
  check(words.length === 6, `puzzle: ${words.length} words to find, not 6`)
  const n = Math.round(Math.sqrt(await page.locator('.ws-cell').count()))
  check(n === 8, `puzzle: grid is ${n} × ${n}, not 8 × 8`)
  let diagonals = 0
  for (const word of words) {
    const letters = (await page.locator('.ws-cell').allTextContents()).map((l) => l.trim())
    let cells = null
    for (let r = 0; r < n && !cells; r++)
      for (let c = 0; c < n && !cells; c++)
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1]]) {
          const idx = [...word].map((_, i) => (r + dr * i) * n + (c + dc * i))
          if (r + dr * (word.length - 1) < n && c + dc * (word.length - 1) < n && idx.every((x, i) => letters[x] === word[i])) {
            cells = idx
            if (dr && dc) diagonals++
            break
          }
        }
    check(!!cells, `puzzle: could not find ${word}`)
    if (!cells) return
    // Tap in a scrambled order: any order works.
    for (const x of [...cells].reverse()) await page.locator('.ws-cell').nth(x).click()
    if (words.indexOf(word) < words.length - 1) await page.getByText(`Found: ${word}.`).waitFor()
  }
  return diagonals
}

// ---------------------------------------------------------------- screens at each width
let sawDiagonal = false
for (const v of WIDTHS) {
  step('width ' + v.name)
  {
    const wctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, locale: 'en-AU' })
    const w = await wctx.newPage()
    await w.goto(BASE + '/')
    await w.getByRole('heading', { name: 'Hazel' }).waitFor()
    await shot(w, v.name, '00-welcome', { parent: false })
    await wctx.close()
  }
  const { ctx, page } = await newDemo({ width: v.width, height: v.height })

  await shot(page, v.name, '01-home')
  // One board of flat colour tiles: no "My day", nothing that opens another screen.
  const labels = (await page.locator('.board .tlabel').allTextContents()).map((t) => t.trim())
  for (const want of ['Call Sarah', 'Puzzles', 'Music']) check(labels.includes(want), `${v.name}/home: no "${want}" tile (${labels.join(', ')})`)
  check(!labels.includes('Taxi') && (await page.getByRole('button', { name: 'Taxi' }).count()) === 0, `${v.name}/home: Taxi tile still shown`)
  check((await page.locator('.board > .cell').first().locator('.photo-tile').count()) === 1, `${v.name}/home: the photo is not at the top`)
  check(!labels.includes('Call Anna'), `${v.name}/home: "Call Anna" shown although family turned it off`)
  // Outings just show; nothing asks "… today?" with YES / NO.
  check((await page.locator('.yn-row').count()) === 0 && !labels.some((l) => /today\?$/i.test(l)), `${v.name}/home: an outing is asked as a question`)
  // Grown-up look: no cartoon faces or drawings on the board.
  check((await page.locator('.board img.tface').count()) === 0, `${v.name}/home: a cartoon face is shown on a call tile`)
  check((await page.locator('.board .photo-tile img.tphoto').count()) === 1, `${v.name}/home: no photo tile`)
  check((await page.getByText('My day', { exact: true }).count()) === 0, `${v.name}/home: "My day" still shown`)
  check((await page.locator('.board a[href^="#/"]:not(.board-bar)').count()) === 0, `${v.name}/home: a tile links to another screen`)
  const text = await page.locator('body').textContent()
  check(!/medication|tablet|dose/i.test(text), `${v.name}: medication still mentioned`)
  check(!/driving|Sue the carer/i.test(text), `${v.name}: who is driving still shown`)
  check(!/glass of water/i.test(text), `${v.name}: the water reminder is still in the demonstration`)
  check(!/Alongside/.test(await page.locator('body').innerText()) && (await page.title()) === 'Hazel', `${v.name}: the old name is still shown`)
  // Big tiles: never more than two to a row.
  const perRow = await page.evaluate(() => {
    const tops = {}
    for (const c of document.querySelectorAll('.board > .cell')) {
      const t = Math.round(c.getBoundingClientRect().top)
      tops[t] = (tops[t] || 0) + 1
    }
    return Math.max(...Object.values(tops))
  })
  check(perRow <= 2, `${v.name}/home: ${perRow} tiles in a row`)

  await answerAllDue(page)
  const tea = 'Have you had a cup of tea?'
  const plants = 'Have you watered the plants?'
  const cat = 'Have you fed the cat?'
  const walk = 'Have you been for your walk?'
  await addDue(page, { title: 'Cup of tea', question: tea, notes: 'The kettle is on the bench.' })
  await addDue(page, { title: 'Water the plants', question: plants })
  await addDue(page, { title: 'Feed the cat', question: cat })
  await addDue(page, { title: 'Walk', question: walk })
  await addDue(page, { kind: 'appointment', title: 'Hairdresser', location: 'Wattleton Hair, 5 Main Street', notes: 'Bring your glasses.' })
  await homeAgain(page)
  await dueTile(page, tea).waitFor()
  check(await dueTile(page, tea).getByText('The kettle is on the bench.').isVisible(), `${v.name}: routine notes missing`)
  const answers = (await dueTile(page, tea).locator('.answer-grid button').allTextContents()).map((t) => t.trim())
  check(answers.join('|') === 'Yes|Not yet|No|Help', `${v.name}: routine answers are ${answers.join('|')}`)
  check(await page.locator('.event-tile', { hasText: 'Hairdresser' }).isVisible(), `${v.name}: appointment tile missing`)
  await shot(page, v.name, '02-home-due')

  // Every answer is given on the tile; the screen never changes.
  await dueTile(page, plants).getByRole('button', { name: 'Not yet' }).click()
  await page.getByText('Okay. I’ll ask again soon.').waitFor()
  await dueTile(page, tea).getByRole('button', { name: 'No', exact: true }).click()
  await page.getByText('Okay. Not today.').waitFor()
  await dueTile(page, cat).getByRole('button', { name: 'Help' }).click()
  await page.getByText('Your message is saved for Anna').waitFor()
  await dueTile(page, walk).getByRole('button', { name: 'Yes', exact: true }).click()
  await page.getByText('Thank you, Margaret').waitFor()
  check(onHome(page), `${v.name}: answering moved to ${page.url()}`)
  await shot(page, v.name, '03-home-answered')
  // The thank-you tiles go once read.
  await page.waitForTimeout(8500)
  check((await page.locator('.reminder-tile').count()) === 0, `${v.name}: answered tiles stayed on the board`)
  await shot(page, v.name, '04-home-clear')

  await page.getByRole('button', { name: 'Call Sarah' }).click()
  await page.getByText(/This is a demo, so no call is made\. Number: 0491 570 158/).waitFor()
  await shot(page, v.name, '15-call-demo')

  // Puzzles: the harder 8 × 8 word search, solved on its tile.
  await page.getByRole('button', { name: 'Puzzles' }).click()
  await page.locator('.ws-grid').waitFor()
  await shot(page, v.name, '17-puzzle')
  if ((await solveWordSearch(page)) > 0) sawDiagonal = true
  await page.getByText('All six words found, Margaret.').waitFor()
  await shot(page, v.name, '18-puzzle-done')
  await page.getByRole('button', { name: 'Close word search' }).click()
  check(onHome(page), `${v.name}: puzzle moved to ${page.url()}`)

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
    check(!/Alongside/.test(await page.locator('body').innerText()), `${v.name}/${name}: the old name is still shown`)
    check(await page.getByRole('img', { name: 'Hazel' }).first().isVisible(), `${v.name}/${name}: no Hazel logo in the family header`)
    await shot(page, v.name, name, { parent: false })
  }
  await ctx.close()
}
if (!sawDiagonal) notes.push('puzzle: no diagonal word came up in these puzzles (the unit test checks diagonals)')

// ---------------------------------------------------------------- 200% text size (device enlargement)
step('Text at 200%')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  const big = () => page.addStyleTag({ content: 'html{font-size:200% !important}' })
  await addDue(page, { title: 'Cup of tea', question: 'Have you had a cup of tea?', notes: 'The kettle is on the bench.' })
  await addDue(page, { kind: 'social', title: 'Coffee at the Feathers', notes: 'With Jean.', extra: { pickupTime: sydney(20).time, returnTime: sydney(120).time, carColour: 'red' } })
  await homeAgain(page)
  await big()
  await shot(page, 'text-200', '01-home')
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.tile-btn:not(.small)')).fontSize))
  check(size >= 40, `text-200: buttons did not grow with text size (${size}px)`)
  await page.getByRole('button', { name: 'Puzzles' }).click()
  await big()
  await shot(page, 'text-200', '03-puzzle')
  await ctx.close()
}

// ---------------------------------------------------------------- behaviour
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })

  step('Keyboard only')
  await answerAllDue(page)
  await addDue(page, { title: 'Water the plants', question: 'Have you watered the plants?' })
  await homeAgain(page)
  let first = { text: '' }
  for (let i = 0; i < 12 && first.text !== 'Yes'; i++) {
    await page.keyboard.press('Tab')
    first = await page.evaluate(() => {
      const el = document.activeElement
      const s = getComputedStyle(el)
      return { text: el.textContent.trim(), outline: s.outlineStyle, width: s.outlineWidth }
    })
  }
  check(first.text === 'Yes', `keyboard: could not Tab to "Yes" (last: "${first.text}")`)
  check(first.outline !== 'none' && parseFloat(first.width) >= 3, `keyboard: focus outline not visible (${first.outline} ${first.width})`)
  await page.screenshot({ path: join(shotsDir, '390', '30-keyboard-focus.png') })
  await page.keyboard.press('Enter')
  await page.getByText('Thank you, Margaret').waitFor()
  check(onHome(page), 'keyboard: Enter moved away from Home')
  // Survives refresh: saved as done.
  await page.reload()
  await page.getByRole('button', { name: 'Puzzles' }).waitFor()
  check((await page.locator('.reminder-tile', { hasText: 'watered the plants' }).count()) === 0, 'keyboard: answered tile came back after refresh')
  const t = await today(page)
  check(t.items.some((i) => i.type === 'reminder' && i.reminder.title === 'Water the plants' && i.status === 'done'), 'keyboard: answer not saved as done')

  step('Failed save shows')
  await addDue(page, { title: 'Feed the birds', question: 'Have you fed the birds?' })
  await homeAgain(page)
  await page.route('**/api/parent/responses', (r) => r.abort('internetdisconnected'))
  await dueTile(page, 'fed the birds').getByRole('button', { name: 'Yes', exact: true }).click()
  await page.getByText('That didn’t save.').waitFor()
  await page.screenshot({ path: join(shotsDir, '390', '31-save-failed.png'), fullPage: true })
  await page.unroute('**/api/parent/responses')
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByText('Thank you, Margaret').waitFor()

  step('Double tap creates one request')
  await addDue(page, { title: 'Feed the cat', question: 'Have you fed the cat?' })
  await homeAgain(page)
  await dueTile(page, 'fed the cat').getByRole('button', { name: 'Help' }).dblclick()
  await page.getByText('Your message is saved for Anna').waitFor()

  step('Family view: answers and privacy')
  await addDue(page, { title: 'Cup of tea', question: 'Have you had a cup of tea?' })
  await homeAgain(page)
  await dueTile(page, 'cup of tea').getByRole('button', { name: 'Not yet' }).click()
  await page.getByText('Okay. I’ll ask again soon.').waitFor()
  await page.goto(BASE + '/#/family')
  await page.locator('li', { hasText: 'Cup of tea' }).waitFor()
  const row = await page.locator('li', { hasText: 'Cup of tea' }).first().textContent()
  check(row.includes('Postponed'), `family: cup of tea shows "${row}"`)
  const shower = await page.locator('li', { hasText: 'Shower' }).first().textContent()
  check(shower.includes('Private'), `family: private routine shown as "${shower}"`)
  const help = await page.locator('section', { hasText: 'Help requests' }).first().textContent()
  check((help.match(/Help with “Feed the cat”/g) || []).length === 1, `family: help requests "${help}"`)
  check(help.includes('Saved in the app · no text sent'), 'family: help request message status not shown honestly')

  step('Family: no medication, no driver')
  await page.goto(BASE + '/#/family/reminders')
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  check((await page.getByRole('radio', { name: 'Medication' }).count()) === 0, 'family: medication can still be chosen')
  check(!/medication|tablet|pharmac/i.test(await page.locator('main').textContent()), 'family: medication still mentioned in reminders')
  await page.getByRole('button', { name: 'Gym class' }).click()
  check((await page.getByLabel(/Who is driving/).count()) === 0, 'family: "Who is driving" still asked')

  step('Family: change contact')
  await page.goto(BASE + '/#/family/setup')
  await page.getByLabel('Family contact name').fill('Tom')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Saved.', { exact: true }).waitFor()
  await homeAgain(page)
  check((await page.getByRole('button', { name: 'Call Tom' }).count()) === 0, 'family: Call Tom shown while the family contact tile is off')
  // Turning the family contact's tile on shows it.
  await page.goto(BASE + '/#/family/setup')
  await page.getByLabel('Show a “Call Tom” tile').check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Saved.', { exact: true }).waitFor()
  await homeAgain(page)
  await page.getByRole('button', { name: 'Call Tom' }).waitFor()

  step('Family: add someone to call')
  await page.goto(BASE + '/#/family/setup')
  await page.getByRole('button', { name: 'Add someone to call' }).click()
  await page.getByLabel('Name on the button').fill('Ruth')
  await page.getByLabel('Phone number').fill('0491 570 159')
  await page.locator('section', { hasText: 'People to call' }).getByRole('button', { name: 'Save', exact: true }).click()
  await page.locator('li', { hasText: 'Ruth' }).waitFor()
  await homeAgain(page)
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

// Old links to removed screens land on the same board.
step('Old links')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  for (const old of ['/day', '/day/plan', '/lift', '/puzzles', '/photos', '/music']) {
    await page.goto(BASE + '/#' + old)
    await page.getByRole('button', { name: 'Puzzles' }).waitFor()
    check(await page.getByRole('button', { name: 'Puzzles' }).isVisible(), `old link ${old}: board not shown`)
  }
  await ctx.close()
}

// A reminder that falls due while the app is open appears on the board, with no change of screen.
step('In-app reminder appears')
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  ctx.setDefaultTimeout(15000)
  const page = await ctx.newPage()
  await page.clock.install()
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Try the demonstration' }).click()
  await page.getByRole('button', { name: 'Puzzles' }).waitFor()
  // Only this test's reminder: demo items that happen to fall due now would make the check depend on the time of day.
  const hidIn = await householdId(page)
  const all = (await (await page.request.get(`${BASE}/api/family/${hidIn}`)).json()).reminders
  for (const r of all) await page.request.delete(`${BASE}/api/family/${hidIn}/reminders/${r.id}`, { headers: { 'X-Hazel': '1' } })
  await addDue(page, { title: 'Lunch', question: 'Have you had your lunch?', minutes: 3 })
  await page.reload()
  await page.getByRole('button', { name: 'Puzzles' }).waitFor()
  await page.clock.runFor(30000)
  check((await page.getByText('Have you had your lunch?').count()) === 0, 'in-app: shown before it was due')
  await page.clock.fastForward(4 * 60000)
  await page.clock.runFor(16000)
  await page.getByText('Have you had your lunch?').waitFor({ timeout: 5000 }).catch(() => {})
  check(await page.getByText('Have you had your lunch?').isVisible(), 'in-app: due reminder did not appear')
  check(onHome(page), `in-app: moved to ${page.url()}`)
  await page.screenshot({ path: join(shotsDir, '390', '33-in-app-reminder.png'), fullPage: true })

  // An opened tile closes by itself after five minutes untouched.
  await page.getByRole('button', { name: 'Puzzles' }).click()
  await page.locator('.ws-grid').waitFor()
  await page.clock.runFor(4 * 60000)
  check(await page.locator('.ws-grid').isVisible(), 'idle: puzzle closed too early')
  await page.clock.runFor(2 * 60000)
  await page.getByRole('button', { name: 'Puzzles' }).waitFor({ timeout: 5000 }).catch(() => {})
  check((await page.locator('.ws-grid').count()) === 0, 'idle: puzzle did not close after 5 minutes')
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
  await addDue(page, { title: 'Cup of tea', question: 'Have you had a cup of tea?', notes: 'The kettle is on the bench.' })
  await homeAgain(page)
  check((await page.getByRole('button', { name: 'Read aloud' }).count()) === 0, 'speech: button shown without speech support')
  check(await page.getByText('The kettle is on the bench.').isVisible(), 'speech fallback: text missing')
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
  await answerAllDue(page)
  await addDue(page, { title: 'Cup of tea', question: 'Have you had a cup of tea?', notes: 'The kettle is on the bench.' })
  await homeAgain(page)
  await dueTile(page, 'cup of tea').getByRole('button', { name: 'Read aloud' }).click()
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
  check(!(await pp.locator('.board-bar').innerText()).includes('Demo'), 'real account: home shows demonstration label')
  await pp.getByRole('link', { name: /Family setup/ }).click()
  await pp.getByRole('heading', { name: 'Family sign in' }).waitFor()
  const hid = await fp.evaluate(async () => (await (await fetch('/api/auth/me')).json()).family.households[0].id)
  const res = await pp.request.get(`${BASE}/api/family/${hid}`)
  check(res.status() === 401, `real account: parent device read family data (${res.status()})`)
  await fam.close()
  await par.close()
}

// ---------------------------------------------------------------- outings, photos, music
step('Outings, photos and music')
{
  const { ctx, page } = await newDemo({ width: 390, height: 844 })
  const hid = await householdId(page)
  // Coffee and a class with transport, later today whatever the time.
  const later = sydney(60)
  for (const data of [
    { kind: 'social', title: 'Coffee with Jean', ask: true, notes: 'At the Feathers.', pickupTime: later.time, carColour: 'red', carNote: 'Sue the carer' },
    { kind: 'social', title: 'Swimming', subtitle: 'Aqua aerobics', notes: 'Bring a towel.', pickupTime: later.time, returnTime: sydney(120).time, carColour: 'green', carNote: 'Anna is driving' },
  ]) {
    // "ask" and "carNote" are sent as an older app would; both must be ignored.
    await page.request.post(`${BASE}/api/family/${hid}/reminders`, {
      headers: { 'X-Hazel': '1' },
      data: { time: sydney(75).time, startDate: later.date, repeat: 'none', endDate: null, location: '', question: '', remindMinutesBefore: 30, shareResponses: true, ...data },
    })
  }
  await homeAgain(page)
  const swim = page.locator('.event-tile', { hasText: 'Swimming' })
  await swim.waitFor()
  check(await swim.getByText('Aqua aerobics').isVisible(), 'outing: detail not shown on the tile')
  check(await swim.getByText('Green car').isVisible(), 'outing: car colour not written on the tile')
  check(!/driving|Sue|Anna/i.test(await swim.textContent()), 'outing: who is driving is shown')
  check(await swim.getByText(/^Pick up /).isVisible() && await swim.getByText(/^Home /).isVisible(), 'outing: pick-up and home times missing')
  const coffee = page.locator('.event-tile', { hasText: 'Coffee with Jean' })
  check(await coffee.getByText('At the Feathers.').isVisible(), 'outing: coffee tile missing its notes')
  check((await coffee.getByRole('button').count()) === 0 && !(await coffee.textContent()).includes('today?'), 'outing: coffee is asked as a YES / NO question')
  await shot(page, '390', '60-home-outings')

  // Photo tile: today's photo with its caption; a tap shows another.
  await homeAgain(page)
  const photo = page.locator('.photo-tile')
  check(await photo.locator('img.tphoto').evaluate((i) => i.complete && i.naturalWidth > 0), 'photos: photo did not load')
  check(await photo.getByText('Sunday at Wattleton beach').isVisible(), 'photos: caption missing')
  const firstCaption = await photo.locator('.tphoto-caption').textContent()
  await photo.click()
  await page.waitForTimeout(200)
  check((await photo.locator('.tphoto-caption').textContent()) !== firstCaption, 'photos: tapping did not show another photo')
  check(onHome(page), `photos: tapping moved to ${page.url()}`)

  // Music tile: tap to play the family's song.
  const music = page.locator('.music-tile')
  check(await music.getByText('Demo recording').isVisible(), 'music: singer not shown')
  check(!/Twinkle/.test(await page.locator('body').innerText()), 'music: nursery rhyme still in the demo')
  await music.getByRole('button', { name: /Play Quiet piano/ }).click()
  await music.getByText('Playing').or(page.getByText('This device could not play the song.')).first().waitFor()
  check(await music.getByText('Playing').isVisible(), 'music: the song did not start')
  await shot(page, '390', '62-music-playing')
  await music.getByRole('button', { name: /Stop/ }).click()

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
  await homeAgain(page)
  await page.locator('.music-tile').getByRole('button', { name: 'Another song' }).click()
  await page.locator('.music-tile').getByText('Can’t Help Falling in Love').or(page.locator('.music-tile').getByText('Quiet piano')).first().waitFor()

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
  await answerAllDue(page)
  const t = await today(page)
  // Give a due reminder the demo's medical-centre picture.
  const doctor = t.items.find((i) => i.type === 'reminder' && i.reminder.title === 'Dr Chen')
  const bytes = await (await page.request.get(BASE + doctor.reminder.photoUrl)).body()
  const k = await addDue(page, { title: 'Walk to the shops', question: 'Have you been for your walk?' })
  await page.request.put(`${BASE}/api/family/${hid}/media/reminder/${k.split(':')[0]}/photo`, {
    headers: { 'X-Hazel': '1' },
    data: { dataUrl: 'data:image/jpeg;base64,' + bytes.toString('base64') },
  })
  await homeAgain(page)
  const photoOk = await dueTile(page, 'your walk').locator('img.tpic').evaluate((img) => img.complete && img.naturalWidth > 0)
  check(photoOk, 'photo: reminder photo did not load on its tile')
  await shot(page, '390', '50-reminder-with-photo')

  // Family records a voice message with the (fake) microphone.
  await addDue(page, { title: 'Water the plants', question: 'Have you watered the plants?' })
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
  await homeAgain(page)
  check((await dueTile(page, 'watered the plants').getByRole('button', { name: 'Hear Anna' }).count()) === 1, 'voice: tile has no "Hear Anna" button')
  await shot(page, '390', '53-reminder-with-voice')

  // Quick-start templates fill the form, including the question.
  await page.goto(BASE + '/#/family/reminders')
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  check((await page.getByRole('button', { name: /glass of water/i }).count()) === 0, 'templates: water reminder still offered')
  await page.getByRole('button', { name: 'Short walk' }).click()
  check((await page.getByLabel('Short title').inputValue()) === 'Short walk', 'templates: title not filled')
  check((await page.getByLabel('Question to ask (optional)').inputValue()) === 'Have you been for your walk?', 'templates: question not filled')
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
  // Anna adds someone to call; Margaret's screen shows the new tile straight away.
  await fam.getByRole('link', { name: 'Setup' }).click()
  await fam.getByRole('button', { name: 'Add someone to call' }).click()
  await fam.getByLabel('Name on the button').fill('Ruth')
  await fam.getByLabel('Phone number').fill('0491 570 159')
  await fam.locator('section', { hasText: 'People to call' }).getByRole('button', { name: 'Save', exact: true }).click()
  await fam.locator('li', { hasText: 'Ruth' }).waitFor()
  const t0 = Date.now()
  await phone.getByRole('button', { name: 'Call Ruth' }).waitFor({ timeout: 5000 })
  notes.push(`side by side: Margaret's screen updated ${Date.now() - t0} ms after Anna saved`)
  check(page.url().endsWith('#/both'), 'side by side: panes changed the page address')
  // The phone pane is narrow: tile words must still stay whole.
  const split = await phone.evaluate((root) => {
    const out = []
    const rg = document.createRange()
    for (const el of root.querySelectorAll('.tlabel, .tile-btn, .tsub')) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) {
        const n = w.currentNode
        for (const m of n.textContent.matchAll(/\S+/g)) {
          rg.setStart(n, m.index)
          rg.setEnd(n, m.index + m[0].length)
          if (new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size > 1) out.push(m[0])
        }
      }
    }
    return out
  })
  check(split.length === 0, `side by side: words split over lines: ${split.join(', ')}`)
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
