// Ask Hazel: the parent taps, speaks (or taps a suggestion, or types), and
// Hazel answers in a few plain words, on screen and aloud. Answers come from
// today's plan only. Nothing leaves this tile: it opens in place on the board.
import { useEffect, useRef, useState } from 'react'
import { Check, Keyboard, Mic, MicOff, Send, Users, Volume2, X } from 'lucide-react'
import { api, ApiError, newRequestId } from '../api'
import type { ParentToday } from '../../shared/types'
import { canSpeak, speak, stopSpeaking } from '../speech'

export interface AskReply {
  id: string
  question: string
  answer: string
  intent: string
  source: 'claude' | 'rules'
  offerHelp: boolean
  helpRequested: boolean
}

// Speech recognition is not in TypeScript's DOM types yet; this is the part used here.
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition
const Recognition: RecognitionCtor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)

function suggestions(today: ParentToday): string[] {
  const out = ['What day is it?', 'What’s on today?']
  const lift = today.items.some((i) => i.type === 'reminder' && i.reminder.pickupTime)
  out.push(lift ? 'When is my car coming?' : 'What’s on tomorrow?')
  out.push(today.contacts.length ? 'Who can I call?' : 'What’s on tomorrow?')
  return [...new Set(out)]
}

export function AskHazelPanel({ today, onClose }: { today: ParentToday; onClose: () => void }) {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [typing, setTyping] = useState(!Recognition)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [reply, setReply] = useState<AskReply | null>(null)
  const [error, setError] = useState<{ question: string; id: string; text: string } | null>(null)
  const [micNote, setMicNote] = useState('')
  const [help, setHelp] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const rec = useRef<Recognition | null>(null)
  const helpId = useRef(newRequestId())

  useEffect(
    () => () => {
      rec.current?.abort()
      stopSpeaking()
    },
    [],
  )

  async function ask(question: string, id = newRequestId()) {
    const q = question.trim()
    if (!q || busy) return
    setBusy(q)
    setError(null)
    setReply(null)
    setHelp('idle')
    helpId.current = newRequestId()
    try {
      const r = await api<AskReply>('POST', '/api/parent/ask', { clientRequestId: id, question: q })
      setReply(r)
      setText('')
      if (canSpeak) speak(r.answer)
    } catch (e) {
      setError({ question: q, id, text: e instanceof ApiError && e.status === 429 ? e.message : 'That didn’t work. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  function listen() {
    if (!Recognition) return
    stopSpeaking()
    setMicNote('')
    setHeard('')
    const r = new Recognition()
    r.lang = 'en-AU'
    r.interimResults = true
    r.maxAlternatives = 1
    let finalText = ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText = res[0].transcript
        else interim += res[0].transcript
      }
      setHeard(finalText || interim)
    }
    r.onerror = (e) => {
      setMicNote(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The microphone is not allowed on this device. You can type instead.' : 'I didn’t catch that. Please try again, or type.')
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setTyping(true)
    }
    r.onend = () => {
      setListening(false)
      rec.current = null
      if (finalText.trim()) ask(finalText)
    }
    rec.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
      setTyping(true)
    }
  }

  async function letFamilyKnow() {
    if (!reply) return
    setHelp('saving')
    try {
      await api('POST', `/api/parent/ask/${reply.id}/help`, { clientRequestId: helpId.current })
      setHelp('saved')
    } catch {
      setHelp('error')
    }
  }

  return (
    <div className="ask">
      <button type="button" className="tile-close" onClick={onClose} aria-label="Close Ask Hazel">
        <X aria-hidden="true" /> Close
      </button>
      <p className="tlabel big">Ask Hazel</p>

      {busy ? (
        <p className="ask-thinking" role="status">
          <span className="ask-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Hazel is thinking about “{busy}”
        </p>
      ) : reply ? (
        <div className="ask-reply">
          <p className="ask-q">You asked: “{reply.question}”</p>
          <p className="ask-a" role="status" aria-live="polite">
            {reply.answer}
          </p>
          <div className="ask-actions">
            {canSpeak && (
              <button type="button" className="tile-btn" onClick={() => speak(reply.answer)}>
                <Volume2 aria-hidden="true" /> Say it again
              </button>
            )}
            {reply.offerHelp && help !== 'saved' && (
              <button type="button" className="tile-btn" onClick={letFamilyKnow} disabled={help === 'saving'}>
                <Users aria-hidden="true" /> {help === 'saving' ? 'Saving…' : `Let ${today.contactName} know`}
              </button>
            )}
            <button type="button" className="tile-btn" onClick={() => { stopSpeaking(); setReply(null) }}>
              <Mic aria-hidden="true" /> Ask something else
            </button>
          </div>
          {help === 'saved' && (
            <p className="tsub said" role="status">
              <Check aria-hidden="true" /> Saved. {today.contactName} will see it in Hazel.
            </p>
          )}
          {help === 'error' && (
            <p className="tile-error" role="alert">
              That didn’t save. Please tap “Let {today.contactName} know” again.
            </p>
          )}
          <p className="ask-source">{reply.source === 'claude' ? 'Answer written by Claude from today’s plan.' : 'Hazel’s own answer from today’s plan.'}</p>
        </div>
      ) : (
        <>
          {Recognition && (
            <button
              type="button"
              className={`tile-btn ask-mic${listening ? ' on' : ''}`}
              onClick={() => (listening ? rec.current?.abort() : listen())}
              aria-pressed={listening}
            >
              {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              {listening ? (heard ? `“${heard}”` : 'Listening… speak now') : 'Tap and speak'}
            </button>
          )}
          {micNote && <p className="tsub strong">{micNote}</p>}
          <p className="tsub strong">Or tap a question:</p>
          <div className="place-grid">
            {suggestions(today).map((q) => (
              <button key={q} type="button" className="tile-btn" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          {typing ? (
            <form
              className="panel-form"
              onSubmit={(e) => {
                e.preventDefault()
                ask(text)
              }}
            >
              <label className="tsub strong" htmlFor="ask-text">
                Type your question
              </label>
              <input id="ask-text" className="big-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} autoComplete="off" />
              <button className="tile-btn" disabled={!text.trim()}>
                <Send aria-hidden="true" /> Ask
              </button>
            </form>
          ) : (
            <button type="button" className="tile-btn small ghost" onClick={() => setTyping(true)}>
              <Keyboard aria-hidden="true" /> Type a question instead
            </button>
          )}
          {error && (
            <div className="tile-error" role="alert">
              <span>{error.text}</span>
              <button type="button" className="tile-btn small" onClick={() => ask(error.question, error.id)}>
                Try again
              </button>
            </div>
          )}
        </>
      )}
      <p className="ask-note">Hazel answers from today’s plan. {today.contactName} can see what you ask.</p>
    </div>
  )
}
