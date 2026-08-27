import {useCallback, useEffect, useRef, useState} from 'react'
import {PatchEvent, set, useFormValue, type ObjectInputProps} from 'sanity'
import {Button, Flex, Stack, Text} from '@sanity/ui'

/**
 * A picture that describes itself.
 *
 * Alt text is invisible on the page, so it never gets written — and then a
 * screen reader announces "image" and Google reads nothing. As soon as a
 * picture is chosen, the machine looks at it and writes the German sentence.
 * It is an ordinary field afterwards: edit it, and nothing overwrites you. The
 * other languages are filled in on publish, like everywhere else.
 */

const VALUE_TYPE = 'internationalizedArrayStringValue'

type Entry = {_key?: string; _type?: string; language: string; value?: string}

/** What a document is about, so the description can use the right words. */
const CONTEXT: Record<string, string> = {
  homePage: 'die Startseite eines Fotostudios',
  studioPage: 'die Studio-Seite',
  mietenPage: 'die Seite über die Vermietung der Räume',
  workshopsPage: 'die Workshop-Seite',
  veranstaltungenPage: 'die Seite über Veranstaltungen',
  beratungPage: 'die Seite über Bildberatung für Unternehmen',
  person: 'die Vorstellung einer Person im Team',
  room: 'ein Raum, der vermietet wird',
  workshop: 'ein Workshop',
}

export function PhotoInput(props: ObjectInputProps) {
  const {value, onChange, readOnly} = props
  const documentType = useFormValue(['_type']) as string | undefined

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const ref = (value as any)?.asset?._ref as string | undefined

  /*
   * Alt text used to be one plain string. A document written before the
   * languages moved onto the fields still holds one, and a plain string has no
   * .find — so read it as the German entry rather than falling over.
   */
  const stored = (value as any)?.alt
  const entries: Entry[] = Array.isArray(stored)
    ? stored
    : typeof stored === 'string' && stored.trim()
      ? [{_key: 'de', _type: VALUE_TYPE, language: 'de', value: stored}]
      : []
  const german = entries.find((entry) => entry.language === 'de')?.value
  const described = Boolean(german && german.trim())

  // One attempt per picture: a picture the service cannot read must not be
  // retried on every keystroke somewhere else on the page.
  const attempted = useRef<Set<string>>(new Set())

  const describe = useCallback(
    async (assetRef: string) => {
      setBusy(true)
      setFailed(null)
      try {
        const response = await fetch('/api/describe', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ref: assetRef, context: CONTEXT[documentType ?? '']}),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok || !body.alt) throw new Error(body.error ?? `Fehler ${response.status}`)

        const rest = entries.filter((entry) => entry.language !== 'de')
        onChange(
          PatchEvent.from(
            set([{_key: 'de', _type: VALUE_TYPE, language: 'de', value: body.alt}, ...rest], ['alt']),
          ),
        )
      } catch (error: any) {
        setFailed(error?.message ?? String(error))
      } finally {
        setBusy(false)
      }
    },
    [documentType, entries, onChange],
  )

  useEffect(() => {
    if (readOnly || busy || !ref || described) return
    if (attempted.current.has(ref)) return
    attempted.current.add(ref)
    describe(ref)
    // `describe` changes with every keystroke in a sibling field; the guard
    // above is what keeps this to one call per picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, described, readOnly])

  return (
    <Stack space={3}>
      {props.renderDefault(props)}

      {ref && !readOnly && (
        <Flex align="center" gap={2}>
          <Button
            mode="bleed"
            fontSize={1}
            padding={2}
            disabled={busy}
            text={busy ? 'Beschreibt…' : described ? 'Beschreibung neu erzeugen' : 'Beschreibung erzeugen'}
            onClick={() => describe(ref)}
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
