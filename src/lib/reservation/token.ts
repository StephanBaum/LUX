import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'

/**
 * The approve and decline links.
 *
 * The calendar entry deliberately holds no name, so the link is the only
 * thing that knows who asked. That makes encryption the requirement rather
 * than a signature: a URL ends up in mail logs, browser history and Vercel's
 * request log, and none of those may hold a customer's address in the clear.
 *
 * AES-256-GCM authenticates as well as encrypts, so a tampered token fails to
 * open rather than needing a signature of its own.
 */

const IV_BYTES = 12

export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export type ReservationClaim = {
  /** The reference the studio sees in the calendar and in the subject line. */
  r: string
  /** Calendar id. */
  c: string
  /** Event id — the held entry. */
  e: string
  a: 'approve' | 'decline' | 'cancel' | 'reschedule'
  /** The visitor's name and address, which live nowhere else but the mailbox. */
  n: string
  m: string
  /** The days, for the confirmation page and the e-mail. */
  d: string
  /** Expires at, epoch milliseconds. */
  x: number
}

function keyOf(key: string) {
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error('RESERVATION_SECRET muss 32 Bytes als Hex sein (openssl rand -hex 32).')
  }
  const bytes = Buffer.from(key, 'hex')
  return bytes
}

export function seal(claim: ReservationClaim, key: string) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', keyOf(key), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(claim), 'utf8'), cipher.final()])
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')
}

export function open(token: string, key: string, now = new Date()): ReservationClaim {
  const raw = Buffer.from(token, 'base64url')
  if (raw.length < IV_BYTES + 16 + 1) throw new Error('Der Link ist unvollständig.')

  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(raw.length - 16)
  const body = raw.subarray(IV_BYTES, raw.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', keyOf(key), iv)
  decipher.setAuthTag(tag)

  // Throws if the token was touched, or made with another key.
  const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  const claim = JSON.parse(plain) as ReservationClaim

  if (!claim || typeof claim.x !== 'number') throw new Error('Der Link ist ungültig.')
  if (claim.x <= now.getTime()) throw new Error('Der Link ist abgelaufen.')

  return claim
}
