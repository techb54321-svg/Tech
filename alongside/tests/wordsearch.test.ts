import { describe, expect, it } from 'vitest'
import { makePuzzle } from '../src/parent/WordSearch'

describe('word search', () => {
  it('always places every word across or down, readable in order', () => {
    for (let n = 0; n < 300; n++) {
      const p = makePuzzle()
      expect(p.letters).toHaveLength(36)
      expect(p.words).toHaveLength(4)
      for (const w of p.words) {
        expect(w.cells.map((c) => p.letters[c]).join('')).toBe(w.word)
        const step = w.cells[1] - w.cells[0]
        expect([1, 6]).toContain(step)
        if (step === 1) expect(new Set(w.cells.map((c) => Math.floor(c / 6))).size).toBe(1)
      }
    }
  })
})
