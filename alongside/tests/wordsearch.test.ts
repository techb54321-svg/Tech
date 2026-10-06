import { describe, expect, it } from 'vitest'
import { makePuzzle, SIZE, straightLine } from '../src/parent/WordSearch'

const row = (c: number) => Math.floor(c / SIZE)
const col = (c: number) => c % SIZE

describe('word search', () => {
  it('places six words across, down or diagonally on an 8 × 8 grid, readable in order', () => {
    const steps = new Set<number>()
    for (let n = 0; n < 300; n++) {
      const p = makePuzzle()
      expect(SIZE).toBe(8)
      expect(p.letters).toHaveLength(64)
      expect(p.words).toHaveLength(6)
      expect(new Set(p.words.map((w) => w.word)).size).toBe(6)
      for (const w of p.words) {
        expect(w.cells.map((c) => p.letters[c]).join('')).toBe(w.word)
        const step = w.cells[1] - w.cells[0]
        steps.add(step)
        expect([1, SIZE, SIZE + 1]).toContain(step)
        // Each step moves at most one row and one column: no wrapping round the edge.
        w.cells.forEach((c, i) => {
          if (i === 0) return
          const p0 = w.cells[i - 1]
          expect(c - p0).toBe(step)
          expect(row(c) - row(p0)).toBe(step === 1 ? 0 : 1)
          expect(col(c) - col(p0)).toBe(step === SIZE ? 0 : 1)
        })
        expect(straightLine(w.cells)).toBe(true)
      }
    }
    // Over 300 puzzles every direction turns up.
    expect([...steps].sort((a, b) => a - b)).toEqual([1, SIZE, SIZE + 1])
  })

  it('recognises straight lines in any tapping order, and nothing else', () => {
    expect(straightLine([2, 0, 1])).toBe(true) // across, tapped out of order
    expect(straightLine([0, 8, 16])).toBe(true) // down
    expect(straightLine([18, 0, 9])).toBe(true) // diagonal
    expect(straightLine([7, 8, 9])).toBe(false) // wraps from one row to the next
    expect(straightLine([0, 1, 9])).toBe(false) // bends
    expect(straightLine([0, 2])).toBe(false) // gap
    expect(straightLine([5])).toBe(false)
  })
})
