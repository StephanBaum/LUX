import {sanityWriteClient} from '../sanity/client'
import type {Appointment} from './reconcile'

/**
 * Reading and writing the two document types that carry a date.
 *
 * The title is a translated field, so what travels to and from the calendar is
 * the German entry — the calendar has one line for a title and the studio
 * thinks in German.
 */

export const SYNCED_TYPES = ['workshop', 'event'] as const
export type SyncedType = (typeof SYNCED_TYPES)[number]

const VALUE_TYPE = 'internationalizedArrayStringValue'

type Entry = {_key?: string; _type?: string; language: string; value?: string}

export type SyncedDoc = {
  _id: string
  _type: SyncedType
  _updatedAt: string
  title?: Entry[] | string
  startAt?: string
  endAt?: string
  googleEventId?: string
  googleCalendarId?: string
  syncedTitle?: string
  syncedStartAt?: string
  syncedEndAt?: string
  syncedAt?: string
  syncStatus?: string
  syncMessage?: string
}

export const germanTitle = (title: SyncedDoc['title']): string =>
  Array.isArray(title)
    ? (title.find((entry) => entry.language === 'de')?.value ?? '')
    : (title ?? '')

/** Put a German title back without disturbing the other languages. */
export function withGermanTitle(title: SyncedDoc['title'], value: string): Entry[] {
  const rest = Array.isArray(title) ? title.filter((entry) => entry.language !== 'de') : []
  return [{_key: 'de', _type: VALUE_TYPE, language: 'de', value}, ...rest]
}

export const asAppointment = (doc: SyncedDoc): Appointment => ({
  title: germanTitle(doc.title),
  startAt: doc.startAt ?? null,
  endAt: doc.endAt ?? null,
})

export const lastAgreed = (doc: SyncedDoc) => ({
  title: doc.syncedTitle,
  startAt: doc.syncedStartAt,
  endAt: doc.syncedEndAt,
})

/*
 * Whole documents, never a projection. A projection here once cost a workshop
 * its photograph and its description: the deletion rule copies the document to
 * a draft, and a copy of a projection is a copy of four fields.
 */
export const findById = (id: string): Promise<SyncedDoc | null> =>
  sanityWriteClient.fetch('*[_id == $id][0]', {id})

/**
 * The document behind a calendar entry.
 *
 * A published document and its draft are two documents with the same content,
 * so the published one is preferred — that is the one the website shows.
 */
export const findByEventId = (eventId: string): Promise<SyncedDoc | null> =>
  sanityWriteClient.fetch('*[googleEventId == $eventId] | order(_id asc)[0]', {eventId})

/** Write the calendar's values in, and record that both sides now agree. */
export async function writeHere(
  doc: SyncedDoc,
  appointment: Appointment,
  extra: Record<string, unknown> = {},
) {
  await sanityWriteClient
    .patch(doc._id)
    .set({
      title: withGermanTitle(doc.title, appointment.title),
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      ...agreed(appointment),
      ...extra,
    })
    .commit()
}

/** Record what both sides say now, so the next change is recognised as one. */
export const agreed = (appointment: Appointment) => ({
  syncedTitle: appointment.title,
  syncedStartAt: appointment.startAt,
  syncedEndAt: appointment.endAt,
  syncedAt: new Date().toISOString(),
  syncStatus: 'ok',
  syncMessage: '',
})

export const note = (status: string, message: string) => ({
  syncStatus: status,
  syncMessage: message,
  syncedAt: new Date().toISOString(),
})

export const calendarFor = (type: SyncedType): string =>
  (type === 'workshop'
    ? import.meta.env.GOOGLE_CALENDAR_WORKSHOPS
    : import.meta.env.GOOGLE_CALENDAR_EVENTS) ?? ''
