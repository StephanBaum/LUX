import {useState} from 'react'
import {useClient, type DocumentActionComponent} from 'sanity'
import {useToast} from '@sanity/ui/toast'
import {
  collectFields,
  LANGUAGES,
  SOURCE_LANGUAGE,
  staleFields,
  textFor,
  valueFor,
  type Field,
} from '../../src/lib/content/translatable'

/** Types with no translatable text of their own. */
export const UNTRANSLATED_TYPES = new Set(['equipmentItem'])

async function translateInto(target: string, texts: Record<string, string>) {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({target, texts}),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `Fehler ${response.status}`)
  return (body.translations ?? {}) as Record<string, string>
}

const ORDER = [SOURCE_LANGUAGE, ...LANGUAGES.map((language) => language.code)]

/** Put a translated value into the field's array, keeping the other languages. */
function merge(entries: any[], language: string, value: unknown) {
  return [...entries.filter((entry) => entry.language !== language), {_key: language, language, value}].sort(
    (a, b) => ORDER.indexOf(a.language) - ORDER.indexOf(b.language),
  )
}

/**
 * Bring a document's translations up to date, and report how much moved.
 * Only fields that have no counterpart yet are sent, so a translation someone
 * corrected by hand is never overwritten.
 */
export async function syncTranslations(
  client: any,
  doc: any,
  id: string,
  isDraft: boolean,
): Promise<{fields: number; languages: string[]}> {
  const all = collectFields(doc)
  if (all.length === 0) return {fields: 0, languages: []}

  const patch: Record<string, unknown> = {}
  const done: string[] = []
  const touched = new Set<string>()

  for (const {code, label} of LANGUAGES) {
    const stale: Field[] = staleFields(all, code)
    if (stale.length === 0) continue

    const translations = await translateInto(code, textFor(stale))
    if (Object.keys(translations).length === 0) continue

    for (const field of stale) {
      const current = (patch[field.patch] as any[]) ?? field.entries
      patch[field.patch] = merge(current, code, valueFor(field, code, translations))
      touched.add(field.patch)
    }
    done.push(label)
  }

  if (touched.size === 0) return {fields: 0, languages: []}

  await client.patch(isDraft ? `drafts.${id}` : id).set(patch).commit()
  return {fields: touched.size, languages: done}
}

export const translateAction: DocumentActionComponent = (props) => {
  const {draft, published, id} = props
  const client = useClient({apiVersion: '2026-08-01'})
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const doc: any = draft ?? published

  return {
    label: busy ? 'Übersetze…' : 'Übersetzen',
    disabled: busy || !doc,
    onHandle: async () => {
      setBusy(true)
      try {
        const result = await syncTranslations(client, doc, id, Boolean(draft))
        toast.push(
          result.fields === 0
            ? {
                status: 'info',
                title: 'Alles schon übersetzt',
                description: 'Der deutsche Text hat sich seit der letzten Übersetzung nicht geändert.',
              }
            : {
                status: 'success',
                title: `${result.fields} ${result.fields === 1 ? 'Feld' : 'Felder'} übersetzt`,
                description: result.languages.join(', '),
              },
        )
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

/**
 * Publishing is the moment the German becomes real, so that is when the other
 * languages are filled in — no button to remember.
 *
 * If the translation service is down the publish still goes through: a page
 * that is live in German beats a page that is not live at all.
 */
export function withAutoTranslate(action: DocumentActionComponent): DocumentActionComponent {
  const wrapped: DocumentActionComponent = (props) => {
    const original = action(props)
    const client = useClient({apiVersion: '2026-08-01'})
    const toast = useToast()

    if (!original) return original

    return {
      ...original,
      onHandle: async () => {
        const doc: any = props.draft ?? props.published
        try {
          const result = await syncTranslations(client, doc, props.id, Boolean(props.draft))
          if (result.fields > 0) {
            toast.push({
              status: 'success',
              title: `${result.fields} ${result.fields === 1 ? 'Feld' : 'Felder'} übersetzt`,
              description: result.languages.join(', '),
            })
          }
        } catch (error: any) {
          toast.push({
            status: 'warning',
            title: 'Ohne neue Übersetzung veröffentlicht',
            description: error?.message ?? String(error),
          })
        }
        original.onHandle?.()
      },
    }
  }

  wrapped.action = action.action
  return wrapped
}
