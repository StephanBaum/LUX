import {shell, heading, para, rows, row, listRow, quote, button, note, esc} from './email-layout.ts'
import {shown, cancelUntil, CANCEL_DEADLINE_DAYS} from './hold.ts'
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


/** A single day in German, for "you may cancel until …". */
export function germanDay(iso: string) {
  const d = day(iso)
  return `${d.n}. ${d.m} ${d.y}`
}

const SIGN_OFF = ['', 'Herzliche Grüße', 'LUX Studio'].join('\n')


/* ------------------------------------------------------------------ HTML -- */

/**
 * Every message goes out twice: as HTML, and as the plain text underneath it.
 * A reader whose client blocks HTML still gets a readable letter, and a
 * reader whose client shows it gets something that looks like the site.
 *
 * No reference codes anywhere a person reads. The studio matches a held day
 * to its message by the room and the dates, both of which are on the calendar
 * entry itself.
 */

const list = (values?: string[]) =>
  (values ?? []).filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())

const lines = (parts: (string | false | undefined | null)[]) =>
  parts.filter((line) => line !== undefined && line !== null && line !== false).join('\n')

/** The request that lands in the studio's inbox, with the two buttons. */
export function toStudio(req: Request, ref: string, links: {approve: string; decline: string; reschedule?: string}) {
  const when = germanRange(req.startAt, req.endAt)
  const raeume = list(req.raeume)
  const technik = list(req.technik)
  const who = req.firma ? `${req.name} · ${req.firma}` : req.name

  const body =
    heading('Neue Anfrage', who) +
    rows(
      row('Zeitraum', when) +
        listRow('Räume', raeume) +
        listRow('Technik', technik) +
        row('E-Mail', req.email, `mailto:${req.email}`) +
        row('Telefon', req.telefon ?? '', req.telefon ? `tel:${req.telefon.replace(/\s+/g, '')}` : undefined),
    ) +
    quote(req.anfrage ?? '') +
    button('Zusagen', links.approve, 'primary') +
    button('Absagen', links.decline, 'secondary') +
    (links.reschedule ? button('Termin ändern', links.reschedule, 'secondary') : '') +
    note(
      'Beide Schaltflächen öffnen eine Seite, auf der Sie noch einmal bestätigen. ' +
        'Das ist Absicht: Mailprogramme rufen Links selbst auf, um sie zu prüfen, ' +
        'und würden sonst für Sie zusagen.<br>' +
        'Ohne Antwort läuft die Vormerkung nach sieben Tagen ab und der Zeitraum wird wieder frei.<br>' +
        '<strong>Heben Sie diese E-Mail auf.</strong> „Termin ändern" funktioniert bis zum Ende ' +
        'der gebuchten Tage — bitte damit umbuchen und nicht im Kalender ziehen, sonst erfährt ' +
        'der Gast nichts davon.',
    )

  const text = lines([
    `Neue Anfrage — ${when}`,
    `Buchung ${shown(ref)}`,
    '',
    `Name:      ${req.name}`,
    req.firma && `Firma:     ${req.firma}`,
    `E-Mail:    ${req.email}`,
    req.telefon && `Telefon:   ${req.telefon}`,
    raeume.length && `Räume:     ${raeume.join(', ')}`,
    technik.length && `Technik:   ${technik.join(', ')}`,
    '',
    req.anfrage,
    '',
    '—',
    'Zusagen:',
    links.approve,
    '',
    'Absagen:',
    links.decline,
    links.reschedule && '',
    links.reschedule && 'Termin ändern:',
    links.reschedule || '',
    '',
    'Beide Links öffnen eine Seite mit einer Schaltfläche. Erst die Schaltfläche',
    'sagt zu oder ab, damit kein Mailprogramm das aus Versehen für Sie tut.',
    'Ohne Antwort läuft die Vormerkung nach sieben Tagen ab.',
  ])

  return {
    subject: `Neue Anfrage: ${req.name}, ${when} · ${shown(ref)}`,
    text,
    html: shell({title: 'Neue Anfrage', preheader: `${who} — ${when}`, body, ref: shown(ref)}),
  }
}

/** "We have it." Sent the moment the days are held. */
export function received(req: Told, ref: string, cancelLink?: string) {
  const when = germanRange(req.startAt, req.endAt)
  const raeume = list(req.raeume)
  const technik = list(req.technik)

  const body =
    heading('Ihre Anfrage ist da', `Vielen Dank, ${req.name}.`) +
    para(
      `Wir haben ${when} für Sie vorgemerkt und melden uns innerhalb von zwei ` +
        'Werktagen mit einer Zu- oder Absage.',
    ) +
    rows(row('Zeitraum', when) + listRow('Räume', raeume) + listRow('Technik', technik)) +
    cancelBlock(req, cancelLink) +
    note('Sie brauchen nichts weiter zu tun. Antworten Sie einfach auf diese E-Mail, wenn sich etwas ändert.')

  const text = lines([
    `Guten Tag ${req.name},`,
    '',
    `vielen Dank für Ihre Anfrage für ${when}.`,
    'Wir haben die Tage für Sie vorgemerkt und melden uns innerhalb von zwei',
    'Werktagen mit einer Zu- oder Absage.',
    '',
    raeume.length && `Räume:   ${raeume.join(', ')}`,
    technik.length && `Technik: ${technik.join(', ')}`,
    ...cancelLines(req, cancelLink),
    SIGN_OFF,
  ])

  return {
    subject: `Ihre Anfrage bei LUX Studio · ${shown(ref)}`,
    text,
    html: shell({title: 'Ihre Anfrage ist da', preheader: `Vorgemerkt: ${when}`, body, ref: shown(ref)}),
  }
}

/** The yes. */
export function approved(req: Told, ref: string, cancelLink?: string) {
  const when = germanRange(req.startAt, req.endAt)
  const raeume = list(req.raeume)
  const technik = list(req.technik)

  const body =
    heading('Der Termin ist Ihrer', when) +
    para(`Guten Tag ${req.name}, gerne — wir haben den Zeitraum für Sie gebucht.`) +
    rows(row('Zeitraum', when) + listRow('Räume', raeume) + listRow('Technik', technik)) +
    para(
      'Melden Sie sich bitte kurz vor dem Termin, damit wir Schlüssel und ' +
        'Einweisung abstimmen können.',
    ) +
    cancelBlock(req, cancelLink) +
    note('Für Änderungen genügt eine Antwort auf diese E-Mail.')

  const text = lines([
    `Guten Tag ${req.name},`,
    '',
    `gerne — ${when} gehört Ihnen.`,
    '',
    raeume.length && `Räume:   ${raeume.join(', ')}`,
    technik.length && `Technik: ${technik.join(', ')}`,
    '',
    'Melden Sie sich bitte kurz vor dem Termin, damit wir Schlüssel und',
    'Einweisung abstimmen können. Für Änderungen genügt eine Antwort auf',
    'diese E-Mail.',
    ...cancelLines(req, cancelLink),
    SIGN_OFF,
  ])

  return {
    subject: `Ihre Buchung: ${when} · ${shown(ref)}`,
    text,
    html: shell({title: 'Der Termin ist Ihrer', preheader: `Gebucht: ${when}`, body, ref: shown(ref)}),
  }
}

/** The no, which has to be kind and leave a door open. */
export function declined(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)

  const body =
    heading('Leider nicht möglich', when) +
    para(
      `Guten Tag ${req.name}, vielen Dank für Ihr Interesse. ${when} können wir ` +
        'das Studio leider nicht vergeben.',
    ) +
    para(
      'Für einen anderen Zeitraum sind wir gerne für Sie da — antworten Sie ' +
        'einfach auf diese E-Mail, und wir finden einen Termin.',
    ) +
    note('Die angefragten Tage sind wieder frei.')

  const text = lines([
    `Guten Tag ${req.name},`,
    '',
    `vielen Dank für Ihr Interesse. ${when} können wir das Studio leider`,
    'nicht vergeben.',
    '',
    'Für einen anderen Zeitraum sind wir gerne für Sie da — antworten Sie',
    'einfach auf diese E-Mail oder fragen Sie über die Website erneut an.',
    SIGN_OFF,
  ])

  return {
    subject: `Ihre Anfrage für ${when} · ${shown(ref)}`,
    text,
    html: shell({title: 'Leider nicht möglich', preheader: `${when} ist nicht frei`, body, ref: shown(ref)}),
  }
}

/**
 * The guest's own way out.
 *
 * Shown in both messages the guest receives, with the date it stops working,
 * so nobody discovers the deadline by being refused. The page enforces it —
 * this only says so.
 */
function cancelBlock(req: Told, link?: string) {
  if (!link) return ''
  return (
    button('Termin absagen', link, 'secondary') +
    note(
      `Sie können bis zum ${esc(germanDay(cancelUntil(req.startAt)))} hier selbst absagen. ` +
        `Danach — also innerhalb von ${CANCEL_DEADLINE_DAYS} Tagen vor dem Termin — ` +
        'rufen Sie uns bitte an oder antworten Sie auf diese E-Mail.',
    )
  )
}

/** The plain-text twin of the block above. */
function cancelLines(req: Told, link?: string) {
  if (!link) return []
  return [
    '',
    'Termin absagen:',
    link,
    `Selbst absagen können Sie bis zum ${germanDay(cancelUntil(req.startAt))}.`,
    `Danach rufen Sie uns bitte an oder antworten Sie auf diese E-Mail.`,
  ]
}

/** The guest called it off. The studio needs to know, and to see the days again. */
export function cancelledByGuest(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  const body =
    heading('Abgesagt vom Gast', when) +
    para(`${req.name} hat den Termin über den Link in der Bestätigung abgesagt.`) +
    rows(row('Zeitraum', when) + row('Gast', req.name) + row('E-Mail', req.email ?? '', req.email ? `mailto:${req.email}` : undefined)) +
    note('Der Eintrag ist aus dem Kalender entfernt und die Tage sind wieder frei. Es ist nichts weiter zu tun.')

  return {
    subject: `Abgesagt vom Gast: ${req.name}, ${when} · ${shown(ref)}`,
    text: lines([
      `${req.name} hat den Termin abgesagt.`,
      '',
      `Zeitraum: ${when}`,
      req.email && `E-Mail:   ${req.email}`,
      `Buchung:  ${shown(ref)}`,
      '',
      'Der Eintrag ist aus dem Kalender entfernt und die Tage sind wieder frei.',
    ]),
    html: shell({title: 'Abgesagt vom Gast', preheader: `${req.name} — ${when}`, body, ref: shown(ref)}),
  }
}

/** And the guest gets it in writing, so nobody wonders whether it worked. */
export function cancelConfirmed(req: Told, ref: string) {
  const when = germanRange(req.startAt, req.endAt)
  const body =
    heading('Ihr Termin ist abgesagt', when) +
    para(`Guten Tag ${req.name}, wir haben Ihre Absage erhalten. Der Zeitraum ist wieder frei.`) +
    para('Schade — und gerne ein anderes Mal. Antworten Sie einfach auf diese E-Mail, wenn Sie einen neuen Termin suchen.') +
    note('Es entstehen Ihnen keine Kosten.')

  return {
    subject: `Absage bestätigt: ${when} · ${shown(ref)}`,
    text: lines([
      `Guten Tag ${req.name},`,
      '',
      `wir haben Ihre Absage für ${when} erhalten. Der Zeitraum ist wieder frei.`,
      '',
      'Schade — und gerne ein anderes Mal. Antworten Sie einfach auf diese',
      'E-Mail, wenn Sie einen neuen Termin suchen.',
      SIGN_OFF,
    ]),
    html: shell({title: 'Ihr Termin ist abgesagt', preheader: `Abgesagt: ${when}`, body, ref: shown(ref)}),
  }
}

/** The days moved. The guest has to hear the new ones. */
export function moved(req: Told, ref: string, before: {startAt: string; endAt: string}) {
  const was = germanRange(before.startAt, before.endAt)
  const now = germanRange(req.startAt, req.endAt)
  const body =
    heading('Ihr Termin wurde verschoben', now) +
    para(`Guten Tag ${req.name}, wir mussten Ihren Termin verlegen.`) +
    rows(row('Bisher', was) + row('Neu', now) + listRow('Räume', list(req.raeume))) +
    para('Passt das so? Wenn nicht, antworten Sie einfach auf diese E-Mail und wir finden einen anderen Termin.') +
    note('Der neue Zeitraum ist für Sie reserviert.')

  return {
    subject: `Neuer Termin: ${now} · ${shown(ref)}`,
    text: lines([
      `Guten Tag ${req.name},`,
      '',
      'wir mussten Ihren Termin verlegen.',
      '',
      `Bisher: ${was}`,
      `Neu:    ${now}`,
      '',
      'Passt das so? Wenn nicht, antworten Sie einfach auf diese E-Mail und',
      'wir finden einen anderen Termin.',
      SIGN_OFF,
    ]),
    html: shell({title: 'Ihr Termin wurde verschoben', preheader: `Neu: ${now}`, body, ref: shown(ref)}),
  }
}
