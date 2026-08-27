import {createElement, useState} from 'react'
import {useClient, type DocumentActionComponent} from 'sanity'
import {Spinner} from '@sanity/ui'
import {useToast} from '@sanity/ui/toast'
import {
  collectFields,
  fingerprint,
  LANGUAGES,
  SOURCE_LANGUAGE,
  staleFields,
  textFor,
  valueFor,
  type Field,
} from '../../src/lib/content/translatable'

/** Where the fingerprints live. One document for the whole site. */
const STATE_ID = 'translation-state'

type State = Record<string, Record<string, string>>

async function readState(client: any): Promise<State> {
  const raw = await client.fetch('*[_id == $id][0].fingerprints', {id: STATE_ID})
  try {
    const parsed = JSON.parse(raw ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Remember what the German said, so the next publish can tell a corrected
 * sentence from an untouched one. Bookkeeping must never break a publish, so a
 * failure here is swallowed — the worst case is one page translated twice.
 */
async function writeState(client: any, state: State) {
  try {
    await client
      .createIfNotExists({_id: STATE_ID, _type: 'translationState'})
      .then(() =>
        client.patch(STATE_ID).set({fingerprints: JSON.stringify(state)}).commit({visibility: 'async'}),
      )
  } catch {
    /* not worth a word to the client */
  }
}

/** Types with no translatable text of their own. */
export const UNTRANSLATED_TYPES = new Set(['equipmentItem', 'translationState'])

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

/** The button's icon while the translation is running. */
const Working = () => createElement(Spinner, {muted: true})

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

  const state = await readState(client)
  const seen = state[id] ?? {}

  const patch: Record<string, unknown> = {}
  const done: string[] = []
  const touched = new Set<string>()

  for (const {code, label} of LANGUAGES) {
    const stale: Field[] = staleFields(all, code, seen)
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

  // Record every field, not only the translated ones: a field that was already
  // translated before any of this existed gets its fingerprint now, and is
  // then left alone until its German actually changes.
  const now: Record<string, string> = {}
  for (const field of all) now[field.patch] = fingerprint(field)
  await writeState(client, {...state, [id]: now})

  if (touched.size === 0) return {fields: 0, languages: []}

  /*
   * Normally the draft is what gets the translations, and the publish that
   * follows carries them over. If translating took long enough that the draft
   * is already gone, write to the published document instead — otherwise the
   * work is thrown away with a "document not found".
   */
  try {
    await client.patch(isDraft ? `drafts.${id}` : id).set(patch).commit()
  } catch (error: any) {
    if (!isDraft) throw error
    await client.patch(id).set(patch).commit()
  }

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
    icon: busy ? Working : undefined,
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
 * Translating three languages takes seconds, and a button that looks idle for
 * seconds reads as broken — so it says what it is doing and turns while it
 * does it.
 *
 * If the translation service is down the publish still goes through: a page
 * that is live in German beats a page that is not live at all.
 */
export function withAutoTranslate(action: DocumentActionComponent): DocumentActionComponent {
  const wrapped: DocumentActionComponent = (props) => {
    const original = action(props)
    const client = useClient({apiVersion: '2026-08-01'})
    const toast = useToast()
    const [busy, setBusy] = useState(false)

    if (!original) return original

    return {
      ...original,
      disabled: busy || original.disabled,
      label: busy ? 'Übersetzt…' : original.label,
      title: busy ? 'Die anderen Sprachen werden geschrieben.' : original.title,
      icon: busy ? Working : original.icon,
      onHandle: async () => {
        const doc: any = props.draft ?? props.published
        setBusy(true)
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
        } finally {
          setBusy(false)
        }
        original.onHandle?.()
      },
    }
  }

  wrapped.action = action.action
  return wrapped
}
