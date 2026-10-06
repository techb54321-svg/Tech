import { describe, expect, it } from 'vitest'
import { SONG_CATALOGUE } from '../shared/songCatalogue'

describe('song catalogue', () => {
  it('lists 1960s and 1970s songs once each, with an artist', () => {
    expect(SONG_CATALOGUE.length).toBeGreaterThan(40)
    for (const s of SONG_CATALOGUE) {
      expect(s.year).toBeGreaterThanOrEqual(1960)
      expect(s.year).toBeLessThanOrEqual(1979)
      expect(s.artist).not.toBe('')
    }
    const keys = SONG_CATALOGUE.map((s) => `${s.title}|${s.artist}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(SONG_CATALOGUE.some((s) => s.artist === 'Elvis Presley')).toBe(true)
    expect(SONG_CATALOGUE.some((s) => s.artist === 'The Beatles')).toBe(true)
  })
})
