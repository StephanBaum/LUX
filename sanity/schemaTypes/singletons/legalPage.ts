import {defineField, defineType} from 'sanity'
import {i18nField} from '../../lib/fields'

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
    defineField({name: 'title', title: 'Überschrift', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'intro', title: 'Einleitungstext', type: 'text', rows: 3}),
    defineField({name: 'updatedLabel', title: 'Beschriftung "Stand"', type: 'string'}),
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
            defineField({name: 'title', title: 'Überschrift', type: 'string', validation: (r) => r.required()}),
            defineField({
              name: 'body',
              title: 'Text',
              type: 'array',
              of: [
                {
                  type: 'block',
                  styles: [
                    {title: 'Absatz', value: 'normal'},
                    {title: 'Zwischen-Überschrift', value: 'h3'},
                  ],
                  lists: [{title: 'Liste', value: 'bullet'}],
                  marks: {
                    decorators: [
                      {title: 'Fett', value: 'strong'},
                      {title: 'Kursiv', value: 'em'},
                    ],
                  },
                },
              ],
            }),
          ],
          preview: {select: {title: 'title'}},
        },
      ],
    }),
    i18nField,
  ],
  preview: {select: {title: 'title'}},
})
