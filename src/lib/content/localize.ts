export const LANGS = ['de', 'en', 'fr', 'lu'] as const
export type Lang = (typeof LANGS)[number]
export const DEFAULT_LANG: Lang = 'de'

type Plain = Record<string, any>

const isPlainObject = (v: unknown): v is Plain =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Overlay wins, but only where it actually has a value. Arrays are merged by
 * position so a translated list keeps the German entries it does not cover.
 */
function merge(base: any, overlay: any): any {
  if (overlay === undefined || overlay === null || overlay === '') return base
  if (Array.isArray(base) && Array.isArray(overlay)) {
    return base.map((item, i) => merge(item, overlay[i]))
  }
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const out: Plain = {...base}
    for (const key of Object.keys(overlay)) out[key] = merge(base[key], overlay[key])
    return out
  }
  return overlay
}

function parse(json: unknown): Plain | null {
  if (typeof json !== 'string' || !json.trim()) return null
  try {
    const value = JSON.parse(json)
    return isPlainObject(value) ? value : null
  } catch {
    return null
  }
}

/**
 * German is what the client types. Every other language is the German document
 * with the hidden `i18n` mirror laid over it, so an untranslated field simply
 * falls back to German instead of disappearing.
 */
export function localize<T>(value: T, lang: Lang): T {
  if (lang === DEFAULT_LANG) return stripI18n(value)

  if (Array.isArray(value)) return value.map((item) => localize(item, lang)) as unknown as T
  if (!isPlainObject(value)) return value

  const doc = value as Plain
  const translated = doc.i18n ? parse(doc.i18n[lang]) : null

  const out: Plain = {}
  for (const key of Object.keys(doc)) {
    if (key === 'i18n') continue
    out[key] = localize(doc[key], lang)
  }

  return (translated ? merge(out, translated) : out) as T
}

function stripI18n<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripI18n) as unknown as T
  if (!isPlainObject(value)) return value
  const out: Plain = {}
  for (const key of Object.keys(value as Plain)) {
    if (key === 'i18n') continue
    out[key] = stripI18n((value as Plain)[key])
  }
  return out as T
}
