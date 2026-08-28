/**
 * Does the robot get in, and what can it see?
 *
 * Run with:  node scripts/google-check.mjs
 */
import {createSign} from 'node:crypto'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {config} from 'dotenv'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
config({path: join(root, '.env'), quiet: true})

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const b64 = (v) => Buffer.from(v).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const key = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
if (!email || !key) { console.error('Zugangsdaten fehlen.'); process.exit(1) }

const now = Math.floor(Date.now() / 1000)
const unsigned = `${b64(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${b64(JSON.stringify({
  iss: email, scope: 'https://www.googleapis.com/auth/calendar', aud: TOKEN_URL, iat: now, exp: now + 3600,
}))}`
const assertion = `${unsigned}.${b64(createSign('RSA-SHA256').update(unsigned).sign(key))}`

const res = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion}),
})
const body = await res.json()
if (!body.access_token) { console.error('Kein Token:', JSON.stringify(body)); process.exit(1) }
console.log('token: ok')

const list = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
  headers: {Authorization: `Bearer ${body.access_token}`},
}).then((r) => r.json())

const items = list.items ?? []
console.log(`\ncalendars the robot can see: ${items.length}`)
for (const c of items) console.log(`  ${c.accessRole.padEnd(8)} ${c.summary}  →  ${c.id}`)
if (items.length === 0) console.log('  (share a calendar with the robot, or let it make its own)')
