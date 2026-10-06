// Family photos and voice messages. Stored in the database, checked by size
// and by the file's actual leading bytes (not just its declared type), and
// served only to that household's parent device or family members.
import type { DB } from './db.js'
import { nowIso } from './db.js'
import { HttpError } from './http.js'
import { PHOTO_MAX_BYTES, PHOTO_TYPES, SONG_MAX_BYTES, VOICE_MAX_BYTES, VOICE_TYPES } from '../shared/validation.js'

export type OwnerType = 'reminder' | 'destination' | 'contact' | 'photo' | 'song'
/** photo: a picture; voice: a short family message; audio: a song. */
export type MediaKind = 'photo' | 'voice' | 'audio'

const startsWith = (b: Buffer, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x)
const ascii = (b: Buffer, at: number, s: string) => b.subarray(at, at + s.length).toString('latin1') === s

function looksLike(mime: string, b: Buffer): boolean {
  switch (mime) {
    case 'image/jpeg':
      return startsWith(b, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith(b, [0x89, 0x50, 0x4e, 0x47])
    case 'image/webp':
      return ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')
    case 'audio/webm':
      return startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])
    case 'audio/ogg':
      return ascii(b, 0, 'OggS')
    case 'audio/mp4':
    case 'audio/x-m4a':
    case 'audio/aac':
      return ascii(b, 4, 'ftyp') || startsWith(b, [0xff, 0xf1]) || startsWith(b, [0xff, 0xf9])
    case 'audio/mpeg':
      return ascii(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
    case 'audio/wav':
      return ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE')
    default:
      return false
  }
}

export function decodeMedia(kind: MediaKind, dataUrl: string): { mime: string; data: Buffer } {
  const m = dataUrl.match(/^data:([a-z]+\/[a-z0-9.+-]+)((?:;[a-z]+=[^;,]+)*);base64,(.*)$/)
  if (!m) throw new HttpError(400, 'Choose a photo or sound file.')
  const mime = m[1]
  const allowed: readonly string[] = kind === 'photo' ? PHOTO_TYPES : VOICE_TYPES
  if (!allowed.includes(mime)) {
    throw new HttpError(400, kind === 'photo' ? 'Use a JPEG, PNG or WebP photo.' : 'That sound format is not supported.')
  }
  const data = Buffer.from(m[3], 'base64')
  const max = kind === 'photo' ? PHOTO_MAX_BYTES : kind === 'audio' ? SONG_MAX_BYTES : VOICE_MAX_BYTES
  if (data.length > max) {
    throw new HttpError(
      400,
      kind === 'photo' ? 'That photo is too large.' : kind === 'audio' ? 'That song file is too large (12 MB at most).' : 'That message is too long. Keep it under a minute.',
    )
  }
  if (!looksLike(mime, data)) throw new HttpError(400, 'That file does not look like a real photo or sound file.')
  return { mime, data }
}

export function saveMedia(db: DB, hid: string, owner: OwnerType, ownerId: string, kind: MediaKind, mime: string, data: Buffer) {
  db.prepare(
    `INSERT INTO media (household_id, owner_type, owner_id, kind, mime, data, updated_at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT (owner_type, owner_id, kind) DO UPDATE SET mime=excluded.mime, data=excluded.data, updated_at=excluded.updated_at`,
  ).run(hid, owner, ownerId, kind, mime, data, nowIso())
}

export function deleteMedia(db: DB, hid: string, owner: OwnerType, ownerId: string, kind?: MediaKind) {
  if (kind) db.prepare('DELETE FROM media WHERE household_id=? AND owner_type=? AND owner_id=? AND kind=?').run(hid, owner, ownerId, kind)
  else db.prepare('DELETE FROM media WHERE household_id=? AND owner_type=? AND owner_id=?').run(hid, owner, ownerId)
}

export function readMedia(db: DB, hid: string, owner: string, ownerId: string, kind: string) {
  return db
    .prepare('SELECT mime, data, updated_at FROM media WHERE household_id=? AND owner_type=? AND owner_id=? AND kind=?')
    .get(hid, owner, ownerId, kind) as { mime: string; data: Uint8Array; updated_at: string } | undefined
}

/** URL for each stored item in a household, keyed "owner:id:kind". The version busts caches after a change. */
export function mediaUrls(db: DB, hid: string): Map<string, string> {
  const rows = db
    .prepare('SELECT owner_type, owner_id, kind, updated_at FROM media WHERE household_id=?')
    .all(hid) as Array<{ owner_type: string; owner_id: string; kind: string; updated_at: string }>
  return new Map(
    rows.map((r) => [
      `${r.owner_type}:${r.owner_id}:${r.kind}`,
      `/api/media/${hid}/${r.owner_type}/${r.owner_id}/${r.kind}?v=${encodeURIComponent(r.updated_at)}`,
    ]),
  )
}
