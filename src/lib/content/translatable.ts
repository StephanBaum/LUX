/**
 * Which parts of a document are text a human wrote, and therefore worth
 * translating. Shared by the Studio's "Übersetzen" action and the endpoint
 * behind it, so both agree on exactly what gets sent.
 */

/** Structural or machine-owned keys: never translate, never send. */
const SKIP_KEYS = new Set([
  '_id',
  '_type',
  '_rev',
  '_key',
  '_ref',
  '_weak',
  '_createdAt',
  '_updatedAt',
  '_system',
  'i18n',
  'slug',
  'asset',
  'hotspot',
  'crop',
  'order',
  'startAt',
  'endAt',
  'updatedAt',
  'linkHref',
  'url',
  'email',
  'instagram',
  'facebook',
  'linkedin',
  'phone',
  'fax',
  'mobile',
  'street',
  'postalCode',
  'vatId',
  'months',
  'monthsShort',
  'googleEventId',
  'googleCalendarId',
  'syncedTitle',
  'syncedStartAt',
  'syncedEndAt',
  'syncedAt',
  'syncStatus',
  'syncMessage',
  'marks',
  'markDefs',
  'style',
  'listItem',
  'level',
])

/** Whole document types whose text is not translated. */
const SKIP_TYPES = new Set([
  // Product names — "ARRI SkyPanel S60" is the same in every language.
  'equipmentItem',
])

const LOOKS_LIKE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i
const HAS_LETTERS = /\p{L}/u

function isTranslatable(key: string, value: unknown): value is string {
  if (SKIP_KEYS.has(key)) return false
  if (typeof value !== 'string') return false
  if (!value.trim()) return false
  if (LOOKS_LIKE_URL.test(value.trim())) return false
  // Dates, numbers, codes: nothing to translate.
  if (!HAS_LETTERS.test(value)) return false
  return true
}

/** A flat map of dotted path to German text. */
export type TextMap = Record<string, string>

export function collectText(doc: any): TextMap {
  const out: TextMap = {}
  if (!doc || SKIP_TYPES.has(doc._type)) return out

  const walk = (value: any, path: string[]) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...path, String(i)]))
      return
    }
    if (!value || typeof value !== 'object') return

    for (const [key, item] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue
      if (isTranslatable(key, item)) {
        out[[...path, key].join('.')] = item
      } else if (item && typeof item === 'object') {
        walk(item, [...path, key])
      }
    }
  }

  walk(doc, [])
  return out
}

/** Turn a flat path map back into the nested shape the site merges over German. */
export function nest(flat: TextMap): Record<string, any> {
  const out: Record<string, any> = {}

  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.')
    let target = out

    parts.forEach((part, i) => {
      const last = i === parts.length - 1
      if (last) {
        target[part] = value
        return
      }
      const nextIsIndex = /^\d+$/.test(parts[i + 1])
      if (target[part] === undefined) target[part] = nextIsIndex ? [] : {}
      target = target[part]
    })
  }

  return out
}

/** Only the entries whose German differs from the last translated snapshot. */
export function changedOnly(current: TextMap, previous: TextMap | null): TextMap {
  if (!previous) return current
  const out: TextMap = {}
  for (const [path, text] of Object.entries(current)) {
    if (previous[path] !== text) out[path] = text
  }
  return out
}

export const LANGUAGES = [
  {code: 'en', label: 'English'},
  {code: 'fr', label: 'Französisch'},
  {code: 'lu', label: 'Luxemburgisch'},
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']
