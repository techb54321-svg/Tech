// A gentle word search for someone living with dementia: a small grid with
// big letters, a few everyday words on one theme, words only across or down,
// tap the letters in any order. No timer, no score, nothing to lose.
import { useMemo, useState } from 'react'
import { Check, RotateCcw, House, Sparkles } from 'lucide-react'
import { H1, ParentScreen } from './common'

const THEMES = [
  { name: 'garden', words: ['ROSE', 'TREE', 'SEED', 'LEAF', 'SOIL', 'BIRD'] },
  { name: 'kitchen', words: ['CUP', 'TEA', 'JAM', 'SPOON', 'BREAD', 'MILK'] },
  { name: 'beach', words: ['SAND', 'SEA', 'SHELL', 'WAVE', 'SUN', 'BOAT'] },
  { name: 'animal', words: ['DOG', 'CAT', 'HORSE', 'COW', 'DUCK', 'SHEEP'] },
  { name: 'Australian', words: ['KOALA', 'EMU', 'WOMBAT', 'GUM', 'ROO', 'KIWI'] },
]
const SIZE = 6
const WORDS = 4
const FILL = 'ABCDEFGHIKLMNOPRSTUWY'
const COLOURS = ['#bbf7d0', '#bfdbfe', '#fbcfe8', '#fde68a']

interface Puzzle {
  theme: string
  letters: string[]
  words: Array<{ word: string; cells: number[] }>
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export function makePuzzle(): Puzzle {
  for (;;) {
    const theme = pick(THEMES)
    const chosen = [...theme.words].sort(() => Math.random() - 0.5).slice(0, WORDS)
    const grid: string[] = Array(SIZE * SIZE).fill('')
    const words: Puzzle['words'] = []
    let ok = true
    for (const word of chosen) {
      let placed = false
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const across = Math.random() < 0.5
        const row = Math.floor(Math.random() * (across ? SIZE : SIZE - word.length + 1))
        const col = Math.floor(Math.random() * (across ? SIZE - word.length + 1 : SIZE))
        const cells = [...word].map((_, i) => (across ? row * SIZE + col + i : (row + i) * SIZE + col))
        // No sharing of cells, so each word stands on its own.
        if (cells.every((c) => grid[c] === '')) {
          cells.forEach((c, i) => (grid[c] = word[i]))
          words.push({ word, cells })
          placed = true
        }
      }
      if (!placed) ok = false
    }
    if (!ok) continue
    return { theme: theme.name, letters: grid.map((l) => l || pick([...FILL])), words }
  }
}

export function WordSearch({ parentName }: { parentName: string }) {
  const [puzzle, setPuzzle] = useState<Puzzle>(makePuzzle)
  const [selected, setSelected] = useState<number[]>([])
  // Each found word with the cells that were tapped for it.
  const [foundCells, setFoundCells] = useState<Record<string, number[]>>({})
  const found = Object.keys(foundCells)
  const [justFound, setJustFound] = useState('')
  const owner = useMemo(() => {
    const m = new Map<number, number>()
    puzzle.words.forEach((w, i) => foundCells[w.word]?.forEach((c) => m.set(c, i)))
    return m
  }, [puzzle, foundCells])
  const done = found.length === puzzle.words.length

  function tap(cell: number) {
    if (owner.has(cell)) return
    const next = selected.includes(cell) ? selected.filter((c) => c !== cell) : [...selected, cell]
    // Accept the word wherever it is spelled in a straight line across or down,
    // even if the filler letters happen to spell it in a second place.
    const sorted = [...next].sort((a, b) => a - b)
    const sameRow = sorted.every((c, i) => i === 0 || (c === sorted[i - 1] + 1 && Math.floor(c / SIZE) === Math.floor(sorted[0] / SIZE)))
    const sameCol = sorted.every((c, i) => i === 0 || c === sorted[i - 1] + SIZE)
    const spelled = sorted.map((c) => puzzle.letters[c]).join('')
    const match = (sameRow || sameCol) && puzzle.words.find((w) => !found.includes(w.word) && w.word === spelled)
    if (match) {
      setFoundCells({ ...foundCells, [match.word]: sorted })
      setSelected([])
      setJustFound(match.word)
    } else {
      setSelected(next)
      setJustFound('')
    }
  }

  function another() {
    setPuzzle(makePuzzle())
    setSelected([])
    setFoundCells({})
    setJustFound('')
  }

  if (done) {
    return (
      <ParentScreen>
        <div className="ack" role="status">
          <div className="ack-icon ok celebrate">
            <Sparkles aria-hidden="true" />
          </div>
          <H1>Well done, {parentName}!</H1>
          <p className="p-body">You found all the words.</p>
          <div className="btn-stack">
            <button className="big-btn orange medium" onClick={another}>
              <RotateCcw aria-hidden="true" />
              <span>Another puzzle</span>
            </button>
            <a className="big-btn plain medium" href="#/">
              <House aria-hidden="true" />
              <span>Home</span>
            </a>
          </div>
        </div>
      </ParentScreen>
    )
  }

  return (
    <ParentScreen>
      <H1>Word search</H1>
      <p className="p-body">
        Find these {puzzle.theme} words. Tap each letter.
      </p>
      <ul className="ws-words" aria-label="Words to find">
        {puzzle.words.map((w, i) => {
          const f = found.includes(w.word)
          return (
            <li key={w.word} className={f ? 'found' : ''} style={f ? { background: COLOURS[i] } : undefined}>
              {f && <Check aria-hidden="true" />}
              {w.word}
              {f && <span className="visually-hidden"> (found)</span>}
            </li>
          )
        })}
      </ul>
      <div className="ws-grid" role="group" aria-label="Letters">
        {puzzle.letters.map((l, i) => {
          const o = owner.get(i)
          const sel = selected.includes(i)
          return (
            <button
              key={i}
              type="button"
              className={`ws-cell${sel ? ' sel' : ''}${o !== undefined ? ' done' : ''}`}
              style={o !== undefined ? { background: COLOURS[o] } : undefined}
              aria-pressed={sel}
              aria-label={`${l}, row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}${o !== undefined ? ', found' : ''}`}
              onClick={() => tap(i)}
            >
              {l}
            </button>
          )
        })}
      </div>
      <p className="p-body ws-status" role="status">
        {justFound ? `Yes! You found ${justFound}.` : selected.length ? `${selected.length} letter${selected.length === 1 ? '' : 's'} picked.` : ' '}
      </p>
      {selected.length > 0 && (
        <button type="button" className="small-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setSelected([])}>
          <RotateCcw aria-hidden="true" /> Clear my letters
        </button>
      )}
    </ParentScreen>
  )
}
