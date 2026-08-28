import type {APIRoute} from 'astro'
import {sendMail, oneLine, mailer, studioAddress} from '../../lib/mail'

/**
 * The rental enquiry, on its way to the studio's inbox.
 *
 * Nothing is stored. A free Sanity dataset is readable by anyone who knows the
 * project id, so a visitor's name, telephone number and plans must never land
 * in it. The enquiry is sent as mail and then it is gone from here; the inbox
 * is the record, and deleting it there deletes it everywhere.
 *
 * The studio's own mailbox does the sending, so no third party sees the
 * message either.
 */
export const prerender = false

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

type Inquiry = {
  name?: string
  firma?: string
  email?: string
  telefon?: string
  anfrage?: string
  auswahl?: string
  datum?: string
  seite?: string
  /** Hidden field. A human leaves it empty; most robots fill everything in. */
  website?: string
}

const clean = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const POST: APIRoute = async ({request}) => {
  const to = studioAddress()
  if (!mailer() || !to) {
    return json({error: 'Der Mailversand ist nicht eingerichtet.'}, 500)
  }

  let body: Inquiry
  try {
    body = await request.json()
  } catch {
    return json({error: 'Ungültige Anfrage.'}, 400)
  }

  // The honeypot: silent success, so a robot has nothing to learn from.
  if (clean(body.website, 100)) return json({ok: true})

  const name = clean(body.name, 120)
  const email = clean(body.email, 160)
  const anfrage = clean(body.anfrage, 4000)

  if (!name || !LOOKS_LIKE_EMAIL.test(email) || anfrage.length < 5) {
    return json({error: 'Bitte Name, E-Mail und Anfrage ausfüllen.'}, 400)
  }

  const firma = clean(body.firma, 120)
  const telefon = clean(body.telefon, 60)
  const auswahl = clean(body.auswahl, 300)
  const datum = clean(body.datum, 120)
  const seite = clean(body.seite, 200)

  const lines = [
    `Name:     ${name}`,
    firma && `Firma:    ${firma}`,
    `E-Mail:   ${email}`,
    telefon && `Telefon:  ${telefon}`,
    datum && `Zeitraum: ${datum}`,
    auswahl && `Auswahl:  ${auswahl}`,
    '',
    anfrage,
    '',
    '—',
    seite && `Gesendet über ${seite}`,
  ].filter(Boolean)

  try {
    await sendMail({
      to,
      // Answering the mail answers the person, not the website.
      replyTo: {name: oneLine(name), address: email},
      subject: `Anfrage von ${oneLine(name)}${firma ? ` (${oneLine(firma)})` : ''}`,
      text: lines.join('\n'),
    })
  } catch (error: any) {
    console.error('[inquiry] send failed', error?.message ?? error)
    return json({error: 'Die Anfrage konnte nicht gesendet werden.'}, 502)
  }

  return json({ok: true})
}
