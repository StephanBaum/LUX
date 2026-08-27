/**
 * Translate every document at once, the same way the Studio's "Übersetzen"
 * button does one — useful after seeding, when nothing is translated yet.
 *
 * Run with:  npm run translate
 * Add --force to re-translate everything, ignoring the stored snapshot.
 *
 * Only the fields whose German changed since the last run are sent, so this is
 * cheap to re-run and never overwrites a translation corrected by hand.
 */
import {client} from './lib.mjs'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash'
const API_KEY = process.env.GEMINI_API_KEY

if (!API_KEY) {
  console.error('GEMINI_API_KEY is missing from .env')
  process.exit(1)
}

const force = process.argv.includes('--force')

const SKIP_KEYS = new Set([
  '_id', '_type', '_rev', '_key', '_ref', '_weak', '_createdAt', '_updatedAt', '_system',
  'i18n', 'slug', 'asset', 'hotspot', 'crop', 'order', 'startAt', 'endAt', 'updatedAt',
  'linkHref', 'url', 'email', 'instagram', 'facebook', 'linkedin', 'phone', 'fax',
  'mobile', 'street', 'postalCode', 'vatId', 'months', 'monthsShort', 'googleEventId',
  'googleCalendarId', 'syncedTitle', 'syncedStartAt', 'syncedEndAt', 'syncedAt',
  'syncStatus', 'syncMessage', 'marks', 'markDefs', 'style', 'listItem', 'level',
])

const SKIP_TYPES = new Set(['equipmentItem'])
const LANGUAGES = [['en', 'English'], ['fr', 'French'], ['lu', 'Luxembourgish (Lëtzebuergesch)']]

const LOOKS_LIKE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i
const HAS_LETTERS = /\p{L}/u

function collectText(doc) {
  const out = {}
  const walk = (value, path) => {
    if (Array.isArray(value)) return value.forEach((item, i) => walk(item, [...path, String(i)]))
    if (!value || typeof value !== 'object') return

    for (const [key, item] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue
      if (
        typeof item === 'string' &&
        item.trim() &&
        !LOOKS_LIKE_URL.test(item.trim()) &&
        HAS_LETTERS.test(item)
      ) {
        out[[...path, key].join('.')] = item
      } else if (item && typeof item === 'object') {
        walk(item, [...path, key])
      }
    }
  }
  walk(doc, [])
  return out
}

function nest(flat) {
  const out = {}
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.')
    let target = out
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        target[part] = value
        return
      }
      if (target[part] === undefined) target[part] = /^\d+$/.test(parts[i + 1]) ? [] : {}
      target = target[part]
    })
  }
  return out
}

function flatten(value, path = [], out = {}) {
  if (typeof value === 'string') {
    out[path.join('.')] = value
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, [...path, String(i)], out))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) flatten(item, [...path, key], out)
  }
  return out
}

const parse = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const SYSTEM = `You translate website copy for a German photography and film studio.

Rules:
- Translate from German into the target language.
- Keep the tone: confident, plain, no marketing filler.
- Keep proper nouns, brand names, equipment names and people's names unchanged.
- Keep punctuation that carries meaning, including the em dash.
- Do not add, remove or reorder anything. One input string, one output string.
- Return only the JSON object described by the schema.`

async function translate(language, texts) {
  const paths = Object.keys(texts)
  const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      systemInstruction: {parts: [{text: SYSTEM}]},
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Translate every value into ${language}. Keep the keys exactly as they are.\n\n${JSON.stringify(texts, null, 2)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: Object.fromEntries(paths.map((p) => [p, {type: 'STRING'}])),
          required: paths,
        },
      },
    }),
  })

  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`)

  const body = await response.json()
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
  const parsed = parse(text) ?? {}

  const clean = {}
  for (const path of paths) {
    if (typeof parsed[path] === 'string' && parsed[path].trim()) clean[path] = parsed[path]
  }
  return clean
}

const docs = await client
  .withConfig({perspective: 'raw'})
  .fetch('*[!(_id in path("drafts.**")) && !(_type match "sanity.*") && !(_type match "system.*")]')

let translated = 0
let skipped = 0

for (const doc of docs) {
  if (SKIP_TYPES.has(doc._type)) continue

  const german = collectText(doc)
  if (Object.keys(german).length === 0) continue

  const previous = force ? null : parse(doc.i18n?.translatedFrom)
  const changed = previous
    ? Object.fromEntries(Object.entries(german).filter(([p, t]) => previous[p] !== t))
    : german

  if (Object.keys(changed).length === 0) {
    skipped++
    continue
  }

  const patch = {}
  for (const [code, language] of LANGUAGES) {
    const result = await translate(language, changed)
    if (Object.keys(result).length === 0) continue
    const merged = {...flatten(parse(doc.i18n?.[code]) ?? {}), ...result}
    patch[`i18n.${code}`] = JSON.stringify(nest(merged))
  }

  if (Object.keys(patch).length === 0) {
    console.warn(`  nothing came back for ${doc._id}`)
    continue
  }

  patch['i18n.translatedFrom'] = JSON.stringify(nest(german))
  patch['i18n.translatedAt'] = new Date().toISOString()

  await client.patch(doc._id).setIfMissing({i18n: {}}).set(patch).commit()

  translated++
  console.log(`  ${doc._id} — ${Object.keys(changed).length} field(s)`)
}

console.log(`Translated ${translated} document(s); ${skipped} already up to date.`)
