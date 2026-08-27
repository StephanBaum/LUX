import {useCallback, useMemo} from 'react'
import {PatchEvent, set, type ObjectInputProps} from 'sanity'
import {Badge, Box, Card, Stack, Text, TextArea} from '@sanity/ui'

/**
 * Editor for the hidden translation mirror.
 *
 * The mirror is stored as one JSON blob per language, which is the right shape
 * for the site to merge over the German — but nobody should have to edit JSON.
 * This shows one row per translated text, labelled with the field it belongs
 * to, beside the German it came from, and writes the blob back on change.
 */

const LANGUAGES = [
  {code: 'en', label: 'English'},
  {code: 'fr', label: 'Français'},
  {code: 'lu', label: 'Lëtzebuergesch'},
] as const

type Flat = Record<string, string>

function flatten(value: any, path: string[] = [], out: Flat = {}): Flat {
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

function nest(flat: Flat): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.')
    let target = out
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        target[part] = value
        return
      }
      if (target[part] === undefined) target[part] = /^\d+$/.test(parts[i + 1]) ? [] : {}
      target = target[part]
    })
  }
  return out
}

const parse = (value: unknown): Flat => {
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    return flatten(JSON.parse(value))
  } catch {
    return {}
  }
}

/** "sectionMenschen.expertise.0.title" → "Abschnitt Menschen › Expertise 1 › Titel" */
function humanise(path: string): string {
  return path
    .split('.')
    .map((part) => {
      if (/^\d+$/.test(part)) return `${Number(part) + 1}`
      return part
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase())
    })
    .reduce<string[]>((acc, part) => {
      // Fold an index into the label before it: "Expertise", "1" → "Expertise 1"
      if (/^\d+$/.test(part) && acc.length) {
        acc[acc.length - 1] = `${acc[acc.length - 1]} ${part}`
        return acc
      }
      acc.push(part)
      return acc
    }, [])
    .join(' › ')
}

export function TranslationsInput(props: ObjectInputProps) {
  const {value, onChange, readOnly} = props

  const german = useMemo(() => parse((value as any)?.translatedFrom), [value])
  const translatedAt = (value as any)?.translatedAt

  const setText = useCallback(
    (code: string, path: string, text: string) => {
      const current = parse((value as any)?.[code])
      const next = {...current, [path]: text}
      onChange(PatchEvent.from(set(JSON.stringify(nest(next)), [code])))
    },
    [onChange, value],
  )

  const paths = Object.keys(german)

  if (paths.length === 0) {
    return (
      <Card padding={4} radius={2} tone="transparent" border>
        <Text size={1} muted>
          Noch nichts übersetzt. Die Schaltfläche „Übersetzen“ unten rechts füllt Englisch,
          Französisch und Lëtzebuergesch aus dem deutschen Text.
        </Text>
      </Card>
    )
  }

  return (
    <Stack gap={5}>
      <Text size={1} muted>
        {translatedAt
          ? `Zuletzt übersetzt am ${new Date(translatedAt).toLocaleString('de-DE')}.`
          : 'Noch nicht übersetzt.'}{' '}
        Eine Formulierung hier zu ändern ist in Ordnung — sie bleibt erhalten, solange der
        deutsche Text daneben unverändert bleibt.
      </Text>

      {LANGUAGES.map(({code, label}) => {
        const translations = parse((value as any)?.[code])
        const missing = paths.filter((path) => !translations[path]).length

        return (
          <Stack key={code} gap={3}>
            <Box>
              <Text size={2} weight="semibold">
                {label}{' '}
                {missing > 0 && (
                  <Badge tone="caution" fontSize={0}>
                    {missing} fehlen
                  </Badge>
                )}
              </Text>
            </Box>

            <Stack gap={4}>
              {paths.map((path) => (
                <Card key={path} padding={3} radius={2} tone="transparent" border>
                  <Stack gap={2}>
                    <Text size={0} muted weight="medium">
                      {humanise(path)}
                    </Text>
                    <Text size={1} muted style={{fontStyle: 'italic'}}>
                      {german[path]}
                    </Text>
                    <TextArea
                      value={translations[path] ?? ''}
                      rows={Math.min(6, Math.ceil((german[path]?.length ?? 0) / 70) + 1)}
                      readOnly={readOnly}
                      onChange={(event) => setText(code, path, event.currentTarget.value)}
                    />
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Stack>
        )
      })}
    </Stack>
  )
}
