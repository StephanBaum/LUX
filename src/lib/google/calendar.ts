import {accessToken} from './auth'
import type {Appointment} from '../sync/reconcile'

/** The four calls the sync needs, and nothing else. */

const API = 'https://www.googleapis.com/calendar/v3'

export type CalendarEvent = {
  id: string
  status?: string
  summary?: string
  updated?: string
  start?: {dateTime?: string; date?: string}
  end?: {dateTime?: string; date?: string}
}

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (response.status === 204) return {}

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = body?.error?.message ?? `Fehler ${response.status}`
    const error: any = new Error(`Google Kalender: ${message}`)
    error.status = response.status
    throw error
  }
  return body
}

/** A whole-day entry has a date and no time; both shapes have to be read. */
export const timeOf = (side?: {dateTime?: string; date?: string}) =>
  side?.dateTime ?? (side?.date ? `${side.date}T00:00:00.000Z` : null)

export const asAppointment = (event: CalendarEvent): Appointment => ({
  title: event.summary ?? '',
  startAt: timeOf(event.start),
  endAt: timeOf(event.end),
})

const asEvent = (appointment: Appointment) => ({
  summary: appointment.title,
  start: {dateTime: appointment.startAt},
  end: {dateTime: appointment.endAt},
})

export const getEvent = (calendarId: string, eventId: string): Promise<CalendarEvent> =>
  call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`)

export const createEvent = (calendarId: string, appointment: Appointment): Promise<CalendarEvent> =>
  call(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(asEvent(appointment)),
  })

export const patchEvent = (
  calendarId: string,
  eventId: string,
  appointment: Appointment,
): Promise<CalendarEvent> =>
  call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(asEvent(appointment)),
  })

export async function deleteEvent(calendarId: string, eventId: string) {
  try {
    await call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    })
  } catch (error: any) {
    // Already gone is the outcome we wanted.
    if (error?.status !== 404 && error?.status !== 410) throw error
  }
}

/**
 * What changed since last time.
 *
 * Google's push notification says only "something happened", never what — so
 * the answer comes from asking with the token from the previous answer. When
 * the token is too old Google says 410, and the caller starts again without one.
 */
export async function changedEvents(calendarId: string, syncToken?: string) {
  const events: CalendarEvent[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | undefined

  do {
    const query = new URLSearchParams({showDeleted: 'true', maxResults: '250'})
    if (syncToken) query.set('syncToken', syncToken)
    else query.set('timeMin', new Date(Date.now() - 30 * 864e5).toISOString())
    if (pageToken) query.set('pageToken', pageToken)

    const page = await call(`/calendars/${encodeURIComponent(calendarId)}/events?${query}`)
    events.push(...(page.items ?? []))
    pageToken = page.nextPageToken
    nextSyncToken = page.nextSyncToken
  } while (pageToken)

  return {events, syncToken: nextSyncToken}
}

/** Ask Google to call us when the calendar changes. Channels expire; see the cron. */
export const watchCalendar = (
  calendarId: string,
  channelId: string,
  address: string,
  token: string,
) =>
  call(`/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
    method: 'POST',
    body: JSON.stringify({id: channelId, type: 'web_hook', address, token}),
  })

export async function stopWatch(channelId: string, resourceId: string) {
  try {
    await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({id: channelId, resourceId}),
    })
  } catch {
    // An old channel that cannot be stopped expires on its own.
  }
}
