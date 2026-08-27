import type {APIRoute} from 'astro'
import nodemailer from 'nodemailer'

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

const env = import.meta.env

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

/** A header must never carry a line break, or a robot could add its own headers. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ')

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

let transport: nodemailer.Transporter | null = null

function mailer() {
  if (transport) return transport

  const host = env.SMTP_HOST
  const user = env.SMTP_USER
  const pass = env.SMTP_PASS
  if (!host || !user || !pass) return null

  const port = Number(env.SMTP_PORT ?? 587)

  transport = nodemailer.createTransport({
    host,
    port,
    // 465 is SSL from the first byte; 587 starts plain and upgrades.
    secure: port === 465,
    auth: {user, pass},
    // A serverless function is killed if it waits too long. Fail loudly instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  return transport
}

export const POST: APIRoute = async ({request}) => {
  const post = mailer()
  const to = env.INQUIRY_TO || env.SMTP_USER
  if (!post || !to) {
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
    await post.sendMail({
      from: {name: 'LUX Studio Website', address: env.SMTP_FROM || env.SMTP_USER},
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
