import {useCallback, useEffect, useRef, useState} from 'react'
import {PatchEvent, set, useFormValue, type ObjectInputProps} from 'sanity'
import {Button, Flex, Stack, Text} from '@sanity/ui'
import {collectFields, textFor} from '../../src/lib/content/translatable'

/**
 * The two lines Google shows, written from the page itself.
 *
 * They are not the page's headline: a headline speaks to someone who already
 * arrived, a search result to someone deciding whether to. Written twice, they
 * get written once — so the fields stay empty and Google makes up its own. Here
 * the page's German text goes in and a draft comes back the first time the tab
 * is opened. Edit it and it stays edited; nothing overwrites a filled field.
 */

const VALUE_TYPE = {
  metaTitle: 'internationalizedArrayStringValue',
  metaDescription: 'internationalizedArrayTextValue',
}

const PAGE_NAMES: Record<string, string> = {
  homePage: 'Startseite des Studios',
  studioPage: 'Über das Studio, die Räume und die Ausstattung',
  mietenPage: 'Räume und Studio mieten',
  workshopsPage: 'Workshops',
  veranstaltungenPage: 'Veranstaltungen',
  beratungPage: 'Bildberatung für Unternehmen',
}

type Entry = {_key?: string; _type?: string; language: string; value?: string}

const germanOf = (value: unknown) =>
  Array.isArray(value)
    ? (value as Entry[]).find((entry) => entry.language === 'de')?.value?.trim()
    : undefined

export function SeoInput(props: ObjectInputProps) {
  const {value, onChange, readOnly} = props
  const doc = useFormValue([]) as any

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const hasTitle = Boolean(germanOf((value as any)?.metaTitle))
  const hasDescription = Boolean(germanOf((value as any)?.metaDescription))
  const empty = !hasTitle && !hasDescription

  /** Everything the page says in German, minus the search-result text itself. */
  const pageText = (() => {
    if (!doc) return ''
    const fields = collectFields(doc).filter((field) => field.path[0] !== 'seo')
    return Object.values(textFor(fields)).join('\n')
  })()

  // One attempt per document per session, so an empty tab is not a running tab.
  const attempted = useRef<Set<string>>(new Set())

  const write = useCallback(
    (name: 'metaTitle' | 'metaDescription', text: string) => {
      // A document written before the languages moved onto the fields may
      // still hold one plain string here; it is replaced, not merged.
      const stored = (value as any)?.[name]
      const existing = (Array.isArray(stored) ? (stored as Entry[]) : []).filter(
        (entry) => entry.language !== 'de',
      )
      return set([{_key: 'de', _type: VALUE_TYPE[name], language: 'de', value: text}, ...existing], [
        name,
      ])
    },
    [value],
  )

  const suggest = useCallback(async () => {
    setBusy(true)
    setFailed(null)
    try {
      const response = await fetch('/api/seo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({page: PAGE_NAMES[doc?._type] ?? doc?._type, text: pageText}),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? `Fehler ${response.status}`)

      onChange(
        PatchEvent.from([
          write('metaTitle', body.metaTitle),
          write('metaDescription', body.metaDescription),
        ]),
      )
    } catch (error: any) {
      setFailed(error?.message ?? String(error))
    } finally {
      setBusy(false)
    }
  }, [doc, pageText, onChange, write])

  useEffect(() => {
    const id = doc?._id
    if (readOnly || busy || !id || !empty) return
    if (pageText.length < 40) return
    if (attempted.current.has(id)) return
    attempted.current.add(id)
    suggest()
    // The guard above is what keeps this to one call per document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?._id, empty, readOnly, pageText.length])

  return (
    <Stack space={3}>
      {props.renderDefault(props)}

      {!readOnly && (
        <Flex align="center" gap={2}>
          <Button
            mode="bleed"
            fontSize={1}
            padding={2}
            disabled={busy || pageText.length < 40}
            text={busy ? 'Schreibt…' : empty ? 'Google-Texte vorschlagen' : 'Google-Texte neu vorschlagen'}
            onClick={suggest}
          />
          {failed && (
            <Text size={1} muted>
              {failed}
            </Text>
          )}
        </Flex>
      )}
    </Stack>
  )
}
