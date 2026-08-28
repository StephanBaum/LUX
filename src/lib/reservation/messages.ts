import type {Request} from './hold'

/** The three fields every message needs; the rest only the studio's does. */
type Told = Pick<Request, 'name' | 'startAt' | 'endAt'> & Partial<Request>

/**
 * The four messages. Pure functions returning a subject and plain text, so
 * they can be read in a test rather than in an inbox.
 */

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const day = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`)
  return {n: d.getUTCDate(), m: MONTHS[d.getUTCMonth()], y: d.getUTCFullYear()}
}

/** `endAt` is exclusive, as everywhere else, so the last booked day is the day before. */
export function germanRange(startAt: string, endAt: string) {
  const from = day(startAt)
  const lastDay = new Date(`${endAt}T12:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  const to = day(lastDay.toISOString().slice(0, 10))

  if (from.n === to.n && from.m === to.m && from.y === to.y) {
    return `${from.n}. ${from.m} ${from.y}`
  }
  if (from.m === to.m && from.y === to.y) {
    return `${from.n}. bis ${to.n}. ${to.m} ${to.y}`
  }
  return `${from.n}. ${from.m} bis ${to.n}. ${to.m} ${to.y}`
}

const SIGN_OFF = ['', 'Herzliche Grüße', 'LUX Studio'].join('\n')

export function toStudio(req: Request, ref: string, links: {approve: string; decline: string}) {
  const when = germanRange(req.startAt, req.endAt)
  const text = [
    `Anfrage ${ref} — ${when}`,
    '',
    `Name:     ${req.name}`,
    req.firma && `Firma:    ${req.firma}`,
    `E-Mail:   ${req.email}`,
    req.telefon && `Telefon:  ${req.telefon}`,
    req.auswahl && `Auswahl:  ${req.auswahl}`,
    '',
    req.anfrage,
    '',
    '—',
    'Zusagen:',
    links.approve,
    '',
    'Absagen:',
    links.decline,
    '',
    'Beide Links öffnen eine Seite mit einer Schaltfläche. Erst die Schaltfläche',
    'sagt zu oder ab, damit kein Mailprogramm das aus Versehen für Sie tut.',
    'Die Links laufen nach sieben Tagen ab; der Tag wird dann wieder frei.',
  ]
    .filter((line) => line !== undefined && line !== null && line !== false)
    .join('\n')

  return {subject: `Anfrage ${ref}: ${req.name}, ${when}`, text}
}

export function received(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  return {
    subject: `Ihre Anfrage bei LUX Studio (${ref})`,
    text: [
      `Guten Tag ${req.name},`,
      '',
      `vielen Dank für Ihre Anfrage für ${when}.`,
      'Wir haben die Tage für Sie vorgemerkt und melden uns innerhalb von zwei',
      'Werktagen mit einer Zu- oder Absage.',
      '',
      `Ihre Nummer für Rückfragen: ${ref}`,
      SIGN_OFF,
    ].join('\n'),
  }
}

export function approved(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  return {
    subject: `Zusage: ${when} im LUX Studio (${ref})`,
    text: [
      `Guten Tag ${req.name},`,
      '',
      `gerne — ${when} gehört Ihnen.`,
      '',
      'Melden Sie sich bitte kurz vor dem Termin, damit wir Schlüssel und',
      'Einweisung abstimmen können. Für Änderungen genügt eine Antwort auf',
      'diese E-Mail.',
      '',
      `Ihre Nummer: ${ref}`,
      SIGN_OFF,
    ].join('\n'),
  }
}

export function declined(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  return {
    subject: `Ihre Anfrage für ${when} (${ref})`,
    text: [
      `Guten Tag ${req.name},`,
      '',
      `vielen Dank für Ihr Interesse. ${when} können wir das Studio leider`,
      'nicht vergeben.',
      '',
      'Für einen anderen Zeitraum sind wir gerne für Sie da — antworten Sie',
      'einfach auf diese E-Mail oder fragen Sie über die Website erneut an.',
      SIGN_OFF,
    ].join('\n'),
  }
}
