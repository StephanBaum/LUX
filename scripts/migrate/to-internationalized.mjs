/**
 * One-off: move translations from the old JSON mirror onto the fields.
 *
 * Until now a document held German strings plus an `i18n` object with one JSON
 * blob per language. The Studio now stores every translatable field inline as
 * `[{_key, language, value}]`, which is what the internationalized-array plugin
 * reads and what puts the German next to its translation in the form.
 *
 * This converts the German, folds the old blobs in as the other languages, and
 * drops `i18n`. Safe to re-run: a field already converted is left alone.
 *
 * Run with:  npm run migrate:i18n
 */
import {client} from './lib.mjs'

/** Field names that stay a plain string — must match the schema. */
const KEEP_PLAIN = new Set([
  'name', 'email', 'instagram', 'facebook', 'linkedin', 'phone', 'fax', 'mobile',
  'street', 'postalCode', 'city', 'country', 'vatId', 'studioName', 'companyName',
  'linkHref', 'url', 'category', 'size',
])

/** Structural keys, never content. */
const SKIP_KEYS = new Set([
  '_id', '_type', '_rev', '_key', '_ref', '_weak', '_createdAt', '_updatedAt', '_system',
  'i18n', 'slug', 'asset', 'hotspot', 'crop', 'order', 'startAt', 'endAt',
  'updatedAt', 'translatedFrom', 'translatedAt', 'googleEventId', 'googleCalendarId',
  'syncedTitle', 'syncedStartAt', 'syncedEndAt', 'syncedAt', 'syncStatus', 'syncMessage',
])

/** Fields that are a list rather than a single string. */
const LIST_FIELDS = new Set(['features', 'body'])

const LANGS = ['de', 'en', 'fr', 'lu']

const parse = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const isConverted = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => item && typeof item === 'object' && typeof item.language === 'string')

/** Follow a dotted path into one of the old translation blobs. */
function at(source, path) {
  let value = source
  for (const part of path) {
    if (value === undefined || value === null) return undefined
    value = value[part]
  }
  return value
}

function entriesFor(german, mirrors, path) {
  const out = [{_key: 'de', language: 'de', value: german}]
  for (const lang of LANGS.slice(1)) {
    const translated = at(mirrors[lang], path)
    if (translated === undefined || translated === null || translated === '') continue
    out.push({_key: lang, language: lang, value: translated})
  }
  return out
}

/** Rewrite a document in place; returns true when anything changed. */
function convert(node, mirrors, path, state) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => convert(item, mirrors, [...path, String(i)], state))
    return
  }
  if (!node || typeof node !== 'object') return

  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) continue
    const here = [...path, key]

    if (isConverted(value)) continue

    const translatableString =
      typeof value === 'string' && value.trim() && !KEEP_PLAIN.has(key)

    const translatableList =
      LIST_FIELDS.has(key) && Array.isArray(value) && value.length > 0

    if (translatableString || translatableList) {
      node[key] = entriesFor(value, mirrors, here)
      state.fields++
      continue
    }

    if (value && typeof value === 'object') convert(value, mirrors, here, state)
  }
}

const docs = await client
  .withConfig({perspective: 'raw'})
  .fetch('*[!(_type match "sanity.*") && !(_type match "system.*") && !(_id in path("_.**"))]')

let touched = 0
let fields = 0

for (const doc of docs) {
  const mirrors = {
    en: parse(doc.i18n?.en) ?? {},
    fr: parse(doc.i18n?.fr) ?? {},
    lu: parse(doc.i18n?.lu) ?? {},
  }

  const next = JSON.parse(JSON.stringify(doc))
  const state = {fields: 0}
  convert(next, mirrors, [], state)

  const hadMirror = Boolean(doc.i18n)
  if (state.fields === 0 && !hadMirror) continue

  delete next.i18n
  delete next._rev
  delete next._system

  await client.createOrReplace(next)

  touched++
  fields += state.fields
  console.log(`  ${doc._id} — ${state.fields} field(s)`)
}

console.log(`Converted ${fields} field(s) across ${touched} document(s).`)
