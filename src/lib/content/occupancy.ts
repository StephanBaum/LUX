/**
 * The days the studio is not free, for the calendar on the Mieten page.
 *
 * Two kinds of busy day, and they are told apart on purpose:
 *
 * - A **studio** day is a workshop or an event. It is the studio's own
 *   programme, already public on /workshops and /veranstaltungen, so the
 *   calendar may name it, show its photograph and link to it.
 * - A **reservation** is somebody else's booking. Its name is a customer's
 *   name. Nothing but the dates is allowed anywhere near the browser, so the
 *   summary is dropped here rather than hidden later in the markup.
 *
 * Both block the day the same way. Only what the visitor is told differs.
 */

/** How far back and forward the Mieten calendar looks, in days. */
export const PAST_WINDOW = 30
export const FUTURE_WINDOW = 365

const DAY = 24 * 60 * 60 * 1000

/** The card's photograph, small — it sits in a hover card, not on a page. */
const CARD_IMAGE_WIDTH = 320
const CARD_IMAGE_HEIGHT = 200

/** What an appointment without a name is called on the calendar. */
const FALLBACK: Record<string, string> = {
  workshop: 'Workshop',
  event: 'Veranstaltung',
}

/** The page each kind of appointment is read about on. */
const PAGE: Record<string, string> = {
  workshop: '/workshops',
  event: '/veranstaltungen',
}

type Titled = {language?: string; value?: string} | null | undefined

type Appointment = {
  _id?: string
  _type?: string
  title?: Titled[] | null
  slug?: {current?: string} | null
  photo?: unknown
  startAt?: string | null
  endAt?: string | null
}

/** One entry of a parsed iCal reservations feed. */
type Reservation = {
  uid?: string
  summary?: string
  start?: string | null
  end?: string | null
}

export type BlockedDate = {
  type: 'blocked'
  source: 'studio' | 'reservations'
  uid: string
  start: string
  end: string
  /** Only ever set for a studio day. */
  summary?: string
  href?: string
  image?: string
}

/** The German name, or any name at all, or what kind of thing it is. */
function name(doc: Appointment) {
  const entries = Array.isArray(doc.title) ? doc.title.filter(Boolean) : []
  const german = entries.find((entry) => entry?.language === 'de')?.value
  const any = entries.find((entry) => entry?.value)?.value
  return german || any || FALLBACK[doc._type ?? ''] || 'Belegt'
}

/**
 * Where to read about this appointment.
 *
 * There are no detail pages: both types are accordion cards on one list page,
 * so the link opens the right card by its anchor. An unknown type gets no
 * link at all rather than one that leads nowhere.
 */
function link(doc: Appointment) {
  const page = PAGE[doc._type ?? '']
  const anchor = doc.slug?.current || doc._id
  return page && anchor ? `${page}#${anchor}` : undefined
}

function withinWindow(start: string, now: Date) {
  const at = new Date(start).getTime()
  if (!Number.isFinite(at)) return false
  return at >= now.getTime() - PAST_WINDOW * DAY && at <= now.getTime() + FUTURE_WINDOW * DAY
}

const byStart = (a: {start: string}, b: {start: string}) =>
  new Date(a.start).getTime() - new Date(b.start).getTime()

/**
 * Workshops and events, from Sanity. Published documents only.
 *
 * `imageFor` is handed in rather than imported so this file stays free of the
 * Sanity client, which reads `import.meta.env` and cannot be loaded by the
 * test runner. The Mieten endpoint passes the real one.
 */
export function asBlockedDates(
  docs: Appointment[] | null | undefined,
  now = new Date(),
  imageFor: (photo: unknown, width: number, height: number) => string | undefined = () => undefined,
): BlockedDate[] {
  if (!Array.isArray(docs)) return []

  return docs
    .filter((doc) => doc?.startAt)
    .map((doc) => ({
      type: 'blocked' as const,
      source: 'studio' as const,
      uid: doc._id ?? '',
      summary: name(doc),
      // A day with a start but no end is busy for that day, not forever.
      start: doc.startAt as string,
      end: doc.endAt || (doc.startAt as string),
      href: link(doc),
      image: doc.photo ? imageFor(doc.photo, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT) : undefined,
    }))
    .filter((blocked) => withinWindow(blocked.start, now))
    .sort(byStart)
}

/**
 * Reservations, from the iCal feed.
 *
 * The summary is deliberately not carried over. Everything this function
 * returns is sent to the browser, and a reservation's summary is a customer's
 * name — dropping it here means no later change to the markup can leak it.
 */
export function asBookedDates(events: Reservation[] | null | undefined): BlockedDate[] {
  if (!Array.isArray(events)) return []

  return events
    .filter((event) => event?.start)
    .map((event) => ({
      type: 'blocked' as const,
      source: 'reservations' as const,
      uid: event.uid ?? '',
      start: event.start as string,
      end: event.end || (event.start as string),
    }))
    .sort(byStart)
}
