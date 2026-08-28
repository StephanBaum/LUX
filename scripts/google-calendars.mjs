/**
 * Make the two calendars the sync needs, owned by the robot.
 *
 * Two, not one, on purpose: an entry made on a phone carries no type, so the
 * calendar it lands in is the only thing that says whether it is a workshop or
 * an event. One calendar would leave that unanswerable.
 *
 * Pass an e-mail address to also hand that person ownership, so the calendars
 * show up in their own Google Calendar:
 *
 *   node scripts/google-calendars.mjs [you@example.com]
 */
import {createSign} from 'node:crypto'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {readFileSync, writeFileSync} from 'node:fs'
import {config} from 'dotenv'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
config({path: join(root, '.env'), quiet: true})

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'
const b64 = (v) =>
  Buffer.from(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function token() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64(JSON.stringify({alg: 'RS256', typ: 'JWT'}))}.${b64(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )}`
  const assertion = `${unsigned}.${b64(createSign('RSA-SHA256').update(unsigned).sign(key))}`
  const body = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  }).then((r) => r.json())
  if (!body.access_token) throw new Error(JSON.stringify(body))
  return body.access_token
}

const access = await token()

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

const owner = process.argv[2]

const WANTED = [
  {name: 'LUX Studio — Workshops', variable: 'GOOGLE_CALENDAR_WORKSHOPS'},
  {name: 'LUX Studio — Veranstaltungen', variable: 'GOOGLE_CALENDAR_EVENTS'},
]

const existing = (await call('/users/me/calendarList')).items ?? []
const values = {}

for (const {name, variable} of WANTED) {
  let calendar = existing.find((c) => c.summary === name)

  if (calendar) {
    console.log(`${name}: already there`)
  } else {
    calendar = await call('/calendars', {
      method: 'POST',
      body: JSON.stringify({summary: name, timeZone: 'Europe/Berlin'}),
    })
    console.log(`${name}: created`)
  }

  if (owner) {
    await call(`/calendars/${encodeURIComponent(calendar.id)}/acl`, {
      method: 'POST',
      body: JSON.stringify({role: 'owner', scope: {type: 'user', value: owner}}),
    })
    console.log(`  handed to ${owner}`)
  }

  values[variable] = calendar.id
}

const path = join(root, '.env')
let env = readFileSync(path, 'utf8')
for (const [name, value] of Object.entries(values)) {
  const line = `${name}=${value}`
  const found = new RegExp(`^${name}=.*$`, 'm')
  env = found.test(env) ? env.replace(found, line) : `${env.trimEnd()}\n${line}\n`
}
writeFileSync(path, env)

console.log('\n.env updated:')
for (const [name, value] of Object.entries(values)) console.log(`  ${name}=${value}`)
if (owner) {
  console.log(`\nBoth calendars now show up in ${owner}'s Google Calendar.`)
} else {
  console.log('\nNobody can see them yet. Re-run with an e-mail address to hand them over.')
}
