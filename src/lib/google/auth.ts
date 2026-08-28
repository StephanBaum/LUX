import {createSign} from 'node:crypto'

/**
 * An access token for the studio's calendars.
 *
 * A service account is a robot with its own e-mail address. The client shares
 * a calendar with that address, exactly as he would with a colleague, and can
 * take the sharing away again — no OAuth screen, no personal Google login tied
 * to the website, nothing to re-approve when a token expires.
 *
 * Signing the request ourselves keeps the googleapis package — several
 * megabytes of it — out of a serverless function that needs four calls.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/calendar'

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

let cached: {token: string; until: number} | null = null

/**
 * The private key as OpenSSL wants it, whichever way it was pasted.
 *
 * A key can arrive with real line breaks, or written on one line with each
 * break spelled out as the two characters \ and n — that is the only shape a
 * single-line .env entry can hold, and it is what `npm run google:key` writes.
 * Both have to end up as real breaks or the signing throws
 * `error:1E08010C:DECODER routines::unsupported`, which says nothing about
 * what is actually wrong.
 */
export function normalisePrivateKey(value: string | undefined | null) {
  const raw = value ?? ''
  // Quotes only come from a .env file that needed them. A key that arrives
  // unquoted is handed back as it is, trailing line break and all.
  const bare = /^\s*["']/.test(raw) ? raw.trim().replace(/^["']|["']$/g, '') : raw
  return bare.replace(/\\n/g, '\n')
}

export function calendarCredentials() {
  const email = import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = normalisePrivateKey(import.meta.env.GOOGLE_PRIVATE_KEY)
  return email && key ? {email, key} : null
}

export async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token

  const credentials = calendarCredentials()
  if (!credentials) throw new Error('Google-Zugangsdaten fehlen.')

  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: credentials.email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${base64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}))}.${base64url(
    JSON.stringify(claim),
  )}`

  const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.key)
  const assertion = `${unsigned}.${base64url(signature)}`

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) {
    throw new Error(`Google lässt uns nicht herein (${response.status}): ${body.error ?? ''}`)
  }

  cached = {token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000}
  return cached.token
}
