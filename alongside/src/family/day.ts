import { useCallback, useEffect, useState } from 'react'
import { api, useOnDataChanged } from '../api'
import type { MessageStatus, OccurrenceStatus, ReminderKind } from '../../shared/types'

export interface DayData {
  date: string
  statuses: Array<{
    reminderId: string
    kind: ReminderKind
    title: string
    time: string
    status: OccurrenceStatus | 'private'
    snoozeUntil: string | null
    answeredAt: string | null
  }>
  help: Array<{
    id: string
    source: 'reminder' | 'lift' | 'ask'
    title: string
    occurrenceDate: string | null
    destinationLabel: string | null
    destinationAddress: string | null
    status: 'open' | 'resolved'
    createdAt: string
    resolvedAt: string | null
    resolvedBy: string | null
    messageStatus: MessageStatus
    messageDetail: string | null
  }>
  trips: Array<{
    id: string
    kind: 'uber_handoff' | 'family_arranged' | 'provider_booking'
    status: string
    date: string | null
    time: string | null
    destinationLabel: string
    destinationAddress: string
    details: string
    provider: string | null
    providerRef: string | null
    fareText: string | null
    createdAt: string
    enteredBy: string | null
  }>
  /** Questions the parent asked Hazel that day, newest first. */
  asks: Array<{
    id: string
    question: string
    answer: string
    source: 'claude' | 'rules'
    intent: string
    offeredHelp: boolean
    helpRequested: boolean
    createdAt: string
  }>
}

/** How a help request reads in the family area. */
export function helpTitle(h: DayData['help'][number]): string {
  if (h.source === 'lift') return `Lift to ${h.destinationLabel}`
  if (h.source === 'ask') return `Asked Hazel: “${h.title}”`
  return `Help with “${h.title}”`
}

export function useDay(hid: string, date: string) {
  const [data, setData] = useState<DayData | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setData(await api<DayData>('GET', `/api/family/${hid}/day?date=${date}`))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.')
    }
  }, [hid, date])
  useOnDataChanged(load)
  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])
  return { data, error, load }
}

/** What happened with the text message, stated exactly. */
export function messageLabel(s: MessageStatus): { text: string; tone: 'ok' | 'warn' | 'err' | 'neutral' | 'info' } {
  switch (s) {
    case 'not_requested':
      return { text: 'Saved in the app · no text sent', tone: 'neutral' }
    case 'not_configured':
      return { text: 'Saved in the app · no text sent (SMS not set up)', tone: 'neutral' }
    case 'accepted':
    case 'queued':
      return { text: 'Text accepted by SMS provider · delivery not yet confirmed', tone: 'info' }
    case 'sent':
      return { text: 'Text sent to the phone network · delivery not yet confirmed', tone: 'info' }
    case 'delivered':
      return { text: 'Text delivered', tone: 'ok' }
    case 'undelivered':
      return { text: 'Text could not be delivered', tone: 'err' }
    case 'failed':
      return { text: 'Text failed to send', tone: 'err' }
  }
}
