import type {APIRoute} from 'astro'
import {sanityClient} from '../../lib/sanity/client'
import {asBlockedDates} from '../../lib/content/occupancy'
import {fetchReservations} from '../../lib/content/busy'
import {createRawEvent, deleteEvent} from '../../lib/google/calendar'
import {calendarCredentials} from '../../lib/google/auth'
import {seal, SEVEN_DAYS, type ReservationClaim} from '../../lib/reservation/token'
import {reference, heldEvent, overlaps, type Request as Req} from '../../lib/reservation/hold'
import {toStudio, received} from '../../lib/reservation/messages'
import {sendMail, oneLine, mailer, studioAddress} from '../../lib/mail'

/**
 * A rental request, on its way to the studio's inbox — and its days held in
 * the calendar while the studio makes up its mind.
 *
 * Nothing is stored here. The days are held by a tentative calendar entry
 * that names nobody, and everything the approval needs travels encrypted
 * inside the two links in the studio's e-mail.
 */
export const prerender = false

const env = import.meta.env

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

const clean = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''

/**
 * The ticked rooms and equipment. A list, capped in both directions, because
 * it is written by whoever is posting and ends up in an e-mail.
 */
const cleanList = (value: unknown) =>
  Array.isArray(value)
    ? value.map((entry) => clean(entry, 120)).filter(Boolean).slice(0, 40)
    : []

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const LOOKS_LIKE_DAY = /^\d{4}-\d{2}-\d{2}$/

export const POST: APIRoute = async ({request}) => {
  const calendarId = env.GOOGLE_CALENDAR_RESERVATIONS
  const key = env.RESERVATION_SECRET
  const site = env.PUBLIC_SITE_URL
  const to = studioAddress()

  // Not set up is not an error: the form falls back to the plain enquiry.
  if (!calendarId || !key || !site || !calendarCredentials() || !mailer() || !to) {
    return json({skipped: 'Reservierungen sind nicht eingerichtet.'})
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return json({error: 'Ungültige Anfrage.'}, 400)
  }

  // The honeypot: silent success, so a robot has nothing to learn from.
  if (clean(body.website, 100)) return json({ok: true, ref: reference()})

  const req: Req = {
    name: clean(body.name, 120),
    email: clean(body.email, 160),
    firma: clean(body.firma, 120) || undefined,
    telefon: clean(body.telefon, 60) || undefined,
    anfrage: clean(body.anfrage, 4000),
    raeume: cleanList(body.raeume),
    technik: cleanList(body.technik),
    startAt: clean(body.startAt, 10),
    endAt: clean(body.endAt, 10),
  }

  if (!req.name || !LOOKS_LIKE_EMAIL.test(req.email)) {
    return json({error: 'Bitte Name und E-Mail ausfüllen.'}, 400)
  }
  if (!LOOKS_LIKE_DAY.test(req.startAt) || !LOOKS_LIKE_DAY.test(req.endAt)) {
    return json({error: 'Bitte einen Zeitraum wählen.'}, 400)
  }
  if (req.endAt <= req.startAt) {
    return json({error: 'Das Ende muss nach dem Beginn liegen.'}, 400)
  }
  if (req.startAt < new Date().toISOString().slice(0, 10)) {
    return json({error: 'Der Zeitraum liegt in der Vergangenheit.'}, 400)
  }

  /*
   * The browser already greys out taken days, but two people can send the
   * same day within seconds of each other and only the server can settle it.
   * This is not a lock — see section 8 of the design — but it catches
   * everything except a true tie.
   */
  const [reservations, docs] = await Promise.all([
    fetchReservations(env.ICAL_RESERVATIONS_URL || ''),
    sanityClient
      .fetch(`*[_type in ["workshop", "event"] && defined(startAt)]{_id, _type, title, startAt, endAt}`)
      .catch(() => []),
  ])
  const busy = [...reservations.events, ...asBlockedDates(docs)]

  if (overlaps(req, busy)) {
    return json({error: 'Diese Tage sind inzwischen vergeben.', code: 'taken'}, 409)
  }

  const ref = reference()

  let eventId: string
  try {
    const created = await createRawEvent(calendarId, heldEvent(ref, req.startAt, req.endAt, req.raeume))
    eventId = created.id as string
  } catch (error: any) {
    console.error('[reservation] hold failed', error?.message ?? error)
    return json({error: 'Die Anfrage konnte nicht gespeichert werden.'}, 502)
  }

  const link = (a: 'approve' | 'decline') => {
    const claim: ReservationClaim = {
      r: ref,
      c: calendarId,
      e: eventId,
      a,
      n: req.name,
      m: req.email,
      d: `${req.startAt}/${req.endAt}`,
      x: Date.now() + SEVEN_DAYS,
    }
    return `${site.replace(/\/$/, '')}/api/reservation/${a}?t=${seal(claim, key)}`
  }

  /*
   * The mail to the studio is the only record of who asked, so a hold whose
   * mail never arrived is a day blocked for a request nobody can read. If it
   * fails, the hold goes with it.
   */
  try {
    const message = toStudio(req, ref, {approve: link('approve'), decline: link('decline')})
    await sendMail({
      to,
      replyTo: {name: oneLine(req.name), address: req.email},
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
  } catch (error: any) {
    console.error('[reservation] studio mail failed', error?.message ?? error)
    await deleteEvent(calendarId, eventId)
    return json({error: 'Die Anfrage konnte nicht gesendet werden.'}, 502)
  }

  // The request is safe in the studio's inbox by now, so this one may fail.
  const note = received(req, ref)
  try {
    await sendMail({to: req.email, subject: note.subject, text: note.text, html: note.html})
  } catch (error: any) {
    console.error('[reservation] visitor mail failed', error?.message ?? error)
  }

  return json({ok: true, ref})
}
