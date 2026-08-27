/**
 * Bring every document's translations up to date, and record where they stand.
 *
 * The Studio translates on publish, but it only knows a German sentence has
 * changed if it wrote down what that sentence used to say. Until a document
 * has been published once, there is nothing written down — so an edited field
 * looked untouched and was skipped. This fills in both at once: it translates
 * whatever is still missing and records a fingerprint for every field, so from
 * here on a corrected word is noticed.
 *
 * Needs the dev server running, because that is where the Google key lives.
 *
 * Run with:  npm run translate:all
 */
import {client} from './lib.mjs'
import {
  collectFields,
  fingerprint,
  LANGUAGES,
  staleFields,
  textFor,
  valueFor,
} from '../../src/lib/content/translatable.ts'

const BASE = process.env.SITE_URL ?? 'http://localhost:4321'
const STATE_ID = 'translation-state'
const ORDER = ['de', ...LANGUAGES.map((language) => language.code)]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** The dev server restarts when a file changes; a dropped socket is not a failure. */
async function translateInto(target, texts, attempt = 1) {
  try {
    const response = await fetch(`${BASE}/api/translate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({target, texts}),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? `Fehler ${response.status}`)
    return body.translations ?? {}
  } catch (error) {
    if (attempt >= 4) throw error
    console.log(`  retrying (${attempt})…`)
    await wait(attempt * 3000)
    return translateInto(target, texts, attempt + 1)
  }
}

async function saveState(state) {
  await client.createIfNotExists({_id: STATE_ID, _type: 'translationState'})
  await client.patch(STATE_ID).set({fingerprints: JSON.stringify(state)}).commit()
}

const merge = (entries, language, value) =>
  [...entries.filter((entry) => entry.language !== language), {_key: language, language, value}].sort(
    (a, b) => ORDER.indexOf(a.language) - ORDER.indexOf(b.language),
  )

const documents = await client.fetch(
  `*[!(_id in path("drafts.**")) && !(_type in [
    "sanity.imageAsset", "sanity.fileAsset", "translationState", "equipmentItem"
  ])] | order(_id asc)`,
)

const raw = await client.fetch('*[_id == $id][0].fingerprints', {id: STATE_ID})
const state = JSON.parse(raw || '{}')

for (const doc of documents) {
  const all = collectFields(doc)
  if (all.length === 0) continue

  const seen = state[doc._id] ?? {}
  const patch = {}
  const done = []

  for (const {code, label} of LANGUAGES) {
    const stale = staleFields(all, code, seen)
    if (stale.length === 0) continue

    const translations = await translateInto(code, textFor(stale))
    if (Object.keys(translations).length === 0) continue

    for (const field of stale) {
      const current = patch[field.patch] ?? field.entries
      patch[field.patch] = merge(current, code, valueFor(field, code, translations))
    }
    done.push(`${label} (${stale.length})`)
  }

  if (Object.keys(patch).length > 0) {
    await client.patch(doc._id).set(patch).commit()
    console.log(`${doc._id}: ${done.join(', ')}`)
  } else {
    console.log(`${doc._id}: already up to date`)
  }

  state[doc._id] = Object.fromEntries(all.map((field) => [field.patch, fingerprint(field)]))
}

await client.createIfNotExists({_id: STATE_ID, _type: 'translationState'})
await client.patch(STATE_ID).set({fingerprints: JSON.stringify(state)}).commit()
console.log(`\nfingerprints recorded for ${Object.keys(state).length} documents`)
