import {randomBytes} from 'node:crypto'

/**
 * The held day in the studio's calendar.
 *
 * It carries two dates and a reference, and nothing else. The calendar's
 * owners are consumer Google accounts, so there is no contract making Google
 * a processor for a customer's data — and the calendar never needed the name
 * to do its job, which is to say that a day is taken.
 *
 * The same reference goes in the subject line of the studio's e-mail, so a
 * held day in the calendar can be matched to the message that explains it.
 */

const MARK = 'reservation'
const BREAK = String.fromCharCode(10)
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

/**
 * How long before the first booked day a guest may still cancel themselves.
 * Inside it they are asked to telephone instead, so a late change is a
 * conversation rather than a silent gap in the diary.
 */
export const CANCEL_DEADLINE_DAYS = 7

/** The booking number, as it is shown to people: six uppercase hex. */
export const shown = (ref: string) => String(ref ?? '').toUpperCase()

/**
 * What the calendar entry says about itself.
 *
 * It carries the booking number so the studio can paste it into Google's
 * search and land on the right day, and it says plainly that deleting the
 * entry by hand tells the guest nothing — the site stores no address, so
 * only the link in the e-mail can send an answer.
 */
const description = (ref: string) =>
  [
    `Buchung ${shown(ref)}`,
    '',
    'Anfrage über die Website. Name und Kontakt stehen in der E-Mail mit dieser Nummer.',
    '',
    'Zum Absagen bitte den Link in der E-Mail benutzen. Wird dieser Termin hier',
    'von Hand gelöscht, wird der Zeitraum zwar wieder frei, aber der Gast',
    'erfährt nichts davon.',
  ].join(BREAK)

export type Request = {
  name: string
  email: string
  firma?: string
  telefon?: string
  anfrage?: string
  /** The rooms and the kit, kept apart so the e-mail can lay them out. */
  raeume?: string[]
  technik?: string[]
  /** Both are calendar days, YYYY-MM-DD. */
  startAt: string
  endAt: string
}

export const reference = () => randomBytes(3).toString('hex')

/**
 * What the entry is called in the calendar: the word, then the rooms asked
 * for. With no room chosen the word stands on its own rather than trailing an
 * empty pair of quotes.
 */
export const title = (word: string, rooms: string[] = []) => {
  const named = rooms.filter((room) => typeof room === 'string' && room.trim())
  return named.length ? `${word} „${named.join(', ')}“` : word
}

/**
 * Google treats an all-day `end.date` as exclusive, which is the same rule the
 * Mieten calendar already uses for the iCal feed. The caller passes the day
 * after the last booked day.
 */
export const heldEvent = (
  ref: string,
  startAt: string,
  endAt: string,
  rooms: string[] = [],
  now = new Date(),
) => ({
  // The room, not a code. A room name belongs to the studio, so it may be
  // shown; the dates are already the entry's own dates. The reference stays
  // out of sight in the private properties, where the sync needs it and
  // nobody has to read it.
  summary: title('Anfrage', rooms),
  description: description(ref),
  status: 'tentative',
  transparency: 'opaque',
  start: {date: startAt},
  end: {date: endAt},
  extendedProperties: {private: {lux: MARK, ref, held: now.toISOString()}},
})

/**
 * Approving keeps whatever room the hold named and only changes the word in
 * front of it, so a booking reads the same way it did as a request.
 *
 * Google deletes a private property when it is set to null.
 */
export const confirmedPatch = (currentSummary?: string) => ({
  summary: currentSummary?.startsWith('Anfrage')
    ? currentSummary.replace(/^Anfrage/, 'Gebucht')
    : 'Gebucht',
  status: 'confirmed',
  extendedProperties: {private: {lux: MARK, held: null}},
})

/**
 * Only an unanswered hold this feature made, and only after a week. A booking
 * the studio typed in by hand has no marker and is never touched.
 */
export function mayExpire(
  event: {status?: string; extendedProperties?: any},
  now = new Date(),
) {
  if (event.status !== 'tentative') return false
  const own = event.extendedProperties?.private
  if (own?.lux !== MARK) return false
  const held = Date.parse(own?.held ?? '')
  if (!Number.isFinite(held)) return false
  return now.getTime() - held > SEVEN_DAYS
}

/**
 * The end of a range is exclusive on both sides, so a booking that ends on
 * the day another begins is not a clash — that is a changeover, not a
 * double booking.
 */
export function overlaps(
  range: {startAt: string; endAt: string},
  busy: {start: string; end: string}[],
) {
  const from = Date.parse(range.startAt)
  const to = Date.parse(range.endAt)
  return busy.some((b) => {
    const bFrom = Date.parse(b.start)
    const bTo = Date.parse(b.end)
    if (!Number.isFinite(bFrom)) return false
    const bEnd = Number.isFinite(bTo) && bTo > bFrom ? bTo : bFrom + 86_400_000
    return from < bEnd && bFrom < to
  })
}

/**
 * The rooms back out of an entry's title.
 *
 * The approve and decline pages know the dates and the person from the link,
 * but not what was booked — the token deliberately stays small. The calendar
 * entry already says it, so the yes can name the room without the link having
 * to carry it.
 */
/**
 * May the guest still call it off themselves?
 *
 * Measured to the start of the first booked day, so a booking beginning on
 * the 15th can be cancelled until the end of the 8th when the deadline is
 * seven days.
 */
export function canCancel(startAt: string, now = new Date()) {
  const start = Date.parse(`${startAt}T00:00:00Z`)
  if (!Number.isFinite(start)) return false
  return start - now.getTime() > CANCEL_DEADLINE_DAYS * 24 * 60 * 60 * 1000
}

/** The last day a guest may cancel, for telling them so. */
export function cancelUntil(startAt: string) {
  const start = new Date(`${startAt}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - CANCEL_DEADLINE_DAYS)
  return start.toISOString().slice(0, 10)
}

export function roomsFromTitle(summary?: string) {
  const match = String(summary ?? '').match(/„([^“]+)“/)
  return match ? match[1].split(',').map((room) => room.trim()).filter(Boolean) : []
}
