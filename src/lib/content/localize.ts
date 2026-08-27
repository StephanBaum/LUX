export const LANGS = ['de', 'en', 'fr', 'lu'] as const
export type Lang = (typeof LANGS)[number]
export const DEFAULT_LANG: Lang = 'de'

/**
 * Translatable fields are stored inline as
 * `[{_key, language: 'de', value: …}, {_key, language: 'en', value: …}]`.
 *
 * `localize` walks a document and replaces every one of those arrays with the
 * value for the language asked for, falling back to German — so a field nobody
 * has translated yet still reads correctly instead of vanishing.
 */

const isInternationalized = (value: unknown): value is {language: string; value: unknown}[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => item && typeof item === 'object' && typeof (item as any).language === 'string')

function pick(entries: {language: string; value: unknown}[], lang: Lang): unknown {
  const wanted = entries.find((entry) => entry.language === lang)
  if (wanted && wanted.value !== undefined && wanted.value !== null && wanted.value !== '') {
    return wanted.value
  }
  return entries.find((entry) => entry.language === DEFAULT_LANG)?.value
}

export function localize<T>(value: T, lang: Lang): T {
  if (isInternationalized(value)) return localize(pick(value, lang), lang) as unknown as T
  if (Array.isArray(value)) return value.map((item) => localize(item, lang)) as unknown as T

  if (!value || typeof value !== 'object') return value

  const out: Record<string, any> = {}
  for (const [key, item] of Object.entries(value as Record<string, any>)) {
    out[key] = localize(item, lang)
  }
  return out as T
}
