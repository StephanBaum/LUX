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
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

const DESCRIPTION =
  'Anfrage über die Website. Name und Kontakt stehen in der E-Mail mit dieser Nummer.'

export type Request = {
  name: string
  email: string
  firma?: string
  telefon?: string
  anfrage?: string
  auswahl?: string
  /** Both are calendar days, YYYY-MM-DD. */
  startAt: string
  endAt: string
}

export const reference = () => randomBytes(3).toString('hex')

/**
 * Google treats an all-day `end.date` as exclusive, which is the same rule the
 * Mieten calendar already uses for the iCal feed. The caller passes the day
 * after the last booked day.
 */
export const heldEvent = (ref: string, startAt: string, endAt: string, now = new Date()) => ({
  summary: `Angefragt — ${ref}`,
  description: DESCRIPTION,
  status: 'tentative',
  transparency: 'opaque',
  start: {date: startAt},
  end: {date: endAt},
  extendedProperties: {private: {lux: MARK, held: now.toISOString()}},
})

/** Google deletes a private property when it is set to null. */
export const confirmedPatch = (ref: string) => ({
  summary: `Gebucht — ${ref}`,
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
