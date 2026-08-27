import {useState} from 'react'
import {useClient, type DocumentActionComponent} from 'sanity'
import {useToast} from '@sanity/ui/toast'
import {
  changedOnly,
  collectText,
  LANGUAGES,
  nest,
  type TextMap,
} from '../../src/lib/content/translatable'

/**
 * "Übersetzen" — fills English, French and Luxembourgish from the German.
 *
 * Only the fields whose German text changed since the last run are sent, so a
 * translation someone corrected by hand is never overwritten. What was sent
 * becomes the new reference snapshot.
 */

const parse = (value: unknown): TextMap | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** Merge new translations over what is already stored for that language. */
function mergeStored(stored: unknown, additions: TextMap): string {
  const previous = parse(stored) ?? {}
  return JSON.stringify(nest({...flatten(previous), ...additions}))
}

/** Nested stored JSON back to a flat path map, so merging is by path. */
function flatten(value: any, path: string[] = [], out: TextMap = {}): TextMap {
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

async function translateInto(target: string, texts: TextMap): Promise<TextMap> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({target, texts}),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `Fehler ${response.status}`)
  return body.translations ?? {}
}

export const translateAction: DocumentActionComponent = (props) => {
  const {draft, published, id, type} = props
  const client = useClient({apiVersion: '2026-08-01'})
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const doc: any = draft ?? published
  const german = doc ? collectText(doc) : {}
  const nothingToDo = Object.keys(german).length === 0

  return {
    label: busy ? 'Übersetze…' : 'Übersetzen',
    disabled: busy || nothingToDo,
    title: nothingToDo ? 'Auf dieser Seite gibt es keinen Text zum Übersetzen.' : undefined,
    onHandle: async () => {
      setBusy(true)
      try {
        const previous = parse(doc?.i18n?.translatedFrom)
        const changed = changedOnly(german, previous)

        if (Object.keys(changed).length === 0) {
          toast.push({status: 'info', title: 'Alles schon übersetzt', description: 'Der deutsche Text hat sich seit der letzten Übersetzung nicht geändert.'})
          return
        }

        const patch: Record<string, unknown> = {}
        const done: string[] = []

        for (const {code, label} of LANGUAGES) {
          const translations = await translateInto(code, changed)
          if (Object.keys(translations).length === 0) continue
          patch[`i18n.${code}`] = mergeStored(doc?.i18n?.[code], translations)
          done.push(label)
        }

        if (done.length === 0) {
          toast.push({status: 'error', title: 'Keine Übersetzung erhalten'})
          return
        }

        patch['i18n.translatedFrom'] = JSON.stringify(nest(german))
        patch['i18n.translatedAt'] = new Date().toISOString()

        // The draft is what the client is looking at, so write there.
        await client
          .patch(draft ? `drafts.${id}` : id)
          .setIfMissing({i18n: {}})
          .set(patch)
          .commit()

        const count = Object.keys(changed).length
        toast.push({
          status: 'success',
          title: `${count} ${count === 1 ? 'Feld' : 'Felder'} übersetzt`,
          description: done.join(', '),
        })
      } catch (error: any) {
        toast.push({
          status: 'error',
          title: 'Übersetzung fehlgeschlagen',
          description: error?.message ?? String(error),
        })
      } finally {
        setBusy(false)
        props.onComplete()
      }
    },
  }
}

/** Types with no translatable text of their own. */
export const UNTRANSLATED_TYPES = new Set(['equipmentItem'])
