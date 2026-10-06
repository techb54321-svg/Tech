import type { ReactNode } from 'react'
import { House, Phone, Volume2, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { canSpeak, speak, stopSpeaking } from '../speech'
import { navigate } from '../route'

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
