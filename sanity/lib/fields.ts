import {defineField} from 'sanity'
import {TranslationsInput} from '../components/TranslationsInput'

/**
 * Hidden mirror of the German fields for en / fr / lu.
 * The client never sees this — the "Übersetzen" action fills it.
 * Each language holds a JSON snapshot of the document's translatable fields.
 */
export const i18nField = defineField({
  name: 'i18n',
  title: 'Übersetzungen',
  type: 'object',
  group: 'i18n',
  description:
    'Wird von der Schaltfläche „Übersetzen“ gefüllt. Jede Formulierung lässt sich hier ' +
    'von Hand ändern — sie bleibt erhalten, solange der deutsche Text daneben ' +
    'unverändert bleibt.',
  components: {input: TranslationsInput},
  fields: [
    defineField({name: 'en', type: 'text', title: 'English'}),
    defineField({name: 'fr', type: 'text', title: 'Français'}),
    defineField({name: 'lu', type: 'text', title: 'Lëtzebuergesch'}),
    defineField({name: 'translatedFrom', type: 'text', title: 'Deutscher Stand', readOnly: true}),
    defineField({name: 'translatedAt', type: 'datetime', title: 'Zuletzt übersetzt', readOnly: true}),
  ],
})

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
