import {defineField} from 'sanity'

/**
 * Hidden mirror of the German fields for en / fr / lu.
 * The client never sees this — the "Übersetzen" action fills it.
 * Each language holds a JSON snapshot of the document's translatable fields.
 */
/** Google-Calendar sync state. Read-only for the client. */
export const syncFields = [
  defineField({name: 'googleEventId', type: 'string', group: 'sync', readOnly: true}),
  defineField({name: 'googleCalendarId', type: 'string', group: 'sync', readOnly: true}),
  defineField({name: 'syncedTitle', type: 'string', group: 'sync', readOnly: true}),
  defineField({name: 'syncedStartAt', type: 'datetime', group: 'sync', readOnly: true}),
  defineField({name: 'syncedEndAt', type: 'datetime', group: 'sync', readOnly: true}),
  defineField({name: 'syncedAt', type: 'datetime', group: 'sync', readOnly: true}),
  defineField({
    name: 'syncStatus',
    title: 'Kalender-Status',
    type: 'string',
    group: 'sync',
    readOnly: true,
    options: {list: ['ok', 'error', 'date-missing', 'needs-details']},
  }),
  defineField({name: 'syncMessage', title: 'Hinweis', type: 'text', group: 'sync', readOnly: true}),
]

/** Standard German hint telling the client that seeded text is a placeholder. */
export const PLACEHOLDER = 'Platzhalter-Text — bitte durch eigenen Text ersetzen.'
export const PLACEHOLDER_IMG = 'Platzhalter-Bild — bitte durch ein eigenes Foto ersetzen.'

/** The German entry of an internationalized field; anything else passes through. */
export const germanOf = (value: any) =>
  Array.isArray(value) ? value.find((entry) => entry?.language === 'de')?.value : value

/**
 * A document preview that understands internationalized fields. Without it a
 * list shows "Invalid preview config", because the title is an array now.
 */
export const germanPreview = (select: Record<string, string>) => ({
  select,
  prepare: (values: Record<string, any>) => {
    const out: Record<string, any> = {}
    for (const key of Object.keys(select)) {
      out[key] = key === 'media' ? values[key] : germanOf(values[key])
    }
    return out
  },
})
