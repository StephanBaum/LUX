import {defineField, defineType} from 'sanity'
import {germanPreview} from '../../lib/fields'

/**
 * Impressum, Datenschutz and AGB — three fixed documents with the ids
 * `legal-impressum`, `legal-datenschutz`, `legal-agb`.
 *
 * The body is a list of titled sections rather than one rich-text field,
 * because the AGB page renders each section as an accordion item.
 */
export default defineType({
  name: 'legalPage',
  title: 'Rechtstext',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Überschrift', type: 'internationalizedArrayString', validation: (r) => r.required()}),
    defineField({name: 'intro', title: 'Einleitungstext', type: 'internationalizedArrayText'}),
    defineField({name: 'updatedLabel', title: 'Beschriftung "Stand"', type: 'internationalizedArrayString'}),
    defineField({name: 'updatedAt', title: 'Stand vom', type: 'date'}),
    defineField({
      name: 'sections',
      title: 'Abschnitte',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'legalSection',
          fields: [
            defineField({name: 'title', title: 'Überschrift', type: 'internationalizedArrayString', validation: (r) => r.required()}),
            defineField({
              name: 'body',
              title: 'Text',
              type: 'internationalizedArrayRichText',
            }),
          ],
          preview: germanPreview({title: 'title'}),
        },
      ],
    }),
  ],
  preview: germanPreview({title: 'title'}),
})
