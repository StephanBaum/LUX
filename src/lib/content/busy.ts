import {asBookedDates, PAST_WINDOW, FUTURE_WINDOW, type BlockedDate} from './occupancy.ts'

/**
 * The reservations feed.
 *
 * Read here rather than in the endpoint because two callers now need the same
 * answer: the Mieten calendar, which draws the taken days, and the
 * reservation endpoint, which must not hold a day that is already gone.
 */

const DAY = 24 * 60 * 60 * 1000

export type IcalEvent = {uid: string; summary: string; start: string | null; end: string | null}

/** Handles fields with parameters, e.g. DTSTART;VALUE=DATE:20240115 */
function extractField(block: string, fieldName: string) {
  const match = block.match(new RegExp(`${fieldName}[^:]*:([^\\r\\n]+)`, 'i'))
  if (!match) return ''
  return match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
    .trim()
}

/** 20240115, 20240115T100000, or 20240115T100000Z */
function parseIcalDate(dateStr: string) {
  if (!dateStr) return null
  const clean = dateStr.split(':').pop() || dateStr

  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  if (clean.length >= 15) {
    const utc = clean.endsWith('Z') ? 'Z' : ''
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}${utc}`
  }
  return null
}

export function parseIcal(icalData: string): IcalEvent[] {
  const events: IcalEvent[] = []
  const blocks = String(icalData ?? '').split('BEGIN:VEVENT')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]
    const start = parseIcalDate(extractField(block, 'DTSTART'))
    if (!start) continue
    events.push({
      uid: extractField(block, 'UID'),
      summary: extractField(block, 'SUMMARY'),
      start,
      end: parseIcalDate(extractField(block, 'DTEND')),
    })
  }

  return events
}

export function withinWindow(events: IcalEvent[], now = new Date()) {
  const from = now.getTime() - PAST_WINDOW * DAY
  const until = now.getTime() + FUTURE_WINDOW * DAY
  return events.filter((event) => {
    const at = Date.parse(event.start as string)
    return Number.isFinite(at) && at >= from && at <= until
  })
}

export async function fetchReservations(url: string, now = new Date()) {
  if (!url) {
    return {name: 'reservations' as const, type: 'blocked' as const, events: [] as BlockedDate[], error: 'No URL configured'}
  }

  try {
    const response = await fetch(url, {
      headers: {Accept: 'text/calendar', 'User-Agent': 'LUX-Studio-Calendar/1.0'},
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const events = withinWindow(parseIcal(await response.text()), now)

    /*
     * asBookedDates keeps the dates and throws the rest away. A reservation's
     * summary is a customer's name, and everything returned here is sent to
     * the browser, so it is dropped now rather than hidden in the markup
     * later — no future change to the calendar can leak what is not there.
     */
    return {name: 'reservations' as const, type: 'blocked' as const, events: asBookedDates(events)}
  } catch (error: any) {
    console.error('Error fetching reservations calendar:', error.message)
    return {name: 'reservations' as const, type: 'blocked' as const, events: [] as BlockedDate[], error: error.message}
  }
}
