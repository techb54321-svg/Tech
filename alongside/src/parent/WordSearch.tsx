// Word search, played inside its Home tile. An 8 × 8 grid with six words
// running across, down or diagonally (top-left to bottom-right). Tap the
// letters of a word in any order. No timer, no score.
import { useMemo, useState } from 'react'
import { Check, RotateCcw, Sparkles } from 'lucide-react'

const THEMES = [
  { name: 'garden', words: ['ROSE', 'TREE', 'SEED', 'LEAF', 'SOIL', 'BIRD', 'TULIP', 'DAISY', 'HEDGE', 'SPADE', 'LAWN', 'PANSY'] },
  { name: 'kitchen', words: ['CUP', 'TEA', 'JAM', 'SPOON', 'BREAD', 'MILK', 'KETTLE', 'TOAST', 'PLATE', 'SCONE', 'BUTTER', 'APRON'] },
  { name: 'beach', words: ['SAND', 'SEA', 'SHELL', 'WAVE', 'SUN', 'BOAT', 'TOWEL', 'CRAB', 'SURF', 'HAT', 'ROCKS', 'SWIM'] },
  { name: 'animal', words: ['DOG', 'CAT', 'HORSE', 'COW', 'DUCK', 'SHEEP', 'GOAT', 'MOUSE', 'RABBIT', 'PIG', 'HEN', 'OWL'] },
  { name: 'Australian', words: ['KOALA', 'EMU', 'WOMBAT', 'GUM', 'ROO', 'BILBY', 'WATTLE', 'DINGO', 'GALAH', 'BUSH', 'OUTBACK', 'REEF'] },
  { name: 'music', words: ['PIANO', 'SONG', 'DRUM', 'BAND', 'TUNE', 'HARP', 'CHOIR', 'FLUTE', 'DANCE', 'NOTE', 'BANJO', 'VIOLIN'] },
]
export const SIZE = 8
const WORDS = 6
const FILL = 'ABCDEFGHIKLMNOPRSTUWY'
const COLOURS = ['#bbf7d0', '#bfdbfe', '#fbcfe8', '#fde68a', '#ddd6fe', '#fed7aa']
// Across, down, and diagonally down-right.
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
] as const

interface Puzzle {
  theme: string
  letters: string[]
  words: Array<{ word: string; cells: number[] }>
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

export function makePuzzle(): Puzzle {
  for (;;) {
    const theme = pick(THEMES)
    const chosen = [...theme.words].filter((w) => w.length <= SIZE).sort(() => Math.random() - 0.5).slice(0, WORDS)
    const grid: string[] = Array(SIZE * SIZE).fill('')
    const words: Puzzle['words'] = []
    let ok = true
    for (const word of chosen) {
      let placed = false
      for (let tries = 0; tries < 300 && !placed; tries++) {
        const [dr, dc] = pick(DIRECTIONS)
        const row = Math.floor(Math.random() * (SIZE - dr * (word.length - 1)))
        const col = Math.floor(Math.random() * (SIZE - dc * (word.length - 1)))
        const cells = [...word].map((_, i) => (row + dr * i) * SIZE + col + dc * i)
        // Words may cross where they share a letter.
        if (cells.every((c, i) => grid[c] === '' || grid[c] === word[i])) {
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

/** Do these cells form one straight line across, down or diagonally (top-left to bottom-right)? */
export function straightLine(cells: number[]): boolean {
  const s = [...cells].sort((a, b) => a - b)
  if (s.length < 2) return false
  const row = (c: number) => Math.floor(c / SIZE)
  const col = (c: number) => c % SIZE
  for (const [dr, dc] of DIRECTIONS) {
    if (s.every((c, i) => i === 0 || (row(c) - row(s[i - 1]) === dr && col(c) - col(s[i - 1]) === dc))) return true
  }
  return false
}

export function WordSearchGame({ parentName }: { parentName: string }) {
  const [puzzle, setPuzzle] = useState<Puzzle>(makePuzzle)
  const [selected, setSelected] = useState<number[]>([])
  const [foundCells, setFoundCells] = useState<Record<string, number[]>>({})
  const [justFound, setJustFound] = useState('')
  const found = Object.keys(foundCells)
  const owner = useMemo(() => {
    const m = new Map<number, number>()
    puzzle.words.forEach((w, i) => foundCells[w.word]?.forEach((c) => m.set(c, i)))
    return m
  }, [puzzle, foundCells])
  const done = found.length === puzzle.words.length

  function tap(cell: number) {
    const next = selected.includes(cell) ? selected.filter((c) => c !== cell) : [...selected, cell]
    // Accept the word wherever it is spelled in a straight line, read forwards.
    const sorted = [...next].sort((a, b) => a - b)
    const spelled = sorted.map((c) => puzzle.letters[c]).join('')
    const match = straightLine(sorted) && puzzle.words.find((w) => !found.includes(w.word) && w.word === spelled)
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
      <div className="ws-done" role="status">
        <Sparkles aria-hidden="true" className="ws-done-icon" />
        <p className="ws-done-title">Well done, {parentName}!</p>
        <p className="ws-done-sub">You found all six words.</p>
        <button type="button" className="tile-btn" onClick={another}>
          <RotateCcw aria-hidden="true" /> Another puzzle
        </button>
      </div>
    )
  }

  return (
    <div className="ws">
      <p className="ws-intro">Find these {puzzle.theme} words. They go across, down or diagonally.</p>
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
              style={o !== undefined && !sel ? { background: COLOURS[o] } : undefined}
              aria-pressed={sel}
              aria-label={`${l}, row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}${o !== undefined ? ', in a found word' : ''}`}
              onClick={() => tap(i)}
            >
              {l}
            </button>
          )
        })}
      </div>
      <p className="ws-status" role="status">
        {justFound ? `Yes! You found ${justFound}.` : selected.length ? `${selected.length} letter${selected.length === 1 ? '' : 's'} picked.` : ' '}
      </p>
      {selected.length > 0 && (
        <button type="button" className="tile-btn small" onClick={() => setSelected([])}>
          <RotateCcw aria-hidden="true" /> Clear my letters
        </button>
      )}
    </div>
  )
}
