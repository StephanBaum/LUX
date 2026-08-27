import type {DocumentBadgeComponent} from 'sanity'
import {collectFields, LANGUAGES, staleFields} from '../../src/lib/content/translatable'

/**
 * Marks a document whose German has moved on since it was last translated, so
 * nobody publishes a page that is only half in the other languages.
 */
export const translationBadge: DocumentBadgeComponent = ({draft, published}) => {
  const doc: any = draft ?? published
  if (!doc) return null

  const fields = collectFields(doc)
  if (fields.length === 0) return null

  const missing = new Set<string>()
  for (const {code} of LANGUAGES) {
    for (const field of staleFields(fields, code)) missing.add(field.path.join('.'))
  }

  if (missing.size === 0) return null

  return {
    label: `${missing.size} ${missing.size === 1 ? 'Feld' : 'Felder'} nicht übersetzt`,
    color: 'warning',
    title: 'Wird beim Veröffentlichen automatisch übersetzt.',
  }
}
