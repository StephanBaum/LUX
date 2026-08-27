/**
 * Put the service account key into .env, in the shape Vercel can hold.
 *
 * The private key in Google's JSON file has real line breaks. An environment
 * variable cannot, so each break is written out as \n and the code puts them
 * back. Doing that by hand is easy to get wrong and impossible to debug, so it
 * is done here.
 *
 * Run with:  node scripts/google-key.mjs <path to the downloaded json>
 */
import {readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = process.argv[2]

if (!source) {
  console.error('Usage: node scripts/google-key.mjs <path to the downloaded json>')
  process.exit(1)
}

const key = JSON.parse(readFileSync(source, 'utf8'))

if (!key.client_email || !key.private_key) {
  console.error('That does not look like a service account key: no client_email or private_key.')
  process.exit(1)
}

const values = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: key.client_email,
  GOOGLE_PRIVATE_KEY: key.private_key.replace(/\n/g, '\n'),
}

const path = join(root, '.env')
let env = readFileSync(path, 'utf8')

for (const [name, value] of Object.entries(values)) {
  const line = `${name}=${value}`
  const existing = new RegExp(`^${name}=.*$`, 'm')
  env = existing.test(env) ? env.replace(existing, line) : `${env.trimEnd()}\n${line}\n`
}

writeFileSync(path, env)

console.log('.env updated:')
console.log('  GOOGLE_SERVICE_ACCOUNT_EMAIL =', key.client_email)
console.log('  GOOGLE_PRIVATE_KEY           = set,', values.GOOGLE_PRIVATE_KEY.length, 'characters')
console.log(`\nProject: ${key.project_id}`)
console.log(`\nShare both calendars with ${key.client_email} — "Make changes to events".`)
