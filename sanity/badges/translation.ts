import type {DocumentBadgeComponent} from 'sanity'
import {collectText} from '../../src/lib/content/translatable'

function flatten(value: any, path: string[] = [], out: Record<string, string> = {}) {
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

/**
 * Marks a document whose German has moved on since it was last translated, so
 * nobody publishes a page that is only half in the other languages.
 */
export const translationBadge: DocumentBadgeComponent = ({draft, published}) => {
  const doc: any = draft ?? published
  if (!doc) return null

  const german = collectText(doc)
  if (Object.keys(german).length === 0) return null

  const snapshot = doc?.i18n?.translatedFrom
  if (!snapshot) {
    return {
      label: 'Nicht übersetzt',
      color: 'warning',
      title: 'Für diese Seite gibt es noch keine Übersetzung.',
    }
  }

  let previous: Record<string, string> = {}
  try {
    previous = flatten(JSON.parse(snapshot))
  } catch {
    return null
  }

  const stale = Object.entries(german).filter(([path, text]) => previous[path] !== text)
  if (stale.length === 0) return null

  return {
    label: `Übersetzung veraltet (${stale.length})`,
    color: 'warning',
    title: 'Der deutsche Text wurde geändert. Auf "Übersetzen" klicken.',
  }
}
