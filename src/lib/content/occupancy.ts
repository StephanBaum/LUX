/**
 * The days the studio is busy with its own programme.
 *
 * A workshop or an event fills the rooms, so those days cannot also be rented
 * out. The Mieten calendar used to learn this from two iCal feeds; the dates
 * live in Sanity now, so it reads them from there and the feeds are gone.
 *
 * Only published documents are passed in — a workshop the client is still
 * drafting must not take a day off the rental calendar.
 */

/** How far back and forward the Mieten calendar looks, in days. */
export const PAST_WINDOW = 30
export const FUTURE_WINDOW = 365

const DAY = 24 * 60 * 60 * 1000

/** What an appointment without a name is called on the calendar. */
const FALLBACK: Record<string, string> = {
  workshop: 'Workshop',
  event: 'Veranstaltung',
}

type Titled = {language?: string; value?: string} | null | undefined

type Appointment = {
  _id?: string
  _type?: string
  title?: Titled[] | null
  startAt?: string | null
  endAt?: string | null
}

export type BlockedDate = {
  type: 'blocked'
  uid: string
  summary: string
  start: string
  end: string
}

/** The German name, or any name at all, or what kind of thing it is. */
function name(doc: Appointment) {
  const entries = Array.isArray(doc.title) ? doc.title.filter(Boolean) : []
  const german = entries.find((entry) => entry?.language === 'de')?.value
  const any = entries.find((entry) => entry?.value)?.value
  return german || any || FALLBACK[doc._type ?? ''] || 'Belegt'
}

export function asBlockedDates(docs: Appointment[] | null | undefined, now = new Date()): BlockedDate[] {
  if (!Array.isArray(docs)) return []

  const from = now.getTime() - PAST_WINDOW * DAY
  const until = now.getTime() + FUTURE_WINDOW * DAY

  return docs
    .filter((doc) => doc?.startAt)
    .map((doc) => ({
      type: 'blocked' as const,
      uid: doc._id ?? '',
      summary: name(doc),
      start: doc.startAt as string,
      // A day with a start but no end is busy for that day, not forever.
      end: doc.endAt || (doc.startAt as string),
    }))
    .filter((blocked) => {
      const start = new Date(blocked.start).getTime()
      return Number.isFinite(start) && start >= from && start <= until
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}
