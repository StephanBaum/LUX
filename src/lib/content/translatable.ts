/**
 * Finding the German text on a document and putting translations back beside
 * it. Shared by the Studio (publish translates automatically) and the
 * command-line seed, so both agree on exactly what gets sent.
 *
 * Every translatable field is an internationalized array:
 *   [{_key: 'de', language: 'de', value: …}, {_key: 'en', language: 'en', value: …}]
 *
 * `value` is usually a string, but it can also be a list of words (room
 * features) or rich text (the legal pages), so the text is pulled out of each
 * shape and pushed back into a copy of the same shape.
 */

export const LANGUAGES = [
  {code: 'en', label: 'English'},
  {code: 'fr', label: 'Französisch'},
  {code: 'lu', label: 'Luxemburgisch'},
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const SOURCE_LANGUAGE = 'de'

type Entry = {language: string; value: unknown; _key?: string}

const isInternationalized = (value: unknown): value is Entry[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => item && typeof item === 'object' && typeof (item as any).language === 'string')

const LOOKS_LIKE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i
const HAS_LETTERS = /\p{L}/u

const worthTranslating = (text: unknown): text is string =>
  typeof text === 'string' &&
  text.trim().length > 0 &&
  !LOOKS_LIKE_URL.test(text.trim()) &&
  HAS_LETTERS.test(text)

/** Pull every translatable leaf out of one field value. */
function leaves(value: unknown, path: string[] = [], out: Record<string, string> = {}) {
  if (worthTranslating(value)) {
    out[path.join('.')] = value
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => leaves(item, [...path, String(i)], out))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      // Rich text carries formatting alongside the words; only the words move.
      if (key === 'marks' || key === 'markDefs' || key === '_key' || key === '_type') continue
      leaves(item, [...path, key], out)
    }
  }
  return out
}

/** Rebuild a field value with its leaves replaced. */
function withLeaves(value: unknown, replacements: Record<string, string>, path: string[] = []): any {
  const key = path.join('.')
  if (worthTranslating(value)) return replacements[key] ?? value
  if (Array.isArray(value)) return value.map((item, i) => withLeaves(item, replacements, [...path, String(i)]))
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [name, item] of Object.entries(value)) {
      out[name] = name === 'marks' || name === 'markDefs' || name === '_key' || name === '_type'
        ? item
        : withLeaves(item, replacements, [...path, name])
    }
    return out
  }
  return value
}

export type Field = {
  /** Where the field sits, e.g. ['header', 'title'] or ['sections', '0', 'body']. */
  path: string[]
  /**
   * The same place, written the way a Sanity patch wants it. An item in a list
   * is addressed by its key rather than its position — `gallery[_key=="ab12"]`,
   * not `gallery.2` — because a plain number is not valid there, and because
   * the position changes the moment somebody reorders the list.
   */
  patch: string
  /** The German value, in whatever shape the field uses. */
  german: unknown
  /** The whole array as stored, so entries can be replaced in place. */
  entries: Entry[]
}

/** Every internationalized field on a document that has German text in it. */
export function collectFields(doc: any): Field[] {
  const found: Field[] = []

  const walk = (value: any, path: string[], patch: string) => {
    if (isInternationalized(value)) {
      const german = value.find((entry) => entry.language === SOURCE_LANGUAGE)?.value
      if (german !== undefined && Object.keys(leaves(german)).length > 0) {
        found.push({path, patch, german, entries: value})
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) =>
        walk(item, [...path, String(i)], item?._key ? `${patch}[_key=="${item._key}"]` : `${patch}[${i}]`),
      )
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key.startsWith('_')) continue
        walk(item, [...path, key], patch ? `${patch}.${key}` : key)
      }
    }
  }

  walk(doc, [], '')
  return found
}

/** A flat map of "field path::leaf path" to German text, ready to send. */
export function textFor(fields: Field[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of fields) {
    for (const [leaf, text] of Object.entries(leaves(field.german))) {
      out[`${field.path.join('.')}::${leaf}`] = text
    }
  }
  return out
}

/** The fields whose German differs from what is already stored for `language`. */
export function staleFields(fields: Field[], language: string): Field[] {
  return fields.filter((field) => {
    const existing = field.entries.find((entry) => entry.language === language)
    if (!existing) return true
    // A translation is stale when it has fewer pieces than the German.
    const germanLeaves = Object.keys(leaves(field.german))
    const theirLeaves = leaves(existing.value)
    return germanLeaves.some((leaf) => !theirLeaves[leaf])
  })
}

/** Build the value to store for one field in one language. */
export function valueFor(field: Field, language: string, translations: Record<string, string>): unknown {
  const prefix = `${field.path.join('.')}::`
  const replacements: Record<string, string> = {}
  for (const [key, text] of Object.entries(translations)) {
    if (key.startsWith(prefix)) replacements[key.slice(prefix.length)] = text
  }
  return withLeaves(field.german, replacements)
}
