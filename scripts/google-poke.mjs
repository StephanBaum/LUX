/**
 * Change something in the calendar the way a phone would, for testing.
 *
 *   node scripts/google-poke.mjs move   <eventId>   — put it a day later
 *   node scripts/google-poke.mjs rename <eventId> "New name"
 *   node scripts/google-poke.mjs delete <eventId>
 *   node scripts/google-poke.mjs add    "Name"      — a brand new entry
 *   node scripts/google-poke.mjs list
 */
import {createSign} from 'node:crypto'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {config} from 'dotenv'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
config({path: join(root, '.env'), quiet: true})

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'
const CAL = process.env.GOOGLE_CALENDAR_WORKSHOPS
const b64 = (v) =>
  Buffer.from(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const now = Math.floor(Date.now() / 1000)
const unsigned = `${b64(JSON.stringify({alg: 'RS256', typ: 'JWT'}))}.${b64(
  JSON.stringify({
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }),
)}`
const key = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
const assertion = `${unsigned}.${b64(createSign('RSA-SHA256').update(unsigned).sign(key))}`
const access = (
  await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  }).then((r) => r.json())
).access_token

const call = async (path, init = {}) => {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${access}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = response.status === 204 ? {} : await response.json()
  if (!response.ok) throw new Error(body?.error?.message ?? `Fehler ${response.status}`)
  return body
}

const [what, id, extra] = process.argv.slice(2)
const at = (path) => `/calendars/${encodeURIComponent(CAL)}/events${path}`

if (what === 'list') {
  const {items} = await call(at('?maxResults=50&singleEvents=true&orderBy=startTime'))
  console.table(
    (items ?? []).map((e) => ({
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      status: e.status,
    })),
  )
} else if (what === 'move') {
  const event = await call(at(`/${id}`))
  const shift = (value) => new Date(Date.parse(value) + 864e5).toISOString()
  await call(at(`/${id}`), {
    method: 'PATCH',
    body: JSON.stringify({
      start: {dateTime: shift(event.start.dateTime)},
      end: {dateTime: shift(event.end.dateTime)},
    }),
  })
  console.log('moved a day later')
} else if (what === 'rename') {
  await call(at(`/${id}`), {method: 'PATCH', body: JSON.stringify({summary: extra})})
  console.log('renamed to', extra)
} else if (what === 'delete') {
  await call(at(`/${id}`), {method: 'DELETE'})
  console.log('deleted')
} else if (what === 'add') {
  const start = new Date(Date.now() + 45 * 864e5)
  const end = new Date(start.getTime() + 4 * 3600e3)
  const created = await call(at(''), {
    method: 'POST',
    body: JSON.stringify({
      summary: id,
      start: {dateTime: start.toISOString()},
      end: {dateTime: end.toISOString()},
    }),
  })
  console.log('added', created.id)
} else {
  console.log('see the comment at the top of this file')
}
