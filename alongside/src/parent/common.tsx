import type { ReactNode } from 'react'
import { AudioLines, House, Phone, Volume2, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { canSpeak, speak, stopSpeaking } from '../speech'
import { useNavigate } from '../route'

/** Shell for every parent screen after Home: a clearly labelled Home button, then one task. */
export function ParentScreen({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="p-wrap">
      <header className="p-top">
        <a className="home-btn" href="#/">
          <House aria-hidden="true" />
          Home
        </a>
        {aside}
      </header>
      <main className="p-main">{children}</main>
    </div>
  )
}

export function H1({ children, className = 'p-h1' }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={className} tabIndex={-1}>
      {children}
    </h1>
  )
}

/** Play a family voice message. Returns a stop function. */
export function playVoice(url: string, onEnd: () => void): () => void {
  const audio = new Audio(url)
  audio.onended = onEnd
  audio.onerror = onEnd
  audio.play().catch(onEnd)
  return () => {
    audio.pause()
    onEnd()
  }
}

/**
 * One "listen" control. With a family voice message it plays that ("Hear Anna");
 * otherwise it reads the text with the device voice. The words stay on screen.
 */
export function Listen({
  text,
  voiceUrl,
  name,
  autoPlay,
  onAutoPlayed,
}: {
  text: string
  voiceUrl: string | null
  name: string
  autoPlay?: boolean
  onAutoPlayed?: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<null | (() => void)>(null)
  const stop = () => {
    stopRef.current?.()
    stopRef.current = null
    stopSpeaking()
    setPlaying(false)
  }
  const start = () => {
    if (voiceUrl) {
      stopRef.current = playVoice(voiceUrl, () => setPlaying(false))
      setPlaying(true)
    } else if (speak(text, () => setPlaying(false))) {
      setPlaying(true)
    }
  }
  useEffect(() => stop, [text, voiceUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!autoPlay) return
    onAutoPlayed?.()
    // Browsers may block sound until the screen has been touched; the button still works.
    start()
  }, [autoPlay]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!voiceUrl && !canSpeak) return null
  const label = playing ? (voiceUrl ? 'Stop' : 'Stop reading') : voiceUrl ? `Hear ${name}` : 'Read aloud'
  return (
    <button type="button" className={`small-btn read-btn${voiceUrl ? ' voice' : ''}`} onClick={() => (playing ? stop() : start())}>
      {playing ? <Square aria-hidden="true" /> : voiceUrl ? <AudioLines aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      {label}
    </button>
  )
}

/** A family photo shown large, to help recognise the thing or place. */
export function Photo({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return null
  return <img className="p-photo" src={url} alt={alt} onError={() => setFailed(true)} />
}

/** Read-aloud button. Hidden where the device has no speech; the text stays on screen regardless. */
export function ReadAloud({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => {
    stopSpeaking()
    setSpeaking(false)
  }, [text])
  if (!canSpeak) return null
  return (
    <button
      type="button"
      className="small-btn read-btn"
      onClick={() => {
        if (speaking) {
          stopSpeaking()
          setSpeaking(false)
        } else if (speak(text, () => setSpeaking(false))) {
          setSpeaking(true)
        }
      }}
    >
      {speaking ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      {speaking ? 'Stop reading' : 'Read aloud'}
    </button>
  )
}

export function telHref(phone: string) {
  return 'tel:' + phone.replace(/[^0-9+]/g, '')
}

/**
 * A call button. With a real saved number it opens the phone's calling screen
 * (and shows a fallback screen with the number). In the demonstration, or
 * when no number is saved, it only shows the explanation screen.
 */
export function CallButton({
  who,
  name,
  phone,
  demo,
  className = 'big-btn green',
  label,
}: {
  who: 'contact' | 'pharmacy'
  name: string
  phone: string
  demo: boolean
  className?: string
  label?: string
}) {
  const navigate = useNavigate()
  const text = label ?? `Call ${name}`
  const content = (
    <>
      <Phone aria-hidden="true" />
      <span>{text}</span>
    </>
  )
  if (demo || !phone) {
    return (
      <button type="button" className={className} onClick={() => navigate(`/call?who=${who}`)}>
        {content}
      </button>
    )
  }
  return (
    <a className={className} href={telHref(phone)} onClick={() => navigate(`/call?who=${who}`)}>
      {content}
    </a>
  )
}
