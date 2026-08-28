import nodemailer from 'nodemailer'

/**
 * The studio's own mailbox does the sending, so no third party ever sees the
 * message. Nothing here is stored: the inbox is the record.
 */

const env = import.meta.env

let transport: nodemailer.Transporter | null = null

export function mailer() {
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

/** A header must never carry a line break, or a robot could add its own headers. */
export const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ')

/** Where enquiries and requests land. */
export const studioAddress = () => env.INQUIRY_TO || env.SMTP_USER || ''

export async function sendMail(message: {
  to: string
  subject: string
  text: string
  /**
   * Sent alongside the text, never instead of it. A client that blocks HTML,
   * or a person who prefers plain mail, still gets the whole message.
   */
  html?: string
  replyTo?: {name: string; address: string}
}) {
  const post = mailer()
  if (!post) throw new Error('Der Mailversand ist nicht eingerichtet.')

  await post.sendMail({
    from: {name: 'LUX Studio', address: env.SMTP_FROM || env.SMTP_USER},
    to: message.to,
    replyTo: message.replyTo,
    subject: oneLine(message.subject),
    text: message.text,
    ...(message.html ? {html: message.html} : {}),
  })
}
