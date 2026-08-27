import {useMemo, useState} from 'react'
import {PatchEvent, set, type ArrayOfObjectsInputProps} from 'sanity'
import {Box, Flex, Stack, Text, TextArea, TextInput} from '@sanity/ui'

/**
 * One field, one input, with a small language switcher underneath.
 *
 * The plugin's own input stacks every language on top of each other, which
 * makes a page four times as long for translations nobody usually reads — they
 * are written by the machine on publish. This shows German, and lets you step
 * into another language only when a wording needs fixing. A language with no
 * text yet is marked.
 */

const LANGUAGES = [
  {code: 'de', label: 'DE'},
  {code: 'en', label: 'EN'},
  {code: 'fr', label: 'FR'},
  {code: 'lu', label: 'LU'},
]

type Entry = {_key?: string; language: string; value?: string}

export function CompactTranslation(props: ArrayOfObjectsInputProps) {
  const {value, onChange, readOnly, schemaType, elementProps} = props
  const [active, setActive] = useState('de')

  const entries = (value ?? []) as unknown as Entry[]
  const multiline = schemaType.name === 'internationalizedArrayText'

  const current = useMemo(
    () => entries.find((entry) => entry.language === active),
    [entries, active],
  )

  const write = (text: string) => {
    const rest = entries.filter((entry) => entry.language !== active)
    const next = [
      ...rest,
      {_key: current?._key ?? active, _type: `${schemaType.name}Value`, language: active, value: text},
    ].sort(
      (a, b) =>
        LANGUAGES.findIndex((l) => l.code === a.language) -
        LANGUAGES.findIndex((l) => l.code === b.language),
    )
    onChange(PatchEvent.from(set(next)))
  }

  const Field = multiline ? TextArea : TextInput

  return (
    <Stack gap={2}>
      <Field
        {...elementProps}
        value={current?.value ?? ''}
        readOnly={readOnly}
        rows={multiline ? 5 : undefined}
        onChange={(event: any) => write(event.currentTarget.value)}
      />

      <Flex gap={1} align="center">
        {LANGUAGES.map(({code, label}) => {
          const filled = Boolean(entries.find((entry) => entry.language === code)?.value)
          const isActive = code === active

          return (
            <Box
              key={code}
              as="button"
              type="button"
              onClick={() => setActive(code)}
              paddingX={2}
              paddingY={1}
              style={{
                background: 'none',
                border: 0,
                borderBottom: `2px solid ${isActive ? 'currentColor' : 'transparent'}`,
                cursor: 'pointer',
                opacity: isActive ? 1 : filled ? 0.55 : 0.3,
              }}
            >
              <Text size={0} weight={isActive ? 'semibold' : 'regular'}>
                {label}
                {!filled && code !== 'de' ? ' ·' : ''}
              </Text>
            </Box>
          )
        })}
      </Flex>
    </Stack>
  )
}
